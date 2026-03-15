/**
 * Scenario Lifecycle Management Types — FR-4600
 *
 * Type definitions for the scenario lifecycle engine: status management,
 * termination recording, pause/resume tracking, and scenario forking.
 *
 * @see FR-4601 — Lifecycle status transitions
 * @see FR-4602 — Termination and scoring
 * @see FR-4603 — Pause / resume tracking
 * @see FR-4604 — Scenario forking
 */

// ---------------------------------------------------------------------------
// FR-4601 — Lifecycle Status
// ---------------------------------------------------------------------------

/**
 * All possible lifecycle statuses for a running scenario.
 * @see FR-4601
 */
export type ScenarioLifecycleStatus =
  | 'setup'
  | 'active'
  | 'paused'
  | 'completed'
  | 'terminated'
  | 'forked';

// ---------------------------------------------------------------------------
// FR-4602 — Termination
// ---------------------------------------------------------------------------

/**
 * Reason a scenario was terminated.
 * @see FR-4602
 */
export type TerminationReason =
  | 'playerDecision'
  | 'victoryAchieved'
  | 'lossTriggered'
  | 'turnLimitReached'
  | 'error';

/**
 * Immutable record of how and when a scenario ended.
 * @see FR-4602
 */
export interface TerminationRecord {
  /** Why the scenario ended. */
  readonly reason: TerminationReason;
  /** Turn at which termination occurred. */
  readonly turn: number;
  /** Total turns configured for the scenario. */
  readonly totalTurns: number;
  /** ISO-8601 timestamp of termination. */
  readonly timestamp: string;
  /** Composite score at termination, or null if unavailable. */
  readonly compositeScore: number | null;
  /** Letter grade derived from score, or null if unavailable. */
  readonly letterGrade: string | null;
  /** Free-form notes about the termination. */
  readonly notes: string;
}

// ---------------------------------------------------------------------------
// FR-4603 — Pause / Resume
// ---------------------------------------------------------------------------

/**
 * Record of a single pause–resume cycle.
 * @see FR-4603
 */
export interface PauseRecord {
  /** ISO-8601 timestamp when the scenario was paused. */
  readonly pausedAt: string;
  /** Turn number at the time of pause. */
  readonly pausedAtTurn: number;
  /** ISO-8601 timestamp when the scenario was resumed, or null if still paused. */
  readonly resumedAt: string | null;
  /** Reason the scenario was paused. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-4604 — Forking
// ---------------------------------------------------------------------------

/**
 * Record of a scenario fork event.
 * @see FR-4604
 */
export interface ForkRecord {
  /** Simulation ID of the parent scenario. */
  readonly parentSimulationId: string;
  /** Turn from which the fork diverges. */
  readonly forkedFromTurn: number;
  /** ISO-8601 timestamp when the fork was created. */
  readonly forkedAt: string;
  /** Simulation ID of the newly-forked scenario. */
  readonly newSimulationId: string;
  /** Human-readable description of the fork. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// FR-4601 — Aggregate Lifecycle State
// ---------------------------------------------------------------------------

/**
 * Complete lifecycle state for a scenario, tracking status, pauses, forks,
 * and termination.
 * @see FR-4601
 */
export interface ScenarioLifecycleState {
  /** Current lifecycle status. */
  status: ScenarioLifecycleStatus;
  /** ISO-8601 timestamp when the scenario was started, or null. */
  startedAt: string | null;
  /** ISO-8601 timestamp when the scenario completed, or null. */
  completedAt: string | null;
  /** Termination record, or null if the scenario has not ended. */
  terminationRecord: TerminationRecord | null;
  /** Ordered history of all pause–resume cycles. */
  pauseHistory: PauseRecord[];
  /** Ordered history of all fork events originating from this scenario. */
  forkHistory: ForkRecord[];
  /** Cumulative pause duration in milliseconds. */
  totalPauseDurationMs: number;
  /** Currently active pause, or null if not paused. */
  activePause: PauseRecord | null;
}

// ---------------------------------------------------------------------------
// FR-4601 — Transition Definitions
// ---------------------------------------------------------------------------

/**
 * Describes a single valid lifecycle transition.
 * @see FR-4601
 */
export interface LifecycleTransition {
  /** Status to transition from. */
  readonly from: ScenarioLifecycleStatus;
  /** Status to transition to. */
  readonly to: ScenarioLifecycleStatus;
  /** Human-readable action name triggering this transition. */
  readonly action: string;
}
