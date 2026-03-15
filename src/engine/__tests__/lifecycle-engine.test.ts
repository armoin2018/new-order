/**
 * Scenario Lifecycle Management Engine — Test Suite
 *
 * 55+ Vitest tests covering all 12 pure functions in lifecycle-engine.ts.
 *
 * @see FR-4601 — Lifecycle status transitions
 * @see FR-4602 — Termination and scoring
 * @see FR-4603 — Pause / resume tracking
 * @see FR-4604 — Scenario forking
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  initializeLifecycleState,
  startScenario,
  terminateScenario,
  pauseScenario,
  resumeScenario,
  forkScenario,
  computeLetterGrade,
  applyEarlyTerminationPenalty,
  isTransitionValid,
  getLifecycleDuration,
  canFork,
  getLifecycleSummary,
} from '@/engine/lifecycle-engine';
import type {
  ScenarioLifecycleState,
  ScenarioLifecycleStatus,
} from '@/data/types/lifecycle.types';
import { lifecycleConfig } from '@/engine/config/lifecycle';

// ── Test Helpers ────────────────────────────────────────────────────────────

/** Build an active lifecycle state for tests that need one. */
function buildActiveState(overrides: Partial<ScenarioLifecycleState> = {}): ScenarioLifecycleState {
  return {
    status: 'active',
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: null,
    terminationRecord: null,
    pauseHistory: [],
    forkHistory: [],
    totalPauseDurationMs: 0,
    activePause: null,
    ...overrides,
  };
}

/** Build a paused lifecycle state for resume tests. */
function buildPausedState(overrides: Partial<ScenarioLifecycleState> = {}): ScenarioLifecycleState {
  const pauseRecord = {
    pausedAt: '2025-01-01T01:00:00.000Z',
    pausedAtTurn: 5,
    resumedAt: null,
    reason: 'Test pause',
  };
  return {
    status: 'paused',
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: null,
    terminationRecord: null,
    pauseHistory: [pauseRecord],
    forkHistory: [],
    totalPauseDurationMs: 0,
    activePause: pauseRecord,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeLifecycleState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeLifecycleState', () => {
  it('should return a state in setup status', () => {
    const state = initializeLifecycleState();
    expect(state.status).toBe('setup');
  });

  it('should have null startedAt and completedAt', () => {
    const state = initializeLifecycleState();
    expect(state.startedAt).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it('should have null terminationRecord', () => {
    const state = initializeLifecycleState();
    expect(state.terminationRecord).toBeNull();
  });

  it('should have empty pauseHistory and forkHistory', () => {
    const state = initializeLifecycleState();
    expect(state.pauseHistory).toEqual([]);
    expect(state.forkHistory).toEqual([]);
  });

  it('should have zero totalPauseDurationMs', () => {
    const state = initializeLifecycleState();
    expect(state.totalPauseDurationMs).toBe(0);
  });

  it('should have null activePause', () => {
    const state = initializeLifecycleState();
    expect(state.activePause).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — startScenario
// ═══════════════════════════════════════════════════════════════════════════

describe('startScenario', () => {
  it('should transition from setup to active', () => {
    const state = initializeLifecycleState();
    const result = startScenario(state);
    expect(result.status).toBe('active');
  });

  it('should set startedAt to an ISO timestamp', () => {
    const state = initializeLifecycleState();
    const result = startScenario(state);
    expect(result.startedAt).toBeTruthy();
    expect(new Date(result.startedAt!).toISOString()).toBe(result.startedAt);
  });

  it('should not mutate the original state', () => {
    const state = initializeLifecycleState();
    const result = startScenario(state);
    expect(state.status).toBe('setup');
    expect(result).not.toBe(state);
  });

  it('should throw when starting from active', () => {
    const state = buildActiveState();
    expect(() => startScenario(state)).toThrow(/invalid transition/);
  });

  it('should throw when starting from completed', () => {
    const state = buildActiveState({ status: 'completed' });
    expect(() => startScenario(state)).toThrow(/invalid transition/);
  });

  it('should throw when starting from terminated', () => {
    const state = buildActiveState({ status: 'terminated' });
    expect(() => startScenario(state)).toThrow(/invalid transition/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — terminateScenario
// ═══════════════════════════════════════════════════════════════════════════

describe('terminateScenario', () => {
  it('should terminate an active scenario with playerDecision', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'playerDecision', 10, 30);
    expect(result.status).toBe('terminated');
  });

  it('should complete a scenario with victoryAchieved', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'victoryAchieved', 30, 30);
    expect(result.status).toBe('completed');
  });

  it('should complete a scenario with turnLimitReached', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'turnLimitReached', 30, 30);
    expect(result.status).toBe('completed');
  });

  it('should set completedAt timestamp', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'playerDecision', 10, 30);
    expect(result.completedAt).toBeTruthy();
  });

  it('should create a terminationRecord', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'error', 5, 30);
    expect(result.terminationRecord).not.toBeNull();
    expect(result.terminationRecord!.reason).toBe('error');
    expect(result.terminationRecord!.turn).toBe(5);
    expect(result.terminationRecord!.totalTurns).toBe(30);
  });

  it('should record the score with early termination penalty', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'playerDecision', 15, 30, 800);
    expect(result.terminationRecord!.compositeScore).toBeLessThan(800);
    expect(result.terminationRecord!.compositeScore).toBeGreaterThan(0);
  });

  it('should not apply penalty when turn equals totalTurns', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'turnLimitReached', 30, 30, 800);
    expect(result.terminationRecord!.compositeScore).toBe(800);
  });

  it('should assign a letter grade when turns >= minimumTurnsForGrade', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'turnLimitReached', 30, 30, 850);
    expect(result.terminationRecord!.letterGrade).toBe('A');
  });

  it('should not assign a letter grade when turns < minimumTurnsForGrade', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'playerDecision', 2, 30, 850);
    expect(result.terminationRecord!.letterGrade).toBeNull();
  });

  it('should handle null score', () => {
    const state = buildActiveState();
    const result = terminateScenario(state, 'playerDecision', 10, 30);
    expect(result.terminationRecord!.compositeScore).toBeNull();
    expect(result.terminationRecord!.letterGrade).toBeNull();
  });

  it('should throw when terminating from setup with victoryAchieved (completed)', () => {
    const state = initializeLifecycleState();
    expect(() => terminateScenario(state, 'victoryAchieved', 30, 30)).toThrow(
      /invalid transition/,
    );
  });

  it('should allow termination from paused', () => {
    const state = buildPausedState();
    const result = terminateScenario(state, 'playerDecision', 5, 30);
    expect(result.status).toBe('terminated');
  });

  it('should throw when terminating an already completed scenario', () => {
    const state = buildActiveState({ status: 'completed' });
    expect(() => terminateScenario(state, 'error', 30, 30)).toThrow(/invalid transition/);
  });

  it('should not mutate the original state', () => {
    const state = buildActiveState();
    terminateScenario(state, 'playerDecision', 10, 30);
    expect(state.status).toBe('active');
    expect(state.terminationRecord).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — pauseScenario
// ═══════════════════════════════════════════════════════════════════════════

describe('pauseScenario', () => {
  it('should transition from active to paused', () => {
    const state = buildActiveState();
    const result = pauseScenario(state, 5);
    expect(result.status).toBe('paused');
  });

  it('should create an activePause record', () => {
    const state = buildActiveState();
    const result = pauseScenario(state, 5, 'Dinner break');
    expect(result.activePause).not.toBeNull();
    expect(result.activePause!.pausedAtTurn).toBe(5);
    expect(result.activePause!.reason).toBe('Dinner break');
    expect(result.activePause!.resumedAt).toBeNull();
  });

  it('should add the pause to pauseHistory', () => {
    const state = buildActiveState();
    const result = pauseScenario(state, 5);
    expect(result.pauseHistory).toHaveLength(1);
  });

  it('should use default reason when none supplied', () => {
    const state = buildActiveState();
    const result = pauseScenario(state, 5);
    expect(result.activePause!.reason).toBe('User paused the scenario');
  });

  it('should throw when pausing from setup', () => {
    const state = initializeLifecycleState();
    expect(() => pauseScenario(state, 0)).toThrow(/invalid transition/);
  });

  it('should throw when pausing an already paused scenario', () => {
    const state = buildPausedState();
    expect(() => pauseScenario(state, 5)).toThrow(/invalid transition/);
  });

  it('should throw when pause limit is reached', () => {
    const pauses = Array.from({ length: lifecycleConfig.pause.maxPausesPerScenario }, (_, i) => ({
      pausedAt: `2025-01-0${(i % 9) + 1}T00:00:00.000Z`,
      pausedAtTurn: i,
      resumedAt: `2025-01-0${(i % 9) + 1}T01:00:00.000Z`,
      reason: `Pause ${i}`,
    }));
    const state = buildActiveState({ pauseHistory: pauses });
    expect(() => pauseScenario(state, 25)).toThrow(/maximum pauses/);
  });

  it('should not mutate the original state', () => {
    const state = buildActiveState();
    pauseScenario(state, 5);
    expect(state.status).toBe('active');
    expect(state.pauseHistory).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — resumeScenario
// ═══════════════════════════════════════════════════════════════════════════

describe('resumeScenario', () => {
  it('should transition from paused to active', () => {
    const state = buildPausedState();
    const result = resumeScenario(state);
    expect(result.status).toBe('active');
  });

  it('should clear the activePause', () => {
    const state = buildPausedState();
    const result = resumeScenario(state);
    expect(result.activePause).toBeNull();
  });

  it('should set resumedAt on the resolved pause record', () => {
    const state = buildPausedState();
    const result = resumeScenario(state);
    const resolved = result.pauseHistory[0];
    expect(resolved).toBeDefined();
    expect(resolved!.resumedAt).toBeTruthy();
  });

  it('should accumulate totalPauseDurationMs', () => {
    // Pause started 1 hour ago
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const pause = {
      pausedAt: oneHourAgo,
      pausedAtTurn: 5,
      resumedAt: null,
      reason: 'Test',
    };
    const state = buildPausedState({
      activePause: pause,
      pauseHistory: [pause],
      totalPauseDurationMs: 1000,
    });
    const result = resumeScenario(state);
    // Should be at least ~3_600_000 + 1000 (minus tiny test overhead)
    expect(result.totalPauseDurationMs).toBeGreaterThan(3_600_000);
  });

  it('should throw when resuming from active', () => {
    const state = buildActiveState();
    expect(() => resumeScenario(state)).toThrow(/invalid transition/);
  });

  it('should throw when resuming from setup (no active pause)', () => {
    const state = initializeLifecycleState();
    expect(() => resumeScenario(state)).toThrow(/no active pause/);
  });

  it('should throw when no active pause exists', () => {
    const state = buildPausedState({ activePause: null });
    expect(() => resumeScenario(state)).toThrow(/no active pause/);
  });

  it('should not mutate the original state', () => {
    const state = buildPausedState();
    resumeScenario(state);
    expect(state.status).toBe('paused');
    expect(state.activePause).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — forkScenario
// ═══════════════════════════════════════════════════════════════════════════

describe('forkScenario', () => {
  it('should return parentState in forked status', () => {
    const state = buildActiveState();
    const { parentState } = forkScenario(state, 10, 'sim-1', 'sim-2');
    expect(parentState.status).toBe('forked');
  });

  it('should add a fork record to parentState', () => {
    const state = buildActiveState();
    const { parentState } = forkScenario(state, 10, 'sim-1', 'sim-2', 'Alt history');
    expect(parentState.forkHistory).toHaveLength(1);
    expect(parentState.forkHistory[0]!.parentSimulationId).toBe('sim-1');
    expect(parentState.forkHistory[0]!.newSimulationId).toBe('sim-2');
    expect(parentState.forkHistory[0]!.forkedFromTurn).toBe(10);
    expect(parentState.forkHistory[0]!.description).toBe('Alt history');
  });

  it('should return forkState in active status with startedAt', () => {
    const state = buildActiveState();
    const { forkState } = forkScenario(state, 10, 'sim-1', 'sim-2');
    expect(forkState.status).toBe('active');
    expect(forkState.startedAt).toBeTruthy();
  });

  it('should return a fresh forkState with empty histories', () => {
    const state = buildActiveState();
    const { forkState } = forkScenario(state, 10, 'sim-1', 'sim-2');
    expect(forkState.pauseHistory).toEqual([]);
    expect(forkState.forkHistory).toEqual([]);
    expect(forkState.terminationRecord).toBeNull();
  });

  it('should use default description when none provided', () => {
    const state = buildActiveState();
    const { parentState } = forkScenario(state, 7, 'sim-1', 'sim-2');
    expect(parentState.forkHistory[0]!.description).toBe('Fork from turn 7');
  });

  it('should throw when forking from setup', () => {
    const state = initializeLifecycleState();
    expect(() => forkScenario(state, 1, 'a', 'b')).toThrow(/invalid transition/);
  });

  it('should throw when forking from paused', () => {
    const state = buildPausedState();
    expect(() => forkScenario(state, 1, 'a', 'b')).toThrow(/invalid transition/);
  });

  it('should throw when fork limit is reached', () => {
    const forks = Array.from({ length: lifecycleConfig.fork.maxForksPerScenario }, (_, i) => ({
      parentSimulationId: 'sim-1',
      forkedFromTurn: i,
      forkedAt: '2025-01-01T00:00:00.000Z',
      newSimulationId: `sim-fork-${i}`,
      description: `Fork ${i}`,
    }));
    const state = buildActiveState({ forkHistory: forks });
    expect(() => forkScenario(state, 10, 'sim-1', 'sim-new')).toThrow(/maximum forks/);
  });

  it('should not mutate the original state', () => {
    const state = buildActiveState();
    forkScenario(state, 10, 'sim-1', 'sim-2');
    expect(state.status).toBe('active');
    expect(state.forkHistory).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — computeLetterGrade
// ═══════════════════════════════════════════════════════════════════════════

describe('computeLetterGrade', () => {
  const thresholds = lifecycleConfig.gradeThresholds;

  it('should return A for score >= 800', () => {
    expect(computeLetterGrade(800, thresholds)).toBe('A');
    expect(computeLetterGrade(1000, thresholds)).toBe('A');
  });

  it('should return B for score >= 650 and < 800', () => {
    expect(computeLetterGrade(650, thresholds)).toBe('B');
    expect(computeLetterGrade(799, thresholds)).toBe('B');
  });

  it('should return C for score >= 500 and < 650', () => {
    expect(computeLetterGrade(500, thresholds)).toBe('C');
    expect(computeLetterGrade(649, thresholds)).toBe('C');
  });

  it('should return D for score >= 350 and < 500', () => {
    expect(computeLetterGrade(350, thresholds)).toBe('D');
    expect(computeLetterGrade(499, thresholds)).toBe('D');
  });

  it('should return F for score < 350', () => {
    expect(computeLetterGrade(349, thresholds)).toBe('F');
    expect(computeLetterGrade(0, thresholds)).toBe('F');
  });

  it('should return F for negative scores', () => {
    expect(computeLetterGrade(-100, thresholds)).toBe('F');
  });

  it('should handle custom thresholds', () => {
    expect(computeLetterGrade(90, { S: 90, A: 70, B: 50 })).toBe('S');
    expect(computeLetterGrade(60, { S: 90, A: 70, B: 50 })).toBe('B');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — applyEarlyTerminationPenalty
// ═══════════════════════════════════════════════════════════════════════════

describe('applyEarlyTerminationPenalty', () => {
  it('should return the score unchanged when currentTurn >= totalTurns', () => {
    expect(applyEarlyTerminationPenalty(800, 30, 30, 10)).toBe(800);
    expect(applyEarlyTerminationPenalty(800, 35, 30, 10)).toBe(800);
  });

  it('should reduce the score for early termination', () => {
    // 15 out of 30 turns → 50% remaining → penalty = 800 * 0.5 * 0.1 = 40
    const result = applyEarlyTerminationPenalty(800, 15, 30, 10);
    expect(result).toBeCloseTo(760, 5);
  });

  it('should apply maximum penalty at turn 0', () => {
    // 0 out of 30 turns → 100% remaining → penalty = 800 * 1.0 * 0.1 = 80
    const result = applyEarlyTerminationPenalty(800, 0, 30, 10);
    expect(result).toBeCloseTo(720, 5);
  });

  it('should apply minimal penalty near end', () => {
    // 29 out of 30 turns → ~3.33% remaining → penalty = 800 * 0.0333 * 0.1 ≈ 2.67
    const result = applyEarlyTerminationPenalty(800, 29, 30, 10);
    expect(result).toBeCloseTo(797.33, 1);
  });

  it('should clamp result to 0', () => {
    // Extreme penalty: 100% remaining, 200% penalty rate
    const result = applyEarlyTerminationPenalty(100, 0, 30, 200);
    expect(result).toBe(0);
  });

  it('should return score unchanged when totalTurns is 0', () => {
    expect(applyEarlyTerminationPenalty(800, 0, 0, 10)).toBe(800);
  });

  it('should handle a penalty of 0%', () => {
    expect(applyEarlyTerminationPenalty(800, 10, 30, 0)).toBe(800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — isTransitionValid
// ═══════════════════════════════════════════════════════════════════════════

describe('isTransitionValid', () => {
  const transitions = lifecycleConfig.validTransitions;

  it('should allow setup → active', () => {
    expect(isTransitionValid('setup', 'active', transitions)).toBe(true);
  });

  it('should allow setup → terminated', () => {
    expect(isTransitionValid('setup', 'terminated', transitions)).toBe(true);
  });

  it('should allow active → paused', () => {
    expect(isTransitionValid('active', 'paused', transitions)).toBe(true);
  });

  it('should allow active → completed', () => {
    expect(isTransitionValid('active', 'completed', transitions)).toBe(true);
  });

  it('should allow active → terminated', () => {
    expect(isTransitionValid('active', 'terminated', transitions)).toBe(true);
  });

  it('should allow active → forked', () => {
    expect(isTransitionValid('active', 'forked', transitions)).toBe(true);
  });

  it('should allow paused → active', () => {
    expect(isTransitionValid('paused', 'active', transitions)).toBe(true);
  });

  it('should allow paused → terminated', () => {
    expect(isTransitionValid('paused', 'terminated', transitions)).toBe(true);
  });

  it('should allow forked → active', () => {
    expect(isTransitionValid('forked', 'active', transitions)).toBe(true);
  });

  it('should reject completed → active', () => {
    expect(isTransitionValid('completed', 'active', transitions)).toBe(false);
  });

  it('should reject terminated → active', () => {
    expect(isTransitionValid('terminated', 'active', transitions)).toBe(false);
  });

  it('should reject setup → paused', () => {
    expect(isTransitionValid('setup', 'paused', transitions)).toBe(false);
  });

  it('should reject setup → completed', () => {
    expect(isTransitionValid('setup', 'completed', transitions)).toBe(false);
  });

  it('should reject paused → completed', () => {
    expect(isTransitionValid('paused', 'completed', transitions)).toBe(false);
  });

  it('should reject active → setup', () => {
    expect(isTransitionValid('active', 'setup', transitions)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getLifecycleDuration
// ═══════════════════════════════════════════════════════════════════════════

describe('getLifecycleDuration', () => {
  it('should return 0 when startedAt is null', () => {
    const state = initializeLifecycleState();
    expect(getLifecycleDuration(state)).toBe(0);
  });

  it('should compute duration for a completed scenario', () => {
    const state = buildActiveState({
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T02:00:00.000Z', // 2 hours
    });
    expect(getLifecycleDuration(state)).toBe(7_200_000);
  });

  it('should subtract pause duration', () => {
    const state = buildActiveState({
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T02:00:00.000Z', // 2 hours
      totalPauseDurationMs: 1_800_000, // 30 minutes
    });
    expect(getLifecycleDuration(state)).toBe(5_400_000); // 1.5 hours
  });

  it('should use current time for ongoing scenarios', () => {
    const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
    const state = buildActiveState({ startedAt: fiveMinAgo });
    const duration = getLifecycleDuration(state);
    // Should be roughly 300_000 ms (5 min), allow 1s tolerance
    expect(duration).toBeGreaterThan(299_000);
    expect(duration).toBeLessThan(302_000);
  });

  it('should never return a negative value', () => {
    const state = buildActiveState({
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T01:00:00.000Z',
      totalPauseDurationMs: 99_999_999, // way more than elapsed
    });
    expect(getLifecycleDuration(state)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — canFork
// ═══════════════════════════════════════════════════════════════════════════

describe('canFork', () => {
  it('should return true when no forks exist', () => {
    const state = buildActiveState();
    expect(canFork(state, 5)).toBe(true);
  });

  it('should return true when forks are below limit', () => {
    const forks = [
      {
        parentSimulationId: 'sim-1',
        forkedFromTurn: 5,
        forkedAt: '2025-01-01T00:00:00.000Z',
        newSimulationId: 'sim-2',
        description: 'Fork 1',
      },
    ];
    const state = buildActiveState({ forkHistory: forks });
    expect(canFork(state, 5)).toBe(true);
  });

  it('should return false when forks equal the limit', () => {
    const forks = Array.from({ length: 5 }, (_, i) => ({
      parentSimulationId: 'sim-1',
      forkedFromTurn: i,
      forkedAt: '2025-01-01T00:00:00.000Z',
      newSimulationId: `sim-${i + 2}`,
      description: `Fork ${i}`,
    }));
    const state = buildActiveState({ forkHistory: forks });
    expect(canFork(state, 5)).toBe(false);
  });

  it('should return false when forks exceed the limit', () => {
    const forks = Array.from({ length: 6 }, (_, i) => ({
      parentSimulationId: 'sim-1',
      forkedFromTurn: i,
      forkedAt: '2025-01-01T00:00:00.000Z',
      newSimulationId: `sim-${i + 2}`,
      description: `Fork ${i}`,
    }));
    const state = buildActiveState({ forkHistory: forks });
    expect(canFork(state, 5)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — getLifecycleSummary
// ═══════════════════════════════════════════════════════════════════════════

describe('getLifecycleSummary', () => {
  it('should return current status', () => {
    const state = buildActiveState();
    const summary = getLifecycleSummary(state);
    expect(summary.status).toBe('active');
  });

  it('should return pause count', () => {
    const pauses = [
      { pausedAt: '2025-01-01T00:00:00.000Z', pausedAtTurn: 1, resumedAt: '2025-01-01T01:00:00.000Z', reason: 'a' },
      { pausedAt: '2025-01-02T00:00:00.000Z', pausedAtTurn: 2, resumedAt: '2025-01-02T01:00:00.000Z', reason: 'b' },
    ];
    const state = buildActiveState({ pauseHistory: pauses });
    expect(getLifecycleSummary(state).pauseCount).toBe(2);
  });

  it('should return fork count', () => {
    const forks = [
      { parentSimulationId: 's1', forkedFromTurn: 5, forkedAt: '2025-01-01T00:00:00.000Z', newSimulationId: 's2', description: 'f1' },
    ];
    const state = buildActiveState({ forkHistory: forks });
    expect(getLifecycleSummary(state).forkCount).toBe(1);
  });

  it('should return null terminationReason when not terminated', () => {
    const state = buildActiveState();
    expect(getLifecycleSummary(state).terminationReason).toBeNull();
  });

  it('should return terminationReason from terminationRecord', () => {
    const state = buildActiveState({
      status: 'terminated',
      terminationRecord: {
        reason: 'playerDecision',
        turn: 10,
        totalTurns: 30,
        timestamp: '2025-01-01T00:00:00.000Z',
        compositeScore: 700,
        letterGrade: 'B',
        notes: '',
      },
    });
    expect(getLifecycleSummary(state).terminationReason).toBe('playerDecision');
  });

  it('should return duration from getLifecycleDuration', () => {
    const state = buildActiveState({
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T01:00:00.000Z',
    });
    const summary = getLifecycleSummary(state);
    expect(summary.duration).toBe(3_600_000);
  });

  it('should return 0 duration for unstarted scenarios', () => {
    const state = initializeLifecycleState();
    expect(getLifecycleSummary(state).duration).toBe(0);
  });
});
