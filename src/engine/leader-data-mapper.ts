/**
 * Leader Data Mapper — FR-4406
 *
 * Maps `ExtendedLeaderProfile` models (from `models/leaders/*.json`)
 * to game-compatible `LeaderProfile` and `AIProfileConfig` structures.
 *
 * Handles the schema differences between the reference model JSONs
 * and the game engine's type system:
 *
 * - JSON `decisionStyle` → game `DecisionStyle` enum
 * - JSON `stressResponse` → game `StressResponse` enum
 * - JSON `powerBase` (source/consolidation/legitimacy) → game `PowerBase` (6 support pillars)
 * - JSON `vulnerabilities` (health/internalOpposition/externalPressure) → game `LeaderVulnerabilities`
 * - JSON `motivations` (primary/secondary/fear) → game `LeaderMotivations`
 *
 * @module leader-data-mapper
 * @see FR-4406 — Leader profile updates from model data
 */

import type { FactionId, LeaderId } from '@/data/types/enums';
import { DecisionStyle, StressResponse } from '@/data/types/enums';
import type {
  LeaderProfile,
  LeaderPsychology,
  LeaderMotivations,
  PowerBase,
  LeaderVulnerabilities,
  LeaderIdentity,
  EmotionalStateSnapshot,
  LeaderBiasAssignment,
} from '@/data/types/leader.types';
import type { AIProfileConfig } from '@/data/types/scenario.types';
import type { ExtendedLeaderProfile } from '@/data/types/model.types';
import type { LeaderDataPoint } from '@/data/types/live-data.types';

// ── Faction ID Mapping ──────────────────────────────────────────────────────

/**
 * Maps JSON model factionId strings to game FactionId values.
 * The JSON models use slightly different identifiers in some cases.
 */
const FACTION_ID_MAP: Record<string, FactionId> = {
  'usa': 'us' as FactionId,
  'us': 'us' as FactionId,
  'china': 'china' as FactionId,
  'russia': 'russia' as FactionId,
  'japan': 'japan' as FactionId,
  'iran': 'iran' as FactionId,
  'dprk': 'dprk' as FactionId,
  'eu': 'eu' as FactionId,
  'syria': 'syria' as FactionId,
};

/**
 * Resolve a model factionId to a game FactionId.
 * Returns null if the faction is not part of the game (e.g. "india", "saudi_arabia").
 */
export function resolveModelFactionId(modelFactionId: string): FactionId | null {
  return FACTION_ID_MAP[modelFactionId.toLowerCase()] ?? null;
}

// ── Decision Style Mapping ──────────────────────────────────────────────────

/**
 * Maps JSON model `decisionStyle` strings to game `DecisionStyle` enum values.
 *
 * The JSON models use a broader vocabulary; we map to the closest game equivalent:
 * - "analytical" → Analytical
 * - "intuitive" → Intuitive
 * - "consultative" → Analytical (methodical, evidence-based)
 * - "autocratic" → Intuitive (gut-feel, top-down)
 * - "consensus" → Analytical (systematic evaluation)
 */
const DECISION_STYLE_MAP: Record<string, DecisionStyle> = {
  'analytical': DecisionStyle.Analytical,
  'intuitive': DecisionStyle.Intuitive,
  'consultative': DecisionStyle.Analytical,
  'autocratic': DecisionStyle.Intuitive,
  'consensus': DecisionStyle.Analytical,
};

export function mapDecisionStyle(modelStyle: string): DecisionStyle {
  return DECISION_STYLE_MAP[modelStyle.toLowerCase()] ?? DecisionStyle.Analytical;
}

// ── Stress Response Mapping ─────────────────────────────────────────────────

/**
 * Maps JSON model `stressResponse` strings to game `StressResponse` enum values.
 *
 * - "escalate" → Escalate
 * - "withdraw" → Retreat
 * - "delegate" → Deflect
 * - "freeze" → Consolidate (bunker down)
 * - "innovate" → Consolidate (regroup and adapt)
 */
const STRESS_RESPONSE_MAP: Record<string, StressResponse> = {
  'escalate': StressResponse.Escalate,
  'withdraw': StressResponse.Retreat,
  'delegate': StressResponse.Deflect,
  'freeze': StressResponse.Consolidate,
  'innovate': StressResponse.Consolidate,
};

export function mapStressResponse(modelResponse: string): StressResponse {
  return STRESS_RESPONSE_MAP[modelResponse.toLowerCase()] ?? StressResponse.Consolidate;
}

// ── Power Base Derivation ───────────────────────────────────────────────────

/**
 * Derive game `PowerBase` (6 support pillars) from model's
 * source/consolidation/legitimacy structure.
 *
 * Uses the power source to weight the 6 pillars, then scales
 * all values by the consolidation score.
 */
export function derivePowerBase(model: ExtendedLeaderProfile): PowerBase {
  const source = model.powerBase.source ?? 'party';
  const consolidation = model.powerBase.consolidation ?? 50;
  const legitimacy = model.powerBase.legitimacy ?? 50;

  // Base distribution weights per source type
  const weights: Record<string, PowerBase> = {
    'military':      { military: 85, oligarchs: 30, party: 40, clergy: 5,  public: 25, securityServices: 70 },
    'party':         { military: 50, oligarchs: 40, party: 85, clergy: 15, public: 45, securityServices: 55 },
    'dynasty':       { military: 60, oligarchs: 70, party: 50, clergy: 40, public: 30, securityServices: 65 },
    'popular':       { military: 55, oligarchs: 45, party: 60, clergy: 20, public: 80, securityServices: 45 },
    'religious':     { military: 40, oligarchs: 20, party: 35, clergy: 90, public: 50, securityServices: 55 },
    'economic':      { military: 35, oligarchs: 85, party: 50, clergy: 10, public: 40, securityServices: 40 },
    'intelligence':  { military: 55, oligarchs: 50, party: 60, clergy: 5,  public: 20, securityServices: 90 },
  };

  const base = weights[source] ?? weights['party']!;

  // Scale by consolidation (0–100) to reflect how firmly the leader holds power
  const scale = consolidation / 100;
  // Use legitimacy to boost public support
  const legitimacyBoost = (legitimacy - 50) / 100;

  return {
    military: clamp(Math.round(base.military * scale)),
    oligarchs: clamp(Math.round(base.oligarchs * scale)),
    party: clamp(Math.round(base.party * scale)),
    clergy: clamp(Math.round(base.clergy * scale)),
    public: clamp(Math.round(base.public * scale + legitimacyBoost * 20)),
    securityServices: clamp(Math.round(base.securityServices * scale)),
  };
}

// ── Vulnerability Derivation ────────────────────────────────────────────────

/**
 * Derive game `LeaderVulnerabilities` from model's vulnerability data.
 *
 * Maps:
 * - health → healthRisk
 * - scandals count + internalOpposition → personalScandal + coupRisk
 * - succession → successionClarity (inverted)
 * - externalPressure → influences coupRisk
 */
export function deriveVulnerabilities(model: ExtendedLeaderProfile): LeaderVulnerabilities {
  const v = model.vulnerabilities;
  const health = v?.health ?? 30;
  const internalOpposition = v?.internalOpposition ?? 30;
  const externalPressure = v?.externalPressure ?? 30;
  const scandalCount = v?.scandals?.length ?? 0;
  const succession = model.powerBase.succession ?? 'contested';

  // Map succession clarity
  const successionMap: Record<string, number> = {
    'clear': 80,
    'hereditary': 70,
    'appointed': 60,
    'contested': 30,
    'undefined': 10,
  };

  return {
    healthRisk: clamp(health),
    successionClarity: clamp(successionMap[succession] ?? 30),
    coupRisk: clamp(Math.round((internalOpposition * 0.4 + externalPressure * 0.2 + (100 - (successionMap[succession] ?? 30)) * 0.2))),
    personalScandal: clamp(Math.round(Math.min(100, scandalCount * 20 + internalOpposition * 0.3))),
  };
}

// ── Motivations Derivation ──────────────────────────────────────────────────

/**
 * Derive game `LeaderMotivations` from model's motivation structure.
 *
 * The model uses enum values; the game uses free-form strings for
 * primaryGoal, ideologicalCore, redLines, and legacyAmbition.
 */
export function deriveMotivations(model: ExtendedLeaderProfile): LeaderMotivations {
  const primary = model.motivations.primary ?? 'power';
  const fear = model.motivations.fear ?? 'overthrow';

  // Map primary motivation to a goal statement
  const goalMap: Record<string, string> = {
    'power': 'Power Consolidation & Regional Dominance',
    'legacy': 'Historical Legacy & National Transformation',
    'ideology': 'Ideological Purity & Revolutionary Export',
    'security': 'Regime Survival & National Security',
    'prosperity': 'Economic Growth & National Prosperity',
    'revenge': 'Retribution & Historical Grievance',
    'reform': 'Modernization & Institutional Reform',
  };

  // Map primary to ideological core
  const ideologyMap: Record<string, string> = {
    'power': 'Authoritarian Statecraft',
    'legacy': 'National Rejuvenation',
    'ideology': 'Revolutionary Doctrine',
    'security': 'Defensive Realism',
    'prosperity': 'Economic Pragmatism',
    'revenge': 'Revanchist Nationalism',
    'reform': 'Progressive Modernization',
  };

  // Map fear to red lines
  const fearRedLines: Record<string, string[]> = {
    'overthrow': ['Regime change operations', 'Support for internal opposition'],
    'irrelevance': ['Diplomatic isolation', 'Exclusion from major forums'],
    'humiliation': ['Public diplomatic humiliation', 'Military defeat'],
    'war': ['Military escalation near borders', 'Nuclear threats'],
    'economic-collapse': ['Severe sanctions', 'Trade embargo'],
    'betrayal': ['Alliance defection', 'Intelligence compromise'],
  };

  // Map fear to legacy ambition
  const legacyMap: Record<string, string> = {
    'overthrow': 'The leader who made the regime unassailable',
    'irrelevance': 'A statesman of enduring global influence',
    'humiliation': 'A leader who restored national honour',
    'war': 'The architect of lasting peace',
    'economic-collapse': 'The builder of national prosperity',
    'betrayal': 'A leader of unwavering loyalty and strength',
  };

  return {
    primaryGoal: goalMap[primary] ?? goalMap['power']!,
    ideologicalCore: ideologyMap[primary] ?? ideologyMap['power']!,
    redLines: fearRedLines[fear] ?? fearRedLines['overthrow']!,
    legacyAmbition: legacyMap[fear] ?? legacyMap['overthrow']!,
  };
}

// ── Full Profile Mapping ────────────────────────────────────────────────────

/**
 * Generate a unique LeaderId from a model's leaderId string.
 */
export function toLeaderId(modelLeaderId: string): LeaderId {
  return `leader-${modelLeaderId}` as LeaderId;
}

/**
 * Map an `ExtendedLeaderProfile` (JSON model) to a game `LeaderProfile`.
 *
 * This produces a complete `LeaderProfile` that can be placed into
 * `scenario.aiProfiles[factionId].leader`.
 */
export function mapModelToLeaderProfile(
  model: ExtendedLeaderProfile,
  factionId: FactionId,
): LeaderProfile {
  const psychology: LeaderPsychology = {
    decisionStyle: mapDecisionStyle(model.psychology.decisionStyle),
    stressResponse: mapStressResponse(model.psychology.stressResponse),
    riskTolerance: clamp(model.psychology.riskTolerance),
    paranoia: clamp(model.psychology.paranoia),
    narcissism: clamp(model.psychology.narcissism),
    pragmatism: clamp(model.psychology.pragmatism),
    patience: clamp(model.psychology.patience),
    vengefulIndex: clamp(model.psychology.vengefulIndex),
  };

  const identity: LeaderIdentity = {
    name: model.name,
    title: model.title ?? 'Head of State',
    nation: factionId,
    age: 0, // Not available in model JSON; will be blended from scenario
    ideology: deriveIdeologyLabel(model),
  };

  return {
    id: toLeaderId(model.leaderId),
    identity,
    psychology,
    motivations: deriveMotivations(model),
    powerBase: derivePowerBase(model),
    vulnerabilities: deriveVulnerabilities(model),
    historicalAnalog: '', // Not available in model JSON; scenario retains its own
  };
}

/**
 * Derive a short ideology label from model data.
 */
function deriveIdeologyLabel(model: ExtendedLeaderProfile): string {
  const primary = model.motivations.primary ?? 'power';
  const tags = model.tags ?? [];

  if (tags.includes('democratic')) return 'Democratic Governance';
  if (tags.includes('authoritarian') && tags.includes('revisionist')) return 'Authoritarian Revisionism';
  if (tags.includes('authoritarian')) return 'Authoritarian Statecraft';
  if (tags.includes('theocratic') || tags.includes('Hezbollah-dominated')) return 'Theocratic Governance';

  const ideologyLabels: Record<string, string> = {
    'ideology': 'Ideological Fundamentalism',
    'power': 'Realist Power Politics',
    'legacy': 'National Rejuvenation',
    'security': 'Security-First Governance',
    'prosperity': 'Economic Modernization',
    'reform': 'Progressive Reform',
    'revenge': 'Revanchist Nationalism',
  };

  return ideologyLabels[primary] ?? 'Pragmatic Governance';
}

/**
 * Generate a default emotional state for a new leader.
 */
export function generateDefaultEmotionalState(
  leaderId: LeaderId,
  model: ExtendedLeaderProfile,
): EmotionalStateSnapshot {
  const paranoia = model.psychology.paranoia;
  const riskTolerance = model.psychology.riskTolerance;

  return {
    leaderId,
    turn: 0 as EmotionalStateSnapshot['turn'],
    stress: clamp(Math.round(paranoia * 0.5)),
    confidence: clamp(Math.round(100 - paranoia * 0.3 + riskTolerance * 0.2)),
    anger: clamp(Math.round(model.psychology.vengefulIndex * 0.4)),
    fear: clamp(Math.round(paranoia * 0.4)),
    resolve: clamp(Math.round(model.psychology.patience * 0.5 + model.psychology.pragmatism * 0.3)),
    decisionFatigue: 0,
    stressInoculated: false,
  };
}

/**
 * Generate default bias assignments for a new leader based on psychology.
 */
export function generateDefaultBiases(
  model: ExtendedLeaderProfile,
): LeaderBiasAssignment[] {
  const biases: LeaderBiasAssignment[] = [];

  // High paranoia → confirmation bias
  if (model.psychology.paranoia > 60) {
    biases.push({
      biasType: 'ConfirmationBias' as LeaderBiasAssignment['biasType'],
      intensity: clamp(Math.round(model.psychology.paranoia * 0.8)),
      trigger: 'Intelligence filtered through existing threat perceptions',
    });
  }

  // High narcissism → escalation of commitment
  if (model.psychology.narcissism > 60) {
    biases.push({
      biasType: 'EscalationOfCommitment' as LeaderBiasAssignment['biasType'],
      intensity: clamp(Math.round(model.psychology.narcissism * 0.7)),
      trigger: 'Public commitment to a course of action',
    });
  }

  // Low pragmatism (high ideological rigidity) → sunk cost
  if (model.psychology.pragmatism < 40) {
    biases.push({
      biasType: 'SunkCost' as LeaderBiasAssignment['biasType'],
      intensity: clamp(Math.round((100 - model.psychology.pragmatism) * 0.7)),
      trigger: 'Prior investments in a failing strategy',
    });
  }

  // High risk tolerance → optimism bias
  if (model.psychology.riskTolerance > 65) {
    biases.push({
      biasType: 'Optimism' as LeaderBiasAssignment['biasType'],
      intensity: clamp(Math.round(model.psychology.riskTolerance * 0.6)),
      trigger: 'Underestimating adversary capabilities',
    });
  }

  // Low risk tolerance → loss aversion
  if (model.psychology.riskTolerance < 35) {
    biases.push({
      biasType: 'LossAversion' as LeaderBiasAssignment['biasType'],
      intensity: clamp(Math.round((100 - model.psychology.riskTolerance) * 0.7)),
      trigger: 'Potential loss of territory or status',
    });
  }

  return biases;
}

/**
 * Build a complete `AIProfileConfig` from a model for a new leader persona.
 */
export function buildAIProfileFromModel(
  model: ExtendedLeaderProfile,
  factionId: FactionId,
): AIProfileConfig {
  const leader = mapModelToLeaderProfile(model, factionId);

  return {
    factionId,
    leader,
    initialEmotionalState: generateDefaultEmotionalState(leader.id, model),
    biasAssignments: generateDefaultBiases(model),
  };
}

// ── Leader Data Point Builder ───────────────────────────────────────────────

/**
 * Convert an `ExtendedLeaderProfile` into a `LeaderDataPoint` for
 * the live data pipeline.
 *
 * @param model          - The extended leader profile from models/leaders/.
 * @param factionId      - The resolved game faction ID.
 * @param scenarioLeaderName - The current leader name in the scenario for comparison.
 */
export function buildLeaderDataPoint(
  model: ExtendedLeaderProfile,
  factionId: FactionId,
  scenarioLeaderName: string,
): LeaderDataPoint {
  const isNewLeader = model.name.toLowerCase() !== scenarioLeaderName.toLowerCase();

  return {
    factionId,
    leaderId: model.leaderId,
    name: model.name,
    title: model.title ?? 'Head of State',
    isNewLeader,
    psychology: {
      decisionStyle: model.psychology.decisionStyle,
      stressResponse: model.psychology.stressResponse,
      riskTolerance: model.psychology.riskTolerance,
      paranoia: model.psychology.paranoia,
      narcissism: model.psychology.narcissism,
      pragmatism: model.psychology.pragmatism,
      patience: model.psychology.patience,
      vengefulIndex: model.psychology.vengefulIndex,
    },
    powerBase: {
      source: model.powerBase.source ?? 'party',
      consolidation: model.powerBase.consolidation ?? 50,
      legitimacy: model.powerBase.legitimacy ?? 50,
    },
    vulnerabilities: {
      health: model.vulnerabilities?.health ?? 30,
      internalOpposition: model.vulnerabilities?.internalOpposition ?? 30,
      externalPressure: model.vulnerabilities?.externalPressure ?? 30,
    },
    mbtiType: model.mbtiType,
    biography: model.biography ?? null,
    tags: model.tags ?? [],
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a value to 0–100. */
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
