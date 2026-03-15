/**
 * CNFL-3901 — Autonomous AI Decision-Making for All Factions
 *
 * Makes decisions for all (or selected) factions during autonomous
 * scenario execution, using either rule-based AI (UtilityEvaluator)
 * or a configurable decision strategy.
 *
 * Decisions are weighted by each leader's psychological profile.
 */

import type { GameState, FactionId } from '@/data/types';
import { ALL_FACTIONS } from '@/data/types';
import { actionSlateConfig } from '../config/action-slate';
import { UtilityEvaluator } from '../ai-evaluator';
import { SeededRandom } from '../rng';
import type {
  AIAction,
  AIActionCategory,
  AIEvaluationContext,
  AIEvaluationResult,
  UtilityWeights,
} from '../ai-evaluator';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AIStrategy = 'rule-based' | 'random' | 'passive';

export interface AutonomousPlayerConfig {
  /** Strategy for decision-making. Default: 'rule-based'. */
  strategy?: AIStrategy;
  /** Factions controlled by AI. Default: all factions. */
  aiFactions?: FactionId[];
  /** Factions controlled manually (excluded from AI). */
  manualFactions?: FactionId[];
  /** Difficulty scaling 0-2 (0.5=easy, 1=normal, 1.5=hard, 2=brutal). */
  difficulty?: number;
  /** Enable debug logging. */
  debug?: boolean;
  /** Custom RNG for deterministic decisions. */
  rng?: () => number;
}

export interface FactionDecision {
  factionId: FactionId;
  /** @deprecated Use {@link selectedActions} instead. Retained for backward compat — always equals `selectedActions[0] ?? null`. */
  selectedAction: AIAction | null;
  /** Up to {@link actionSlateConfig.ai.maxActionsPerAINation} top-ranked actions for this turn. */
  selectedActions: AIAction[];
  evaluation: AIEvaluationResult | null;
  reasoning: string;
}

export interface TurnDecisions {
  turn: number;
  decisions: FactionDecision[];
  timestamp: number;
}

// ─── Default action catalog ─────────────────────────────────────────────────

const ACTION_CATEGORIES: AIActionCategory[] = [
  'diplomatic', 'military', 'economic', 'intelligence', 'domestic',
];

function generateCandidateActions(
  factionId: FactionId,
  state: GameState,
): AIAction[] {
  const ns = state.nationStates[factionId];
  if (!ns) return [];

  const actions: AIAction[] = [];
  let idx = 0;

  // Diplomatic actions
  for (const target of ALL_FACTIONS) {
    if (target === factionId) continue;
    const tension = state.relationshipMatrix[factionId]?.[target] ?? 50;

    actions.push({
      id: `${factionId}-diplo-improve-${target}-${idx++}`,
      category: 'diplomatic',
      name: `Improve relations with ${target}`,
      description: 'Diplomatic outreach to reduce tensions',
      baseUtility: tension > 60 ? 70 : 40,
      categoryWeights: { diplomatic: 1.2 },
      isExtreme: false,
      riskLevel: 10,
      estimatedImpact: { diplomaticInfluence: 3, stability: 1 },
      targetFaction: target,
    });

    if (tension > 70) {
      actions.push({
        id: `${factionId}-diplo-summit-${target}-${idx++}`,
        category: 'diplomatic',
        name: `Call summit with ${target}`,
        description: 'High-level diplomatic summit to de-escalate',
        baseUtility: 65,
        categoryWeights: { diplomatic: 1.5 },
        isExtreme: false,
        riskLevel: 15,
        estimatedImpact: { diplomaticInfluence: 5, stability: 2 },
        targetFaction: target,
      });
    }
  }

  // Military actions
  actions.push({
    id: `${factionId}-mil-readiness-${idx++}`,
    category: 'military',
    name: 'Increase military readiness',
    description: 'Boost military preparedness',
    baseUtility: (ns as unknown as Record<string, unknown>).militaryReadiness as number < 50 ? 60 : 35,
    categoryWeights: { military: 1.3 },
    isExtreme: false,
    riskLevel: 20,
    estimatedImpact: { militaryReadiness: 5, treasury: -3 },
  });

  actions.push({
    id: `${factionId}-mil-deploy-${idx++}`,
    category: 'military',
    name: 'Deploy forces forward',
    description: 'Forward deployment of military units',
    baseUtility: 45,
    categoryWeights: { military: 1.4 },
    isExtreme: false,
    riskLevel: 40,
    estimatedImpact: { militaryReadiness: 3, stability: -1, treasury: -5 },
  });

  // Economic actions
  actions.push({
    id: `${factionId}-econ-stimulus-${idx++}`,
    category: 'economic',
    name: 'Economic stimulus',
    description: 'Invest in economic growth',
    baseUtility: (ns as unknown as Record<string, unknown>).gdp as number < 15000 ? 70 : 45,
    categoryWeights: { economic: 1.3 },
    isExtreme: false,
    riskLevel: 15,
    estimatedImpact: { treasury: -10, stability: 3 },
  });

  actions.push({
    id: `${factionId}-econ-austerity-${idx++}`,
    category: 'economic',
    name: 'Austerity measures',
    description: 'Cut spending to save treasury',
    baseUtility: (ns as unknown as Record<string, unknown>).treasury as number < 100 ? 65 : 30,
    categoryWeights: { economic: 1.1 },
    isExtreme: false,
    riskLevel: 25,
    estimatedImpact: { treasury: 15, stability: -3, popularity: -5 },
  });

  // Intelligence actions
  actions.push({
    id: `${factionId}-intel-recon-${idx++}`,
    category: 'intelligence',
    name: 'Reconnaissance operations',
    description: 'Gather intelligence on adversaries',
    baseUtility: 50,
    categoryWeights: { intelligence: 1.2 },
    isExtreme: false,
    riskLevel: 20,
    estimatedImpact: { treasury: -2 },
  });

  actions.push({
    id: `${factionId}-intel-cyber-${idx++}`,
    category: 'intelligence',
    name: 'Cyber operations',
    description: 'Launch cyber intelligence gathering',
    baseUtility: 55,
    categoryWeights: { intelligence: 1.3 },
    isExtreme: false,
    riskLevel: 35,
    estimatedImpact: { treasury: -5 },
  });

  // Domestic actions
  actions.push({
    id: `${factionId}-dom-stability-${idx++}`,
    category: 'domestic',
    name: 'Stabilization campaign',
    description: 'Domestic stability measures',
    baseUtility: (ns as unknown as Record<string, unknown>).stability as number < 40 ? 80 : 35,
    categoryWeights: { domestic: 1.4 },
    isExtreme: false,
    riskLevel: 10,
    estimatedImpact: { stability: 5, popularity: 2, treasury: -5 },
  });

  actions.push({
    id: `${factionId}-dom-propaganda-${idx++}`,
    category: 'domestic',
    name: 'Propaganda campaign',
    description: 'Media campaign to boost popularity',
    baseUtility: 40,
    categoryWeights: { domestic: 1.1 },
    isExtreme: false,
    riskLevel: 15,
    estimatedImpact: { popularity: 5, treasury: -3 },
  });

  // Extreme actions (only when unstable)
  if ((ns as unknown as Record<string, unknown>).stability as number < 25) {
    actions.push({
      id: `${factionId}-extreme-crackdown-${idx++}`,
      category: 'domestic',
      name: 'Emergency crackdown',
      description: 'Martial law to restore order',
      baseUtility: 75,
      categoryWeights: { domestic: 2.0 },
      isExtreme: true,
      extremeThreshold: 25,
      riskLevel: 60,
      estimatedImpact: { stability: 10, popularity: -15, diplomaticInfluence: -5 },
    });
  }

  // ── FR-7000: Macroeconomic actions ──────────────────────────────────────

  // Tariff adjustment actions
  actions.push({
    id: `${factionId}-econ-raise-tariffs-${idx++}`,
    category: 'economic',
    name: 'Raise import tariffs',
    description: 'Increase tariffs on imports to protect domestic industry',
    baseUtility: (ns as unknown as Record<string, unknown>).inflation as number < 10 ? 50 : 25,
    categoryWeights: { economic: 1.2 },
    isExtreme: false,
    riskLevel: 30,
    estimatedImpact: { treasury: 5, stability: -1 },
  });

  actions.push({
    id: `${factionId}-econ-lower-tariffs-${idx++}`,
    category: 'economic',
    name: 'Lower import tariffs',
    description: 'Reduce tariffs to lower consumer prices and boost trade',
    baseUtility: (ns as unknown as Record<string, unknown>).inflation as number > 15 ? 65 : 35,
    categoryWeights: { economic: 1.1, diplomatic: 0.8 },
    isExtreme: false,
    riskLevel: 15,
    estimatedImpact: { stability: 2, diplomaticInfluence: 2 },
  });

  // Debt management actions
  actions.push({
    id: `${factionId}-econ-debt-repayment-${idx++}`,
    category: 'economic',
    name: 'Accelerate debt repayment',
    description: 'Allocate treasury funds toward reducing national debt',
    baseUtility: 40,
    categoryWeights: { economic: 1.3 },
    isExtreme: false,
    riskLevel: 10,
    estimatedImpact: { treasury: -20, stability: 2 },
  });

  // Trade route protection
  actions.push({
    id: `${factionId}-econ-protect-shipping-${idx++}`,
    category: 'economic',
    name: 'Protect shipping lanes',
    description: 'Deploy naval assets to secure trade routes',
    baseUtility: 45,
    categoryWeights: { economic: 0.8, military: 0.6 },
    isExtreme: false,
    riskLevel: 20,
    estimatedImpact: { treasury: -5, militaryReadiness: -2 },
  });

  // Disaster response
  actions.push({
    id: `${factionId}-dom-disaster-response-${idx++}`,
    category: 'domestic',
    name: 'Activate disaster response',
    description: 'Deploy emergency resources to mitigate natural disaster damage',
    baseUtility: 30, // boosted dynamically when disasters are active
    categoryWeights: { domestic: 1.5 },
    isExtreme: false,
    riskLevel: 5,
    estimatedImpact: { treasury: -15, stability: 5, popularity: 3 },
  });

  // Commodity stockpiling
  actions.push({
    id: `${factionId}-econ-stockpile-${idx++}`,
    category: 'economic',
    name: 'Build strategic commodity reserves',
    description: 'Purchase commodities for strategic reserves to buffer price shocks',
    baseUtility: 35,
    categoryWeights: { economic: 1.0 },
    isExtreme: false,
    riskLevel: 10,
    estimatedImpact: { treasury: -10, stability: 1 },
  });

  // Consumer stimulus
  actions.push({
    id: `${factionId}-econ-consumer-stimulus-${idx++}`,
    category: 'economic',
    name: 'Consumer confidence program',
    description: 'Subsidies and tax breaks to boost consumer spending',
    baseUtility: (ns as unknown as Record<string, unknown>).popularity as number < 40 ? 60 : 35,
    categoryWeights: { economic: 1.1, domestic: 0.7 },
    isExtreme: false,
    riskLevel: 15,
    estimatedImpact: { treasury: -8, popularity: 4, stability: 2 },
  });

  // Export promotion
  actions.push({
    id: `${factionId}-econ-export-promotion-${idx++}`,
    category: 'economic',
    name: 'Export promotion campaign',
    description: 'Subsidize exports to improve trade balance',
    baseUtility: 40,
    categoryWeights: { economic: 1.2 },
    isExtreme: false,
    riskLevel: 10,
    estimatedImpact: { treasury: -5, diplomaticInfluence: 1 },
  });

  return actions;
}

// ─── Profile to weights conversion ──────────────────────────────────────────

function profileToWeights(
  state: GameState,
  factionId: FactionId,
): UtilityWeights {
  // Try to extract from leader profiles
  const leaderEntry = Object.entries(state.leaderProfiles ?? {}).find(
    ([, profile]) => (profile as unknown as Record<string, unknown>).faction === factionId,
  );

  if (leaderEntry) {
    const profile = leaderEntry[1] as unknown as Record<string, unknown>;
    const psych = (profile.psychology ?? profile) as Record<string, number>;
    return {
      aggression: psych.riskTolerance ?? psych.aggression ?? 50,
      economicFocus: psych.pragmatism ?? 50,
      diplomaticPreference: psych.empathy ?? psych.charisma ?? 50,
      riskTolerance: psych.riskTolerance ?? 50,
      domesticPriority: psych.paranoia ?? 50,
    };
  }

  // Default balanced weights
  return {
    aggression: 50,
    economicFocus: 50,
    diplomaticPreference: 50,
    riskTolerance: 50,
    domesticPriority: 50,
  };
}

// ─── Autonomous Player ──────────────────────────────────────────────────────

export class AutonomousPlayer {
  private config: Required<Omit<AutonomousPlayerConfig, 'rng'>> & { rng: () => number };

  constructor(config: AutonomousPlayerConfig = {}) {
    this.config = {
      strategy: config.strategy ?? 'rule-based',
      aiFactions: config.aiFactions ?? [...ALL_FACTIONS],
      manualFactions: config.manualFactions ?? [],
      difficulty: config.difficulty ?? 1,
      debug: config.debug ?? false,
      rng: config.rng ?? Math.random,
    };
  }

  /**
   * Get the set of factions this AI controls.
   */
  getControlledFactions(): FactionId[] {
    return this.config.aiFactions.filter(
      (f) => !this.config.manualFactions.includes(f),
    );
  }

  /**
   * Make decisions for all controlled factions for a single turn.
   */
  decideTurn(state: GameState, turn: number): TurnDecisions {
    const factions = this.getControlledFactions();
    const decisions: FactionDecision[] = [];

    for (const factionId of factions) {
      decisions.push(this.decideFaction(state, factionId, turn));
    }

    return {
      turn,
      decisions,
      timestamp: Date.now(),
    };
  }

  /**
   * Make a decision for a single faction.
   */
  decideFaction(state: GameState, factionId: FactionId, _turn: number): FactionDecision {
    const ns = state.nationStates[factionId];
    if (!ns) {
      return {
        factionId,
        selectedAction: null,
        selectedActions: [],
        evaluation: null,
        reasoning: 'No nation state found for faction',
      };
    }

    switch (this.config.strategy) {
      case 'rule-based':
        return this.decideRuleBased(state, factionId);
      case 'random':
        return this.decideRandom(state, factionId);
      case 'passive':
        return {
          factionId,
          selectedAction: null,
          selectedActions: [],
          evaluation: null,
          reasoning: 'Passive strategy — no action taken',
        };
      default:
        return this.decideRuleBased(state, factionId);
    }
  }

  private decideRuleBased(state: GameState, factionId: FactionId): FactionDecision {
    const candidateActions = generateCandidateActions(factionId, state);
    if (candidateActions.length === 0) {
      return {
        factionId,
        selectedAction: null,
        selectedActions: [],
        evaluation: null,
        reasoning: 'No candidate actions available',
      };
    }

    const weights = profileToWeights(state, factionId);
    const ns = state.nationStates[factionId]!;
    const leaderProfile = this.findLeaderProfile(state, factionId);
    const emotionalState = this.findEmotionalState(state, factionId);

    // Map numeric difficulty to evaluator difficulty level
    const diffLevel: 'cautious' | 'balanced' | 'aggressive' =
      this.config.difficulty < 0.8 ? 'cautious'
        : this.config.difficulty > 1.3 ? 'aggressive'
        : 'balanced';

    // Build tensions from relationship matrix
    const tensions: Record<string, number> = {};
    const relRow = state.relationshipMatrix[factionId];
    if (relRow) {
      for (const [target, value] of Object.entries(relRow)) {
        tensions[target] = value as number;
      }
    }

    const context: AIEvaluationContext = {
      factionId,
      nationState: ns,
      leaderProfile: leaderProfile as unknown as AIEvaluationContext['leaderProfile'],
      emotionalState: emotionalState as unknown as AIEvaluationContext['emotionalState'],
      weights,
      difficulty: diffLevel,
      rng: new SeededRandom(Math.floor(this.config.rng() * 0x7FFFFFFF)),
      tensions: tensions as AIEvaluationContext['tensions'],
      candidateActions,
      debug: this.config.debug,
    };

    const result = UtilityEvaluator.evaluate(context);

    // FR-5001: Select up to maxActionsPerAINation top-ranked actions
    const maxActions = actionSlateConfig.ai.maxActionsPerAINation;
    const topActions = result.rankedActions
      .slice(0, maxActions)
      .filter((sa) => sa.finalScore > 0)
      .map((sa) => sa.action);

    const reasoning = topActions.length > 0
      ? `Selected ${topActions.length} actions: ${topActions.map((a, i) => `${i + 1}. ${a.name} (${result.rankedActions[i]?.finalScore?.toFixed(1) ?? '?'})`).join('; ')}`
      : 'No viable action found';

    return {
      factionId,
      selectedAction: topActions[0] ?? result.selectedAction,
      selectedActions: topActions,
      evaluation: result,
      reasoning,
    };
  }

  private decideRandom(state: GameState, factionId: FactionId): FactionDecision {
    const actions = generateCandidateActions(factionId, state);
    if (actions.length === 0) {
      return { factionId, selectedAction: null, selectedActions: [], evaluation: null, reasoning: 'No actions' };
    }
    // FR-5001: Pick up to maxActionsPerAINation random unique actions
    const maxActions = actionSlateConfig.ai.maxActionsPerAINation;
    const shuffled = [...actions].sort(() => this.config.rng() - 0.5);
    const picked = shuffled.slice(0, Math.min(maxActions, shuffled.length));
    return {
      factionId,
      selectedAction: picked[0] ?? null,
      selectedActions: picked,
      evaluation: null,
      reasoning: `Random selection: ${picked.map((a) => a.name).join(', ')}`,
    };
  }

  private findLeaderProfile(state: GameState, factionId: FactionId): Record<string, unknown> {
    for (const [, profile] of Object.entries(state.leaderProfiles ?? {})) {
      const p = profile as unknown as Record<string, unknown>;
      // LeaderProfile stores faction under identity.nation
      const identity = p.identity as Record<string, unknown> | undefined;
      if (identity?.nation === factionId) return p;
      // Fallback: check legacy .faction field
      if (p.faction === factionId) return p;
    }
    // Return a safe default with all fields the evaluator accesses
    return {
      id: `default-${factionId}`,
      identity: { name: 'Unknown Leader', title: 'Leader', nation: factionId, age: 50, ideology: 'Pragmatist' },
      psychology: {
        decisionStyle: 'analytical' as const,
        stressResponse: 'calculating' as const,
        riskTolerance: 50,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 60,
        patience: 50,
        vengefulIndex: 30,
      },
      motivations: { primaryGoal: 'Stability', ideologicalCore: 'Pragmatism', redLines: [], legacyAmbition: 'Stability' },
      powerBase: {},
      vulnerabilities: {},
      historicalAnalog: 'Generic Leader',
    };
  }

  private findEmotionalState(state: GameState, factionId: FactionId): Record<string, unknown> {
    // First find the leader for this faction
    const leaderProfile = this.findLeaderProfile(state, factionId);
    const leaderId = leaderProfile.id as string | undefined;

    for (const [key, emo] of Object.entries(state.emotionalStates ?? {})) {
      const e = emo as unknown as Record<string, unknown>;
      // Match by leaderId or by key matching the leader's id
      if (e.leaderId === leaderId || key === leaderId) return e;
      // Fallback: check legacy .faction field
      if (e.faction === factionId) return e;
    }
    // Return a safe default with all fields the evaluator accesses
    return {
      leaderId: leaderId ?? `default-${factionId}`,
      turn: 0,
      stress: 20,
      confidence: 50,
      anger: 10,
      fear: 15,
      resolve: 50,
      decisionFatigue: 10,
      stressInoculated: false,
    };
  }
}

export { generateCandidateActions, profileToWeights, ACTION_CATEGORIES };
