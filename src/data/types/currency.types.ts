/**
 * Currency Exchange Rate Types — DR-184, FR-3800
 *
 * Defines the data structures for per-nation currency exchange rates,
 * foreign reserve tracking, currency manipulation actions, and the
 * events that drive rate fluctuations each turn.
 */

import type { FactionId } from './enums';

// ---------------------------------------------------------------------------
// Currency manipulation action vocabulary (FR-3803)
// ---------------------------------------------------------------------------

/**
 * Currency manipulation action types for the exchange-rate subsystem.
 *
 * Uses lowercase identifiers that double as config lookup keys in
 * `currencyConfig.manipulationImpacts`.
 *
 * @see FR-3803 — Currency Manipulation Mechanics
 */
export type CurrencyManipulationAction =
  | 'devaluation'
  | 'reserve_weaponization'
  | 'currency_attack'
  | 'swift_disconnection';

// ---------------------------------------------------------------------------
// Per-nation currency record (DR-184)
// ---------------------------------------------------------------------------

/**
 * Currency exchange rate record per nation per turn.
 *
 * Captures the current rate vs USD, percentage change from the previous
 * turn, foreign reserve levels, and the list of events that drove the
 * rate movement.
 *
 * @see DR-184 — Currency Exchange Rate Data
 */
export interface CurrencyRecord {
  /** Nation that owns this currency. */
  nationCode: FactionId;
  /** ISO-style currency code (e.g. 'USD', 'CNY'). */
  currencyCode: string;
  /** Human-readable currency name. */
  currencyName: string;
  /** Current exchange rate vs 1 USD (units of local currency per USD). */
  exchangeRateVsUSD: number;
  /** Exchange rate from the previous turn. */
  previousRate: number;
  /** Percent change from previous rate. */
  percentChange: number;
  /** Foreign reserves in billions USD. */
  foreignReserves: number;
  /** Change in reserves from the previous turn (billions USD). */
  reserveChangeAmount: number;
  /** Descriptive labels of events that influenced the rate this turn. */
  rateDriverEvents: string[];
}

// ---------------------------------------------------------------------------
// Aggregate currency state (GameState fragment)
// ---------------------------------------------------------------------------

/**
 * Complete currency state tracked inside `GameState`.
 *
 * @see DR-184
 */
export interface CurrencyState {
  /** Per-nation currency records for the current turn. */
  records: Record<FactionId, CurrencyRecord>;
  /** Full history of rates per nation per turn. */
  history: Record<FactionId, CurrencyRecord[]>;
}

// ---------------------------------------------------------------------------
// Manipulation result (FR-3803)
// ---------------------------------------------------------------------------

/**
 * Result of a currency manipulation action.
 *
 * @see FR-3803 — Currency Manipulation Mechanics
 */
export interface CurrencyManipulationResult {
  targetNation: FactionId;
  manipulationType: CurrencyManipulationAction;
  rateChangePercent: number;
  newRate: number;
  reserveImpact: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Currency event (FR-3801)
// ---------------------------------------------------------------------------

/**
 * Currency event that can affect exchange rates.
 *
 * @see FR-3801 — Event-Driven Rate Fluctuations
 */
export interface CurrencyEvent {
  eventId: string;
  eventType:
    | 'sanctions'
    | 'trade_deal'
    | 'market_shock'
    | 'inflation'
    | 'military_conflict'
    | 'manipulation';
  affectedNation: FactionId;
  rateImpactPercent: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Initial currency definition
// ---------------------------------------------------------------------------

/**
 * Initial currency definition for a nation — used in config.
 */
export interface CurrencyDefinition {
  currencyCode: string;
  currencyName: string;
  initialRateVsUSD: number;
  initialReserves: number;
  isSafeHaven: boolean;
}
