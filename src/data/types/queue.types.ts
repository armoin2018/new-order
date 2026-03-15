/**
 * Queue-Based Scenario Runner Types — FR-4400
 *
 * Type definitions for the queue-based scenario runner engine: queue management,
 * batch configuration, concurrency control, progress tracking, and cross-faction
 * batch analysis.
 *
 * @see FR-4401 — Queue management (add, remove, reorder)
 * @see FR-4402 — Batch creation from faction × scenario matrix
 * @see FR-4403 — Concurrency control and resource monitoring
 * @see FR-4404 — Progress tracking and turn-level updates
 * @see FR-4405 — Batch analysis with dimension comparisons
 */

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

/**
 * Branded string type for queue item identifiers.
 * Format: `qi_{timestamp}_{randomHex}` — guarantees uniqueness.
 */
export type QueueItemId = string & { readonly __brand: 'QueueItemId' };

// ---------------------------------------------------------------------------
// FR-4401 — Queue Item Status & Shape
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a queue item.
 * @see FR-4401
 */
export type QueueItemStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped';

/**
 * A single scenario run queued for execution.
 * @see FR-4401
 */
export interface QueueItem {
  /** Unique queue item identifier. */
  readonly id: QueueItemId;
  /** Name of the scenario to execute. */
  scenarioName: string;
  /** Faction assigned to this run. */
  playerFaction: string;
  /** Position within the queue (0-based). */
  position: number;
  /** Current lifecycle status. */
  status: QueueItemStatus;
  /** Turn the simulation has progressed to. */
  currentTurn: number;
  /** Total turns for this scenario run. */
  totalTurns: number;
  /** ISO-8601 timestamp when execution started, or null. */
  startedAt: string | null;
  /** ISO-8601 timestamp when execution completed, or null. */
  completedAt: string | null;
  /** Error message if the item failed. */
  error?: string;
  /** Composite score at the end of the run, or null if incomplete. */
  compositeScore: number | null;
  /** Batch this item belongs to, or null for standalone. */
  batchId: string | null;
}

// ---------------------------------------------------------------------------
// FR-4402 — Batch Configuration
// ---------------------------------------------------------------------------

/**
 * Shared parameters applied to every run within a batch.
 * @see FR-4402
 */
export interface SharedScenarioParams {
  /** Total turns per run. */
  totalTurns: number;
  /** AI provider identifier. */
  aiProvider: string;
  /** Calendar unit each turn represents. */
  turnDurationUnit: string;
  /** Victory conditions applied to all runs. */
  victoryConditions: string[];
}

/**
 * Configuration for a batch of scenario runs.
 * @see FR-4402
 */
export interface BatchConfig {
  /** Unique batch identifier. */
  readonly id: string;
  /** Human-readable batch name. */
  name: string;
  /** Factions included in this batch. */
  factions: string[];
  /** Parameters shared by all items in the batch. */
  sharedParams: SharedScenarioParams;
  /** ISO-8601 timestamp when the batch was created. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// FR-4403 — Concurrency Configuration
// ---------------------------------------------------------------------------

/**
 * Controls how many scenario runs execute in parallel.
 * @see FR-4403
 */
export interface ConcurrencyConfig {
  /** Maximum number of parallel runs. */
  maxParallel: number;
  /** System resource usage percentage threshold before throttling. */
  resourceThresholdPct: number;
  /** Fall back to sequential execution when resources are constrained. */
  fallbackToSequential: boolean;
}

// ---------------------------------------------------------------------------
// FR-4404 — Progress Tracking
// ---------------------------------------------------------------------------

/**
 * Real-time progress snapshot for a running queue item.
 * @see FR-4404
 */
export interface QueueProgress {
  /** The queue item this progress refers to. */
  itemId: QueueItemId;
  /** Current turn reached. */
  currentTurn: number;
  /** Total turns for the run. */
  totalTurns: number;
  /** Completion percentage (0–100). */
  percentComplete: number;
  /** Estimated milliseconds remaining, or null if unknown. */
  estimatedRemainingMs: number | null;
}

// ---------------------------------------------------------------------------
// FR-4405 — Batch Analysis
// ---------------------------------------------------------------------------

/**
 * Comparison of a single scoring dimension across factions.
 * @see FR-4405
 */
export interface DimensionComparison {
  /** Dimension name (e.g. "military", "economy"). */
  dimension: string;
  /** Per-faction scores for this dimension. */
  scores: Record<string, number>;
  /** Faction with the highest score. */
  leader: string;
  /** Gap between first and second place. */
  gap: number;
}

/**
 * A point in the simulation where faction trajectories diverged.
 * @see FR-4405
 */
export interface DivergencePoint {
  /** Turn at which divergence occurred. */
  turn: number;
  /** Description of the divergence event. */
  description: string;
  /** Factions affected by the divergence. */
  affectedFactions: string[];
}

/**
 * Full cross-faction analysis produced after a batch completes.
 * @see FR-4405
 */
export interface BatchAnalysis {
  /** Batch this analysis belongs to. */
  batchId: string;
  /** ISO-8601 timestamp when analysis was generated. */
  completedAt: string;
  /** Final composite score per faction. */
  factionScores: Record<string, number>;
  /** Per-dimension comparison across factions. */
  dimensionComparisons: DimensionComparison[];
  /** Turns where faction trajectories diverged. */
  divergencePoints: DivergencePoint[];
  /** The faction with the strongest natural advantage. */
  naturalAdvantage: { faction: string; reason: string; margin: number };
  /** Turn-by-turn score trajectories per faction. */
  trajectories: Record<string, number[]>;
}

// ---------------------------------------------------------------------------
// Aggregate State
// ---------------------------------------------------------------------------

/**
 * Complete state slice for the scenario queue subsystem.
 * @see FR-4400
 */
export interface ScenarioQueueState {
  /** Ordered list of queue items. */
  items: QueueItem[];
  /** Registered batch configurations. */
  batches: BatchConfig[];
  /** Current concurrency settings. */
  concurrency: ConcurrencyConfig;
  /** Whether the queue runner is currently executing. */
  isRunning: boolean;
  /** IDs of items currently being executed. */
  activeItemIds: QueueItemId[];
  /** Completed batch analyses. */
  completedAnalyses: BatchAnalysis[];
}
