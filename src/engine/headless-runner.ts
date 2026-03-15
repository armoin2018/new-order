/**
 * CNFL-3900 — Headless Game Runner
 *
 * Executes the full game loop without UI rendering.
 * Accepts scenario definition, execution config, and an optional decision callback.
 * Runs game-controller.ts `processTurn` in a loop collecting all state transitions,
 * events, per-turn stats, and final results.
 *
 * Supports deterministic execution via seeded PRNG (replacing Math.random).
 * Can run in Node.js environment (no DOM dependency).
 */

import type { GameState, FactionId, TurnNumber } from '@/data/types';
import type { TurnProcessingResult, TurnHeadline } from './game-controller';
import { processTurn } from './game-controller';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExecutionMode = 'autonomous' | 'manual';
export type ExecutionSpeed = 'instant' | 'accelerated' | 'realtime';

export interface HeadlessRunConfig {
  /** Total turns to simulate. Defaults to scenarioMeta.maxTurns. */
  maxTurns?: number;
  /** Execution mode: autonomous (all AI) or manual (callback for player). */
  mode?: ExecutionMode;
  /** Execution speed (only affects delay between turns). */
  speed?: ExecutionSpeed;
  /** Seed for deterministic PRNG. If undefined, uses Math.random. */
  seed?: number;
  /** Which faction is the player faction for manual mode. */
  playerFaction?: FactionId;
  /** Abort signal to cancel execution. */
  signal?: AbortSignal;
}

export interface TurnSnapshot {
  turn: number;
  timestamp: number;
  nationStates: GameState['nationStates'];
  relationshipMatrix: GameState['relationshipMatrix'];
  headlines: TurnHeadline[];
  aiActions: string[];
  stateChanges: string[];
}

export interface HeadlessRunResult {
  /** Whether the run completed or was aborted. */
  status: 'completed' | 'aborted' | 'error';
  /** Final game state after all turns. */
  finalState: GameState;
  /** Complete event log across all turns. */
  eventLog: TurnSnapshot[];
  /** Per-turn statistics. */
  turnStats: TurnStatEntry[];
  /** Total turns actually simulated. */
  turnsSimulated: number;
  /** Game-over reason if game ended early. */
  gameOverReason: string | null;
  /** Elapsed wall-clock time in ms. */
  elapsedMs: number;
  /** Seed used for this run (for reproducibility). */
  seed: number | null;
  /** Error message if status is 'error'. */
  error?: string;
}

export interface TurnStatEntry {
  turn: number;
  /** GDP per faction this turn. */
  gdpByFaction: Record<string, number>;
  /** Military readiness per faction. */
  militaryByFaction: Record<string, number>;
  /** Stability per faction. */
  stabilityByFaction: Record<string, number>;
  /** Max tension this turn. */
  maxTension: number;
  /** Number of headlines generated. */
  headlineCount: number;
}

export type DecisionCallback = (
  state: GameState,
  turn: number,
) => Promise<void> | void;

export type ProgressCallback = (turn: number, total: number) => void;

// ─── Seeded PRNG (mulberry32) ───────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Speed delay ────────────────────────────────────────────────────────────

const SPEED_DELAY: Record<ExecutionSpeed, number> = {
  instant: 0,
  accelerated: 50,
  realtime: 1000,
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

// ─── Headless Runner ────────────────────────────────────────────────────────

export async function runHeadless(
  initialState: GameState,
  config: HeadlessRunConfig = {},
  onDecision?: DecisionCallback,
  onProgress?: ProgressCallback,
): Promise<HeadlessRunResult> {
  const startTime = Date.now();
  const maxTurns = config.maxTurns ?? initialState.scenarioMeta.maxTurns ?? 60;
  const speed = config.speed ?? 'instant';
  const seed = config.seed ?? null;
  const signal = config.signal;

  // Install seeded PRNG if seed provided
  const originalRandom = Math.random;
  if (seed !== null) {
    const prng = mulberry32(seed);
    Math.random = prng;
  }

  const eventLog: TurnSnapshot[] = [];
  const turnStats: TurnStatEntry[] = [];
  let state = structuredClone(initialState);
  let turnsSimulated = 0;
  let status: HeadlessRunResult['status'] = 'completed';
  let error: string | undefined;

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      // Check abort
      if (signal?.aborted) {
        status = 'aborted';
        break;
      }

      // Manual mode: call decision callback for player faction
      if (config.mode === 'manual' && onDecision) {
        await onDecision(state, turn);
      }

      // Process turn (AI factions, economics, victory checks)
      const result: TurnProcessingResult = processTurn(state);

      // Apply state changes from processTurn
      // processTurn mutates copies internally and returns results,
      // but the actual state mutations are applied here
      state = applyTurnResult(state, result, turn);

      // Collect snapshot
      eventLog.push({
        turn,
        timestamp: Date.now(),
        nationStates: structuredClone(state.nationStates),
        relationshipMatrix: structuredClone(state.relationshipMatrix),
        headlines: result.headlines,
        aiActions: result.aiActions,
        stateChanges: result.stateChanges,
      });

      // Collect stats
      turnStats.push(collectTurnStats(state, result, turn));
      turnsSimulated = turn;

      // Progress callback
      onProgress?.(turn, maxTurns);

      // Check game over
      if (result.gameOver) {
        state.gameOver = true;
        state.gameEndReason = result.gameOverReason;
        break;
      }

      // Speed delay
      await delay(SPEED_DELAY[speed], signal);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      status = 'aborted';
    } else {
      status = 'error';
      error = (err as Error).message;
    }
  } finally {
    // Restore Math.random
    if (seed !== null) {
      Math.random = originalRandom;
    }
  }

  return {
    status,
    finalState: state,
    eventLog,
    turnStats,
    turnsSimulated,
    gameOverReason: state.gameEndReason,
    elapsedMs: Date.now() - startTime,
    seed,
    error,
  };
}

// ─── Apply turn result to state ─────────────────────────────────────────────

function applyTurnResult(
  state: GameState,
  result: TurnProcessingResult,
  turn: number,
): GameState {
  const next = structuredClone(state);
  next.currentTurn = (turn + 1) as TurnNumber;

  // Append headlines (best-effort — structure may differ from HeadlineArchive)
  if (next.headlineArchive && Array.isArray(next.headlineArchive)) {
    for (const h of result.headlines) {
      (next.headlineArchive as unknown as Array<unknown>).push({ ...h, turn });
    }
  }

  // Append to event log
  if (next.eventLog && Array.isArray(next.eventLog)) {
    for (const action of result.aiActions) {
      next.eventLog.push({
        turn,
        type: 'ai_action',
        description: action,
        timestamp: Date.now(),
      } as never);
    }
  }

  // Game over
  if (result.gameOver) {
    next.gameOver = true;
    next.gameEndReason = result.gameOverReason;
  }

  return next;
}

// ─── Turn stat collection ───────────────────────────────────────────────────

function collectTurnStats(
  state: GameState,
  result: TurnProcessingResult,
  turn: number,
): TurnStatEntry {
  const gdpByFaction: Record<string, number> = {};
  const militaryByFaction: Record<string, number> = {};
  const stabilityByFaction: Record<string, number> = {};
  let maxTension = 0;

  for (const [fid, ns] of Object.entries(state.nationStates)) {
    gdpByFaction[fid] = ns.gdp ?? 0;
    militaryByFaction[fid] = ns.militaryReadiness ?? 0;
    stabilityByFaction[fid] = ns.stability ?? 0;
  }

  // Find max tension
  for (const a of Object.keys(state.relationshipMatrix)) {
    const row = state.relationshipMatrix[a as FactionId];
    if (!row) continue;
    for (const b of Object.keys(row)) {
      const t = (row as Record<string, number>)[b] ?? 0;
      if (t > maxTension) maxTension = t;
    }
  }

  return {
    turn,
    gdpByFaction,
    militaryByFaction,
    stabilityByFaction,
    maxTension,
    headlineCount: result.headlines.length,
  };
}
