/**
 * Commodity & Trade Engine — FR-7001, FR-7002, FR-7004
 *
 * Pure-function engine that processes commodity price changes,
 * tariff effects, shipping lane disruptions, and consumer behavior
 * per turn. Drives inflation through commodity price feedback.
 *
 * All functions are pure — no side effects, no internal state.
 */

import type { FactionId, TurnNumber } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';
import type {
  CommodityPrices,
  ShippingState,
  TradeLedger,
  ConsumerBehavior,
  NationEconomicState,
} from '@/data/types/economic-state.types';
import {
  commodityConfig,
  tariffTradeConfig,
  consumerConfig,
  shippingConfig,
} from './config/macro-economy';

// ─────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────

/** Create default commodity prices at game start. */
export function initCommodityPrices(): CommodityPrices {
  return { ...commodityConfig.baseline };
}

/** Create default shipping state at game start. */
export function initShippingState(): ShippingState {
  return {
    domesticTransportCost: shippingConfig.baseDomesticTransport,
    internationalShippingCost: shippingConfig.baseInternationalShipping,
    shippingLaneDisruption: 0,
    disruptedLanes: [],
  };
}

/** Create default trade ledger for a faction. */
export function initTradeLedger(factionId: FactionId): TradeLedger {
  const base = tariffTradeConfig.baseTradeVolumes[factionId] ?? { imports: 20, exports: 15 };
  return {
    importTariffRate: tariffTradeConfig.defaultImportTariff,
    exportTariffRate: tariffTradeConfig.defaultExportTariff,
    imports: base.imports,
    exports: base.exports,
    tradeBalance: base.exports - base.imports,
    tradePartners: [],
    tariffTargets: [],
  };
}

/** Create default consumer behavior. */
export function initConsumerBehavior(): ConsumerBehavior {
  return {
    consumerConfidence: consumerConfig.baseConfidence,
    savingsRate: consumerConfig.baseSavingsRate,
    spendingMultiplier: 1.0,
    importPreference: 50,
  };
}

/** Create a full default NationEconomicState for a faction. */
export function initNationEconomicState(
  factionId: FactionId,
  turn: TurnNumber,
): NationEconomicState {
  return {
    factionId,
    turn,
    commodityPrices: initCommodityPrices(),
    shipping: initShippingState(),
    tradeLedger: initTradeLedger(factionId),
    nationalDebt: {
      totalDebt: 0,   // will be calculated from initialDebtToGDP × GDP
      debtToGDP: 0,
      interestPayments: 0,
      creditRating: 'A',
      trajectory: 'stable',
      consecutiveDeficits: 0,
    },
    consumerBehavior: initConsumerBehavior(),
  };
}

// ─────────────────────────────────────────────────────────
// Commodity Price Processing
// ─────────────────────────────────────────────────────────

export interface CommodityUpdateContext {
  /** Current prices. */
  current: CommodityPrices;
  /** Average import tariff rate across all partners. */
  avgImportTariff: number;
  /** Shipping lane disruption level (0–100). */
  shippingDisruption: number;
  /** Active disaster severity sum for this nation. */
  disasterSeveritySum: number;
  /** Deterministic random value 0–1 for each commodity. */
  randomValues: { oil: number; naturalGas: number; food: number; metals: number; consumerGoods: number };
}

/**
 * Process commodity price changes for one turn.
 * Prices respond to: random volatility, tariffs, shipping disruption, disasters.
 */
export function updateCommodityPrices(ctx: CommodityUpdateContext): CommodityPrices {
  const { current, avgImportTariff, shippingDisruption, disasterSeveritySum, randomValues } = ctx;
  const cfg = commodityConfig;

  function updatePrice(
    key: keyof CommodityPrices,
  ): number {
    const base = current[key];
    const vol = cfg.volatility[key];
    const rand = (randomValues[key] * 2 - 1) * vol; // ±vol%

    // Tariff pressure
    const tariffBump = (avgImportTariff / 10) * (cfg.tariffPriceImpact[key] ?? 0) * base;

    // Shipping disruption pressure
    const shipBump = (shippingDisruption / 10) * (cfg.shippingDisruptionImpact[key] ?? 0) * base;

    // Disaster shock
    let disasterBump = 0;
    if (disasterSeveritySum > 0) {
      const shock = key === 'food' ? cfg.disasterPriceShock.foodPerSeverity
        : (key === 'oil' || key === 'naturalGas') ? cfg.disasterPriceShock.energyPerSeverity
        : key === 'metals' ? cfg.disasterPriceShock.metalsPerSeverity
        : 0;
      disasterBump = disasterSeveritySum * shock * base;
    }

    const newPrice = base + rand + tariffBump + shipBump + disasterBump;

    // Natural mean reversion (2% pull toward 100 baseline per turn)
    const reverted = newPrice + (100 - newPrice) * 0.02;

    return Math.max(cfg.bounds.min, Math.min(cfg.bounds.max, Math.round(reverted * 100) / 100));
  }

  return {
    oil: updatePrice('oil'),
    naturalGas: updatePrice('naturalGas'),
    food: updatePrice('food'),
    metals: updatePrice('metals'),
    consumerGoods: updatePrice('consumerGoods'),
  };
}

// ─────────────────────────────────────────────────────────
// Shipping & Transport Processing
// ─────────────────────────────────────────────────────────

export interface ShippingUpdateContext {
  current: ShippingState;
  /** Oil price index — fuel costs affect transport. */
  oilPrice: number;
  /** Active disaster severity (for new disruptions). */
  disasterSeverity: number;
  /** Whether any military blockade is active. */
  blockadeActive: boolean;
  /** Disrupted lanes from external events. */
  newDisruptedLanes: string[];
}

/** Process shipping state per turn. */
export function updateShippingState(ctx: ShippingUpdateContext): ShippingState {
  const { current, oilPrice, disasterSeverity, blockadeActive, newDisruptedLanes } = ctx;
  const cfg = shippingConfig;

  // Fuel cost passthrough
  const fuelDelta = (oilPrice - 100) * cfg.fuelCostPassthrough;

  // Disruption changes: decay + new disaster disruption + blockade
  let newDisruption = Math.max(0, current.shippingLaneDisruption - cfg.disruptionDecayPerTurn);
  newDisruption += disasterSeverity * cfg.disasterDisruptionPerSeverity;
  if (blockadeActive) newDisruption += 20;
  newDisruption = Math.min(100, Math.max(0, newDisruption));

  // Combine disrupted lanes
  const allLanes = new Set([...current.disruptedLanes, ...newDisruptedLanes]);
  // Remove lanes if disruption is low enough
  if (newDisruption < 10) allLanes.clear();

  return {
    domesticTransportCost: Math.max(50, Math.min(300,
      cfg.baseDomesticTransport + fuelDelta * 80 + newDisruption * 0.5,
    )),
    internationalShippingCost: Math.max(50, Math.min(400,
      cfg.baseInternationalShipping + fuelDelta * 120 + newDisruption * 1.2,
    )),
    shippingLaneDisruption: newDisruption,
    disruptedLanes: [...allLanes],
  };
}

// ─────────────────────────────────────────────────────────
// Trade Ledger Processing
// ─────────────────────────────────────────────────────────

export interface TradeLedgerUpdateContext {
  current: TradeLedger;
  factionId: FactionId;
  /** Commodity price index average (higher prices = more expensive imports). */
  avgCommodityIndex: number;
  /** Consumer spending multiplier. */
  spendingMultiplier: number;
  /** Shipping cost index. */
  shippingCostIndex: number;
}

/** Process trade ledger per turn. */
export function updateTradeLedger(ctx: TradeLedgerUpdateContext): TradeLedger {
  const { current, factionId, avgCommodityIndex, spendingMultiplier, shippingCostIndex } = ctx;
  const cfg = tariffTradeConfig;
  const base = cfg.baseTradeVolumes[factionId] ?? { imports: 20, exports: 15 };

  // Tariff reduction on trade volumes
  const importTariffReduction = 1 - (current.importTariffRate / 10) * cfg.tradeVolumeImpact.importReductionPer10Pct;
  const exportTariffReduction = 1 - (current.exportTariffRate / 10) * cfg.tradeVolumeImpact.exportReductionPer10Pct;

  // Commodity price and shipping cost effects
  const priceFactor = 1 + (avgCommodityIndex - 100) * 0.002; // higher prices = costlier imports
  const shippingFactor = 1 + (shippingCostIndex - 100) * 0.001;

  const imports = Math.max(0, Math.round(
    base.imports * importTariffReduction * priceFactor * shippingFactor * spendingMultiplier,
  ));
  const exports = Math.max(0, Math.round(
    base.exports * exportTariffReduction / priceFactor * (1 / shippingFactor),
  ));

  return {
    ...current,
    imports,
    exports,
    tradeBalance: exports - imports,
  };
}

// ─────────────────────────────────────────────────────────
// Consumer Behavior Processing
// ─────────────────────────────────────────────────────────

export interface ConsumerUpdateContext {
  current: ConsumerBehavior;
  inflation: number;
  avgCommodityIndex: number;
  gdpGrowthRate: number;
  activeDisasterSeverity: number;
}

/** Process consumer behavior per turn. */
export function updateConsumerBehavior(ctx: ConsumerUpdateContext): ConsumerBehavior {
  const { current, inflation, avgCommodityIndex, gdpGrowthRate, activeDisasterSeverity } = ctx;
  const cfg = consumerConfig;

  // Confidence adjustments
  let confidence = current.consumerConfidence;
  confidence += Math.max(0, inflation - 5) * cfg.inflationConfidencePenalty;
  confidence += ((avgCommodityIndex - 100) / 10) * cfg.commodityPriceConfidencePenalty;
  confidence += activeDisasterSeverity * cfg.disasterConfidencePenalty;
  confidence += gdpGrowthRate * cfg.gdpGrowthConfidenceBoost;

  // Mean reversion toward baseline
  confidence += (cfg.baseConfidence - confidence) * 0.05;
  confidence = Math.max(0, Math.min(100, confidence));

  // Spending multiplier from confidence
  const { lowThreshold, highThreshold, minMultiplier, maxMultiplier } = cfg.spendingMultiplier;
  let multiplier: number;
  if (confidence < lowThreshold) {
    multiplier = minMultiplier + (confidence / lowThreshold) * (1 - minMultiplier);
  } else if (confidence > highThreshold) {
    multiplier = 1 + ((confidence - highThreshold) / (100 - highThreshold)) * (maxMultiplier - 1);
  } else {
    multiplier = 1.0;
  }

  // Savings rate: inverse of confidence
  const savingsRate = Math.max(5, Math.min(40,
    cfg.baseSavingsRate + (50 - confidence) * 0.3,
  ));

  // Import preference: higher confidence = more willing to buy imports
  const importPreference = Math.max(20, Math.min(80, confidence * 0.8));

  return {
    consumerConfidence: Math.round(confidence * 10) / 10,
    savingsRate: Math.round(savingsRate * 10) / 10,
    spendingMultiplier: Math.round(multiplier * 1000) / 1000,
    importPreference: Math.round(importPreference),
  };
}

// ─────────────────────────────────────────────────────────
// Inflation Feedback
// ─────────────────────────────────────────────────────────

/**
 * Calculate inflation change from commodity prices.
 * Returns the inflation delta to add to current inflation.
 */
export function computeCommodityInflationDelta(prices: CommodityPrices): number {
  const cfg = commodityConfig.inflationFeedback;
  const delta =
    Math.max(0, prices.oil - 100) / 10 * cfg.oilWeight +
    Math.max(0, prices.naturalGas - 100) / 10 * cfg.gasWeight +
    Math.max(0, prices.food - 100) / 10 * cfg.foodWeight +
    Math.max(0, prices.metals - 100) / 10 * cfg.metalsWeight +
    Math.max(0, prices.consumerGoods - 100) / 10 * cfg.consumerGoodsWeight;

  // Also benefit from below-baseline prices (mild deflation pressure)
  const deflation =
    Math.min(0, prices.oil - 100) / 10 * cfg.oilWeight * 0.3 +
    Math.min(0, prices.food - 100) / 10 * cfg.foodWeight * 0.3;

  return Math.round((delta + deflation) * 100) / 100;
}

/**
 * Calculate average commodity price index for a nation.
 */
export function avgCommodityIndex(prices: CommodityPrices): number {
  return (prices.oil + prices.naturalGas + prices.food + prices.metals + prices.consumerGoods) / 5;
}

// ─────────────────────────────────────────────────────────
// Full turn processing
// ─────────────────────────────────────────────────────────

export interface CommodityTurnInput {
  /** Current economic state. */
  economicState: NationEconomicState;
  /** Current nation state (for inflation, GDP). */
  nationState: NationState;
  /** Active disaster severity sum. */
  disasterSeverity: number;
  /** Whether a blockade is active. */
  blockadeActive: boolean;
  /** New disrupted shipping lanes. */
  newDisruptedLanes: string[];
  /** 5 random values 0–1 for commodity volatility. */
  randomValues: { oil: number; naturalGas: number; food: number; metals: number; consumerGoods: number };
  /** Current turn. */
  turn: TurnNumber;
}

export interface CommodityTurnResult {
  /** Updated economic state. */
  economicState: NationEconomicState;
  /** Inflation delta from commodity changes. */
  inflationDelta: number;
  /** GDP impact from consumer spending changes (multiplier). */
  gdpSpendingImpact: number;
  /** Treasury impact from trade balance. */
  tradeBalanceTreasuryImpact: number;
}

/**
 * Process one turn of commodity, trade, shipping, and consumer behavior
 * for a single nation. Returns updated economic state and feedback deltas.
 */
export function processCommodityTurn(input: CommodityTurnInput): CommodityTurnResult {
  const { economicState, nationState, disasterSeverity, blockadeActive, newDisruptedLanes, randomValues, turn } = input;
  const es = economicState;

  // 1. Update commodity prices
  const newPrices = updateCommodityPrices({
    current: es.commodityPrices,
    avgImportTariff: es.tradeLedger.importTariffRate,
    shippingDisruption: es.shipping.shippingLaneDisruption,
    disasterSeveritySum: disasterSeverity,
    randomValues,
  });

  // 2. Update shipping
  const newShipping = updateShippingState({
    current: es.shipping,
    oilPrice: newPrices.oil,
    disasterSeverity,
    blockadeActive,
    newDisruptedLanes,
  });

  // 3. Compute GDP growth rate (simplified: compare to avg baseline)
  const gdpGrowthRate = ((nationState.gdp - 10000) / 10000) * 0.01;

  // 4. Update consumer behavior
  const avgIdx = avgCommodityIndex(newPrices);
  const newConsumer = updateConsumerBehavior({
    current: es.consumerBehavior,
    inflation: nationState.inflation,
    avgCommodityIndex: avgIdx,
    gdpGrowthRate,
    activeDisasterSeverity: disasterSeverity,
  });

  // 5. Update trade ledger
  const newTrade = updateTradeLedger({
    current: es.tradeLedger,
    factionId: es.factionId,
    avgCommodityIndex: avgIdx,
    spendingMultiplier: newConsumer.spendingMultiplier,
    shippingCostIndex: newShipping.internationalShippingCost,
  });

  // 6. Compute feedback deltas
  const inflationDelta = computeCommodityInflationDelta(newPrices);
  const gdpSpendingImpact = (newConsumer.spendingMultiplier - 1.0) * consumerConfig.spendingGDPImpact;
  const tradeBalanceTreasuryImpact = newTrade.tradeBalance * 0.01; // 1% of trade balance flows to treasury

  return {
    economicState: {
      ...es,
      turn,
      commodityPrices: newPrices,
      shipping: newShipping,
      tradeLedger: newTrade,
      consumerBehavior: newConsumer,
    },
    inflationDelta,
    gdpSpendingImpact,
    tradeBalanceTreasuryImpact,
  };
}
