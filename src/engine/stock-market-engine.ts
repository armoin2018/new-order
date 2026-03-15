/**
 * Stock Market Simulation Engine — FR-3300, CNFL-4103
 *
 * Core engine that simulates per-turn stock price movements, exchange
 * sentiment shifts, cross-market contagion propagation, and market event
 * generation for every faction's stock exchange in the simulation.
 *
 * All methods are **pure functions**: they accept current state as parameters
 * and return new state without mutation or side effects.
 *
 * @module engine/stock-market-engine
 * @see FR-3300 — Stock Market Simulation
 * @see CNFL-4103 — Market Event Processing
 */

import type { FactionId } from '@/data/types';
import type {
  StockExchangeModel,
  NationTickerSet,
  SectorTicker,
  MarketEventType,
  MarketSentiment,
  MarketTrend,
  TickerPricePoint,
  TickerRuntimeState,
  ExchangeSentimentState,
  MarketEventLogEntry,
  MarketContagionEvent,
  EventSensitivityWeights,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Represents a game event that affects stock prices. */
export interface GameMarketEvent {
  readonly eventType: MarketEventType;
  readonly severity: number; // 0-1 scale
  readonly sourceFaction: FactionId;
  readonly targetFaction?: FactionId;
  readonly turn: number;
}

/** Result of processing a single turn's market updates. */
export interface MarketTurnResult {
  readonly tickerStates: ReadonlyMap<string, TickerRuntimeState>;
  readonly sentimentStates: readonly ExchangeSentimentState[];
  readonly marketEvents: readonly MarketEventLogEntry[];
  readonly contagionEvents: readonly MarketContagionEvent[];
}

/** Aggregated global market sentiment across all exchanges (FR-3306). */
export interface GlobalSentiment {
  readonly sentiment: MarketSentiment;
  readonly sentimentScore: number; // -100 to +100
  readonly exchangeCount: number;
  readonly bullishCount: number;
  readonly bearishCount: number;
  readonly neutralCount: number;
  readonly averageVolatility: number;
}

/** Configuration for the stock market engine. */
export interface StockMarketConfig {
  readonly noiseAmplitude: number;
  readonly meanReversionStrength: number;
  readonly sentimentAmplification: number;
  readonly contagionThresholdPercent: number;
  readonly maxContagionHops: number;
  readonly contagionDecayPerHop: number;
}

/** Trade linkage between two exchanges (for contagion). */
export interface TradeLinkage {
  readonly exchangeA: string;
  readonly exchangeB: string;
  readonly linkageStrength: number; // 0-1
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default engine configuration. */
const DEFAULT_CONFIG: StockMarketConfig = {
  noiseAmplitude: 0.02,
  meanReversionStrength: 0.05,
  sentimentAmplification: 0.3,
  contagionThresholdPercent: 15,
  maxContagionHops: 3,
  contagionDecayPerHop: 0.5,
};

/** Default trade linkages between major exchanges. */
const DEFAULT_TRADE_LINKAGES: readonly TradeLinkage[] = [
  { exchangeA: 'nyse', exchangeB: 'euronext', linkageStrength: 0.8 },
  { exchangeA: 'nyse', exchangeB: 'tse', linkageStrength: 0.7 },
  { exchangeA: 'nyse', exchangeB: 'sse', linkageStrength: 0.5 },
  { exchangeA: 'sse', exchangeB: 'tse', linkageStrength: 0.6 },
  { exchangeA: 'sse', exchangeB: 'moex', linkageStrength: 0.3 },
  { exchangeA: 'euronext', exchangeB: 'moex', linkageStrength: 0.4 },
  { exchangeA: 'euronext', exchangeB: 'tse', linkageStrength: 0.5 },
  { exchangeA: 'moex', exchangeB: 'tedpix', linkageStrength: 0.3 },
  { exchangeA: 'tedpix', exchangeB: 'dse', linkageStrength: 0.2 },
  { exchangeA: 'nyse', exchangeB: 'moex', linkageStrength: 0.2 },
  { exchangeA: 'pse', exchangeB: 'sse', linkageStrength: 0.15 },
  { exchangeA: 'dse', exchangeB: 'moex', linkageStrength: 0.15 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between a minimum and maximum. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Volatility profile to numeric multiplier. */
function volatilityMultiplier(profile: string): number {
  switch (profile) {
    case 'low':
      return 0.5;
    case 'medium':
      return 1.0;
    case 'high':
      return 1.5;
    case 'extreme':
      return 2.0;
    default:
      return 1.0;
  }
}

/** Generate a unique event ID from turn and index. */
function eventId(turn: number, index: number): string {
  return `mkt-${turn}-${index}`;
}

/** Standard deviation of an array of numbers. */
function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / values.length);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless stock market engine that simulates per-turn price movements,
 * exchange sentiment, cross-market contagion, and market event generation.
 *
 * All methods are pure — they accept current state and return new state
 * without mutation or side effects.
 *
 * @see FR-3300 — Stock Market Simulation
 * @see CNFL-4103 — Market Event Processing
 */
export class StockMarketEngine {
  private readonly config: StockMarketConfig;
  private readonly tradeLinkages: readonly TradeLinkage[];

  constructor(
    config: Partial<StockMarketConfig> = {},
    tradeLinkages: readonly TradeLinkage[] = DEFAULT_TRADE_LINKAGES,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tradeLinkages = tradeLinkages;
  }

  // ── Main Turn Processing ──────────────────────────────────────────────

  /**
   * Process a complete market turn: compute event impacts, update every
   * ticker, derive exchange sentiment, evaluate cross-market contagion,
   * and generate market event log entries.
   *
   * @param exchanges       Array of exchange models in the game
   * @param tickerSets      Array of nation ticker set models
   * @param currentStates   Current ticker runtime states (tickerId → state)
   * @param events          Game events that occurred this turn
   * @param turn            Current turn number
   * @param gfsi            Global Financial Stability Index (0–100, default 50)
   * @returns Complete turn result with updated states and events
   *
   * @see FR-3300
   */
  processTurn(
    exchanges: readonly StockExchangeModel[],
    tickerSets: readonly NationTickerSet[],
    currentStates: ReadonlyMap<string, TickerRuntimeState>,
    events: readonly GameMarketEvent[],
    turn: number,
    gfsi: number = 50,
  ): MarketTurnResult {
    const exchangeMap = new Map(exchanges.map((e) => [e.exchangeId, e]));
    const updatedStates = new Map<string, TickerRuntimeState>();

    // --- Phase 1: Update each ticker ---
    for (const tickerSet of tickerSets) {
      const exchange = exchangeMap.get(tickerSet.exchangeId);
      if (!exchange) continue;

      const nationEvents = events.filter(
        (e) =>
          e.sourceFaction === (exchange.nationId as FactionId) ||
          e.targetFaction === (exchange.nationId as FactionId),
      );

      for (const ticker of tickerSet.tickers) {
        const state = currentStates.get(ticker.tickerId);
        if (!state) continue;

        const eventImpact = this.computeEventImpact(
          ticker,
          nationEvents,
          exchange.volatilityProfile,
        );

        // Derive sentiment modifier from previous exchange sentiment
        const exchangeTickerStates = this.getExchangeTickerStates(
          tickerSet.exchangeId,
          currentStates,
          tickerSets,
        );
        const avgChange = this.averagePriceChange(exchangeTickerStates);
        const sentimentModifier = avgChange * this.config.sentimentAmplification;

        // Fundamentals trend from mean reversion toward initial price
        const distanceFromInitial =
          (ticker.initialPrice - state.currentPrice) / ticker.initialPrice;
        const fundamentalsTrend =
          clamp(distanceFromInitial, -1, 1) * this.config.meanReversionStrength;

        const updated = this.updateTickerPrice(
          state,
          eventImpact,
          sentimentModifier,
          fundamentalsTrend,
          turn,
          ticker.initialPrice,
        );
        updatedStates.set(ticker.tickerId, updated);
      }
    }

    // --- Phase 2: Compute exchange sentiment ---
    const sentimentStates: ExchangeSentimentState[] = [];
    for (const exchange of exchanges) {
      const tickerStatesForExchange = this.getExchangeTickerStates(
        exchange.exchangeId,
        updatedStates,
        tickerSets,
      );
      const sentiment = this.computeSentiment(
        exchange.exchangeId,
        tickerStatesForExchange,
      );
      sentimentStates.push(sentiment);
    }

    // --- Phase 3: Evaluate contagion ---
    const contagionEvents = this.evaluateContagion(
      updatedStates,
      exchanges,
      tickerSets,
      gfsi,
      turn,
    );

    // Apply contagion impacts to ticker states
    for (const contagion of contagionEvents) {
      for (const affected of contagion.affectedExchanges) {
        const affectedTickers = this.getExchangeTickerStates(
          affected.exchangeId,
          updatedStates,
          tickerSets,
        );
        for (const [tickerId, tickerState] of affectedTickers) {
          const contagionImpact = affected.impactPercent / 100;
          const newPrice = tickerState.currentPrice * (1 + contagionImpact);
          const clampedPrice = Math.max(newPrice, 0.01);
          updatedStates.set(tickerId, {
            ...tickerState,
            currentPrice: clampedPrice,
            allTimeLow: Math.min(tickerState.allTimeLow, clampedPrice),
          });
        }
      }
    }

    // --- Phase 4: Generate market events ---
    const marketEvents = this.generateMarketEvents(
      updatedStates,
      currentStates,
      exchanges,
      tickerSets,
      turn,
    );

    return {
      tickerStates: updatedStates,
      sentimentStates,
      marketEvents,
      contagionEvents,
    };
  }

  // ── Event Impact ──────────────────────────────────────────────────────

  /**
   * Compute the total price change percentage that game events impose on a
   * single ticker, accounting for the ticker's event sensitivity weights
   * and the exchange's volatility profile.
   *
   * If an event specifically targets this ticker's nation, the impact is
   * amplified by 1.5×.
   *
   * @param ticker              The sector ticker to evaluate
   * @param events              Game events relevant to this ticker's nation
   * @param exchangeVolatility  Volatility profile of the parent exchange
   * @returns Total price change percentage from all events
   *
   * @see FR-3300
   */
  computeEventImpact(
    ticker: SectorTicker,
    events: readonly GameMarketEvent[],
    exchangeVolatility: string,
  ): number {
    const volMultiplier = volatilityMultiplier(exchangeVolatility);
    const tickerVolMultiplier = ticker.volatilityMultiplier ?? 1.0;
    let totalImpact = 0;

    for (const event of events) {
      const sensitivityWeight =
        (ticker.eventSensitivityWeights as EventSensitivityWeights)[
          event.eventType
        ] ?? 0;

      let impact = event.severity * sensitivityWeight * volMultiplier * tickerVolMultiplier;

      // Amplify impact if this event specifically targets the ticker's nation
      if (event.targetFaction !== undefined) {
        impact *= 1.5;
      }

      totalImpact += impact;
    }

    return totalImpact;
  }

  // ── Ticker Price Update ───────────────────────────────────────────────

  /**
   * Compute the next-turn state for a single ticker by applying event
   * impacts, sentiment, fundamentals, mean reversion, and bounded noise.
   *
   * Uses a deterministic noise function based on turn number and ticker ID
   * for reproducibility.
   *
   * @param current            Current ticker runtime state
   * @param eventImpact        Computed event impact as a percentage
   * @param sentimentModifier  Sentiment-derived price modifier
   * @param fundamentalsTrend  Fundamentals-derived trend percentage
   * @param turn               Current turn number
   * @param initialPrice       Initial price of the ticker for mean reversion
   * @returns New ticker runtime state with updated price and history
   *
   * @see FR-3300
   */
  updateTickerPrice(
    current: TickerRuntimeState,
    eventImpact: number,
    sentimentModifier: number,
    fundamentalsTrend: number,
    turn: number,
    initialPrice: number,
  ): TickerRuntimeState {
    // Deterministic bounded noise
    const noiseSeed = Math.sin(turn * current.tickerId.charCodeAt(0));
    const noise = noiseSeed * this.config.noiseAmplitude;

    // Mean reversion: pull toward initial price proportionally to distance
    const distanceRatio =
      (initialPrice - current.currentPrice) / initialPrice;
    const meanReversion =
      clamp(distanceRatio, -1, 1) * this.config.meanReversionStrength;

    // Composite price change
    const changePercent =
      eventImpact + sentimentModifier + fundamentalsTrend + noise + meanReversion;

    const newPrice = Math.max(
      current.currentPrice * (1 + changePercent),
      0.01, // floor price at 1 cent
    );

    const change = newPrice - current.currentPrice;
    const priceChangePercent =
      current.currentPrice > 0 ? change / current.currentPrice : 0;

    // Build new price point
    const highPrice = Math.max(current.currentPrice, newPrice);
    const lowPrice = Math.min(current.currentPrice, newPrice);
    const pricePoint: TickerPricePoint = {
      turn,
      openPrice: current.currentPrice,
      closePrice: newPrice,
      highPrice,
      lowPrice,
      change,
      changePercent: priceChangePercent,
      triggeringEvents: [],
    };

    // Update all-time high/low
    const allTimeHigh = Math.max(current.allTimeHigh, newPrice);
    const allTimeLow = Math.min(current.allTimeLow, newPrice);

    // Compute trend from last 6 turns
    const recentHistory = [...current.priceHistory, pricePoint].slice(-6);
    const trendDirection = this.computeTrend(recentHistory);

    return {
      tickerId: current.tickerId,
      exchangeId: current.exchangeId,
      currentPrice: newPrice,
      previousPrice: current.currentPrice,
      allTimeHigh,
      allTimeLow,
      trendDirection,
      volume: current.volume, // volume unchanged in this simplified model
      priceHistory: [...current.priceHistory, pricePoint],
    };
  }

  // ── Exchange Sentiment ────────────────────────────────────────────────

  /**
   * Compute the sentiment state for an exchange based on the aggregate
   * price movements of all tickers on that exchange.
   *
   * Sentiment is smoothed by blending 70% of the previous sentiment score
   * with 30% of the newly computed score. Trend strength measures
   * consistency of direction, and volatility index is derived from the
   * standard deviation of recent price changes.
   *
   * @param exchangeId        The exchange to compute sentiment for
   * @param tickerStates      All ticker states for this exchange (tickerId → state)
   * @param previousSentiment Optional previous sentiment state for blending
   * @returns New exchange sentiment state
   *
   * @see FR-3300
   */
  computeSentiment(
    exchangeId: string,
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
    previousSentiment?: ExchangeSentimentState,
  ): ExchangeSentimentState {
    const changes: number[] = [];
    const majorEvents: string[] = [];

    for (const [, state] of tickerStates) {
      if (state.previousPrice > 0) {
        const pctChange =
          (state.currentPrice - state.previousPrice) / state.previousPrice;
        changes.push(pctChange);

        // Flag individual tickers with large moves as major events
        if (Math.abs(pctChange) > 0.1) {
          majorEvents.push(
            `${state.tickerId} ${pctChange > 0 ? 'surged' : 'plunged'} ${(Math.abs(pctChange) * 100).toFixed(4)}%`,
          );
        }
      }
    }

    // Compute raw sentiment score from average change
    const avgChange =
      changes.length > 0
        ? changes.reduce((s, v) => s + v, 0) / changes.length
        : 0;

    let rawScore: number;
    if (avgChange > 0.03) {
      rawScore = 20 + avgChange * 100; // bullish boost
    } else if (avgChange < -0.03) {
      rawScore = -20 + avgChange * 100; // bearish penalty
    } else {
      rawScore = avgChange * 100; // neutral zone
    }

    rawScore = clamp(rawScore, -100, 100);

    // Blend with previous sentiment (70% old + 30% new) for smoothing
    const blendedScore = previousSentiment
      ? previousSentiment.sentimentScore * 0.7 + rawScore * 0.3
      : rawScore;

    const finalScore = clamp(Math.round(blendedScore), -100, 100);

    // Determine sentiment label
    let sentiment: MarketSentiment;
    if (finalScore > 15) {
      sentiment = 'bullish';
    } else if (finalScore < -15) {
      sentiment = 'bearish';
    } else {
      sentiment = 'neutral';
    }

    // Trend strength: consistency of direction over recent price changes
    const positiveCount = changes.filter((c) => c > 0).length;
    const negativeCount = changes.filter((c) => c < 0).length;
    const dominantCount = Math.max(positiveCount, negativeCount);
    const trendStrength =
      changes.length > 0
        ? clamp(Math.round((dominantCount / changes.length) * 100), 0, 100)
        : 0;

    // Volatility index from standard deviation
    const volatilityIndex = clamp(
      Math.round(standardDeviation(changes) * 1000),
      0,
      100,
    );

    return {
      exchangeId,
      sentiment,
      sentimentScore: finalScore,
      trendStrength,
      volatilityIndex,
      majorEvents,
    };
  }

  // ── Contagion Evaluation ──────────────────────────────────────────────

  /**
   * Evaluate whether any exchange experienced a drop large enough to
   * trigger cross-market contagion, and propagate the impact through
   * trade linkages up to the configured maximum hop count.
   *
   * GFSI modulates contagion severity: low stability (< 30) amplifies
   * impact by 1.5×, while high stability (> 70) dampens it by 0.7×.
   *
   * @param tickerStates  Updated ticker states for this turn
   * @param exchanges     Array of exchange models
   * @param tickerSets    Array of nation ticker sets
   * @param gfsi          Global Financial Stability Index (0–100)
   * @param turn          Current turn number
   * @returns Array of contagion events (empty if none triggered)
   *
   * @see FR-3300
   */
  evaluateContagion(
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
    exchanges: readonly StockExchangeModel[],
    tickerSets: readonly NationTickerSet[],
    gfsi: number,
    turn: number,
  ): readonly MarketContagionEvent[] {
    const contagionEvents: MarketContagionEvent[] = [];

    // GFSI modulation factor
    let gfsiModulator: number;
    if (gfsi < 30) {
      gfsiModulator = 1.5;
    } else if (gfsi > 70) {
      gfsiModulator = 0.7;
    } else {
      gfsiModulator = 1.0;
    }

    for (const exchange of exchanges) {
      const compositeChange = this.getExchangeCompositeChange(
        exchange.exchangeId,
        tickerStates,
        tickerSets,
      );

      // Only trigger contagion on significant drops
      if (compositeChange >= -this.config.contagionThresholdPercent / 100) {
        continue;
      }

      const sourceDrop = Math.abs(compositeChange);

      // BFS propagation through trade linkages
      const affectedExchanges: { exchangeId: string; impactPercent: number }[] =
        [];
      const visited = new Set<string>([exchange.exchangeId]);
      let frontier: { exchangeId: string; hop: number; impact: number }[] = [
        { exchangeId: exchange.exchangeId, hop: 0, impact: sourceDrop },
      ];

      while (frontier.length > 0) {
        const nextFrontier: typeof frontier = [];

        for (const node of frontier) {
          if (node.hop >= this.config.maxContagionHops) continue;

          // Find all linked exchanges
          const links = this.tradeLinkages.filter(
            (l) =>
              l.exchangeA === node.exchangeId ||
              l.exchangeB === node.exchangeId,
          );

          for (const link of links) {
            const linkedId =
              link.exchangeA === node.exchangeId
                ? link.exchangeB
                : link.exchangeA;

            if (visited.has(linkedId)) continue;
            visited.add(linkedId);

            const propagatedImpact =
              node.impact *
              link.linkageStrength *
              Math.pow(this.config.contagionDecayPerHop, node.hop + 1) *
              gfsiModulator;

            if (propagatedImpact > 0.001) {
              // Only record meaningful impacts
              affectedExchanges.push({
                exchangeId: linkedId,
                impactPercent: -propagatedImpact * 100, // negative = drop
              });

              nextFrontier.push({
                exchangeId: linkedId,
                hop: node.hop + 1,
                impact: propagatedImpact,
              });
            }
          }
        }

        frontier = nextFrontier;
      }

      if (affectedExchanges.length > 0) {
        const totalCapLoss = affectedExchanges.reduce(
          (sum, a) => sum + Math.abs(a.impactPercent),
          0,
        );

        contagionEvents.push({
          sourceExchange: exchange.exchangeId,
          triggerEvent: `Exchange ${exchange.exchangeId} dropped ${(sourceDrop * 100).toFixed(4)}%`,
          affectedExchanges,
          hopDepth: Math.max(...affectedExchanges.map(() => 1), 0),
          gfsiAtTime: gfsi,
          totalMarketCapLoss: totalCapLoss,
          turn,
        });
      }
    }

    return contagionEvents;
  }

  // ── Market Event Generation ───────────────────────────────────────────

  /**
   * Generate market event log entries by analysing ticker state changes
   * for significant crash, rally, and sector-rotation patterns.
   *
   * @param updatedStates   Ticker states after this turn's updates
   * @param previousStates  Ticker states from before this turn
   * @param exchanges       Array of exchange models
   * @param tickerSets      Array of nation ticker sets
   * @param turn            Current turn number
   * @returns Array of market event log entries
   *
   * @see FR-3300
   */
  generateMarketEvents(
    updatedStates: ReadonlyMap<string, TickerRuntimeState>,
    previousStates: ReadonlyMap<string, TickerRuntimeState>,
    exchanges: readonly StockExchangeModel[],
    tickerSets: readonly NationTickerSet[],
    turn: number,
  ): readonly MarketEventLogEntry[] {
    const events: MarketEventLogEntry[] = [];
    let eventIndex = 0;

    for (const exchange of exchanges) {
      const compositeChange = this.getExchangeCompositeChange(
        exchange.exchangeId,
        updatedStates,
        tickerSets,
      );

      // Crash: composite drops > 20%
      if (compositeChange < -0.2) {
        events.push({
          eventId: eventId(turn, eventIndex++),
          turn,
          eventType: 'crash',
          affectedExchanges: [exchange.exchangeId],
          magnitude: Math.abs(compositeChange),
          cause: `${exchange.exchangeName} composite crashed ${(Math.abs(compositeChange) * 100).toFixed(4)}%`,
          resolved: false,
        });
      }

      // Rally: composite rises > 15%
      if (compositeChange > 0.15) {
        events.push({
          eventId: eventId(turn, eventIndex++),
          turn,
          eventType: 'rally',
          affectedExchanges: [exchange.exchangeId],
          magnitude: compositeChange,
          cause: `${exchange.exchangeName} composite rallied ${(compositeChange * 100).toFixed(4)}%`,
          resolved: false,
        });
      }
    }

    // Sector rotation detection: look for defense up + consumer down patterns
    const sectorChanges = this.computeSectorChanges(
      updatedStates,
      previousStates,
      tickerSets,
    );

    const defenseChange = sectorChanges.get('defense') ?? 0;
    const consumerChange = sectorChanges.get('consumer') ?? 0;

    if (defenseChange > 0.05 && consumerChange < -0.05) {
      events.push({
        eventId: eventId(turn, eventIndex++),
        turn,
        eventType: 'sector-rotation',
        affectedExchanges: [],
        magnitude: defenseChange - consumerChange,
        cause: 'Rotation from consumer to defense sector detected',
        resolved: false,
      });
    }

    const energyChange = sectorChanges.get('energy') ?? 0;
    const techChange = sectorChanges.get('technology') ?? 0;

    if (energyChange > 0.05 && techChange < -0.05) {
      events.push({
        eventId: eventId(turn, eventIndex++),
        turn,
        eventType: 'sector-rotation',
        affectedExchanges: [],
        magnitude: energyChange - techChange,
        cause: 'Rotation from technology to energy sector detected',
        resolved: false,
      });
    }

    return events;
  }

  // ── Composite Change ──────────────────────────────────────────────────

  /**
   * Compute the weighted average price change for all tickers on a given
   * exchange. Uses equal weights when sector weights are unavailable.
   *
   * @param exchangeId    The exchange to compute the composite for
   * @param tickerStates  Current ticker runtime states
   * @param tickerSets    Nation ticker sets (to identify which tickers belong to the exchange)
   * @returns Weighted average price change as a decimal (e.g. -0.05 = -5%)
   *
   * @see FR-3300
   */
  getExchangeCompositeChange(
    exchangeId: string,
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
    tickerSets: readonly NationTickerSet[],
  ): number {
    const tickerSet = tickerSets.find((ts) => ts.exchangeId === exchangeId);
    if (!tickerSet || tickerSet.tickers.length === 0) return 0;

    let totalWeight = 0;
    let weightedChange = 0;

    for (const ticker of tickerSet.tickers) {
      const state = tickerStates.get(ticker.tickerId);
      if (!state || state.previousPrice <= 0) continue;

      const weight = 1.0 / tickerSet.tickers.length; // equal weights
      const change =
        (state.currentPrice - state.previousPrice) / state.previousPrice;

      weightedChange += change * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedChange / totalWeight : 0;
  }

  // ── Trend Computation ─────────────────────────────────────────────────

  /**
   * Determine the market trend direction from a window of price history.
   *
   * - **Rising**: ≥ 4 of the last 6 (or windowSize) turns had positive change
   * - **Falling**: ≥ 4 of the last 6 turns had negative change
   * - **Flat**: otherwise
   *
   * @param history     Array of price points to analyse
   * @param windowSize  Number of recent turns to consider (default 6)
   * @returns Trend direction
   *
   * @see FR-3300
   */
  computeTrend(
    history: readonly TickerPricePoint[],
    windowSize: number = 6,
  ): MarketTrend {
    const recent = history.slice(-windowSize);
    if (recent.length < 2) return 'flat';

    const threshold = Math.ceil(recent.length * (2 / 3));
    const positiveCount = recent.filter((p) => p.changePercent > 0).length;
    const negativeCount = recent.filter((p) => p.changePercent < 0).length;

    if (positiveCount >= threshold) return 'rising';
    if (negativeCount >= threshold) return 'falling';
    return 'flat';
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Retrieve all ticker states belonging to a specific exchange.
   *
   * @param exchangeId   The exchange to filter for
   * @param allStates    All ticker runtime states
   * @param tickerSets   Nation ticker sets for exchange mapping
   * @returns Map of tickerId → TickerRuntimeState for the exchange
   */
  private getExchangeTickerStates(
    exchangeId: string,
    allStates: ReadonlyMap<string, TickerRuntimeState>,
    tickerSets: readonly NationTickerSet[],
  ): ReadonlyMap<string, TickerRuntimeState> {
    const result = new Map<string, TickerRuntimeState>();
    const tickerSet = tickerSets.find((ts) => ts.exchangeId === exchangeId);
    if (!tickerSet) return result;

    for (const ticker of tickerSet.tickers) {
      const state = allStates.get(ticker.tickerId);
      if (state) {
        result.set(ticker.tickerId, state);
      }
    }

    return result;
  }

  /**
   * Compute the average price change across a set of ticker states.
   *
   * @param tickerStates Map of ticker states to average
   * @returns Average price change as a decimal
   */
  private averagePriceChange(
    tickerStates: ReadonlyMap<string, TickerRuntimeState>,
  ): number {
    const changes: number[] = [];

    for (const [, state] of tickerStates) {
      if (state.previousPrice > 0) {
        changes.push(
          (state.currentPrice - state.previousPrice) / state.previousPrice,
        );
      }
    }

    return changes.length > 0
      ? changes.reduce((s, v) => s + v, 0) / changes.length
      : 0;
  }

  /**
   * Compute aggregate price changes per sector across all ticker sets.
   *
   * @param updatedStates   Ticker states after updates
   * @param previousStates  Ticker states before updates
   * @param tickerSets      Nation ticker sets
   * @returns Map of sector name → average price change
   */
  private computeSectorChanges(
    updatedStates: ReadonlyMap<string, TickerRuntimeState>,
    previousStates: ReadonlyMap<string, TickerRuntimeState>,
    tickerSets: readonly NationTickerSet[],
  ): ReadonlyMap<string, number> {
    const sectorTotals = new Map<string, { sum: number; count: number }>();

    for (const tickerSet of tickerSets) {
      for (const ticker of tickerSet.tickers) {
        const updated = updatedStates.get(ticker.tickerId);
        const previous = previousStates.get(ticker.tickerId);
        if (!updated || !previous || previous.currentPrice <= 0) continue;

        const change =
          (updated.currentPrice - previous.currentPrice) /
          previous.currentPrice;

        const existing = sectorTotals.get(ticker.sectorName) ?? {
          sum: 0,
          count: 0,
        };
        sectorTotals.set(ticker.sectorName, {
          sum: existing.sum + change,
          count: existing.count + 1,
        });
      }
    }

    const result = new Map<string, number>();
    for (const [sector, { sum, count }] of sectorTotals) {
      result.set(sector, count > 0 ? sum / count : 0);
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Global Sentiment Aggregation — FR-3306
  // -----------------------------------------------------------------------

  /**
   * Aggregate per-exchange sentiment states into a single global sentiment
   * reading, weighted equally across all active exchanges.
   *
   * @param sentimentStates  Record of exchangeId → ExchangeSentimentState
   * @returns Aggregated global sentiment
   *
   * @see FR-3306
   */
  computeGlobalSentiment(
    sentimentStates: Readonly<Record<string, ExchangeSentimentState>>,
  ): GlobalSentiment {
    const entries = Object.values(sentimentStates);
    const exchangeCount = entries.length;

    if (exchangeCount === 0) {
      return {
        sentiment: 'neutral',
        sentimentScore: 0,
        exchangeCount: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        averageVolatility: 0,
      };
    }

    let totalScore = 0;
    let totalVolatility = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    for (const s of entries) {
      totalScore += s.sentimentScore;
      totalVolatility += s.volatilityIndex;
      if (s.sentiment === 'bullish') bullishCount++;
      else if (s.sentiment === 'bearish') bearishCount++;
      else neutralCount++;
    }

    const avgScore = Math.round(totalScore / exchangeCount);
    const clampedScore = Math.max(-100, Math.min(100, avgScore));

    let sentiment: MarketSentiment;
    if (clampedScore > 15) sentiment = 'bullish';
    else if (clampedScore < -15) sentiment = 'bearish';
    else sentiment = 'neutral';

    return {
      sentiment,
      sentimentScore: clampedScore,
      exchangeCount,
      bullishCount,
      bearishCount,
      neutralCount,
      averageVolatility: Math.round(totalVolatility / exchangeCount),
    };
  }
}
