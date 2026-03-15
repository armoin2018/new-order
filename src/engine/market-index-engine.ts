/**
 * Market Index Computation Engine — FR-3400, CNFL-4201
 *
 * Engine responsible for computing composite market index values from
 * constituent ticker prices, maintaining index runtime state, managing
 * custom (player-created) indexes, and evaluating index threshold events.
 *
 * All methods are **pure functions**: they accept current state as parameters
 * and return new state without mutation or side effects.
 *
 * @module engine/market-index-engine
 * @see FR-3400 — Market Index Computation
 * @see CNFL-4201 — Index Management
 */

import type {
  MarketIndexModel,
  IndexRuntimeState,
  MarketTrend,
  TickerRuntimeState,
  MarketEventLogEntry,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Result of creating a custom index. */
export interface CreateCustomIndexResult {
  readonly success: boolean;
  readonly index?: MarketIndexModel;
  readonly error?: string;
}

/** Configuration for the market index engine. */
export interface MarketIndexConfig {
  readonly maxCustomIndexes: number;
  readonly trendWindowSize: number;
}

/** Input for creating a custom index. */
export interface CustomIndexInput {
  readonly indexName: string;
  readonly constituentTickers: readonly {
    readonly tickerId: string;
    readonly exchangeId: string;
    readonly weight: number;
  }[];
  readonly description?: string;
}

/** Summary statistics for an index's history. */
export interface IndexHistorySummary {
  readonly currentValue: number;
  readonly allTimeHigh: number;
  readonly allTimeLow: number;
  readonly totalReturnPercent: number;
  readonly averageTurnChange: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default engine configuration. */
const DEFAULT_CONFIG: MarketIndexConfig = {
  maxCustomIndexes: 10,
  trendWindowSize: 6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between a minimum and maximum. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Generate a unique event ID from turn and index. */
function eventId(turn: number, index: number): string {
  return `idx-${turn}-${index}`;
}

/** Convert a display name to a kebab-case ID. */
function nameToId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless market index engine that computes composite index values from
 * constituent ticker prices, manages preset and custom indexes, evaluates
 * threshold-based events, and tracks index history over time.
 *
 * All methods are pure — they accept current state and return new state
 * without mutation or side effects.
 *
 * @see FR-3400 — Market Index Computation
 * @see CNFL-4201 — Index Management
 */
export class MarketIndexEngine {
  private readonly config: MarketIndexConfig;

  constructor(config: Partial<MarketIndexConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  // ── Index Value Computation ───────────────────────────────────────────

  /**
   * Compute the current value of a market index from its constituent
   * ticker prices, normalised to a base-100 scale.
   *
   * Formula: `sum(currentPrice / initialPrice × weight) × baseValue`
   * for each constituent. Missing tickers are skipped.
   *
   * @param index         The market index model
   * @param tickerStates  Map of tickerId → current TickerRuntimeState
   * @returns Computed index value
   *
   * @see FR-3400
   */
  computeIndexValue(
    index: MarketIndexModel,
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const constituent of index.constituentTickers) {
      const state = tickerStates.get(constituent.tickerId);
      if (!state) {
        // Skip missing tickers — they may have been delisted or not yet loaded
        continue;
      }

      // Find initial price from the first price history entry, or use current
      const initialPrice =
        state.priceHistory.length > 0
          ? state.priceHistory[0].openPrice
          : state.currentPrice;

      if (initialPrice <= 0) continue;

      const priceRatio = state.currentPrice / initialPrice;
      weightedSum += priceRatio * constituent.weight;
      totalWeight += constituent.weight;
    }

    if (totalWeight <= 0) return index.baseValue;

    // Normalise weights and scale to base value
    return (weightedSum / totalWeight) * index.baseValue;
  }

  // ── Bulk Index Update ─────────────────────────────────────────────────

  /**
   * Update the runtime state for all indexes (preset and custom) in a
   * single pass. Computes new values, updates high/low records, derives
   * trend direction, and appends to price history.
   *
   * @param indexes         Array of all index models (preset + custom)
   * @param tickerStates    Current ticker runtime states (tickerId → state)
   * @param previousStates  Previous index runtime states (indexId → state)
   * @param turn            Current turn number
   * @returns Updated index runtime states keyed by indexId
   *
   * @see FR-3400
   */
  updateAllIndexes(
    indexes: readonly MarketIndexModel[],
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
    previousStates: ReadonlyMap<string, IndexRuntimeState>,
    turn: number,
  ): ReadonlyMap<string, IndexRuntimeState> {
    const result = new Map<string, IndexRuntimeState>();

    for (const index of indexes) {
      const newValue = this.computeIndexValue(index, tickerStates);
      const previous = previousStates.get(index.indexId);

      if (previous) {
        const change = newValue - previous.currentValue;
        const changePercent =
          previous.currentValue > 0
            ? change / previous.currentValue
            : 0;

        const historyEntry = {
          turn,
          value: newValue,
          change,
          changePercent,
        };

        const updatedHistory = [...previous.history, historyEntry];
        const trendDirection = this.getIndexTrend(
          { ...previous, history: updatedHistory },
          this.config.trendWindowSize,
        );

        result.set(index.indexId, {
          indexId: index.indexId,
          currentValue: newValue,
          allTimeHigh: Math.max(previous.allTimeHigh, newValue),
          allTimeLow: Math.min(previous.allTimeLow, newValue),
          trendDirection,
          createdOnTurn: previous.createdOnTurn,
          history: updatedHistory,
        });
      } else {
        // First time computing this index — initialise state
        result.set(index.indexId, {
          indexId: index.indexId,
          currentValue: newValue,
          allTimeHigh: newValue,
          allTimeLow: newValue,
          trendDirection: 'flat',
          createdOnTurn: turn,
          history: [
            {
              turn,
              value: newValue,
              change: 0,
              changePercent: 0,
            },
          ],
        });
      }
    }

    return result;
  }

  // ── Trend Analysis ────────────────────────────────────────────────────

  /**
   * Analyse the trend direction of an index over a configurable window
   * of recent turns.
   *
   * - **Rising**: ≥ 4 of the last 6 (or windowSize) turns had positive change
   * - **Falling**: ≥ 4 of the last 6 turns had negative change
   * - **Flat**: otherwise
   *
   * @param state       Index runtime state containing history
   * @param windowSize  Number of recent turns to consider (default from config)
   * @returns Trend direction
   *
   * @see FR-3400
   */
  getIndexTrend(
    state: IndexRuntimeState,
    windowSize?: number,
  ): MarketTrend {
    const window = windowSize ?? this.config.trendWindowSize;
    const recent = state.history.slice(-window);
    if (recent.length < 2) return 'flat';

    const threshold = Math.ceil(recent.length * (2 / 3));
    const positiveCount = recent.filter((h) => h.changePercent > 0).length;
    const negativeCount = recent.filter((h) => h.changePercent < 0).length;

    if (positiveCount >= threshold) return 'rising';
    if (negativeCount >= threshold) return 'falling';
    return 'flat';
  }

  // ── Custom Index Management ───────────────────────────────────────────

  /**
   * Create a new player-defined custom index. Validates that the maximum
   * number of custom indexes has not been exceeded, all referenced tickers
   * exist, weights approximately sum to 1.0, and the name is non-empty.
   *
   * @param input                  Custom index creation parameters
   * @param existingCustomIndexes  Currently existing custom indexes
   * @param allTickers             Set of all known ticker IDs for validation
   * @returns Result with the new index model on success, or an error message
   *
   * @see FR-3400
   */
  createCustomIndex(
    input: CustomIndexInput,
    existingCustomIndexes: readonly MarketIndexModel[],
    allTickers: ReadonlySet<string>,
  ): CreateCustomIndexResult {
    // Validate max custom indexes
    if (existingCustomIndexes.length >= this.config.maxCustomIndexes) {
      return {
        success: false,
        error: `Maximum of ${this.config.maxCustomIndexes} custom indexes reached`,
      };
    }

    // Validate name
    if (!input.indexName || input.indexName.trim().length === 0) {
      return {
        success: false,
        error: 'Index name must not be empty',
      };
    }

    // Validate constituents
    if (input.constituentTickers.length === 0) {
      return {
        success: false,
        error: 'Index must have at least one constituent ticker',
      };
    }

    // Validate all referenced tickers exist
    const missingTickers: string[] = [];
    for (const constituent of input.constituentTickers) {
      if (!allTickers.has(constituent.tickerId)) {
        missingTickers.push(constituent.tickerId);
      }
    }
    if (missingTickers.length > 0) {
      return {
        success: false,
        error: `Unknown ticker(s): ${missingTickers.join(', ')}`,
      };
    }

    // Validate weights sum approximately to 1.0
    const weightSum = input.constituentTickers.reduce(
      (sum, c) => sum + c.weight,
      0,
    );
    if (Math.abs(weightSum - 1.0) > 0.05) {
      return {
        success: false,
        error: `Constituent weights must sum to ~1.0 (got ${weightSum.toFixed(3)})`,
      };
    }

    // Validate no duplicate tickers
    const tickerIds = input.constituentTickers.map((c) => c.tickerId);
    const uniqueIds = new Set(tickerIds);
    if (uniqueIds.size !== tickerIds.length) {
      return {
        success: false,
        error: 'Duplicate ticker IDs in constituent list',
      };
    }

    const indexId = `custom-${nameToId(input.indexName)}`;

    // Check for duplicate ID
    if (existingCustomIndexes.some((idx) => idx.indexId === indexId)) {
      return {
        success: false,
        error: `Custom index with ID "${indexId}" already exists`,
      };
    }

    const newIndex: MarketIndexModel = {
      schemaVersion: '1.0.0',
      indexId,
      indexName: input.indexName.trim(),
      indexType: 'custom',
      constituentTickers: input.constituentTickers.map((c) => ({
        tickerId: c.tickerId,
        exchangeId: c.exchangeId,
        weight: c.weight,
      })),
      baseValue: 100,
      description: input.description,
    };

    return {
      success: true,
      index: newIndex,
    };
  }

  /**
   * Delete a custom index by ID. Only custom indexes can be deleted;
   * preset indexes are protected.
   *
   * @param indexId  The ID of the index to delete
   * @param indexes  Current array of all indexes
   * @returns New array with the specified custom index removed
   *
   * @see FR-3400
   */
  deleteCustomIndex(
    indexId: string,
    indexes: readonly MarketIndexModel[],
  ): readonly MarketIndexModel[] {
    return indexes.filter(
      (idx) => !(idx.indexId === indexId && idx.indexType === 'custom'),
    );
  }

  /**
   * Combine preset and custom indexes into a single array for processing.
   *
   * @param presetIndexes  System-defined preset indexes
   * @param customIndexes  Player-defined custom indexes
   * @returns Combined array of all active indexes
   *
   * @see FR-3400
   */
  getActiveIndexes(
    presetIndexes: readonly MarketIndexModel[],
    customIndexes: readonly MarketIndexModel[],
  ): readonly MarketIndexModel[] {
    return [...presetIndexes, ...customIndexes];
  }

  // ── Threshold Evaluation ──────────────────────────────────────────────

  /**
   * Evaluate all index states against crash and recovery thresholds,
   * generating market event log entries when significant movements are
   * detected.
   *
   * - **Crash**: index drops > 20% from its all-time high
   * - **Recovery**: index rises > 30% from its all-time low
   *
   * @param indexStates  Current index runtime states (indexId → state)
   * @param turn         Current turn number
   * @returns Array of market event log entries for threshold breaches
   *
   * @see FR-3400
   */
  evaluateIndexThresholds(
    indexStates: ReadonlyMap<string, IndexRuntimeState>,
    turn: number,
  ): readonly MarketEventLogEntry[] {
    const events: MarketEventLogEntry[] = [];
    let eventIndex = 0;

    for (const [, state] of indexStates) {
      // Crash detection: current value > 20% below all-time high
      if (state.allTimeHigh > 0) {
        const dropFromHigh =
          (state.allTimeHigh - state.currentValue) / state.allTimeHigh;

        if (dropFromHigh > 0.2) {
          events.push({
            eventId: eventId(turn, eventIndex++),
            turn,
            eventType: 'crash',
            affectedExchanges: [],
            magnitude: dropFromHigh,
            cause: `Index ${state.indexId} has fallen ${(dropFromHigh * 100).toFixed(4)}% from all-time high`,
            resolved: false,
          });
        }
      }

      // Recovery detection: current value > 30% above all-time low
      if (state.allTimeLow > 0) {
        const riseFromLow =
          (state.currentValue - state.allTimeLow) / state.allTimeLow;

        if (riseFromLow > 0.3) {
          events.push({
            eventId: eventId(turn, eventIndex++),
            turn,
            eventType: 'rally',
            affectedExchanges: [],
            magnitude: riseFromLow,
            cause: `Index ${state.indexId} has recovered ${(riseFromLow * 100).toFixed(4)}% from all-time low`,
            resolved: false,
          });
        }
      }

      // Correction detection: recent sharp reversal after sustained trend
      const recent = state.history.slice(-3);
      if (recent.length >= 3) {
        const recentChange = recent.reduce(
          (sum, h) => sum + h.changePercent,
          0,
        );

        if (
          state.trendDirection === 'rising' &&
          recentChange < -0.1
        ) {
          events.push({
            eventId: eventId(turn, eventIndex++),
            turn,
            eventType: 'correction',
            affectedExchanges: [],
            magnitude: Math.abs(recentChange),
            cause: `Index ${state.indexId} correcting after sustained rise`,
            resolved: false,
          });
        }
      }
    }

    return events;
  }

  // ── History Summary ───────────────────────────────────────────────────

  /**
   * Compute summary statistics for an index's historical performance.
   *
   * @param state  Index runtime state with history
   * @returns Summary containing current value, all-time high/low, total
   *          return percentage, and average turn-over-turn change
   *
   * @see FR-3400
   */
  computeIndexHistory(state: IndexRuntimeState): IndexHistorySummary {
    const firstValue =
      state.history.length > 0 ? state.history[0].value : state.currentValue;

    const totalReturnPercent =
      firstValue > 0
        ? ((state.currentValue - firstValue) / firstValue) * 100
        : 0;

    const averageTurnChange =
      state.history.length > 1
        ? state.history.reduce((sum, h) => sum + h.changePercent, 0) /
          state.history.length
        : 0;

    return {
      currentValue: state.currentValue,
      allTimeHigh: state.allTimeHigh,
      allTimeLow: state.allTimeLow,
      totalReturnPercent: clamp(totalReturnPercent, -100, 10000),
      averageTurnChange,
    };
  }
}
