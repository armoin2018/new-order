/**
 * Worker Message Protocol — CNFL-0102
 *
 * Discriminated-union types for main ↔ worker communication.
 * All messages flow through `postMessage` / `onmessage` and are
 * serialized via the structured clone algorithm.
 *
 * @see FR-102  — Turn Phase Sequence
 * @see NFR-101 — Full Global Turn must execute in under 500 ms
 */

import type { GameState } from '@/data/types/gamestate.types';
import type { FactionId, ActionId } from '@/data/types/enums';

// ---------------------------------------------------------------------------
// Turn Phases (FR-102)
// ---------------------------------------------------------------------------

/**
 * Ordered phases within a single game turn.
 * Progress is reported per-phase via `PROGRESS` messages.
 *
 * @see FR-102 — Turn Phase Sequence
 */
export const TurnPhase = {
  Headlines: 'HEADLINES',
  PlayerActions: 'PLAYER_ACTIONS',
  AiEvaluation: 'AI_EVALUATION',
  ConflictResolution: 'CONFLICT_RESOLUTION',
  WorldStateUpdate: 'WORLD_STATE_UPDATE',
  EndOfTurnEvents: 'END_OF_TURN_EVENTS',
} as const;

export type TurnPhase = (typeof TurnPhase)[keyof typeof TurnPhase];

/** Ordered tuple of all turn phases — useful for sequential iteration. */
export const ALL_TURN_PHASES: readonly TurnPhase[] = [
  TurnPhase.Headlines,
  TurnPhase.PlayerActions,
  TurnPhase.AiEvaluation,
  TurnPhase.ConflictResolution,
  TurnPhase.WorldStateUpdate,
  TurnPhase.EndOfTurnEvents,
] as const;

// ---------------------------------------------------------------------------
// Supporting Interfaces
// ---------------------------------------------------------------------------

/**
 * A player-submitted action for a given turn.
 * Stub interface — will be expanded as game-play systems are implemented.
 *
 * @see DR-116 — Action-Outcome Prediction Cache
 */
export interface PlayerAction {
  /** Unique identifier for this action. */
  readonly id: ActionId;
  /** Action category (e.g. 'DIPLOMATIC', 'MILITARY', 'ECONOMIC'). */
  readonly type: string;
  /** Faction performing the action. */
  readonly factionId: FactionId;
  /** Target faction, if applicable. */
  readonly targetFactionId?: FactionId;
  /** Action-specific parameters. */
  readonly params: Record<string, unknown>;
}

/**
 * A single entry in the turn-processing log.
 * Records what happened during each phase of a turn.
 */
export interface TurnLogEntry {
  /** Which phase produced this log entry. */
  readonly phase: TurnPhase;
  /** Human-readable description of what occurred. */
  readonly description: string;
  /** ISO-8601 timestamp of when the event was processed. */
  readonly timestamp: string;
}

/**
 * Prediction result from a what-if simulation.
 *
 * @see DR-116 — Action-Outcome Prediction Cache
 */
export interface WhatIfPrediction {
  /** The action that was evaluated. */
  readonly actionId: ActionId;
  /** Predicted outcome description. */
  readonly predictedOutcome: string;
  /** Confidence level 0–1. */
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Main → Worker Messages  (SimWorkerMessage)
// ---------------------------------------------------------------------------

/** Initialize the worker with a full game-state snapshot. */
export interface InitMessage {
  readonly type: 'INIT';
  readonly payload: { readonly gameState: GameState };
}

/** Process a complete turn with the given player actions. */
export interface ProcessTurnMessage {
  readonly type: 'PROCESS_TURN';
  readonly payload: {
    readonly gameState: GameState;
    readonly playerActions: readonly PlayerAction[];
  };
}

/**
 * Run a what-if simulation without modifying the real game state.
 *
 * @see DR-116 — Action-Outcome Prediction Cache
 */
export interface WhatIfMessage {
  readonly type: 'WHAT_IF';
  readonly payload: {
    readonly gameState: GameState;
    readonly hypotheticalActions: readonly PlayerAction[];
  };
}

/** Cancel the current in-progress computation. */
export interface CancelMessage {
  readonly type: 'CANCEL';
}

/**
 * Discriminated union of all messages sent from the main thread to the worker.
 * Discriminant field: `type`.
 */
export type SimWorkerMessage =
  | InitMessage
  | ProcessTurnMessage
  | WhatIfMessage
  | CancelMessage;

// ---------------------------------------------------------------------------
// Worker → Main Messages  (SimWorkerResponse)
// ---------------------------------------------------------------------------

/** Acknowledgement that the worker has initialized successfully. */
export interface InitAckResponse {
  readonly type: 'INIT_ACK';
  readonly payload: { readonly ready: true };
}

/** Complete result of turn processing. */
export interface TurnResultResponse {
  readonly type: 'TURN_RESULT';
  readonly payload: {
    readonly gameState: GameState;
    readonly turnLog: readonly TurnLogEntry[];
  };
}

/** Result of a what-if simulation. */
export interface WhatIfResultResponse {
  readonly type: 'WHAT_IF_RESULT';
  readonly payload: { readonly predictions: readonly WhatIfPrediction[] };
}

/**
 * Progress update during turn processing.
 * Sent once per phase to allow UI progress indicators.
 *
 * @see NFR-101 — 500 ms turn budget
 */
export interface ProgressResponse {
  readonly type: 'PROGRESS';
  readonly payload: {
    readonly phase: TurnPhase;
    /** Completion fraction 0–1. */
    readonly progress: number;
  };
}

/** Error reported by the worker. */
export interface ErrorResponse {
  readonly type: 'ERROR';
  readonly payload: {
    readonly code: string;
    readonly message: string;
    readonly recoverable: boolean;
  };
}

/**
 * Discriminated union of all messages sent from the worker to the main thread.
 * Discriminant field: `type`.
 */
export type SimWorkerResponse =
  | InitAckResponse
  | TurnResultResponse
  | WhatIfResultResponse
  | ProgressResponse
  | ErrorResponse;
