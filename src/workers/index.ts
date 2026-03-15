/**
 * Workers barrel export — CNFL-0102
 *
 * Re-exports the message protocol types and the main-thread
 * {@link SimulationBridge} class.
 *
 * The worker script (`simulation.worker.ts`) is NOT re-exported here —
 * it is loaded at runtime via `new URL(...)` inside {@link SimulationBridge}.
 */

// ── Protocol: runtime values ────────────────────────────────────────────────
export { TurnPhase, ALL_TURN_PHASES } from './protocol';

// ── Protocol: type-only exports ─────────────────────────────────────────────
export type {
  PlayerAction,
  TurnLogEntry,
  WhatIfPrediction,
  InitMessage,
  ProcessTurnMessage,
  WhatIfMessage,
  CancelMessage,
  SimWorkerMessage,
  InitAckResponse,
  TurnResultResponse,
  WhatIfResultResponse,
  ProgressResponse,
  ErrorResponse,
  SimWorkerResponse,
} from './protocol';

// ── Bridge class ────────────────────────────────────────────────────────────
export { SimulationBridge } from './simulation-bridge';

export type { TurnResult, WorkerError } from './simulation-bridge';
