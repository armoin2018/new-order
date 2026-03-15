/**
 * Scenario Lifecycle Management Configuration — FR-4600
 *
 * Default transition rules, scoring thresholds, pause limits, and fork
 * constraints for the lifecycle engine.
 *
 * All lifecycle tuning is centralised here — no code changes required.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4601 — Lifecycle status transitions
 * @see FR-4602 — Termination and scoring
 * @see FR-4603 — Pause / resume tracking
 * @see FR-4604 — Scenario forking
 */

export const lifecycleConfig = {
  /**
   * Every legal status transition in the lifecycle state machine.
   * @see FR-4601
   */
  validTransitions: [
    // setup →
    { from: 'setup', to: 'active', action: 'start' },
    { from: 'setup', to: 'terminated', action: 'terminate' },

    // active →
    { from: 'active', to: 'paused', action: 'pause' },
    { from: 'active', to: 'completed', action: 'complete' },
    { from: 'active', to: 'terminated', action: 'terminate' },
    { from: 'active', to: 'forked', action: 'fork' },

    // paused →
    { from: 'paused', to: 'active', action: 'resume' },
    { from: 'paused', to: 'terminated', action: 'terminate' },

    // completed →  (terminal — no outgoing transitions)

    // terminated → (terminal — no outgoing transitions)

    // forked →
    { from: 'forked', to: 'active', action: 'resume' },
  ] as const,

  /**
   * Scoring configuration.
   * @see FR-4602
   */
  scoring: {
    /** Percentage penalty applied when a scenario ends before its configured total turns. */
    earlyTerminationPenaltyPct: 10,
    /** Minimum turns that must elapse before a letter grade is assigned. */
    minimumTurnsForGrade: 5,
  },

  /**
   * Pause constraints.
   * @see FR-4603
   */
  pause: {
    /** Maximum number of pauses allowed per scenario. */
    maxPausesPerScenario: 20,
    /** Maximum pause duration in milliseconds (7 days). */
    maxPauseDurationMs: 604_800_000,
  },

  /**
   * Fork constraints.
   * @see FR-4604
   */
  fork: {
    /** Maximum number of forks originating from a single scenario. */
    maxForksPerScenario: 5,
    /** Name template for forked scenarios. `{originalName}` and `{n}` are replaced at runtime. */
    nameTemplate: '{originalName} (Fork {n})',
  },

  /**
   * Grade thresholds mapping score (0–1000) to letter grades.
   * A score >= the threshold earns the corresponding grade.
   * @see FR-4602
   */
  gradeThresholds: {
    A: 800,
    B: 650,
    C: 500,
    D: 350,
  },
} as const;
