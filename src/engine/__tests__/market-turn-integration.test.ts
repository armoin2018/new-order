/**
 * Market Turn Integration Tests — CNFL-4106
 *
 * @see FR-3300 — Stock Market Simulation
 * @see FR-3400 — Market Index Computation
 * @see CNFL-4106 — Market → Turn Engine Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MarketTurnIntegration,
  type MarketSignals,
  type MarketTurnInput,
} from '../market-turn-integration';
import type {
  StockExchangeModel,
  NationTickerSet,
  MarketIndexModel,
  RuntimeMarketState,
} from '@/data/types/model.types';
import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExchange(overrides?: Partial<StockExchangeModel>): StockExchangeModel {
  return {
    schemaVersion: '1.0.0',
    exchangeId: 'nyse',
    exchangeName: 'New York Stock Exchange',
    nationId: 'us',
    baseIndexValue: 1000,
    volatilityProfile: 'medium',
    currencyCode: 'USD',
    ...overrides,
  };
}

function makeTickerSet(overrides?: Partial<NationTickerSet>): NationTickerSet {
  return {
    schemaVersion: '1.0.0',
    nationId: 'us',
    exchangeId: 'nyse',
    tickers: [
      {
        tickerId: 'us-defense',
        sectorName: 'defense',
        initialPrice: 100,
        eventSensitivityWeights: { 'military-conflict': 1.5 },
      },
      {
        tickerId: 'us-energy',
        sectorName: 'energy',
        initialPrice: 80,
        eventSensitivityWeights: { 'oil-disruption': 2.0 },
      },
      {
        tickerId: 'us-tech',
        sectorName: 'technology',
        initialPrice: 120,
        eventSensitivityWeights: { 'tech-breakthrough': 1.8 },
      },
    ],
    ...overrides,
  };
}

function makeIndex(overrides?: Partial<MarketIndexModel>): MarketIndexModel {
  return {
    schemaVersion: '1.0.0',
    indexId: 'global-defense',
    indexName: 'Global Defense Index',
    indexType: 'preset',
    constituentTickers: [
      { tickerId: 'us-defense', exchangeId: 'nyse', weight: 1.0 },
    ],
    baseValue: 1000,
    ...overrides,
  };
}

function makeSignals(overrides?: Partial<MarketSignals>): MarketSignals {
  return {
    activeCombatFactions: [],
    sanctionsChangedFactions: [],
    techBreakthroughFactions: [],
    highUnrestFactions: [],
    tradeDealFactions: [],
    oilDisruptionActive: false,
    regimeChangeFactions: [],
    currentTurn: 5,
    ...overrides,
  };
}

function makeRuntimeMarketState(
  integration: MarketTurnIntegration,
): RuntimeMarketState {
  return integration.initialiseMarketState(
    [makeExchange()],
    [makeTickerSet()],
    [makeIndex()],
    1,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MarketTurnIntegration', () => {
  let integration: MarketTurnIntegration;

  beforeEach(() => {
    integration = new MarketTurnIntegration();
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default config', () => {
      expect(integration).toBeDefined();
    });
  });

  // ── extractGameEvents ───────────────────────────────────────────────

  describe('extractGameEvents', () => {
    it('returns empty array for quiet turn', () => {
      const events = integration.extractGameEvents(makeSignals());
      expect(events).toEqual([]);
    });

    it('generates military-conflict events for combat factions', () => {
      const signals = makeSignals({
        activeCombatFactions: ['us' as FactionId, 'russia' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(2);
      expect(events[0]?.eventType).toBe('military-conflict');
      expect(events[0]?.sourceFaction).toBe('us');
      expect(events[1]?.sourceFaction).toBe('russia');
    });

    it('generates sanctions-imposed events', () => {
      const signals = makeSignals({
        sanctionsChangedFactions: ['iran' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('sanctions-imposed');
    });

    it('generates tech-breakthrough events', () => {
      const signals = makeSignals({
        techBreakthroughFactions: ['china' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('tech-breakthrough');
    });

    it('generates civil-unrest events', () => {
      const signals = makeSignals({
        highUnrestFactions: ['syria' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('civil-unrest');
    });

    it('generates trade-deal events', () => {
      const signals = makeSignals({
        tradeDealFactions: ['eu' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('trade-deal');
    });

    it('generates oil-disruption event when active', () => {
      const signals = makeSignals({ oilDisruptionActive: true });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('oil-disruption');
      expect(events[0]?.severity).toBe(0.8);
    });

    it('generates regime-change events', () => {
      const signals = makeSignals({
        regimeChangeFactions: ['dprk' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('regime-change');
      expect(events[0]?.severity).toBe(0.9);
    });

    it('generates multiple events for compound signals', () => {
      const signals = makeSignals({
        activeCombatFactions: ['us' as FactionId],
        oilDisruptionActive: true,
        highUnrestFactions: ['syria' as FactionId],
      });
      const events = integration.extractGameEvents(signals);
      expect(events).toHaveLength(3);
    });

    it('sets correct turn number on all events', () => {
      const signals = makeSignals({
        activeCombatFactions: ['us' as FactionId],
        currentTurn: 42,
      });
      const events = integration.extractGameEvents(signals);
      for (const event of events) {
        expect(event.turn).toBe(42);
      }
    });
  });

  // ── initialiseMarketState ──────────────────────────────────────────

  describe('initialiseMarketState', () => {
    it('creates ticker states for all tickers', () => {
      const state = makeRuntimeMarketState(integration);
      expect(Object.keys(state.tickerStates)).toHaveLength(3);
      expect(state.tickerStates['us-defense']).toBeDefined();
      expect(state.tickerStates['us-energy']).toBeDefined();
      expect(state.tickerStates['us-tech']).toBeDefined();
    });

    it('sets initial prices from ticker definitions', () => {
      const state = makeRuntimeMarketState(integration);
      expect(state.tickerStates['us-defense']?.currentPrice).toBe(100);
      expect(state.tickerStates['us-energy']?.currentPrice).toBe(80);
      expect(state.tickerStates['us-tech']?.currentPrice).toBe(120);
    });

    it('loads sentiment from baseline for known exchanges', () => {
      const state = makeRuntimeMarketState(integration);
      expect(Object.keys(state.sentimentStates)).toHaveLength(1);
      // NYSE baseline: sentiment='neutral', sentimentScore=8 (from sentiment-baseline.json)
      expect(state.sentimentStates['nyse']?.sentiment).toBe('neutral');
      expect(state.sentimentStates['nyse']?.sentimentScore).toBe(8);
    });

    it('creates initial index states', () => {
      const state = makeRuntimeMarketState(integration);
      expect(Object.keys(state.indexStates)).toHaveLength(1);
      expect(state.indexStates['global-defense']).toBeDefined();
      expect(state.indexStates['global-defense']?.trendDirection).toBe('flat');
    });

    it('starts with empty event and contagion logs', () => {
      const state = makeRuntimeMarketState(integration);
      expect(state.marketEventLog).toHaveLength(0);
      expect(state.contagionLog).toHaveLength(0);
    });

    it('stores exchanges and ticker sets for future reference', () => {
      const state = makeRuntimeMarketState(integration);
      expect(state.exchanges).toHaveLength(1);
      expect(state.tickerSets).toHaveLength(1);
    });

    it('computes index value from constituent tickers', () => {
      const state = makeRuntimeMarketState(integration);
      // Defense ticker at initial price → ratio=1.0 → value=baseValue=1000
      expect(state.indexStates['global-defense']?.currentValue).toBe(1000);
    });
  });

  // ── processMarketTurn ─────────────────────────────────────────────

  describe('processMarketTurn', () => {
    it('throws if market state is null', () => {
      const input: MarketTurnInput = {
        currentMarketState: null,
        signals: makeSignals(),
        nationStates: {},
        gfsi: 50,
      };
      expect(() => integration.processMarketTurn(input)).toThrow(
        'Market state must be initialised',
      );
    });

    it('processes a quiet turn without crashing', () => {
      const state = makeRuntimeMarketState(integration);
      const input: MarketTurnInput = {
        currentMarketState: state,
        signals: makeSignals({ currentTurn: 2 }),
        nationStates: {},
        gfsi: 50,
      };
      const result = integration.processMarketTurn(input);
      expect(result.marketState).toBeDefined();
      expect(result.exchangeComposites).toBeDefined();
      expect(result.indexValues).toBeDefined();
    });

    it('returns updated ticker states after processing', () => {
      const state = makeRuntimeMarketState(integration);
      const input: MarketTurnInput = {
        currentMarketState: state,
        signals: makeSignals({ currentTurn: 2 }),
        nationStates: {},
        gfsi: 50,
      };
      const result = integration.processMarketTurn(input);
      expect(Object.keys(result.marketState.tickerStates)).toHaveLength(3);
    });

    it('accumulates market event log', () => {
      const state = makeRuntimeMarketState(integration);
      const input: MarketTurnInput = {
        currentMarketState: state,
        signals: makeSignals({ currentTurn: 2 }),
        nationStates: {},
        gfsi: 50,
      };
      const result = integration.processMarketTurn(input);
      // Event log should contain any new events
      expect(Array.isArray(result.marketState.marketEventLog)).toBe(true);
    });

    it('computes exchange composites for each exchange', () => {
      const state = makeRuntimeMarketState(integration);
      const input: MarketTurnInput = {
        currentMarketState: state,
        signals: makeSignals({ currentTurn: 2 }),
        nationStates: {},
        gfsi: 50,
      };
      const result = integration.processMarketTurn(input);
      expect(result.exchangeComposites['nyse']).toBeDefined();
      expect(typeof result.exchangeComposites['nyse']).toBe('number');
    });

    it('computes index values after market updates', () => {
      const state = makeRuntimeMarketState(integration);
      const input: MarketTurnInput = {
        currentMarketState: state,
        signals: makeSignals({ currentTurn: 2 }),
        nationStates: {},
        gfsi: 50,
      };
      const result = integration.processMarketTurn(input);
      expect(typeof result.indexValues['global-defense']).toBe('number');
    });

    it('preserves index history across turns', () => {
      let state = makeRuntimeMarketState(integration);
      for (let turn = 2; turn <= 4; turn++) {
        const input: MarketTurnInput = {
          currentMarketState: state,
          signals: makeSignals({ currentTurn: turn }),
          nationStates: {},
          gfsi: 50,
        };
        const result = integration.processMarketTurn(input);
        state = result.marketState;
      }
      const indexState = state.indexStates['global-defense'];
      expect(indexState?.history.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── createCustomIndex ─────────────────────────────────────────────

  describe('createCustomIndex', () => {
    it('creates a custom index with valid inputs', () => {
      const state = makeRuntimeMarketState(integration);
      const result = integration.createCustomIndex(
        state,
        'My Custom Index',
        [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.5 },
          { tickerId: 'us-energy', exchangeId: 'nyse', weight: 0.5 },
        ],
        5,
        'A custom index for testing',
      );
      expect(result.success).toBe(true);
      expect(result.marketState).toBeDefined();
      expect(result.marketState?.customIndexes).toHaveLength(1);
    });

    it('returns error for invalid ticker references', () => {
      const state = makeRuntimeMarketState(integration);
      const result = integration.createCustomIndex(
        state,
        'Bad Index',
        [
          { tickerId: 'nonexistent-ticker', exchangeId: 'nyse', weight: 1.0 },
        ],
        5,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('adds index state for newly created custom index', () => {
      const state = makeRuntimeMarketState(integration);
      const result = integration.createCustomIndex(
        state,
        'My Custom Index',
        [
          { tickerId: 'us-defense', exchangeId: 'nyse', weight: 0.5 },
          { tickerId: 'us-energy', exchangeId: 'nyse', weight: 0.5 },
        ],
        3,
      );
      expect(result.success).toBe(true);
      const customIndexId = result.marketState?.customIndexes[0]?.indexId;
      expect(customIndexId).toBeDefined();
      if (customIndexId) {
        expect(result.marketState?.indexStates[customIndexId]).toBeDefined();
      }
    });
  });
});
