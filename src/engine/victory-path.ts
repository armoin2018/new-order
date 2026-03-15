/**
 * Victory Path Viability Scoring Engine
 *
 * Implements FR-1401 — Victory Path Viability Scoring for the New Order
 * strategic advisory system. Evaluates each victory condition's achievability,
 * classifies viability into qualitative labels, tracks trends across turns,
 * estimates turns to victory, and computes composite strategy scores.
 *
 * All public methods are **pure functions** — no side effects, no mutation of
 * external state. The engine is parameterised by the advisory section of
 * {@link GAME_CONFIG}, making every threshold and weight data-driven per
 * NFR-204.
 *
 * @see FR-1401  Victory Path Viability Scoring
 * @see FR-1413  Composite Strategy Score
 * @see DR-114   Victory Path Viability data requirement
 * @see NFR-204  All formulas configurable via constants
 *
 * @module engine/victory-path
 */

import type {
  FactionId,
  TurnNumber,
  VictoryPathViability,
  TurnViabilityAssessment,
} from '@/data/types';

import type { ViabilityLabel, TrendDirection, ConfidenceLevel } from '@/data/types';

import {
  ViabilityLabel as ViabilityLabelEnum,
  TrendDirection as TrendDirectionEnum,
  ConfidenceLevel as ConfidenceLevelEnum,
} from '@/data/types';

import { GAME_CONFIG } from '@/engine/config';

// ═══════════════════════════════════════════════════════════════════════════
// Exported Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Advisory configuration slice — derived from {@link GAME_CONFIG.advisory}.
 *
 * Includes viability label thresholds, composite strategy weights,
 * projection horizons, and consistency tuning parameters.
 *
 * @see FR-1401
 */
export type AdvisoryConfig = typeof GAME_CONFIG.advisory;

/**
 * Bag of named numeric metrics representing a nation's current state.
 *
 * Keys are metric identifiers (e.g. `"gdp"`, `"militaryReadiness"`),
 * values are the current numeric reading for that metric.
 */
export type NationMetrics = Record<string, number>;

/**
 * Target thresholds that must be met (or exceeded) for a victory condition.
 *
 * Keys mirror the metric identifiers in {@link NationMetrics}; values are
 * the required minimum to satisfy that component of the victory condition.
 */
export type VictoryRequirements = Record<string, number>;

/**
 * Lightweight input descriptor for a single victory condition.
 *
 * Pairs a stable identifier with the set of metric requirements that
 * define what "winning" via this path looks like.
 */
export interface VictoryConditionInput {
  /** Stable victory-condition identifier (e.g. `"economic_dominance"`). */
  id: string;
  /** Metric requirements for this victory condition. */
  requirements: VictoryRequirements;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Standard game length in turns.
 * Sourced from {@link GAME_CONFIG.meta.MAX_TURNS}.
 */
const MAX_TURNS = GAME_CONFIG.meta.MAX_TURNS;

/**
 * Trend delta thresholds.
 *
 * A score delta of ±10 or more triggers a strong trend (Up / Down);
 * ±3 triggers a moderate trend (UpRight / DownRight); anything in
 * between is classified as Steady.
 *
 * @see FR-1401
 */
const TREND_STRONG_THRESHOLD = 10;
const TREND_MODERATE_THRESHOLD = 3;

/**
 * Turns-remaining threshold below which confidence is promoted to High.
 *
 * Near the end of the game, projections are inherently more accurate
 * because fewer turns of uncertainty remain.
 *
 * @see FR-1401
 */
const HIGH_CONFIDENCE_TURNS_THRESHOLD = 6;

/**
 * Number of turns used as the denominator for the turns-bonus factor.
 *
 * A full 12 turns remaining yields a bonus multiplier of 1.0; fewer
 * turns scale linearly down.
 *
 * @see FR-1401
 */
const TURNS_BONUS_FULL = 12;

/**
 * Fallback multiplier when zero turns remain.
 *
 * Rather than awarding zero credit, half credit is given to recognise
 * that the faction may still hold partial progress.
 *
 * @see FR-1401
 */
const TURNS_BONUS_ZERO_FALLBACK = 0.5;

// ═══════════════════════════════════════════════════════════════════════════
// Utility Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clamp a numeric value to a closed interval.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Round a number to one decimal place.
 *
 * @param value - The number to round.
 * @returns The rounded value.
 */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

// ═══════════════════════════════════════════════════════════════════════════
// VictoryPathEngine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Victory Path Viability Scoring Engine.
 *
 * Evaluates every victory condition available to a faction, producing a
 * {@link TurnViabilityAssessment} per turn. The assessment includes a
 * quantitative score (0–100), qualitative label, directional trend,
 * estimated turns to victory, and a confidence level.
 *
 * The engine is stateless — all prior-turn information must be supplied
 * explicitly as method parameters, keeping the engine deterministic and
 * trivially testable.
 *
 * @see FR-1401  Victory Path Viability Scoring
 * @see FR-1413  Composite Strategy Score
 * @see DR-114   Data requirement: VictoryPathViability / TurnViabilityAssessment
 *
 * @example
 * ```typescript
 * const engine = new VictoryPathEngine(GAME_CONFIG.advisory);
 * const score  = engine.computeViabilityScore(metrics, reqs, turnsLeft);
 * const label  = engine.classifyViability(score);
 * ```
 */
export class VictoryPathEngine {
  /** Cached reference to the advisory configuration. */
  private readonly cfg: AdvisoryConfig;

  /**
   * Create a new VictoryPathEngine.
   *
   * @param config - The advisory section of {@link GAME_CONFIG}.
   *                 Contains viability thresholds, composite weights, etc.
   *
   * @see FR-1401
   */
  constructor(config: AdvisoryConfig) {
    this.cfg = config;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. computeViabilityScore
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute a 0–100 viability score for a single victory condition.
   *
   * **Algorithm:**
   * 1. For each metric in `requirements`, compute the fulfilment ratio:
   *    `clamp(currentValue / targetValue, 0, 1)`.
   * 2. Average all fulfilment ratios.
   * 3. Multiply by a **turns bonus** factor that scales linearly with
   *    remaining turns (capped at 1.0 for ≥ 12 turns).
   * 4. Scale to 0–100 and round.
   *
   * If `turnsRemaining` is 0 the bonus drops to 0.5 (half credit) rather
   * than zeroing out entirely — recognising that partial progress still
   * has value.
   *
   * @param currentMetrics  - Current nation metric values.
   * @param requirements    - Victory condition metric targets.
   * @param turnsRemaining  - Turns left in the game (≥ 0).
   * @returns A viability score in the range [0, 100].
   *
   * @see FR-1401
   */
  computeViabilityScore(
    currentMetrics: NationMetrics,
    requirements: VictoryRequirements,
    turnsRemaining: number,
  ): number {
    const reqKeys = Object.keys(requirements);

    // Edge case: no requirements means trivially fulfilled.
    if (reqKeys.length === 0) {
      return 100;
    }

    // Accumulate fulfilment ratios.
    let totalFulfilment = 0;

    for (const key of reqKeys) {
      const target = requirements[key]!;
      const current = currentMetrics[key] ?? 0;

      // Guard against division by zero — if the target is 0 the metric
      // is trivially satisfied.
      const ratio = target === 0 ? 1 : clamp(current / target, 0, 1);
      totalFulfilment += ratio;
    }

    const avgFulfilment = totalFulfilment / reqKeys.length;

    // Turns bonus: linear ramp from 0→1 over TURNS_BONUS_FULL turns,
    // capped at 1.0.  Zero turns → fallback of 0.5.
    const turnsBonus =
      turnsRemaining > 0
        ? Math.min(1.0, turnsRemaining / TURNS_BONUS_FULL)
        : TURNS_BONUS_ZERO_FALLBACK;

    const rawScore = Math.round(avgFulfilment * 100 * turnsBonus);

    return clamp(rawScore, 0, 100);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. classifyViability
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Classify a numeric viability score into a qualitative
   * {@link ViabilityLabel}.
   *
   * Thresholds are sourced from the advisory configuration so that label
   * boundaries can be tuned without code changes (NFR-204).
   *
   * | Score Range | Label       |
   * |-------------|-------------|
   * | 0 – 9       | Foreclosed  |
   * | 10 – 30     | Difficult   |
   * | 31 – 60     | Viable      |
   * | 61 – 80     | Favorable   |
   * | 81 – 100    | Imminent    |
   *
   * @param score - A viability score (0–100).
   * @returns The corresponding {@link ViabilityLabel}.
   *
   * @see FR-1401
   */
  classifyViability(score: number): ViabilityLabel {
    const thresholds = this.cfg.viabilityLabels;

    if (score <= thresholds.foreclosedMax) {
      return ViabilityLabelEnum.Foreclosed;
    }
    if (score <= thresholds.difficultMax) {
      return ViabilityLabelEnum.Difficult;
    }
    if (score <= thresholds.viableMax) {
      return ViabilityLabelEnum.Viable;
    }
    if (score <= thresholds.favorableMax) {
      return ViabilityLabelEnum.Favorable;
    }
    return ViabilityLabelEnum.Imminent;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. computeTrend
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the directional trend between the current and previous
   * viability scores.
   *
   * | Delta            | Trend       |
   * |------------------|-------------|
   * | ≥ +10            | RisingFast  |
   * | +3 to +9         | Rising      |
   * | −2 to +2         | Stable      |
   * | −9 to −3         | Falling     |
   * | ≤ −10            | FallingFast |
   *
   * If there is no previous score (first turn), the trend defaults to
   * {@link TrendDirection.Stable}.
   *
   * @param currentScore  - This turn's viability score.
   * @param previousScore - Last turn's viability score, or `null` on T1.
   * @returns A {@link TrendDirection} value.
   *
   * @see FR-1401
   */
  computeTrend(
    currentScore: number,
    previousScore: number | null,
  ): TrendDirection {
    if (previousScore === null) {
      return TrendDirectionEnum.Stable;
    }

    const delta = currentScore - previousScore;

    if (delta >= TREND_STRONG_THRESHOLD) {
      return TrendDirectionEnum.RisingFast;
    }
    if (delta >= TREND_MODERATE_THRESHOLD) {
      return TrendDirectionEnum.Rising;
    }
    if (delta <= -TREND_STRONG_THRESHOLD) {
      return TrendDirectionEnum.FallingFast;
    }
    if (delta <= -TREND_MODERATE_THRESHOLD) {
      return TrendDirectionEnum.Falling;
    }

    return TrendDirectionEnum.Stable;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. estimateTurnsToVictory
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Estimate the number of turns required to satisfy all metrics of a
   * victory condition, given a per-turn trajectory.
   *
   * **Algorithm:**
   * - For each metric, compute the remaining gap (`target − current`,
   *   floored at 0).
   * - If the gap is positive and the trajectory for that metric is
   *   positive, estimate turns = `⌈gap / trajectory⌉`.
   * - If the gap is positive but trajectory is zero or negative, the
   *   condition cannot be reached → return `null`.
   * - If *no* trajectory data is available at all (`trajectory` is
   *   `null`), return `null`.
   * - If all gaps are already zero (condition met), return `0`.
   * - Otherwise return the maximum of all individual turn estimates.
   *
   * @param currentMetrics - Current nation metric values.
   * @param requirements   - Victory condition metric targets.
   * @param trajectory     - Per-turn metric deltas (progress rate), or
   *                         `null` if trajectory data is unavailable.
   * @returns Estimated turns to victory, or `null` if unreachable.
   *
   * @see FR-1401
   */
  estimateTurnsToVictory(
    currentMetrics: NationMetrics,
    requirements: VictoryRequirements,
    trajectory: NationMetrics | null,
  ): number | null {
    // No trajectory data → cannot estimate.
    if (trajectory === null) {
      return null;
    }

    const reqKeys = Object.keys(requirements);

    // Edge case: no requirements → already won.
    if (reqKeys.length === 0) {
      return 0;
    }

    let maxTurns = 0;

    for (const key of reqKeys) {
      const target = requirements[key]!;
      const current = currentMetrics[key] ?? 0;
      const gap = Math.max(0, target - current);

      if (gap === 0) {
        // This metric is already satisfied.
        continue;
      }

      const rate = trajectory[key] ?? 0;

      if (rate <= 0) {
        // No positive progress toward this metric — unreachable.
        return null;
      }

      const turnsNeeded = Math.ceil(gap / rate);
      maxTurns = Math.max(maxTurns, turnsNeeded);
    }

    return maxTurns;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. assessVictoryPaths
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Produce a complete {@link TurnViabilityAssessment} for a faction on a
   * given turn.
   *
   * Iterates every supplied victory condition, computing the viability
   * score, label, trend, estimated turns to victory, and confidence
   * level. The result is a snapshot suitable for persisting in the
   * advisory data store ({@link DR-114}).
   *
   * **Confidence heuristics:**
   * - If no trajectory data is available → {@link ConfidenceLevel.Low}.
   * - If fewer than {@link HIGH_CONFIDENCE_TURNS_THRESHOLD} turns remain
   *   → {@link ConfidenceLevel.High} (near-end accuracy).
   * - Otherwise → {@link ConfidenceLevel.Medium}.
   *
   * @param factionId          - The faction being assessed.
   * @param turn               - Current turn number.
   * @param victoryConditions  - All victory conditions to evaluate.
   * @param currentMetrics     - Current nation metric values.
   * @param previousAssessment - The assessment from the prior turn, or
   *                             `null` on the first turn. Used for trend
   *                             computation.
   * @param trajectory         - Per-turn metric deltas, or `null`.
   * @returns A complete {@link TurnViabilityAssessment}.
   *
   * @see FR-1401
   * @see DR-114
   */
  assessVictoryPaths(
    factionId: FactionId,
    turn: TurnNumber,
    victoryConditions: readonly VictoryConditionInput[],
    currentMetrics: NationMetrics,
    previousAssessment: TurnViabilityAssessment | null,
    trajectory: NationMetrics | null,
  ): TurnViabilityAssessment {
    const turnsRemaining = MAX_TURNS - (turn as number);

    // Determine confidence level based on data availability and game phase.
    let confidence: ConfidenceLevel;
    if (trajectory === null) {
      confidence = ConfidenceLevelEnum.Low;
    } else if (turnsRemaining < HIGH_CONFIDENCE_TURNS_THRESHOLD) {
      confidence = ConfidenceLevelEnum.High;
    } else {
      confidence = ConfidenceLevelEnum.Medium;
    }

    // Build a lookup map from the previous assessment for trend computation.
    const previousScoreMap = new Map<string, number>();
    if (previousAssessment !== null) {
      for (const path of previousAssessment.paths) {
        previousScoreMap.set(path.victoryConditionId, path.viabilityScore);
      }
    }

    // Evaluate each victory condition.
    const paths: VictoryPathViability[] = victoryConditions.map((vc) => {
      const score = this.computeViabilityScore(
        currentMetrics,
        vc.requirements,
        turnsRemaining,
      );

      const label = this.classifyViability(score);

      const previousScore = previousScoreMap.get(vc.id) ?? null;
      const trend = this.computeTrend(score, previousScore);

      const turnsToVictoryEstimate = this.estimateTurnsToVictory(
        currentMetrics,
        vc.requirements,
        trajectory,
      );

      return {
        victoryConditionId: vc.id,
        viabilityScore: score,
        label,
        trend,
        turnsToVictoryEstimate,
        confidence,
      };
    });

    return {
      turn,
      factionId,
      paths,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. computeCompositeStrategyScore
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the composite strategy score from three orthogonal inputs.
   *
   * **Formula (FR-1413):**
   * ```
   * composite = topViability × W_top
   *           + consistency  × W_con
   *           + lossMargin   × W_loss
   * ```
   *
   * Weights are sourced from
   * {@link GAME_CONFIG.advisory.compositeStrategy}.  The result is
   * clamped to [0, 100] and rounded to one decimal place.
   *
   * @param topViability - Highest viability score across all victory
   *                       paths (0–100).
   * @param consistency  - Strategic consistency percentage (0–100).
   * @param lossMargin   - Distance from the nearest loss condition
   *                       (0–100).
   * @returns Composite strategy score, rounded to one decimal place.
   *
   * @see FR-1413
   */
  computeCompositeStrategyScore(
    topViability: number,
    consistency: number,
    lossMargin: number,
  ): number {
    const weights = this.cfg.compositeStrategy;

    const raw =
      topViability * weights.topViabilityWeight +
      consistency * weights.consistencyWeight +
      lossMargin * weights.lossMarginWeight;

    return roundToOneDecimal(clamp(raw, 0, 100));
  }
}
