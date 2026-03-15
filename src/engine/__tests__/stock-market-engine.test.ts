import { describe, it, expect } from 'vitest';
import { StockMarketEngine } from '@/engine/stock-market-engine';
import type { GameMarketEvent, StockMarketConfig, TradeLinkage } from '@/engine/stock-market-engine';
import type {
  StockExchangeModel,
  NationTickerSet,
  SectorTicker,
  TickerRuntimeState,
  TickerPricePoint,
  VolatilityProfile,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExchange(overrides: Partial<StockExchangeModel> = {}): StockExchangeModel {
  return {
    schemaVersion: '1.0.0',
    exchangeId: 'nyse',
    exchangeName: 'New York Stock Exchange',
    nationId: 'us',
    baseIndexValue: 42000,
    volatilityProfile: 'medium',
    currencyCode: 'USD',
    ...overrides,
  };
}

function makeTicker(overrides: Partial<SectorTicker> = {}): SectorTicker {
  return {
    tickerId: 'us-defense',
    sectorName: 'defense',
    initialPrice: 320,
    eventSensitivityWeights: {
      'military-conflict': 3,
      'sanctions-imposed': -1,
      'tech-breakthrough': 1,
      'civil-unrest': -2,
      'trade-deal': 0.5,
      'oil-disruption': 0,
      'regime-change': -3,
      'natural-disaster': -1,
    },
    volatilityMultiplier: 1.0,
    ...overrides,
  };
}

function makeTickerSet(overrides: Partial<NationTickerSet> = {}): NationTickerSet {
  return {
    schemaVersion: '1.0.0',
    nationId: 'us',
    exchangeId: 'nyse',
    tickers: [makeTicker()],
    ...overrides,
  };
}

function makeTickerState(overrides: Partial<TickerRuntimeState> = {}): TickerRuntimeState {
  return {
    tickerId: 'us-defense',
    exchangeId: 'nyse',
    currentPrice: 320,
    previousPrice: 310,
    allTimeHigh: 330,
    allTimeLow: 290,
    trendDirection: 'flat',
    volume: 1000,
    priceHistory: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<GameMarketEvent> = {}): GameMarketEvent {
  return {
    eventType: 'military-conflict',
    severity: 0.5,
    sourceFaction: 'us',
    turn: 1,
    ...overrides,
  };
}

function makePricePoint(overrides: Partial<TickerPricePoint> = {}): TickerPricePoint {
  return {
    turn: 1,
    openPrice: 310,
    closePrice: 320,
    highPrice: 325,
    lowPrice: 308,
    change: 10,
    changePercent: 0.032,
    triggeringEvents: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StockMarketEngine', () => {
  const engine = new StockMarketEngine();

  // ── Constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      const e = new StockMarketEngine();
      // Engine should be usable — just call a method to verify it works
      const trend = e.computeTrend([]);
      expect(trend).toBe('flat');
    });

    it('merges partial config with defaults', () => {
      const custom = new StockMarketEngine({ noiseAmplitude: 0.05 });
      // Should still work; the only way to verify config is through behaviour
      const trend = custom.computeTrend([]);
      expect(trend).toBe('flat');
    });
  });

  // ── computeEventImpact ──────────────────────────────────────────────

  describe('computeEventImpact', () => {
    it('returns 0 when no events are provided', () => {
      const ticker = makeTicker();
      const impact = engine.computeEventImpact(ticker, [], 'medium');
      expect(impact).toBe(0);
    });

    it('applies sensitivity weights correctly', () => {
      const ticker = makeTicker({
        eventSensitivityWeights: { 'military-conflict': 3 },
        volatilityMultiplier: 1.0,
      });
      const events = [makeEvent({ eventType: 'military-conflict', severity: 0.5 })];
      // impact = severity(0.5) × sensitivity(3) × volMultiplier(1.0 for medium) × tickerVol(1.0) = 1.5
      // No targetFaction so no 1.5x amplification
      const impact = engine.computeEventImpact(ticker, events, 'medium');
      expect(impact).toBe(1.5);
    });

    it('amplifies impact when event has a targetFaction', () => {
      const ticker = makeTicker({
        eventSensitivityWeights: { 'military-conflict': 2 },
        volatilityMultiplier: 1.0,
      });
      const events = [
        makeEvent({
          eventType: 'military-conflict',
          severity: 0.5,
          targetFaction: 'us',
        }),
      ];
      // impact = 0.5 × 2 × 1.0 × 1.0 × 1.5 (targetFaction amplification) = 1.5
      const impact = engine.computeEventImpact(ticker, events, 'medium');
      expect(impact).toBe(1.5);
    });

    it('scales with exchange volatility profile', () => {
      const ticker = makeTicker({
        eventSensitivityWeights: { 'military-conflict': 2 },
        volatilityMultiplier: 1.0,
      });
      const events = [makeEvent({ eventType: 'military-conflict', severity: 1.0 })];

      const impactMedium = engine.computeEventImpact(ticker, events, 'medium');
      const impactHigh = engine.computeEventImpact(ticker, events, 'high');
      const impactExtreme = engine.computeEventImpact(ticker, events, 'extreme');

      // medium = 1.0, high = 1.5, extreme = 2.0
      expect(impactHigh).toBeGreaterThan(impactMedium);
      expect(impactExtreme).toBeGreaterThan(impactHigh);
    });

    it('sums impact from multiple events', () => {
      const ticker = makeTicker({
        eventSensitivityWeights: {
          'military-conflict': 2,
          'trade-deal': 1,
        },
        volatilityMultiplier: 1.0,
      });
      const events = [
        makeEvent({ eventType: 'military-conflict', severity: 0.5 }),
        makeEvent({ eventType: 'trade-deal', severity: 0.3 }),
      ];
      // Event 1: 0.5 × 2 × 1.0 × 1.0 = 1.0, Event 2: 0.3 × 1 × 1.0 × 1.0 = 0.3 → total = 1.3
      const impact = engine.computeEventImpact(ticker, events, 'medium');
      expect(impact).toBeCloseTo(1.3, 5);
    });
  });

  // ── updateTickerPrice ────────────────────────────────────────────────

  describe('updateTickerPrice', () => {
    it('applies positive event impact to increase price', () => {
      const state = makeTickerState({ currentPrice: 100, previousPrice: 100 });
      const updated = engine.updateTickerPrice(state, 0.10, 0, 0, 1, 100);
      expect(updated.currentPrice).toBeGreaterThan(100);
    });

    it('applies negative event impact to decrease price', () => {
      const state = makeTickerState({ currentPrice: 100, previousPrice: 100 });
      const updated = engine.updateTickerPrice(state, -0.10, 0, 0, 1, 100);
      expect(updated.currentPrice).toBeLessThan(100);
    });

    it('updates allTimeHigh when price exceeds it', () => {
      const state = makeTickerState({
        currentPrice: 100,
        previousPrice: 90,
        allTimeHigh: 105,
        allTimeLow: 80,
      });
      // Large positive impact should push past 105
      const updated = engine.updateTickerPrice(state, 0.20, 0, 0, 1, 100);
      expect(updated.allTimeHigh).toBeGreaterThanOrEqual(state.allTimeHigh);
    });

    it('updates allTimeLow when price falls below it', () => {
      const state = makeTickerState({
        currentPrice: 85,
        previousPrice: 90,
        allTimeHigh: 105,
        allTimeLow: 82,
      });
      // Large negative impact should push below 82
      const updated = engine.updateTickerPrice(state, -0.10, 0, 0, 1, 100);
      expect(updated.allTimeLow).toBeLessThanOrEqual(state.allTimeLow);
    });

    it('adds to price history', () => {
      const state = makeTickerState({ priceHistory: [] });
      const updated = engine.updateTickerPrice(state, 0.01, 0, 0, 1, 320);
      expect(updated.priceHistory).toHaveLength(1);
      expect(updated.priceHistory[0].turn).toBe(1);
    });

    it('never allows price below 0.01', () => {
      const state = makeTickerState({ currentPrice: 1 });
      const updated = engine.updateTickerPrice(state, -10, 0, 0, 1, 100);
      expect(updated.currentPrice).toBeGreaterThanOrEqual(0.01);
    });

    it('preserves tickerId in updated state', () => {
      const state = makeTickerState({ tickerId: 'cn-energy' });
      const updated = engine.updateTickerPrice(state, 0.01, 0, 0, 1, 100);
      expect(updated.tickerId).toBe('cn-energy');
    });
  });

  // ── computeSentiment ─────────────────────────────────────────────────

  describe('computeSentiment', () => {
    it('returns bullish for tickers with significant positive changes', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['t1', makeTickerState({ tickerId: 't1', currentPrice: 115, previousPrice: 100 })],
        ['t2', makeTickerState({ tickerId: 't2', currentPrice: 112, previousPrice: 100 })],
      ]);
      const sentiment = engine.computeSentiment('nyse', states);
      expect(sentiment.sentiment).toBe('bullish');
      expect(sentiment.sentimentScore).toBeGreaterThan(0);
    });

    it('returns bearish for tickers with significant negative changes', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['t1', makeTickerState({ tickerId: 't1', currentPrice: 80, previousPrice: 100 })],
        ['t2', makeTickerState({ tickerId: 't2', currentPrice: 82, previousPrice: 100 })],
      ]);
      const sentiment = engine.computeSentiment('nyse', states);
      expect(sentiment.sentiment).toBe('bearish');
      expect(sentiment.sentimentScore).toBeLessThan(0);
    });

    it('returns neutral for mixed changes', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['t1', makeTickerState({ tickerId: 't1', currentPrice: 101, previousPrice: 100 })],
        ['t2', makeTickerState({ tickerId: 't2', currentPrice: 99, previousPrice: 100 })],
      ]);
      const sentiment = engine.computeSentiment('nyse', states);
      expect(sentiment.sentiment).toBe('neutral');
    });

    it('blends with previous sentiment (70/30)', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['t1', makeTickerState({ tickerId: 't1', currentPrice: 115, previousPrice: 100 })],
      ]);
      const prev = {
        exchangeId: 'nyse',
        sentiment: 'bearish' as const,
        sentimentScore: -50,
        trendStrength: 60,
        volatilityIndex: 10,
        majorEvents: [],
      };
      const sentiment = engine.computeSentiment('nyse', states, prev);
      // Blended: 70% of -50 + 30% of new (positive)
      // Should be less extreme than pure positive
      expect(sentiment.sentimentScore).toBeLessThan(50);
    });

    it('includes volatilityIndex and trendStrength', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['t1', makeTickerState({ tickerId: 't1', currentPrice: 120, previousPrice: 100 })],
      ]);
      const sentiment = engine.computeSentiment('nyse', states);
      expect(typeof sentiment.volatilityIndex).toBe('number');
      expect(typeof sentiment.trendStrength).toBe('number');
      expect(sentiment.exchangeId).toBe('nyse');
    });
  });

  // ── evaluateContagion ────────────────────────────────────────────────

  describe('evaluateContagion', () => {
    it('returns empty for small drops below threshold', () => {
      // Small drop (5%) should not trigger contagion (threshold 15%)
      const states = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', exchangeId: 'nyse', currentPrice: 95, previousPrice: 100 })],
      ]);
      const exchanges = [makeExchange()];
      const tickerSets = [makeTickerSet()];

      const contagion = engine.evaluateContagion(states, exchanges, tickerSets, 50, 1);
      expect(contagion).toHaveLength(0);
    });

    it('triggers contagion for large drops exceeding threshold', () => {
      // Large drop (20%) should trigger contagion
      const customEngine = new StockMarketEngine(
        { contagionThresholdPercent: 15 },
        [{ exchangeA: 'nyse', exchangeB: 'euronext', linkageStrength: 0.8 }],
      );
      const states = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', exchangeId: 'nyse', currentPrice: 75, previousPrice: 100 })],
      ]);
      const exchanges = [makeExchange(), makeExchange({ exchangeId: 'euronext', nationId: 'eu' })];
      const tickerSets = [makeTickerSet()];

      const contagion = customEngine.evaluateContagion(states, exchanges, tickerSets, 50, 1);
      expect(contagion.length).toBeGreaterThan(0);
      if (contagion.length > 0) {
        expect(contagion[0].sourceExchange).toBe('nyse');
      }
    });
  });

  // ── computeTrend ─────────────────────────────────────────────────────

  describe('computeTrend', () => {
    it('returns flat for fewer than 2 data points', () => {
      expect(engine.computeTrend([])).toBe('flat');
      expect(engine.computeTrend([makePricePoint()])).toBe('flat');
    });

    it('returns rising for mostly positive history', () => {
      const history: TickerPricePoint[] = [
        makePricePoint({ turn: 1, changePercent: 0.05 }),
        makePricePoint({ turn: 2, changePercent: 0.03 }),
        makePricePoint({ turn: 3, changePercent: 0.04 }),
        makePricePoint({ turn: 4, changePercent: 0.02 }),
        makePricePoint({ turn: 5, changePercent: 0.01 }),
        makePricePoint({ turn: 6, changePercent: 0.03 }),
      ];
      expect(engine.computeTrend(history)).toBe('rising');
    });

    it('returns falling for mostly negative history', () => {
      const history: TickerPricePoint[] = [
        makePricePoint({ turn: 1, changePercent: -0.05 }),
        makePricePoint({ turn: 2, changePercent: -0.03 }),
        makePricePoint({ turn: 3, changePercent: -0.04 }),
        makePricePoint({ turn: 4, changePercent: -0.02 }),
        makePricePoint({ turn: 5, changePercent: -0.01 }),
        makePricePoint({ turn: 6, changePercent: -0.03 }),
      ];
      expect(engine.computeTrend(history)).toBe('falling');
    });

    it('returns flat for mixed positive/negative history', () => {
      const history: TickerPricePoint[] = [
        makePricePoint({ turn: 1, changePercent: 0.05 }),
        makePricePoint({ turn: 2, changePercent: -0.03 }),
        makePricePoint({ turn: 3, changePercent: 0.04 }),
        makePricePoint({ turn: 4, changePercent: -0.02 }),
        makePricePoint({ turn: 5, changePercent: 0.01 }),
        makePricePoint({ turn: 6, changePercent: -0.03 }),
      ];
      expect(engine.computeTrend(history)).toBe('flat');
    });

    it('uses configurable window size', () => {
      const history: TickerPricePoint[] = [
        makePricePoint({ turn: 1, changePercent: -0.05 }),
        makePricePoint({ turn: 2, changePercent: -0.03 }),
        makePricePoint({ turn: 3, changePercent: 0.04 }),
        makePricePoint({ turn: 4, changePercent: 0.02 }),
        makePricePoint({ turn: 5, changePercent: 0.01 }),
      ];
      // Window of 3 (last 3 turns: 0.04, 0.02, 0.01 — all positive → rising)
      expect(engine.computeTrend(history, 3)).toBe('rising');
    });
  });

  // ── getExchangeCompositeChange ───────────────────────────────────────

  describe('getExchangeCompositeChange', () => {
    it('returns 0 when no tickers found for exchange', () => {
      const change = engine.getExchangeCompositeChange(
        'unknown-exchange',
        new Map(),
        [],
      );
      expect(change).toBe(0);
    });

    it('computes weighted average of ticker changes', () => {
      const states = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', currentPrice: 110, previousPrice: 100 })],
        ['us-energy', makeTickerState({ tickerId: 'us-energy', currentPrice: 105, previousPrice: 100 })],
      ]);
      const tickerSets = [
        makeTickerSet({
          tickers: [
            makeTicker({ tickerId: 'us-defense' }),
            makeTicker({ tickerId: 'us-energy', sectorName: 'energy' }),
          ],
        }),
      ];
      const change = engine.getExchangeCompositeChange('nyse', states, tickerSets);
      // Equal weight: avg of 10% and 5% = 7.5%
      expect(change).toBeCloseTo(0.075, 2);
    });
  });

  // ── generateMarketEvents ─────────────────────────────────────────────

  describe('generateMarketEvents', () => {
    it('generates crash event when composite drops > 20%', () => {
      const previousStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', currentPrice: 100, previousPrice: 100 })],
      ]);
      const updatedStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', currentPrice: 70, previousPrice: 100 })],
      ]);
      const exchanges = [makeExchange()];
      const tickerSets = [makeTickerSet()];

      const events = engine.generateMarketEvents(updatedStates, previousStates, exchanges, tickerSets, 1);
      const crashes = events.filter((e) => e.eventType === 'crash');
      expect(crashes.length).toBeGreaterThan(0);
    });

    it('generates rally event when composite rises > 15%', () => {
      const previousStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', currentPrice: 100, previousPrice: 100 })],
      ]);
      const updatedStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState({ tickerId: 'us-defense', currentPrice: 120, previousPrice: 100 })],
      ]);
      const exchanges = [makeExchange()];
      const tickerSets = [makeTickerSet()];

      const events = engine.generateMarketEvents(updatedStates, previousStates, exchanges, tickerSets, 1);
      const rallies = events.filter((e) => e.eventType === 'rally');
      expect(rallies.length).toBeGreaterThan(0);
    });
  });
});
