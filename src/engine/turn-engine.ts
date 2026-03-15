/**
 * Turn Engine — CNFL-0200
 *
 * Orchestrates the 6-phase turn sequence for New Order.
 * Each turn represents one calendar month. Phase handlers are pluggable —
 * default stubs log completion and pass state through unchanged.
 *
 * This module is React-free and runs inside the Web Worker.
 *
 * @see FR-101  — Game operates in discrete turns, each = one calendar month
 * @see FR-102  — Phases execute in deterministic order
 * @see NFR-402 — Deterministic given same seed + inputs
 * @see NFR-403 — State transitions are atomic (complete or rollback)
 *
 * @module engine/turn-engine
 */

import type { GameState } from '@/data/types/gamestate.types';
import type { TurnNumber } from '@/data/types/enums';
import type { EventLog } from '@/data/types/core.types';
import type { RngState } from './rng';
import type { PlayerAction, TurnLogEntry, TurnPhase } from '@/workers/protocol';
import { ALL_TURN_PHASES } from '@/workers/protocol';
import { SeededRandom } from './rng';
import { EventLogger } from './event-logger';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/**
 * Calendar month names for label generation.
 *
 * @see FR-101
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Context passed to each phase handler, providing access to
 * the deterministic RNG, event logger, player actions, and config.
 *
 * @see FR-102
 * @see NFR-402
 */
export interface PhaseContext {
  /** Deterministic PRNG — all randomness must go through this. */
  readonly rng: SeededRandom;
  /** Append-only event logger for recording game events. */
  readonly logger: EventLogger;
  /** Player-submitted actions for the current turn. */
  readonly playerActions: readonly PlayerAction[];
  /** Game configuration constants. */
  readonly config: typeof GAME_CONFIG;
}

/**
 * A pluggable handler that processes one phase of a turn.
 * Receives the current state (mutable draft) and context,
 * and returns the (potentially modified) state.
 *
 * @see FR-102
 */
export type PhaseHandler = (
  state: GameState,
  context: PhaseContext,
) => GameState;

/**
 * Constructor options for {@link TurnEngine}.
 *
 * @see NFR-402
 */
export interface TurnEngineOptions {
  /** Random seed for deterministic simulation. */
  readonly seed: number;
  /** Optional game configuration override. Defaults to GAME_CONFIG. */
  readonly config?: typeof GAME_CONFIG;
}

/**
 * Serialisable snapshot of the TurnEngine's internal state.
 * Used for save/load functionality.
 *
 * @see NFR-402
 */
export interface TurnEngineState {
  /** Snapshot of the deterministic RNG state. */
  readonly rngState: RngState;
  /** Snapshot of all event log entries. */
  readonly eventLog: EventLog;
}

/**
 * Result returned by {@link TurnEngine.processTurn}.
 *
 * @see FR-101
 * @see FR-102
 */
export interface TurnResult {
  /** The updated game state after all phases have executed. */
  readonly gameState: GameState;
  /** Log entries produced during turn processing. */
  readonly turnLog: TurnLogEntry[];
  /** Calendar date corresponding to the new turn. */
  readonly calendarDate: {
    readonly month: number;
    readonly year: number;
    readonly label: string;
  };
}

/**
 * Calendar date information for a given turn number.
 *
 * @see FR-101
 */
export interface CalendarDate {
  /** Month number (1–12). */
  readonly month: number;
  /** Four-digit year. */
  readonly year: number;
  /** Human-readable label, e.g. "March 2026". */
  readonly label: string;
}

// ─────────────────────────────────────────────────────────
// TurnEngine
// ─────────────────────────────────────────────────────────

/**
 * Core turn orchestrator for New Order.
 *
 * Executes the 6 turn phases in deterministic order, integrates with
 * {@link SeededRandom} and {@link EventLogger}, tracks calendar month/year,
 * and provides atomic rollback on failure.
 *
 * Phase handlers are pluggable — register custom handlers via
 * {@link registerHandler} or {@link registerHandlers}. Default stubs
 * log phase completion as system events and pass state through unchanged.
 *
 * @see FR-101  — Discrete turns, each = one calendar month
 * @see FR-102  — 6 phases in deterministic order
 * @see NFR-402 — Deterministic given same seed + inputs
 * @see NFR-403 — Atomic state transitions
 */
export class TurnEngine {
  /** Deterministic PRNG instance. @see NFR-402 */
  private readonly rng: SeededRandom;

  /** Append-only event logger. @see DR-106 */
  private readonly logger: EventLogger;

  /** Pluggable phase handlers keyed by TurnPhase. @see FR-102 */
  private readonly phaseHandlers: Map<TurnPhase, PhaseHandler>;

  /** Game configuration constants. @see NFR-204 */
  private readonly config: typeof GAME_CONFIG;

  /**
   * Create a new TurnEngine.
   *
   * @param options - Seed and optional configuration override.
   *
   * @see NFR-402
   */
  constructor(options: TurnEngineOptions) {
    this.rng = new SeededRandom(options.seed);
    this.logger = new EventLogger(this.rng);
    this.config = options.config ?? GAME_CONFIG;
    this.phaseHandlers = new Map<TurnPhase, PhaseHandler>();

    // Register default stub handlers for all phases.
    for (const phase of ALL_TURN_PHASES) {
      this.phaseHandlers.set(phase, TurnEngine.createStubHandler(phase));
    }
  }

  // ── Phase registration ─────────────────────────────────

  /**
   * Register a custom handler for a specific turn phase.
   * Replaces any previously registered handler for that phase.
   *
   * @param phase - The turn phase to handle.
   * @param handler - The handler function.
   *
   * @see FR-102
   */
  registerHandler(phase: TurnPhase, handler: PhaseHandler): void {
    this.phaseHandlers.set(phase, handler);
  }

  /**
   * Register multiple phase handlers at once.
   * Partial — only provided phases are updated; others retain their
   * current (or default stub) handler.
   *
   * @param handlers - A partial mapping of phases to handlers.
   *
   * @see FR-102
   */
  registerHandlers(
    handlers: Partial<Record<TurnPhase, PhaseHandler>>,
  ): void {
    for (const phase of ALL_TURN_PHASES) {
      const handler = handlers[phase];
      if (handler !== undefined) {
        this.phaseHandlers.set(phase, handler);
      }
    }
  }

  // ── Turn execution ─────────────────────────────────────

  /**
   * Process a complete game turn through all 6 phases.
   *
   * **Atomicity (NFR-403)**: The state is snapshotted before processing.
   * If any phase handler throws, the original state is preserved and the
   * error is re-thrown.
   *
   * **Determinism (NFR-402)**: All randomness flows through the seeded RNG.
   * Given the same seed, state, and actions, the output is identical.
   *
   * @param state - The current game state.
   * @param playerActions - Actions submitted by the player for this turn.
   * @param onProgress - Optional callback invoked after each phase completes.
   * @returns A {@link TurnResult} containing the updated state and metadata.
   * @throws Re-throws any error from a phase handler after rolling back.
   *
   * @see FR-101  — Discrete turns
   * @see FR-102  — Phase sequence
   * @see NFR-402 — Determinism
   * @see NFR-403 — Atomic rollback
   */
  processTurn(
    state: GameState,
    playerActions: readonly PlayerAction[],
    onProgress?: (phase: TurnPhase, progress: number) => void,
  ): TurnResult {
    // ── Snapshot for atomic rollback (NFR-403) ──────────
    const rngSnapshot = this.rng.getState();
    const logSnapshot = this.logger.getSnapshot();

    const turnLog: TurnLogEntry[] = [];

    try {
      // Build the phase context (shared across all phases in this turn).
      const context: PhaseContext = {
        rng: this.rng,
        logger: this.logger,
        playerActions,
        config: this.config,
      };

      let currentState = structuredClone(state);

      // ── Execute each phase in FR-102 order ──────────
      for (const [index, phase] of ALL_TURN_PHASES.entries()) {
        const handler = this.phaseHandlers.get(phase);
        if (handler === undefined) {
          throw new Error(`No handler registered for phase: ${phase}`);
        }

        currentState = handler(currentState, context);

        // Report progress (fraction 0–1).
        const progress = (index + 1) / ALL_TURN_PHASES.length;
        onProgress?.(phase, progress);

        // Log phase completion.
        turnLog.push({
          phase,
          description: `Phase ${phase} completed.`,
          timestamp: new Date().toISOString(),
        });
      }

      // ── Increment turn counter (FR-101) ─────────────
      const nextTurn = (
        (currentState.currentTurn as number) + 1
      ) as TurnNumber;
      currentState = { ...currentState, currentTurn: nextTurn };

      // ── Check game-over conditions ──────────────────
      if ((nextTurn as number) > this.config.meta.MAX_TURNS) {
        currentState = {
          ...currentState,
          gameOver: true,
          gameEndReason: 'MAX_TURNS_REACHED',
        };
      }

      // ── Log turn completion as a system event ───────
      this.logger.logSystemEvent(
        nextTurn,
        `Turn ${String(nextTurn)} completed.`,
        'TURN_COMPLETED',
      );

      // ── Build calendar date for the new turn ────────
      const calendarDate = TurnEngine.getCalendarDate(nextTurn);

      return {
        gameState: currentState,
        turnLog,
        calendarDate,
      };
    } catch (error: unknown) {
      // ── Atomic rollback (NFR-403) ───────────────────
      // Restore RNG and event log to pre-turn state.
      const restoredRng = SeededRandom.fromState(rngSnapshot);
      this.restoreRngState(restoredRng);
      this.logger.restore(logSnapshot);

      // Re-throw so the caller can handle it.
      // Note: we do NOT log the error via the logger here because
      // the rollback must leave RNG + event log in the exact pre-turn
      // state. The caller is responsible for error reporting.
      throw error;
    }
  }

  // ── Calendar tracking ──────────────────────────────────

  /**
   * Compute the calendar month and year for a given turn number.
   *
   * Turn 1 maps to the scenario's starting month/year (default: March 2026).
   * Each subsequent turn advances one calendar month.
   *
   * @param turnNumber - The 1-indexed turn number.
   * @param config - Optional config override. Defaults to GAME_CONFIG.
   * @returns A {@link CalendarDate} with month, year, and human-readable label.
   *
   * @see FR-101
   */
  static getCalendarDate(
    turnNumber: TurnNumber,
    config: typeof GAME_CONFIG = GAME_CONFIG,
  ): CalendarDate {
    const startMonth = config.meta.STARTING_MONTH;
    const startYear = config.meta.STARTING_YEAR;

    // Zero-based month offset from the start.
    const totalMonths =
      startMonth - 1 + (turnNumber as number) - 1;

    const month = (totalMonths % 12) + 1;
    const year = startYear + Math.floor(totalMonths / 12);
    const monthName = MONTH_NAMES[month - 1] ?? 'Unknown';
    const label = `${monthName} ${String(year)}`;

    return { month, year, label };
  }

  // ── State serialization ────────────────────────────────

  /**
   * Serialise the engine's internal state for persistence.
   *
   * @returns A {@link TurnEngineState} snapshot of the RNG and event log.
   *
   * @see NFR-402
   */
  getState(): TurnEngineState {
    return {
      rngState: this.rng.getState(),
      eventLog: this.logger.getSnapshot(),
    };
  }

  /**
   * Restore the engine's internal state from a previously saved snapshot.
   *
   * @param state - A {@link TurnEngineState} obtained via {@link getState}.
   *
   * @see NFR-402
   */
  restoreState(state: TurnEngineState): void {
    const restoredRng = SeededRandom.fromState(state.rngState);
    this.restoreRngState(restoredRng);
    this.logger.restore(state.eventLog);
  }

  // ── Private helpers ────────────────────────────────────

  /**
   * Create a default stub handler for a phase that logs completion
   * as a system event and returns state unchanged.
   *
   * @param phase - The turn phase this stub handles.
   * @returns A {@link PhaseHandler} that is a pass-through stub.
   */
  private static createStubHandler(phase: TurnPhase): PhaseHandler {
    return (state: GameState, context: PhaseContext): GameState => {
      context.logger.logSystemEvent(
        state.currentTurn,
        `Phase ${phase} completed (stub).`,
        `PHASE_STUB_${phase}`,
      );
      return state;
    };
  }

  /**
   * Copy the internal state of a restored RNG back into our instance.
   *
   * SeededRandom uses private fields, so we restore by creating a new
   * instance from state and copying its serialised values back.
   * This works because `fromState` reconstructs internal state exactly.
   *
   * @param source - A SeededRandom instance at the desired state.
   */
  private restoreRngState(source: SeededRandom): void {
    // We need to mutate our existing rng instance's internal state.
    // Since SeededRandom exposes getState/fromState, we use Object.assign
    // on the state properties that are accessible via the prototype.
    const sourceState = source.getState();
    // Access private fields via indexed access on the instance.
    // This is an intentional encapsulation break within the engine module.
    const rngRecord = this.rng as unknown as Record<string, unknown>;
    rngRecord['_state'] = sourceState.state;
    rngRecord['_callCount'] = sourceState.callCount;
    rngRecord['_spareGaussian'] = null;
  }
}
