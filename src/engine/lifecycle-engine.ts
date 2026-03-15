/**
 * Scenario Lifecycle Management Engine — FR-4600
 *
 * Pure functions for managing a scenario's lifecycle: start, pause, resume,
 * terminate, fork, scoring, and summary reporting.
 *
 * **No side effects** — timestamps are injected or generated in isolation.
 *
 * @see FR-4601 — Lifecycle status transitions
 * @see FR-4602 — Termination and scoring
 * @see FR-4603 — Pause / resume tracking
 * @see FR-4604 — Scenario forking
 */

import type {
  ScenarioLifecycleState,
  ScenarioLifecycleStatus,
  TerminationReason,
  LifecycleTransition,
  ForkRecord,
  PauseRecord,
} from '@/data/types/lifecycle.types';
import { lifecycleConfig } from '@/engine/config/lifecycle';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeLifecycleState                                    FR-4601
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh {@link ScenarioLifecycleState} in `setup` status.
 *
 * @returns A lifecycle state ready for {@link startScenario}.
 * @see FR-4601
 */
export function initializeLifecycleState(): ScenarioLifecycleState {
  return {
    status: 'setup',
    startedAt: null,
    completedAt: null,
    terminationRecord: null,
    pauseHistory: [],
    forkHistory: [],
    totalPauseDurationMs: 0,
    activePause: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — startScenario                                               FR-4601
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transition a scenario from `setup` to `active`, recording the start time.
 *
 * @param state — Current lifecycle state (must be in `setup`).
 * @returns Updated lifecycle state in `active` status.
 * @throws {Error} If the transition from the current status to `active` is invalid.
 * @see FR-4601
 */
export function startScenario(state: ScenarioLifecycleState): ScenarioLifecycleState {
  if (!isTransitionValid(state.status, 'active', lifecycleConfig.validTransitions)) {
    throw new Error(`Cannot start scenario: invalid transition from '${state.status}' to 'active'`);
  }
  return {
    ...state,
    status: 'active',
    startedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — terminateScenario                                           FR-4602
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Terminate a scenario, recording the reason, turn information, and optional
 * score with an automatically-derived letter grade.
 *
 * If the scenario ends before reaching its total turns, the early-termination
 * penalty is applied before grading.
 *
 * @param state — Current lifecycle state.
 * @param reason — Why the scenario is ending.
 * @param turn — Turn at which termination occurs.
 * @param totalTurns — Total configured turns for the scenario.
 * @param score — Optional composite score (0–1000).
 * @returns Updated lifecycle state in `terminated` or `completed` status.
 * @throws {Error} If the transition is invalid.
 * @see FR-4602
 */
export function terminateScenario(
  state: ScenarioLifecycleState,
  reason: TerminationReason,
  turn: number,
  totalTurns: number,
  score?: number | null,
): ScenarioLifecycleState {
  const targetStatus: ScenarioLifecycleStatus =
    reason === 'victoryAchieved' || reason === 'turnLimitReached' ? 'completed' : 'terminated';

  if (!isTransitionValid(state.status, targetStatus, lifecycleConfig.validTransitions)) {
    throw new Error(
      `Cannot terminate scenario: invalid transition from '${state.status}' to '${targetStatus}'`,
    );
  }

  let finalScore: number | null = score ?? null;
  let letterGrade: string | null = null;

  if (finalScore !== null) {
    finalScore = applyEarlyTerminationPenalty(
      finalScore,
      turn,
      totalTurns,
      lifecycleConfig.scoring.earlyTerminationPenaltyPct,
    );
    if (turn >= lifecycleConfig.scoring.minimumTurnsForGrade) {
      letterGrade = computeLetterGrade(finalScore, lifecycleConfig.gradeThresholds);
    }
  }

  const now = new Date().toISOString();

  return {
    ...state,
    status: targetStatus,
    completedAt: now,
    terminationRecord: {
      reason,
      turn,
      totalTurns,
      timestamp: now,
      compositeScore: finalScore,
      letterGrade,
      notes: '',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — pauseScenario                                               FR-4603
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pause a running scenario, creating a new {@link PauseRecord}.
 *
 * @param state — Current lifecycle state (must be `active`).
 * @param turn — Turn at which the pause occurs.
 * @param reason — Optional reason for the pause.
 * @returns Updated lifecycle state in `paused` status.
 * @throws {Error} If the transition is invalid or the pause limit is reached.
 * @see FR-4603
 */
export function pauseScenario(
  state: ScenarioLifecycleState,
  turn: number,
  reason?: string,
): ScenarioLifecycleState {
  if (!isTransitionValid(state.status, 'paused', lifecycleConfig.validTransitions)) {
    throw new Error(
      `Cannot pause scenario: invalid transition from '${state.status}' to 'paused'`,
    );
  }

  if (state.pauseHistory.length >= lifecycleConfig.pause.maxPausesPerScenario) {
    throw new Error(
      `Cannot pause scenario: maximum pauses (${lifecycleConfig.pause.maxPausesPerScenario}) reached`,
    );
  }

  const pauseRecord: PauseRecord = {
    pausedAt: new Date().toISOString(),
    pausedAtTurn: turn,
    resumedAt: null,
    reason: reason ?? 'User paused the scenario',
  };

  return {
    ...state,
    status: 'paused',
    activePause: pauseRecord,
    pauseHistory: [...state.pauseHistory, pauseRecord],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — resumeScenario                                              FR-4603
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resume a paused scenario, resolving the active pause record and
 * accumulating the pause duration.
 *
 * @param state — Current lifecycle state (must be `paused`).
 * @returns Updated lifecycle state in `active` status.
 * @throws {Error} If the transition is invalid or there is no active pause.
 * @see FR-4603
 */
export function resumeScenario(state: ScenarioLifecycleState): ScenarioLifecycleState {
  if (!isTransitionValid(state.status, 'active', lifecycleConfig.validTransitions)) {
    throw new Error(
      `Cannot resume scenario: invalid transition from '${state.status}' to 'active'`,
    );
  }

  if (!state.activePause) {
    throw new Error('Cannot resume scenario: no active pause record found');
  }

  const now = new Date();
  const pauseStart = new Date(state.activePause.pausedAt).getTime();
  const pauseDurationMs = now.getTime() - pauseStart;

  const resolvedPause: PauseRecord = {
    ...state.activePause,
    resumedAt: now.toISOString(),
  };

  const updatedHistory = state.pauseHistory.map((p) =>
    p.pausedAt === state.activePause!.pausedAt ? resolvedPause : p,
  );

  return {
    ...state,
    status: 'active',
    activePause: null,
    pauseHistory: updatedHistory,
    totalPauseDurationMs: state.totalPauseDurationMs + pauseDurationMs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — forkScenario                                                FR-4604
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fork a scenario, producing an updated parent state (with a fork record)
 * and a fresh lifecycle state for the new fork.
 *
 * @param state — Current lifecycle state of the parent (must be `active`).
 * @param fromTurn — Turn from which the fork diverges.
 * @param parentId — Simulation ID of the parent scenario.
 * @param newId — Simulation ID for the new fork.
 * @param description — Optional description of the fork.
 * @returns An object with `parentState` and `forkState`.
 * @throws {Error} If the transition is invalid or the fork limit is reached.
 * @see FR-4604
 */
export function forkScenario(
  state: ScenarioLifecycleState,
  fromTurn: number,
  parentId: string,
  newId: string,
  description?: string,
): { parentState: ScenarioLifecycleState; forkState: ScenarioLifecycleState } {
  if (!isTransitionValid(state.status, 'forked', lifecycleConfig.validTransitions)) {
    throw new Error(
      `Cannot fork scenario: invalid transition from '${state.status}' to 'forked'`,
    );
  }

  if (!canFork(state, lifecycleConfig.fork.maxForksPerScenario)) {
    throw new Error(
      `Cannot fork scenario: maximum forks (${lifecycleConfig.fork.maxForksPerScenario}) reached`,
    );
  }

  const now = new Date().toISOString();
  const forkRecord: ForkRecord = {
    parentSimulationId: parentId,
    forkedFromTurn: fromTurn,
    forkedAt: now,
    newSimulationId: newId,
    description: description ?? `Fork from turn ${fromTurn}`,
  };

  const parentState: ScenarioLifecycleState = {
    ...state,
    status: 'forked',
    forkHistory: [...state.forkHistory, forkRecord],
  };

  const forkState: ScenarioLifecycleState = {
    ...initializeLifecycleState(),
    status: 'active',
    startedAt: now,
  };

  return { parentState, forkState };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — computeLetterGrade                                         FR-4602
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive a letter grade from a numeric score using the supplied thresholds.
 *
 * @param score — Numeric score (0–1000).
 * @param thresholds — Object mapping grade letters to minimum score.
 * @returns The letter grade, or `'F'` if no threshold is met.
 * @see FR-4602
 */
export function computeLetterGrade(
  score: number,
  thresholds: Readonly<Record<string, number>>,
): string {
  const sorted = Object.entries(thresholds).sort(([, a], [, b]) => b - a);
  for (const [grade, minScore] of sorted) {
    if (score >= minScore) return grade;
  }
  return 'F';
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — applyEarlyTerminationPenalty                                FR-4602
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a proportional early-termination penalty when a scenario ends
 * before its configured total turns.
 *
 * If `currentTurn >= totalTurns` the score is returned unchanged.
 *
 * Formula:
 * ```
 * remainingPct = (totalTurns - currentTurn) / totalTurns
 * penalty      = score × remainingPct × (penaltyPct / 100)
 * adjusted     = score - penalty
 * ```
 *
 * @param score — Raw composite score.
 * @param currentTurn — Turn at which the scenario ended.
 * @param totalTurns — Total turns configured.
 * @param penaltyPct — Penalty percentage (e.g. 10 = 10 %).
 * @returns Adjusted score, clamped to 0.
 * @see FR-4602
 */
export function applyEarlyTerminationPenalty(
  score: number,
  currentTurn: number,
  totalTurns: number,
  penaltyPct: number,
): number {
  if (currentTurn >= totalTurns) return score;
  if (totalTurns <= 0) return score;

  const remainingPct = (totalTurns - currentTurn) / totalTurns;
  const penalty = score * remainingPct * (penaltyPct / 100);
  return Math.max(0, score - penalty);
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — isTransitionValid                                           FR-4601
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check whether a lifecycle transition is permitted.
 *
 * @param from — Current status.
 * @param to — Desired target status.
 * @param validTransitions — Array of allowed transitions.
 * @returns `true` if the transition exists in the array.
 * @see FR-4601
 */
export function isTransitionValid(
  from: ScenarioLifecycleStatus,
  to: ScenarioLifecycleStatus,
  validTransitions: readonly LifecycleTransition[] | readonly { from: string; to: string; action: string }[],
): boolean {
  return validTransitions.some((t) => t.from === from && t.to === to);
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getLifecycleDuration                                       FR-4601
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the total active duration of a scenario in milliseconds,
 * excluding time spent paused.
 *
 * For ongoing scenarios the current time is used as the end boundary.
 *
 * @param state — Lifecycle state.
 * @returns Duration in milliseconds, or `0` if the scenario has not started.
 * @see FR-4601
 */
export function getLifecycleDuration(state: ScenarioLifecycleState): number {
  if (!state.startedAt) return 0;

  const start = new Date(state.startedAt).getTime();
  const end = state.completedAt
    ? new Date(state.completedAt).getTime()
    : Date.now();

  const totalElapsed = end - start;
  return Math.max(0, totalElapsed - state.totalPauseDurationMs);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — canFork                                                    FR-4604
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine whether the scenario can still be forked.
 *
 * @param state — Lifecycle state.
 * @param maxForks — Maximum forks allowed.
 * @returns `true` if the fork history length is below the limit.
 * @see FR-4604
 */
export function canFork(state: ScenarioLifecycleState, maxForks: number): boolean {
  return state.forkHistory.length < maxForks;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — getLifecycleSummary                                        FR-4601
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produce a concise summary of the scenario lifecycle for dashboards and logs.
 *
 * @param state — Lifecycle state.
 * @returns Summary object.
 * @see FR-4601
 */
export function getLifecycleSummary(state: ScenarioLifecycleState): {
  status: ScenarioLifecycleStatus;
  duration: number;
  pauseCount: number;
  forkCount: number;
  terminationReason: string | null;
} {
  return {
    status: state.status,
    duration: getLifecycleDuration(state),
    pauseCount: state.pauseHistory.length,
    forkCount: state.forkHistory.length,
    terminationReason: state.terminationRecord?.reason ?? null,
  };
}
