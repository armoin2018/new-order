/**
 * Multi-Action Turn System Configuration — FR-5000, FR-5400
 *
 * Default limits, cost scaling, interaction thresholds, resolution
 * behaviour, and AI tuning for the multi-action turn system.
 *
 * All action-slate tuning is centralised here — no code changes required.
 *
 * @see NFR-204  — All game formulas shall be configurable via constants.
 * @see FR-5001  — Action slate composition and validation
 * @see FR-5002  — Interaction effect detection
 * @see FR-5003  — Simultaneous action resolution
 * @see FR-5402  — Expanded 8-vector AI prioritization weights
 * @see FR-5403  — Reduced cost scaling and lower interaction thresholds
 */

export const actionSlateConfig = {
  /**
   * Slate size constraints.
   * @see FR-5001
   */
  limits: {
    /** Default maximum actions per nation per turn. */
    defaultMaxActions: 5,
    /** Minimum actions a nation must submit. */
    minActions: 1,
    /** Absolute ceiling that can be configured per scenario. */
    maxConfigurableActions: 10,
  },

  /**
   * Resource cost scaling.
   * Each action beyond 3 incurs an additional 15% cost multiplier (reduced
   * from 20% in FR-5403 to encourage broader multi-vector play).
   * @see FR-5001
   * @see FR-5403
   */
  costs: {
    /** Base multiplier applied to every action's resource cost. */
    baseCostMultiplier: 1.0,
    /** Incremental cost scaling per extra action beyond 3. */
    additionalActionCostScaling: 0.15,
  },

  /**
   * Interaction detection thresholds.
   * Lowered in FR-5403 to detect more cross-domain interactions.
   * @see FR-5002
   * @see FR-5403
   */
  interactions: {
    /** Credibility penalty applied when conflicting actions are detected. */
    credibilityPenalty: -5,
    /** Impact modifier for sanction + trade synergy pair. */
    synergySanctionTrade: -5,
    /** Minimum absolute overlap score to flag a conflict. */
    conflictThreshold: 0.3,
    /** Minimum absolute overlap score to flag a synergy. */
    synergyThreshold: 0.2,
  },

  /**
   * Resolution behaviour.
   * @see FR-5003
   */
  resolution: {
    /** Whether all nations' actions resolve simultaneously. */
    simultaneousExecution: true,
    /** How ties in priority are broken. */
    priorityTieBreaker: 'random' as const,
    /** Whether fog-of-war masks opponent action details. */
    fogOfWarApplied: true,
  },

  /**
   * AI nation action generation tuning.
   * FR-5402: Expanded to all 8 ActionType vectors so no capability
   * is invisible to AI prioritisation. Weights normalised to sum ≈ 1.0.
   * @see FR-5001
   * @see FR-5402
   */
  ai: {
    /** Maximum actions an AI-controlled nation may select per turn. */
    maxActionsPerAINation: 5,
    /** Search depth for the AI evaluation heuristic. */
    evaluationDepth: 3,
    /** Relative weights the AI uses when prioritising action types. */
    prioritizationWeights: {
      military: 0.15,
      economic: 0.15,
      diplomatic: 0.15,
      intelligence: 0.15,
      policy: 0.10,
      humanitarian: 0.10,
      technology: 0.10,
      propaganda: 0.10,
    },
  },
} as const;
