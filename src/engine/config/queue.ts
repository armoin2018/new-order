/**
 * Queue-Based Scenario Runner Configuration — FR-4400
 *
 * Default queue limits, concurrency settings, and batch parameters
 * for the scenario queue engine.
 *
 * All queue tuning is centralised here — no code changes required.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4401 — Queue management
 * @see FR-4402 — Batch creation
 * @see FR-4403 — Concurrency control
 */

export const queueConfig = {
  /**
   * Maximum number of items that can be held in the queue at once.
   * @see FR-4401
   */
  maxQueueSize: 50,

  /**
   * Maximum number of items in a single batch.
   * @see FR-4402
   */
  maxBatchSize: 18,

  /**
   * Concurrency control defaults.
   * @see FR-4403
   */
  concurrency: {
    /** Absolute ceiling for parallel runs. */
    maxParallel: 4,
    /** Default parallel execution count for new queue states. */
    defaultParallel: 1,
    /** System resource usage threshold (%) before throttling. */
    resourceThresholdPct: 80,
    /** If true, fall back to sequential when resources are constrained. */
    fallbackToSequential: true,
  },

  /**
   * Default shared parameters applied to batch items when none are supplied.
   * @see FR-4402
   */
  defaultSharedParams: {
    totalTurns: 30,
    aiProvider: 'internal',
    turnDurationUnit: 'month',
    victoryConditions: [] as readonly string[],
  },
} as const;
