/**
 * Simulation Engine Web Worker — CNFL-0102
 *
 * Hosts the New Order simulation engine OFF the main thread.
 * Currently a stub — actual engine logic (AI, combat, trade, etc.)
 * will be plugged in by later stories.
 *
 * Communication uses the discriminated-union message protocol
 * defined in `protocol.ts`.
 *
 * IMPORTANT: This file must NOT import React, Zustand, or any UI code.
 *
 * @see NFR-101 — Full Global Turn must execute in under 500 ms
 * @see §8.1   — Architecture: Worker Thread hosts Simulation Engine Core
 */

import type { GameState } from '@/data/types/gamestate.types';
import { TurnPhase } from './protocol';
import type {
  SimWorkerMessage,
  SimWorkerResponse,
  PlayerAction,
  WhatIfPrediction,
} from './protocol';
import { TurnEngine } from '@/engine/turn-engine';

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

/** TurnEngine instance — created on INIT from the game's random seed. */
let turnEngine: TurnEngine | null = null;

/** Abort flag — set by CANCEL, checked between phases during processing. */
let abortRequested = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type-safe wrapper around `self.postMessage` for worker responses.
 *
 * The project tsconfig includes the DOM lib (not WebWorker), so `self`
 * is typed as `Window`.  At runtime this executes inside a
 * `DedicatedWorkerGlobalScope` — the signatures we use (`onmessage`,
 * single-arg `postMessage`) are compatible with both typings.
 */
function respond(message: SimWorkerResponse): void {
  self.postMessage(message);
}

/** Send an ERROR response to the main thread. */
function respondError(
  code: string,
  message: string,
  recoverable: boolean,
): void {
  respond({ type: 'ERROR', payload: { code, message, recoverable } });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

/**
 * Main message handler — dispatches on the discriminated `type` field.
 */
self.onmessage = (event: MessageEvent<SimWorkerMessage>): void => {
  const msg = event.data;

  switch (msg.type) {
    case 'INIT':
      handleInit(msg.payload.gameState);
      break;

    case 'PROCESS_TURN':
      handleProcessTurn(msg.payload.gameState, msg.payload.playerActions);
      break;

    case 'WHAT_IF':
      handleWhatIf(msg.payload.gameState, msg.payload.hypotheticalActions);
      break;

    case 'CANCEL':
      handleCancel();
      break;

    default: {
      // Exhaustive check — TypeScript ensures every case is handled.
      const _exhaustive: never = msg;
      respondError(
        'UNKNOWN_MESSAGE',
        `Unknown message type: ${String((_exhaustive as SimWorkerMessage).type)}`,
        true,
      );
    }
  }
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Initialize the worker with a full game-state snapshot.
 * Creates a TurnEngine from the game's random seed and acknowledges readiness.
 *
 * @see FR-101  — Discrete turns
 * @see NFR-402 — Deterministic given same seed
 */
function handleInit(gameState: GameState): void {
  try {
    turnEngine = new TurnEngine({ seed: gameState.randomSeed });
    respond({ type: 'INIT_ACK', payload: { ready: true } });
  } catch (err: unknown) {
    respondError(
      'INIT_FAILED',
      err instanceof Error ? err.message : 'Unknown initialization error',
      false,
    );
  }
}

/**
 * Process a complete game turn via the TurnEngine.
 *
 * Delegates to {@link TurnEngine.processTurn} which executes all 6 phases
 * in FR-102 order. Progress is reported per-phase via PROGRESS messages.
 * Falls back to creating a new TurnEngine if INIT was not called.
 *
 * @see FR-101  — Discrete turns
 * @see FR-102  — Turn Phase Sequence
 * @see NFR-101 — 500 ms turn budget
 * @see NFR-402 — Deterministic given same seed
 * @see NFR-403 — Atomic state transitions
 */
function handleProcessTurn(
  gameState: GameState,
  playerActions: readonly PlayerAction[],
): void {
  try {
    abortRequested = false;

    // Lazily create a TurnEngine if INIT was not called.
    if (turnEngine === null) {
      turnEngine = new TurnEngine({ seed: gameState.randomSeed });
    }

    // Progress callback — emits PROGRESS messages to the main thread
    // and checks the abort flag between phases.
    const onProgress = (phase: typeof TurnPhase[keyof typeof TurnPhase], progress: number): void => {
      if (abortRequested) {
        throw new Error('TURN_CANCELLED');
      }

      respond({
        type: 'PROGRESS',
        payload: { phase, progress },
      });
    };

    const result = turnEngine.processTurn(gameState, playerActions, onProgress);

    respond({
      type: 'TURN_RESULT',
      payload: {
        gameState: result.gameState,
        turnLog: result.turnLog,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown turn processing error';

    if (message === 'TURN_CANCELLED') {
      respondError('TURN_CANCELLED', 'Turn processing was cancelled.', true);
    } else {
      respondError('TURN_FAILED', message, true);
    }
  }
}

/**
 * Run a what-if simulation on a cloned state.
 *
 * **STUB**: Returns an empty predictions array.
 * Real implementation will evaluate hypothetical actions against
 * the Action-Outcome Prediction Cache (DR-116).
 */
function handleWhatIf(
  gameState: GameState,
  hypotheticalActions: readonly PlayerAction[],
): void {
  try {
    // Stub: return a placeholder prediction for each hypothetical action
    // evaluated against the current turn state.
    const predictions: WhatIfPrediction[] = hypotheticalActions.map(action => ({
      actionId: action.id,
      predictedOutcome: `Stub prediction for action ${String(action.id)} at turn ${String(gameState.currentTurn)}.`,
      confidence: 0,
    }));

    respond({
      type: 'WHAT_IF_RESULT',
      payload: { predictions },
    });
  } catch (err: unknown) {
    respondError(
      'WHAT_IF_FAILED',
      err instanceof Error ? err.message : 'Unknown what-if error',
      true,
    );
  }
}

/**
 * Set the abort flag to cancel in-progress processing.
 * The `PROCESS_TURN` handler checks this flag between phases.
 */
function handleCancel(): void {
  abortRequested = true;
}
