/**
 * Simulation Bridge — CNFL-0102
 *
 * Main-thread bridge class that wraps the Web Worker in a promise-based API.
 * Handles request/response correlation, timeout enforcement, progress
 * callbacks, and error propagation.
 *
 * @see NFR-101 — Full Global Turn must execute in under 500 ms
 * @see §8.1   — Architecture: React UI ↔ Worker communication via postMessage
 */

import type { GameState } from '@/data/types/gamestate.types';
import type {
  SimWorkerMessage,
  SimWorkerResponse,
  PlayerAction,
  TurnLogEntry,
  WhatIfPrediction,
  TurnPhase,
} from './protocol';

// ---------------------------------------------------------------------------
// Public result / error types
// ---------------------------------------------------------------------------

/**
 * Resolved value of a successful `processTurn` call.
 *
 * @see FR-102 — Turn Phase Sequence
 */
export interface TurnResult {
  readonly gameState: GameState;
  readonly turnLog: readonly TurnLogEntry[];
}

/**
 * Structured error surfaced by the worker or the bridge itself.
 */
export interface WorkerError {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Bookkeeping for an in-flight request awaiting a worker response. */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Default timeout for worker responses (ms).
 * 10× the NFR-101 budget of 500 ms gives a generous safety margin.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// SimulationBridge
// ---------------------------------------------------------------------------

/**
 * Promise-based bridge between the main (UI) thread and the
 * simulation Web Worker.
 *
 * Only ONE request per type (`INIT`, `PROCESS_TURN`, `WHAT_IF`) may be
 * in flight at a time — subsequent calls will overwrite the pending
 * promise for that key.
 *
 * @example
 * ```ts
 * const bridge = new SimulationBridge();
 * bridge.onProgress((phase, pct) => console.log(phase, pct));
 * await bridge.initialize(gameState);
 * const result = await bridge.processTurn(gameState, playerActions);
 * ```
 *
 * @see §8.1 — Architecture diagram
 */
export class SimulationBridge {
  /** Underlying Web Worker instance. */
  private readonly worker: Worker;

  /** Timeout (ms) applied to every pending request. */
  private readonly timeout: number;

  /** Map of in-flight requests keyed by the *request* message type. */
  private readonly pending = new Map<string, PendingRequest>();

  /** Optional callback invoked on each PROGRESS message from the worker. */
  private progressCallback:
    | ((phase: TurnPhase, progress: number) => void)
    | null = null;

  /** Optional callback invoked on each ERROR message from the worker. */
  private errorCallback: ((error: WorkerError) => void) | null = null;

  /**
   * Create a new bridge and spawn the simulation worker.
   *
   * @param timeout - Maximum milliseconds to wait for a worker response.
   *                  Defaults to {@link DEFAULT_TIMEOUT_MS} (5 000 ms).
   */
  constructor(timeout: number = DEFAULT_TIMEOUT_MS) {
    this.timeout = timeout;
    this.worker = new Worker(
      new URL('./simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleWorkerErrorEvent.bind(this);
    this.worker.onmessageerror = this.handleMessageErrorEvent.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Send the full game state to the worker and wait for initialization.
   *
   * @param gameState - Complete {@link GameState} snapshot.
   * @returns Resolves when the worker acknowledges (`INIT_ACK`).
   */
  async initialize(gameState: GameState): Promise<void> {
    const promise = this.createPendingRequest<void>('INIT');
    this.send({ type: 'INIT', payload: { gameState } });
    return promise;
  }

  /**
   * Execute a full turn on the worker and retrieve the updated state.
   *
   * @param gameState     - Current {@link GameState} snapshot.
   * @param playerActions - Actions submitted by the player this turn.
   * @returns Resolves with the new state and a turn log.
   *
   * @see FR-102  — Turn Phase Sequence
   * @see NFR-101 — 500 ms budget
   */
  async processTurn(
    gameState: GameState,
    playerActions: PlayerAction[],
  ): Promise<TurnResult> {
    const promise = this.createPendingRequest<TurnResult>('PROCESS_TURN');
    this.send({
      type: 'PROCESS_TURN',
      payload: { gameState, playerActions },
    });
    return promise;
  }

  /**
   * Run a what-if simulation without modifying real game state.
   *
   * @param gameState - Current {@link GameState} snapshot.
   * @param actions   - Hypothetical actions to evaluate.
   * @returns Resolves with an array of {@link WhatIfPrediction} items.
   *
   * @see DR-116 — Action-Outcome Prediction Cache
   */
  async whatIf(
    gameState: GameState,
    actions: PlayerAction[],
  ): Promise<WhatIfPrediction[]> {
    const promise = this.createPendingRequest<WhatIfPrediction[]>('WHAT_IF');
    this.send({
      type: 'WHAT_IF',
      payload: { gameState, hypotheticalActions: actions },
    });
    return promise;
  }

  /**
   * Request cancellation of the current in-progress computation.
   * Fire-and-forget — the worker will check the flag between phases.
   */
  cancel(): void {
    this.send({ type: 'CANCEL' });
  }

  /**
   * Terminate the worker and reject any pending promises.
   * The bridge instance is unusable after this call.
   */
  terminate(): void {
    this.rejectAllPending({
      code: 'WORKER_TERMINATED',
      message: 'Worker was terminated by the host.',
      recoverable: false,
    });
    this.worker.terminate();
  }

  /**
   * Register a callback that fires on each `PROGRESS` message
   * emitted during turn processing.
   *
   * @param callback - Receives the current {@link TurnPhase} and a 0–1
   *                   completion fraction.
   */
  onProgress(callback: (phase: TurnPhase, progress: number) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Register a callback that fires whenever the worker reports an error.
   *
   * @param callback - Receives a structured {@link WorkerError}.
   */
  onError(callback: (error: WorkerError) => void): void {
    this.errorCallback = callback;
  }

  // -----------------------------------------------------------------------
  // Internal — message handling
  // -----------------------------------------------------------------------

  /** Dispatch an incoming worker response to the appropriate handler. */
  private handleMessage(event: MessageEvent): void {
    const msg = event.data as SimWorkerResponse;

    switch (msg.type) {
      case 'INIT_ACK':
        this.resolvePending('INIT', undefined);
        break;

      case 'TURN_RESULT':
        this.resolvePending('PROCESS_TURN', {
          gameState: msg.payload.gameState,
          turnLog: msg.payload.turnLog,
        } satisfies TurnResult);
        break;

      case 'WHAT_IF_RESULT':
        this.resolvePending('WHAT_IF', msg.payload.predictions);
        break;

      case 'PROGRESS':
        this.progressCallback?.(msg.payload.phase, msg.payload.progress);
        break;

      case 'ERROR':
        this.handleProtocolError(msg.payload);
        break;

      default: {
        // Forward-compatible: silently ignore unknown response types.
        const _exhaustive: never = msg;
        void _exhaustive;
      }
    }
  }

  /** Handle the native `error` event from the Worker object. */
  private handleWorkerErrorEvent(event: ErrorEvent): void {
    const error: WorkerError = {
      code: 'WORKER_ERROR',
      message: event.message || 'Unknown worker error',
      recoverable: false,
    };
    this.errorCallback?.(error);
    this.rejectAllPending(error);
  }

  /** Handle `messageerror` (deserialization failure). */
  private handleMessageErrorEvent(): void {
    const error: WorkerError = {
      code: 'MESSAGE_DESERIALIZE_ERROR',
      message: 'Failed to deserialize worker message.',
      recoverable: false,
    };
    this.errorCallback?.(error);
    this.rejectAllPending(error);
  }

  /**
   * Handle an `ERROR` response from the protocol.
   * Notifies the error callback and rejects all pending requests.
   */
  private handleProtocolError(payload: WorkerError): void {
    this.errorCallback?.(payload);
    this.rejectAllPending(payload);
  }

  // -----------------------------------------------------------------------
  // Internal — pending-promise bookkeeping
  // -----------------------------------------------------------------------

  /**
   * Create a pending promise for a given request key and start a timeout.
   *
   * @param key - The *request* message type (`'INIT'`, `'PROCESS_TURN'`, `'WHAT_IF'`).
   * @returns A promise that resolves/rejects when the worker responds or the timeout fires.
   */
  private createPendingRequest<T>(key: string): Promise<T> {
    // Clean up any stale request for the same key.
    const existing = this.pending.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.reject(
        new Error(`Superseded by a new '${key}' request.`),
      );
      this.pending.delete(key);
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        reject(new Error(`Worker request '${key}' timed out after ${this.timeout} ms.`));
      }, this.timeout);

      this.pending.set(key, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
    });
  }

  /** Resolve a pending request and clean up its timeout. */
  private resolvePending(key: string, value: unknown): void {
    const request = this.pending.get(key);
    if (request) {
      clearTimeout(request.timer);
      this.pending.delete(key);
      request.resolve(value);
    }
  }

  /** Reject ALL pending requests with the same reason and clear the map. */
  private rejectAllPending(reason: unknown): void {
    for (const [, request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(reason);
    }
    this.pending.clear();
  }

  /** Send a message to the worker. */
  private send(message: SimWorkerMessage): void {
    this.worker.postMessage(message);
  }
}
