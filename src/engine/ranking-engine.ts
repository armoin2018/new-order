/**
 * Dynamic Rankings & Composite Scoring Engine
 *
 * Pure-function module that computes composite nation scores across 7
 * configurable dimensions, assigns ranks, detects trends, and generates
 * ranking alerts.
 *
 * All functions are **pure** — no side effects, no mutation of inputs.
 *
 * @module ranking-engine
 * @see FR-4701 — Composite score computation
 * @see FR-4702 — Configurable dimension weights
 * @see FR-4703 — Trend detection
 * @see FR-4704 — Ranking alerts
 * @see FR-4705 — Leaderboard & analytics
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber, NationState } from '@/data/types';
import type {
  RankingScoringDimension,
  RankingDimensionScore,
  RankTrend,
  CompositeNationScore,
  RankingAlert,
  RankingState,
} from '@/data/types/ranking.types';

// ---------------------------------------------------------------------------
// Config shorthand
// ---------------------------------------------------------------------------

const cfg = GAME_CONFIG.ranking;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** All 7 ranking dimensions in canonical order. */
const ALL_DIMENSIONS: readonly RankingScoringDimension[] = [
  'stability',
  'economicHealth',
  'militaryPower',
  'diplomaticInfluence',
  'technologyLevel',
  'marketPerformance',
  'educationDemographics',
] as const;

// ---------------------------------------------------------------------------
// initializeRankingState
// ---------------------------------------------------------------------------

/**
 * Create an initial {@link RankingState} with optional custom weights.
 *
 * @param nationIds — Faction IDs to track rankings for.
 * @param weights   — Optional partial weight overrides; unset dimensions
 *                    fall back to {@link cfg.defaultWeights}.
 * @returns A fresh ranking state with empty history and no alerts.
 * @see FR-4702
 */
export function initializeRankingState(
  nationIds: FactionId[],
  weights?: Partial<Record<RankingScoringDimension, number>>,
): RankingState {
  const mergedWeights: Record<RankingScoringDimension, number> = {
    ...cfg.defaultWeights,
    ...weights,
  };

  const currentScores = {} as Record<FactionId, CompositeNationScore>;
  const history = {} as Record<FactionId, CompositeNationScore[]>;

  for (const id of nationIds) {
    history[id] = [];
  }

  return {
    currentScores,
    history,
    alerts: [],
    weights: mergedWeights,
  };
}

// ---------------------------------------------------------------------------
// Dimension extraction
// ---------------------------------------------------------------------------

/**
 * Map a {@link NationState} to raw 0-100 values for each ranking dimension.
 *
 * - stability        → NationState.stability
 * - economicHealth   → derived from gdp, treasury, inflation
 * - militaryPower    → NationState.militaryReadiness
 * - diplomaticInfluence → NationState.diplomaticInfluence
 * - technologyLevel  → NationState.techLevel
 * - marketPerformance → derived from inflation, stability, techLevel
 * - educationDemographics → derived from popularity + stability
 *
 * @see FR-4701
 */
function extractDimensionRaw(
  ns: NationState,
): Record<RankingScoringDimension, number> {
  // economicHealth: average of three normalised components
  const inflationComponent = clamp(100 - ns.inflation, 0, 100);
  const gdpComponent = clamp(ns.gdp / 100, 0, 100);
  const treasuryComponent = clamp(Math.max(ns.treasury, 0) / 50, 0, 100);
  const economicHealth = (inflationComponent + gdpComponent + treasuryComponent) / 3;

  // marketPerformance: composite of low-inflation, stability, tech
  const marketPerformance = clamp(
    inflationComponent * 0.5 + ns.stability * 0.3 + ns.techLevel * 0.2,
    0,
    100,
  );

  // educationDemographics: average of popularity and stability
  const educationDemographics = clamp(
    (ns.popularity + ns.stability) / 2,
    0,
    100,
  );

  return {
    stability: clamp(ns.stability, 0, 100),
    economicHealth: clamp(economicHealth, 0, 100),
    militaryPower: clamp(ns.militaryReadiness, 0, 100),
    diplomaticInfluence: clamp(ns.diplomaticInfluence, 0, 100),
    technologyLevel: clamp(ns.techLevel, 0, 100),
    marketPerformance,
    educationDemographics,
  };
}

// ---------------------------------------------------------------------------
// computeNationScore
// ---------------------------------------------------------------------------

/**
 * Compute the composite score for a single nation on a given turn.
 *
 * Each dimension raw value (0-100) is multiplied by its weight, then the
 * weighted sum is scaled to the configured score range (default 0-1000).
 *
 * @see FR-4701
 * @see FR-4702
 */
export function computeNationScore(
  nationState: NationState,
  weights: Record<RankingScoringDimension, number>,
  turn: TurnNumber,
): CompositeNationScore {
  const rawValues = extractDimensionRaw(nationState);
  const { min, max } = cfg.scoreRange;
  const scale = (max - min) / 100; // 10 when range is 0-1000

  const dimensionScores = {} as Record<RankingScoringDimension, RankingDimensionScore>;
  let weightedSum = 0;

  for (const dim of ALL_DIMENSIONS) {
    const raw = rawValues[dim];
    const w = weights[dim];
    const ws = raw * w;
    weightedSum += ws;
    dimensionScores[dim] = { rawValue: raw, weight: w, weightedScore: ws };
  }

  const compositeScore = clamp(
    Math.round(weightedSum * scale * 100) / 100,
    min,
    max,
  );

  return {
    nationCode: nationState.factionId,
    turn,
    compositeScore,
    dimensionScores,
    rank: 0, // filled in by computeAllRankings
    previousRank: 0,
    trend: 'stable' as RankTrend,
    gapToLeader: 0,
  };
}

// ---------------------------------------------------------------------------
// computeTrend
// ---------------------------------------------------------------------------

/**
 * Determine the rank trend from the most recent entries in history.
 *
 * Uses a sliding window (default 3 turns) comparing the average rank
 * over the window to the current rank. A decrease in rank number = improvement.
 *
 * @see FR-4703
 */
export function computeTrend(
  history: CompositeNationScore[],
  window: number,
): RankTrend {
  if (history.length < 2) return 'stable';

  const recent = history.slice(-window);
  const avgRank =
    recent.reduce((sum, s) => sum + s.rank, 0) / recent.length;
  const currentRank = recent[recent.length - 1].rank;

  // Negative delta = rank number decreased = moving up the leaderboard
  const delta = avgRank - currentRank;

  const t = cfg.trendThresholds;
  if (delta >= t.up) return 'up';
  if (delta >= t.slightlyUp) return 'slightly_up';
  if (delta <= t.down) return 'down';
  if (delta <= t.slightlyDown) return 'slightly_down';
  return 'stable';
}

// ---------------------------------------------------------------------------
// generateAlerts
// ---------------------------------------------------------------------------

/**
 * Generate ranking alerts by comparing previous scores to new scores.
 *
 * Three alert types:
 * - **rankChange** — a nation moved at least {@link cfg.alertDebounce.minRankChangeForAlert} positions.
 * - **overtake** — a nation overtook a specific rival (previous rank was worse).
 * - **milestone** — a nation reached a milestone rank (e.g. 1st place).
 *
 * @see FR-4704
 */
export function generateAlerts(
  previousScores: Record<FactionId, CompositeNationScore> | null,
  newScores: Record<FactionId, CompositeNationScore>,
  turn: TurnNumber,
): RankingAlert[] {
  const alerts: RankingAlert[] = [];
  if (!previousScores) return alerts;

  const minChange = cfg.alertDebounce.minRankChangeForAlert;
  const milestoneRanks = cfg.alertDebounce.milestoneRanks;

  for (const nationCode of Object.keys(newScores) as FactionId[]) {
    const prev = previousScores[nationCode];
    const curr = newScores[nationCode];
    if (!prev || !curr) continue;

    const rankDelta = prev.rank - curr.rank; // positive = improved

    // Rank-change alert
    if (Math.abs(rankDelta) >= minChange) {
      alerts.push({
        alertType: 'rankChange',
        nationCode,
        turn,
        previousRank: prev.rank,
        newRank: curr.rank,
        dismissed: false,
      });
    }

    // Overtake alert: rank improved and passed a specific rival
    if (rankDelta > 0) {
      for (const rivalCode of Object.keys(previousScores) as FactionId[]) {
        if (rivalCode === nationCode) continue;
        const rivalPrev = previousScores[rivalCode];
        const rivalCurr = newScores[rivalCode];
        if (!rivalPrev || !rivalCurr) continue;

        // This nation was behind rival before, now ahead
        if (prev.rank > rivalPrev.rank && curr.rank < rivalCurr.rank) {
          alerts.push({
            alertType: 'overtake',
            nationCode,
            turn,
            previousRank: prev.rank,
            newRank: curr.rank,
            rivalNationCode: rivalCode,
            dismissed: false,
          });
        }
      }
    }

    // Milestone alert
    if (milestoneRanks.includes(curr.rank) && prev.rank !== curr.rank) {
      alerts.push({
        alertType: 'milestone',
        nationCode,
        turn,
        previousRank: prev.rank,
        newRank: curr.rank,
        milestone: `Reached rank #${curr.rank}`,
        dismissed: false,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// computeAllRankings
// ---------------------------------------------------------------------------

/**
 * Compute composite scores for **all** nations, assign ranks, detect trends,
 * and generate alerts. Returns an entirely new {@link RankingState}.
 *
 * 1. Compute raw scores for every nation.
 * 2. Sort descending by compositeScore.
 * 3. Assign rank numbers (1-indexed, no gaps).
 * 4. Compute gap-to-leader.
 * 5. Append to history & derive trend.
 * 6. Generate alerts from previous → new scores.
 *
 * @see FR-4701
 * @see FR-4703
 * @see FR-4704
 */
export function computeAllRankings(
  nationStates: Record<FactionId, NationState>,
  state: RankingState,
  turn: TurnNumber,
): RankingState {
  const weights = state.weights;
  const previousScores =
    Object.keys(state.currentScores).length > 0 ? state.currentScores : null;

  // 1. Compute raw scores
  const unsorted: CompositeNationScore[] = [];
  for (const [id, ns] of Object.entries(nationStates) as [FactionId, NationState][]) {
    unsorted.push(computeNationScore(ns, weights, turn));
  }

  // 2. Sort descending by compositeScore
  unsorted.sort((a, b) => b.compositeScore - a.compositeScore);

  // 3 + 4. Assign rank & gap-to-leader
  const leaderScore = unsorted.length > 0 ? unsorted[0].compositeScore : 0;

  const newCurrentScores = {} as Record<FactionId, CompositeNationScore>;
  const newHistory = { ...state.history } as Record<FactionId, CompositeNationScore[]>;

  for (let i = 0; i < unsorted.length; i++) {
    const entry = unsorted[i];
    const nationCode = entry.nationCode;
    const prevRank = previousScores?.[nationCode]?.rank ?? 0;

    // Build updated history (append before trend)
    const prevHistory = [...(state.history[nationCode] ?? [])];

    const scored: CompositeNationScore = {
      ...entry,
      rank: i + 1,
      previousRank: prevRank,
      gapToLeader: Math.round((leaderScore - entry.compositeScore) * 100) / 100,
      trend: 'stable', // placeholder
    };

    // 5. Append to history & compute trend
    const updatedHistory = [...prevHistory, scored];
    scored.trend = computeTrend(updatedHistory, cfg.trendWindow);

    // Overwrite the last entry with the corrected trend
    updatedHistory[updatedHistory.length - 1] = scored;

    newCurrentScores[nationCode] = scored;
    newHistory[nationCode] = updatedHistory;
  }

  // 6. Generate alerts
  const newAlerts = generateAlerts(previousScores, newCurrentScores, turn);

  return {
    currentScores: newCurrentScores,
    history: newHistory,
    alerts: [...state.alerts, ...newAlerts],
    weights,
  };
}

// ---------------------------------------------------------------------------
// getLeaderboard
// ---------------------------------------------------------------------------

/**
 * Return an array of {@link CompositeNationScore} sorted descending by
 * compositeScore (i.e. rank order).
 *
 * @see FR-4705
 */
export function getLeaderboard(state: RankingState): CompositeNationScore[] {
  return Object.values(state.currentScores).sort(
    (a, b) => a.rank - b.rank,
  );
}

// ---------------------------------------------------------------------------
// getTrendArrow
// ---------------------------------------------------------------------------

/**
 * Map a {@link RankTrend} to a Unicode arrow for display.
 *
 * | Trend          | Arrow |
 * |----------------|-------|
 * | up             | ↑     |
 * | slightly_up    | ↗     |
 * | stable         | →     |
 * | slightly_down  | ↘     |
 * | down           | ↓     |
 *
 * @see FR-4703
 */
export function getTrendArrow(trend: RankTrend): string {
  const map: Record<RankTrend, string> = {
    up: '↑',
    slightly_up: '↗',
    stable: '→',
    slightly_down: '↘',
    down: '↓',
  };
  return map[trend];
}

// ---------------------------------------------------------------------------
// getStrongestWeakestDimension
// ---------------------------------------------------------------------------

/**
 * Identify the strongest and weakest scoring dimensions for a nation.
 *
 * Compares **weightedScore** across all 7 dimensions.
 *
 * @see FR-4705
 */
export function getStrongestWeakestDimension(
  score: CompositeNationScore,
): { strongest: RankingScoringDimension; weakest: RankingScoringDimension } {
  let strongest: RankingScoringDimension = ALL_DIMENSIONS[0];
  let weakest: RankingScoringDimension = ALL_DIMENSIONS[0];
  let maxWeighted = -Infinity;
  let minWeighted = Infinity;

  for (const dim of ALL_DIMENSIONS) {
    const ws = score.dimensionScores[dim].weightedScore;
    if (ws > maxWeighted) {
      maxWeighted = ws;
      strongest = dim;
    }
    if (ws < minWeighted) {
      minWeighted = ws;
      weakest = dim;
    }
  }

  return { strongest, weakest };
}
