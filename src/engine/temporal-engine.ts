/**
 * Temporal Engine — Turn Duration & Simulated Date Computations
 *
 * All functions are pure (no side-effects). Date math uses the built-in
 * `Date` constructor so no third-party date library is required.
 *
 * @see FR-3701 — Turn duration unit selection
 * @see FR-3702 — Temporal scaling multipliers
 * @see FR-3703 — Simulated date advancement
 */

import { GAME_CONFIG } from '@/engine/config';
import type { TurnDurationUnit, TurnDurationConfig, TemporalScalingResult } from '@/data/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Format a Date into an ISO-8601 date-only string (yyyy-MM-dd) using UTC. */
function toISODate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Advance a `Date` by one turn of the given unit and return the new `Date`.
 * Uses UTC methods so timezone offsets never shift the calendar date.
 * Does not mutate the input.
 */
function advanceByUnit(date: Date, unit: TurnDurationUnit): Date {
  const d = new Date(date.getTime());
  switch (unit) {
    case 'days':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weeks':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'months':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'years':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}

/**
 * Format a `Date` for display according to the chosen unit (UTC).
 * @see FR-3703
 */
function formatDate(d: Date, unit: TurnDurationUnit): string {
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();

  switch (unit) {
    case 'days':
    case 'weeks':
      return `${month} ${day}, ${year}`;
    case 'months':
      return `${month} ${year}`;
    case 'years':
      return `${year}`;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the scaling multiplier for a given turn-duration unit relative to
 * the monthly baseline (1.0).
 *
 * @see FR-3702
 */
export function getScalingMultiplier(unit: TurnDurationUnit): number {
  return GAME_CONFIG.temporal.scalingMultipliers[unit];
}

/**
 * Create a fully-populated `TurnDurationConfig` for a given unit and
 * optional start date.
 *
 * @param unit      — The turn-duration unit to use.
 * @param startDate — ISO-8601 start date.  Defaults to
 *                    `GAME_CONFIG.temporal.defaultStartDate`.
 * @see FR-3701
 */
export function createTurnDurationConfig(
  unit: TurnDurationUnit,
  startDate?: string,
): TurnDurationConfig {
  const start = startDate ?? GAME_CONFIG.temporal.defaultStartDate;
  return {
    unit,
    simulatedStartDate: start,
    currentSimulatedDate: start,
    scalingMultiplier: getScalingMultiplier(unit),
  };
}

/**
 * Compute the full temporal-scaling result for a specific turn number.
 *
 * @param config     — The current turn-duration configuration.
 * @param turnNumber — 1-based turn number.
 * @see FR-3702
 */
export function computeTemporalScaling(
  config: TurnDurationConfig,
  turnNumber: number,
): TemporalScalingResult {
  const baseDate = new Date(config.simulatedStartDate);

  // Turn N starts after (N-1) advances from the base date.
  let turnStart = new Date(baseDate.getTime());
  for (let i = 1; i < turnNumber; i++) {
    turnStart = advanceByUnit(turnStart, config.unit);
  }

  const turnEnd = advanceByUnit(turnStart, config.unit);

  const startLabel = formatDate(turnStart, config.unit);
  const endLabel = formatDate(turnEnd, config.unit);
  const dateLabel =
    startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;

  return {
    multiplier: config.scalingMultiplier,
    dateLabel,
    turnStartDate: toISODate(turnStart),
    turnEndDate: toISODate(turnEnd),
  };
}

/**
 * Return the simulated date (ISO-8601 string) after advancing `turnNumber`
 * turns from the start date in `config`.
 *
 * @see FR-3703
 */
export function advanceSimulatedDate(
  config: TurnDurationConfig,
  turnNumber: number,
): string {
  let d = new Date(config.simulatedStartDate);
  for (let i = 0; i < turnNumber; i++) {
    d = advanceByUnit(d, config.unit);
  }
  return toISODate(d);
}

/**
 * Scale any base monthly rate by the temporal multiplier stored in `config`.
 *
 * @param baseMonthlyRate — The rate calibrated for one month.
 * @param config          — The active turn-duration config.
 * @see FR-3702
 */
export function scaleRate(
  baseMonthlyRate: number,
  config: TurnDurationConfig,
): number {
  return baseMonthlyRate * config.scalingMultiplier;
}

/**
 * Return a human-readable date label for the given turn number.
 *
 * @see FR-3703
 */
export function formatTurnDateLabel(
  config: TurnDurationConfig,
  turnNumber: number,
): string {
  return computeTemporalScaling(config, turnNumber).dateLabel;
}
