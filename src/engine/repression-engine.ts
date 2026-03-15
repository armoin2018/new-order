/**
 * Repression Engine — New Order
 *
 * Models state repression mechanics: police deployment, backlash feedback
 * loops ("the Dictator's Trap"), martial law consequences, and coup risk
 * assessment. All methods are pure functions that return new objects;
 * no side effects.
 *
 * @see FR-1304 — Repression backlash feedback loop
 * @see FR-1308 — Martial law & regime change triggers
 * @see FR-1311 — Coup attempt probability formula
 */

import type { PowerBase } from '@/data/types';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────
// Exported type aliases & interfaces
// ─────────────────────────────────────────────────────────

/**
 * Configuration shape for stability & repression parameters.
 * Derived from the runtime `GAME_CONFIG.stability` object via `as const`
 * type derivation.
 *
 * @see FR-1304
 * @see FR-1308
 */
export type RepressionConfig = typeof GAME_CONFIG.stability;

/**
 * A player-initiated repression action against civil unrest.
 *
 * @see FR-1304
 */
export interface RepressionAction {
  /** The category of repressive measure being enacted. */
  readonly type: 'police' | 'curfew' | 'martialLaw' | 'militaryCrackdown';
}

/**
 * The immediate result of applying a repression action such as police
 * deployment. Contains both delta values and the resulting clamped totals.
 *
 * @see FR-1304
 */
export interface RepressionResult {
  /** Change in civil unrest (negative = reduction). */
  readonly unrestDelta: number;
  /** Change in repression backlash (positive = increase). */
  readonly backlashDelta: number;
  /** New civil unrest value after clamping to [0, 100]. */
  readonly newUnrest: number;
  /** New backlash value after clamping to [0, 100]. */
  readonly newBacklash: number;
}

/**
 * Feedback loop assessment for repression backlash.
 * When backlash exceeds the threshold, it feeds back into unrest —
 * the "Dictator's Trap": repression begets more unrest.
 *
 * @see FR-1304
 */
export interface BacklashFeedback {
  /** Current backlash level. */
  readonly backlash: number;
  /** Whether the backlash-to-unrest feedback loop is active. */
  readonly feedbackActive: boolean;
  /** Additional unrest contributed by excess backlash. */
  readonly unrestContribution: number;
}

/**
 * Result of declaring martial law. Contains the immediate unrest
 * reduction and the ongoing per-turn costs that persist while
 * martial law remains in effect.
 *
 * @see FR-1308
 * @see FR-1309
 */
export interface MartialLawResult {
  /** New civil unrest value after the immediate reduction, clamped [0, 100]. */
  readonly newUnrest: number;
  /** Per-turn popularity decay while martial law is active. */
  readonly popularityDecayPerTurn: number;
  /** Per-turn economic growth penalty while martial law is active. */
  readonly economicGrowthReduction: number;
  /** Tension increase applied to all factions upon declaration. */
  readonly tensionIncreaseAllFactions: number;
  /** Whether low military loyalty has triggered coup risk. */
  readonly coupRiskTriggered: boolean;
}

/**
 * Assessment of coup probability based on the leader's power base
 * and popular support. Coup is only *possible* when both military
 * and security services loyalty fall below their respective thresholds.
 *
 * @see FR-1311
 */
export interface CoupRiskAssessment {
  /** Whether the preconditions for a coup are met. */
  readonly coupPossible: boolean;
  /** Computed coup probability, clamped [0, 100]. Zero if not possible. */
  readonly coupProbability: number;
  /** Human-readable explanation of the assessment. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Pure-function engine for computing repression outcomes, backlash
 * feedback, martial law effects, and coup risk assessments.
 *
 * All public methods are side-effect-free and return new result objects.
 * The engine is parameterised by {@link RepressionConfig} to allow
 * scenario-specific tuning without code changes.
 *
 * @see FR-1304 — Repression backlash feedback loop
 * @see FR-1308 — Martial law & regime change triggers
 * @see FR-1311 — Coup attempt probability formula
 */
export class RepressionEngine {
  /** Stability configuration governing all thresholds and weights. */
  private readonly config: RepressionConfig;

  /**
   * Create a new RepressionEngine with the given stability configuration.
   *
   * @param config - The stability subsection of the game configuration.
   */
  constructor(config: RepressionConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // 1. Police Deployment
  // ───────────────────────────────────────────────────────

  /**
   * Apply a police deployment action to suppress civil unrest.
   *
   * Police deployment immediately reduces civil unrest but increases
   * repression backlash. Both values are clamped to [0, 100].
   *
   * @param currentUnrest   - Current civil unrest level (0–100).
   * @param currentBacklash - Current repression backlash level (0–100).
   * @returns A {@link RepressionResult} with deltas and new clamped values.
   *
   * @see FR-1304 — Police deployment reduces unrest but adds backlash
   */
  applyPoliceDeployment(
    currentUnrest: number,
    currentBacklash: number,
  ): RepressionResult {
    const { unrestReduction, backlashIncrease } = this.config.policeDeployment;

    const unrestDelta = unrestReduction;
    const backlashDelta = backlashIncrease;

    const newUnrest = clamp(currentUnrest + unrestDelta, 0, 100);
    const newBacklash = clamp(currentBacklash + backlashDelta, 0, 100);

    return {
      unrestDelta,
      backlashDelta,
      newUnrest,
      newBacklash,
    };
  }

  // ───────────────────────────────────────────────────────
  // 2. Backlash Feedback Loop
  // ───────────────────────────────────────────────────────

  /**
   * Compute the backlash-to-unrest feedback contribution.
   *
   * When repression backlash exceeds the configured threshold,
   * the excess feeds back into civil unrest at a rate of 0.5 per
   * point above the threshold — modelling the "Dictator's Trap"
   * where heavy-handed repression inflames the population.
   *
   * @param currentBacklash - Current repression backlash level (0–100).
   * @returns A {@link BacklashFeedback} describing whether the loop is
   *          active and its unrest contribution.
   *
   * @see FR-1304 — Backlash feedback: unrest += (backlash − threshold) × 0.5
   */
  computeBacklashFeedback(currentBacklash: number): BacklashFeedback {
    const threshold = this.config.repressionBacklashThreshold;

    if (currentBacklash > threshold) {
      const excess = currentBacklash - threshold;
      const unrestContribution = excess * 0.5;

      return {
        backlash: currentBacklash,
        feedbackActive: true,
        unrestContribution,
      };
    }

    return {
      backlash: currentBacklash,
      feedbackActive: false,
      unrestContribution: 0,
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. Martial Law
  // ───────────────────────────────────────────────────────

  /**
   * Declare martial law and compute its immediate and ongoing effects.
   *
   * Martial law provides a large immediate reduction in civil unrest
   * but carries severe ongoing costs: popularity decay each turn,
   * economic growth reduction, tension increases for all factions,
   * and a coup risk trigger when military loyalty is below threshold.
   *
   * @param currentUnrest   - Current civil unrest level (0–100).
   * @param militaryLoyalty - Military loyalty from the leader's power base (0–100).
   * @returns A {@link MartialLawResult} with new unrest and ongoing effects.
   *
   * @see FR-1308 — Martial law immediate effects and ongoing penalties
   * @see FR-1309 — Martial law detailed costs
   */
  applyMartialLaw(
    currentUnrest: number,
    militaryLoyalty: number,
  ): MartialLawResult {
    const ml = this.config.martialLaw;

    const newUnrest = clamp(currentUnrest + ml.unrestReduction, 0, 100);
    const coupRiskTriggered = militaryLoyalty < ml.coupRiskMilitaryThreshold;

    return {
      newUnrest,
      popularityDecayPerTurn: ml.popularityDecayPerTurn,
      economicGrowthReduction: ml.economicGrowthReduction,
      tensionIncreaseAllFactions: ml.tensionIncreaseAllFactions,
      coupRiskTriggered,
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. Coup Risk Assessment
  // ───────────────────────────────────────────────────────

  /**
   * Assess the probability of a coup attempt based on the leader's
   * domestic power base and popular approval.
   *
   * A coup is only *possible* when both `powerBase.military` and
   * `powerBase.securityServices` fall below their configured thresholds.
   * When possible, the probability is computed as:
   *
   * ```
   * CoupChance = (100 − military) × militaryWeight
   *            + (100 − securityServices) × securityServicesWeight
   *            − popularity × popularityWeight
   * ```
   *
   * The result is clamped to [0, 100].
   *
   * @param powerBase  - The leader's domestic power base loyalty scores.
   * @param popularity - The leader's current popular approval (0–100).
   * @returns A {@link CoupRiskAssessment} with probability and explanation.
   *
   * @see FR-1311 — Coup attempt probability formula
   */
  assessCoupRisk(
    powerBase: PowerBase,
    popularity: number,
  ): CoupRiskAssessment {
    const ca = this.config.coupAttempt;

    const militaryBelowThreshold = powerBase.military < ca.militaryThreshold;
    const securityBelowThreshold =
      powerBase.securityServices < ca.securityServicesThreshold;

    if (!militaryBelowThreshold && !securityBelowThreshold) {
      return {
        coupPossible: false,
        coupProbability: 0,
        reason:
          `Coup not possible: military loyalty (${powerBase.military}) ≥ ` +
          `threshold (${ca.militaryThreshold}) and security services ` +
          `(${powerBase.securityServices}) ≥ threshold ` +
          `(${ca.securityServicesThreshold}).`,
      };
    }

    if (!militaryBelowThreshold) {
      return {
        coupPossible: false,
        coupProbability: 0,
        reason:
          `Coup not possible: military loyalty (${powerBase.military}) ≥ ` +
          `threshold (${ca.militaryThreshold}). Security services alone ` +
          `cannot execute a coup.`,
      };
    }

    if (!securityBelowThreshold) {
      return {
        coupPossible: false,
        coupProbability: 0,
        reason:
          `Coup not possible: security services loyalty ` +
          `(${powerBase.securityServices}) ≥ threshold ` +
          `(${ca.securityServicesThreshold}). Military alone cannot ` +
          `execute a coup without security services complicity.`,
      };
    }

    // Both military and security services are below threshold — coup possible
    const rawProbability =
      (100 - powerBase.military) * ca.militaryWeight +
      (100 - powerBase.securityServices) * ca.securityServicesWeight -
      popularity * ca.popularityWeight;

    const coupProbability = clamp(rawProbability, 0, 100);

    return {
      coupPossible: true,
      coupProbability,
      reason:
        `Coup possible: military (${powerBase.military}) < ` +
        `${ca.militaryThreshold} and security services ` +
        `(${powerBase.securityServices}) < ${ca.securityServicesThreshold}. ` +
        `Computed probability: ${coupProbability.toFixed(4)}%.`,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. Backlash Decay
  // ───────────────────────────────────────────────────────

  /**
   * Apply natural per-turn backlash decay.
   *
   * When no repressive actions are taken during a turn, backlash
   * naturally decays towards zero. The default decay rate is 2 points
   * per turn but can be overridden by the caller.
   *
   * @param currentBacklash - Current repression backlash level (0–100).
   * @param decayRate       - Points of backlash to remove per turn
   *                          (positive number; defaults to 2).
   * @returns New backlash value, clamped to [0, 100].
   *
   * @see FR-1304 — Natural backlash decay when repression ceases
   */
  applyRepressionDecay(currentBacklash: number, decayRate: number): number {
    return clamp(currentBacklash - decayRate, 0, 100);
  }
}
