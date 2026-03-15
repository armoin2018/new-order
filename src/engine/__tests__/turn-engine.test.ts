import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TurnEngine } from '@/engine/turn-engine';
import type {
  PhaseHandler,
  TurnEngineOptions,
} from '@/engine/turn-engine';
import { TurnPhase, ALL_TURN_PHASES } from '@/workers/protocol';
import type { PlayerAction } from '@/workers/protocol';
import type { GameState } from '@/data/types/gamestate.types';
import type {
  FactionId,
  TurnNumber,
  ActionId,
} from '@/data/types/enums';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Default seed used across determinism tests. */
const TEST_SEED = 42;

/**
 * Create a minimal GameState stub sufficient for TurnEngine tests.
 * Only the fields that TurnEngine reads/writes are populated;
 * all others carry safe defaults.
 */
function createMinimalGameState(
  overrides: Partial<GameState> = {},
): GameState {
  return {
    scenarioMeta: {
      id: 'test',
      name: 'Test',
      version: '0.1.0',
      author: 'test',
      description: 'test',
      maxTurns: 60,
    },
    currentTurn: 1 as TurnNumber,
    playerFaction: 'us' as FactionId,
    randomSeed: TEST_SEED,
    gameOver: false,
    gameEndReason: null,
    relationshipMatrix: {} as GameState['relationshipMatrix'],
    hexMap: {} as GameState['hexMap'],
    unitRegistry: {} as GameState['unitRegistry'],
    nationStates: {} as GameState['nationStates'],
    eventLog: [],
    headlineArchive: [],
    leaderProfiles: {} as GameState['leaderProfiles'],
    intelligenceCapabilities: {} as GameState['intelligenceCapabilities'],
    militaryForceStructures: {} as GameState['militaryForceStructures'],
    geographicPostures: {} as GameState['geographicPostures'],
    civilUnrestComponents: {} as GameState['civilUnrestComponents'],
    nationFaultLines: {} as GameState['nationFaultLines'],
    currentViability: null,
    stateTrendHistory: {} as GameState['stateTrendHistory'],
    actionPredictionCache: {} as GameState['actionPredictionCache'],
    strategicConsistency: null,
    postGameAnalysis: null,
    emotionalStates: {} as GameState['emotionalStates'],
    cognitiveBiasRegistry: {} as GameState['cognitiveBiasRegistry'],
    interpersonalChemistry: {} as GameState['interpersonalChemistry'],
    grudgeLedgers: {} as GameState['grudgeLedgers'],
    massPsychology: {} as GameState['massPsychology'],
    personalityDriftLogs: {} as GameState['personalityDriftLogs'],
    internationalLegitimacy: {} as GameState['internationalLegitimacy'],
    narrativeCampaignLogs: {} as GameState['narrativeCampaignLogs'],
    viralityQueue: {} as GameState['viralityQueue'],
    sanctionsRegistry: {} as GameState['sanctionsRegistry'],
    financialNetworkState: {} as GameState['financialNetworkState'],
    technologyIndices: {} as GameState['technologyIndices'],
    techBlocAlignmentMap: {} as GameState['techBlocAlignmentMap'],
    resourceSecurity: {} as GameState['resourceSecurity'],
    climateEventQueue: {} as GameState['climateEventQueue'],
    refugeeFlowTracker: {} as GameState['refugeeFlowTracker'],
    proxyNetworkGraph: {} as GameState['proxyNetworkGraph'],
    armsBazaarLog: {} as GameState['armsBazaarLog'],
    globalFinancialStability: {} as GameState['globalFinancialStability'],
    dualUseTechAccords: {} as GameState['dualUseTechAccords'],
    mediaEcosystems: {} as GameState['mediaEcosystems'],
    nonStateActorRegistry: {} as GameState['nonStateActorRegistry'],
    ...overrides,
  } as GameState;
}

/** Create a default TurnEngine for tests. */
function createEngine(
  overrides: Partial<TurnEngineOptions> = {},
): TurnEngine {
  return new TurnEngine({ seed: TEST_SEED, ...overrides });
}

/** Create a sample PlayerAction. */
function createAction(
  overrides: Partial<PlayerAction> = {},
): PlayerAction {
  return {
    id: 'act-001' as ActionId,
    type: 'DIPLOMATIC',
    factionId: 'us' as FactionId,
    params: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('TurnEngine', () => {
  let engine: TurnEngine;
  let state: GameState;

  beforeEach(() => {
    engine = createEngine();
    state = createMinimalGameState();
  });

  // ── FR-102: Phase ordering ─────────────────────────────

  describe('phase ordering (FR-102)', () => {
    it('executes all 6 phases in the correct FR-102 order', () => {
      const executedPhases: TurnPhase[] = [];

      for (const phase of ALL_TURN_PHASES) {
        engine.registerHandler(phase, (s) => {
          executedPhases.push(phase);
          return s;
        });
      }

      engine.processTurn(state, []);

      expect(executedPhases).toEqual([
        TurnPhase.Headlines,
        TurnPhase.PlayerActions,
        TurnPhase.AiEvaluation,
        TurnPhase.ConflictResolution,
        TurnPhase.WorldStateUpdate,
        TurnPhase.EndOfTurnEvents,
      ]);
    });

    it('executes exactly 6 phases per turn', () => {
      const phaseCount = vi.fn();

      for (const phase of ALL_TURN_PHASES) {
        engine.registerHandler(phase, (s) => {
          phaseCount();
          return s;
        });
      }

      engine.processTurn(state, []);

      expect(phaseCount).toHaveBeenCalledTimes(6);
    });
  });

  // ── FR-101: Turn counter ───────────────────────────────

  describe('turn counter (FR-101)', () => {
    it('increments currentTurn from N to N+1', () => {
      const initialTurn = 5 as TurnNumber;
      const turnState = createMinimalGameState({ currentTurn: initialTurn });

      const result = engine.processTurn(turnState, []);

      expect(result.gameState.currentTurn).toBe(6);
    });

    it('increments from turn 1 to turn 2', () => {
      const result = engine.processTurn(state, []);

      expect(result.gameState.currentTurn).toBe(2);
    });
  });

  // ── FR-101: Calendar tracking ──────────────────────────

  describe('calendar tracking (FR-101)', () => {
    it('maps turn 1 → March 2026', () => {
      const date = TurnEngine.getCalendarDate(1 as TurnNumber);

      expect(date.month).toBe(3);
      expect(date.year).toBe(2026);
      expect(date.label).toBe('March 2026');
    });

    it('maps turn 10 → December 2026', () => {
      const date = TurnEngine.getCalendarDate(10 as TurnNumber);

      expect(date.month).toBe(12);
      expect(date.year).toBe(2026);
      expect(date.label).toBe('December 2026');
    });

    it('maps turn 11 → January 2027 (year rollover)', () => {
      const date = TurnEngine.getCalendarDate(11 as TurnNumber);

      expect(date.month).toBe(1);
      expect(date.year).toBe(2027);
      expect(date.label).toBe('January 2027');
    });

    it('maps turn 13 → March 2027', () => {
      const date = TurnEngine.getCalendarDate(13 as TurnNumber);

      expect(date.month).toBe(3);
      expect(date.year).toBe(2027);
      expect(date.label).toBe('March 2027');
    });

    it('returns correct calendarDate in TurnResult', () => {
      // Turn 1 → after processing, currentTurn = 2 → April 2026
      const result = engine.processTurn(state, []);

      expect(result.calendarDate.month).toBe(4);
      expect(result.calendarDate.year).toBe(2026);
      expect(result.calendarDate.label).toBe('April 2026');
    });

    it('respects custom config for calendar calculation', () => {
      const customConfig = {
        ...GAME_CONFIG,
        meta: {
          ...GAME_CONFIG.meta,
          STARTING_MONTH: 6,
          STARTING_YEAR: 2030,
        },
      } as unknown as typeof GAME_CONFIG;

      const date = TurnEngine.getCalendarDate(
        1 as TurnNumber,
        customConfig,
      );

      expect(date.month).toBe(6);
      expect(date.year).toBe(2030);
      expect(date.label).toBe('June 2030');
    });
  });

  // ── NFR-402: Determinism ───────────────────────────────

  describe('determinism (NFR-402)', () => {
    it('produces identical output given same seed and state', () => {
      const engine1 = createEngine();
      const engine2 = createEngine();

      const state1 = createMinimalGameState();
      const state2 = createMinimalGameState();

      const result1 = engine1.processTurn(state1, []);
      const result2 = engine2.processTurn(state2, []);

      // GameState should be structurally identical.
      expect(result1.gameState.currentTurn).toBe(
        result2.gameState.currentTurn,
      );
      expect(result1.gameState.gameOver).toBe(result2.gameState.gameOver);
      expect(result1.calendarDate).toEqual(result2.calendarDate);

      // Turn logs should have the same number of entries.
      expect(result1.turnLog.length).toBe(result2.turnLog.length);

      // Phase descriptions should match.
      for (let i = 0; i < result1.turnLog.length; i++) {
        const log1 = result1.turnLog[i];
        const log2 = result2.turnLog[i];
        expect(log1?.phase).toBe(log2?.phase);
        expect(log1?.description).toBe(log2?.description);
      }
    });

    it('produces different output with different seeds', () => {
      const engineA = createEngine({ seed: 100 });
      const engineB = createEngine({ seed: 200 });

      // Register handlers that use the RNG so output diverges.
      const makeRngHandler = (): PhaseHandler => {
        return (s: GameState, ctx) => {
          ctx.rng.next(); // consume RNG value
          return s;
        };
      };

      engineA.registerHandler(TurnPhase.Headlines, makeRngHandler());
      engineB.registerHandler(TurnPhase.Headlines, makeRngHandler());

      const stateA = createMinimalGameState();
      const stateB = createMinimalGameState();

      // After processing, RNG states should differ.
      engineA.processTurn(stateA, []);
      engineB.processTurn(stateB, []);

      const rngStateA = engineA.getState().rngState;
      const rngStateB = engineB.getState().rngState;

      expect(rngStateA.state).not.toBe(rngStateB.state);
    });
  });

  // ── Custom handlers ────────────────────────────────────

  describe('custom phase handlers', () => {
    it('calls a registered custom handler for the correct phase', () => {
      const customHandler = vi.fn(
        (s: GameState) => s,
      );

      engine.registerHandler(TurnPhase.Headlines, customHandler);
      engine.processTurn(state, []);

      expect(customHandler).toHaveBeenCalledTimes(1);
    });

    it('passes player actions through PhaseContext', () => {
      const actions = [
        createAction({ id: 'act-001' as ActionId }),
        createAction({ id: 'act-002' as ActionId }),
      ];

      let receivedActions: readonly PlayerAction[] = [];

      engine.registerHandler(TurnPhase.PlayerActions, (s, ctx) => {
        receivedActions = ctx.playerActions;
        return s;
      });

      engine.processTurn(state, actions);

      expect(receivedActions).toHaveLength(2);
      expect(receivedActions[0]?.id).toBe('act-001');
      expect(receivedActions[1]?.id).toBe('act-002');
    });

    it('registerHandlers registers multiple handlers at once', () => {
      const headlinesHandler = vi.fn(
        (s: GameState) => s,
      );
      const combatHandler = vi.fn(
        (s: GameState) => s,
      );

      engine.registerHandlers({
        [TurnPhase.Headlines]: headlinesHandler,
        [TurnPhase.ConflictResolution]: combatHandler,
      });

      engine.processTurn(state, []);

      expect(headlinesHandler).toHaveBeenCalledTimes(1);
      expect(combatHandler).toHaveBeenCalledTimes(1);
    });

    it('custom handler can modify state', () => {
      engine.registerHandler(TurnPhase.WorldStateUpdate, (s) => {
        return { ...s, gameEndReason: 'CUSTOM_REASON' };
      });

      const result = engine.processTurn(state, []);

      expect(result.gameState.gameEndReason).toBe('CUSTOM_REASON');
    });
  });

  // ── Progress callback ──────────────────────────────────

  describe('progress callback', () => {
    it('fires 6 times with correct phases and increasing progress', () => {
      const progressCalls: Array<{
        phase: TurnPhase;
        progress: number;
      }> = [];

      engine.processTurn(state, [], (phase, progress) => {
        progressCalls.push({ phase, progress });
      });

      expect(progressCalls).toHaveLength(6);

      // Check phases match FR-102 order.
      expect(progressCalls.map((c) => c.phase)).toEqual(
        ALL_TURN_PHASES,
      );

      // Check progress fractions.
      for (const [index, call] of progressCalls.entries()) {
        const expected = (index + 1) / 6;
        expect(call.progress).toBeCloseTo(expected, 5);
      }
    });

    it('last progress value is 1.0', () => {
      let lastProgress = 0;

      engine.processTurn(state, [], (_phase, progress) => {
        lastProgress = progress;
      });

      expect(lastProgress).toBe(1);
    });
  });

  // ── NFR-403: Atomic rollback ───────────────────────────

  describe('atomic rollback (NFR-403)', () => {
    it('preserves original state when a handler throws', () => {
      const originalTurn = state.currentTurn;
      const originalGameOver = state.gameOver;

      // The WorldStateUpdate handler throws.
      engine.registerHandler(TurnPhase.WorldStateUpdate, () => {
        throw new Error('Simulated phase failure');
      });

      expect(() => engine.processTurn(state, [])).toThrow(
        'Simulated phase failure',
      );

      // Original state should be unchanged.
      expect(state.currentTurn).toBe(originalTurn);
      expect(state.gameOver).toBe(originalGameOver);
    });

    it('restores RNG state on failure', () => {
      const rngStateBefore = engine.getState().rngState;

      engine.registerHandler(TurnPhase.ConflictResolution, (_s, ctx) => {
        ctx.rng.next(); // Advance RNG
        throw new Error('Fail after RNG advance');
      });

      expect(() => engine.processTurn(state, [])).toThrow();

      // RNG state should be restored to pre-turn state.
      const rngStateAfter = engine.getState().rngState;
      expect(rngStateAfter.state).toBe(rngStateBefore.state);
      expect(rngStateAfter.callCount).toBe(rngStateBefore.callCount);
    });
  });

  // ── Game over ──────────────────────────────────────────

  describe('game over detection', () => {
    it('sets gameOver when currentTurn exceeds MAX_TURNS', () => {
      const endState = createMinimalGameState({
        currentTurn: GAME_CONFIG.meta.MAX_TURNS as TurnNumber,
      });

      const result = engine.processTurn(endState, []);

      expect(result.gameState.gameOver).toBe(true);
      expect(result.gameState.gameEndReason).toBe('MAX_TURNS_REACHED');
    });

    it('does not set gameOver before MAX_TURNS', () => {
      const midState = createMinimalGameState({
        currentTurn: (GAME_CONFIG.meta.MAX_TURNS - 1) as TurnNumber,
      });

      const result = engine.processTurn(midState, []);

      expect(result.gameState.gameOver).toBe(false);
      expect(result.gameState.gameEndReason).toBeNull();
    });
  });

  // ── Event logging ──────────────────────────────────────

  describe('event logging', () => {
    it('records phase completion entries in the event log', () => {
      engine.processTurn(state, []);

      const snapshot = engine.getState().eventLog;

      // Default stub handlers log 6 phase stubs + 1 TURN_COMPLETED event.
      // Verify at least 6 phase stub entries exist.
      const stubEntries = snapshot.filter((e) =>
        e.actionKey.startsWith('PHASE_STUB_'),
      );
      expect(stubEntries.length).toBe(6);
    });

    it('logs a TURN_COMPLETED system event', () => {
      engine.processTurn(state, []);

      const snapshot = engine.getState().eventLog;
      const completedEntries = snapshot.filter(
        (e) => e.actionKey === 'TURN_COMPLETED',
      );

      expect(completedEntries.length).toBe(1);
      expect(completedEntries[0]?.description).toContain('completed');
    });

    it('produces a turnLog with entries for all 6 phases', () => {
      const result = engine.processTurn(state, []);

      expect(result.turnLog).toHaveLength(6);

      for (const [index, entry] of result.turnLog.entries()) {
        expect(entry.phase).toBe(ALL_TURN_PHASES[index]);
        expect(entry.description).toContain('completed');
        expect(entry.timestamp).toBeTruthy();
      }
    });
  });

  // ── State save/restore ─────────────────────────────────

  describe('state save/restore', () => {
    it('getState/restoreState roundtrip preserves RNG state', () => {
      // Advance RNG by processing a turn.
      engine.processTurn(state, []);

      const saved = engine.getState();

      // Advance RNG further.
      engine.processTurn(
        createMinimalGameState({ currentTurn: 2 as TurnNumber }),
        [],
      );

      // Restore to saved state.
      engine.restoreState(saved);

      const restored = engine.getState();

      expect(restored.rngState.state).toBe(saved.rngState.state);
      expect(restored.rngState.callCount).toBe(saved.rngState.callCount);
      expect(restored.rngState.seed).toBe(saved.rngState.seed);
    });

    it('getState/restoreState roundtrip preserves event log', () => {
      engine.processTurn(state, []);
      const saved = engine.getState();

      const eventCountBefore = saved.eventLog.length;

      // Process another turn (adds more events).
      engine.processTurn(
        createMinimalGameState({ currentTurn: 2 as TurnNumber }),
        [],
      );

      // Restore and verify event count matches the saved state.
      engine.restoreState(saved);
      const restored = engine.getState();

      expect(restored.eventLog.length).toBe(eventCountBefore);
    });

    it('restored engine produces deterministic output', () => {
      engine.processTurn(state, []);
      const saved = engine.getState();

      // Create a second engine, process turn 1, then restore.
      const engine2 = createEngine();
      engine2.processTurn(createMinimalGameState(), []);
      engine2.restoreState(saved);

      // Both engines should now produce identical results for turn 2.
      const state2 = createMinimalGameState({
        currentTurn: 2 as TurnNumber,
      });

      const result1 = engine.processTurn(
        createMinimalGameState({ currentTurn: 2 as TurnNumber }),
        [],
      );
      const result2 = engine2.processTurn(state2, []);

      expect(result1.gameState.currentTurn).toBe(
        result2.gameState.currentTurn,
      );
      expect(result1.calendarDate).toEqual(result2.calendarDate);
    });
  });

  // ── Default stub handlers ──────────────────────────────

  describe('default stub handlers', () => {
    it('all phases have default handlers that pass state through', () => {
      // Should not throw — all phases have stubs.
      const result = engine.processTurn(state, []);

      expect(result.gameState.currentTurn).toBe(2);
    });
  });
});
