/**
 * Market Turn Integration — CNFL-4106
 *
 * Wires {@link StockMarketEngine} and {@link MarketIndexEngine} into the
 * turn pipeline by extracting game events from the current state, processing
 * per-turn market updates, computing index values, and returning an updated
 * {@link RuntimeMarketState}.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/market-turn-integration
 * @see FR-3300 — Stock Market Simulation
 * @see FR-3400 — Market Index Computation
 * @see CNFL-4106 — Market → Turn Engine Integration
 */

import type { FactionId, NationState } from '@/data/types';
import { SENTIMENT_BASELINE } from '@/data/model-loader';
import type {
  StockExchangeModel,
  NationTickerSet,
  MarketIndexModel,
  TickerRuntimeState,
  ExchangeSentimentState,
  MarketEventLogEntry,
  MarketContagionEvent,
  IndexRuntimeState,
  RuntimeMarketState,
} from '@/data/types/model.types';
import {
  StockMarketEngine,
  type GameMarketEvent,
  type StockMarketConfig,
  type TradeLinkage,
} from './stock-market-engine';
import {
  MarketIndexEngine,
  type MarketIndexConfig,
} from './market-index-engine';
import {
  generateAllIndexHistories,
  type HistoricalSeries,
} from './market-history-generator';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Signals extracted from the game state that drive market behaviour.
 *
 * Each signal maps to a {@link GameMarketEvent} processed by the
 * stock market engine.
 *
 * @see CNFL-4106
 */
export interface MarketSignals {
  /** Factions currently involved in active military conflict. */
  readonly activeCombatFactions: readonly FactionId[];
  /** Factions that had sanctions imposed or modified this turn. */
  readonly sanctionsChangedFactions: readonly FactionId[];
  /** Factions that completed a technology breakthrough this turn. */
  readonly techBreakthroughFactions: readonly FactionId[];
  /** Factions experiencing high civil unrest (≥60). */
  readonly highUnrestFactions: readonly FactionId[];
  /** Factions that signed a trade deal this turn. */
  readonly tradeDealFactions: readonly FactionId[];
  /** Whether a Hormuz/oil disruption is active. */
  readonly oilDisruptionActive: boolean;
  /** Factions that experienced a regime change this turn. */
  readonly regimeChangeFactions: readonly FactionId[];
  /** Current turn number. */
  readonly currentTurn: number;
}

/**
 * Input for a full market turn computation.
 *
 * @see CNFL-4106
 */
export interface MarketTurnInput {
  /** Current market state (null on first turn — will be initialised). */
  readonly currentMarketState: RuntimeMarketState | null;
  /** Signals extracted from the game state. */
  readonly signals: MarketSignals;
  /** Per-faction nation states for GDP / stability lookups. */
  readonly nationStates: Readonly<Record<string, NationState>>;
  /** Global Financial Stability Index (0–100). */
  readonly gfsi: number;
}

/**
 * Full result of market turn processing.
 *
 * @see CNFL-4106
 */
export interface MarketTurnOutput {
  /** Updated runtime market state. */
  readonly marketState: RuntimeMarketState;
  /** Market events generated this turn. */
  readonly newMarketEvents: readonly MarketEventLogEntry[];
  /** Contagion events generated this turn. */
  readonly newContagionEvents: readonly MarketContagionEvent[];
  /** Per-exchange composite price change percentages. */
  readonly exchangeComposites: Readonly<Record<string, number>>;
  /** Per-index current values. */
  readonly indexValues: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless integration layer that orchestrates per-turn market processing.
 *
 * Bridges game-state signals → StockMarketEngine → MarketIndexEngine
 * and produces an updated {@link RuntimeMarketState} for storage in
 * {@link GameState}.
 *
 * @see CNFL-4106
 */
export class MarketTurnIntegration {
  private readonly stockEngine: StockMarketEngine;
  private readonly indexEngine: MarketIndexEngine;

  constructor(
    stockConfig?: StockMarketConfig,
    indexConfig?: MarketIndexConfig,
    tradeLinkages?: readonly TradeLinkage[],
  ) {
    this.stockEngine = new StockMarketEngine(stockConfig, tradeLinkages);
    this.indexEngine = new MarketIndexEngine(indexConfig);
  }

  // ── Signal Extraction ─────────────────────────────────────────────────

  /**
   * Convert {@link MarketSignals} into an array of {@link GameMarketEvent}
   * that the stock market engine can process.
   *
   * @param signals Market-relevant signals from the game state.
   * @returns Array of game market events.
   */
  extractGameEvents(signals: MarketSignals): readonly GameMarketEvent[] {
    const events: GameMarketEvent[] = [];
    const turn = signals.currentTurn;

    // Military conflicts → military-conflict events
    for (const factionId of signals.activeCombatFactions) {
      events.push({
        eventType: 'military-conflict',
        severity: 0.7,
        sourceFaction: factionId,
        turn,
      });
    }

    // Sanctions → sanctions-imposed events
    for (const factionId of signals.sanctionsChangedFactions) {
      events.push({
        eventType: 'sanctions-imposed',
        severity: 0.5,
        sourceFaction: factionId,
        turn,
      });
    }

    // Tech breakthroughs → tech-breakthrough events
    for (const factionId of signals.techBreakthroughFactions) {
      events.push({
        eventType: 'tech-breakthrough',
        severity: 0.6,
        sourceFaction: factionId,
        turn,
      });
    }

    // Civil unrest → civil-unrest events
    for (const factionId of signals.highUnrestFactions) {
      events.push({
        eventType: 'civil-unrest',
        severity: 0.5,
        sourceFaction: factionId,
        turn,
      });
    }

    // Trade deals → trade-deal events (positive)
    for (const factionId of signals.tradeDealFactions) {
      events.push({
        eventType: 'trade-deal',
        severity: 0.4,
        sourceFaction: factionId,
        turn,
      });
    }

    // Oil disruption → oil-disruption event (global)
    if (signals.oilDisruptionActive) {
      events.push({
        eventType: 'oil-disruption',
        severity: 0.8,
        sourceFaction: 'us' as FactionId, // global event
        turn,
      });
    }

    // Regime changes → regime-change events
    for (const factionId of signals.regimeChangeFactions) {
      events.push({
        eventType: 'regime-change',
        severity: 0.9,
        sourceFaction: factionId,
        turn,
      });
    }

    return events;
  }

  // ── Initialisation ────────────────────────────────────────────────────

  /**
   * Initialise market state on the first turn from loaded model data.
   *
   * @param exchanges Loaded exchange models.
   * @param tickerSets Loaded ticker set models.
   * @param presetIndexes Loaded preset index models.
   * @param turn Starting turn number.
   * @returns Initial RuntimeMarketState.
   */
  initialiseMarketState(
    exchanges: readonly StockExchangeModel[],
    tickerSets: readonly NationTickerSet[],
    presetIndexes: readonly MarketIndexModel[],
    turn: number,
  ): RuntimeMarketState {
    // Create initial ticker runtime states
    const tickerStates: Record<string, TickerRuntimeState> = {};
    for (const tickerSet of tickerSets) {
      for (const ticker of tickerSet.tickers) {
        tickerStates[ticker.tickerId] = {
          tickerId: ticker.tickerId,
          exchangeId: tickerSet.exchangeId,
          currentPrice: ticker.initialPrice,
          previousPrice: ticker.initialPrice,
          allTimeHigh: ticker.initialPrice,
          allTimeLow: ticker.initialPrice,
          trendDirection: 'flat',
          volume: 1000,
          priceHistory: [],
        };
      }
    }

    // Create initial sentiment states from baseline data
    const sentimentStates: Record<string, ExchangeSentimentState> = {};
    for (const exchange of exchanges) {
      const baseline = SENTIMENT_BASELINE.exchangeBaselines[exchange.exchangeId];
      sentimentStates[exchange.exchangeId] = {
        exchangeId: exchange.exchangeId,
        sentiment: baseline?.sentiment ?? 'neutral',
        sentimentScore: baseline?.sentimentScore ?? 0,
        trendStrength: baseline?.trendStrength ?? 0,
        volatilityIndex: this.volatilityToIndex(exchange.volatilityProfile),
        majorEvents: [],
      };
    }

    // Create initial index states
    const indexStates: Record<string, IndexRuntimeState> = {};
    for (const index of presetIndexes) {
      const value = this.indexEngine.computeIndexValue(
        index,
        new Map(Object.entries(tickerStates)),
      );
      indexStates[index.indexId] = {
        indexId: index.indexId,
        currentValue: value,
        allTimeHigh: value,
        allTimeLow: value,
        trendDirection: 'flat',
        createdOnTurn: turn,
        history: [{ turn, value, change: 0, changePercent: 0 }],
      };
    }

    // Generate 10-year historical OHLC data for all indexes
    const indexInputs = presetIndexes.map((idx) => ({
      indexId: idx.indexId,
      indexName: idx.indexName ?? idx.indexId,
      baseValue: indexStates[idx.indexId]?.currentValue ?? idx.baseValue,
    }));
    const historicalData = generateAllIndexHistories(indexInputs, 20260115);

    return {
      exchanges,
      tickerSets,
      tickerStates,
      sentimentStates,
      marketEventLog: [],
      contagionLog: [],
      presetIndexes,
      customIndexes: [],
      indexStates,
      historicalData,
    };
  }

  // ── Turn Processing ───────────────────────────────────────────────────

  /**
   * Process a complete market turn.
   *
   * 1. Extract game events from signals.
   * 2. Run StockMarketEngine.processTurn for ticker/sentiment updates.
   * 3. Run MarketIndexEngine.updateAllIndexes for index recomputation.
   * 4. Merge results into an updated RuntimeMarketState.
   *
   * @param input Market turn input containing current state and signals.
   * @returns Complete market turn output.
   *
   * @see CNFL-4106
   */
  processMarketTurn(input: MarketTurnInput): MarketTurnOutput {
    const { currentMarketState, signals, gfsi } = input;

    if (currentMarketState === null) {
      throw new Error(
        'Market state must be initialised before processing turns. ' +
        'Call initialiseMarketState() first.',
      );
    }

    // 1. Extract game events from signals
    const gameEvents = this.extractGameEvents(signals);

    // 2. Convert Record tickerStates to Map for engine compatibility
    const tickerMap = new Map<string, TickerRuntimeState>(
      Object.entries(currentMarketState.tickerStates),
    );

    // 3. Process stock market turn
    const marketResult = this.stockEngine.processTurn(
      currentMarketState.exchanges,
      currentMarketState.tickerSets,
      tickerMap,
      gameEvents,
      signals.currentTurn,
      gfsi,
    );

    // 4. Convert updated ticker states back to Record
    const updatedTickerStates: Record<string, TickerRuntimeState> = {};
    for (const [key, value] of marketResult.tickerStates) {
      updatedTickerStates[key] = value;
    }

    // 5. Convert sentiment array to Record
    const updatedSentimentStates: Record<string, ExchangeSentimentState> = {};
    for (const sentiment of marketResult.sentimentStates) {
      updatedSentimentStates[sentiment.exchangeId] = sentiment;
    }

    // 6. Compute updated index values
    const allIndexes = [
      ...currentMarketState.presetIndexes,
      ...currentMarketState.customIndexes,
    ];

    const updatedIndexStates: Record<string, IndexRuntimeState> = {};
    const indexValues: Record<string, number> = {};

    for (const index of allIndexes) {
      const prevState = currentMarketState.indexStates[index.indexId];
      const newValue = this.indexEngine.computeIndexValue(
        index,
        marketResult.tickerStates,
      );

      const prevValue = prevState?.currentValue ?? newValue;
      const change = newValue - prevValue;
      const changePercent = prevValue !== 0
        ? (change / prevValue) * 100
        : 0;

      const history = [
        ...(prevState?.history ?? []),
        {
          turn: signals.currentTurn,
          value: newValue,
          change,
          changePercent,
        },
      ];

      const newATH = Math.max(prevState?.allTimeHigh ?? newValue, newValue);
      const newATL = Math.min(prevState?.allTimeLow ?? newValue, newValue);

      // Compute trend from recent history
      const tempIndexState: IndexRuntimeState = {
        indexId: index.indexId,
        currentValue: newValue,
        allTimeHigh: newATH,
        allTimeLow: newATL,
        trendDirection: 'flat',
        createdOnTurn: prevState?.createdOnTurn ?? signals.currentTurn,
        history,
      };
      const trendDirection = this.indexEngine.getIndexTrend(tempIndexState);

      updatedIndexStates[index.indexId] = {
        indexId: index.indexId,
        currentValue: newValue,
        allTimeHigh: newATH,
        allTimeLow: newATL,
        trendDirection,
        createdOnTurn: prevState?.createdOnTurn ?? signals.currentTurn,
        history,
      };
      indexValues[index.indexId] = newValue;
    }

    // 7. Compute exchange composite changes
    const exchangeComposites: Record<string, number> = {};
    for (const exchange of currentMarketState.exchanges) {
      exchangeComposites[exchange.exchangeId] =
        this.stockEngine.getExchangeCompositeChange(
          exchange.exchangeId,
          marketResult.tickerStates,
          currentMarketState.tickerSets,
        );
    }

    // 8. Build updated market state
    const updatedMarketState: RuntimeMarketState = {
      exchanges: currentMarketState.exchanges,
      tickerSets: currentMarketState.tickerSets,
      tickerStates: updatedTickerStates,
      sentimentStates: updatedSentimentStates,
      marketEventLog: [
        ...currentMarketState.marketEventLog,
        ...marketResult.marketEvents,
      ],
      contagionLog: [
        ...currentMarketState.contagionLog,
        ...marketResult.contagionEvents,
      ],
      presetIndexes: currentMarketState.presetIndexes,
      customIndexes: currentMarketState.customIndexes,
      indexStates: updatedIndexStates,
      historicalData: currentMarketState.historicalData,
    };

    return {
      marketState: updatedMarketState,
      newMarketEvents: marketResult.marketEvents,
      newContagionEvents: marketResult.contagionEvents,
      exchangeComposites,
      indexValues,
    };
  }

  // ── Custom Index Management ───────────────────────────────────────────

  /**
   * Create a custom market index and add it to the market state.
   *
   * Delegates validation to {@link MarketIndexEngine.createCustomIndex}.
   *
   * @param marketState Current market state.
   * @param indexName Display name for the index.
   * @param tickers Constituent tickers with weights.
   * @param turn Current turn number.
   * @param description Optional description.
   * @returns Updated market state with the new custom index, or error.
   */
  createCustomIndex(
    marketState: RuntimeMarketState,
    indexName: string,
    tickers: readonly { tickerId: string; exchangeId: string; weight: number }[],
    turn: number,
    description?: string,
  ): { success: boolean; marketState?: RuntimeMarketState; error?: string } {
    const allTickerIds = new Set<string>();
    for (const ts of marketState.tickerSets) {
      for (const t of ts.tickers) {
        allTickerIds.add(t.tickerId);
      }
    }

    const result = this.indexEngine.createCustomIndex(
      { indexName, constituentTickers: tickers, description },
      marketState.customIndexes,
      allTickerIds,
    );

    if (!result.success || !result.index) {
      return { success: false, error: result.error };
    }

    // Compute initial value
    const tickerMap = new Map(Object.entries(marketState.tickerStates));
    const initialValue = this.indexEngine.computeIndexValue(
      result.index,
      tickerMap,
    );

    const indexState: IndexRuntimeState = {
      indexId: result.index.indexId,
      currentValue: initialValue,
      allTimeHigh: initialValue,
      allTimeLow: initialValue,
      trendDirection: 'flat',
      createdOnTurn: turn,
      history: [{ turn, value: initialValue, change: 0, changePercent: 0 }],
    };

    return {
      success: true,
      marketState: {
        ...marketState,
        customIndexes: [...marketState.customIndexes, result.index],
        indexStates: {
          ...marketState.indexStates,
          [result.index.indexId]: indexState,
        },
        historicalData: marketState.historicalData,
      },
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Convert a volatility profile string to a numeric index (0–100).
   *
   * @param profile Volatility profile label.
   * @returns Numeric volatility index.
   */
  private volatilityToIndex(
    profile: 'low' | 'medium' | 'high' | 'extreme',
  ): number {
    const map: Record<string, number> = {
      low: 15,
      medium: 35,
      high: 60,
      extreme: 85,
    };
    return map[profile] ?? 35;
  }
}
