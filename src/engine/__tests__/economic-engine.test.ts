import { describe, it, expect, beforeEach } from 'vitest';
import { EconomicEngine } from '@/engine/economic-engine';
import type { EconomicSnapshot, GlobalEconomicState, TurnIncomeBreakdown } from '@/engine/economic-engine';
import { FactionId } from '@/data/types';
import type { FactionId as FactionIdType, NationState } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionIdType,
    stability: 55,
    treasury: 800,
    gdp: 28_000,
    inflation: 6,
    militaryReadiness: 85,
    nuclearThreshold: 25,
    diplomaticInfluence: 80,
    popularity: 48,
    allianceCredibility: 65,
    techLevel: 90,
    ...overrides,
  };
}

function makeGlobalState(overrides: Partial<GlobalEconomicState> = {}): GlobalEconomicState {
  return {
    globalInflation: 5,
    oilSupplyDisruption: 0,
    tradeBalances: {} as Record<FactionIdType, number>,
    resourceExports: {} as Record<FactionIdType, number>,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EconomicEngine', () => {
  let engine: EconomicEngine;

  beforeEach(() => {
    engine = new EconomicEngine(GAME_CONFIG.economy);
  });

  // ── calculateTurnIncome ───────────────────────────────────────────────

  describe('calculateTurnIncome', () => {
    let nation: NationState;

    beforeEach(() => {
      nation = makeMockNation();
    });

    it('computes GDP income as gdpIncomeRate × GDP', () => {
      const result = engine.calculateTurnIncome(nation, 0, 0);
      // 0.005 × 28 000 = 140
      expect(result.gdpIncome).toBeCloseTo(140, 5);
    });

    it('computes trade balance income from tradeBalanceRate', () => {
      const result = engine.calculateTurnIncome(nation, 500, 0);
      // 0.1 × 500 = 50
      expect(result.tradeBalanceIncome).toBeCloseTo(50, 5);
    });

    it('computes resource export income from resourceExportRate', () => {
      const result = engine.calculateTurnIncome(nation, 0, 200);
      // 0.15 × 200 = 30
      expect(result.resourceExportIncome).toBeCloseTo(30, 5);
    });

    it('totalIncome equals sum of all streams', () => {
      const result = engine.calculateTurnIncome(nation, 500, 200);
      const expected = result.gdpIncome + result.tradeBalanceIncome + result.resourceExportIncome;
      expect(result.totalIncome).toBeCloseTo(expected, 5);
    });

    it('handles zero trade balance', () => {
      const result = engine.calculateTurnIncome(nation, 0, 0);
      expect(result.tradeBalanceIncome).toBe(0);
    });

    it('handles negative trade balance', () => {
      const result = engine.calculateTurnIncome(nation, -300, 0);
      // 0.1 × -300 = -30
      expect(result.tradeBalanceIncome).toBeCloseTo(-30, 5);
    });

    it('totalIncome can be reduced by negative trade balance', () => {
      const result = engine.calculateTurnIncome(nation, -3000, 0);
      // gdpIncome = 140, tradeBalanceIncome = -300, resource = 0 → total = -160
      expect(result.totalIncome).toBeCloseTo(-160, 5);
    });
  });

  // ── replenishTreasury ─────────────────────────────────────────────────

  describe('replenishTreasury', () => {
    it('adds income totalIncome to treasury', () => {
      const nation = makeMockNation({ treasury: 800 });
      const income: TurnIncomeBreakdown = {
        gdpIncome: 140,
        tradeBalanceIncome: 50,
        resourceExportIncome: 30,
        totalIncome: 220,
      };
      const result = engine.replenishTreasury(nation, income);
      expect(result).toBeCloseTo(1020, 5);
    });

    it('floors treasury at minimumTreasury (0)', () => {
      const nation = makeMockNation({ treasury: 10 });
      const income: TurnIncomeBreakdown = {
        gdpIncome: 0,
        tradeBalanceIncome: -50,
        resourceExportIncome: 0,
        totalIncome: -50,
      };
      // 10 + (-50) = -40, floor at 0
      const result = engine.replenishTreasury(nation, income);
      expect(result).toBe(0);
    });

    it('handles negative income that does not breach floor', () => {
      const nation = makeMockNation({ treasury: 500 });
      const income: TurnIncomeBreakdown = {
        gdpIncome: 0,
        tradeBalanceIncome: -100,
        resourceExportIncome: 0,
        totalIncome: -100,
      };
      const result = engine.replenishTreasury(nation, income);
      expect(result).toBeCloseTo(400, 5);
    });
  });

  // ── canAfford ─────────────────────────────────────────────────────────

  describe('canAfford', () => {
    it('returns true when treasury exceeds cost', () => {
      expect(engine.canAfford(100, 50)).toBe(true);
    });

    it('returns false when treasury is below cost', () => {
      expect(engine.canAfford(30, 50)).toBe(false);
    });

    it('returns true when treasury equals cost (edge)', () => {
      expect(engine.canAfford(50, 50)).toBe(true);
    });
  });

  // ── spend ─────────────────────────────────────────────────────────────

  describe('spend', () => {
    it('returns success with correct remaining on successful spend', () => {
      const result = engine.spend(800, 200);
      expect(result.success).toBe(true);
      expect(result.remainingTreasury).toBeCloseTo(600, 5);
      expect(result.shortfall).toBe(0);
    });

    it('returns failure with shortfall on insufficient funds', () => {
      const result = engine.spend(100, 250);
      expect(result.success).toBe(false);
      expect(result.remainingTreasury).toBe(100);
      expect(result.shortfall).toBeCloseTo(150, 5);
    });

    it('handles zero cost', () => {
      const result = engine.spend(500, 0);
      expect(result.success).toBe(true);
      expect(result.remainingTreasury).toBeCloseTo(500, 5);
      expect(result.shortfall).toBe(0);
    });
  });

  // ── applyInflationToStability ─────────────────────────────────────────

  describe('applyInflationToStability', () => {
    it('returns 0 when combined inflation is below threshold', () => {
      // nation.inflation = 6, globalInflation = 2 → combined = 8, threshold = 10
      const nation = makeMockNation({ inflation: 6 });
      expect(engine.applyInflationToStability(nation, 2)).toBe(0);
    });

    it('returns 0 when combined inflation equals threshold exactly', () => {
      // 6 + 4 = 10 = threshold
      const nation = makeMockNation({ inflation: 6 });
      expect(engine.applyInflationToStability(nation, 4)).toBe(0);
    });

    it('returns negative penalty when combined inflation exceeds threshold', () => {
      // nation.inflation = 6, globalInflation = 10 → combined = 16, excess = 6
      // penalty = 6 × -0.5 = -3
      const nation = makeMockNation({ inflation: 6 });
      const delta = engine.applyInflationToStability(nation, 10);
      expect(delta).toBeCloseTo(-3, 5);
    });

    it('global inflation stacks with national inflation', () => {
      // nation.inflation = 20, globalInflation = 15 → combined = 35, excess = 25
      // penalty = 25 × -0.5 = -12.5
      const nation = makeMockNation({ inflation: 20 });
      const delta = engine.applyInflationToStability(nation, 15);
      expect(delta).toBeCloseTo(-12.5, 5);
    });

    it('clamps penalty to maxStabilityPenalty (-15)', () => {
      // nation.inflation = 50, globalInflation = 50 → combined = 100, excess = 90
      // raw penalty = 90 × -0.5 = -45 → clamped to -15
      const nation = makeMockNation({ inflation: 50 });
      const delta = engine.applyInflationToStability(nation, 50);
      expect(delta).toBe(-15);
    });
  });

  // ── createEconomicSnapshot ────────────────────────────────────────────

  describe('createEconomicSnapshot', () => {
    it('builds correct snapshot with populated global state', () => {
      const nation = makeMockNation();
      const globalState = makeGlobalState({
        tradeBalances: { [FactionId.US]: 500 } as Record<FactionIdType, number>,
        resourceExports: { [FactionId.US]: 200 } as Record<FactionIdType, number>,
      });

      const snapshot: EconomicSnapshot = engine.createEconomicSnapshot(nation, globalState);

      expect(snapshot.factionId).toBe(FactionId.US);
      expect(snapshot.treasury).toBe(800);
      expect(snapshot.gdp).toBe(28_000);
      expect(snapshot.inflation).toBe(6);
      expect(snapshot.tradeBalance).toBe(500);
      expect(snapshot.resourceExports).toBe(200);
      expect(snapshot.turnIncome.gdpIncome).toBeCloseTo(140, 5);
    });

    it('defaults to 0 for missing faction in trade balances / exports', () => {
      const nation = makeMockNation({ factionId: 'japan' as FactionIdType });
      const globalState = makeGlobalState(); // empty records

      const snapshot = engine.createEconomicSnapshot(nation, globalState);

      expect(snapshot.tradeBalance).toBe(0);
      expect(snapshot.resourceExports).toBe(0);
      expect(snapshot.turnIncome.tradeBalanceIncome).toBe(0);
      expect(snapshot.turnIncome.resourceExportIncome).toBe(0);
    });
  });

  // ── calculateGlobalInflation ──────────────────────────────────────────

  describe('calculateGlobalInflation', () => {
    it('computes base + coefficient × disruption', () => {
      // base = 5, disruption = 40 → 5 + 0.15 × 40 = 5 + 6 = 11
      const result = engine.calculateGlobalInflation(5, 40);
      expect(result).toBeCloseTo(11, 5);
    });

    it('clamps result at 0 for negative inputs', () => {
      // base = -20, disruption = 0 → -20 → clamped to 0
      const result = engine.calculateGlobalInflation(-20, 0);
      expect(result).toBe(0);
    });

    it('clamps result at 100', () => {
      // base = 90, disruption = 100 → 90 + 15 = 105 → clamped to 100
      const result = engine.calculateGlobalInflation(90, 100);
      expect(result).toBe(100);
    });

    it('zero disruption returns base only', () => {
      const result = engine.calculateGlobalInflation(7, 0);
      expect(result).toBeCloseTo(7, 5);
    });
  });
});
