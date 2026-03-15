/**
 * Commodity & Trade Engine Tests — FR-7001, FR-7002, FR-7004
 */
import { describe, it, expect } from 'vitest';
import {
  initCommodityPrices,
  initShippingState,
  initTradeLedger,
  initConsumerBehavior,
  initNationEconomicState,
  updateCommodityPrices,
  updateShippingState,
  updateTradeLedger,
  updateConsumerBehavior,
  computeCommodityInflationDelta,
  avgCommodityIndex,
  processCommodityTurn,
} from '../commodity-engine';
import type { CommodityPrices } from '@/data/types/economic-state.types';
import type { NationState } from '@/data/types/nation.types';
import type { FactionId, TurnNumber } from '@/data/types/enums';

// ─── Initialization Tests ───────────────────────────────────────────────────

describe('FR-7001 Commodity Engine — Initialization', () => {
  it('initCommodityPrices returns baseline 100 for all commodities', () => {
    const prices = initCommodityPrices();
    expect(prices.oil).toBe(100);
    expect(prices.naturalGas).toBe(100);
    expect(prices.food).toBe(100);
    expect(prices.metals).toBe(100);
    expect(prices.consumerGoods).toBe(100);
  });

  it('initShippingState returns baseline values', () => {
    const ship = initShippingState();
    expect(ship.domesticTransportCost).toBe(100);
    expect(ship.internationalShippingCost).toBe(100);
    expect(ship.shippingLaneDisruption).toBe(0);
    expect(ship.disruptedLanes).toEqual([]);
  });

  it('initTradeLedger creates ledger with default tariffs and base volumes', () => {
    const ledger = initTradeLedger('us' as FactionId);
    expect(ledger.importTariffRate).toBe(5);
    expect(ledger.exportTariffRate).toBe(2);
    expect(ledger.imports).toBe(320);
    expect(ledger.exports).toBe(260);
    expect(ledger.tradeBalance).toBe(-60);
  });

  it('initConsumerBehavior returns baseline confidence and spending', () => {
    const consumer = initConsumerBehavior();
    expect(consumer.consumerConfidence).toBe(65);
    expect(consumer.savingsRate).toBe(15);
    expect(consumer.spendingMultiplier).toBe(1.0);
  });

  it('initNationEconomicState composites all sub-states', () => {
    const econ = initNationEconomicState('china' as FactionId, 1 as TurnNumber);
    expect(econ.factionId).toBe('china');
    expect(econ.turn).toBe(1);
    expect(econ.commodityPrices.oil).toBe(100);
    expect(econ.shipping.shippingLaneDisruption).toBe(0);
    expect(econ.tradeLedger.imports).toBe(280); // china's base
    expect(econ.consumerBehavior.consumerConfidence).toBe(65);
  });
});

// ─── Commodity Price Processing ─────────────────────────────────────────────

describe('FR-7001 Commodity Prices — Price Updates', () => {
  it('prices stay near baseline with no external pressure', () => {
    const prices = updateCommodityPrices({
      current: initCommodityPrices(),
      avgImportTariff: 5,
      shippingDisruption: 0,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    // With neutral random (0.5), tariff=5 (small), no disruption/disaster
    for (const [, val] of Object.entries(prices)) {
      expect(val).toBeGreaterThan(90);
      expect(val).toBeLessThan(115);
    }
  });

  it('high tariffs push prices up', () => {
    const base = initCommodityPrices();
    const highTariff = updateCommodityPrices({
      current: base,
      avgImportTariff: 40,
      shippingDisruption: 0,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    const lowTariff = updateCommodityPrices({
      current: base,
      avgImportTariff: 0,
      shippingDisruption: 0,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    expect(highTariff.food).toBeGreaterThan(lowTariff.food);
    expect(highTariff.oil).toBeGreaterThan(lowTariff.oil);
  });

  it('shipping disruption pushes prices up', () => {
    const base = initCommodityPrices();
    const disrupted = updateCommodityPrices({
      current: base,
      avgImportTariff: 5,
      shippingDisruption: 80,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    const normal = updateCommodityPrices({
      current: base,
      avgImportTariff: 5,
      shippingDisruption: 0,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    expect(disrupted.oil).toBeGreaterThan(normal.oil);
  });

  it('disasters cause price shocks', () => {
    const base = initCommodityPrices();
    const disaster = updateCommodityPrices({
      current: base,
      avgImportTariff: 5,
      shippingDisruption: 0,
      disasterSeveritySum: 8,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    const calm = updateCommodityPrices({
      current: base,
      avgImportTariff: 5,
      shippingDisruption: 0,
      disasterSeveritySum: 0,
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
    });
    expect(disaster.food).toBeGreaterThan(calm.food);
    expect(disaster.oil).toBeGreaterThan(calm.oil);
  });

  it('prices are bounded between min and max', () => {
    const extremeHigh: CommodityPrices = { oil: 490, naturalGas: 490, food: 490, metals: 490, consumerGoods: 490 };
    const result = updateCommodityPrices({
      current: extremeHigh,
      avgImportTariff: 60,
      shippingDisruption: 100,
      disasterSeveritySum: 10,
      randomValues: { oil: 1.0, naturalGas: 1.0, food: 1.0, metals: 1.0, consumerGoods: 1.0 },
    });
    for (const [, val] of Object.entries(result)) {
      expect(val).toBeLessThanOrEqual(500);
      expect(val).toBeGreaterThanOrEqual(20);
    }
  });
});

// ─── Shipping State ─────────────────────────────────────────────────────────

describe('FR-7001 Shipping State', () => {
  it('disruption decays naturally per turn', () => {
    const ship = updateShippingState({
      current: { domesticTransportCost: 120, internationalShippingCost: 150, shippingLaneDisruption: 30, disruptedLanes: ['Suez Canal'] },
      oilPrice: 100,
      disasterSeverity: 0,
      blockadeActive: false,
      newDisruptedLanes: [],
    });
    expect(ship.shippingLaneDisruption).toBeLessThan(30);
  });

  it('blockade increases disruption', () => {
    const withBlock = updateShippingState({
      current: initShippingState(),
      oilPrice: 100,
      disasterSeverity: 0,
      blockadeActive: true,
      newDisruptedLanes: [],
    });
    expect(withBlock.shippingLaneDisruption).toBeGreaterThan(0);
  });

  it('higher oil prices increase transport costs', () => {
    const highOil = updateShippingState({
      current: initShippingState(),
      oilPrice: 200,
      disasterSeverity: 0,
      blockadeActive: false,
      newDisruptedLanes: [],
    });
    const lowOil = updateShippingState({
      current: initShippingState(),
      oilPrice: 50,
      disasterSeverity: 0,
      blockadeActive: false,
      newDisruptedLanes: [],
    });
    expect(highOil.domesticTransportCost).toBeGreaterThan(lowOil.domesticTransportCost);
    expect(highOil.internationalShippingCost).toBeGreaterThan(lowOil.internationalShippingCost);
  });
});

// ─── Trade Ledger ───────────────────────────────────────────────────────────

describe('FR-7002 Trade Ledger', () => {
  it('higher tariffs reduce trade volume', () => {
    const highTariff = updateTradeLedger({
      current: { ...initTradeLedger('us' as FactionId), importTariffRate: 40 },
      factionId: 'us' as FactionId,
      avgCommodityIndex: 100,
      spendingMultiplier: 1.0,
      shippingCostIndex: 100,
    });
    const lowTariff = updateTradeLedger({
      current: { ...initTradeLedger('us' as FactionId), importTariffRate: 5 },
      factionId: 'us' as FactionId,
      avgCommodityIndex: 100,
      spendingMultiplier: 1.0,
      shippingCostIndex: 100,
    });
    expect(highTariff.imports).toBeLessThan(lowTariff.imports);
  });

  it('consumer spending multiplier affects imports', () => {
    const highSpend = updateTradeLedger({
      current: initTradeLedger('us' as FactionId),
      factionId: 'us' as FactionId,
      avgCommodityIndex: 100,
      spendingMultiplier: 1.3,
      shippingCostIndex: 100,
    });
    const lowSpend = updateTradeLedger({
      current: initTradeLedger('us' as FactionId),
      factionId: 'us' as FactionId,
      avgCommodityIndex: 100,
      spendingMultiplier: 0.7,
      shippingCostIndex: 100,
    });
    expect(highSpend.imports).toBeGreaterThan(lowSpend.imports);
  });

  it('trade balance is exports minus imports', () => {
    const ledger = updateTradeLedger({
      current: initTradeLedger('china' as FactionId),
      factionId: 'china' as FactionId,
      avgCommodityIndex: 100,
      spendingMultiplier: 1.0,
      shippingCostIndex: 100,
    });
    expect(ledger.tradeBalance).toBe(ledger.exports - ledger.imports);
  });
});

// ─── Consumer Behavior ──────────────────────────────────────────────────────

describe('FR-7004 Consumer Behavior', () => {
  it('high inflation reduces consumer confidence', () => {
    const highInfl = updateConsumerBehavior({
      current: initConsumerBehavior(),
      inflation: 25,
      avgCommodityIndex: 100,
      gdpGrowthRate: 0,
      activeDisasterSeverity: 0,
    });
    const lowInfl = updateConsumerBehavior({
      current: initConsumerBehavior(),
      inflation: 2,
      avgCommodityIndex: 100,
      gdpGrowthRate: 0,
      activeDisasterSeverity: 0,
    });
    expect(highInfl.consumerConfidence).toBeLessThan(lowInfl.consumerConfidence);
  });

  it('disasters reduce consumer confidence', () => {
    const disaster = updateConsumerBehavior({
      current: initConsumerBehavior(),
      inflation: 5,
      avgCommodityIndex: 100,
      gdpGrowthRate: 0,
      activeDisasterSeverity: 8,
    });
    expect(disaster.consumerConfidence).toBeLessThan(65);
  });

  it('low confidence reduces spending multiplier', () => {
    const low = updateConsumerBehavior({
      current: { ...initConsumerBehavior(), consumerConfidence: 20 },
      inflation: 30,
      avgCommodityIndex: 150,
      gdpGrowthRate: -0.02,
      activeDisasterSeverity: 5,
    });
    expect(low.spendingMultiplier).toBeLessThan(1.0);
  });

  it('high confidence boosts spending multiplier', () => {
    const high = updateConsumerBehavior({
      current: { ...initConsumerBehavior(), consumerConfidence: 85 },
      inflation: 2,
      avgCommodityIndex: 80,
      gdpGrowthRate: 0.05,
      activeDisasterSeverity: 0,
    });
    expect(high.spendingMultiplier).toBeGreaterThan(1.0);
  });
});

// ─── Inflation Feedback ─────────────────────────────────────────────────────

describe('FR-7001 Inflation Feedback', () => {
  it('returns 0 delta when all prices at baseline', () => {
    const delta = computeCommodityInflationDelta(initCommodityPrices());
    expect(delta).toBe(0);
  });

  it('returns positive delta for above-baseline prices', () => {
    const delta = computeCommodityInflationDelta({
      oil: 150, naturalGas: 140, food: 130, metals: 120, consumerGoods: 110,
    });
    expect(delta).toBeGreaterThan(0);
  });

  it('returns negative delta for below-baseline prices', () => {
    const delta = computeCommodityInflationDelta({
      oil: 60, naturalGas: 70, food: 60, metals: 80, consumerGoods: 90,
    });
    expect(delta).toBeLessThan(0);
  });
});

describe('avgCommodityIndex', () => {
  it('returns 100 for baseline prices', () => {
    expect(avgCommodityIndex(initCommodityPrices())).toBe(100);
  });

  it('returns average across all commodities', () => {
    expect(avgCommodityIndex({
      oil: 200, naturalGas: 100, food: 100, metals: 100, consumerGoods: 100,
    })).toBe(120);
  });
});

// ─── Full Turn Processing ───────────────────────────────────────────────────

describe('FR-7001 processCommodityTurn', () => {
  const mockNS: NationState = {
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
  };

  it('returns updated economic state with all sub-fields', () => {
    const result = processCommodityTurn({
      economicState: initNationEconomicState('us' as FactionId, 1 as TurnNumber),
      nationState: mockNS,
      disasterSeverity: 0,
      blockadeActive: false,
      newDisruptedLanes: [],
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
      turn: 2 as TurnNumber,
    });

    expect(result.economicState.turn).toBe(2);
    expect(result.economicState.commodityPrices).toBeDefined();
    expect(result.economicState.shipping).toBeDefined();
    expect(result.economicState.tradeLedger).toBeDefined();
    expect(result.economicState.consumerBehavior).toBeDefined();
    expect(typeof result.inflationDelta).toBe('number');
    expect(typeof result.gdpSpendingImpact).toBe('number');
    expect(typeof result.tradeBalanceTreasuryImpact).toBe('number');
  });

  it('disasters produce positive inflation delta', () => {
    const result = processCommodityTurn({
      economicState: initNationEconomicState('us' as FactionId, 1 as TurnNumber),
      nationState: mockNS,
      disasterSeverity: 8,
      blockadeActive: false,
      newDisruptedLanes: [],
      randomValues: { oil: 0.5, naturalGas: 0.5, food: 0.5, metals: 0.5, consumerGoods: 0.5 },
      turn: 2 as TurnNumber,
    });
    expect(result.inflationDelta).toBeGreaterThan(0);
  });
});
