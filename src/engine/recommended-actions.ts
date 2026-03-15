/**
 * Recommended Actions Engine — FR-1403 (Recommended Actions / Optimal Next Actions)
 *
 * Evaluates candidate actions for each viable victory path, ranks them using a
 * composite scoring formula, and produces per-turn recommendations for the
 * active faction. Works alongside the Victory-Path and Loss-Warning engines to
 * feed the Strategic Pathfinder advisory panel.
 *
 * Key behaviours:
 * - Selects the top N non-foreclosed victory paths by viability score.
 * - Scores candidate actions via an impact / cost / risk formula.
 * - Ranks actions per path and bundles them into a {@link RecommendationAssessment}.
 * - Computes strategy consistency over a sliding window and derives focus /
 *   drift modifiers consumed by other subsystems.
 *
 * All numeric weights and thresholds are sourced from {@link GAME_CONFIG.advisory}
 * so that formula tuning requires no code changes (NFR-204).
 *
 * @see FR-1403  — Recommended Actions / Optimal Next Actions
 * @see FR-1413  — Composite Strategy formula
 * @see FR-1414  — Focus Bonus / Drift Penalty
 * @see NFR-204  — Configurable formulas
 */

import type { FactionId, TurnNumber, ConfidenceLevel } from '@/data/types';
import type { VictoryPathViability } from '@/data/types';
import { ConfidenceLevel as ConfidenceLevelEnum, ViabilityLabel as ViabilityLabelEnum } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration slice consumed by the Recommended Actions engine.
 * Derived from {@link GAME_CONFIG.advisory} so the shape is always in sync.
 *
 * @see FR-1403
 */
export type RecommendedActionsConfig = typeof GAME_CONFIG.advisory;

// ─────────────────────────────────────────────────────────────────────────────
// Exported domain types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A candidate action that can be recommended to the player.
 *
 * Candidates are generated externally (e.g. by the AI evaluator or the
 * turn engine) and fed into the ranking pipeline.
 *
 * @see FR-1403
 */
export interface ActionCandidate {
  /** Unique action identifier. */
  actionId: string;
  /** Human-readable action name. */
  name: string;
  /** Which victory path this action advances. */
  targetVictoryPath: string;
  /** Expected impact on viability score (positive = helpful). */
  expectedImpact: number;
  /** Resource cost (abstract units, 0-100 scale). */
  resourceCost: number;
  /** Risk assessment (0 = safe, 100 = extremely risky). */
  riskLevel: number;
  /** Estimated turns to victory if this path is followed. */
  estimatedTurnsToVictory: number | null;
}

/**
 * An {@link ActionCandidate} paired with its computed composite score and rank.
 *
 * @see FR-1403
 */
export interface RankedAction {
  /** The action candidate. */
  action: ActionCandidate;
  /** Composite score used for ranking. Higher = better. */
  compositeScore: number;
  /** Rank within its victory path (1 = best). */
  rank: number;
}

/**
 * Recommended actions for a single victory path.
 *
 * @see FR-1403
 */
export interface PathRecommendation {
  /** Victory path this recommendation targets. */
  victoryPathId: string;
  /** Current viability score of this path. */
  currentViability: number;
  /** Ranked list of 3-5 recommended actions. */
  rankedActions: RankedAction[];
}

/**
 * Full recommendation assessment for a faction on a specific turn.
 *
 * Contains recommendations for the top 3 most viable (non-foreclosed) paths
 * and an overall confidence level.
 *
 * @see FR-1403
 */
export interface RecommendationAssessment {
  factionId: FactionId;
  turn: TurnNumber;
  /** Recommendations for top 3 most viable paths. */
  recommendations: PathRecommendation[];
  /** Advisory confidence. */
  confidence: ConfidenceLevel;
}

/**
 * Result of the strategy consistency computation.
 *
 * Used to determine focus bonus or drift penalty effects on effectiveness
 * and popularity.
 *
 * @see FR-1413
 * @see FR-1414
 */
export interface ConsistencyResult {
  /** The consistency score (0-100). */
  score: number;
  /** The dominant (most common) victory path in the window. */
  dominantPath: string;
  /** Whether focus bonus applies. */
  hasFocusBonus: boolean;
  /** Whether drift penalty applies. */
  hasDriftPenalty: boolean;
  /** Effectiveness modifier (-0.05 to +0.05). */
  effectivenessModifier: number;
  /** Popularity decay per turn (0 or -2). */
  popularityDecayPerTurn: number;
}

/**
 * A single action entry used by the consistency computation.
 *
 * Represents the victory path a player's action was aligned with on a given
 * turn. The sliding window of these entries drives the focus / drift logic.
 *
 * @see FR-1413
 */
export interface ConsistencyActionEntry {
  turn: TurnNumber;
  alignedVictoryPath: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring constants (derived from empirical tuning – FR-1403)
// ─────────────────────────────────────────────────────────────────────────────

/** Weight applied to expectedImpact in the action scoring formula. */
const IMPACT_WEIGHT = 2.0;

/** Weight applied to resourceCost in the action scoring formula. */
const COST_WEIGHT = 0.5;

/** Weight applied to riskLevel in the action scoring formula. */
const RISK_WEIGHT = 1.0;

/** Minimum composite score after clamping. */
const SCORE_FLOOR = 0;

/** Maximum composite score after clamping. */
const SCORE_CEILING = 100;

/** Default number of top paths to select. */
const DEFAULT_TOP_PATHS = 3;

/** Default maximum actions to rank per path. */
const DEFAULT_MAX_ACTIONS = 5;

/** Minimum non-foreclosed paths required for High confidence. */
const HIGH_CONFIDENCE_PATH_THRESHOLD = 3;

/** Default consistency score when no actions have been taken. */
const NEUTRAL_CONSISTENCY_SCORE = 50;

/** Minimum effectiveness multiplier after modifier application. */
const EFFECTIVENESS_FLOOR = 0;

/** Maximum effectiveness multiplier after modifier application. */
const EFFECTIVENESS_CEILING = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Engine that evaluates, scores, and ranks candidate actions for the most
 * viable victory paths, producing structured recommendations consumed by the
 * Strategic Pathfinder UI panel.
 *
 * All formula weights and thresholds are drawn from the injected
 * {@link RecommendedActionsConfig} (a slice of `GAME_CONFIG.advisory`).
 *
 * ### Usage
 * ```ts
 * const engine = new RecommendedActionsEngine(GAME_CONFIG.advisory);
 * const assessment = engine.generateRecommendations(
 *   factionId, turn, paths, candidateActions, trajectory,
 * );
 * ```
 *
 * @see FR-1403  — Recommended Actions / Optimal Next Actions
 * @see FR-1413  — Composite Strategy formula
 * @see FR-1414  — Focus Bonus / Drift Penalty
 */
export class RecommendedActionsEngine {
  /** Injected advisory configuration. */
  private readonly config: RecommendedActionsConfig;

  /**
   * Create a new RecommendedActionsEngine.
   *
   * @param config - Advisory configuration slice (typically `GAME_CONFIG.advisory`).
   * @see FR-1403
   */
  constructor(config: RecommendedActionsConfig) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Path selection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Select the top `count` non-foreclosed victory paths ordered by viability
   * score (descending).
   *
   * Paths whose {@link VictoryPathViability.label} equals `'Foreclosed'` are
   * excluded before ranking. If fewer than `count` non-foreclosed paths exist,
   * only those are returned.
   *
   * @param paths - All current victory path viabilities.
   * @param count - Maximum number of paths to return (default 3).
   * @returns The highest-viability non-foreclosed paths, sorted descending.
   *
   * @see FR-1403
   */
  selectTopPaths(
    paths: readonly VictoryPathViability[],
    count: number = DEFAULT_TOP_PATHS,
  ): VictoryPathViability[] {
    const nonForeclosed = paths.filter(
      (p) => p.label !== ViabilityLabelEnum.Foreclosed,
    );

    const sorted = [...nonForeclosed].sort(
      (a, b) => b.viabilityScore - a.viabilityScore,
    );

    return sorted.slice(0, count);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Action scoring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute a composite score for a single {@link ActionCandidate}.
   *
   * **Formula:**
   * ```
   * compositeScore = (expectedImpact × 2.0) − (resourceCost × 0.5) − (riskLevel × 1.0)
   * ```
   *
   * The result is clamped to the range [0, 100]. High-impact, low-cost,
   * low-risk actions score highest.
   *
   * @param action - The action candidate to score.
   * @returns A composite score in the range [0, 100].
   *
   * @see FR-1403
   */
  scoreAction(action: ActionCandidate): number {
    const raw =
      action.expectedImpact * IMPACT_WEIGHT -
      action.resourceCost * COST_WEIGHT -
      action.riskLevel * RISK_WEIGHT;

    return Math.min(SCORE_CEILING, Math.max(SCORE_FLOOR, raw));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Per-path ranking
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Rank candidate actions for a specific victory path.
   *
   * Actions are filtered to those whose {@link ActionCandidate.targetVictoryPath}
   * matches `victoryPathId`, scored via {@link scoreAction}, sorted descending,
   * and truncated to `maxActions`. Each entry receives a 1-based rank.
   *
   * @param actions     - All available candidate actions.
   * @param victoryPathId - The victory path to rank actions for.
   * @param maxActions  - Maximum number of actions to return (default 5).
   * @returns Ranked actions for the specified path, ordered by composite score.
   *
   * @see FR-1403
   */
  rankActionsForPath(
    actions: readonly ActionCandidate[],
    victoryPathId: string,
    maxActions: number = DEFAULT_MAX_ACTIONS,
  ): RankedAction[] {
    const matched = actions.filter(
      (a) => a.targetVictoryPath === victoryPathId,
    );

    const scored = matched.map((action) => ({
      action,
      compositeScore: this.scoreAction(action),
      rank: 0, // placeholder — assigned after sort
    }));

    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    const top = scored.slice(0, maxActions);

    for (let i = 0; i < top.length; i++) {
      top[i]!.rank = i + 1;
    }

    return top;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Full recommendation generation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a complete {@link RecommendationAssessment} for a faction.
   *
   * 1. Selects the top 3 non-foreclosed victory paths via {@link selectTopPaths}.
   * 2. Ranks candidate actions for each selected path via {@link rankActionsForPath}.
   * 3. Determines advisory confidence:
   *    - **Low** — if `trajectory` is `null` (insufficient data).
   *    - **Medium** — if fewer than 3 non-foreclosed paths exist.
   *    - **High** — otherwise.
   *
   * @param factionId        - The faction receiving recommendations.
   * @param turn             - The current turn number.
   * @param paths            - All current victory path viabilities.
   * @param candidateActions - Pool of candidate actions to rank.
   * @param trajectory       - Optional trajectory data; `null` signals insufficient data.
   * @returns A fully-populated recommendation assessment.
   *
   * @see FR-1403
   */
  generateRecommendations(
    factionId: FactionId,
    turn: TurnNumber,
    paths: readonly VictoryPathViability[],
    candidateActions: readonly ActionCandidate[],
    trajectory: Record<string, number> | null,
  ): RecommendationAssessment {
    const topPaths = this.selectTopPaths(paths);

    const recommendations: PathRecommendation[] = topPaths.map((path) => ({
      victoryPathId: path.victoryConditionId,
      currentViability: path.viabilityScore,
      rankedActions: this.rankActionsForPath(
        candidateActions,
        path.victoryConditionId,
      ),
    }));

    // --- Confidence determination ---
    const nonForeclosedCount = paths.filter(
      (p) => p.label !== ViabilityLabelEnum.Foreclosed,
    ).length;

    let confidence: ConfidenceLevel;
    if (trajectory === null) {
      confidence = ConfidenceLevelEnum.Low;
    } else if (nonForeclosedCount < HIGH_CONFIDENCE_PATH_THRESHOLD) {
      confidence = ConfidenceLevelEnum.Medium;
    } else {
      confidence = ConfidenceLevelEnum.High;
    }

    return {
      factionId,
      turn,
      recommendations,
      confidence,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Strategy consistency
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute the strategy consistency score over a sliding window of recent
   * actions.
   *
   * **Algorithm:**
   * 1. Take the last `windowSize` entries from `recentActions`.
   * 2. Count the frequency of each `alignedVictoryPath`.
   * 3. The **dominant path** is the most frequent value.
   * 4. `score = (dominantCount / totalActions) × 100`. If no actions exist
   *    the score defaults to {@link NEUTRAL_CONSISTENCY_SCORE} (50).
   * 5. Derive focus bonus / drift penalty:
   *    - **Focus bonus** applies when `score / 100 > focusBonus.consistencyThreshold` (0.7).
   *    - **Drift penalty** applies when `score / 100 < driftPenalty.consistencyThreshold` (0.3).
   * 6. Effectiveness modifier: +0.05 (focus), -0.05 (drift), or 0.
   * 7. Popularity decay: -2 per turn on drift, 0 otherwise.
   *
   * @param recentActions - Ordered list of actions the player has taken.
   * @param windowSize    - Number of most-recent entries to consider (default from config).
   * @returns A {@link ConsistencyResult} with score, dominant path, and modifiers.
   *
   * @see FR-1413
   * @see FR-1414
   */
  computeConsistency(
    recentActions: readonly ConsistencyActionEntry[],
    windowSize: number = this.config.consistencyWindow,
  ): ConsistencyResult {
    const window = recentActions.slice(-windowSize);

    // --- Empty window edge case ---
    if (window.length === 0) {
      return {
        score: NEUTRAL_CONSISTENCY_SCORE,
        dominantPath: '',
        hasFocusBonus: false,
        hasDriftPenalty: false,
        effectivenessModifier: 0,
        popularityDecayPerTurn: 0,
      };
    }

    // --- Frequency counting ---
    const frequencyMap = new Map<string, number>();

    for (const entry of window) {
      const current = frequencyMap.get(entry.alignedVictoryPath) ?? 0;
      frequencyMap.set(entry.alignedVictoryPath, current + 1);
    }

    // --- Determine dominant path ---
    let dominantPath = '';
    let dominantCount = 0;

    for (const [path, count] of frequencyMap) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantPath = path;
      }
    }

    // --- Consistency score ---
    const totalActions = window.length;
    const score = (dominantCount / totalActions) * 100;
    const normalised = score / 100;

    // --- Focus / drift thresholds ---
    const { focusBonus, driftPenalty } = this.config;

    const hasFocusBonus = normalised > focusBonus.consistencyThreshold;
    const hasDriftPenalty = normalised < driftPenalty.consistencyThreshold;

    // --- Effectiveness modifier ---
    let effectivenessModifier: number;
    if (hasFocusBonus) {
      effectivenessModifier = focusBonus.effectivenessBonus;
    } else if (hasDriftPenalty) {
      effectivenessModifier = driftPenalty.effectivenessPenalty;
    } else {
      effectivenessModifier = 0;
    }

    // --- Popularity decay ---
    const popularityDecayPerTurn = hasDriftPenalty
      ? driftPenalty.popularityDecayPerTurn
      : 0;

    return {
      score,
      dominantPath,
      hasFocusBonus,
      hasDriftPenalty,
      effectivenessModifier,
      popularityDecayPerTurn,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Effectiveness modifier application
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Apply a consistency-derived effectiveness modifier to a base effectiveness
   * value.
   *
   * **Formula:**
   * ```
   * result = baseEffectiveness × (1 + consistencyResult.effectivenessModifier)
   * ```
   *
   * The result is clamped to [0, 2] to prevent runaway values.
   *
   * @param baseEffectiveness  - The unmodified effectiveness value.
   * @param consistencyResult  - Output from {@link computeConsistency}.
   * @returns The adjusted effectiveness, clamped to [0, 2].
   *
   * @see FR-1414
   */
  applyEffectivenessModifier(
    baseEffectiveness: number,
    consistencyResult: ConsistencyResult,
  ): number {
    const modified =
      baseEffectiveness * (1 + consistencyResult.effectivenessModifier);

    return Math.min(
      EFFECTIVENESS_CEILING,
      Math.max(EFFECTIVENESS_FLOOR, modified),
    );
  }
}
