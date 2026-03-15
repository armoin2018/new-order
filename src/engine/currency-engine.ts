/**
 * Currency Exchange Rate Engine
 *
 * Pure-function module that drives per-turn currency exchange rate
 * calculations, event-driven rate fluctuations, currency manipulation
 * actions, and foreign reserve mechanics.
 *
 * All functions are **pure** — no side effects, no mutation of inputs.
 *
 * @module currency-engine
 * @see FR-3800 — Currency Exchange Rate System
 * @see FR-3801 — Event-Driven Rate Fluctuations
 * @see FR-3802 — Cross-Rate Matrix & Top Movers
 * @see FR-3803 — Currency Manipulation Mechanics
 * @see FR-3804 — Foreign Reserve Buffer
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId } from '@/data/types';
import type {
  CurrencyRecord,
  CurrencyState,
  CurrencyEvent,
  CurrencyManipulationAction,
  CurrencyManipulationResult,
  CurrencyDefinition,
} from '@/data/types/currency.types';

// ---------------------------------------------------------------------------
// Config shorthand
// ---------------------------------------------------------------------------

const cfg = GAME_CONFIG.currency;

// ---------------------------------------------------------------------------
// RNG interface accepted by all stochastic functions
// ---------------------------------------------------------------------------

/** Minimal RNG contract — compatible with SeededRandom. */
interface Rng {
  next(): number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate between `min` and `max` using a `t` in [0, 1).
 */
function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

/**
 * Look up the {@link CurrencyDefinition} for a faction from the config.
 * Returns `undefined` when the faction has no entry.
 */
function getDefinition(nationId: FactionId): CurrencyDefinition | undefined {
  return cfg.nationCurrencies[nationId] as CurrencyDefinition | undefined;
}

// ---------------------------------------------------------------------------
// initializeCurrencyState  (FR-3800)
// ---------------------------------------------------------------------------

/**
 * Build the initial {@link CurrencyState} for a set of nations.
 *
 * Nations without a matching entry in the currency config are silently
 * skipped (they will not appear in the returned state).
 *
 * @param nationIds - Faction identifiers to initialize.
 * @returns A fresh `CurrencyState` with zero history.
 *
 * @see FR-3800 — Currency Exchange Rate System
 */
export function initializeCurrencyState(nationIds: FactionId[]): CurrencyState {
  const records = {} as Record<FactionId, CurrencyRecord>;
  const history = {} as Record<FactionId, CurrencyRecord[]>;

  for (const id of nationIds) {
    const def = getDefinition(id);
    if (!def) continue;

    const record: CurrencyRecord = {
      nationCode: id,
      currencyCode: def.currencyCode,
      currencyName: def.currencyName,
      exchangeRateVsUSD: def.initialRateVsUSD,
      previousRate: def.initialRateVsUSD,
      percentChange: 0,
      foreignReserves: def.initialReserves,
      reserveChangeAmount: 0,
      rateDriverEvents: [],
    };

    records[id] = record;
    history[id] = [];
  }

  return { records, history };
}

// ---------------------------------------------------------------------------
// applyEventToRate  (FR-3801, FR-3804)
// ---------------------------------------------------------------------------

/**
 * Apply a single {@link CurrencyEvent} to a {@link CurrencyRecord}.
 *
 * When the nation's foreign reserves exceed the high-reserve threshold
 * the first {@link cfg.reserves.reserveBufferPercent}% of any *negative*
 * impact is absorbed and converted into a reserve deduction instead.
 *
 * @param record - The current currency record (not mutated).
 * @param event  - The event to apply.
 * @param rng    - Seeded RNG for stochastic roll within event range.
 * @returns A new `CurrencyRecord` reflecting the event's impact.
 *
 * @see FR-3801 — Event-Driven Rate Fluctuations
 * @see FR-3804 — Foreign Reserve Buffer
 */
export function applyEventToRate(
  record: CurrencyRecord,
  event: CurrencyEvent,
  rng: Rng,
): CurrencyRecord {
  // Determine the impact percent from event + config range
  let impactPercent = event.rateImpactPercent;

  // For military_conflict, differentiate safe-haven nations
  if (event.eventType === 'military_conflict') {
    const def = getDefinition(record.nationCode);
    const isSafe = def?.isSafeHaven ?? false;
    const rangeKey = isSafe ? 'military_safe_haven' : 'military_conflict_zone';
    const range = cfg.eventImpactRanges[rangeKey];
    impactPercent = lerp(range.min, range.max, rng.next());
  } else if (event.eventType !== 'manipulation') {
    // Roll within the configured range for the event type
    const range = cfg.eventImpactRanges[event.eventType as keyof typeof cfg.eventImpactRanges];
    if (range) {
      impactPercent = lerp(range.min, range.max, rng.next());
    }
  }

  // Reserve buffer: high-reserve nations absorb part of negative impact
  let reserveDelta = 0;
  if (impactPercent < 0 && record.foreignReserves > cfg.reserves.highReserveThreshold) {
    const bufferFraction = cfg.reserves.reserveBufferPercent / 100;
    const absorbed = Math.abs(impactPercent) * bufferFraction;
    impactPercent += absorbed; // reduce severity (move toward 0)
    reserveDelta = -cfg.reserves.reserveDepletionPerDefense;
  }

  // Apply rate change
  const newRate = Math.max(0.0001, record.exchangeRateVsUSD * (1 + impactPercent / 100));
  const pctChange = ((newRate - record.previousRate) / record.previousRate) * 100;
  const newReserves = Math.max(0, record.foreignReserves + reserveDelta);

  return {
    ...record,
    exchangeRateVsUSD: newRate,
    percentChange: pctChange,
    foreignReserves: newReserves,
    reserveChangeAmount: reserveDelta,
    rateDriverEvents: [...record.rateDriverEvents, event.description],
  };
}

// ---------------------------------------------------------------------------
// applyCurrencyManipulation  (FR-3803)
// ---------------------------------------------------------------------------

/**
 * Execute a currency manipulation action against a target nation's record.
 *
 * @param record - The current currency record of the target (not mutated).
 * @param type   - The manipulation action type.
 * @param rng    - Seeded RNG for stochastic roll within manipulation range.
 * @returns A {@link CurrencyManipulationResult} describing the outcome.
 *
 * @see FR-3803 — Currency Manipulation Mechanics
 */
export function applyCurrencyManipulation(
  record: CurrencyRecord,
  type: CurrencyManipulationAction,
  rng: Rng,
): CurrencyManipulationResult {
  const range = cfg.manipulationImpacts[type];
  const impactPercent = lerp(range.min, range.max, rng.next());
  const newRate = Math.max(0.0001, record.exchangeRateVsUSD * (1 + impactPercent / 100));

  // Reserve cost scales with manipulation severity
  const reserveImpact = -cfg.reserves.reserveDepletionPerDefense * (Math.abs(impactPercent) / 20);

  const descriptions: Record<CurrencyManipulationAction, string> = {
    devaluation: `Deliberate devaluation of ${record.currencyCode} by ${Math.abs(impactPercent).toFixed(4)}%`,
    reserve_weaponization: `Reserve weaponization against ${record.currencyCode}`,
    currency_attack: `Direct currency attack on ${record.currencyCode}`,
    swift_disconnection: `SWIFT disconnection cripples ${record.currencyCode}`,
  };

  return {
    targetNation: record.nationCode,
    manipulationType: type,
    rateChangePercent: impactPercent,
    newRate,
    reserveImpact,
    description: descriptions[type],
  };
}

// ---------------------------------------------------------------------------
// processEndOfTurnCurrency  (FR-3801, FR-3804)
// ---------------------------------------------------------------------------

/**
 * Process all currency events for the turn, update every nation's record,
 * and append the pre-event snapshot to history.
 *
 * @param state  - Current currency state (not mutated).
 * @param events - Events that occurred this turn.
 * @param rng    - Seeded RNG.
 * @returns A new `CurrencyState` with updated records and appended history.
 *
 * @see FR-3801 — Event-Driven Rate Fluctuations
 * @see FR-3804 — Foreign Reserve Buffer
 */
export function processEndOfTurnCurrency(
  state: CurrencyState,
  events: CurrencyEvent[],
  rng: Rng,
): CurrencyState {
  const newRecords = { ...state.records };
  const newHistory = { ...state.history };

  // Snapshot current records into history before mutation
  for (const nationId of Object.keys(newRecords) as FactionId[]) {
    const prev = newRecords[nationId];
    if (!prev) continue;
    newHistory[nationId] = [...(newHistory[nationId] ?? []), { ...prev }];
  }

  // Apply events to affected nations
  for (const event of events) {
    const nationId = event.affectedNation;
    let rec = newRecords[nationId];
    if (!rec) continue;

    // Set previousRate to the rate before this turn's events
    rec = { ...rec, previousRate: rec.exchangeRateVsUSD, rateDriverEvents: [] };
    rec = applyEventToRate(rec, event, rng);
    newRecords[nationId] = rec;
  }

  // Trade-surplus reserve regeneration for nations that weren't hit
  for (const nationId of Object.keys(newRecords) as FactionId[]) {
    const rec = newRecords[nationId];
    if (!rec) continue;
    const regen = rec.foreignReserves * cfg.reserves.tradeSuplusRegenRate;
    newRecords[nationId] = {
      ...rec,
      foreignReserves: rec.foreignReserves + regen,
    };
  }

  return { records: newRecords, history: newHistory };
}

// ---------------------------------------------------------------------------
// getCurrencyTopMovers  (FR-3802)
// ---------------------------------------------------------------------------

/**
 * Return the top-N nations ranked by absolute percent change this turn.
 *
 * @param state - Current currency state.
 * @param count - Number of movers to return (default 5).
 * @returns Sorted array of `{ nation, change }` tuples, descending by |change|.
 *
 * @see FR-3802 — Cross-Rate Matrix & Top Movers
 */
export function getCurrencyTopMovers(
  state: CurrencyState,
  count = 5,
): { nation: FactionId; change: number }[] {
  return Object.values(state.records)
    .map((r) => ({ nation: r.nationCode, change: r.percentChange }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// getCrossRateMatrix  (FR-3802)
// ---------------------------------------------------------------------------

/**
 * Compute an N×N cross-rate matrix for the given nations.
 *
 * `matrix[A][B]` = how many units of A's currency per 1 unit of B's currency.
 *
 * @param state   - Current currency state.
 * @param nations - Subset of nations to include.
 * @returns Nested record keyed by currency code.
 *
 * @see FR-3802 — Cross-Rate Matrix & Top Movers
 */
export function getCrossRateMatrix(
  state: CurrencyState,
  nations: FactionId[],
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  for (const rowId of nations) {
    const rowRec = state.records[rowId];
    if (!rowRec) continue;
    const rowCode = rowRec.currencyCode;
    matrix[rowCode] = {};

    for (const colId of nations) {
      const colRec = state.records[colId];
      if (!colRec) continue;
      const colCode = colRec.currencyCode;

      // Cross-rate: (rowRate / colRate) gives units of row currency per 1 col currency
      matrix[rowCode][colCode] = rowRec.exchangeRateVsUSD / colRec.exchangeRateVsUSD;
    }
  }

  return matrix;
}
