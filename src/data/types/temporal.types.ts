/**
 * Temporal / Turn-Duration Types
 *
 * Types governing how simulated time advances and how time-dependent
 * calculations are scaled based on the chosen turn-duration unit.
 *
 * @see FR-3701 — Turn duration unit selection
 * @see DR-183  — Turn duration configuration stored in scenario definition
 */

/** Turn duration unit options. @see FR-3701 */
export type TurnDurationUnit = 'days' | 'weeks' | 'months' | 'years';

/**
 * Turn duration configuration stored in a scenario definition.
 * @see DR-183
 */
export interface TurnDurationConfig {
  /** Selected time unit per turn. */
  unit: TurnDurationUnit;
  /** Simulated start date (ISO-8601 string). */
  simulatedStartDate: string;
  /** Current simulated date (computed, updated each turn). */
  currentSimulatedDate: string;
  /** Scaling multiplier derived from unit relative to monthly baseline. */
  scalingMultiplier: number;
}

/**
 * Result of computing temporal scaling for a specific turn.
 * @see FR-3702
 */
export interface TemporalScalingResult {
  /** The multiplier to apply to all time-dependent calculations. */
  multiplier: number;
  /** Human-readable date range label for the current turn. */
  dateLabel: string;
  /** The simulated date at the start of this turn. */
  turnStartDate: string;
  /** The simulated date at the end of this turn. */
  turnEndDate: string;
}
