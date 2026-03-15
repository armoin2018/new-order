/**
 * New Order — Inequality & Media Manipulation Engine
 *
 * Handles three interrelated subsystems:
 *
 * 1. **Inequality dynamics** — inequality rises when GDP growth outpaces
 *    social spending and can be mitigated by allocating treasury to social
 *    programs.
 * 2. **Media manipulation** — the player can spend Diplomatic Influence to
 *    suppress unfavorable headlines.  Success probability scales inversely
 *    with press freedom, and autocracies risk foreign propaganda blowback.
 * 3. **Foreign propaganda** — external actors exploit covert capability to
 *    stoke civil unrest inside a target nation each turn.
 *
 * All methods are **pure** — they accept immutable inputs and return new
 * result objects with no side effects.
 *
 * @see FR-1305 — Foreign Propaganda
 * @see FR-1306 — Inequality Dynamics
 * @see FR-1307 — Media Manipulation
 */

import { GAME_CONFIG } from './config';

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to the closed interval `[min, max]`.
 *
 * @param value - The value to constrain.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ───────────────────────────────────────────────────────────
// Config type
// ───────────────────────────────────────────────────────────

/**
 * Configuration slice consumed by this engine — derived directly from
 * `GAME_CONFIG.stability` so it stays in sync with the central config
 * file without manual duplication.
 *
 * @see NFR-204
 */
export type InequalityMediaConfig = typeof GAME_CONFIG.stability;

// ───────────────────────────────────────────────────────────
// Inequality types
// ───────────────────────────────────────────────────────────

/**
 * Input parameters for the per-turn inequality computation.
 *
 * @see FR-1306
 */
export interface InequalityInput {
  /** Current inequality score (0–100). */
  readonly currentInequality: number;
  /** GDP growth rate this turn (percentage points). */
  readonly gdpGrowthRate: number;
  /** Social spending allocation (treasury units). */
  readonly socialSpending: number;
}

/**
 * Result of the per-turn inequality computation.
 *
 * @see FR-1306
 */
export interface InequalityResult {
  /** Inequality score at the start of the turn. */
  readonly previousInequality: number;
  /** Inequality score after applying the delta (clamped). */
  readonly newInequality: number;
  /** Raw change applied this turn (before clamping). */
  readonly delta: number;
  /** Human-readable explanation of the inequality change. */
  readonly driverDescription: string;
}

// ───────────────────────────────────────────────────────────
// Media manipulation types
// ───────────────────────────────────────────────────────────

/**
 * Input parameters for a media-manipulation attempt.
 *
 * @see FR-1307
 */
export interface MediaManipulationInput {
  /** Player's current Diplomatic Influence pool. */
  readonly currentDiplomaticInfluence: number;
  /** Nation's press-freedom index (0 = total autocracy, 100 = fully free). */
  readonly pressFreedom: number;
  /** Pre-rolled random value in `[0, 1)` from the seeded RNG. */
  readonly roll: number;
}

/**
 * Result of a media-manipulation attempt.
 *
 * @see FR-1307
 */
export interface MediaManipulationResult {
  /** Whether the attempt was made (false if insufficient DI). */
  readonly attempted: boolean;
  /** Whether the manipulation succeeded. */
  readonly success: boolean;
  /** Diplomatic Influence spent (0 when not attempted). */
  readonly diSpent: number;
  /** Increase in foreign-propaganda vulnerability (autocracy blowback). */
  readonly foreignPropagandaRisk: number;
  /** Human-readable explanation of the outcome. */
  readonly reason: string;
}

// ───────────────────────────────────────────────────────────
// Foreign propaganda types
// ───────────────────────────────────────────────────────────

/**
 * Input parameters for the per-turn foreign-propaganda computation.
 *
 * @see FR-1305
 */
export interface ForeignPropagandaInput {
  /** The aggressor's covert-operations capability score. */
  readonly covertCapability: number;
}

/**
 * Result of the per-turn foreign-propaganda computation.
 *
 * @see FR-1305
 */
export interface ForeignPropagandaResult {
  /** Raw civil-unrest increase (not clamped — caller's responsibility). */
  readonly unrestIncrease: number;
}

// ───────────────────────────────────────────────────────────
// Engine
// ───────────────────────────────────────────────────────────

/** Press-freedom threshold below which a nation is considered an autocracy. */
const AUTOCRACY_PRESS_FREEDOM_THRESHOLD = 40;

/**
 * Pure engine for inequality dynamics, media manipulation, and foreign
 * propaganda.  Every public method is side-effect-free and returns a fresh
 * result object.
 *
 * @see FR-1305 — Foreign Propaganda
 * @see FR-1306 — Inequality Dynamics
 * @see FR-1307 — Media Manipulation
 */
export class InequalityMediaEngine {
  /** Configuration snapshot (stability sub-tree). */
  private readonly config: InequalityMediaConfig;

  /**
   * @param config - The `stability` slice of `GAME_CONFIG`.
   */
  constructor(config: InequalityMediaConfig) {
    this.config = config;
  }

  // ─────────────────────────────────────────────────────────
  // 1. Inequality
  // ─────────────────────────────────────────────────────────

  /**
   * Compute the new inequality score for a nation this turn.
   *
   * When GDP growth exceeds the configured threshold **and** social spending
   * is insufficient, inequality rises.  Social spending always exerts a
   * reductive (negative) pressure on inequality.
   *
   * @param input - Current inequality, GDP growth rate, and social spending.
   * @returns A pure result describing the before/after state and explanation.
   *
   * @see FR-1306
   */
  computeInequality(input: InequalityInput): InequalityResult {
    const { currentInequality, gdpGrowthRate, socialSpending } = input;
    const cfg = this.config.inequality;

    // Base delta depends on whether GDP growth exceeds the threshold.
    const growthPressure =
      gdpGrowthRate > cfg.growthThreshold ? cfg.growthRate : 0;

    // Social spending always applies its (negative) effect.
    const spendingRelief = socialSpending * cfg.socialSpendingEffect;

    const rawDelta = growthPressure + spendingRelief;
    const unclamped = currentInequality + rawDelta;
    const newInequality = clamp(unclamped, cfg.min, cfg.max);
    const effectiveDelta = newInequality - currentInequality;

    const description = this.buildInequalityDescription(
      gdpGrowthRate,
      cfg.growthThreshold,
      growthPressure,
      spendingRelief,
      effectiveDelta,
    );

    return {
      previousInequality: currentInequality,
      newInequality,
      delta: effectiveDelta,
      driverDescription: description,
    };
  }

  // ─────────────────────────────────────────────────────────
  // 2. Media Manipulation
  // ─────────────────────────────────────────────────────────

  /**
   * Attempt to suppress unfavorable headlines by spending Diplomatic
   * Influence.  Success probability scales inversely with press freedom.
   * Successful manipulation in autocracies incurs a foreign-propaganda
   * risk penalty.
   *
   * @param input - Current DI, press freedom, and a pre-rolled random value.
   * @returns A pure result describing whether the attempt was made, its
   *          outcome, DI spent, and any blowback.
   *
   * @see FR-1307
   */
  attemptMediaManipulation(
    input: MediaManipulationInput,
  ): MediaManipulationResult {
    const { currentDiplomaticInfluence, pressFreedom, roll } = input;
    const cfg = this.config.mediaManipulation;

    // Gate: insufficient Diplomatic Influence.
    if (currentDiplomaticInfluence < cfg.diCost) {
      return {
        attempted: false,
        success: false,
        diSpent: 0,
        foreignPropagandaRisk: 0,
        reason:
          `Insufficient Diplomatic Influence ` +
          `(have ${currentDiplomaticInfluence}, need ${cfg.diCost}).`,
      };
    }

    const successProbability = this.computeSuccessProbability(pressFreedom);
    const success = roll < successProbability;

    // Autocracies that succeed at manipulation become more vulnerable to
    // foreign propaganda.
    const propagandaRisk =
      success && pressFreedom < AUTOCRACY_PRESS_FREEDOM_THRESHOLD
        ? cfg.foreignPropagandaRisk
        : 0;

    const reason = success
      ? `Media manipulation succeeded ` +
        `(roll ${roll.toFixed(3)} < probability ${successProbability.toFixed(3)}).` +
        (propagandaRisk > 0
          ? ` Autocracy blowback: +${propagandaRisk} foreign propaganda risk.`
          : '')
      : `Media manipulation failed ` +
        `(roll ${roll.toFixed(3)} ≥ probability ${successProbability.toFixed(3)}).`;

    return {
      attempted: true,
      success,
      diSpent: cfg.diCost,
      foreignPropagandaRisk: propagandaRisk,
      reason,
    };
  }

  // ─────────────────────────────────────────────────────────
  // 3. Foreign Propaganda
  // ─────────────────────────────────────────────────────────

  /**
   * Compute the per-turn civil-unrest increase caused by foreign propaganda.
   *
   * The result is **not** clamped — the caller is responsible for applying
   * bounds when integrating the increase into the nation's unrest total.
   *
   * @param input - The aggressor's covert capability score.
   * @returns The raw unrest increase.
   *
   * @see FR-1305
   */
  computeForeignPropaganda(input: ForeignPropagandaInput): ForeignPropagandaResult {
    const cfg = this.config.foreignPropaganda;
    const unrestIncrease = input.covertCapability * cfg.covertMultiplier;

    return { unrestIncrease };
  }

  // ─────────────────────────────────────────────────────────
  // 4. Success Probability Helper
  // ─────────────────────────────────────────────────────────

  /**
   * Compute the success probability for a media-manipulation attempt given
   * a nation's press-freedom index.
   *
   * Formula:
   * ```
   * P = baseSuccessProbability + (100 − pressFreedom) × pressFreedomModifier
   * ```
   *
   * Lower press freedom → higher success probability (easier to suppress
   * media in autocracies).
   *
   * @param pressFreedom - Press-freedom index (0–100).
   * @returns Clamped probability in `[0, 1]`.
   *
   * @see FR-1307
   */
  computeSuccessProbability(pressFreedom: number): number {
    const cfg = this.config.mediaManipulation;
    const raw =
      cfg.baseSuccessProbability +
      (100 - pressFreedom) * cfg.pressFreedomModifier;

    return clamp(raw, 0, 1);
  }

  // ─────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Build a human-readable description of the inequality change for the
   * event log and UI tooltips.
   */
  private buildInequalityDescription(
    gdpGrowthRate: number,
    growthThreshold: number,
    growthPressure: number,
    spendingRelief: number,
    effectiveDelta: number,
  ): string {
    const parts: string[] = [];

    if (growthPressure > 0) {
      parts.push(
        `GDP growth (${gdpGrowthRate.toFixed(4)}%) exceeds threshold ` +
          `(${growthThreshold}%): +${growthPressure} inequality pressure`,
      );
    } else {
      parts.push(
        `GDP growth (${gdpGrowthRate.toFixed(4)}%) within threshold ` +
          `(${growthThreshold}%): no growth-driven inequality`,
      );
    }

    if (spendingRelief < 0) {
      parts.push(
        `Social spending relief: ${spendingRelief.toFixed(1)} inequality`,
      );
    } else if (spendingRelief === 0) {
      parts.push('No social spending allocated.');
    }

    if (effectiveDelta > 0) {
      parts.push(`Net: inequality rose by ${effectiveDelta.toFixed(1)}.`);
    } else if (effectiveDelta < 0) {
      parts.push(`Net: inequality fell by ${Math.abs(effectiveDelta).toFixed(1)}.`);
    } else {
      parts.push('Net: inequality unchanged.');
    }

    return parts.join(' ');
  }
}
