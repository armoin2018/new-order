/**
 * New Order: AI Faction Profiles & Standard Action Catalog
 *
 * Implements CNFL-0403 — Pre-computed AI profiles for the 4 Phase 1 factions
 * (Trump, Xi, Takaichi, Iran Successor) plus placeholder profiles for Phase 2
 * factions. Also provides the standard catalog of ~22 candidate actions that
 * every AI evaluates each turn.
 *
 * @see CNFL-0403 — 4-Faction AI Profiles
 * @see FR-301 — Utility Score evaluation
 * @see FR-302 — Scenario-tunable personality weights
 *
 * @module engine/ai-profiles
 */

import type {
  AIAction,
  AIEvaluationContext,
  AIEvaluationResult,
  UtilityWeights,
} from '@/engine/ai-evaluator';

import { UtilityEvaluator } from '@/engine/ai-evaluator';

import type {
  FactionId,
  DecisionStyle,
  StressResponse,
} from '@/data/types';

import {
  FactionId as FactionIdEnum,
  DecisionStyle as DecisionStyleEnum,
  StressResponse as StressResponseEnum,
} from '@/data/types';

// ─────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────

/** Difficulty level for AI. */
export type AIDifficulty = 'cautious' | 'balanced' | 'aggressive';

/** Complete AI configuration for one faction. */
export interface AIFactionConfig {
  factionId: FactionId;
  /** Display name for debug. */
  leaderName: string;
  /** Pre-derived utility weights. */
  weights: UtilityWeights;
  /** Decision style from leader psychology. */
  decisionStyle: DecisionStyle;
  /** Stress response from leader psychology. */
  stressResponse: StressResponse;
  /** Key behavioral notes for debug. */
  behaviorNotes: string[];
}

// ─────────────────────────────────────────────────────────
// 2. Standard Action Catalog
// ─────────────────────────────────────────────────────────

/**
 * The universe of standard candidate actions every AI can evaluate each turn.
 *
 * 22 actions across 7 categories: diplomatic (4), military (4), economic (4),
 * intelligence (3), domestic (3), nuclear (2), grey-zone (2).
 *
 * @see FR-301
 */
export const STANDARD_AI_ACTIONS: readonly AIAction[] = [
  // ── Diplomatic (4) ─────────────────────────────────────

  {
    id: 'propose_trade_deal',
    category: 'diplomatic',
    name: 'Propose Trade Deal',
    description: 'Offer a bilateral trade agreement to improve economic relations.',
    baseUtility: 50,
    riskLevel: 10,
    isExtreme: false,
    categoryWeights: { diplomatic: 80, economic: 40 },
    estimatedImpact: { diplomaticInfluence: 5, treasury: 10 },
  },
  {
    id: 'impose_sanctions',
    category: 'diplomatic',
    name: 'Impose Sanctions',
    description: 'Place economic sanctions on a target nation.',
    baseUtility: 40,
    riskLevel: 30,
    isExtreme: false,
    categoryWeights: { diplomatic: 60, economic: 50 },
    estimatedImpact: { diplomaticInfluence: -5, treasury: -5 },
  },
  {
    id: 'diplomatic_summit',
    category: 'diplomatic',
    name: 'Diplomatic Summit',
    description: 'Host a high-level diplomatic summit to de-escalate tensions.',
    baseUtility: 45,
    riskLevel: 5,
    isExtreme: false,
    categoryWeights: { diplomatic: 90, domestic: 20 },
    estimatedImpact: { diplomaticInfluence: 10, stability: 3 },
  },
  {
    id: 'withdraw_ambassador',
    category: 'diplomatic',
    name: 'Withdraw Ambassador',
    description: 'Recall ambassador as a diplomatic protest signal.',
    baseUtility: 30,
    riskLevel: 20,
    isExtreme: false,
    categoryWeights: { diplomatic: 70 },
    estimatedImpact: { diplomaticInfluence: -8, allianceCredibility: -5 },
  },

  // ── Military (4) ───────────────────────────────────────

  {
    id: 'military_deployment',
    category: 'military',
    name: 'Military Deployment',
    description: 'Deploy military forces to a strategic region.',
    baseUtility: 35,
    riskLevel: 50,
    isExtreme: false,
    categoryWeights: { military: 80 },
    estimatedImpact: { militaryReadiness: -5, stability: -3 },
  },
  {
    id: 'naval_patrol',
    category: 'military',
    name: 'Naval Patrol',
    description: 'Increase naval presence in contested waters.',
    baseUtility: 40,
    riskLevel: 25,
    isExtreme: false,
    categoryWeights: { military: 70, 'grey-zone': 30 },
    estimatedImpact: { militaryReadiness: -2 },
  },
  {
    id: 'air_defense_upgrade',
    category: 'military',
    name: 'Air Defense Upgrade',
    description: 'Invest in air defense infrastructure and systems.',
    baseUtility: 45,
    riskLevel: 10,
    isExtreme: false,
    categoryWeights: { military: 60, domestic: 30 },
    estimatedImpact: { militaryReadiness: 5, treasury: -15 },
  },
  {
    id: 'launch_strike',
    category: 'military',
    name: 'Launch Strike',
    description: 'Execute a conventional military strike against a target.',
    baseUtility: 60,
    riskLevel: 80,
    isExtreme: true,
    extremeThreshold: 40,
    categoryWeights: { military: 90, nuclear: 20 },
    estimatedImpact: { stability: -10, militaryReadiness: -10, diplomaticInfluence: -15 },
  },

  // ── Economic (4) ───────────────────────────────────────

  {
    id: 'tariff_increase',
    category: 'economic',
    name: 'Tariff Increase',
    description: 'Raise tariffs on imports from target nations.',
    baseUtility: 45,
    riskLevel: 20,
    isExtreme: false,
    categoryWeights: { economic: 80, diplomatic: 20 },
    estimatedImpact: { treasury: 8, diplomaticInfluence: -5 },
  },
  {
    id: 'trade_embargo',
    category: 'economic',
    name: 'Trade Embargo',
    description: 'Full trade embargo on a target nation.',
    baseUtility: 40,
    riskLevel: 40,
    isExtreme: false,
    categoryWeights: { economic: 70, diplomatic: 40 },
    estimatedImpact: { treasury: -10, diplomaticInfluence: -10 },
  },
  {
    id: 'economic_stimulus',
    category: 'economic',
    name: 'Economic Stimulus',
    description: 'Inject capital into the domestic economy.',
    baseUtility: 50,
    riskLevel: 15,
    isExtreme: false,
    categoryWeights: { economic: 90, domestic: 40 },
    estimatedImpact: { treasury: -20, stability: 5, popularity: 5 },
  },
  {
    id: 'currency_manipulation',
    category: 'economic',
    name: 'Currency Manipulation',
    description: 'Covertly devalue or manipulate foreign exchange rates.',
    baseUtility: 35,
    riskLevel: 35,
    isExtreme: false,
    categoryWeights: { economic: 80, intelligence: 20 },
    estimatedImpact: { treasury: 10, diplomaticInfluence: -8 },
  },

  // ── Intelligence (3) ───────────────────────────────────

  {
    id: 'espionage_operation',
    category: 'intelligence',
    name: 'Espionage Operation',
    description: 'Conduct espionage to gather intelligence on a target.',
    baseUtility: 40,
    riskLevel: 30,
    isExtreme: false,
    categoryWeights: { intelligence: 80, military: 20 },
    estimatedImpact: { diplomaticInfluence: -5 },
  },
  {
    id: 'cyber_attack',
    category: 'intelligence',
    name: 'Cyber Attack',
    description: 'Execute a cyber operation against target infrastructure.',
    baseUtility: 50,
    riskLevel: 45,
    isExtreme: false,
    categoryWeights: { intelligence: 90, military: 30 },
    estimatedImpact: { diplomaticInfluence: -10 },
  },
  {
    id: 'counter_intelligence',
    category: 'intelligence',
    name: 'Counter Intelligence',
    description: 'Strengthen domestic counter-intelligence operations.',
    baseUtility: 35,
    riskLevel: 10,
    isExtreme: false,
    categoryWeights: { intelligence: 80, domestic: 30 },
    estimatedImpact: { stability: 3 },
  },

  // ── Domestic (3) ───────────────────────────────────────

  {
    id: 'domestic_reform',
    category: 'domestic',
    name: 'Domestic Reform',
    description: 'Implement structural reforms to improve governance.',
    baseUtility: 55,
    riskLevel: 10,
    isExtreme: false,
    categoryWeights: { domestic: 90, economic: 20 },
    estimatedImpact: { stability: 8, popularity: 5, treasury: -10 },
  },
  {
    id: 'propaganda_campaign',
    category: 'domestic',
    name: 'Propaganda Campaign',
    description: 'Launch a domestic propaganda campaign to boost morale.',
    baseUtility: 40,
    riskLevel: 15,
    isExtreme: false,
    categoryWeights: { domestic: 70, intelligence: 20 },
    estimatedImpact: { popularity: 8, stability: 3 },
  },
  {
    id: 'emergency_martial_law',
    category: 'domestic',
    name: 'Emergency Martial Law',
    description: 'Declare martial law to suppress internal unrest.',
    baseUtility: 30,
    riskLevel: 60,
    isExtreme: true,
    extremeThreshold: 30,
    categoryWeights: { domestic: 80, military: 50 },
    estimatedImpact: { stability: 10, popularity: -20, diplomaticInfluence: -10 },
  },

  // ── Nuclear (2) ────────────────────────────────────────

  {
    id: 'nuclear_posturing',
    category: 'nuclear',
    name: 'Nuclear Posturing',
    description: 'Signal nuclear readiness through tests or public statements.',
    baseUtility: 20,
    riskLevel: 70,
    isExtreme: true,
    extremeThreshold: 30,
    categoryWeights: { nuclear: 90, military: 40 },
    estimatedImpact: { nuclearThreshold: 15, diplomaticInfluence: -15, stability: -5 },
  },
  {
    id: 'tactical_nuclear_deployment',
    category: 'nuclear',
    name: 'Tactical Nuclear Deployment',
    description: 'Deploy tactical nuclear weapons to a theatre of operations.',
    baseUtility: 10,
    riskLevel: 95,
    isExtreme: true,
    extremeThreshold: 15,
    categoryWeights: { nuclear: 100, military: 50 },
    estimatedImpact: { nuclearThreshold: 30, stability: -20, diplomaticInfluence: -30 },
  },

  // ── Grey Zone (2) ──────────────────────────────────────

  {
    id: 'proxy_funding',
    category: 'grey-zone',
    name: 'Proxy Funding',
    description: 'Fund proxy forces or non-state actors in a target region.',
    baseUtility: 35,
    riskLevel: 25,
    isExtreme: false,
    categoryWeights: { 'grey-zone': 80, military: 30, intelligence: 30 },
    estimatedImpact: { treasury: -10, diplomaticInfluence: -5 },
  },
  {
    id: 'fishing_fleet_deployment',
    category: 'grey-zone',
    name: 'Fishing Fleet Deployment',
    description: 'Deploy maritime militia disguised as fishing vessels.',
    baseUtility: 40,
    riskLevel: 15,
    isExtreme: false,
    categoryWeights: { 'grey-zone': 90, military: 20 },
    estimatedImpact: { militaryReadiness: -2, diplomaticInfluence: -3 },
  },
] as const;

// ─────────────────────────────────────────────────────────
// 3. Faction Configurations
// ─────────────────────────────────────────────────────────

/**
 * AI configuration for all 8 factions.
 *
 * Phase 1 (CNFL-0403): US (Trump), China (Xi), Japan (Takaichi), Iran (Successor)
 * Phase 2: Russia (Putin), DPRK (Kim), EU (Von der Leyen), Syria (Assad Successor)
 */
export const AI_FACTION_CONFIGS: Record<FactionId, AIFactionConfig> = {
  // ── Phase 1 Factions ───────────────────────────────────

  [FactionIdEnum.US]: {
    factionId: FactionIdEnum.US,
    leaderName: 'Donald Trump',
    weights: {
      aggression: 65,
      economicFocus: 55,
      diplomaticPreference: 35,
      riskTolerance: 75,
      domesticPriority: 30,
    },
    decisionStyle: DecisionStyleEnum.Transactional,
    stressResponse: StressResponseEnum.Deflect,
    behaviorNotes: [
      'Deal-maker: favors economic leverage',
      'High risk tolerance',
      'Deflects blame under pressure',
    ],
  },

  [FactionIdEnum.China]: {
    factionId: FactionIdEnum.China,
    leaderName: 'Xi Jinping',
    weights: {
      aggression: 42,
      economicFocus: 65,
      diplomaticPreference: 55,
      riskTolerance: 45,
      domesticPriority: 55,
    },
    decisionStyle: DecisionStyleEnum.Analytical,
    stressResponse: StressResponseEnum.Consolidate,
    behaviorNotes: [
      'Patient strategic thinker',
      'Prioritizes economic stability',
      'Consolidates under pressure',
    ],
  },

  [FactionIdEnum.Japan]: {
    factionId: FactionIdEnum.Japan,
    leaderName: 'Sanae Takaichi',
    weights: {
      aggression: 55,
      economicFocus: 50,
      diplomaticPreference: 45,
      riskTolerance: 70,
      domesticPriority: 45,
    },
    decisionStyle: DecisionStyleEnum.Intuitive,
    stressResponse: StressResponseEnum.Escalate,
    behaviorNotes: [
      'Gut-instinct decisions',
      'More hawkish than predecessors',
      'Escalates under pressure',
    ],
  },

  [FactionIdEnum.Iran]: {
    factionId: FactionIdEnum.Iran,
    leaderName: 'Iran Supreme Leader Successor',
    weights: {
      aggression: 40,
      economicFocus: 50,
      diplomaticPreference: 30,
      riskTolerance: 60,
      domesticPriority: 70,
    },
    decisionStyle: DecisionStyleEnum.Ideological,
    stressResponse: StressResponseEnum.Consolidate,
    behaviorNotes: [
      'Ideologically driven',
      'Domestic stability is paramount',
      'Consolidates power under threat',
    ],
  },

  // ── Phase 2 Factions (placeholder defaults) ────────────

  [FactionIdEnum.Russia]: { // Phase 2
    factionId: FactionIdEnum.Russia,
    leaderName: 'Vladimir Putin',
    weights: {
      aggression: 60,
      economicFocus: 40,
      diplomaticPreference: 35,
      riskTolerance: 70,
      domesticPriority: 50,
    },
    decisionStyle: DecisionStyleEnum.Analytical,
    stressResponse: StressResponseEnum.Escalate,
    behaviorNotes: [
      'Calculated aggression',
      'Leverages energy dependence',
      'Escalates when cornered',
    ],
  },

  [FactionIdEnum.DPRK]: { // Phase 2
    factionId: FactionIdEnum.DPRK,
    leaderName: 'Kim Jong Un',
    weights: {
      aggression: 55,
      economicFocus: 30,
      diplomaticPreference: 20,
      riskTolerance: 80,
      domesticPriority: 65,
    },
    decisionStyle: DecisionStyleEnum.Ideological,
    stressResponse: StressResponseEnum.Escalate,
    behaviorNotes: [
      'Regime survival above all',
      'Nuclear brinkmanship',
      'Unpredictable escalation',
    ],
  },

  [FactionIdEnum.EU]: { // Phase 2
    factionId: FactionIdEnum.EU,
    leaderName: 'EU Leadership Council',
    weights: {
      aggression: 25,
      economicFocus: 70,
      diplomaticPreference: 75,
      riskTolerance: 30,
      domesticPriority: 60,
    },
    decisionStyle: DecisionStyleEnum.Analytical,
    stressResponse: StressResponseEnum.Consolidate,
    behaviorNotes: [
      'Consensus-driven decision making',
      'Strongly favors diplomacy and trade',
      'Risk-averse, consolidates under pressure',
    ],
  },

  [FactionIdEnum.Syria]: { // Phase 2
    factionId: FactionIdEnum.Syria,
    leaderName: 'Syrian Transitional Authority',
    weights: {
      aggression: 35,
      economicFocus: 45,
      diplomaticPreference: 40,
      riskTolerance: 55,
      domesticPriority: 75,
    },
    decisionStyle: DecisionStyleEnum.Ideological,
    stressResponse: StressResponseEnum.Consolidate,
    behaviorNotes: [
      'Focused on internal reconstruction',
      'Domestic stability is top priority',
      'Relies on patron alliances',
    ],
  },
} as const;

// ─────────────────────────────────────────────────────────
// 4. Exported Functions
// ─────────────────────────────────────────────────────────

/**
 * Retrieve the AI configuration for a specific faction.
 *
 * @param factionId - The faction to look up.
 * @returns The faction's AI config, or `undefined` if not found.
 */
export function getAIFactionConfig(
  factionId: FactionId,
): AIFactionConfig | undefined {
  return AI_FACTION_CONFIGS[factionId];
}

/**
 * Return the standard catalog of candidate actions.
 *
 * @returns Immutable array of all standard AI actions.
 */
export function getStandardActions(): readonly AIAction[] {
  return STANDARD_AI_ACTIONS;
}

/**
 * Convenience function that evaluates a faction's turn using the standard
 * action catalog and pre-configured weights from {@link AI_FACTION_CONFIGS}.
 *
 * Fills in `candidateActions` from {@link STANDARD_AI_ACTIONS} and `weights`
 * from the faction config (falling back to profile-derived weights).
 *
 * @param context - Evaluation context WITHOUT candidateActions and weights.
 * @returns Full evaluation result with ranked actions.
 *
 * @see FR-301
 */
export function evaluateFactionTurn(
  context: Omit<AIEvaluationContext, 'candidateActions' | 'weights'>,
): AIEvaluationResult {
  const config = AI_FACTION_CONFIGS[context.factionId];

  // Use pre-configured weights if available, otherwise derive from profile
  const weights: UtilityWeights = config
    ? config.weights
    : UtilityEvaluator.deriveWeightsFromProfile(context.leaderProfile.psychology);

  const fullContext: AIEvaluationContext = {
    ...context,
    weights,
    candidateActions: [...STANDARD_AI_ACTIONS],
  };

  return UtilityEvaluator.evaluate(fullContext);
}
