/**
 * Tests for CNFL-3900 — Headless Game Runner
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GameState } from '@/data/types';
import type { TurnProcessingResult } from '../game-controller';

// ── Mock processTurn ────────────────────────────────────────────────────────
vi.mock('../game-controller', () => ({
  processTurn: vi.fn(),
}));

import { processTurn } from '../game-controller';
import {
  runHeadless,
  type TurnSnapshot,
  type TurnStatEntry,
} from '../headless-runner';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    scenarioMeta: { maxTurns: 10, id: 'test', name: 'Test', description: '' } as GameState['scenarioMeta'],
    currentTurn: 1 as GameState['currentTurn'],
    playerFaction: 'US' as GameState['playerFaction'],
    nationStates: {
      US: { gdp: 20000, militaryReadiness: 70, stability: 60, treasury: 500 },
      China: { gdp: 15000, militaryReadiness: 65, stability: 55, treasury: 400 },
    } as unknown as GameState['nationStates'],
    relationshipMatrix: {
      US: { China: 65 },
      China: { US: 65 },
    } as unknown as GameState['relationshipMatrix'],
    headlineArchive: [],
    eventLog: [],
    gameOver: false,
    gameEndReason: null,
    ...overrides,
  } as GameState;
}

function makeTurnResult(overrides: Partial<TurnProcessingResult> = {}): TurnProcessingResult {
  return {
    headlines: [{ text: 'Test headline', severity: 'low', factions: ['US'] }],
    aiActions: ['US moved troops'],
    stateChanges: [],
    gameOver: false,
    gameOverReason: null,
    ...overrides,
  } as TurnProcessingResult;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Headless Runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (processTurn as ReturnType<typeof vi.fn>).mockReturnValue(makeTurnResult());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Basic execution ────────────────────────────────────────────────────

  describe('basic execution', () => {
    it('should complete a run and return result', async () => {
      const state = makeState();
      const result = await runHeadless(state);

      expect(result.status).toBe('completed');
      expect(result.turnsSimulated).toBe(10);
      expect(result.eventLog).toHaveLength(10);
      expect(result.turnStats).toHaveLength(10);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('should call processTurn for each turn', async () => {
      const state = makeState({ scenarioMeta: { maxTurns: 5 } as GameState['scenarioMeta'] });
      await runHeadless(state);
      expect(processTurn).toHaveBeenCalledTimes(5);
    });

    it('should respect maxTurns config override', async () => {
      const state = makeState();
      const result = await runHeadless(state, { maxTurns: 3 });
      expect(result.turnsSimulated).toBe(3);
      expect(processTurn).toHaveBeenCalledTimes(3);
    });

    it('should default maxTurns from scenarioMeta', async () => {
      const state = makeState({ scenarioMeta: { maxTurns: 7 } as GameState['scenarioMeta'] });
      const result = await runHeadless(state);
      expect(result.turnsSimulated).toBe(7);
    });

    it('should return null seed when no seed provided', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 1 });
      expect(result.seed).toBeNull();
    });
  });

  // ── Seeded PRNG ────────────────────────────────────────────────────────

  describe('seeded PRNG', () => {
    it('should produce deterministic runs with same seed', async () => {
      // Use a custom processTurn that uses Math.random
      const randomValues: number[][] = [[], []];
      let runIndex = 0;

      (processTurn as ReturnType<typeof vi.fn>).mockImplementation((_state: GameState) => {
        randomValues[runIndex]!.push(Math.random());
        return makeTurnResult();
      });

      runIndex = 0;
      await runHeadless(makeState(), { maxTurns: 5, seed: 42 });
      runIndex = 1;
      await runHeadless(makeState(), { maxTurns: 5, seed: 42 });

      expect(randomValues[0]).toEqual(randomValues[1]);
      expect(randomValues[0]!.length).toBe(5);
    });

    it('should produce different runs with different seeds', async () => {
      const randomValues: number[][] = [[], []];
      let runIndex = 0;

      (processTurn as ReturnType<typeof vi.fn>).mockImplementation((_state: GameState) => {
        randomValues[runIndex]!.push(Math.random());
        return makeTurnResult();
      });

      runIndex = 0;
      await runHeadless(makeState(), { maxTurns: 5, seed: 42 });
      runIndex = 1;
      await runHeadless(makeState(), { maxTurns: 5, seed: 999 });

      expect(randomValues[0]).not.toEqual(randomValues[1]);
    });

    it('should restore Math.random after run', async () => {
      const original = Math.random;
      await runHeadless(makeState(), { maxTurns: 1, seed: 123 });
      expect(Math.random).toBe(original);
    });

    it('should restore Math.random even on error', async () => {
      const original = Math.random;
      (processTurn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('boom');
      });
      const result = await runHeadless(makeState(), { maxTurns: 1, seed: 123 });
      expect(Math.random).toBe(original);
      expect(result.status).toBe('error');
    });

    it('should record seed in result', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 1, seed: 42 });
      expect(result.seed).toBe(42);
    });
  });

  // ── Game over ──────────────────────────────────────────────────────────

  describe('game over', () => {
    it('should stop early on gameOver', async () => {
      let call = 0;
      (processTurn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        call++;
        return makeTurnResult({
          gameOver: call >= 3,
          gameOverReason: call >= 3 ? 'US achieves economic hegemony' : null,
        });
      });

      const result = await runHeadless(makeState(), { maxTurns: 10 });
      expect(result.turnsSimulated).toBe(3);
      expect(result.gameOverReason).toBe('US achieves economic hegemony');
      expect(result.finalState.gameOver).toBe(true);
    });

    it('should return null gameOverReason when no game over', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 3 });
      expect(result.gameOverReason).toBeNull();
    });
  });

  // ── Abort signal ───────────────────────────────────────────────────────

  describe('abort signal', () => {
    it('should abort when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await runHeadless(makeState(), { maxTurns: 10, signal: controller.signal });
      expect(result.status).toBe('aborted');
      expect(result.turnsSimulated).toBe(0);
    });

    it('should abort mid-execution', async () => {
      const controller = new AbortController();
      let call = 0;
      (processTurn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        call++;
        if (call === 3) controller.abort();
        return makeTurnResult();
      });

      // Use accelerated speed so the abort fires during delay
      const result = await runHeadless(makeState(), { maxTurns: 10, speed: 'accelerated', signal: controller.signal });
      expect(result.status).toBe('aborted');
      expect(result.turnsSimulated).toBeLessThan(10);
    });
  });

  // ── Turn snapshots & stats ─────────────────────────────────────────────

  describe('snapshots and stats', () => {
    it('should collect TurnSnapshot for each turn', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 3 });
      expect(result.eventLog).toHaveLength(3);
      const snap: TurnSnapshot = result.eventLog[0]!;
      expect(snap.turn).toBe(1);
      expect(snap.timestamp).toBeGreaterThan(0);
      expect(snap.headlines).toBeDefined();
      expect(snap.nationStates).toBeDefined();
      expect(snap.relationshipMatrix).toBeDefined();
    });

    it('should collect TurnStatEntry for each turn', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 3 });
      expect(result.turnStats).toHaveLength(3);
      const stat: TurnStatEntry = result.turnStats[0]!;
      expect(stat.turn).toBe(1);
      expect(stat.gdpByFaction).toBeDefined();
      expect(stat.militaryByFaction).toBeDefined();
      expect(stat.stabilityByFaction).toBeDefined();
      expect(typeof stat.maxTension).toBe('number');
      expect(typeof stat.headlineCount).toBe('number');
    });

    it('should deep clone state in snapshots to prevent mutation', async () => {
      const state = makeState();
      const result = await runHeadless(state, { maxTurns: 2 });
      const first = result.eventLog[0]!;
      const second = result.eventLog[1]!;
      expect(first.nationStates).not.toBe(second.nationStates);
    });
  });

  // ── Callbacks ──────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onProgress each turn', async () => {
      const progress = vi.fn();
      await runHeadless(makeState(), { maxTurns: 5 }, undefined, progress);
      expect(progress).toHaveBeenCalledTimes(5);
      expect(progress).toHaveBeenCalledWith(1, 5);
      expect(progress).toHaveBeenCalledWith(5, 5);
    });

    it('should call onDecision in manual mode', async () => {
      const decision = vi.fn();
      await runHeadless(makeState(), { maxTurns: 3, mode: 'manual' }, decision);
      expect(decision).toHaveBeenCalledTimes(3);
      expect(decision).toHaveBeenCalledWith(expect.any(Object), 1);
    });

    it('should not call onDecision in autonomous mode', async () => {
      const decision = vi.fn();
      await runHeadless(makeState(), { maxTurns: 3, mode: 'autonomous' }, decision);
      expect(decision).not.toHaveBeenCalled();
    });

    it('should not call onDecision when no mode specified (defaults autonomous)', async () => {
      const decision = vi.fn();
      await runHeadless(makeState(), { maxTurns: 3 }, decision);
      expect(decision).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should return error status on unhandled exception', async () => {
      (processTurn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Engine failure');
      });
      const result = await runHeadless(makeState(), { maxTurns: 5 });
      expect(result.status).toBe('error');
      expect(result.error).toBe('Engine failure');
    });

    it('should have partial results on mid-run error', async () => {
      let call = 0;
      (processTurn as ReturnType<typeof vi.fn>).mockImplementation(() => {
        call++;
        if (call === 4) throw new Error('Mid-run failure');
        return makeTurnResult();
      });
      const result = await runHeadless(makeState(), { maxTurns: 10 });
      expect(result.status).toBe('error');
      expect(result.turnsSimulated).toBe(3);
      expect(result.eventLog).toHaveLength(3);
    });
  });

  // ── State mutation ─────────────────────────────────────────────────────

  describe('state mutation', () => {
    it('should advance currentTurn each iteration', async () => {
      const result = await runHeadless(makeState(), { maxTurns: 5 });
      expect(result.finalState.currentTurn).toBe(6); // after 5 turns: turns 1-5 → currentTurn becomes 6
    });

    it('should set gameOver and gameEndReason on game over', async () => {
      (processTurn as ReturnType<typeof vi.fn>).mockReturnValue(
        makeTurnResult({ gameOver: true, gameOverReason: 'test reason' }),
      );
      const result = await runHeadless(makeState(), { maxTurns: 3 });
      expect(result.finalState.gameOver).toBe(true);
      expect(result.finalState.gameEndReason).toBe('test reason');
    });

    it('should not mutate the original state', async () => {
      const state = makeState();
      const originalTurn = state.currentTurn;
      await runHeadless(state, { maxTurns: 5 });
      expect(state.currentTurn).toBe(originalTurn);
    });
  });

  // ── Speed modes ────────────────────────────────────────────────────────

  describe('speed modes', () => {
    it('should run instant with no delay', async () => {
      const start = Date.now();
      await runHeadless(makeState(), { maxTurns: 5, speed: 'instant' });
      expect(Date.now() - start).toBeLessThan(200);
    });
  });
});
