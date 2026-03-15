import { describe, it, expect, beforeEach } from 'vitest';
import {
  StrategicReservesEngine,
  AdequacyLevel,
} from '@/engine/strategic-reserves';

import type {
  StockpileResult,
  DepleteResult,
  TransferResult,
  ReserveAdequacy,
  ReserveUpdateResult,
  ReservesSummary,
} from '@/engine/strategic-reserves';
import type { StrategicReserves } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Create a StrategicReserves with all zeros as default. */
function makeReserves(
  overrides: Partial<StrategicReserves> = {},
): StrategicReserves {
  return {
    energy: 0,
    food: 0,
    water: 0,
    criticalMinerals: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('StrategicReservesEngine', () => {
  let engine: StrategicReservesEngine;

  beforeEach(() => {
    engine = new StrategicReservesEngine({ costPer10Units: -5 });
  });

  // ── computeStockpileCost ─────────────────────────────────

  describe('computeStockpileCost', () => {
    it('computes cost for exactly 10 units as -5', () => {
      expect(engine.computeStockpileCost(10)).toBe(-5);
    });

    it('computes cost for 20 units as -10', () => {
      expect(engine.computeStockpileCost(20)).toBe(-10);
    });

    it('rounds up partial batches — 5 units costs -5 (1 batch)', () => {
      expect(engine.computeStockpileCost(5)).toBe(-5);
    });

    it('returns 0 for 0 units', () => {
      expect(engine.computeStockpileCost(0)).toBe(0);
    });

    it('rounds up to 2 batches for 15 units — costs -10', () => {
      expect(engine.computeStockpileCost(15)).toBe(-10);
    });
  });

  // ── stockpile ────────────────────────────────────────────

  describe('stockpile', () => {
    it('adds units to the specified resource', () => {
      const reserves = makeReserves({ energy: 10 });
      const result: StockpileResult = engine.stockpile(reserves, 'energy', 5);

      expect(result.reserves.energy).toBe(15);
    });

    it('preserves other resources unchanged', () => {
      const reserves = makeReserves({ energy: 10, food: 20, water: 30, criticalMinerals: 40 });
      const result = engine.stockpile(reserves, 'energy', 5);

      expect(result.reserves.food).toBe(20);
      expect(result.reserves.water).toBe(30);
      expect(result.reserves.criticalMinerals).toBe(40);
    });

    it('returns the correct treasury cost', () => {
      const reserves = makeReserves();
      const result = engine.stockpile(reserves, 'food', 25);

      // ceil(25/10) = 3 batches × -5 = -15
      expect(result.treasuryCost).toBe(-15);
    });

    it('handles a large stockpile', () => {
      const reserves = makeReserves();
      const result = engine.stockpile(reserves, 'criticalMinerals', 1000);

      expect(result.reserves.criticalMinerals).toBe(1000);
      // ceil(1000/10) = 100 batches × -5 = -500
      expect(result.treasuryCost).toBe(-500);
    });
  });

  // ── deplete ──────────────────────────────────────────────

  describe('deplete', () => {
    it('removes units from the specified resource', () => {
      const reserves = makeReserves({ energy: 20 });
      const result: DepleteResult = engine.deplete(reserves, 'energy', 10);

      expect(result.reserves.energy).toBe(10);
      expect(result.actualDepleted).toBe(10);
    });

    it('cannot go below 0', () => {
      const reserves = makeReserves({ energy: 5 });
      const result = engine.deplete(reserves, 'energy', 20);

      expect(result.reserves.energy).toBe(0);
    });

    it('actualDepleted reflects what was actually removed', () => {
      const reserves = makeReserves({ food: 7 });
      const result = engine.deplete(reserves, 'food', 10);

      expect(result.actualDepleted).toBe(7);
    });

    it('preserves other resources', () => {
      const reserves = makeReserves({ energy: 10, food: 20, water: 30, criticalMinerals: 40 });
      const result = engine.deplete(reserves, 'energy', 5);

      expect(result.reserves.food).toBe(20);
      expect(result.reserves.water).toBe(30);
      expect(result.reserves.criticalMinerals).toBe(40);
    });

    it('returns capped amount when depleting more than available', () => {
      const reserves = makeReserves({ water: 3 });
      const result = engine.deplete(reserves, 'water', 100);

      expect(result.actualDepleted).toBe(3);
      expect(result.reserves.water).toBe(0);
    });
  });

  // ── computeBufferDuration ────────────────────────────────

  describe('computeBufferDuration', () => {
    it('calculates turns correctly (reserves / deficit)', () => {
      const reserves = makeReserves({ energy: 30, food: 20, water: 10, criticalMinerals: 40 });
      const deficit = makeReserves({ energy: 10, food: 5, water: 2, criticalMinerals: 8 });
      const result = engine.computeBufferDuration(reserves, deficit);

      expect(result.energy).toBe(3);
      expect(result.food).toBe(4);
      expect(result.water).toBe(5);
      expect(result.criticalMinerals).toBe(5);
    });

    it('returns Infinity for zero deficit', () => {
      const reserves = makeReserves({ energy: 30, food: 20, water: 10, criticalMinerals: 40 });
      const deficit = makeReserves();
      const result = engine.computeBufferDuration(reserves, deficit);

      expect(result.energy).toBe(Infinity);
      expect(result.food).toBe(Infinity);
      expect(result.water).toBe(Infinity);
      expect(result.criticalMinerals).toBe(Infinity);
    });

    it('minimumBuffer is the weakest link', () => {
      const reserves = makeReserves({ energy: 30, food: 20, water: 5, criticalMinerals: 40 });
      const deficit = makeReserves({ energy: 10, food: 10, water: 5, criticalMinerals: 10 });
      const result = engine.computeBufferDuration(reserves, deficit);

      // water: floor(5/5) = 1 is the weakest
      expect(result.minimumBuffer).toBe(1);
    });

    it('handles mixed deficit rates', () => {
      const reserves = makeReserves({ energy: 100, food: 50, water: 0, criticalMinerals: 25 });
      const deficit = makeReserves({ energy: 10, food: 0, water: 5, criticalMinerals: 3 });
      const result = engine.computeBufferDuration(reserves, deficit);

      expect(result.energy).toBe(10);
      expect(result.food).toBe(Infinity); // zero deficit
      expect(result.water).toBe(0);       // zero reserves / 5 deficit
      expect(result.criticalMinerals).toBe(8); // floor(25/3) = 8
      expect(result.minimumBuffer).toBe(0);
    });
  });

  // ── transferReserves ─────────────────────────────────────

  describe('transferReserves', () => {
    it('transfers units between reserves', () => {
      const from = makeReserves({ energy: 20 });
      const to = makeReserves({ energy: 5 });
      const result: TransferResult = engine.transferReserves(from, to, 'energy', 10);

      expect(result.fromReserves.energy).toBe(10);
      expect(result.toReserves.energy).toBe(15);
      expect(result.actualTransferred).toBe(10);
    });

    it('cannot transfer more than source has', () => {
      const from = makeReserves({ food: 5 });
      const to = makeReserves({ food: 10 });
      const result = engine.transferReserves(from, to, 'food', 20);

      expect(result.fromReserves.food).toBe(0);
      expect(result.toReserves.food).toBe(15);
      expect(result.actualTransferred).toBe(5);
    });

    it('actualTransferred reflects capped amount', () => {
      const from = makeReserves({ water: 3 });
      const to = makeReserves({ water: 0 });
      const result = engine.transferReserves(from, to, 'water', 100);

      expect(result.actualTransferred).toBe(3);
    });

    it('updates both from and to reserves', () => {
      const from = makeReserves({ criticalMinerals: 50 });
      const to = makeReserves({ criticalMinerals: 10 });
      const result = engine.transferReserves(from, to, 'criticalMinerals', 25);

      expect(result.fromReserves.criticalMinerals).toBe(25);
      expect(result.toReserves.criticalMinerals).toBe(35);
    });

    it('preserves other resources on both sides', () => {
      const from = makeReserves({ energy: 10, food: 20, water: 30, criticalMinerals: 40 });
      const to = makeReserves({ energy: 5, food: 15, water: 25, criticalMinerals: 35 });
      const result = engine.transferReserves(from, to, 'energy', 5);

      expect(result.fromReserves.food).toBe(20);
      expect(result.fromReserves.water).toBe(30);
      expect(result.fromReserves.criticalMinerals).toBe(40);
      expect(result.toReserves.food).toBe(15);
      expect(result.toReserves.water).toBe(25);
      expect(result.toReserves.criticalMinerals).toBe(35);
    });
  });

  // ── assessReserveAdequacy ────────────────────────────────

  describe('assessReserveAdequacy', () => {
    it('rates surplus when reserves > 6 months of consumption', () => {
      // 7 / 1 = 7 months > 6 → surplus
      const reserves = makeReserves({ energy: 7, food: 7, water: 7, criticalMinerals: 7 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const result: ReserveAdequacy = engine.assessReserveAdequacy(reserves, consumption);

      expect(result.energy).toBe(AdequacyLevel.Surplus);
      expect(result.food).toBe(AdequacyLevel.Surplus);
      expect(result.water).toBe(AdequacyLevel.Surplus);
      expect(result.criticalMinerals).toBe(AdequacyLevel.Surplus);
    });

    it('rates adequate when reserves cover 3–6 months', () => {
      // 4 / 1 = 4 months — between 3 and 6 → adequate
      const reserves = makeReserves({ energy: 4, food: 4, water: 4, criticalMinerals: 4 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const result = engine.assessReserveAdequacy(reserves, consumption);

      expect(result.energy).toBe(AdequacyLevel.Adequate);
    });

    it('rates low when reserves cover < 3 months', () => {
      // 2 / 1 = 2 months < 3 → low
      const reserves = makeReserves({ energy: 2, food: 2, water: 2, criticalMinerals: 2 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const result = engine.assessReserveAdequacy(reserves, consumption);

      expect(result.energy).toBe(AdequacyLevel.Low);
    });

    it('rates depleted when reserves are 0', () => {
      const reserves = makeReserves();
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const result = engine.assessReserveAdequacy(reserves, consumption);

      expect(result.energy).toBe(AdequacyLevel.Depleted);
      expect(result.food).toBe(AdequacyLevel.Depleted);
      expect(result.water).toBe(AdequacyLevel.Depleted);
      expect(result.criticalMinerals).toBe(AdequacyLevel.Depleted);
    });

    it('overall is the worst of all 4 dimensions', () => {
      const reserves = makeReserves({ energy: 7, food: 4, water: 2, criticalMinerals: 0 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const result = engine.assessReserveAdequacy(reserves, consumption);

      // criticalMinerals = depleted → worst
      expect(result.overall).toBe(AdequacyLevel.Depleted);
    });

    it('handles zero consumption as surplus', () => {
      const reserves = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const consumption = makeReserves();
      const result = engine.assessReserveAdequacy(reserves, consumption);

      expect(result.energy).toBe(AdequacyLevel.Surplus);
      expect(result.food).toBe(AdequacyLevel.Surplus);
      expect(result.water).toBe(AdequacyLevel.Surplus);
      expect(result.criticalMinerals).toBe(AdequacyLevel.Surplus);
      expect(result.overall).toBe(AdequacyLevel.Surplus);
    });
  });

  // ── computeTurnReserveUpdate ─────────────────────────────

  describe('computeTurnReserveUpdate', () => {
    it('increases reserves from production', () => {
      const reserves = makeReserves({ energy: 10, food: 10, water: 10, criticalMinerals: 10 });
      const consumption = makeReserves();
      const production = makeReserves({ energy: 5, food: 3, water: 7, criticalMinerals: 2 });
      const result: ReserveUpdateResult = engine.computeTurnReserveUpdate(
        reserves,
        consumption,
        production,
      );

      expect(result.reserves.energy).toBe(15);
      expect(result.reserves.food).toBe(13);
      expect(result.reserves.water).toBe(17);
      expect(result.reserves.criticalMinerals).toBe(12);
    });

    it('decreases reserves from consumption', () => {
      const reserves = makeReserves({ energy: 20, food: 20, water: 20, criticalMinerals: 20 });
      const consumption = makeReserves({ energy: 5, food: 3, water: 7, criticalMinerals: 2 });
      const production = makeReserves();
      const result = engine.computeTurnReserveUpdate(reserves, consumption, production);

      expect(result.reserves.energy).toBe(15);
      expect(result.reserves.food).toBe(17);
      expect(result.reserves.water).toBe(13);
      expect(result.reserves.criticalMinerals).toBe(18);
    });

    it('net change is production minus consumption', () => {
      const reserves = makeReserves({ energy: 50, food: 50, water: 50, criticalMinerals: 50 });
      const consumption = makeReserves({ energy: 10, food: 5, water: 8, criticalMinerals: 3 });
      const production = makeReserves({ energy: 7, food: 10, water: 8, criticalMinerals: 1 });
      const result = engine.computeTurnReserveUpdate(reserves, consumption, production);

      expect(result.netChange.energy).toBe(-3);
      expect(result.netChange.food).toBe(5);
      expect(result.netChange.water).toBe(0);
      expect(result.netChange.criticalMinerals).toBe(-2);
    });

    it('reserves cannot go below 0', () => {
      const reserves = makeReserves({ energy: 3 });
      const consumption = makeReserves({ energy: 20 });
      const production = makeReserves();
      const result = engine.computeTurnReserveUpdate(reserves, consumption, production);

      expect(result.reserves.energy).toBe(0);
      expect(result.netChange.energy).toBe(-3); // only lost what we had
    });

    it('handles all zeros', () => {
      const reserves = makeReserves();
      const consumption = makeReserves();
      const production = makeReserves();
      const result = engine.computeTurnReserveUpdate(reserves, consumption, production);

      expect(result.reserves.energy).toBe(0);
      expect(result.reserves.food).toBe(0);
      expect(result.reserves.water).toBe(0);
      expect(result.reserves.criticalMinerals).toBe(0);
      expect(result.netChange.energy).toBe(0);
      expect(result.netChange.food).toBe(0);
      expect(result.netChange.water).toBe(0);
      expect(result.netChange.criticalMinerals).toBe(0);
    });
  });

  // ── getReservesSummary ───────────────────────────────────

  describe('getReservesSummary', () => {
    it('returns the correct total units', () => {
      const reserves = makeReserves({ energy: 10, food: 20, water: 30, criticalMinerals: 40 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary: ReservesSummary = engine.getReservesSummary(reserves, consumption);

      expect(summary.totalUnits).toBe(100);
    });

    it('returns the correct preparedness rating', () => {
      // Total = 100 >= 48 → excellent
      const reserves = makeReserves({ energy: 25, food: 25, water: 25, criticalMinerals: 25 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.preparednessRating).toBe('excellent');
    });

    it('returns good rating for total >= 24', () => {
      const reserves = makeReserves({ energy: 7, food: 7, water: 7, criticalMinerals: 7 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.totalUnits).toBe(28);
      expect(summary.preparednessRating).toBe('good');
    });

    it('returns fair rating for total >= 12', () => {
      const reserves = makeReserves({ energy: 4, food: 4, water: 4, criticalMinerals: 4 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.totalUnits).toBe(16);
      expect(summary.preparednessRating).toBe('fair');
    });

    it('returns poor rating for total >= 4', () => {
      const reserves = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.totalUnits).toBe(4);
      expect(summary.preparednessRating).toBe('poor');
    });

    it('returns critical rating for total < 4', () => {
      const reserves = makeReserves({ energy: 1 });
      const consumption = makeReserves({ energy: 1, food: 1, water: 1, criticalMinerals: 1 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.totalUnits).toBe(1);
      expect(summary.preparednessRating).toBe('critical');
    });

    it('estimatedBufferTurns reflects minimum buffer', () => {
      // energy: 10/5 = 2, food: 20/10 = 2, water: 30/3 = 10, minerals: 40/8 = 5
      const reserves = makeReserves({ energy: 10, food: 20, water: 30, criticalMinerals: 40 });
      const consumption = makeReserves({ energy: 5, food: 10, water: 3, criticalMinerals: 8 });
      const summary = engine.getReservesSummary(reserves, consumption);

      expect(summary.estimatedBufferTurns).toBe(2);
    });
  });

  // ── config override ──────────────────────────────────────

  describe('config override', () => {
    it('respects custom costPer10Units', () => {
      const custom = new StrategicReservesEngine({ costPer10Units: -10 });
      const cost = custom.computeStockpileCost(10);

      expect(cost).toBe(-10);
    });

    it('respects custom costPer10Units for larger amounts', () => {
      const custom = new StrategicReservesEngine({ costPer10Units: -3 });
      const cost = custom.computeStockpileCost(25);

      // ceil(25/10) = 3 batches × -3 = -9
      expect(cost).toBe(-9);
    });
  });
});
