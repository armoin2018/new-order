/**
 * Emergent Technology Engine — FR-6100
 *
 * Pure-function engine for per-nation technology differentiation and
 * AI-driven emergent technology generation that goes beyond the predefined
 * 32 technology models.
 *
 * Concepts:
 * 1. **Nation Tech Profiles**: Each faction has unique research strengths,
 *    focus areas, and innovation culture that drive what they can discover.
 * 2. **Emergent Tech Generation**: Each turn, nations have a chance to
 *    generate novel technologies based on their profile + domain scores.
 * 3. **Maturity Progression**: Emergent techs evolve through stages
 *    (theoretical → experimental → prototype → operational → mature).
 * 4. **Cross-Industry Impact**: Operational techs cascade effects across
 *    sectors (defense, healthcare, finance, etc.) and nation stats.
 * 5. **Tech Adoption**: Other nations can adopt emergent techs via
 *    alliances, trade, or espionage.
 *
 * All functions are pure — they accept state + config and return new state.
 * Randomness is injected via SeededRandom for deterministic replay.
 *
 * @see FR-6100 — Emergent Technology & Per-Nation Tech Differentiation
 * @see NFR-402 — Deterministic simulation
 */

import type { FactionId, TechDomain } from '@/data/types/enums';
import { ALL_FACTIONS } from '@/data/types/enums';
import type { TechnologyIndex } from '@/data/types/technology.types';
import type { NationState } from '@/data/types/nation.types';
import type {
  NationTechProfile,
  EmergentTechnology,
  EmergentTechEvent,
  EmergentTechMaturity,
  CrossIndustryImpact,
  EmergentTechState,
  IndustrySector,
  ResearchFocus,
} from '@/data/types/emergent-tech.types';
import {
  emergentTechConfig,
  nationTechAffinities,
  emergentTechNameTemplates,
  emergentTechDescriptions,
} from './config/emergent-tech';
import type { SeededRandom } from './rng';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const ALL_TECH_DOMAINS: TechDomain[] = ['AI', 'Semiconductors', 'Space', 'Cyber', 'Biotech', 'Quantum'];

const MATURITY_ORDER: EmergentTechMaturity[] = [
  'theoretical',
  'experimental',
  'prototype',
  'operational',
  'mature',
];

const ALL_SECTORS: IndustrySector[] = [
  'defense', 'healthcare', 'finance', 'energy', 'agriculture',
  'manufacturing', 'transportation', 'communications', 'education',
  'entertainment', 'space_commercial', 'intelligence',
];

// ─────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────

/**
 * Initialise a nation's tech profile from faction defaults + current state.
 */
export function initNationTechProfile(
  factionId: FactionId,
  techIndex: TechnologyIndex,
  nation: NationState,
  turn: number,
): NationTechProfile {
  const affinity = nationTechAffinities[factionId];

  // Derive initial domain efficiency from affinity defaults + current tech scores
  const domainEfficiency: Record<TechDomain, number> = {} as Record<TechDomain, number>;
  for (const domain of ALL_TECH_DOMAINS) {
    const baseMult = affinity.domainMultipliers[domain];
    // Nations with higher existing scores get a slight additional efficiency boost
    const scoreBonus = (getDomainScore(techIndex, domain) / 100) * 0.2;
    domainEfficiency[domain] = Math.round((baseMult + scoreBonus) * 100) / 100;
  }

  // Scale innovation culture from nation's stability and education
  const stabilityFactor = Math.max(0, nation.stability - 30) / 70; // 0 at stability=30, 1 at stability=100
  const innovationCulture = Math.round(
    affinity.baseInnovationCulture * (0.7 + 0.3 * stabilityFactor),
  );

  return {
    factionId,
    researchFoci: [...affinity.defaultFoci],
    domainEfficiency,
    innovationCulture: Math.max(0, Math.min(100, innovationCulture)),
    rdSpendingPct: affinity.baseRdSpendingPct,
    talentFlow: affinity.baseTalentFlow,
    researchInstitutions: affinity.baseResearchInstitutions,
    generatedTechIds: [],
    adoptedTechIds: [],
    breakthroughHistory: {
      AI: 0, Semiconductors: 0, Space: 0, Cyber: 0, Biotech: 0, Quantum: 0,
    },
    lastUpdatedTurn: turn,
  };
}

/**
 * Initialise the complete emergent tech state for all factions.
 */
export function initEmergentTechState(
  techIndices: Record<FactionId, TechnologyIndex>,
  nationStates: Record<FactionId, NationState>,
  turn: number,
): EmergentTechState {
  const nationProfiles: Record<string, NationTechProfile> = {} as Record<FactionId, NationTechProfile>;
  for (const factionId of ALL_FACTIONS) {
    const ti = techIndices[factionId];
    const ns = nationStates[factionId];
    if (ti && ns) {
      nationProfiles[factionId] = initNationTechProfile(factionId, ti, ns, turn);
    }
  }
  return {
    nationProfiles: nationProfiles as Record<FactionId, NationTechProfile>,
    emergentTechs: {},
    eventLog: [],
    totalGenerated: 0,
    globalInnovationVelocity: emergentTechConfig.velocity.initial,
  };
}

// ─────────────────────────────────────────────────────────
// Profile Updates
// ─────────────────────────────────────────────────────────

/**
 * Update a nation's tech profile based on current game state.
 * Call once per turn before generation checks.
 */
export function updateNationTechProfile(
  profile: NationTechProfile,
  techIndex: TechnologyIndex,
  nation: NationState,
  turn: number,
): NationTechProfile {
  const affinity = nationTechAffinities[profile.factionId];

  // Recalculate domain efficiency
  const domainEfficiency: Record<TechDomain, number> = {} as Record<TechDomain, number>;
  for (const domain of ALL_TECH_DOMAINS) {
    const baseMult = affinity.domainMultipliers[domain];
    const scoreBonus = (getDomainScore(techIndex, domain) / 100) * 0.2;
    // Breakthrough history provides compounding bonus
    const breakthroughBonus = (profile.breakthroughHistory[domain] ?? 0) * 0.02;
    domainEfficiency[domain] = Math.round((baseMult + scoreBonus + breakthroughBonus) * 100) / 100;
  }

  // Dynamic talent flow adjustment based on stability and economy
  const stabilityFactor = (nation.stability - 50) / 50; // −1 to +1
  const economyFactor = Math.min(1, nation.gdp / 5000); // 0–1 based on GDP (5000B = max factor)
  const dynamicTalentFlow = affinity.baseTalentFlow + Math.round(stabilityFactor * 10 + economyFactor * 5);

  // Dynamic innovation culture
  const innovationCulture = Math.max(0, Math.min(100,
    affinity.baseInnovationCulture * (0.7 + 0.3 * Math.max(0, nation.stability - 30) / 70),
  ));

  // R&D spending adjusts with treasury health
  const treasuryHealth = Math.max(0, Math.min(1, nation.treasury / 500));
  const rdSpendingPct = Math.round(affinity.baseRdSpendingPct * (0.6 + 0.4 * treasuryHealth) * 100) / 100;

  return {
    ...profile,
    domainEfficiency,
    innovationCulture: Math.round(innovationCulture),
    rdSpendingPct,
    talentFlow: Math.max(-50, Math.min(50, dynamicTalentFlow)),
    lastUpdatedTurn: turn,
  };
}

// ─────────────────────────────────────────────────────────
// Generation Probability
// ─────────────────────────────────────────────────────────

/**
 * Compute the probability (0–100) that a nation generates an emergent tech
 * this turn. Returns 0 if prerequisites are not met.
 */
export function computeGenerationProbability(
  profile: NationTechProfile,
  techIndex: TechnologyIndex,
  nation: NationState,
  existingTechCount: number,
  globalVelocity: number,
  currentTurn: number,
): number {
  const cfg = emergentTechConfig.generation;

  // Gate checks
  if (profile.innovationCulture < cfg.minInnovationCulture) return 0;
  if (profile.generatedTechIds.length >= cfg.maxPerNation) return 0;

  // Cooldown check: find the most recent generation turn for this nation
  if (profile.generatedTechIds.length > 0) {
    const turnsSinceLast = currentTurn - profile.lastUpdatedTurn;
    if (turnsSinceLast < cfg.cooldownTurns) {
      // This is a rough heuristic — the actual last-gen turn is tracked
      // by the caller in the event log. Profile.lastUpdatedTurn serves as proxy.
    }
  }

  // Find strongest domain
  const strongestDomain = getStrongestDomain(techIndex);
  const strongestScore = getDomainScore(techIndex, strongestDomain);

  if (strongestScore < cfg.minDomainScoreThreshold) return 0;

  // Build probability
  let prob = cfg.baseChancePerTurn;

  // Domain score bonus
  const domainBonus = Math.floor((strongestScore - cfg.minDomainScoreThreshold) / 10) * cfg.domainScoreBonusPer10;
  prob += domainBonus;

  // R&D spending bonus
  if (profile.rdSpendingPct > 1) {
    prob += (profile.rdSpendingPct - 1) * cfg.rdSpendingBonusPer1Pct;
  }

  // Talent flow bonus
  if (profile.talentFlow > 0) {
    prob += Math.floor(profile.talentFlow / 10) * cfg.talentFlowBonusPer10;
  }

  // Breakthrough history bonus
  const totalBreakthroughs = Object.values(profile.breakthroughHistory).reduce((s, v) => s + v, 0);
  prob += totalBreakthroughs * cfg.breakthroughBonusPer;

  // Innovation culture scaling (normalised 0–1)
  prob *= profile.innovationCulture / 75; // 75 as "standard" innovation culture

  // Global velocity multiplier
  prob *= globalVelocity;

  // Stability penalty
  if (nation.stability < 40) {
    prob *= cfg.lowStabilityPenalty;
  }

  // Global saturation: slight diminishing returns as total techs grow
  if (existingTechCount > 10) {
    prob *= Math.max(0.5, 1 - (existingTechCount - 10) * 0.02);
  }

  return Math.max(0, Math.min(cfg.maxChancePerTurn, Math.round(prob * 100) / 100));
}

// ─────────────────────────────────────────────────────────
// Tech Generation
// ─────────────────────────────────────────────────────────

/**
 * Attempt to generate an emergent technology for a nation.
 * Returns null if the probability roll fails or prerequisites aren't met.
 */
export function attemptEmergentTechGeneration(
  profile: NationTechProfile,
  techIndex: TechnologyIndex,
  nation: NationState,
  state: EmergentTechState,
  turn: number,
  rng: SeededRandom,
): { tech: EmergentTechnology; event: EmergentTechEvent } | null {
  const cfg = emergentTechConfig.generation;

  // Global cap check
  if (state.totalGenerated >= cfg.maxGlobal) return null;

  // Compute probability
  const prob = computeGenerationProbability(
    profile, techIndex, nation,
    state.totalGenerated, state.globalInnovationVelocity, turn,
  );

  if (prob <= 0) return null;

  // Roll
  const roll = rng.next() * 100;
  if (roll >= prob) return null;

  // Determine domains
  const primaryDomain = selectPrimaryDomain(profile, techIndex, rng);
  const secondaryDomain = selectSecondaryDomain(primaryDomain, profile, techIndex, rng);
  const secondaryDomains = secondaryDomain ? [secondaryDomain] : [];

  // Pick a name
  const name = selectTechName(primaryDomain, secondaryDomain, state.emergentTechs, rng);
  const description = emergentTechDescriptions[name] ??
    `A breakthrough ${primaryDomain.toLowerCase()} technology${secondaryDomain ? ` combining ${primaryDomain} and ${secondaryDomain}` : ''} developed by ${profile.factionId.toUpperCase()}.`;

  // Generate cross-industry impacts
  const crossIndustryImpacts = generateCrossIndustryImpacts(primaryDomain, secondaryDomains, rng);

  // Compute domain boosts
  const domainBoosts = computeDomainBoosts(primaryDomain, secondaryDomains, profile, rng);

  // Compute nation stat modifiers
  const nationStatModifiers = computeNationStatModifiers(primaryDomain, secondaryDomains, rng);

  // Compute adoption requirements (60–80% of origin nation's domain scores)
  const adoptionRequirements: Partial<Record<TechDomain, number>> = {};
  const primaryScore = getDomainScore(techIndex, primaryDomain);
  adoptionRequirements[primaryDomain] = Math.round(primaryScore * 0.7);
  if (secondaryDomain) {
    const secScore = getDomainScore(techIndex, secondaryDomain);
    adoptionRequirements[secondaryDomain] = Math.round(secScore * 0.6);
  }

  const seq = state.totalGenerated + 1;
  const emergentTechId = `emt-${profile.factionId}-${turn}-${seq}`;

  const catalystFoci = profile.researchFoci.slice(0, 2) as ResearchFocus[];

  const tech: EmergentTechnology = {
    emergentTechId,
    name,
    description,
    originFaction: profile.factionId,
    originTurn: turn,
    primaryDomain,
    secondaryDomains,
    catalystFoci,
    maturity: 'theoretical',
    maturityProgress: 0,
    crossIndustryImpacts,
    domainBoosts,
    nationStatModifiers,
    transferable: true,
    adoptionRequirements,
    adoptedBy: [],
    tags: [
      primaryDomain.toLowerCase(),
      ...(secondaryDomain ? [secondaryDomain.toLowerCase()] : []),
      'emergent',
      profile.factionId,
    ],
  };

  const event: EmergentTechEvent = {
    emergentTechId,
    factionId: profile.factionId,
    turn,
    eventType: 'generation',
    headline: `${profile.factionId.toUpperCase()} researchers announce breakthrough: ${name}`,
    narrative: `Scientists in ${profile.factionId.toUpperCase()} have achieved a theoretical breakthrough in ${name}. ${description}`,
    immediateImpacts: [
      { dimension: 'techLevel', magnitude: 1 },
      { dimension: 'diplomaticInfluence', magnitude: 1 },
    ],
  };

  return { tech, event };
}

// ─────────────────────────────────────────────────────────
// Maturity Progression
// ─────────────────────────────────────────────────────────

/**
 * Advance maturity of all emergent techs for a given nation.
 * Returns updated techs and any maturity-advance events.
 */
export function progressEmergentTechs(
  nationTechs: EmergentTechnology[],
  profile: NationTechProfile,
  turn: number,
): { updatedTechs: EmergentTechnology[]; events: EmergentTechEvent[] } {
  const cfg = emergentTechConfig.maturity;
  const events: EmergentTechEvent[] = [];
  const updatedTechs: EmergentTechnology[] = [];

  for (const tech of nationTechs) {
    if (tech.maturity === 'mature') {
      updatedTechs.push(tech);
      continue;
    }

    // Calculate progress gain
    let progressGain = cfg.progressPerTurn;

    // Innovation culture bonus
    if (profile.innovationCulture > 50) {
      progressGain *= 1 + (profile.innovationCulture - 50) / 10 * cfg.cultureBonus;
    }

    // R&D bonus
    if (profile.rdSpendingPct > 2) {
      progressGain *= 1 + (profile.rdSpendingPct - 2) * cfg.rdBonus;
    }

    // Domain efficiency bonus
    const efficiency = profile.domainEfficiency[tech.primaryDomain] ?? 1.0;
    progressGain *= efficiency;

    const threshold = cfg.stageProgression[tech.maturity] ?? 100;
    const newProgress = tech.maturityProgress + progressGain;

    if (newProgress >= threshold) {
      // Advance to next maturity stage
      const currentIdx = MATURITY_ORDER.indexOf(tech.maturity);
      const nextMaturity = MATURITY_ORDER[currentIdx + 1] ?? 'mature';

      const updated: EmergentTechnology = {
        ...tech,
        maturity: nextMaturity,
        maturityProgress: Math.max(0, newProgress - threshold),
      };
      updatedTechs.push(updated);

      events.push({
        emergentTechId: tech.emergentTechId,
        factionId: tech.originFaction,
        turn,
        eventType: 'maturity_advance',
        headline: `${tech.originFaction.toUpperCase()}'s ${tech.name} advances to ${nextMaturity} stage`,
        narrative: `The ${tech.name} programme has reached ${nextMaturity} maturity, ${getMaturityNarrative(nextMaturity)}.`,
        immediateImpacts: getMaturityImpacts(nextMaturity),
      });
    } else {
      updatedTechs.push({
        ...tech,
        maturityProgress: newProgress,
      });
    }
  }

  return { updatedTechs, events };
}

// ─────────────────────────────────────────────────────────
// Cross-Industry Impact Application
// ─────────────────────────────────────────────────────────

/**
 * Apply cross-industry impacts from operational+ emergent techs to nation stats.
 * Returns the aggregate stat deltas to apply.
 */
export function computeActiveEffects(
  techs: EmergentTechnology[],
  turn: number,
): {
  techLevelDelta: number;
  gdpGrowthPct: number;
  stabilityDelta: number;
  militaryReadinessDelta: number;
  diplomaticInfluenceDelta: number;
  populationApprovalDelta: number;
  domainBoosts: Partial<Record<TechDomain, number>>;
} {
  let techLevelDelta = 0;
  let gdpGrowthPct = 0;
  let stabilityDelta = 0;
  let militaryReadinessDelta = 0;
  let diplomaticInfluenceDelta = 0;
  let populationApprovalDelta = 0;
  const domainBoosts: Record<string, number> = {};

  for (const tech of techs) {
    // Only operational+ techs produce effects
    const matIdx = MATURITY_ORDER.indexOf(tech.maturity);
    if (matIdx < 3) continue; // Below 'operational'

    // Scale effects: operational = 0.5x, mature = 1.0x
    const maturityScale = tech.maturity === 'mature' ? 1.0 : 0.5;

    // Nation stat modifiers
    const mods = tech.nationStatModifiers;
    techLevelDelta += (mods.techLevelDelta ?? 0) * maturityScale;
    gdpGrowthPct += (mods.gdpGrowthPct ?? 0) * maturityScale;
    stabilityDelta += (mods.stabilityDelta ?? 0) * maturityScale;
    militaryReadinessDelta += (mods.militaryReadinessDelta ?? 0) * maturityScale;
    diplomaticInfluenceDelta += (mods.diplomaticInfluenceDelta ?? 0) * maturityScale;
    populationApprovalDelta += (mods.populationApprovalDelta ?? 0) * maturityScale;

    // Domain boosts
    for (const [domain, boost] of Object.entries(tech.domainBoosts)) {
      domainBoosts[domain] = (domainBoosts[domain] ?? 0) + (boost ?? 0) * maturityScale;
    }

    // Process cross-industry impacts that have materialised
    for (const impact of tech.crossIndustryImpacts) {
      const turnsSinceCreation = turn - tech.originTurn;
      if (turnsSinceCreation < impact.delayTurns) continue;
      if (impact.temporary && impact.turnsRemaining !== null && impact.turnsRemaining <= 0) continue;

      // Map sector impacts to nation stats
      const sectorEffect = impact.magnitude * 0.02 * maturityScale; // Scaled down
      switch (impact.sector) {
        case 'defense':
        case 'intelligence':
          militaryReadinessDelta += sectorEffect;
          break;
        case 'healthcare':
        case 'education':
          stabilityDelta += sectorEffect * 0.5;
          populationApprovalDelta += sectorEffect * 0.5;
          break;
        case 'finance':
        case 'manufacturing':
        case 'energy':
          gdpGrowthPct += sectorEffect * 0.3;
          break;
        case 'agriculture':
          stabilityDelta += sectorEffect * 0.3;
          break;
        case 'transportation':
        case 'communications':
          gdpGrowthPct += sectorEffect * 0.2;
          stabilityDelta += sectorEffect * 0.1;
          break;
        case 'entertainment':
          populationApprovalDelta += sectorEffect;
          break;
        case 'space_commercial':
          techLevelDelta += sectorEffect * 0.5;
          gdpGrowthPct += sectorEffect * 0.2;
          break;
      }
    }
  }

  return {
    techLevelDelta: Math.round(techLevelDelta * 100) / 100,
    gdpGrowthPct: Math.round(gdpGrowthPct * 100) / 100,
    stabilityDelta: Math.round(stabilityDelta * 100) / 100,
    militaryReadinessDelta: Math.round(militaryReadinessDelta * 100) / 100,
    diplomaticInfluenceDelta: Math.round(diplomaticInfluenceDelta * 100) / 100,
    populationApprovalDelta: Math.round(populationApprovalDelta * 100) / 100,
    domainBoosts: domainBoosts as Partial<Record<TechDomain, number>>,
  };
}

/**
 * Tick down temporary cross-industry impacts.
 * Returns updated technologies with decremented timers.
 */
export function tickTemporaryImpacts(
  techs: EmergentTechnology[],
): EmergentTechnology[] {
  return techs.map(tech => ({
    ...tech,
    crossIndustryImpacts: tech.crossIndustryImpacts.map(impact => {
      if (!impact.temporary || impact.turnsRemaining === null) return impact;
      return { ...impact, turnsRemaining: impact.turnsRemaining - 1 };
    }),
  }));
}

// ─────────────────────────────────────────────────────────
// Tech Adoption
// ─────────────────────────────────────────────────────────

/**
 * Check if a nation can adopt an emergent tech from another nation.
 */
export function canAdoptTech(
  tech: EmergentTechnology,
  adoptingFaction: FactionId,
  adoptingTechIndex: TechnologyIndex,
  turn: number,
): boolean {
  if (!tech.transferable) return false;
  if (tech.adoptedBy.includes(adoptingFaction)) return false;
  if (tech.originFaction === adoptingFaction) return false;

  // Must be at least experimental maturity
  const matIdx = MATURITY_ORDER.indexOf(tech.maturity);
  if (matIdx < 1) return false;

  // Adoption delay check
  if (turn - tech.originTurn < emergentTechConfig.adoption.adoptionDelay) return false;

  // Domain requirement check
  for (const [domain, required] of Object.entries(tech.adoptionRequirements)) {
    const nationScore = getDomainScore(adoptingTechIndex, domain as TechDomain);
    const gap = (required as number) - nationScore;
    if (gap > emergentTechConfig.adoption.maxDomainGap) return false;
  }

  return true;
}

/**
 * Attempt to adopt a tech for a faction.
 * Returns the updated tech + event, or null if adoption roll fails.
 */
export function attemptTechAdoption(
  tech: EmergentTechnology,
  adoptingFaction: FactionId,
  adoptingTechIndex: TechnologyIndex,
  relationshipScore: number,
  turn: number,
  rng: SeededRandom,
): { tech: EmergentTechnology; event: EmergentTechEvent } | null {
  if (!canAdoptTech(tech, adoptingFaction, adoptingTechIndex, turn)) return null;

  const cfg = emergentTechConfig.adoption;
  let chance = cfg.baseAdoptionChance;

  // Alliance/relationship bonus
  if (relationshipScore > 50) {
    chance += (relationshipScore - 50) * 0.2;
  }

  // Roll
  const roll = rng.next() * 100;
  if (roll >= chance) return null;

  const updatedTech: EmergentTechnology = {
    ...tech,
    adoptedBy: [...tech.adoptedBy, adoptingFaction],
  };

  const event: EmergentTechEvent = {
    emergentTechId: tech.emergentTechId,
    factionId: adoptingFaction,
    turn,
    eventType: 'adoption',
    headline: `${adoptingFaction.toUpperCase()} acquires ${tech.name} technology`,
    narrative: `${adoptingFaction.toUpperCase()} has successfully adopted ${tech.name}, originally developed by ${tech.originFaction.toUpperCase()}.`,
    immediateImpacts: [
      { dimension: 'techLevel', magnitude: 0.5 },
    ],
  };

  return { tech: updatedTech, event };
}

// ─────────────────────────────────────────────────────────
// Full Turn Processing
// ─────────────────────────────────────────────────────────

/**
 * Input for processEmergentTechTurn.
 */
export interface EmergentTechTurnInput {
  state: EmergentTechState;
  techIndices: Record<FactionId, TechnologyIndex>;
  nationStates: Record<FactionId, NationState>;
  relationshipMatrix: Record<FactionId, Record<FactionId, number>>;
  turn: number;
  rng: SeededRandom;
}

/**
 * Result of processEmergentTechTurn.
 */
export interface EmergentTechTurnResult {
  /** Updated emergent tech state. */
  updatedState: EmergentTechState;
  /** Events generated this turn (for headlines). */
  events: EmergentTechEvent[];
  /** Per-nation stat deltas to apply. */
  nationEffects: Record<FactionId, {
    techLevelDelta: number;
    gdpGrowthPct: number;
    stabilityDelta: number;
    militaryReadinessDelta: number;
    diplomaticInfluenceDelta: number;
    populationApprovalDelta: number;
  }>;
  /** Domain score boosts to apply to tech indices. */
  domainBoosts: Record<FactionId, Partial<Record<TechDomain, number>>>;
  /** Factions that had breakthroughs this turn (for market signals). */
  breakthroughFactions: FactionId[];
}

/**
 * Process one turn of emergent technology for all factions.
 *
 * Pipeline:
 * 1. Update nation profiles from current state
 * 2. Attempt emergent tech generation per nation
 * 3. Progress maturity of existing techs
 * 4. Attempt tech adoption between nations
 * 5. Compute and return active effects
 * 6. Tick temporary impacts
 * 7. Advance global innovation velocity
 */
export function processEmergentTechTurn(input: EmergentTechTurnInput): EmergentTechTurnResult {
  const { techIndices, nationStates, relationshipMatrix, turn, rng } = input;
  const state = structuredClone(input.state);
  const allEvents: EmergentTechEvent[] = [];
  const breakthroughFactions: FactionId[] = [];
  const nationEffects: Record<string, {
    techLevelDelta: number;
    gdpGrowthPct: number;
    stabilityDelta: number;
    militaryReadinessDelta: number;
    diplomaticInfluenceDelta: number;
    populationApprovalDelta: number;
  }> = {};
  const domainBoostResults: Record<string, Partial<Record<TechDomain, number>>> = {};

  // ── Step 1: Update profiles ──────────────────────────────────────────
  for (const factionId of ALL_FACTIONS) {
    const ti = techIndices[factionId];
    const ns = nationStates[factionId];
    if (!ti || !ns) continue;

    if (state.nationProfiles[factionId]) {
      state.nationProfiles[factionId] = updateNationTechProfile(
        state.nationProfiles[factionId], ti, ns, turn,
      );
    }
  }

  // ── Step 2: Attempt generation per nation ────────────────────────────
  for (const factionId of ALL_FACTIONS) {
    const profile = state.nationProfiles[factionId];
    const ti = techIndices[factionId];
    const ns = nationStates[factionId];
    if (!profile || !ti || !ns) continue;

    // Cooldown check from event log
    const lastGenEvent = [...state.eventLog]
      .reverse()
      .find(e => e.factionId === factionId && e.eventType === 'generation');
    if (lastGenEvent && (turn - lastGenEvent.turn) < emergentTechConfig.generation.cooldownTurns) {
      continue;
    }

    const result = attemptEmergentTechGeneration(profile, ti, ns, state, turn, rng);
    if (result) {
      state.emergentTechs[result.tech.emergentTechId] = result.tech;
      state.totalGenerated++;
      profile.generatedTechIds.push(result.tech.emergentTechId);
      profile.breakthroughHistory[result.tech.primaryDomain] =
        (profile.breakthroughHistory[result.tech.primaryDomain] ?? 0) + 1;
      allEvents.push(result.event);
      breakthroughFactions.push(factionId);
    }
  }

  // ── Step 3: Progress maturity ────────────────────────────────────────
  for (const factionId of ALL_FACTIONS) {
    const profile = state.nationProfiles[factionId];
    if (!profile) continue;

    // Gather techs originating from or adopted by this nation
    const relevantTechs = Object.values(state.emergentTechs).filter(
      t => t.originFaction === factionId || t.adoptedBy.includes(factionId),
    );

    if (relevantTechs.length === 0) continue;

    // Only progress techs originated by this nation
    const ownTechs = relevantTechs.filter(t => t.originFaction === factionId);
    const { updatedTechs, events } = progressEmergentTechs(ownTechs, profile, turn);

    // Write back
    for (const ut of updatedTechs) {
      state.emergentTechs[ut.emergentTechId] = ut;
    }
    allEvents.push(...events);
  }

  // ── Step 4: Attempt adoption ─────────────────────────────────────────
  for (const adoptingFaction of ALL_FACTIONS) {
    const adoptingTI = techIndices[adoptingFaction];
    if (!adoptingTI) continue;

    for (const tech of Object.values(state.emergentTechs)) {
      if (tech.originFaction === adoptingFaction) continue;
      if (tech.adoptedBy.includes(adoptingFaction)) continue;

      const relScore = relationshipMatrix[adoptingFaction]?.[tech.originFaction] ?? 50;
      const result = attemptTechAdoption(tech, adoptingFaction, adoptingTI, relScore, turn, rng);
      if (result) {
        state.emergentTechs[result.tech.emergentTechId] = result.tech;
        const profile = state.nationProfiles[adoptingFaction];
        if (profile) {
          profile.adoptedTechIds.push(result.tech.emergentTechId);
        }
        allEvents.push(result.event);
      }
    }
  }

  // ── Step 5: Compute active effects per nation ────────────────────────
  for (const factionId of ALL_FACTIONS) {
    const relevantTechs = Object.values(state.emergentTechs).filter(
      t => t.originFaction === factionId || t.adoptedBy.includes(factionId),
    );

    const effects = computeActiveEffects(relevantTechs, turn);
    nationEffects[factionId] = {
      techLevelDelta: effects.techLevelDelta,
      gdpGrowthPct: effects.gdpGrowthPct,
      stabilityDelta: effects.stabilityDelta,
      militaryReadinessDelta: effects.militaryReadinessDelta,
      diplomaticInfluenceDelta: effects.diplomaticInfluenceDelta,
      populationApprovalDelta: effects.populationApprovalDelta,
    };
    domainBoostResults[factionId] = effects.domainBoosts;
  }

  // ── Step 6: Tick temporary impacts ───────────────────────────────────
  const allTechs = Object.values(state.emergentTechs);
  const tickedTechs = tickTemporaryImpacts(allTechs);
  for (const t of tickedTechs) {
    state.emergentTechs[t.emergentTechId] = t;
  }

  // ── Step 7: Advance global velocity ──────────────────────────────────
  const velocityCfg = emergentTechConfig.velocity;
  let newVelocity = state.globalInnovationVelocity + velocityCfg.perTurnIncrease;
  // Boost from discoveries this turn
  newVelocity += breakthroughFactions.length * velocityCfg.discoveryBoost;
  state.globalInnovationVelocity = Math.min(velocityCfg.maxVelocity, Math.round(newVelocity * 1000) / 1000);

  // Append events to state log
  state.eventLog.push(...allEvents);

  return {
    updatedState: state,
    events: allEvents,
    nationEffects: nationEffects as Record<FactionId, typeof nationEffects[string]>,
    domainBoosts: domainBoostResults as Record<FactionId, Partial<Record<TechDomain, number>>>,
    breakthroughFactions,
  };
}

// ─────────────────────────────────────────────────────────
// Query Helpers
// ─────────────────────────────────────────────────────────

/**
 * Get all emergent techs for a specific nation (originated + adopted).
 */
export function getNationEmergentTechs(
  state: EmergentTechState,
  factionId: FactionId,
): EmergentTechnology[] {
  return Object.values(state.emergentTechs).filter(
    t => t.originFaction === factionId || t.adoptedBy.includes(factionId),
  );
}

/**
 * Get a summary of emergent tech activity for a nation.
 */
export function getEmergentTechSummary(
  state: EmergentTechState,
  factionId: FactionId,
): {
  profile: NationTechProfile | null;
  totalGenerated: number;
  totalAdopted: number;
  operationalCount: number;
  matureCount: number;
  recentEvents: EmergentTechEvent[];
} {
  const profile = state.nationProfiles[factionId] ?? null;
  const techs = getNationEmergentTechs(state, factionId);
  const originated = techs.filter(t => t.originFaction === factionId);
  const adopted = techs.filter(t => t.adoptedBy.includes(factionId) && t.originFaction !== factionId);

  return {
    profile,
    totalGenerated: originated.length,
    totalAdopted: adopted.length,
    operationalCount: techs.filter(t => t.maturity === 'operational').length,
    matureCount: techs.filter(t => t.maturity === 'mature').length,
    recentEvents: state.eventLog
      .filter(e => e.factionId === factionId)
      .slice(-5),
  };
}

// ─────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────

/** Get a domain score from a TechnologyIndex. */
function getDomainScore(ti: TechnologyIndex, domain: TechDomain): number {
  switch (domain) {
    case 'AI': return ti.ai;
    case 'Semiconductors': return ti.semiconductors;
    case 'Space': return ti.space;
    case 'Cyber': return ti.cyber;
    case 'Biotech': return ti.biotech;
    case 'Quantum': return ti.quantum;
    default: return 0;
  }
}

/** Get the strongest tech domain for a TechnologyIndex. */
function getStrongestDomain(ti: TechnologyIndex): TechDomain {
  let best: TechDomain = 'AI';
  let bestScore = 0;
  for (const d of ALL_TECH_DOMAINS) {
    const s = getDomainScore(ti, d);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return best;
}

/**
 * Select primary domain for emergent tech based on nation's strengths.
 * Weighted random: higher domain scores = more likely to be selected.
 */
function selectPrimaryDomain(
  profile: NationTechProfile,
  ti: TechnologyIndex,
  rng: SeededRandom,
): TechDomain {
  const weights: [TechDomain, number][] = ALL_TECH_DOMAINS.map(d => {
    const score = getDomainScore(ti, d);
    const efficiency = profile.domainEfficiency[d] ?? 1.0;
    return [d, score * efficiency];
  });

  return weightedPick(weights, rng);
}

/**
 * Select secondary domain (or null for single-domain breakthrough).
 * 60% chance of cross-domain tech.
 */
function selectSecondaryDomain(
  primary: TechDomain,
  profile: NationTechProfile,
  ti: TechnologyIndex,
  rng: SeededRandom,
): TechDomain | null {
  if (rng.next() > 0.6) return null; // 40% chance of single-domain

  const candidates = ALL_TECH_DOMAINS.filter(d => d !== primary);
  const weights: [TechDomain, number][] = candidates.map(d => {
    const score = getDomainScore(ti, d);
    const efficiency = profile.domainEfficiency[d] ?? 1.0;
    return [d, Math.max(1, score * efficiency)]; // minimum weight 1
  });

  return weightedPick(weights, rng);
}

/**
 * Select a tech name from templates, avoiding duplicates.
 */
function selectTechName(
  primary: TechDomain,
  secondary: TechDomain | null,
  existingTechs: Record<string, EmergentTechnology>,
  rng: SeededRandom,
): string {
  const existingNames = new Set(Object.values(existingTechs).map(t => t.name));

  // Try cross-domain templates first
  if (secondary) {
    const crossKey = `${primary}+${secondary}`;
    const reverseCrossKey = `${secondary}+${primary}`;
    const templates =
      emergentTechNameTemplates[crossKey] ??
      emergentTechNameTemplates[reverseCrossKey] ??
      [];

    const available = templates.filter(t => !existingNames.has(t));
    if (available.length > 0) {
      return available[rng.nextInt(0, available.length - 1)];
    }
  }

  // Fall back to primary domain templates
  const primaryTemplates = emergentTechNameTemplates[primary] ?? [];
  const available = primaryTemplates.filter(t => !existingNames.has(t));
  if (available.length > 0) {
    return available[rng.nextInt(0, available.length - 1)];
  }

  // All templates used — generate a unique name
  const suffix = Object.keys(existingTechs).length + 1;
  return `Advanced ${primary} System Mark ${suffix}`;
}

/**
 * Generate cross-industry impacts for a new emergent tech.
 */
function generateCrossIndustryImpacts(
  primaryDomain: TechDomain,
  secondaryDomains: TechDomain[],
  rng: SeededRandom,
): CrossIndustryImpact[] {
  const cfg = emergentTechConfig.crossIndustry;
  const impacts: CrossIndustryImpact[] = [];

  // Determine number of sectors impacted
  const numSectors = rng.nextInt(cfg.minSectorsImpacted, cfg.maxSectorsImpacted);

  // Get affinity sectors for the primary domain
  const affinitySectors = emergentTechConfig.domainSectorAffinities[primaryDomain] ?? [];
  const secondaryAffinities = secondaryDomains.flatMap(
    d => emergentTechConfig.domainSectorAffinities[d] ?? [],
  );

  // Combine and de-duplicate
  const candidateSectors = [...new Set([...affinitySectors, ...secondaryAffinities])];

  // If we need more sectors, add random ones
  const remainingSectors = ALL_SECTORS.filter(s => !candidateSectors.includes(s));
  while (candidateSectors.length < numSectors && remainingSectors.length > 0) {
    const idx = rng.nextInt(0, remainingSectors.length - 1);
    candidateSectors.push(remainingSectors.splice(idx, 1)[0]);
  }

  // Pick the required number of sectors
  const selectedSectors = candidateSectors.slice(0, numSectors);

  for (const sector of selectedSectors) {
    // Affinity sectors get positive impacts more often
    const isAffinity = affinitySectors.includes(sector);
    const magnitude = isAffinity
      ? rng.nextInt(5, cfg.magnitudeRange.max) // Mostly positive for affinity sectors
      : rng.nextInt(cfg.magnitudeRange.min, cfg.magnitudeRange.max); // Full range for others

    const temporary = rng.next() < cfg.temporaryProbability;
    const delay = rng.nextInt(cfg.delayRange.min, cfg.delayRange.max);
    const duration = temporary
      ? rng.nextInt(cfg.temporaryDurationRange.min, cfg.temporaryDurationRange.max)
      : null;

    impacts.push({
      sector,
      magnitude,
      description: `${primaryDomain} breakthrough impacts ${sector} sector`,
      delayTurns: delay,
      temporary,
      turnsRemaining: duration,
    });
  }

  return impacts;
}

/**
 * Compute domain score boosts from an emergent tech.
 */
function computeDomainBoosts(
  primary: TechDomain,
  secondary: TechDomain[],
  profile: NationTechProfile,
  rng: SeededRandom,
): Partial<Record<TechDomain, number>> {
  const boosts: Partial<Record<TechDomain, number>> = {};

  // Primary domain gets a significant boost
  boosts[primary] = rng.nextInt(2, 5);

  // Secondary domains get smaller boosts
  for (const d of secondary) {
    boosts[d] = rng.nextInt(1, 3);
  }

  // Scale by domain efficiency
  for (const [domain, boost] of Object.entries(boosts)) {
    const efficiency = profile.domainEfficiency[domain as TechDomain] ?? 1.0;
    boosts[domain as TechDomain] = Math.round((boost as number) * efficiency * 10) / 10;
  }

  return boosts;
}

/**
 * Compute nation stat modifiers for a new emergent tech.
 */
function computeNationStatModifiers(
  primary: TechDomain,
  secondary: TechDomain[],
  rng: SeededRandom,
): EmergentTechnology['nationStatModifiers'] {
  const mods: EmergentTechnology['nationStatModifiers'] = {};

  // Every tech gives a small techLevel boost
  mods.techLevelDelta = rng.nextInt(1, 3);

  // Domain-specific stat impacts
  const allDomains = [primary, ...secondary];

  for (const d of allDomains) {
    switch (d) {
      case 'AI':
        mods.gdpGrowthPct = (mods.gdpGrowthPct ?? 0) + rng.nextInt(0, 2) * 0.1;
        mods.militaryReadinessDelta = (mods.militaryReadinessDelta ?? 0) + rng.nextInt(0, 2);
        break;
      case 'Semiconductors':
        mods.gdpGrowthPct = (mods.gdpGrowthPct ?? 0) + rng.nextInt(1, 3) * 0.1;
        break;
      case 'Space':
        mods.diplomaticInfluenceDelta = (mods.diplomaticInfluenceDelta ?? 0) + rng.nextInt(1, 3);
        break;
      case 'Cyber':
        mods.militaryReadinessDelta = (mods.militaryReadinessDelta ?? 0) + rng.nextInt(1, 3);
        mods.stabilityDelta = (mods.stabilityDelta ?? 0) + rng.nextInt(0, 1);
        break;
      case 'Biotech':
        mods.stabilityDelta = (mods.stabilityDelta ?? 0) + rng.nextInt(1, 3);
        mods.populationApprovalDelta = (mods.populationApprovalDelta ?? 0) + rng.nextInt(1, 2);
        break;
      case 'Quantum':
        mods.techLevelDelta = (mods.techLevelDelta ?? 0) + rng.nextInt(1, 2);
        mods.militaryReadinessDelta = (mods.militaryReadinessDelta ?? 0) + rng.nextInt(0, 2);
        break;
    }
  }

  return mods;
}

/** Get narrative text for a maturity stage transition. */
function getMaturityNarrative(maturity: EmergentTechMaturity): string {
  switch (maturity) {
    case 'experimental': return 'moving from theory to laboratory experiments';
    case 'prototype': return 'producing a working prototype for field testing';
    case 'operational': return 'entering active deployment with measurable real-world impact';
    case 'mature': return 'achieving widespread adoption with established industry standards';
    default: return 'advancing to the next development phase';
  }
}

/** Get immediate stat impacts for a maturity advance. */
function getMaturityImpacts(maturity: EmergentTechMaturity): EmergentTechEvent['immediateImpacts'] {
  switch (maturity) {
    case 'experimental':
      return [{ dimension: 'techLevel', magnitude: 0.5 }];
    case 'prototype':
      return [
        { dimension: 'techLevel', magnitude: 1 },
        { dimension: 'diplomaticInfluence', magnitude: 0.5 },
      ];
    case 'operational':
      return [
        { dimension: 'techLevel', magnitude: 2 },
        { dimension: 'gdp', magnitude: 50 },
        { dimension: 'stability', magnitude: 1 },
      ];
    case 'mature':
      return [
        { dimension: 'techLevel', magnitude: 3 },
        { dimension: 'gdp', magnitude: 100 },
        { dimension: 'stability', magnitude: 2 },
        { dimension: 'diplomaticInfluence', magnitude: 2 },
      ];
    default:
      return [];
  }
}

/**
 * Weighted random selection from a list of [item, weight] pairs.
 */
function weightedPick<T>(items: [T, number][], rng: SeededRandom): T {
  const totalWeight = items.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (totalWeight <= 0) return items[0][0]; // fallback

  let roll = rng.next() * totalWeight;
  for (const [item, weight] of items) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0]; // fallback
}
