/**
 * Dynamic Rankings & Composite Scoring Types — DR-197, DR-198, FR-4700
 *
 * Type definitions for the nation ranking system that tracks composite scores,
 * per-dimension breakdowns, rank trends, and ranking alerts.
 */
import type { FactionId, TurnNumber } from './enums';

/** The 7 scoring dimensions with configurable weights (FR-4702) */
export type RankingScoringDimension =
  | 'stability'
  | 'economicHealth'
  | 'militaryPower'
  | 'diplomaticInfluence'
  | 'technologyLevel'
  | 'marketPerformance'
  | 'educationDemographics';

/** Per-dimension score breakdown */
export interface RankingDimensionScore {
  rawValue: number;
  weight: number;
  weightedScore: number;
}

/** Rank trend direction (FR-4703) */
export type RankTrend = 'up' | 'slightly_up' | 'stable' | 'slightly_down' | 'down';

/** Composite nation score for a single turn (DR-197) */
export interface CompositeNationScore {
  nationCode: FactionId;
  turn: TurnNumber;
  compositeScore: number;
  dimensionScores: Record<RankingScoringDimension, RankingDimensionScore>;
  rank: number;
  previousRank: number;
  trend: RankTrend;
  gapToLeader: number;
}

/** Ranking alert types (DR-198) */
export type RankingAlertType = 'rankChange' | 'overtake' | 'milestone';

/** A ranking alert notification (DR-198) */
export interface RankingAlert {
  alertType: RankingAlertType;
  nationCode: FactionId;
  turn: TurnNumber;
  previousRank: number;
  newRank: number;
  rivalNationCode?: FactionId;
  milestone?: string;
  dismissed: boolean;
}

/** Complete ranking state tracked in game */
export interface RankingState {
  currentScores: Record<FactionId, CompositeNationScore>;
  history: Record<FactionId, CompositeNationScore[]>;
  alerts: RankingAlert[];
  weights: Record<RankingScoringDimension, number>;
}
