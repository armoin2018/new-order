/**
 * @module StrategicAnalysisEngine
 * @description Post-Game Strategic Analysis engine for New Order.
 *
 * Implements FR-1410: At game end (victory, loss, or turn 60), generate a
 * comprehensive Post-Game Strategic Analysis comprising:
 *
 * (a) Turn-by-turn replay of viability scores for all victory paths with
 *     interactive chart data.
 * (b) Identification of key Inflection Points — turns where a single action
 *     shifted a viability score by ≥ threshold (configurable via
 *     `GAME_CONFIG.postGameAnalysis.inflectionPointThreshold`).
 * (c) "Road Not Taken" analysis — simulated outcomes had the player followed
 *     the advisory panel's top recommendation at each inflection point.
 * (d) Final Strategic Grade (S/A/B/C/D/F) based on decision quality.
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1410
 */

import type { StrategicGrade, FactionId, TurnNumber } from '@/data/types';
import { StrategicGrade as StrategicGradeEnum } from '@/data/types';
import { GAME_CONFIG } from './config';

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
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Config Type
// ---------------------------------------------------------------------------

/**
 * Configuration shape consumed by the {@link StrategicAnalysisEngine},
 * derived from `GAME_CONFIG`. This ensures the engine stays in sync with
 * whatever the central config declares.
 *
 * @see FR-1410
 */
export type StrategicAnalysisConfig = {
  postGameAnalysis: typeof GAME_CONFIG.postGameAnalysis;
  advisory: typeof GAME_CONFIG.advisory;
};

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * A snapshot of viability scores for all victory paths at a single turn.
 *
 * @see FR-1410
 */
export interface TurnViabilitySnapshot {
  /** The turn number this snapshot belongs to. */
  readonly turn: TurnNumber;
  /** Map of victory-condition ID → viability score (0–100). */
  readonly scores: Record<string, number>;
}

/**
 * Structured result of building a viability timeline for a faction.
 * Contains the full turn-by-turn replay data and metadata.
 *
 * @see FR-1410
 */
export interface ViabilityTimelineResult {
  /** The faction whose timeline was built. */
  readonly factionId: FactionId;
  /** Ordered array of per-turn viability snapshots. */
  readonly timeline: TurnViabilitySnapshot[];
  /** Unique set of all victory condition IDs present in the timeline. */
  readonly victoryConditionIds: string[];
  /** Total number of turns in the timeline. */
  readonly totalTurns: number;
  /** Human-readable description of the timeline. */
  readonly reason: string;
}

/**
 * A single inflection point where a viability score shifted by at least
 * the configured threshold between consecutive turns.
 *
 * @see FR-1410
 */
export interface InflectionPoint {
  /** The turn at which the inflection occurred. */
  readonly turn: TurnNumber;
  /** The victory condition affected. */
  readonly victoryConditionId: string;
  /** Viability score on the previous turn. */
  readonly previousScore: number;
  /** Viability score on this turn. */
  readonly newScore: number;
  /** Absolute magnitude of the shift. */
  readonly delta: number;
  /** Whether the shift was positive or negative. */
  readonly direction: 'up' | 'down';
}

/**
 * Result of detecting inflection points across a viability timeline.
 *
 * @see FR-1410
 */
export interface InflectionPointResult {
  /** All detected inflection points, ordered by turn. */
  readonly inflectionPoints: InflectionPoint[];
  /** Total count of inflection points detected. */
  readonly totalDetected: number;
  /** Human-readable summary of inflection-point detection. */
  readonly reason: string;
}

/**
 * A single "Road Not Taken" projection for one inflection point.
 * Shows what scores would have looked like had the player chosen the
 * advisory panel's top alternative at that point.
 *
 * @see FR-1410
 */
export interface RoadNotTakenProjection {
  /** The turn at which the alternative decision would have been taken. */
  readonly inflectionTurn: TurnNumber;
  /** The actual viability scores at that turn. */
  readonly originalScores: Record<string, number>;
  /** Projected scores had the alternative been chosen (clamped 0–100). */
  readonly projectedScores: Record<string, number>;
  /** Victory condition ID with the highest projected score. */
  readonly bestAlternativePath: string;
  /** The highest projected score among all conditions. */
  readonly bestAlternativeScore: number;
}

/**
 * Full result of the "Road Not Taken" analysis across all inflection points.
 *
 * @see FR-1410
 */
export interface RoadNotTakenResult {
  /** Array of projections, one per processed inflection point. */
  readonly projections: RoadNotTakenProjection[];
  /** Human-readable summary of the road-not-taken analysis. */
  readonly reason: string;
}

/**
 * Result of computing the final strategic grade for the game.
 *
 * @see FR-1410
 */
export interface StrategicGradeResult {
  /** The assigned letter grade. */
  readonly grade: StrategicGrade;
  /** Raw average of all composite scores. */
  readonly averageScore: number;
  /** Score after victory/loss adjustment, clamped 0–100. */
  readonly adjustedScore: number;
  /** Human-readable explanation of the grading. */
  readonly reason: string;
}

/**
 * High-level summary of the post-game report for display in the UI.
 *
 * @see FR-1410
 */
export interface ReportSummaryResult {
  /** The faction this report covers. */
  readonly factionId: FactionId;
  /** Total turns played. */
  readonly totalTurns: number;
  /** Number of inflection points identified. */
  readonly totalInflectionPoints: number;
  /** Final strategic grade. */
  readonly grade: StrategicGrade;
  /** The victory condition with the highest final score. */
  readonly topVictoryPath: string;
  /** The final viability score of the top victory path. */
  readonly topFinalScore: number;
  /** Number of "Road Not Taken" alternative projections generated. */
  readonly alternativePathCount: number;
  /** Human-readable narrative summary of the game. */
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure engine that generates post-game strategic analysis reports.
 *
 * At game end (victory, loss, or turn 60) this engine:
 * 1. Builds a turn-by-turn viability timeline ({@link buildViabilityTimeline}).
 * 2. Detects inflection points ({@link detectInflectionPoints}).
 * 3. Computes "Road Not Taken" projections ({@link computeRoadNotTaken}).
 * 4. Assigns a strategic grade ({@link computeStrategicGrade}).
 * 5. Generates a human-readable report summary ({@link generateReportSummary}).
 *
 * Instantiate with the relevant config sections and call each method with
 * the appropriate inputs.
 *
 * @see FR-1410
 */
export class StrategicAnalysisEngine {
  private readonly config: StrategicAnalysisConfig;

  /**
   * Create a new StrategicAnalysisEngine.
   *
   * @param config - Configuration containing `postGameAnalysis` and `advisory`
   *                 blocks from `GAME_CONFIG`.
   */
  constructor(config: StrategicAnalysisConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Build a structured viability timeline from raw turn-score data.
   *
   * Validates and reshapes the input into a {@link ViabilityTimelineResult},
   * extracting the unique set of all victory condition IDs that appear across
   * every turn snapshot.
   *
   * @param params - Object with `factionId` and `turnScores`.
   * @param params.factionId   - The faction whose timeline is being built.
   * @param params.turnScores  - Ordered array of per-turn viability snapshots.
   * @returns A structured {@link ViabilityTimelineResult}.
   *
   * @see FR-1410
   */
  buildViabilityTimeline(params: {
    readonly factionId: FactionId;
    readonly turnScores: TurnViabilitySnapshot[];
  }): ViabilityTimelineResult {
    const { factionId, turnScores } = params;

    const conditionIdSet = new Set<string>();
    for (const snapshot of turnScores) {
      for (const id of Object.keys(snapshot.scores)) {
        conditionIdSet.add(id);
      }
    }

    const victoryConditionIds = Array.from(conditionIdSet).sort();

    return {
      factionId,
      timeline: turnScores,
      victoryConditionIds,
      totalTurns: turnScores.length,
      reason:
        `Built viability timeline for faction ${String(factionId)} spanning ` +
        `${String(turnScores.length)} turns across ` +
        `${String(victoryConditionIds.length)} victory conditions.`,
    };
  }

  /**
   * Detect inflection points in a viability timeline.
   *
   * For each consecutive pair of turns and for each victory condition,
   * computes the delta. If `|delta| >= threshold`, the point is recorded as
   * an inflection point. Direction is `'up'` when delta > 0, `'down'` when
   * delta < 0.
   *
   * @param params - Object with `timeline` and optional `threshold`.
   * @param params.timeline  - Ordered viability snapshots.
   * @param params.threshold - Override for the inflection-point threshold.
   *                           Defaults to `config.postGameAnalysis.inflectionPointThreshold`.
   * @returns An {@link InflectionPointResult} with all detected points.
   *
   * @see FR-1410
   */
  detectInflectionPoints(params: {
    readonly timeline: TurnViabilitySnapshot[];
    readonly threshold?: number;
  }): InflectionPointResult {
    const { timeline } = params;
    const threshold =
      params.threshold ?? this.config.postGameAnalysis.inflectionPointThreshold;

    const inflectionPoints: InflectionPoint[] = [];

    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      if (prev === undefined || curr === undefined) continue;

      const allIds = new Set<string>([
        ...Object.keys(prev.scores),
        ...Object.keys(curr.scores),
      ]);

      for (const conditionId of allIds) {
        const previousScore = prev.scores[conditionId] ?? 0;
        const newScore = curr.scores[conditionId] ?? 0;
        const delta = newScore - previousScore;

        if (Math.abs(delta) >= threshold) {
          inflectionPoints.push({
            turn: curr.turn,
            victoryConditionId: conditionId,
            previousScore,
            newScore,
            delta: Math.abs(delta),
            direction: delta > 0 ? 'up' : 'down',
          });
        }
      }
    }

    return {
      inflectionPoints,
      totalDetected: inflectionPoints.length,
      reason:
        `Detected ${String(inflectionPoints.length)} inflection point(s) ` +
        `using threshold ${String(threshold)}.`,
    };
  }

  /**
   * Compute "Road Not Taken" projections for detected inflection points.
   *
   * For each inflection point (up to `roadNotTakenMaxProjections`), locates
   * the corresponding turn in the baseline timeline, applies the supplied
   * alternative deltas, clamps all results to 0–100, and identifies the
   * best alternative path (highest projected score).
   *
   * If `alternativeDeltas` is shorter than the number of inflection points,
   * remaining inflection points are skipped.
   *
   * @param params - Object with `inflectionPoints`, `baselineTimeline`, and
   *                 `alternativeDeltas`.
   * @param params.inflectionPoints   - The inflection points to project from.
   * @param params.baselineTimeline   - The full viability timeline.
   * @param params.alternativeDeltas  - Array of delta maps, one per inflection
   *                                    point. Keys are victory-condition IDs,
   *                                    values are additive deltas.
   * @returns A {@link RoadNotTakenResult} with all projections.
   *
   * @see FR-1410
   */
  computeRoadNotTaken(params: {
    readonly inflectionPoints: InflectionPoint[];
    readonly baselineTimeline: TurnViabilitySnapshot[];
    readonly alternativeDeltas: Record<string, number>[];
  }): RoadNotTakenResult {
    const { inflectionPoints, baselineTimeline, alternativeDeltas } = params;
    const maxProjections =
      this.config.postGameAnalysis.roadNotTakenMaxProjections;

    const projections: RoadNotTakenProjection[] = [];

    const limit = Math.min(
      inflectionPoints.length,
      alternativeDeltas.length,
      maxProjections,
    );

    for (let i = 0; i < limit; i++) {
      const ip = inflectionPoints[i];
      const deltas = alternativeDeltas[i];
      if (ip === undefined || deltas === undefined) continue;

      const baselineSnapshot = baselineTimeline.find(
        (s) => s.turn === ip.turn,
      );
      if (baselineSnapshot === undefined) continue;

      const originalScores: Record<string, number> = {
        ...baselineSnapshot.scores,
      };
      const projectedScores: Record<string, number> = {};

      let bestPath = '';
      let bestScore = -1;

      for (const conditionId of Object.keys(originalScores)) {
        const base = originalScores[conditionId] ?? 0;
        const delta = deltas[conditionId] ?? 0;
        const projected = clamp(base + delta, 0, 100);
        projectedScores[conditionId] = projected;

        if (projected > bestScore) {
          bestScore = projected;
          bestPath = conditionId;
        }
      }

      projections.push({
        inflectionTurn: ip.turn,
        originalScores,
        projectedScores,
        bestAlternativePath: bestPath,
        bestAlternativeScore: bestScore,
      });
    }

    return {
      projections,
      reason:
        `Computed ${String(projections.length)} "Road Not Taken" ` +
        `projection(s) from ${String(inflectionPoints.length)} inflection ` +
        `point(s) (max ${String(maxProjections)}).`,
    };
  }

  /**
   * Compute the final strategic grade for the completed game.
   *
   * Algorithm:
   * 1. Average all composite scores.
   * 2. Adjust: victory → +10 bonus, loss → −10 penalty, timeout → 0.
   * 3. Clamp to 0–100.
   * 4. Classify via {@link classifyGrade}.
   *
   * @param params - Object with `compositeScores`, `inflectionPointCount`,
   *                 and `finalOutcome`.
   * @param params.compositeScores      - Array of per-turn composite strategy
   *                                      scores (0–100).
   * @param params.inflectionPointCount - Total inflection points detected.
   * @param params.finalOutcome         - How the game ended.
   * @returns A {@link StrategicGradeResult} with grade and reasoning.
   *
   * @see FR-1410
   */
  computeStrategicGrade(params: {
    readonly compositeScores: number[];
    readonly inflectionPointCount: number;
    readonly finalOutcome: 'victory' | 'loss' | 'timeout';
  }): StrategicGradeResult {
    const { compositeScores, inflectionPointCount, finalOutcome } = params;

    const sum = compositeScores.reduce((acc, s) => acc + s, 0);
    const averageScore =
      compositeScores.length > 0 ? sum / compositeScores.length : 0;

    let adjustment = 0;
    if (finalOutcome === 'victory') adjustment = 10;
    else if (finalOutcome === 'loss') adjustment = -10;

    const adjustedScore = clamp(averageScore + adjustment, 0, 100);
    const grade = this.classifyGrade(adjustedScore);

    return {
      grade,
      averageScore,
      adjustedScore,
      reason:
        `Average composite score: ${averageScore.toFixed(1)}. ` +
        `Outcome adjustment (${finalOutcome}): ${adjustment >= 0 ? '+' : ''}${String(adjustment)}. ` +
        `Adjusted score: ${adjustedScore.toFixed(1)} → grade ${grade}. ` +
        `Inflection points: ${String(inflectionPointCount)}.`,
    };
  }

  /**
   * Generate a high-level, human-readable report summary for the post-game
   * analysis screen.
   *
   * Identifies the top victory path (highest score in the last turn of the
   * timeline) and aggregates metadata from all other analysis outputs.
   *
   * @param params - Object with all analysis results.
   * @param params.factionId        - The player's faction.
   * @param params.timeline         - Full viability timeline.
   * @param params.inflectionPoints - Detected inflection points.
   * @param params.grade            - Assigned strategic grade.
   * @param params.roadNotTaken     - "Road Not Taken" projections.
   * @returns A {@link ReportSummaryResult}.
   *
   * @see FR-1410
   */
  generateReportSummary(params: {
    readonly factionId: FactionId;
    readonly timeline: TurnViabilitySnapshot[];
    readonly inflectionPoints: InflectionPoint[];
    readonly grade: StrategicGrade;
    readonly roadNotTaken: RoadNotTakenProjection[];
  }): ReportSummaryResult {
    const { factionId, timeline, inflectionPoints, grade, roadNotTaken } =
      params;

    const totalTurns = timeline.length;
    const lastSnapshot = timeline[timeline.length - 1];

    let topVictoryPath = 'none';
    let topFinalScore = 0;

    if (lastSnapshot !== undefined) {
      for (const [conditionId, score] of Object.entries(lastSnapshot.scores)) {
        if (score > topFinalScore) {
          topFinalScore = score;
          topVictoryPath = conditionId;
        }
      }
    }

    const alternativePathCount = roadNotTaken.length;

    const summary =
      `Faction ${String(factionId)} completed ${String(totalTurns)} turns. ` +
      `Top victory path: "${topVictoryPath}" (final score: ${topFinalScore.toFixed(1)}). ` +
      `${String(inflectionPoints.length)} inflection point(s) detected. ` +
      `${String(alternativePathCount)} alternative path(s) projected. ` +
      `Strategic grade: ${grade}.`;

    return {
      factionId,
      totalTurns,
      totalInflectionPoints: inflectionPoints.length,
      grade,
      topVictoryPath,
      topFinalScore,
      alternativePathCount,
      summary,
    };
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Classify a numeric score into a {@link StrategicGrade} using the
   * `advisory.gradeThresholds` configuration.
   *
   * Thresholds are evaluated from highest to lowest: S → A → B → C → D → F.
   *
   * @param score - The adjusted composite score (0–100).
   * @returns The corresponding {@link StrategicGrade}.
   *
   * @see FR-1410
   */
  private classifyGrade(score: number): StrategicGrade {
    const t = this.config.advisory.gradeThresholds;
    if (score >= t.S) return StrategicGradeEnum.S;
    if (score >= t.A) return StrategicGradeEnum.A;
    if (score >= t.B) return StrategicGradeEnum.B;
    if (score >= t.C) return StrategicGradeEnum.C;
    if (score >= t.D) return StrategicGradeEnum.D;
    return StrategicGradeEnum.F;
  }
}
