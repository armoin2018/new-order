/**
 * National Debt Engine Tests — FR-7003
 */
import { describe, it, expect } from 'vitest';
import {
  initNationalDebt,
  computeCreditRating,
  processDebtTurn,
  computeGlobalDebt,
} from '../national-debt-engine';
import type { NationalDebt } from '@/data/types/economic-state.types';
import type { NationState } from '@/data/types/nation.types';
import type { FactionId } from '@/data/types/enums';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockNS(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionId,
    stability: 60,
    treasury: 500,
    gdp: 25000,
    inflation: 5,
    militaryReadiness: 70,
    nuclearThreshold: 30,
    diplomaticInfluence: 80,
    popularity: 55,
    allianceCredibility: 70,
    techLevel: 80,
    ...overrides,
  };
}

// ─── Initialization ─────────────────────────────────────────────────────────

describe('FR-7003 National Debt — Initialization', () => {
  it('creates debt from configured debt-to-GDP ratio', () => {
    const debt = initNationalDebt('us' as FactionId, 25000);
    expect(debt.debtToGDP).toBe(125); // US configured at 125%
    expect(debt.totalDebt).toBe(31250); // 125% × 25000
    expect(debt.creditRating).toBe('BB'); // 125% → BB tier
    expect(debt.trajectory).toBe('stable');
    expect(debt.consecutiveDeficits).toBe(0);
  });

  it('creates low debt for Russia', () => {
    const debt = initNationalDebt('russia' as FactionId, 2000);
    expect(debt.debtToGDP).toBe(20); // Russia at 20%
    expect(debt.totalDebt).toBe(400);
    expect(debt.creditRating).toBe('AAA'); // 20% → AAA
  });

  it('creates very high debt for Japan', () => {
    const debt = initNationalDebt('japan' as FactionId, 5000);
    expect(debt.debtToGDP).toBe(260); // Japan at 260%
    expect(debt.totalDebt).toBe(13000);
    expect(debt.creditRating).toBe('D'); // 260% > 250 → D
  });
});

// ─── Credit Rating ──────────────────────────────────────────────────────────

describe('FR-7003 Credit Rating', () => {
  it('rates AAA for low debt-to-GDP', () => {
    expect(computeCreditRating(30)).toBe('AAA');
  });

  it('rates A for moderate debt', () => {
    expect(computeCreditRating(75)).toBe('A');
  });

  it('rates BB for high debt', () => {
    expect(computeCreditRating(120)).toBe('BB');
  });

  it('rates D for extreme debt', () => {
    expect(computeCreditRating(300)).toBe('D');
  });

  it('rates by threshold boundaries', () => {
    expect(computeCreditRating(40)).toBe('AAA');
    expect(computeCreditRating(41)).toBe('AA');
    expect(computeCreditRating(60)).toBe('AA');
    expect(computeCreditRating(61)).toBe('A');
  });
});

// ─── Per-Turn Debt Processing ───────────────────────────────────────────────

describe('FR-7003 processDebtTurn', () => {
  const baseDebt: NationalDebt = {
    totalDebt: 5000,
    debtToGDP: 50,
    interestPayments: 20,
    creditRating: 'A',
    trajectory: 'stable',
    consecutiveDeficits: 0,
  };

  it('deficits increase debt', () => {
    const result = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: -100,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.debt.totalDebt).toBeGreaterThan(baseDebt.totalDebt);
    expect(result.debt.trajectory).toBe('increasing');
  });

  it('surplus reduces debt via trade balance', () => {
    const result = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 50,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 100,
    });
    // Trade surplus applies -5% × tradeBalance to debt
    expect(result.debt.totalDebt).toBeLessThan(baseDebt.totalDebt + 5);
  });

  it('military spending adds to debt', () => {
    const withMil = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 50,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    const withoutMil = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(withMil.debt.totalDebt).toBeGreaterThan(withoutMil.debt.totalDebt);
  });

  it('disaster costs add to debt', () => {
    const result = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 0,
      disasterCosts: 100,
      tradeBalance: 0,
    });
    expect(result.debt.totalDebt).toBeGreaterThan(baseDebt.totalDebt + 90);
  });

  it('computes interest cost from credit rating', () => {
    const result = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.interestCost).toBeGreaterThan(0);
  });

  it('tracks consecutive deficits', () => {
    const result = processDebtTurn({
      currentDebt: { ...baseDebt, consecutiveDeficits: 5 },
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: -10,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.debt.consecutiveDeficits).toBe(6);
  });

  it('resets consecutive deficits on surplus', () => {
    const result = processDebtTurn({
      currentDebt: { ...baseDebt, consecutiveDeficits: 5 },
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 10,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.debt.consecutiveDeficits).toBe(0);
  });

  it('generates headline on credit downgrade', () => {
    // Push debt way up so credit drops from A to BB
    const result = processDebtTurn({
      currentDebt: { ...baseDebt, totalDebt: 9500, debtToGDP: 79, creditRating: 'A' },
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: -3000,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: -500,
    });
    expect(result.ratingChanged).toBe(true);
    expect(result.headline).not.toBeNull();
    expect(result.headline).toContain('Credit downgrade');
  });

  it('applies GDP growth penalty for high debt', () => {
    const result = processDebtTurn({
      currentDebt: { ...baseDebt, totalDebt: 15000, debtToGDP: 150 },
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.gdpGrowthPenalty).toBeLessThan(0);
  });

  it('no GDP penalty below 100% debt-to-GDP', () => {
    const result = processDebtTurn({
      currentDebt: baseDebt,
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 0,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 0,
    });
    expect(result.gdpGrowthPenalty).toBe(0);
  });

  it('debt never goes below 0', () => {
    const result = processDebtTurn({
      currentDebt: { ...baseDebt, totalDebt: 10 },
      nationState: mockNS({ gdp: 10000 }),
      turnTreasuryDelta: 1000,
      militarySpending: 0,
      disasterCosts: 0,
      tradeBalance: 500,
    });
    expect(result.debt.totalDebt).toBeGreaterThanOrEqual(0);
  });
});

// ─── Global Debt ────────────────────────────────────────────────────────────

describe('FR-7003 computeGlobalDebt', () => {
  it('sums total debt across factions', () => {
    const debts = {
      us: { ...initNationalDebt('us' as FactionId, 25000) },
      china: { ...initNationalDebt('china' as FactionId, 18000) },
    };
    const result = computeGlobalDebt(debts);
    expect(result.totalGlobalDebt).toBeGreaterThan(0);
    expect(result.avgDebtToGDP).toBeGreaterThan(0);
  });

  it('returns 0 for empty input', () => {
    const result = computeGlobalDebt({});
    expect(result.totalGlobalDebt).toBe(0);
    expect(result.avgDebtToGDP).toBe(0);
  });
});
