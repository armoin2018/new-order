/**
 * Strategic Advisory Types — DR-114, DR-115, DR-116, DR-117, DR-118
 *
 * The Strategic Pathfinder advisory system evaluates victory conditions,
 * projects future state, recommends actions, and grades performance.
 */

import type {
  FactionId,
  ActionId,
  TurnNumber,
  ViabilityLabel,
  TrendDirection,
  ConfidenceLevel,
  ConsistencyState,
  StrategicGrade,
} from './enums';

// ---------------------------------------------------------------------------
// DR-114 — Victory Path Viability Scores
// ---------------------------------------------------------------------------

/**
 * Per-victory-condition viability assessment for a single turn.
 */
export interface VictoryPathViability {
  /** Identifier for the victory condition (e.g. "economic_dominance"). */
  victoryConditionId: string;
  /** Quantitative viability. Range: 0–100. */
  viabilityScore: number;
  /** Qualitative label. */
  label: ViabilityLabel;
  /** Direction of recent change. */
  trend: TrendDirection;
  /** Estimated turns until this victory condition could be achieved. null if Foreclosed. */
  turnsToVictoryEstimate: number | null;
  /** Advisory confidence in this assessment. */
  confidence: ConfidenceLevel;
}

/**
 * All victory path assessments for a single turn.
 */
export interface TurnViabilityAssessment {
  turn: TurnNumber;
  factionId: FactionId;
  paths: VictoryPathViability[];
}

// ---------------------------------------------------------------------------
// DR-115 — State Trend Snapshots
// ---------------------------------------------------------------------------

/**
 * A snapshot of all key nation metrics for one turn.
 *
 * Used to compute projections across Immediate / Medium / Endgame horizons
 * and to generate post-game inflection point analysis.
 */
export interface StateTrendSnapshot {
  turn: TurnNumber;
  factionId: FactionId;
  /** Key metric values captured this turn. */
  metrics: Record<string, number>;
}

/** Full trend history — ordered array of snapshots. */
export type StateTrendHistory = StateTrendSnapshot[];

// ---------------------------------------------------------------------------
// DR-116 — Action-Outcome Prediction Cache
// ---------------------------------------------------------------------------

/**
 * A single action evaluation from the advisory system.
 *
 * Refreshed each turn for all candidate player actions.
 */
export interface ActionOutcomePrediction {
  /** Unique action identifier. */
  actionId: ActionId;
  /** Projected changes to key metrics if this action is taken. */
  projectedMetricDeltas: Record<string, number>;
  /** Projected AI responses from other factions. */
  projectedAiResponses: AiResponseProjection[];
  /** Projected impact on each victory path viability. */
  viabilityImpact: Record<string, number>;
  /** Projected change in loss risk. */
  lossRiskDelta: number;
  /** Advisory confidence in this prediction. */
  confidenceLevel: ConfidenceLevel;
}

/** A single projected AI response to a player action. */
export interface AiResponseProjection {
  respondingFaction: FactionId;
  /** Most likely response action key. */
  likelyAction: string;
  /** Probability of this response. Range: 0–100. */
  probability: number;
  /** Brief rationale. */
  rationale: string;
}

/** Cache of all evaluated actions for the current turn. */
export type ActionOutcomePredictionCache = ActionOutcomePrediction[];

// ---------------------------------------------------------------------------
// DR-117 — Strategic Consistency Log
// ---------------------------------------------------------------------------

/**
 * A single action record within the consistency window.
 */
export interface ConsistencyAction {
  turn: TurnNumber;
  actionId: ActionId;
  /** Human-readable action description. */
  actionDescription: string;
  /** Which victory path this action most advanced. */
  alignedVictoryPath: string;
}

/**
 * Rolling 6-turn strategic consistency tracking (DR-117).
 *
 * - Consistency > 70% → Focus Bonus (+5% effectiveness)
 * - Consistency < 30% → Drift Penalty (−5% effectiveness + domestic press criticism)
 */
export interface StrategicConsistencyLog {
  factionId: FactionId;
  /** The rolling window of recent actions (max 6 turns). */
  actions: ConsistencyAction[];
  /** Current consistency score. Range: 0–100. */
  consistencyScore: number;
  /** Current bonus/penalty state. */
  state: ConsistencyState;
  /** The dominant victory path in the current window. */
  dominantVictoryPath: string;
}

// ---------------------------------------------------------------------------
// DR-118 — Post-Game Analysis Archive
// ---------------------------------------------------------------------------

/**
 * An inflection point identified in post-game analysis.
 *
 * A turn where a single player action dramatically shifted
 * the viability of one or more victory paths.
 */
export interface InflectionPoint {
  turn: TurnNumber;
  actionId: ActionId;
  actionDescription: string;
  /** Victory paths that shifted significantly. */
  affectedPaths: string[];
  /** Magnitude of the shift per path. */
  viabilityDeltas: Record<string, number>;
  /** Brief narrative explanation. */
  narrative: string;
}

/**
 * A "Road Not Taken" projection — what would have happened
 * if a different choice was made at a key inflection point.
 */
export interface RoadNotTaken {
  inflectionTurn: TurnNumber;
  alternativeActionId: ActionId;
  alternativeDescription: string;
  projectedOutcome: Record<string, number>;
  narrativeSummary: string;
}

/** Rubric breakdown for the final strategic grade. */
export interface StrategicGradeRubric {
  /** Consistency of strategy over the game. Range: 0–100. */
  consistency: number;
  /** Adaptability to changing conditions. Range: 0–100. */
  adaptability: number;
  /** Efficiency of resource utilization. Range: 0–100. */
  efficiency: number;
  /** Quality of diplomatic maneuvering. Range: 0–100. */
  diplomacy: number;
  /** Overall threat management. Range: 0–100. */
  threatManagement: number;
}

/**
 * Full post-game analysis archive (DR-118).
 */
export interface PostGameAnalysis {
  factionId: FactionId;
  /** Complete viability score history for all victory conditions per turn. */
  viabilityHistory: TurnViabilityAssessment[];
  /** Key moments that changed the game's trajectory. */
  inflectionPoints: InflectionPoint[];
  /** Alternative history projections. */
  roadsNotTaken: RoadNotTaken[];
  /** Final letter grade. */
  strategicGrade: StrategicGrade;
  /** Rubric breakdown supporting the grade. */
  rubric: StrategicGradeRubric;
}
