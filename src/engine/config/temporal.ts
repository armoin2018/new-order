/**
 * New Order — Temporal Configuration
 *
 * Turn duration and date-simulation settings.
 *
 * @see FR-3701 — Turn duration unit selection
 * @see FR-3702 — Temporal scaling multipliers
 * @see FR-3703 — Simulated date advancement
 * @see NFR-204 — All game formulas configurable via constants
 */

export const temporalConfig = {
  /** Default turn duration unit. @see FR-3701 */
  defaultDurationUnit: 'months' as const,
  /** Supported duration units. @see FR-3701 */
  supportedUnits: ['days', 'weeks', 'months', 'years'] as const,
  /** Scaling multipliers relative to monthly baseline (1.0). @see FR-3702 */
  scalingMultipliers: {
    days: 1 / 30,
    weeks: 1 / 4.33,
    months: 1,
    years: 12,
  },
  /** Default simulated start date (ISO-8601). @see FR-3703 */
  defaultStartDate: '2026-03-01',
  /** Date format labels per unit. @see FR-3703 */
  dateFormatLabels: {
    days: 'MMMM d, yyyy',
    weeks: 'MMMM d, yyyy',
    months: 'MMMM yyyy',
    years: 'yyyy',
  },
} as const;
