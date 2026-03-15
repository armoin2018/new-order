/**
 * Economic State Types — FR-7000 series
 *
 * Commodity pricing, trade ledgers, national debt, shipping lanes,
 * tariff management, and chaotic event tracking.
 *
 * These types extend NationState with deep economic modeling:
 * - Commodity prices (gas, oil, food/crops, metals, transportation)
 * - Import/export tariffs and trade balance
 * - Shipping lane disruptions and transportation costs
 * - National debt tracking and credit ratings
 * - Consumer behavior / buyer habits index
 * - Chaotic natural disaster events
 */

import type { FactionId, TurnNumber } from './enums';

// ---------------------------------------------------------------------------
// FR-7001 — Commodity Price State
// ---------------------------------------------------------------------------

/**
 * Per-nation commodity price index tracking real-time prices
 * for key economic commodities. Prices are indexed relative to
 * a baseline of 100 (game start = 100).
 */
export interface CommodityPrices {
  /** Crude oil price index. Baseline 100. */
  oil: number;
  /** Natural gas price index. Baseline 100. */
  naturalGas: number;
  /** Food/crops composite index (grain, rice, livestock). Baseline 100. */
  food: number;
  /** Critical metals index (steel, aluminum, rare earth). Baseline 100. */
  metals: number;
  /** Consumer goods index. Baseline 100. */
  consumerGoods: number;
}

/**
 * Per-nation shipping and transportation cost state.
 */
export interface ShippingState {
  /** Domestic transportation cost index. Baseline 100. */
  domesticTransportCost: number;
  /** International shipping cost index. Baseline 100. */
  internationalShippingCost: number;
  /**
   * Shipping lane disruption level (0–100).
   * 0 = fully open, 100 = completely blocked.
   * Affected by naval blockades, piracy, natural disasters.
   */
  shippingLaneDisruption: number;
  /** Names of disrupted shipping lanes. */
  disruptedLanes: string[];
}

// ---------------------------------------------------------------------------
// FR-7002 — Trade Ledger
// ---------------------------------------------------------------------------

/**
 * Per-nation per-turn import/export tariff rates and trade balance.
 */
export interface TradeLedger {
  /** Average import tariff rate as percentage (0–100). */
  importTariffRate: number;
  /** Average export tariff rate as percentage (0–100). */
  exportTariffRate: number;
  /** Total imports in billions USD. */
  imports: number;
  /** Total exports in billions USD. */
  exports: number;
  /** Trade balance = exports − imports (can be negative). */
  tradeBalance: number;
  /** Active trade partners (factions with open trade). */
  tradePartners: FactionId[];
  /** Factions currently under retaliatory tariffs. */
  tariffTargets: FactionId[];
}

// ---------------------------------------------------------------------------
// FR-7003 — National Debt
// ---------------------------------------------------------------------------

/** Credit rating tiers. */
export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';

/**
 * Per-nation national debt tracking.
 */
export interface NationalDebt {
  /** Total national debt in billions USD. */
  totalDebt: number;
  /** Debt-to-GDP ratio as a percentage. */
  debtToGDP: number;
  /** Annual interest payments in billions USD (per turn cost). */
  interestPayments: number;
  /** Credit rating — affects borrowing costs and investor confidence. */
  creditRating: CreditRating;
  /** Debt trajectory: increasing, stable, or decreasing. */
  trajectory: 'increasing' | 'stable' | 'decreasing';
  /** Number of consecutive turns of deficit spending. */
  consecutiveDeficits: number;
}

// ---------------------------------------------------------------------------
// FR-7004 — Consumer Behavior / Buyer Habits
// ---------------------------------------------------------------------------

/**
 * Consumer behavior index reflecting buyer habits.
 * Driven by inflation, commodity prices, employment, and consumer confidence.
 */
export interface ConsumerBehavior {
  /** Consumer confidence index. Range: 0–100. Higher = more spending. */
  consumerConfidence: number;
  /** Savings rate as percentage of income. */
  savingsRate: number;
  /**
   * Spending multiplier. 1.0 = normal.
   * < 1.0 = consumers pulling back (high inflation, disaster fear).
   * > 1.0 = consumers spending freely (confidence boom).
   */
  spendingMultiplier: number;
  /** Import preference — higher values mean more imports consumed. 0–100. */
  importPreference: number;
}

// ---------------------------------------------------------------------------
// FR-7005 — Chaotic Events (Natural Disasters)
// ---------------------------------------------------------------------------

/** Types of chaotic natural disaster events. */
export const ChaoticEventType = {
  Earthquake: 'earthquake',
  Tornado: 'tornado',
  Hurricane: 'hurricane',
  Flood: 'flood',
  Virus: 'virus',
  Tsunami: 'tsunami',
  Volcanic: 'volcanic_eruption',
  Wildfire: 'wildfire',
  Drought: 'drought',
  Blizzard: 'blizzard',
} as const;

export type ChaoticEventType = (typeof ChaoticEventType)[keyof typeof ChaoticEventType];

/**
 * A single chaotic event (natural disaster, pandemic, etc.).
 */
export interface ChaoticEvent {
  /** Unique event ID. */
  id: string;
  /** Type of disaster. */
  type: ChaoticEventType;
  /** Affected nation. */
  targetNation: FactionId;
  /** Human-readable name (e.g. "Great Pacific Earthquake"). */
  name: string;
  /** Severity: 1–10. Determines scale of economic/population damage. */
  severity: number;
  /** Turn the event fires. */
  turnFired: TurnNumber;
  /** Duration in turns (1 = instant, >1 = ongoing like pandemics). */
  duration: number;
  /** Turns remaining (decrements each turn). */
  turnsRemaining: number;
  /** Whether the event is still active. */
  active: boolean;
  /** Economic damage in billions USD (cumulative). */
  economicDamage: number;
  /** Population impact (thousands displaced/affected). */
  populationImpact: number;
  /** Infrastructure damage percentage (0–100). */
  infrastructureDamage: number;
  /** Whether disaster response has been activated. */
  responseActivated: boolean;
}

/**
 * Global chaotic events state tracking active and historical disasters.
 */
export interface ChaoticEventState {
  /** Currently active chaotic events. */
  activeEvents: ChaoticEvent[];
  /** Resolved/historical events. */
  historicalEvents: ChaoticEvent[];
  /** Global pandemic alert level (0–100). */
  pandemicAlertLevel: number;
  /** Cumulative natural disaster count this game. */
  totalDisastersThisGame: number;
}

// ---------------------------------------------------------------------------
// FR-7006 — Composite Economic State (per-nation)
// ---------------------------------------------------------------------------

/**
 * Full per-nation economic state. Composites commodity prices,
 * trade, debt, shipping, and consumer behavior into one record.
 */
export interface NationEconomicState {
  factionId: FactionId;
  turn: TurnNumber;
  commodityPrices: CommodityPrices;
  shipping: ShippingState;
  tradeLedger: TradeLedger;
  nationalDebt: NationalDebt;
  consumerBehavior: ConsumerBehavior;
}
