/**
 * Scenario Comparison Engine — FR-3606, CNFL-4403
 *
 * Provides cross-scenario comparison supporting 2–5 completed scenario
 * archives. Compares composite scores, dimension breakdowns, key metric
 * trajectories, market performance, and identifies divergence points
 * where scenarios took significantly different paths.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/scenario-comparison-engine
 * @see FR-3606  — Scenario Comparison
 * @see CNFL-4403 — Scenario Comparison Engine
 */

import type { FactionId } from '@/data/types';
import type {
  ScoringDimension,
  LetterGrade,
} from '@/data/types/model.types';
import type {
  ScenarioHistoryArchive,
  TurnRecord,
  TurnMetricsSnapshot,
} from './scenario-history-recorder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a numeric value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of scenarios for comparison. */
const MIN_SCENARIOS = 2;

/** Maximum number of scenarios for comparison. */
const MAX_SCENARIOS = 5;

/** Default divergence threshold (20%). */
const DEFAULT_DIVERGENCE_THRESHOLD = 0.2;

/** All seven scoring dimensions in evaluation order. */
const ALL_DIMENSIONS: readonly ScoringDimension[] = [
  'stability',
  'economic',
  'military',
  'diplomatic',
  'technology',
  'market',
  'strategic',
] as const;

/** Nation-level metrics extracted from snapshots. */
const NATION_METRICS: readonly string[] = [
  'stability',
  'gdp',
  'treasury',
  'militaryReadiness',
  'diplomaticInfluence',
  'civilUnrest',
  'techLevel',
] as const;

/** Letter-grade cutoff thresholds used for assigning overall grades. */
const GRADE_CUTOFFS: Record<LetterGrade, number> = {
  S: 95,
  A: 80,
  B: 65,
  C: 50,
  D: 35,
  F: 0,
};

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * Summary data for a single scenario within a comparison set.
 *
 * @see FR-3606
 */
export interface ScenarioSummary {
  readonly scenarioId: string;
  readonly runId: string;
  readonly playerFaction: FactionId;
  readonly turnsPlayed: number;
  readonly totalScore: number;
  readonly overallGrade: LetterGrade;
  readonly victoryCondition: string | undefined;
  readonly dimensionScores: Readonly<Record<ScoringDimension, number>>;
  readonly dimensionGrades: Readonly<Record<ScoringDimension, LetterGrade>>;
}

/**
 * A single trajectory point for a specific metric and scenario.
 *
 * @see FR-3606
 */
export interface TrajectoryPoint {
  readonly turn: number;
  readonly value: number;
}

/**
 * Trajectory overlay for a single metric across multiple scenarios.
 *
 * @see FR-3606
 */
export interface TrajectoryComparison {
  readonly metric: string;
  readonly scenarios: ReadonlyArray<{
    readonly scenarioId: string;
    readonly points: readonly TrajectoryPoint[];
  }>;
}

/**
 * Market performance data for a single scenario.
 *
 * @see FR-3606
 */
export interface ScenarioMarketPerformance {
  readonly scenarioId: string;
  readonly exchangeComposites: Readonly<Record<string, {
    readonly startValue: number;
    readonly endValue: number;
    readonly changePercent: number;
  }>>;
  readonly indexPerformance: Readonly<Record<string, {
    readonly startValue: number;
    readonly endValue: number;
    readonly changePercent: number;
  }>>;
  readonly totalMarketEvents: number;
}

/**
 * Market performance comparison across multiple scenarios.
 *
 * @see FR-3606
 */
export interface MarketComparisonResult {
  readonly scenarios: readonly ScenarioMarketPerformance[];
  readonly bestMarketScenario: string;
  readonly worstMarketScenario: string;
}

/**
 * A divergence point between scenarios at a specific turn.
 *
 * @see FR-3606
 */
export interface ComparisonDivergencePoint {
  readonly turn: number;
  readonly metric: string;
  readonly values: Readonly<Record<string, number>>;
  readonly maxSpreadPercent: number;
  readonly likelyCause: string;
}

/**
 * Pairwise score delta between two scenarios.
 *
 * @see FR-3606
 */
export interface PairwiseDelta {
  readonly scenarioAId: string;
  readonly scenarioBId: string;
  readonly scoreDelta: number;
  readonly strongestDimension: ScoringDimension;
  readonly weakestDimension: ScoringDimension;
}

/**
 * Full cross-scenario comparison report.
 *
 * @see FR-3606
 */
export interface ComparisonReport {
  readonly generatedAt: string;
  readonly scenarioCount: number;
  readonly summaries: readonly ScenarioSummary[];
  readonly rankings: ReadonlyArray<{
    readonly rank: number;
    readonly scenarioId: string;
    readonly totalScore: number;
  }>;
  readonly trajectories: readonly TrajectoryComparison[];
  readonly marketComparison: MarketComparisonResult;
  readonly divergencePoints: readonly ComparisonDivergencePoint[];
  readonly pairwiseDeltas: readonly PairwiseDelta[];
  readonly bestOverall: string;
  readonly worstOverall: string;
}

/**
 * Configuration for the comparison engine.
 *
 * @see FR-3606
 */
export interface ComparisonConfig {
  /** Fractional threshold for divergence detection (default 0.2 = 20%). */
  readonly divergenceThreshold: number;
  /** Metrics to include in trajectory comparisons. */
  readonly metricsToCompare: readonly string[];
}

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ComparisonConfig = {
  divergenceThreshold: DEFAULT_DIVERGENCE_THRESHOLD,
  metricsToCompare: [...NATION_METRICS],
};

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Scenario Comparison Engine
 *
 * Compares 2–5 completed scenario archives, producing ranked summaries,
 * trajectory overlays, market performance comparisons, divergence points,
 * and pairwise score deltas.
 *
 * @see FR-3606  — Scenario Comparison
 * @see CNFL-4403 — Scenario Comparison Engine
 */
export class ScenarioComparisonEngine {
  private readonly config: ComparisonConfig;

  constructor(config?: Partial<ComparisonConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Method 1 — compareScenarios
  // -----------------------------------------------------------------------

  /**
   * Performs a full side-by-side comparison of 2–5 scenario archives.
   * Returns scenario summaries with composite scores and dimension
   * breakdowns, ranked by total score.
   *
   * @param archives - Array of 2–5 completed scenario archives.
   * @returns Array of {@link ScenarioSummary} entries, highest score first.
   * @throws RangeError if fewer than 2 or more than 5 archives provided.
   *
   * @see FR-3606
   */
  compareScenarios(
    archives: readonly ScenarioHistoryArchive[],
  ): readonly ScenarioSummary[] {
    this.validateArchiveCount(archives.length);

    const summaries = archives.map((a) => this.buildSummary(a));

    return [...summaries].sort((a, b) => b.totalScore - a.totalScore);
  }

  // -----------------------------------------------------------------------
  // Method 2 — compareTrajectories
  // -----------------------------------------------------------------------

  /**
   * Overlays key metric trajectories across all provided scenarios.
   * For each metric, produces an array of per-scenario trajectory points
   * aligned by turn number.
   *
   * @param archives - Array of 2–5 scenario archives.
   * @param metrics  - Optional list of metrics to compare (defaults to all nation metrics).
   * @returns Array of {@link TrajectoryComparison} entries, one per metric.
   * @throws RangeError if fewer than 2 or more than 5 archives provided.
   *
   * @see FR-3606
   */
  compareTrajectories(
    archives: readonly ScenarioHistoryArchive[],
    metrics?: readonly string[],
  ): readonly TrajectoryComparison[] {
    this.validateArchiveCount(archives.length);

    const metricsToUse = metrics ?? this.config.metricsToCompare;
    const result: TrajectoryComparison[] = [];

    for (const metric of metricsToUse) {
      const scenarios = archives.map((archive) => ({
        scenarioId: archive.scenarioId,
        points: this.extractMetricTrajectory(archive, metric),
      }));

      result.push({ metric, scenarios });
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Method 3 — findDivergencePoints
  // -----------------------------------------------------------------------

  /**
   * Identifies turns where metrics diverge significantly across scenarios.
   * For each turn and metric, computes the spread across all scenarios;
   * if the maximum spread exceeds the configured threshold, a divergence
   * point is recorded.
   *
   * @param archives  - Array of 2–5 scenario archives.
   * @param threshold - Optional override for divergence threshold.
   * @returns Array of {@link ComparisonDivergencePoint} entries sorted by turn.
   * @throws RangeError if fewer than 2 or more than 5 archives provided.
   *
   * @see FR-3606
   */
  findDivergencePoints(
    archives: readonly ScenarioHistoryArchive[],
    threshold?: number,
  ): readonly ComparisonDivergencePoint[] {
    this.validateArchiveCount(archives.length);

    const effectiveThreshold = threshold ?? this.config.divergenceThreshold;
    const divergences: ComparisonDivergencePoint[] = [];

    // Build turn → record maps for every archive
    const turnMaps = archives.map((a) => {
      const map = new Map<number, TurnRecord>();
      for (const record of a.turnHistory) {
        map.set(record.turn, record);
      }
      return { scenarioId: a.scenarioId, playerFaction: a.playerFaction, map };
    });

    // Collect all turn numbers across all archives
    const allTurns = new Set<number>();
    for (const { map } of turnMaps) {
      for (const turn of map.keys()) {
        allTurns.add(turn);
      }
    }
    const sortedTurns = [...allTurns].sort((a, b) => a - b);

    for (const turn of sortedTurns) {
      for (const metric of this.config.metricsToCompare) {
        const values: Record<string, number> = {};
        const eventCandidates: string[] = [];

        for (const entry of turnMaps) {
          const record = entry.map.get(turn);
          if (!record) continue;

          const snap = record.nationSnapshots.find(
            (s) => s.factionId === entry.playerFaction,
          );
          if (!snap) continue;

          const val = snap[metric as keyof TurnMetricsSnapshot];
          if (typeof val === 'number') {
            values[entry.scenarioId] = val;
          }

          // Gather events for likely-cause identification
          for (const evt of record.events) {
            eventCandidates.push(evt.description);
          }
        }

        const valArray = Object.values(values);
        if (valArray.length < 2) continue;

        const minVal = Math.min(...valArray);
        const maxVal = Math.max(...valArray);
        const baseline = Math.max(Math.abs(maxVal), Math.abs(minVal), 1);
        const spread = (maxVal - minVal) / baseline;

        if (spread > effectiveThreshold) {
          divergences.push({
            turn,
            metric,
            values,
            maxSpreadPercent: clamp(Math.round(spread * 1000) / 10, 0, 1000),
            likelyCause: eventCandidates.length > 0
              ? eventCandidates[0]!
              : 'No specific event identified',
          });
        }
      }
    }

    return divergences.sort((a, b) => a.turn - b.turn);
  }

  // -----------------------------------------------------------------------
  // Method 4 — compareMarketPerformance
  // -----------------------------------------------------------------------

  /**
   * Compares market performance (exchange composites and index values)
   * across all provided scenario archives. Computes start/end values and
   * percentage change for each exchange and index in each scenario.
   *
   * @param archives - Array of 2–5 scenario archives.
   * @returns A {@link MarketComparisonResult} with per-scenario market data.
   * @throws RangeError if fewer than 2 or more than 5 archives provided.
   *
   * @see FR-3606
   */
  compareMarketPerformance(
    archives: readonly ScenarioHistoryArchive[],
  ): MarketComparisonResult {
    this.validateArchiveCount(archives.length);

    const scenarios = archives.map((archive) =>
      this.extractMarketPerformance(archive),
    );

    // Determine best/worst by average index performance
    let bestId = scenarios[0]!.scenarioId;
    let worstId = scenarios[0]!.scenarioId;
    let bestAvg = -Infinity;
    let worstAvg = Infinity;

    for (const sp of scenarios) {
      const indexPerfs = Object.values(sp.indexPerformance);
      const avg = indexPerfs.length > 0
        ? indexPerfs.reduce((sum, p) => sum + p.changePercent, 0) / indexPerfs.length
        : 0;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestId = sp.scenarioId;
      }
      if (avg < worstAvg) {
        worstAvg = avg;
        worstId = sp.scenarioId;
      }
    }

    return {
      scenarios,
      bestMarketScenario: bestId,
      worstMarketScenario: worstId,
    };
  }

  // -----------------------------------------------------------------------
  // Method 5 — generateComparisonReport
  // -----------------------------------------------------------------------

  /**
   * Generates a comprehensive comparison report combining all analysis
   * methods: summaries, rankings, trajectories, market comparison,
   * divergence points, and pairwise deltas.
   *
   * @param archives - Array of 2–5 completed scenario archives.
   * @returns A complete {@link ComparisonReport}.
   * @throws RangeError if fewer than 2 or more than 5 archives provided.
   *
   * @see FR-3606
   */
  generateComparisonReport(
    archives: readonly ScenarioHistoryArchive[],
  ): ComparisonReport {
    this.validateArchiveCount(archives.length);

    const summaries = this.compareScenarios(archives);
    const trajectories = this.compareTrajectories(archives);
    const marketComparison = this.compareMarketPerformance(archives);
    const divergencePoints = this.findDivergencePoints(archives);
    const pairwiseDeltas = this.computePairwiseDeltas(summaries);

    const rankings = summaries.map((s, idx) => ({
      rank: idx + 1,
      scenarioId: s.scenarioId,
      totalScore: s.totalScore,
    }));

    return {
      generatedAt: new Date().toISOString(),
      scenarioCount: archives.length,
      summaries,
      rankings,
      trajectories,
      marketComparison,
      divergencePoints,
      pairwiseDeltas,
      bestOverall: rankings[0]!.scenarioId,
      worstOverall: rankings[rankings.length - 1]!.scenarioId,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Validates that the archive count is within the 2–5 range.
   */
  private validateArchiveCount(count: number): void {
    if (count < MIN_SCENARIOS || count > MAX_SCENARIOS) {
      throw new RangeError(
        `ScenarioComparisonEngine requires ${MIN_SCENARIOS}–${MAX_SCENARIOS} archives, received ${count}.`,
      );
    }
  }

  /**
   * Builds a {@link ScenarioSummary} from a single archive.
   */
  private buildSummary(archive: ScenarioHistoryArchive): ScenarioSummary {
    const dimScores: Record<string, number> = {};
    const dimGrades: Record<string, LetterGrade> = {};

    if (archive.finalScores) {
      for (const dim of archive.finalScores.dimensions) {
        dimScores[dim.dimension] = dim.rawScore;
        dimGrades[dim.dimension] = dim.letterGrade;
      }
    }

    // Fill missing dimensions with zeros
    for (const dim of ALL_DIMENSIONS) {
      if (dimScores[dim] === undefined) {
        dimScores[dim] = 0;
        dimGrades[dim] = 'F';
      }
    }

    const totalScore = archive.finalScores?.totalScore ?? 0;

    return {
      scenarioId: archive.scenarioId,
      runId: archive.runId,
      playerFaction: archive.playerFaction,
      turnsPlayed: archive.turnsPlayed,
      totalScore,
      overallGrade: this.assignGrade(totalScore / 10),
      victoryCondition: archive.victoryCondition,
      dimensionScores: dimScores as Readonly<Record<ScoringDimension, number>>,
      dimensionGrades: dimGrades as Readonly<Record<ScoringDimension, LetterGrade>>,
    };
  }

  /**
   * Assigns a letter grade to a raw score (0-100).
   */
  private assignGrade(rawScore: number): LetterGrade {
    if (rawScore >= GRADE_CUTOFFS.S) return 'S';
    if (rawScore >= GRADE_CUTOFFS.A) return 'A';
    if (rawScore >= GRADE_CUTOFFS.B) return 'B';
    if (rawScore >= GRADE_CUTOFFS.C) return 'C';
    if (rawScore >= GRADE_CUTOFFS.D) return 'D';
    return 'F';
  }

  /**
   * Extracts a single metric's trajectory from an archive.
   */
  private extractMetricTrajectory(
    archive: ScenarioHistoryArchive,
    metric: string,
  ): readonly TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];

    for (const record of archive.turnHistory) {
      const snap = record.nationSnapshots.find(
        (s) => s.factionId === archive.playerFaction,
      );
      if (!snap) continue;

      const val = snap[metric as keyof TurnMetricsSnapshot];
      if (typeof val === 'number') {
        points.push({ turn: record.turn, value: val });
      }
    }

    return points;
  }

  /**
   * Extracts market performance data from a single archive.
   */
  private extractMarketPerformance(
    archive: ScenarioHistoryArchive,
  ): ScenarioMarketPerformance {
    const turns = archive.turnHistory;

    const exchangeComposites: Record<string, {
      startValue: number;
      endValue: number;
      changePercent: number;
    }> = {};

    const indexPerformance: Record<string, {
      startValue: number;
      endValue: number;
      changePercent: number;
    }> = {};

    let totalMarketEvents = 0;

    if (turns.length > 0) {
      const first = turns[0]!;
      const last = turns[turns.length - 1]!;

      // Exchange composites
      for (const [exchangeId, startVal] of Object.entries(
        first.marketData.exchangeComposites,
      )) {
        const endVal = last.marketData.exchangeComposites[exchangeId] ?? startVal;
        const changePercent = startVal !== 0
          ? ((endVal - startVal) / Math.abs(startVal)) * 100
          : 0;
        exchangeComposites[exchangeId] = {
          startValue: startVal,
          endValue: endVal,
          changePercent: Math.round(changePercent * 10) / 10,
        };
      }

      // Index values
      for (const [indexId, startVal] of Object.entries(
        first.marketData.indexValues,
      )) {
        const endVal = last.marketData.indexValues[indexId] ?? startVal;
        const changePercent = startVal !== 0
          ? ((endVal - startVal) / Math.abs(startVal)) * 100
          : 0;
        indexPerformance[indexId] = {
          startValue: startVal,
          endValue: endVal,
          changePercent: Math.round(changePercent * 10) / 10,
        };
      }

      // Count market events
      for (const record of turns) {
        totalMarketEvents += record.marketData.marketEvents.length;
      }
    }

    return {
      scenarioId: archive.scenarioId,
      exchangeComposites,
      indexPerformance,
      totalMarketEvents,
    };
  }

  /**
   * Computes pairwise score deltas between all scenario pairs.
   */
  private computePairwiseDeltas(
    summaries: readonly ScenarioSummary[],
  ): readonly PairwiseDelta[] {
    const deltas: PairwiseDelta[] = [];

    for (let i = 0; i < summaries.length; i++) {
      for (let j = i + 1; j < summaries.length; j++) {
        const a = summaries[i]!;
        const b = summaries[j]!;

        // Compute per-dimension deltas to find strongest/weakest
        let strongestDim: ScoringDimension = ALL_DIMENSIONS[0]!;
        let weakestDim: ScoringDimension = ALL_DIMENSIONS[0]!;
        let maxDelta = -Infinity;
        let minDelta = Infinity;

        for (const dim of ALL_DIMENSIONS) {
          const delta = (a.dimensionScores[dim] ?? 0) - (b.dimensionScores[dim] ?? 0);
          if (delta > maxDelta) {
            maxDelta = delta;
            strongestDim = dim;
          }
          if (delta < minDelta) {
            minDelta = delta;
            weakestDim = dim;
          }
        }

        deltas.push({
          scenarioAId: a.scenarioId,
          scenarioBId: b.scenarioId,
          scoreDelta: Math.round((a.totalScore - b.totalScore) * 10) / 10,
          strongestDimension: strongestDim,
          weakestDimension: weakestDim,
        });
      }
    }

    return deltas;
  }
}
