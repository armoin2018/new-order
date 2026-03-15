/**
 * Scenario Scoring Engine — FR-3600, CNFL-4400
 *
 * Computes composite scenario-completion scores across seven weighted
 * dimensions (stability, economic, military, diplomatic, technology,
 * market, strategic), assigns letter grades, calculates historical
 * percentiles, and provides AI-faction comparison rankings.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/scenario-scoring-engine
 * @see FR-3600 — Scenario Completion Scoring
 * @see CNFL-4400 — Scenario Scoring System
 */

import type { FactionId } from '@/data/types';
import type {
  ScoringDimension,
  LetterGrade,
  DimensionScore,
  ScenarioScore,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a numeric value to the inclusive range [min, max].
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
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of alliances used for diplomatic score normalisation. */
const MAX_ALLIANCES = 7;

/** Maximum tech-domain level for normalisation. */
const MAX_DOMAIN_LEVEL = 100;

/** Normalisation target for techs researched. */
const TECHS_RESEARCHED_TARGET = 20;

/** Normalisation target for tech modules generated. */
const TECH_MODULES_TARGET = 10;

/** Maximum crash events before the market penalty is fully applied. */
const MAX_CRASH_EVENTS = 5;

/** Normalisation ceiling for GDP growth percentage. */
const GDP_GROWTH_CEILING = 50;

/** Normalisation ceiling for market composite growth. */
const MARKET_COMPOSITE_CEILING = 100;

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

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * Scoring weights for each dimension. Values should sum to 1.0.
 *
 * @see FR-3600
 */
export interface ScoringWeights {
  readonly stability: number;
  readonly economic: number;
  readonly military: number;
  readonly diplomatic: number;
  readonly technology: number;
  readonly market: number;
  readonly strategic: number;
}

/**
 * Raw metrics collected over the game for scoring.
 *
 * @see FR-3600
 */
export interface GameMetrics {
  readonly factionId: FactionId;
  readonly turnsPlayed: number;
  // Stability
  readonly averageStability: number;
  readonly lowestStability: number;
  readonly stabilityTrend: number;
  // Economic
  readonly gdpGrowthPercent: number;
  readonly finalTreasury: number;
  readonly averageInflation: number;
  readonly marketCompositeGrowthPercent: number;
  // Military
  readonly territoryControlPercent: number;
  readonly forcePreservationPercent: number;
  readonly averageReadiness: number;
  // Diplomatic
  readonly allianceCount: number;
  readonly internationalLegitimacy: number;
  readonly diplomaticInfluence: number;
  // Technology
  readonly maxDomainLevel: number;
  readonly techsResearched: number;
  readonly techModulesGenerated: number;
  // Market
  readonly compositeIndexGrowthPercent: number;
  readonly customIndexPerformanceAvg: number;
  readonly marketCrashEvents: number;
  // Strategic
  readonly strategicGrade: number;
  readonly victoryPathAdherence: number;
}

/**
 * Letter grade cutoff thresholds.
 *
 * @see FR-3600
 */
export interface GradeCutoffs {
  readonly S: number;
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
}

/**
 * Stored historical score for percentile computation.
 *
 * @see FR-3600
 */
export interface HistoricalScore {
  readonly scenarioId: string;
  readonly factionId: FactionId;
  readonly totalScore: number;
  readonly turnsPlayed: number;
  readonly date: string;
}

/**
 * AI faction comparison data with ranking.
 *
 * @see FR-3600
 */
export interface AIComparisonResult {
  readonly factionId: FactionId;
  readonly totalScore: number;
  readonly rank: number;
}

/**
 * Per-dimension analysis from a scenario score breakdown.
 *
 * @see FR-3600
 */
export interface ScoreBreakdown {
  readonly dimensions: readonly DimensionScore[];
  readonly strongest: DimensionScore;
  readonly weakest: DimensionScore;
  readonly totalScore: number;
  readonly overallGrade: LetterGrade;
}

// ---------------------------------------------------------------------------
// Default Constants
// ---------------------------------------------------------------------------

/** Default dimension weights summing to 1.0. */
const DEFAULT_WEIGHTS: ScoringWeights = {
  stability: 0.15,
  economic: 0.20,
  military: 0.10,
  diplomatic: 0.15,
  technology: 0.15,
  market: 0.10,
  strategic: 0.15,
};

/** Default letter-grade cutoff thresholds. */
const DEFAULT_CUTOFFS: GradeCutoffs = {
  S: 95,
  A: 80,
  B: 65,
  C: 50,
  D: 35,
};

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Scenario Scoring Engine
 *
 * Evaluates scenario-completion performance across seven weighted
 * dimensions, assigns letter grades, computes historical percentiles,
 * and ranks the player against AI factions.
 *
 * All methods are pure functions that do not mutate input state.
 *
 * @see FR-3600 — Scenario Completion Scoring
 * @see CNFL-4400 — Scenario Scoring System
 */
export class ScenarioScoringEngine {
  // -----------------------------------------------------------------------
  // Method 1 — computeCompositeScore
  // -----------------------------------------------------------------------

  /**
   * Computes the composite scenario score across all seven dimensions.
   *
   * For each dimension a raw score (0-100) is calculated, then multiplied
   * by its weight. Weighted scores are summed and scaled ×10 to produce a
   * total in the range 0-1000. Each dimension also receives a letter grade.
   *
   * @param metrics - Raw game metrics collected over the scenario.
   * @param weights - Optional custom scoring weights (defaults to {@link DEFAULT_WEIGHTS}).
   * @returns A complete {@link ScenarioScore} with per-dimension breakdowns.
   *
   * @see FR-3600
   */
  computeCompositeScore(
    metrics: GameMetrics,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
  ): ScenarioScore {
    const dimensions: DimensionScore[] = ALL_DIMENSIONS.map((dimension) => {
      const rawScore = this.computeDimensionScore(dimension, metrics);
      const weight = weights[dimension];
      const weightedScore = rawScore * weight;
      const letterGrade = this.assignLetterGrade(rawScore);

      return {
        dimension,
        rawScore,
        letterGrade,
        weight,
        weightedScore,
        keyEvents: [] as readonly string[],
      };
    });

    /* Total is the sum of weighted scores × 10, giving a 0-1000 range */
    const totalScore = clamp(
      dimensions.reduce((sum, d) => sum + d.weightedScore, 0) * 10,
      0,
      1000,
    );

    return {
      totalScore,
      dimensions,
    };
  }

  // -----------------------------------------------------------------------
  // Method 2 — computeDimensionScore
  // -----------------------------------------------------------------------

  /**
   * Computes the raw score (0-100) for a single scoring dimension using
   * dimension-specific formulas.
   *
   * **Formulas**:
   * - **stability**: 0.5 × avgStability + 0.3 × (100 − varianceFromTarget) + 0.2 × trendBonus
   * - **economic**: 0.3 × gdpGrowthNorm + 0.2 × treasuryHealth + 0.2 × (100 − inflationPenalty) + 0.3 × marketCompositeGrowth
   * - **military**: 0.4 × territoryControl + 0.3 × forcePreservation + 0.3 × avgReadiness
   * - **diplomatic**: 0.3 × (allianceCount / maxAlliances × 100) + 0.4 × legitimacy + 0.3 × influence
   * - **technology**: 0.4 × (maxDomainLevel / 100 × 100) + 0.3 × (techsResearched / 20 × 100) + 0.3 × (modulesGenerated / 10 × 100)
   * - **market**: 0.4 × compositeGrowthNorm + 0.3 × customIndexPerf + 0.3 × (100 − crashPenalty)
   * - **strategic**: 0.5 × strategicGrade + 0.5 × victoryPathAdherence
   *
   * All results are clamped to [0, 100].
   *
   * @param dimension - The scoring dimension to evaluate.
   * @param metrics   - The raw game metrics.
   * @returns A raw score in the range [0, 100].
   *
   * @see FR-3600
   */
  computeDimensionScore(dimension: ScoringDimension, metrics: GameMetrics): number {
    switch (dimension) {
      case 'stability':
        return this.computeStabilityScore(metrics);
      case 'economic':
        return this.computeEconomicScore(metrics);
      case 'military':
        return this.computeMilitaryScore(metrics);
      case 'diplomatic':
        return this.computeDiplomaticScore(metrics);
      case 'technology':
        return this.computeTechnologyScore(metrics);
      case 'market':
        return this.computeMarketScore(metrics);
      case 'strategic':
        return this.computeStrategicScore(metrics);
      default:
        return 0;
    }
  }

  // -----------------------------------------------------------------------
  // Method 3 — assignLetterGrade
  // -----------------------------------------------------------------------

  /**
   * Assigns a letter grade to a raw score based on cutoff thresholds.
   *
   * | Grade | Minimum Score |
   * |-------|---------------|
   * | S     | ≥ 95          |
   * | A     | ≥ 80          |
   * | B     | ≥ 65          |
   * | C     | ≥ 50          |
   * | D     | ≥ 35          |
   * | F     | < 35          |
   *
   * @param rawScore - The raw score (0-100) to grade.
   * @param cutoffs  - Optional custom cutoff thresholds.
   * @returns The assigned {@link LetterGrade}.
   *
   * @see FR-3600
   */
  assignLetterGrade(
    rawScore: number,
    cutoffs: GradeCutoffs = DEFAULT_CUTOFFS,
  ): LetterGrade {
    if (rawScore >= cutoffs.S) return 'S';
    if (rawScore >= cutoffs.A) return 'A';
    if (rawScore >= cutoffs.B) return 'B';
    if (rawScore >= cutoffs.C) return 'C';
    if (rawScore >= cutoffs.D) return 'D';
    return 'F';
  }

  // -----------------------------------------------------------------------
  // Method 4 — computePercentile
  // -----------------------------------------------------------------------

  /**
   * Computes the percentile ranking of a total score against a
   * historical score distribution.
   *
   * @param totalScore - The total scenario score (0-1000).
   * @param history    - Array of historical scores to compare against.
   * @returns A percentile value in the range [0, 100].
   *
   * @see FR-3600
   */
  computePercentile(
    totalScore: number,
    history: readonly HistoricalScore[],
  ): number {
    if (history.length === 0) {
      return 100;
    }

    const belowCount = history.filter((h) => h.totalScore < totalScore).length;
    const equalCount = history.filter((h) => h.totalScore === totalScore).length;

    /* Percentile = (below + 0.5 × equal) / total × 100 */
    const percentile =
      ((belowCount + 0.5 * equalCount) / history.length) * 100;

    return clamp(Math.round(percentile * 10) / 10, 0, 100);
  }

  // -----------------------------------------------------------------------
  // Method 5 — compareToAI
  // -----------------------------------------------------------------------

  /**
   * Computes scenario scores for all AI factions and the player, then
   * ranks them by total score descending.
   *
   * @param playerMetrics   - The player's raw game metrics.
   * @param aiMetricsArray  - Array of AI faction raw game metrics.
   * @returns Sorted array of {@link AIComparisonResult} entries, highest score first.
   *
   * @see FR-3600
   */
  compareToAI(
    playerMetrics: GameMetrics,
    aiMetricsArray: readonly GameMetrics[],
  ): readonly AIComparisonResult[] {
    const allMetrics = [playerMetrics, ...aiMetricsArray];

    const scored = allMetrics.map((m) => {
      const score = this.computeCompositeScore(m);
      return {
        factionId: m.factionId,
        totalScore: score.totalScore,
      };
    });

    /* Sort descending by totalScore */
    const sorted = [...scored].sort((a, b) => b.totalScore - a.totalScore);

    /* Assign ranks */
    return sorted.map((entry, index) => ({
      factionId: entry.factionId,
      totalScore: entry.totalScore,
      rank: index + 1,
    }));
  }

  // -----------------------------------------------------------------------
  // Method 6 — getScoreBreakdown
  // -----------------------------------------------------------------------

  /**
   * Extracts a per-dimension analysis from a {@link ScenarioScore},
   * identifying the strongest and weakest dimensions.
   *
   * @param score - The complete scenario score to analyse.
   * @returns A {@link ScoreBreakdown} with strongest/weakest dimensions.
   *
   * @see FR-3600
   */
  getScoreBreakdown(score: ScenarioScore): ScoreBreakdown {
    const dims = score.dimensions;

    /* Find strongest and weakest by raw score */
    let strongest = dims[0]!;
    let weakest = dims[0]!;

    for (const dim of dims) {
      if (dim.rawScore > strongest.rawScore) {
        strongest = dim;
      }
      if (dim.rawScore < weakest.rawScore) {
        weakest = dim;
      }
    }

    const overallGrade = this.assignLetterGrade(score.totalScore / 10);

    return {
      dimensions: dims,
      strongest,
      weakest,
      totalScore: score.totalScore,
      overallGrade,
    };
  }

  // -----------------------------------------------------------------------
  // Private Dimension Scoring Methods
  // -----------------------------------------------------------------------

  /**
   * Stability dimension:
   * 0.5 × averageStability + 0.3 × (100 − variance) + 0.2 × trendBonus
   */
  private computeStabilityScore(metrics: GameMetrics): number {
    const avgComponent = metrics.averageStability;

    /* Variance from target (100 = perfect stability) */
    const varianceFromTarget = Math.abs(100 - metrics.averageStability) +
      Math.abs(metrics.averageStability - metrics.lowestStability);
    const varianceComponent = 100 - clamp(varianceFromTarget, 0, 100);

    /* Trend bonus: positive trend adds up to 100, negative penalises */
    const trendBonus = clamp(50 + metrics.stabilityTrend * 5, 0, 100);

    const raw =
      0.5 * avgComponent +
      0.3 * varianceComponent +
      0.2 * trendBonus;

    return clamp(raw, 0, 100);
  }

  /**
   * Economic dimension:
   * 0.3 × gdpGrowthNorm + 0.2 × treasuryHealth + 0.2 × (100 − inflationPenalty)
   * + 0.3 × marketCompositeGrowth
   */
  private computeEconomicScore(metrics: GameMetrics): number {
    /* Normalise GDP growth: 0% = 50, +50% = 100, -50% = 0 */
    const gdpGrowthNorm = clamp(
      50 + (metrics.gdpGrowthPercent / GDP_GROWTH_CEILING) * 50,
      0,
      100,
    );

    /* Treasury health: positive treasury = good, normalise loosely */
    const treasuryHealth = clamp(
      metrics.finalTreasury > 0 ? Math.min(100, 50 + Math.log10(metrics.finalTreasury + 1) * 10) : 20,
      0,
      100,
    );

    /* Inflation penalty: each % above 5% reduces score */
    const inflationPenalty = clamp((Math.max(0, metrics.averageInflation - 5)) * 10, 0, 100);

    /* Market composite growth normalised to 0-100 */
    const marketCompositeGrowth = clamp(
      50 + (metrics.marketCompositeGrowthPercent / MARKET_COMPOSITE_CEILING) * 50,
      0,
      100,
    );

    const raw =
      0.3 * gdpGrowthNorm +
      0.2 * treasuryHealth +
      0.2 * (100 - inflationPenalty) +
      0.3 * marketCompositeGrowth;

    return clamp(raw, 0, 100);
  }

  /**
   * Military dimension:
   * 0.4 × territoryControl + 0.3 × forcePreservation + 0.3 × avgReadiness
   */
  private computeMilitaryScore(metrics: GameMetrics): number {
    const raw =
      0.4 * clamp(metrics.territoryControlPercent, 0, 100) +
      0.3 * clamp(metrics.forcePreservationPercent, 0, 100) +
      0.3 * clamp(metrics.averageReadiness, 0, 100);

    return clamp(raw, 0, 100);
  }

  /**
   * Diplomatic dimension:
   * 0.3 × (allianceCount / max × 100) + 0.4 × legitimacy + 0.3 × influence
   */
  private computeDiplomaticScore(metrics: GameMetrics): number {
    const allianceNorm = clamp(
      (metrics.allianceCount / MAX_ALLIANCES) * 100,
      0,
      100,
    );

    const raw =
      0.3 * allianceNorm +
      0.4 * clamp(metrics.internationalLegitimacy, 0, 100) +
      0.3 * clamp(metrics.diplomaticInfluence, 0, 100);

    return clamp(raw, 0, 100);
  }

  /**
   * Technology dimension:
   * 0.4 × (maxDomainLevel / 100 × 100) + 0.3 × (techs / 20 × 100)
   * + 0.3 × (modules / 10 × 100)
   */
  private computeTechnologyScore(metrics: GameMetrics): number {
    const domainNorm = clamp(
      (metrics.maxDomainLevel / MAX_DOMAIN_LEVEL) * 100,
      0,
      100,
    );
    const techsNorm = clamp(
      (metrics.techsResearched / TECHS_RESEARCHED_TARGET) * 100,
      0,
      100,
    );
    const modulesNorm = clamp(
      (metrics.techModulesGenerated / TECH_MODULES_TARGET) * 100,
      0,
      100,
    );

    const raw =
      0.4 * domainNorm +
      0.3 * techsNorm +
      0.3 * modulesNorm;

    return clamp(raw, 0, 100);
  }

  /**
   * Market dimension:
   * 0.4 × compositeGrowthNorm + 0.3 × customIndexPerf
   * + 0.3 × (100 − crashPenalty)
   */
  private computeMarketScore(metrics: GameMetrics): number {
    const compositeGrowthNorm = clamp(
      50 + (metrics.compositeIndexGrowthPercent / MARKET_COMPOSITE_CEILING) * 50,
      0,
      100,
    );

    const customIndexPerf = clamp(metrics.customIndexPerformanceAvg, 0, 100);

    /* Each crash event penalises by 20 points, up to 100 */
    const crashPenalty = clamp(
      (metrics.marketCrashEvents / MAX_CRASH_EVENTS) * 100,
      0,
      100,
    );

    const raw =
      0.4 * compositeGrowthNorm +
      0.3 * customIndexPerf +
      0.3 * (100 - crashPenalty);

    return clamp(raw, 0, 100);
  }

  /**
   * Strategic dimension:
   * 0.5 × strategicGrade + 0.5 × victoryPathAdherence
   */
  private computeStrategicScore(metrics: GameMetrics): number {
    const raw =
      0.5 * clamp(metrics.strategicGrade, 0, 100) +
      0.5 * clamp(metrics.victoryPathAdherence, 0, 100);

    return clamp(raw, 0, 100);
  }
}
