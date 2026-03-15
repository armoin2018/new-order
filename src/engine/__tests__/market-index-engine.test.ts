import { describe, it, expect } from 'vitest';
import { MarketIndexEngine } from '@/engine/market-index-engine';
import type { CustomIndexInput } from '@/engine/market-index-engine';
import type {
  MarketIndexModel,
  TickerRuntimeState,
  IndexRuntimeState,
  TickerPricePoint,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeIndex(overrides: Partial<MarketIndexModel> = {}): MarketIndexModel {
  return {
    schemaVersion: '1.0.0',
    indexId: 'global-defense',
    indexName: 'Global Defense Index',
    indexType: 'preset',
    constituentTickers: [
      { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.5 },
      { tickerId: 'cn-defense', exchangeId: 'sse', weight: 0.5 },
    ],
    baseValue: 100,
    ...overrides,
  };
}

function makeTickerState(
  tickerId: string,
  currentPrice: number,
  initialOpenPrice?: number,
): TickerRuntimeState {
  const openPrice = initialOpenPrice ?? currentPrice;
  return {
    tickerId,
    exchangeId: 'nyse',
    currentPrice,
    previousPrice: currentPrice * 0.98,
    allTimeHigh: currentPrice * 1.1,
    allTimeLow: currentPrice * 0.8,
    trendDirection: 'flat',
    volume: 1000,
    priceHistory: [
      {
        turn: 0,
        openPrice,
        closePrice: openPrice,
        highPrice: openPrice,
        lowPrice: openPrice,
        change: 0,
        changePercent: 0,
        triggeringEvents: [],
      },
    ],
  };
}

function makeIndexState(overrides: Partial<IndexRuntimeState> = {}): IndexRuntimeState {
  return {
    indexId: 'global-defense',
    currentValue: 100,
    allTimeHigh: 110,
    allTimeLow: 90,
    trendDirection: 'flat',
    createdOnTurn: 0,
    history: [
      { turn: 0, value: 100, change: 0, changePercent: 0 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketIndexEngine', () => {
  const engine = new MarketIndexEngine();

  // ── computeIndexValue ────────────────────────────────────────────────

  describe('computeIndexValue', () => {
    it('returns baseValue when no tickers found', () => {
      const index = makeIndex();
      const emptyMap = new Map<string, TickerRuntimeState>();
      const value = engine.computeIndexValue(index, emptyMap);
      expect(value).toBe(100); // baseValue
    });

    it('computes weighted average correctly', () => {
      const index = makeIndex({
        constituentTickers: [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.5 },
          { tickerId: 'cn-defense', exchangeId: 'sse', weight: 0.5 },
        ],
        baseValue: 100,
      });
      // Both tickers at exactly their initial price → ratio = 1.0
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 100, 100)],
        ['cn-defense', makeTickerState('cn-defense', 200, 200)],
      ]);
      const value = engine.computeIndexValue(index, tickerStates);
      // Each ratio = 1.0, weighted sum = (1.0×0.5 + 1.0×0.5) = 1.0
      // value = (1.0 / 1.0) × 100 = 100
      expect(value).toBeCloseTo(100, 1);
    });

    it('reflects price increases proportionally', () => {
      const index = makeIndex({
        constituentTickers: [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 1.0 },
        ],
        baseValue: 100,
      });
      // Ticker doubled from initial
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 200, 100)],
      ]);
      const value = engine.computeIndexValue(index, tickerStates);
      // ratio = 200/100 = 2.0, value = (2.0/1.0) × 100 = 200
      expect(value).toBeCloseTo(200, 1);
    });

    it('handles missing tickers gracefully', () => {
      const index = makeIndex({
        constituentTickers: [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.5 },
          { tickerId: 'missing-ticker', exchangeId: 'sse', weight: 0.5 },
        ],
        baseValue: 100,
      });
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 100, 100)],
      ]);
      // Only us-defense found, ratio = 1.0, weight normalised to 1.0
      const value = engine.computeIndexValue(index, tickerStates);
      expect(value).toBeCloseTo(100, 1);
    });
  });

  // ── updateAllIndexes ─────────────────────────────────────────────────

  describe('updateAllIndexes', () => {
    it('creates new state for fresh index', () => {
      const index = makeIndex();
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 100, 100)],
        ['cn-defense', makeTickerState('cn-defense', 100, 100)],
      ]);
      const previousStates = new Map<string, IndexRuntimeState>();

      const result = engine.updateAllIndexes([index], tickerStates, previousStates, 1);
      const state = result.get('global-defense');

      expect(state).toBeDefined();
      expect(state!.createdOnTurn).toBe(1);
      expect(state!.trendDirection).toBe('flat');
      expect(state!.history).toHaveLength(1);
    });

    it('preserves and appends history', () => {
      const index = makeIndex();
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 100, 100)],
        ['cn-defense', makeTickerState('cn-defense', 100, 100)],
      ]);
      const previousStates = new Map<string, IndexRuntimeState>([
        ['global-defense', makeIndexState({ history: [{ turn: 0, value: 100, change: 0, changePercent: 0 }] })],
      ]);

      const result = engine.updateAllIndexes([index], tickerStates, previousStates, 1);
      const state = result.get('global-defense');

      expect(state).toBeDefined();
      expect(state!.history.length).toBeGreaterThanOrEqual(2);
    });

    it('tracks allTimeHigh', () => {
      const index = makeIndex({
        constituentTickers: [{ tickerId: 'us-defense', exchangeId: 'nyse', weight: 1.0 }],
        baseValue: 100,
      });
      const tickerStates = new Map<string, TickerRuntimeState>([
        ['us-defense', makeTickerState('us-defense', 200, 100)], // 2x initial
      ]);
      const previousStates = new Map<string, IndexRuntimeState>([
        ['global-defense', makeIndexState({ allTimeHigh: 150, currentValue: 150 })],
      ]);

      const result = engine.updateAllIndexes([index], tickerStates, previousStates, 2);
      const state = result.get('global-defense');
      expect(state!.allTimeHigh).toBeGreaterThanOrEqual(150);
    });
  });

  // ── getIndexTrend ────────────────────────────────────────────────────

  describe('getIndexTrend', () => {
    it('returns rising for increasing history', () => {
      const state = makeIndexState({
        history: [
          { turn: 1, value: 100, change: 5, changePercent: 0.05 },
          { turn: 2, value: 105, change: 5, changePercent: 0.048 },
          { turn: 3, value: 110, change: 5, changePercent: 0.045 },
          { turn: 4, value: 115, change: 5, changePercent: 0.043 },
          { turn: 5, value: 120, change: 5, changePercent: 0.042 },
          { turn: 6, value: 125, change: 5, changePercent: 0.040 },
        ],
      });
      expect(engine.getIndexTrend(state)).toBe('rising');
    });

    it('returns flat for mixed history', () => {
      const state = makeIndexState({
        history: [
          { turn: 1, value: 100, change: 5, changePercent: 0.05 },
          { turn: 2, value: 105, change: -3, changePercent: -0.03 },
          { turn: 3, value: 102, change: 4, changePercent: 0.04 },
          { turn: 4, value: 106, change: -2, changePercent: -0.02 },
          { turn: 5, value: 104, change: 1, changePercent: 0.01 },
          { turn: 6, value: 105, change: -1, changePercent: -0.01 },
        ],
      });
      expect(engine.getIndexTrend(state)).toBe('flat');
    });

    it('returns flat for fewer than 2 history entries', () => {
      const state = makeIndexState({ history: [{ turn: 1, value: 100, change: 0, changePercent: 0 }] });
      expect(engine.getIndexTrend(state)).toBe('flat');
    });
  });

  // ── createCustomIndex ────────────────────────────────────────────────

  describe('createCustomIndex', () => {
    it('succeeds with valid input', () => {
      const input: CustomIndexInput = {
        indexName: 'My Tech Index',
        constituentTickers: [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.6 },
          { tickerId: 'cn-defense', exchangeId: 'sse', weight: 0.4 },
        ],
        description: 'Test custom index',
      };
      const allTickers = new Set(['us-defense', 'cn-defense']);

      const result = engine.createCustomIndex(input, [], allTickers);
      expect(result.success).toBe(true);
      expect(result.index).toBeDefined();
      expect(result.index!.indexType).toBe('custom');
      expect(result.index!.indexId).toBe('custom-my-tech-index');
    });

    it('fails when max custom indexes exceeded', () => {
      const existing = Array.from({ length: 10 }, (_, i) =>
        makeIndex({ indexId: `custom-idx-${i}`, indexType: 'custom' }),
      );
      const input: CustomIndexInput = {
        indexName: 'Overflow',
        constituentTickers: [{ tickerId: 'us-defense', exchangeId: 'nyse', weight: 1.0 }],
      };
      const allTickers = new Set(['us-defense']);

      const result = engine.createCustomIndex(input, existing, allTickers);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum');
    });

    it('fails when weights do not sum to ~1.0', () => {
      const input: CustomIndexInput = {
        indexName: 'Bad Weights',
        constituentTickers: [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.3 },
          { tickerId: 'cn-defense', exchangeId: 'sse', weight: 0.2 },
        ],
      };
      const allTickers = new Set(['us-defense', 'cn-defense']);

      const result = engine.createCustomIndex(input, [], allTickers);
      expect(result.success).toBe(false);
      expect(result.error).toContain('weights');
    });

    it('fails when ticker does not exist', () => {
      const input: CustomIndexInput = {
        indexName: 'Missing Ticker',
        constituentTickers: [
          { tickerId: 'nonexistent', exchangeId: 'nyse', weight: 1.0 },
        ],
      };
      const allTickers = new Set(['us-defense']);

      const result = engine.createCustomIndex(input, [], allTickers);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown ticker');
    });
  });

  // ── deleteCustomIndex ────────────────────────────────────────────────

  describe('deleteCustomIndex', () => {
    it('removes custom index', () => {
      const indexes = [
        makeIndex({ indexId: 'custom-test', indexType: 'custom' }),
        makeIndex({ indexId: 'global-defense', indexType: 'preset' }),
      ];
      const result = engine.deleteCustomIndex('custom-test', indexes);
      expect(result).toHaveLength(1);
      expect(result[0].indexId).toBe('global-defense');
    });

    it('does not remove preset index', () => {
      const indexes = [
        makeIndex({ indexId: 'global-defense', indexType: 'preset' }),
      ];
      const result = engine.deleteCustomIndex('global-defense', indexes);
      expect(result).toHaveLength(1);
    });
  });

  // ── evaluateIndexThresholds ──────────────────────────────────────────

  describe('evaluateIndexThresholds', () => {
    it('detects crash when value drops > 20% from all-time high', () => {
      const indexStates = new Map<string, IndexRuntimeState>([
        ['global-defense', makeIndexState({
          currentValue: 70,
          allTimeHigh: 100,
          allTimeLow: 70,
        })],
      ]);
      const events = engine.evaluateIndexThresholds(indexStates, 5);
      const crashes = events.filter((e) => e.eventType === 'crash');
      expect(crashes.length).toBeGreaterThan(0);
      expect(crashes[0].magnitude).toBeGreaterThan(0.2);
    });

    it('detects rally when value rises > 30% from all-time low', () => {
      const indexStates = new Map<string, IndexRuntimeState>([
        ['global-defense', makeIndexState({
          currentValue: 140,
          allTimeHigh: 140,
          allTimeLow: 100,
        })],
      ]);
      const events = engine.evaluateIndexThresholds(indexStates, 5);
      const rallies = events.filter((e) => e.eventType === 'rally');
      expect(rallies.length).toBeGreaterThan(0);
    });

    it('returns no events for stable index', () => {
      const indexStates = new Map<string, IndexRuntimeState>([
        ['global-defense', makeIndexState({
          currentValue: 100,
          allTimeHigh: 105,
          allTimeLow: 95,
          history: [],
        })],
      ]);
      const events = engine.evaluateIndexThresholds(indexStates, 5);
      expect(events).toHaveLength(0);
    });
  });

  // ── computeIndexHistory ──────────────────────────────────────────────

  describe('computeIndexHistory', () => {
    it('computes summary statistics correctly', () => {
      const state = makeIndexState({
        currentValue: 120,
        allTimeHigh: 130,
        allTimeLow: 80,
        history: [
          { turn: 0, value: 100, change: 0, changePercent: 0 },
          { turn: 1, value: 110, change: 10, changePercent: 0.1 },
          { turn: 2, value: 120, change: 10, changePercent: 0.09 },
        ],
      });
      const summary = engine.computeIndexHistory(state);
      expect(summary.currentValue).toBe(120);
      expect(summary.allTimeHigh).toBe(130);
      expect(summary.allTimeLow).toBe(80);
      expect(summary.totalReturnPercent).toBeCloseTo(20, 0); // (120-100)/100 * 100
    });
  });

  // ── getActiveIndexes ─────────────────────────────────────────────────

  describe('getActiveIndexes', () => {
    it('combines preset and custom indexes', () => {
      const presets = [makeIndex({ indexId: 'preset-1' })];
      const customs = [makeIndex({ indexId: 'custom-1', indexType: 'custom' })];
      const all = engine.getActiveIndexes(presets, customs);
      expect(all).toHaveLength(2);
    });
  });
});
