/**
 * Save Manager — CNFL-0201
 *
 * Provides explicit named save slots backed by localStorage, with
 * comprehensive checksum validation and graceful error handling.
 * This is SEPARATE from the Zustand persist middleware auto-save —
 * it provides manual save / autosave / load operations.
 *
 * @see FR-103  — Players can save and load game state between turns
 * @see NFR-401 — Save files use checksum validation to detect corruption
 *
 * @module engine/save-manager
 */

import type { GameState } from '@/data/types/gamestate.types';
import type { TurnEngineState } from './turn-engine';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/** Current save envelope schema version. */
const CURRENT_VERSION = 1;

/** Reserved slot name used by {@link SaveManager.autosave}. */
const AUTOSAVE_SLOT = '__autosave__';

/**
 * Calendar month names used to reconstruct the human-readable date
 * from the turn number (turn 1 = March 2026).
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
// Public interfaces
// ─────────────────────────────────────────────────────────

/**
 * Configuration options for {@link SaveManager}.
 *
 * @see FR-103
 */
export interface SaveManagerOptions {
  /**
   * Prefix prepended to every localStorage key managed by this instance.
   * @defaultValue `"conflict-2026-slot-"`
   */
  readonly storagePrefix?: string;

  /**
   * Maximum number of named save slots (autosave does not count).
   * @defaultValue `10`
   */
  readonly maxSlots?: number;
}

/**
 * Metadata stored alongside every save for display in a save/load UI.
 *
 * @see FR-103
 */
export interface SaveMetadata {
  /** Human-readable slot name. */
  readonly slotName: string;
  /** ISO-8601 timestamp of when the save was created. */
  readonly savedAt: string;
  /** Turn number at time of save. */
  readonly turnNumber: number;
  /** Calendar date at time of save (e.g. "March 2026"). */
  readonly calendarDate: string;
  /** Scenario name. */
  readonly scenarioName: string;
  /** Player faction ID. */
  readonly playerFaction: string;
}

/**
 * The full envelope persisted to localStorage for a single save slot.
 *
 * @see FR-103
 * @see NFR-401
 */
export interface SaveEnvelope {
  /** Schema version for forward-compat migrations. */
  readonly version: number;
  /** Save metadata for listing. */
  readonly metadata: SaveMetadata;
  /** Full game state snapshot. */
  readonly gameState: GameState;
  /** Engine state (RNG + event log) for exact restoration. */
  readonly engineState: TurnEngineState;
  /** Integrity checksum covering the full payload (NFR-401). */
  readonly checksum: string;
}

/**
 * Result type for save and delete operations.
 *
 * @see FR-103
 */
export interface SaveResult {
  /** Whether the operation succeeded. */
  readonly success: boolean;
  /** Human-readable error message when `success` is false. */
  readonly error?: string;
}

/**
 * Result type for load operations.
 *
 * @see FR-103
 */
export interface LoadResult {
  /** Whether the operation succeeded. */
  readonly success: boolean;
  /** The loaded envelope when `success` is true. */
  readonly envelope?: SaveEnvelope;
  /** Human-readable error message when `success` is false. */
  readonly error?: string;
}

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

/**
 * Compute a comprehensive djb2 hash over the full payload.
 *
 * Unlike the lightweight store checksum (which only hashes 5 fields),
 * this covers the entire serialised game + engine state to satisfy
 * NFR-401's corruption-detection requirement.
 *
 * @see NFR-401
 */
function computeFullChecksum(
  gameState: GameState,
  engineState: TurnEngineState,
): string {
  const payload = JSON.stringify({ gameState, engineState });
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit then to base-36 for a compact string.
  return (hash >>> 0).toString(36);
}

/**
 * Derive a calendar date string from a turn number.
 * Turn 1 = March 2026, Turn 2 = April 2026, etc.
 */
function calendarDateFromTurn(turn: number): string {
  // Turn 1 maps to March 2026 (month index 2).
  const baseMonthIndex = 2; // March
  const baseYear = 2026;
  const totalMonths = baseMonthIndex + (turn - 1);
  const month = MONTH_NAMES[totalMonths % 12];
  const year = baseYear + Math.floor(totalMonths / 12);
  return `${month} ${year}`;
}

// ─────────────────────────────────────────────────────────
// SaveManager
// ─────────────────────────────────────────────────────────

/**
 * Manages explicit named save slots in localStorage with full
 * checksum validation.
 *
 * ### Design notes
 * - Never throws — all recoverable errors are returned via result objects.
 * - React-free: safe for use on the main thread or inside a Web Worker.
 * - Separate from Zustand's persist auto-save (`new-order-save` key).
 *
 * @see FR-103
 * @see NFR-401
 */
export class SaveManager {
  /** localStorage key prefix for all slots managed by this instance. */
  private readonly prefix: string;

  /** Maximum number of named (non-autosave) slots. */
  private readonly maxSlots: number;

  /**
   * Create a new SaveManager.
   *
   * @param options - Optional configuration overrides.
   *
   * @see FR-103
   */
  constructor(options?: SaveManagerOptions) {
    this.prefix = options?.storagePrefix ?? 'conflict-2026-slot-';
    this.maxSlots = options?.maxSlots ?? 10;
  }

  // ─── Key helpers ─────────────────────────────────────

  /** Build the localStorage key for a given slot name. */
  private key(slotName: string): string {
    return `${this.prefix}${slotName}`;
  }

  // ─── Save operations ────────────────────────────────

  /**
   * Save the current game and engine state to a named slot.
   *
   * @param slotName    - Human-readable slot identifier.
   * @param gameState   - Full {@link GameState} snapshot.
   * @param engineState - {@link TurnEngineState} for exact RNG + log restoration.
   * @returns A {@link SaveResult} indicating success or describing the error.
   *
   * @see FR-103
   * @see NFR-401
   */
  save(
    slotName: string,
    gameState: GameState,
    engineState: TurnEngineState,
  ): SaveResult {
    try {
      // Validate slot name
      if (!slotName || slotName.trim().length === 0) {
        return { success: false, error: 'Slot name must not be empty.' };
      }

      // Enforce max-slot limit (only for NEW named slots, not overwrites)
      if (slotName !== AUTOSAVE_SLOT && !this.hasSlot(slotName)) {
        const currentCount = this.getSlotCount();
        if (currentCount >= this.maxSlots) {
          return {
            success: false,
            error: `Maximum save slots reached (${this.maxSlots}). Delete an existing slot first.`,
          };
        }
      }

      const envelope = this.buildEnvelope(slotName, gameState, engineState);
      localStorage.setItem(this.key(slotName), JSON.stringify(envelope));
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown save error.';
      return { success: false, error: `Save failed: ${message}` };
    }
  }

  /**
   * Save to the reserved autosave slot.
   * The autosave slot does NOT count towards the {@link maxSlots} limit.
   *
   * @see FR-103
   */
  autosave(gameState: GameState, engineState: TurnEngineState): SaveResult {
    try {
      const envelope = this.buildEnvelope(
        AUTOSAVE_SLOT,
        gameState,
        engineState,
      );
      localStorage.setItem(this.key(AUTOSAVE_SLOT), JSON.stringify(envelope));
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown autosave error.';
      return { success: false, error: `Autosave failed: ${message}` };
    }
  }

  // ─── Load operations ────────────────────────────────

  /**
   * Load and validate a save from a named slot.
   *
   * @param slotName - The slot to load.
   * @returns A {@link LoadResult} with the envelope on success, or an error.
   *
   * @see FR-103
   * @see NFR-401
   */
  load(slotName: string): LoadResult {
    try {
      const raw = localStorage.getItem(this.key(slotName));
      if (raw === null) {
        return { success: false, error: `Save slot "${slotName}" not found.` };
      }
      return this.parseAndValidate(raw);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown load error.';
      return { success: false, error: `Load failed: ${message}` };
    }
  }

  /**
   * Load and validate the autosave slot.
   *
   * @see FR-103
   * @see NFR-401
   */
  loadAutosave(): LoadResult {
    return this.load(AUTOSAVE_SLOT);
  }

  // ─── Slot management ────────────────────────────────

  /**
   * List metadata for all occupied save slots (excluding autosave),
   * sorted by `savedAt` descending (most recent first).
   *
   * @see FR-103
   */
  listSlots(): SaveMetadata[] {
    const slots: SaveMetadata[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (
        storageKey === null ||
        !storageKey.startsWith(this.prefix) ||
        storageKey === this.key(AUTOSAVE_SLOT)
      ) {
        continue;
      }
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw === null) continue;
        const envelope = JSON.parse(raw) as SaveEnvelope;
        if (envelope.metadata) {
          slots.push(envelope.metadata);
        }
      } catch {
        // Skip corrupt entries silently — listSlots is non-critical.
      }
    }
    return slots.sort(
      (a, b) =>
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
  }

  /**
   * Delete a single named save slot.
   *
   * @see FR-103
   */
  deleteSlot(slotName: string): SaveResult {
    const storageKey = this.key(slotName);
    if (localStorage.getItem(storageKey) === null) {
      return { success: false, error: `Save slot "${slotName}" not found.` };
    }
    localStorage.removeItem(storageKey);
    return { success: true };
  }

  /**
   * Delete ALL save slots managed by this instance (including autosave).
   *
   * @see FR-103
   */
  deleteAllSlots(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey !== null && storageKey.startsWith(this.prefix)) {
        keysToRemove.push(storageKey);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }

  /**
   * Check whether a named slot exists in localStorage.
   *
   * @see FR-103
   */
  hasSlot(slotName: string): boolean {
    return localStorage.getItem(this.key(slotName)) !== null;
  }

  /**
   * Return the number of occupied named save slots (excluding autosave).
   *
   * @see FR-103
   */
  getSlotCount(): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (
        storageKey !== null &&
        storageKey.startsWith(this.prefix) &&
        storageKey !== this.key(AUTOSAVE_SLOT)
      ) {
        count++;
      }
    }
    return count;
  }

  // ─── Private helpers ────────────────────────────────

  /**
   * Build a {@link SaveEnvelope} with computed metadata and checksum.
   *
   * @see NFR-401
   */
  private buildEnvelope(
    slotName: string,
    gameState: GameState,
    engineState: TurnEngineState,
  ): SaveEnvelope {
    const turnNumber = gameState.currentTurn as number;
    const metadata: SaveMetadata = {
      slotName,
      savedAt: new Date().toISOString(),
      turnNumber,
      calendarDate: calendarDateFromTurn(turnNumber),
      scenarioName: gameState.scenarioMeta.name,
      playerFaction: gameState.playerFaction as string,
    };
    const checksum = computeFullChecksum(gameState, engineState);
    return {
      version: CURRENT_VERSION,
      metadata,
      gameState,
      engineState,
      checksum,
    };
  }

  /**
   * Parse raw JSON from localStorage and validate version + checksum.
   *
   * @see NFR-401
   */
  private parseAndValidate(raw: string): LoadResult {
    let envelope: SaveEnvelope;
    try {
      envelope = JSON.parse(raw) as SaveEnvelope;
    } catch {
      return {
        success: false,
        error: 'Corrupted save data: invalid JSON.',
      };
    }

    // Version gate
    if (typeof envelope.version !== 'number' || envelope.version > CURRENT_VERSION) {
      return {
        success: false,
        error: `Unsupported save version: ${String(envelope.version)}. Maximum supported: ${CURRENT_VERSION}.`,
      };
    }

    // Structural sanity check
    if (!envelope.gameState || !envelope.engineState) {
      return {
        success: false,
        error: 'Corrupted save data: missing gameState or engineState.',
      };
    }

    // Checksum validation (NFR-401)
    const expected = computeFullChecksum(
      envelope.gameState,
      envelope.engineState,
    );
    if (envelope.checksum !== expected) {
      return {
        success: false,
        error:
          'Save integrity check failed: checksum mismatch. The save may be corrupted or tampered with.',
      };
    }

    return { success: true, envelope };
  }
}
