/**
 * Index Cross-Engine Feed Tests — CNFL-4203
 *
 * @see FR-3400 — Market Indexes as Gameplay Inputs
 * @see CNFL-4203 — Index Cross-Engine Feeds
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IndexCrossFeed,
  type FactionCrossFeeds,
} from '../index-cross-feed';
import type {
  RuntimeMarketState,
  IndexRuntimeState,
} from '@/data/types/model.types';
import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeIndexState(
  indexId: string,
  currentValue: number,
  changePercent: number,
  turn: number = 5,
): IndexRuntimeState {
  return {
    indexId,
    currentValue,
    allTimeHigh: Math.max(currentValue, 1000),
    allTimeLow: Math.min(currentValue, 900),
    trendDirection: changePercent > 0 ? 'rising' : changePercent < 0 ? 'falling' : 'flat',
    createdOnTurn: 1,
    history: [
      { turn: turn - 1, value: currentValue * (1 - changePercent / 100), change: 0, changePercent: 0 },
      { turn, value: currentValue, change: currentValue * changePercent / 100, changePercent },
    ],
  };
}

function makeMarketState(
  indexOverrides?: Partial<Record<string, IndexRuntimeState>>,
): RuntimeMarketState {
  const defaultIndexes: Record<string, IndexRuntimeState> = {
    'global-defense': makeIndexState('global-defense', 1050, 5),
    'global-energy': makeIndexState('global-energy', 980, -2),
    'global-technology': makeIndexState('global-technology', 1100, 8),
    'global-composite': makeIndexState('global-composite', 1020, 3),
  };

  return {
    exchanges: [],
    tickerSets: [],
    tickerStates: {},
    sentimentStates: {},
    marketEventLog: [],
    contagionLog: [],
    presetIndexes: [],
    customIndexes: [],
    indexStates: { ...defaultIndexes, ...indexOverrides } as Readonly<Record<string, IndexRuntimeState>>,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexCrossFeed', () => {
  let engine: IndexCrossFeed;

  beforeEach(() => {
    engine = new IndexCrossFeed();
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default config', () => {
      expect(engine).toBeDefined();
    });

    it('accepts partial config overrides', () => {
      const custom = new IndexCrossFeed({ maxReadinessModifier: 10 });
      expect(custom).toBeDefined();
    });
  });

  // ── computeFactionFeeds ─────────────────────────────────────────────

  describe('computeFactionFeeds', () => {
    it('returns feeds for a faction with default indexes', () => {
      const marketState = makeMarketState();
      const feeds = engine.computeFactionFeeds(
        'us' as FactionId,
        marketState,
        'nyse',
      );
      expect(feeds.factionId).toBe('us');
      expect(feeds.militaryReadinessModifier).not.toBeNull();
      expect(feeds.economicResourceModifier).not.toBeNull();
      expect(feeds.researchSpeedModifier).not.toBeNull();
      expect(feeds.stabilityModifier).not.toBeNull();
    });

    it('produces positive readiness modifier for rising defense index', () => {
      const marketState = makeMarketState({
        'global-defense': makeIndexState('global-defense', 1100, 8),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netReadinessDelta).toBeGreaterThan(0);
    });

    it('produces negative readiness modifier for falling defense index', () => {
      const marketState = makeMarketState({
        'global-defense': makeIndexState('global-defense', 900, -8),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netReadinessDelta).toBeLessThan(0);
    });

    it('produces positive stability modifier for rising composite index', () => {
      const marketState = makeMarketState({
        'global-composite': makeIndexState('global-composite', 1080, 7),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netStabilityDelta).toBeGreaterThan(0);
    });

    it('produces negative stability modifier for falling composite index', () => {
      const marketState = makeMarketState({
        'global-composite': makeIndexState('global-composite', 920, -6),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netStabilityDelta).toBeLessThan(0);
    });

    it('research speed multiplier > 1 when tech index rising', () => {
      const marketState = makeMarketState({
        'global-technology': makeIndexState('global-technology', 1150, 9),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.researchSpeedMultiplier).toBeGreaterThan(1.0);
    });

    it('research speed multiplier < 1 when tech index falling', () => {
      const marketState = makeMarketState({
        'global-technology': makeIndexState('global-technology', 850, -9),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.researchSpeedMultiplier).toBeLessThan(1.0);
    });

    it('produces zero modifiers when index changes are tiny (< 0.5%)', () => {
      const marketState = makeMarketState({
        'global-defense': makeIndexState('global-defense', 1001, 0.1),
        'global-energy': makeIndexState('global-energy', 999, -0.1),
        'global-technology': makeIndexState('global-technology', 1002, 0.2),
        'global-composite': makeIndexState('global-composite', 1000, 0.0),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netReadinessDelta).toBe(0);
      expect(feeds.netStabilityDelta).toBe(0);
      expect(feeds.researchSpeedMultiplier).toBe(1.0);
    });

    it('returns null modifiers when index is missing', () => {
      const marketState = makeMarketState();
      // Remove global-defense
      delete (marketState.indexStates as Record<string, IndexRuntimeState>)['global-defense'];

      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.militaryReadinessModifier).toBeNull();
      expect(feeds.netReadinessDelta).toBe(0);
    });

    it('clamps modifiers to configured max', () => {
      // 100% change → well above max scale
      const marketState = makeMarketState({
        'global-defense': makeIndexState('global-defense', 2000, 100),
      });
      const feeds = engine.computeFactionFeeds('us' as FactionId, marketState, 'nyse');
      expect(feeds.netReadinessDelta).toBeLessThanOrEqual(5);
      expect(feeds.netReadinessDelta).toBeGreaterThanOrEqual(-5);
    });
  });

  // ── computeAllFactionFeeds ────────────────────────────────────────

  describe('computeAllFactionFeeds', () => {
    it('returns feeds for all 8 factions', () => {
      const marketState = makeMarketState();
      const allFeeds = engine.computeAllFactionFeeds(marketState);
      expect(allFeeds.size).toBe(8);
    });

    it('includes all expected faction IDs', () => {
      const marketState = makeMarketState();
      const allFeeds = engine.computeAllFactionFeeds(marketState);
      expect(allFeeds.has('us' as FactionId)).toBe(true);
      expect(allFeeds.has('china' as FactionId)).toBe(true);
      expect(allFeeds.has('russia' as FactionId)).toBe(true);
      expect(allFeeds.has('japan' as FactionId)).toBe(true);
      expect(allFeeds.has('iran' as FactionId)).toBe(true);
      expect(allFeeds.has('dprk' as FactionId)).toBe(true);
      expect(allFeeds.has('eu' as FactionId)).toBe(true);
      expect(allFeeds.has('syria' as FactionId)).toBe(true);
    });
  });

  // ── applyStabilityModifier ────────────────────────────────────────

  describe('applyStabilityModifier', () => {
    it('increases stability for positive modifier', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: 3,
        netReadinessDelta: 0,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyStabilityModifier(70, feeds)).toBe(73);
    });

    it('decreases stability for negative modifier', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: -4,
        netReadinessDelta: 0,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyStabilityModifier(70, feeds)).toBe(66);
    });

    it('clamps result to 0–100', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: -10,
        netReadinessDelta: 0,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyStabilityModifier(5, feeds)).toBe(0);
    });
  });

  // ── applyReadinessModifier ────────────────────────────────────────

  describe('applyReadinessModifier', () => {
    it('increases readiness for positive modifier', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: 0,
        netReadinessDelta: 5,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyReadinessModifier(80, feeds)).toBe(85);
    });

    it('clamps to 100 maximum', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: 0,
        netReadinessDelta: 5,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyReadinessModifier(98, feeds)).toBe(100);
    });
  });

  // ── applyResearchSpeedModifier ────────────────────────────────────

  describe('applyResearchSpeedModifier', () => {
    it('multiplies base speed by feed multiplier', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: 0,
        netReadinessDelta: 0,
        researchSpeedMultiplier: 1.05,
      };
      expect(engine.applyResearchSpeedModifier(1.0, feeds)).toBeCloseTo(1.05, 2);
    });

    it('returns base speed when multiplier is 1.0', () => {
      const feeds: FactionCrossFeeds = {
        factionId: 'us' as FactionId,
        militaryReadinessModifier: null,
        economicResourceModifier: null,
        researchSpeedModifier: null,
        stabilityModifier: null,
        netStabilityDelta: 0,
        netReadinessDelta: 0,
        researchSpeedMultiplier: 1.0,
      };
      expect(engine.applyResearchSpeedModifier(1.5, feeds)).toBe(1.5);
    });
  });
});
