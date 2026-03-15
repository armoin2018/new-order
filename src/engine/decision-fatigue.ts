/**
 * @module DecisionFatigue
 * @description Decision Fatigue system for New Order.
 *
 * Implements FR-1503: Leaders accumulate decision fatigue as they take more
 * actions under stress. When fatigue exceeds a threshold, cognitive degradation
 * manifests as one of three effects:
 *
 *   - **Defaulting** — the leader repeats their previous turn's action
 *   - **Deferral** — the leader defers to the dominant faction's recommendation
 *   - **Impulsivity** — the leader selects a random action
 *
 * Fatigue accumulates via: `Fatigue += ActionsThisTurn × StressMultiplier`
 * and resets by a fixed amount per turn of relative peace (no active wars,
 * no crisis events).
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 * Random rolls are pre-computed by the caller's seeded RNG and passed in.
 *
 * @see FR-1503
 */

import type { LeaderId, TurnNumber } from '@/data/types';
import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * Configuration shape for the psychology sub-system, derived from
 * `GAME_CONFIG.psychology`. This ensures the engine stays in sync with
 * whatever the central config declares.
 */
export type DecisionFatigueConfig = typeof GAME_CONFIG.psychology;

/**
 * Per-leader fatigue state snapshot.
 *
 * Immutable — every field is `readonly`. A new object is produced whenever
 * the state changes.
 *
 * @see FR-1503
 */
export interface FatigueState {
  /** Unique identifier for the leader this state belongs to. */
  readonly leaderId: LeaderId;
  /** The turn number when this state was captured. */
  readonly turn: TurnNumber;
  /** Current fatigue level, clamped to the range [0, 100]. */
  readonly currentFatigue: number;
  /** Number of discrete actions the leader performed this turn. */
  readonly actionsThisTurn: number;
  /**
   * Stress multiplier applied to fatigue accumulation.
   * Derived from the leader's current stress via `max(1.0, stress / 50)`.
   * Minimum value is always 1.0.
   */
  readonly stressMultiplier: number;
}

/**
 * Discriminated union of fatigue effect types that can fire when a leader
 * exceeds the fatigue threshold.
 *
 * - `'none'`        — No cognitive degradation; leader decides normally.
 * - `'defaulting'`  — Leader repeats their previous turn's action.
 * - `'deferral'`    — Leader defers to the dominant faction's recommendation.
 * - `'impulsivity'` — Leader selects a random action.
 *
 * @see FR-1503
 */
export type FatigueEffectType = 'none' | 'defaulting' | 'deferral' | 'impulsivity';

/**
 * Result of evaluating whether a fatigue-driven cognitive effect fires.
 *
 * @see FR-1503
 */
export interface FatigueEffectResult {
  /** Which fatigue effect (if any) was triggered. */
  readonly effectType: FatigueEffectType;
  /** The leader's fatigue level at the time of evaluation. */
  readonly fatigueLevel: number;
  /** Whether the fatigue level exceeded the activation threshold. */
  readonly thresholdExceeded: boolean;
  /** Human-readable explanation of why this effect was (or was not) chosen. */
  readonly reason: string;
}

/**
 * Result of accumulating fatigue for a single turn.
 *
 * @see FR-1503
 */
export interface FatigueAccumulationResult {
  /** Fatigue level before accumulation. */
  readonly previousFatigue: number;
  /** Raw fatigue gained this turn (before clamping). */
  readonly fatigueGain: number;
  /** Fatigue level after accumulation, clamped to [0, 100]. */
  readonly newFatigue: number;
  /** Number of actions performed this turn. */
  readonly actionsThisTurn: number;
  /** The stress multiplier that was applied. */
  readonly stressMultiplier: number;
}

/**
 * Result of applying the peacetime fatigue reset.
 *
 * @see FR-1503
 */
export interface FatigueResetResult {
  /** Fatigue level before the reset was applied. */
  readonly previousFatigue: number;
  /** The amount of fatigue removed (0 if not at peace). */
  readonly resetAmount: number;
  /** Fatigue level after the reset, clamped to [0, 100]. */
  readonly newFatigue: number;
  /** Whether the nation was considered to be at peace this turn. */
  readonly atPeace: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure engine for the Decision Fatigue sub-system.
 *
 * All public methods are **side-effect-free** — they accept immutable inputs
 * and return new result objects. Random values are pre-rolled by the caller
 * using a seeded RNG, keeping this engine fully deterministic.
 *
 * @see FR-1503
 */
export class DecisionFatigueEngine {
  private readonly config: DecisionFatigueConfig;

  /**
   * Create a new `DecisionFatigueEngine`.
   *
   * @param config - The psychology configuration block from `GAME_CONFIG`.
   */
  constructor(config: DecisionFatigueConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Accumulate decision fatigue for a leader over one turn.
   *
   * The formula is:
   * ```
   * fatigueGain    = actionsThisTurn × stressMultiplier
   * stressMultiplier = max(1.0, stressLevel / 50)
   * newFatigue     = clamp(currentFatigue + fatigueGain, 0, 100)
   * ```
   *
   * At stress levels 0–50 the multiplier is 1.0 (baseline). At stress 100
   * the multiplier reaches 2.0, doubling fatigue accumulation.
   *
   * @param currentFatigue  - The leader's fatigue level before this turn (0–100).
   * @param actionsThisTurn - How many discrete actions the leader performed.
   * @param stressLevel     - The leader's current stress (0–100).
   * @returns A {@link FatigueAccumulationResult} describing the change.
   *
   * @see FR-1503
   */
  accumulateFatigue(
    currentFatigue: number,
    actionsThisTurn: number,
    stressLevel: number,
  ): FatigueAccumulationResult {
    const stressMultiplier = this.computeStressMultiplier(stressLevel);
    const fatigueGain = actionsThisTurn * stressMultiplier;
    const newFatigue = clamp(currentFatigue + fatigueGain, 0, 100);

    return {
      previousFatigue: currentFatigue,
      fatigueGain,
      newFatigue,
      actionsThisTurn,
      stressMultiplier,
    };
  }

  /**
   * Evaluate whether a fatigue-driven cognitive effect fires for a leader.
   *
   * If the leader's fatigue is **at or below** the threshold (default 60),
   * no effect fires and `effectType` is `'none'`.
   *
   * If fatigue **exceeds** the threshold, the pre-rolled random value
   * selects an effect from the following cumulative ranges:
   *
   * | Roll range   | Effect        | Probability |
   * |--------------|---------------|-------------|
   * | [0.0, 0.3)   | `defaulting`  | 30 %        |
   * | [0.3, 0.5)   | `deferral`    | 20 %        |
   * | [0.5, 0.6)   | `impulsivity` | 10 %        |
   * | [0.6, 1.0)   | `none`        | 40 %        |
   *
   * @param currentFatigue - The leader's current fatigue level (0–100).
   * @param roll           - A pre-rolled random value in `[0, 1)` from
   *                         the seeded RNG. The caller is responsible for
   *                         producing this value deterministically.
   * @returns A {@link FatigueEffectResult} describing the outcome.
   *
   * @see FR-1503
   */
  evaluateFatigueEffect(
    currentFatigue: number,
    roll: number,
  ): FatigueEffectResult {
    const { threshold, defaultingChance, deferralChance, impulsivityChance } =
      this.config.decisionFatigue;

    const thresholdExceeded = currentFatigue > threshold;

    if (!thresholdExceeded) {
      return {
        effectType: 'none',
        fatigueLevel: currentFatigue,
        thresholdExceeded: false,
        reason:
          `Fatigue ${currentFatigue} is at or below threshold ${threshold}; ` +
          `no cognitive degradation.`,
      };
    }

    // Cumulative probability bands
    const defaultingCeiling = defaultingChance;
    const deferralCeiling = defaultingCeiling + deferralChance;
    const impulsivityCeiling = deferralCeiling + impulsivityChance;

    if (roll < defaultingCeiling) {
      return {
        effectType: 'defaulting',
        fatigueLevel: currentFatigue,
        thresholdExceeded: true,
        reason:
          `Fatigue ${currentFatigue} exceeds threshold ${threshold}; ` +
          `roll ${roll.toFixed(3)} < ${defaultingCeiling} → defaulting ` +
          `(repeating previous action).`,
      };
    }

    if (roll < deferralCeiling) {
      return {
        effectType: 'deferral',
        fatigueLevel: currentFatigue,
        thresholdExceeded: true,
        reason:
          `Fatigue ${currentFatigue} exceeds threshold ${threshold}; ` +
          `roll ${roll.toFixed(3)} in [${defaultingCeiling}, ${deferralCeiling}) → deferral ` +
          `(deferring to dominant faction).`,
      };
    }

    if (roll < impulsivityCeiling) {
      return {
        effectType: 'impulsivity',
        fatigueLevel: currentFatigue,
        thresholdExceeded: true,
        reason:
          `Fatigue ${currentFatigue} exceeds threshold ${threshold}; ` +
          `roll ${roll.toFixed(3)} in [${deferralCeiling}, ${impulsivityCeiling}) → impulsivity ` +
          `(random action selection).`,
      };
    }

    // Roll fell in the [0.6, 1.0) band — no effect despite high fatigue
    return {
      effectType: 'none',
      fatigueLevel: currentFatigue,
      thresholdExceeded: true,
      reason:
        `Fatigue ${currentFatigue} exceeds threshold ${threshold}; ` +
        `roll ${roll.toFixed(3)} ≥ ${impulsivityCeiling} → no cognitive effect ` +
        `(leader maintained composure).`,
    };
  }

  /**
   * Apply the peacetime fatigue reset for one turn.
   *
   * If the nation is **at peace** (no active wars, no crisis events), the
   * leader's fatigue is reduced by `|peacetimeResetPerTurn|` (default 20).
   * If the nation is **not** at peace, no reset is applied.
   *
   * The resulting fatigue is clamped to [0, 100].
   *
   * @param currentFatigue - The leader's current fatigue level (0–100).
   * @param atPeace        - Whether the nation is considered at peace.
   * @returns A {@link FatigueResetResult} describing the change.
   *
   * @see FR-1503
   */
  applyPeacetimeReset(
    currentFatigue: number,
    atPeace: boolean,
  ): FatigueResetResult {
    const resetAmount = atPeace
      ? Math.abs(this.config.decisionFatigue.peacetimeResetPerTurn)
      : 0;

    const newFatigue = clamp(currentFatigue - resetAmount, 0, 100);

    return {
      previousFatigue: currentFatigue,
      resetAmount,
      newFatigue,
      atPeace,
    };
  }

  /**
   * Compute the stress multiplier used in fatigue accumulation.
   *
   * The formula is `max(1.0, stressLevel / 50)`, which yields:
   *
   * | Stress Level | Multiplier |
   * |--------------|------------|
   * |      0       |    1.0     |
   * |     25       |    1.0     |
   * |     50       |    1.0     |
   * |     75       |    1.5     |
   * |    100       |    2.0     |
   *
   * This ensures that low-to-moderate stress does not amplify fatigue,
   * while high stress can double the rate of accumulation.
   *
   * @param stressLevel - The leader's current stress (0–100).
   * @returns The computed stress multiplier (≥ 1.0).
   *
   * @see FR-1503
   */
  computeStressMultiplier(stressLevel: number): number {
    return Math.max(1.0, stressLevel / 50);
  }

  /**
   * Create a fresh, zero-fatigue state for a leader at a given turn.
   *
   * This is used when a leader first enters the game or when their fatigue
   * state needs to be fully reinitialised (e.g., after a regime change).
   *
   * @param leaderId - The unique identifier of the leader.
   * @param turn     - The current turn number.
   * @returns A {@link FatigueState} with all counters at their initial values.
   *
   * @see FR-1503
   */
  createInitialFatigueState(
    leaderId: LeaderId,
    turn: TurnNumber,
  ): FatigueState {
    return {
      leaderId,
      turn,
      currentFatigue: 0,
      actionsThisTurn: 0,
      stressMultiplier: 1.0,
    };
  }
}
