/**
 * New Order — National Policy System Configuration
 *
 * Lifecycle tuning, cost scaling, AI proposal behaviour, interaction
 * thresholds, and storage paths for the policy subsystem.
 *
 * All policy tuning is centralised here — no code changes required.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-5200 — National Policy System
 * @see FR-5201 — Policy lifecycle management
 * @see FR-5202 — Policy cost scaling
 * @see FR-5203 — AI policy proposals
 * @see FR-5204 — Policy interaction modelling
 */

export const policyConfig = {
  /**
   * Policy lifecycle timing and effectiveness curves.
   * @see FR-5201
   */
  lifecycle: {
    /** Turns a proposal remains open before auto-expiry. */
    proposalDurationTurns: 2,
    /** Turns over which a repealed policy's effects wind down. */
    windDownTurns: 3,
    /** Minimum turns a policy must remain active before repeal. */
    minActiveTurns: 1,
    /** Per-turn decay rate applied when effectiveness erodes. */
    effectivenessDecayRate: 0.02,
    /** Per-turn growth rate applied during ramp-up phase. */
    effectivenessGrowthRate: 0.01,
    /** Hard cap on policy effectiveness. */
    maxEffectiveness: 100,
  },

  /**
   * Cost scaling by policy scope.
   * @see FR-5202
   */
  costs: {
    /** Global multiplier applied to all policy costs. */
    baseCostMultiplier: 1.0,
    /** Factor for domestic-scope policies. */
    domesticCostFactor: 1.0,
    /** Factor for bilateral-scope policies. */
    bilateralCostFactor: 1.5,
    /** Factor for multilateral-scope policies. */
    multilateralCostFactor: 2.5,
  },

  /**
   * AI-driven policy proposal behaviour.
   * @see FR-5203
   */
  ai: {
    /** AI evaluates proposals every N turns. */
    proposalFrequency: 3,
    /** Maximum AI proposals surfaced per turn. */
    maxProposalsPerTurn: 2,
    /** Minimum AI confidence (0–100) required to surface a proposal. */
    minConfidenceToPropose: 60,
    /** Dimensions the AI considers when calculating policy impact. */
    impactCalculationDimensions: [
      'stability',
      'economy',
      'education',
      'militaryReadiness',
      'diplomaticInfluence',
      'civilUnrest',
      'technology',
      'populationSentiment',
      'internationalReputation',
    ] as const,
  },

  /**
   * Policy interaction detection thresholds and caps.
   * @see FR-5204
   */
  interactions: {
    /** Correlation below this value flags a conflict. */
    conflictThreshold: -0.3,
    /** Correlation above this value flags a synergy. */
    synergyThreshold: 0.3,
    /** Maximum penalty multiplier for conflicting policies. */
    maxConflictPenalty: -0.5,
    /** Maximum bonus multiplier for synergistic policies. */
    maxSynergyBonus: 0.3,
  },

  /**
   * Default and user-override storage paths for policy JSON files.
   */
  storage: {
    /** Default project-relative path for bundled policy models. */
    defaultPath: 'models/policies',
    /** User-local override path for custom policy definitions. */
    customPath: '~/.newOrder/models/policies',
  },
} as const;
