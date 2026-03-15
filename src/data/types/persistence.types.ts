/**
 * Simulation Persistence Types — FR-4200 (DR-188, DR-189)
 *
 * Type definitions for the simulation persistence engine: save/load,
 * auto-save configuration, running context documents, and simulation browser.
 *
 * @see FR-4201 — Auto-save simulations to disk
 * @see FR-4202 — Running context document updated each turn
 * @see FR-4203 — Simulation browser listing saved simulations
 * @see FR-4204 — Load and resume saved simulations
 * @see FR-4205 — Auto-save every N turns, manual save via Ctrl+S
 * @see DR-188  — Simulation save directory structure
 * @see DR-189  — Running context document format
 */

// ---------------------------------------------------------------------------
// DR-188 — Branded ID & Status
// ---------------------------------------------------------------------------

/**
 * Branded string type for simulation identifiers.
 * Format: `sim_{timestamp}_{randomHex}` — guarantees uniqueness.
 */
export type SimulationId = string & { readonly __brand: 'SimulationId' };

/**
 * Lifecycle status of a saved simulation.
 * @see FR-4203 — Status shown in the simulation browser
 */
export type SimulationStatus = 'active' | 'completed' | 'paused' | 'forked';

// ---------------------------------------------------------------------------
// FR-4203 — Simulation Metadata (browser listing)
// ---------------------------------------------------------------------------

/**
 * Summary metadata for a saved simulation, displayed in the browser.
 * @see FR-4203
 */
export interface SimulationMetadata {
  /** Unique simulation identifier. */
  readonly id: SimulationId;
  /** Human-readable name chosen by the player. */
  name: string;
  /** Name of the scenario being played. */
  scenarioName: string;
  /** ISO-8601 timestamp when the simulation was first created. */
  dateCreated: string;
  /** ISO-8601 timestamp of the most recent save. */
  lastPlayed: string;
  /** The current turn number at the time of save. */
  currentTurn: number;
  /** Total number of turns in the scenario. */
  totalTurns: number;
  /** Faction chosen by the player. */
  playerFaction: string;
  /** Current lifecycle status. */
  status: SimulationStatus;
  /** Composite score at the time of save. */
  compositeScore: number;
  /** If this simulation was forked, the parent simulation ID. */
  parentSimulationId?: SimulationId;
}

// ---------------------------------------------------------------------------
// DR-188 — Save Manifest
// ---------------------------------------------------------------------------

/**
 * Complete manifest for a simulation save directory.
 * Lists every file in the save alongside the simulation metadata.
 * @see DR-188
 */
export interface SimulationSaveManifest {
  /** Metadata for this simulation save. */
  metadata: SimulationMetadata;
  /** List of file paths (relative to save directory) included in this save. */
  files: readonly string[];
}

// ---------------------------------------------------------------------------
// FR-4205 — Auto-Save Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the auto-save system.
 * @see FR-4205
 */
export interface AutoSaveConfig {
  /** Number of turns between automatic saves. */
  intervalTurns: number;
  /** Whether auto-save is enabled. */
  enabled: boolean;
  /** Maximum number of auto-save slots to retain (oldest pruned). */
  maxAutoSaves: number;
}

// ---------------------------------------------------------------------------
// DR-189 — Running Context Document
// ---------------------------------------------------------------------------

/**
 * Named sections that appear in the running context document.
 * @see DR-189
 */
export type RunningContextSection =
  | 'executiveSummary'
  | 'recentEvents'
  | 'keyMetrics'
  | 'aiAnalysis'
  | 'recommendations';

/**
 * Full running context document written to `currentContext.md` each turn.
 * @see FR-4202, DR-189
 */
export interface RunningContextDocument {
  /** Content for each named section. */
  sections: Record<RunningContextSection, string>;
  /** Turn number when this document was last updated. */
  lastUpdatedTurn: number;
  /** ISO-8601 timestamp when the document was generated. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// FR-4201 — Save Result
// ---------------------------------------------------------------------------

/**
 * Outcome of a save operation (auto or manual).
 * @see FR-4201
 */
export interface SaveResult {
  /** Whether the save completed successfully. */
  success: boolean;
  /** Absolute path to the save directory. */
  path: string;
  /** Total size of the save in bytes. */
  sizeBytes: number;
  /** Time taken to save in milliseconds. */
  durationMs: number;
  /** Error message if the save failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// FR-4200 — Persistence State (aggregate)
// ---------------------------------------------------------------------------

/**
 * Top-level persistence state tracked by the simulation store.
 * @see FR-4200
 */
export interface PersistenceState {
  /** All known simulation metadata entries. */
  simulations: SimulationMetadata[];
  /** Current auto-save configuration. */
  autoSaveConfig: AutoSaveConfig;
  /** Result of the most recent save operation, if any. */
  lastSaveResult: SaveResult | null;
  /** Whether a save is currently in progress. */
  isSaving: boolean;
}
