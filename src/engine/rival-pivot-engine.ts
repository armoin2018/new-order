/**
 * Rival Trajectory Estimation & Strategic Pivot Detection Engine
 *
 * Estimates which victory condition each AI rival is closest to achieving,
 * how many turns remain (degraded by Fog of War), and detects when the
 * player's most viable victory path has shifted for consecutive turns—
 * triggering a "Strategic Crossroads" notification that compares the old
 * versus new path with transition-cost and risk analysis.
 *
 * All functions are pure: no side-effects, no state mutation.
 *
 * @see FR-1405 — Rival Trajectories
 * @see FR-1406 — Strategic Pivot Detection
 * @module engine/rival-pivot-engine
 */

import type { FactionId, TurnNumber, ConfidenceLevel } from '@/data/types';
import { ConfidenceLevel as ConfidenceLevelEnum } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration slice consumed by the rival-pivot engine.
 *
 * Derived from the advisory section of {@link GAME_CONFIG} so the engine is
 * decoupled from the concrete config object during testing.
 *
 * @see FR-1405
 * @see FR-1406
 */
export type RivalPivotConfig = typeof GAME_CONFIG.advisory;

/**
 * Estimated victory trajectory for a single rival faction.
 *
 * Contains the closest victory condition, the estimated turns to reach it,
 * the Fog-of-War accuracy band, and the confidence level that governs
 * how much the estimate may deviate from reality.
 *
 * @see FR-1405
 */
export interface RivalVictoryEstimate {
  /** Faction whose trajectory is being estimated. */
  factionId: FactionId;

  /**
   * Victory condition the rival is closest to achieving.
   *
   * Set to `'none'` when no viability data is available.
   */
  closestVictoryCondition: string;

  /**
   * Estimated number of turns until the rival reaches the victory condition.
   *
   * `null` when no viability data is available or the condition has no
   * computable estimate.
   */
  estimatedTurnsToVictory: number | null;

  /**
   * Fog-of-War accuracy band (±turns) applied to the estimate.
   *
   * High-clarity rivals receive
   * `cfg.rivalTrajectory.highClarityAccuracyBand` (3); low-clarity rivals
   * receive `cfg.rivalTrajectory.lowClarityAccuracyBand` (8).
   *
   * @see FR-1405
   */
  accuracyBand: number;

  /**
   * Confidence in the estimate.
   *
   * `'high'` when intel clarity meets or exceeds the threshold; `'low'`
   * otherwise.
   *
   * @see FR-1405
   */
  confidence: ConfidenceLevel;

  /** Human-readable explanation of the estimation logic. */
  reason: string;
}

/**
 * Input required to estimate a single rival's victory trajectory.
 *
 * @see FR-1405
 */
export interface RivalTrajectoryInput {
  /** Rival faction to evaluate. */
  rivalFactionId: FactionId;

  /**
   * Per-victory-condition viability data for this rival.
   *
   * Each entry pairs a `victoryConditionId` with a numeric `viabilityScore`
   * and an optional `turnsEstimate`.
   */
  victoryViabilities: {
    victoryConditionId: string;
    viabilityScore: number;
    turnsEstimate: number | null;
  }[];

  /**
   * Intel clarity score (0–100) representing how well the player can observe
   * this rival's internal state.
   *
   * A higher value produces a tighter accuracy band.
   *
   * @see FR-1405
   */
  intelClarity: number;

  /** Current game turn at the time of estimation. */
  currentTurn: TurnNumber;
}

/**
 * A single entry in the rival leaderboard, ranked by proximity to victory.
 *
 * @see FR-1405
 */
export interface RivalLeaderboardEntry {
  /** Faction represented by this entry. */
  factionId: FactionId;

  /** Victory condition this rival is closest to achieving. */
  closestVictoryCondition: string;

  /**
   * Estimated turns to victory.
   *
   * `null` when no estimate is available.
   */
  estimatedTurnsToVictory: number | null;

  /** Fog-of-War accuracy band (±turns). @see FR-1405 */
  accuracyBand: number;

  /** Confidence level of the estimate. @see FR-1405 */
  confidence: ConfidenceLevel;
}

/**
 * Input for assessing the rival leaderboard across multiple factions.
 *
 * @see FR-1405
 */
export interface RivalLeaderboardInput {
  /** Array of rival trajectory inputs—one per AI faction. */
  rivals: RivalTrajectoryInput[];

  /** Current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of a rival leaderboard assessment.
 *
 * Entries are sorted by `estimatedTurnsToVictory` ascending (nulls last).
 *
 * @see FR-1405
 */
export interface RivalLeaderboardResult {
  /** Sorted leaderboard entries. */
  entries: RivalLeaderboardEntry[];

  /** Human-readable explanation. */
  reason: string;
}

/**
 * A single turn's snapshot of the player's top victory path.
 *
 * Stored in chronological order to enable streak detection.
 *
 * @see FR-1406
 */
export interface PivotHistoryEntry {
  /** The turn at which this snapshot was recorded. */
  turn: TurnNumber;

  /** The victory path that was dominant this turn. */
  topVictoryPath: string;
}

/**
 * Input required to detect a strategic pivot.
 *
 * @see FR-1406
 */
export interface StrategicPivotInput {
  /** Faction being evaluated (typically the player). */
  factionId: FactionId;

  /**
   * Chronological history of the player's top victory path per turn.
   *
   * Most-recent entry is last.
   */
  pivotHistory: PivotHistoryEntry[];

  /** The player's current-turn top victory path. */
  currentTopPath: string;

  /** The player's previous-turn top victory path. */
  previousTopPath: string;

  /** Current game turn. */
  currentTurn: TurnNumber;
}

/**
 * Result of the strategic pivot detection algorithm.
 *
 * @see FR-1406
 */
export interface StrategicPivotResult {
  /** `true` when the pivot threshold has been met or exceeded. */
  pivotDetected: boolean;

  /**
   * Number of consecutive recent turns where the top path matched
   * `currentTopPath`.
   */
  consecutiveTurnsChanged: number;

  /** The path the player was previously pursuing. */
  oldPath: string;

  /** The path the player has pivoted toward. */
  newPath: string;

  /** Human-readable explanation. */
  reason: string;
}

/**
 * Input for generating a "Strategic Crossroads" notification.
 *
 * @see FR-1406
 */
export interface CrossroadsNotificationInput {
  /** Faction receiving the notification. */
  factionId: FactionId;

  /** Victory path the player was previously pursuing. */
  oldPath: string;

  /** Viability score (0–100) of the old path. */
  oldPathViability: number;

  /** Victory path the player has pivoted toward. */
  newPath: string;

  /** Viability score (0–100) of the new path. */
  newPathViability: number;

  /** Current game turn. */
  currentTurn: TurnNumber;
}

/**
 * A fully-formed "Strategic Crossroads" notification comparing old and new
 * victory paths with transition-cost and risk analysis.
 *
 * @see FR-1406
 */
export interface CrossroadsNotificationResult {
  /** Display title for the notification card. */
  title: string;

  /** Summary of the abandoned path including its viability score. */
  oldPathSummary: string;

  /** Summary of the newly-adopted path including its viability score. */
  newPathSummary: string;

  /**
   * Signed viability difference: `newPathViability − oldPathViability`.
   *
   * Positive values mean the new path is stronger; negative means
   * the player is abandoning a stronger path.
   */
  viabilityDifference: number;

  /**
   * Qualitative risk assessment for the transition:
   *
   * - `"Low — new path significantly stronger"` when difference > 20
   * - `"Moderate — marginal improvement"` when difference > 0
   * - `"Moderate — paths equally viable"` when difference === 0
   * - `"High — abandoning a stronger path"` when difference < 0
   *
   * @see FR-1406
   */
  transitionRisk: string;

  /** Human-readable explanation. */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rival Trajectory & Strategic Pivot Detection engine.
 *
 * Provides:
 * 1. **Rival trajectory estimation** — for each AI faction, determine which
 *    victory condition is closest and estimate turns remaining, degraded by
 *    Fog of War accuracy bands.
 * 2. **Rival leaderboard** — rank all rivals by proximity to victory.
 * 3. **Strategic pivot detection** — detect when the player's top victory
 *    path has changed for a configurable number of consecutive turns.
 * 4. **Crossroads notification** — generate a rich comparison of old vs new
 *    paths including viability difference and transition risk.
 *
 * Construct with a {@link RivalPivotConfig} (normally
 * `GAME_CONFIG.advisory`) to decouple from the global config singleton in
 * tests.
 *
 * @example
 * ```ts
 * const engine = new RivalPivotEngine(GAME_CONFIG.advisory);
 *
 * const estimate = engine.estimateRivalTrajectory({
 *   rivalFactionId: 'CN' as FactionId,
 *   victoryViabilities: [
 *     { victoryConditionId: 'economic', viabilityScore: 72, turnsEstimate: 14 },
 *     { victoryConditionId: 'military', viabilityScore: 55, turnsEstimate: 22 },
 *   ],
 *   intelClarity: 60,
 *   currentTurn: 8 as TurnNumber,
 * });
 *
 * const pivot = engine.detectStrategicPivot({
 *   factionId: 'US' as FactionId,
 *   pivotHistory: [
 *     { turn: 5 as TurnNumber, topVictoryPath: 'military' },
 *     { turn: 6 as TurnNumber, topVictoryPath: 'economic' },
 *     { turn: 7 as TurnNumber, topVictoryPath: 'economic' },
 *   ],
 *   currentTopPath: 'economic',
 *   previousTopPath: 'military',
 *   currentTurn: 7 as TurnNumber,
 * });
 * ```
 *
 * @see FR-1405 — Rival Trajectories
 * @see FR-1406 — Strategic Pivot Detection
 */
export class RivalPivotEngine {
  /** Advisory configuration slice (immutable after construction). */
  private readonly cfg: RivalPivotConfig;

  /**
   * Create a new rival-pivot engine.
   *
   * @param config - The full advisory configuration from
   *   {@link GAME_CONFIG.advisory}. Stored as-is; no mutations are applied.
   *
   * @see FR-1405
   * @see FR-1406
   */
  constructor(config: RivalPivotConfig) {
    this.cfg = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API — Rival Trajectories (FR-1405)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Estimate which victory condition a rival faction is closest to achieving.
   *
   * **Algorithm**:
   *
   * 1. Find the victory condition with the highest `viabilityScore` from
   *    the provided `victoryViabilities` array.
   * 2. If no viabilities are provided (or the array is empty), return a
   *    degenerate estimate with `closestVictoryCondition: 'none'` and
   *    `estimatedTurnsToVictory: null`.
   * 3. Set `closestVictoryCondition` to the best entry's `victoryConditionId`.
   * 4. Set `estimatedTurnsToVictory` to the best entry's `turnsEstimate`.
   * 5. Determine Fog-of-War accuracy band:
   *    - If `intelClarity >= cfg.rivalTrajectory.clarityThreshold` →
   *      `accuracyBand = cfg.rivalTrajectory.highClarityAccuracyBand`,
   *      confidence = `'high'`.
   *    - Otherwise →
   *      `accuracyBand = cfg.rivalTrajectory.lowClarityAccuracyBand`,
   *      confidence = `'low'`.
   * 6. Build a descriptive `reason` string.
   *
   * The function is **pure**: no input arrays or objects are mutated.
   *
   * @param input - Rival faction id, victory viabilities, intel clarity,
   *   and current turn.
   * @returns A {@link RivalVictoryEstimate} with the closest path and
   *   fog-degraded accuracy.
   *
   * @see FR-1405
   */
  estimateRivalTrajectory(input: RivalTrajectoryInput): RivalVictoryEstimate {
    const { rivalFactionId, victoryViabilities, intelClarity } = input;

    // ── Guard: no viability data ──────────────────────────────────────────
    if (victoryViabilities.length === 0) {
      const fallbackAccuracy = this.resolveAccuracyBand(intelClarity);
      return {
        factionId: rivalFactionId,
        closestVictoryCondition: 'none',
        estimatedTurnsToVictory: null,
        accuracyBand: fallbackAccuracy.accuracyBand,
        confidence: fallbackAccuracy.confidence,
        reason:
          `Rival ${rivalFactionId as string} has no victory viability data available`,
      };
    }

    // ── Step 1-4: Find the highest-viability condition ────────────────────
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < victoryViabilities.length; i++) {
      const entry = victoryViabilities[i];
      if (entry !== undefined && entry.viabilityScore > bestScore) {
        bestScore = entry.viabilityScore;
        bestIndex = i;
      }
    }

    const best = victoryViabilities[bestIndex]!;
    const closestVictoryCondition = best.victoryConditionId;
    const estimatedTurnsToVictory = best.turnsEstimate;

    // ── Step 5: Fog-of-War accuracy band ──────────────────────────────────
    const { accuracyBand, confidence } = this.resolveAccuracyBand(intelClarity);

    // ── Step 6: Reason string ─────────────────────────────────────────────
    const reason =
      `Rival ${rivalFactionId as string} estimated closest to ` +
      `${closestVictoryCondition} (±${accuracyBand} turns)`;

    return {
      factionId: rivalFactionId,
      closestVictoryCondition,
      estimatedTurnsToVictory,
      accuracyBand,
      confidence,
      reason,
    };
  }

  /**
   * Assess the rival leaderboard by estimating each rival's trajectory and
   * ranking them by proximity to victory.
   *
   * **Algorithm**:
   *
   * 1. For each rival in `input.rivals`, call {@link estimateRivalTrajectory}.
   * 2. Sort the resulting estimates by `estimatedTurnsToVictory` ascending.
   *    Rivals with `null` estimates are placed last (they have no computable
   *    path to victory).
   * 3. Map the sorted estimates into {@link RivalLeaderboardEntry} objects.
   * 4. Build a descriptive `reason` string.
   *
   * @param input - Array of rival trajectory inputs and the current turn.
   * @returns A {@link RivalLeaderboardResult} with sorted entries.
   *
   * @see FR-1405
   */
  assessRivalLeaderboard(input: RivalLeaderboardInput): RivalLeaderboardResult {
    const { rivals, currentTurn } = input;

    // ── Step 1: Estimate each rival ───────────────────────────────────────
    const estimates: RivalVictoryEstimate[] = rivals.map((rival) =>
      this.estimateRivalTrajectory(rival),
    );

    // ── Step 2: Sort ascending by estimatedTurnsToVictory (nulls last) ───
    const sorted = [...estimates].sort((a, b) => {
      if (a.estimatedTurnsToVictory === null && b.estimatedTurnsToVictory === null) {
        return 0;
      }
      if (a.estimatedTurnsToVictory === null) {
        return 1;
      }
      if (b.estimatedTurnsToVictory === null) {
        return -1;
      }
      return a.estimatedTurnsToVictory - b.estimatedTurnsToVictory;
    });

    // ── Step 3: Map to leaderboard entries ────────────────────────────────
    const entries: RivalLeaderboardEntry[] = sorted.map((est) => ({
      factionId: est.factionId,
      closestVictoryCondition: est.closestVictoryCondition,
      estimatedTurnsToVictory: est.estimatedTurnsToVictory,
      accuracyBand: est.accuracyBand,
      confidence: est.confidence,
    }));

    // ── Step 4: Reason string ─────────────────────────────────────────────
    const reason =
      `Rival leaderboard assessed for ${rivals.length} ` +
      `factions at turn ${currentTurn as number}`;

    return { entries, reason };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API — Strategic Pivot Detection (FR-1406)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Detect whether the player's most viable victory path has shifted for a
   * configurable number of consecutive turns.
   *
   * **Algorithm**:
   *
   * 1. Walk the `pivotHistory` array from the tail (most-recent turn)
   *    backwards, counting consecutive entries where
   *    `topVictoryPath === currentTopPath`.
   * 2. Stop counting when an entry no longer matches `currentTopPath`.
   * 3. A pivot is detected when:
   *    - The consecutive count is ≥
   *      `cfg.pivotDetection.consecutiveTurnsThreshold` (default 2), **and**
   *    - `currentTopPath !== previousTopPath` (the path actually changed).
   * 4. Build a descriptive `reason` string depending on whether a pivot
   *    was detected.
   *
   * @param input - Faction, pivot history, current and previous top paths,
   *   and current turn.
   * @returns A {@link StrategicPivotResult} indicating whether a pivot was
   *   detected and the details of the shift.
   *
   * @see FR-1406
   */
  detectStrategicPivot(input: StrategicPivotInput): StrategicPivotResult {
    const { pivotHistory, currentTopPath, previousTopPath } = input;

    // ── Step 1-2: Count consecutive recent entries matching currentTopPath ─
    let consecutiveTurnsChanged = 0;

    for (let i = pivotHistory.length - 1; i >= 0; i--) {
      const entry = pivotHistory[i];
      if (entry !== undefined && entry.topVictoryPath === currentTopPath) {
        consecutiveTurnsChanged++;
      } else {
        break;
      }
    }

    // ── Step 3: Determine if pivot threshold is met ───────────────────────
    const threshold = this.cfg.pivotDetection.consecutiveTurnsThreshold;
    const pathActuallyChanged = currentTopPath !== previousTopPath;
    const pivotDetected =
      consecutiveTurnsChanged >= threshold && pathActuallyChanged;

    // ── Step 4: Reason string ─────────────────────────────────────────────
    const reason = pivotDetected
      ? `Strategic pivot detected: ${previousTopPath} → ${currentTopPath}` +
        ` for ${consecutiveTurnsChanged} consecutive turns`
      : `No strategic pivot: top path stable at ${currentTopPath}`;

    return {
      pivotDetected,
      consecutiveTurnsChanged,
      oldPath: previousTopPath,
      newPath: currentTopPath,
      reason,
    };
  }

  /**
   * Generate a "Strategic Crossroads" notification comparing the player's
   * old and new victory paths, including viability scores, difference, and
   * a qualitative transition-risk assessment.
   *
   * **Transition Risk Rules**:
   *
   * | Viability Difference | Risk Label                              |
   * |---------------------:|----------------------------------------:|
   * | > 20                 | Low — new path significantly stronger   |
   * | > 0                  | Moderate — marginal improvement         |
   * | === 0                | Moderate — paths equally viable         |
   * | < 0                  | High — abandoning a stronger path       |
   *
   * @param input - Faction, old/new paths with viability scores, and
   *   current turn.
   * @returns A {@link CrossroadsNotificationResult} with title, summaries,
   *   viability comparison, and transition risk.
   *
   * @see FR-1406
   */
  generateCrossroadsNotification(
    input: CrossroadsNotificationInput,
  ): CrossroadsNotificationResult {
    const {
      factionId,
      oldPath,
      oldPathViability,
      newPath,
      newPathViability,
      currentTurn,
    } = input;

    // ── Step 1: Title ─────────────────────────────────────────────────────
    const title = 'Strategic Crossroads';

    // ── Step 2-3: Path summaries ──────────────────────────────────────────
    const oldPathSummary = `${oldPath} (viability: ${oldPathViability})`;
    const newPathSummary = `${newPath} (viability: ${newPathViability})`;

    // ── Step 4: Viability difference ──────────────────────────────────────
    const viabilityDifference = newPathViability - oldPathViability;

    // ── Step 5: Transition risk assessment ────────────────────────────────
    const transitionRisk = this.assessTransitionRisk(viabilityDifference);

    // ── Step 6: Reason string ─────────────────────────────────────────────
    const reason =
      `Crossroads notification for ${factionId as string} ` +
      `at turn ${currentTurn as number}: ${oldPath} → ${newPath}`;

    return {
      title,
      oldPathSummary,
      newPathSummary,
      viabilityDifference,
      transitionRisk,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the Fog-of-War accuracy band and confidence level based on the
   * rival's intel clarity score.
   *
   * @param intelClarity - Intel clarity score (0–100).
   * @returns An object containing `accuracyBand` (±turns) and `confidence`.
   *
   * @internal
   * @see FR-1405
   */
  private resolveAccuracyBand(
    intelClarity: number,
  ): { accuracyBand: number; confidence: ConfidenceLevel } {
    const { clarityThreshold, highClarityAccuracyBand, lowClarityAccuracyBand } =
      this.cfg.rivalTrajectory;

    if (intelClarity >= clarityThreshold) {
      return {
        accuracyBand: highClarityAccuracyBand,
        confidence: ConfidenceLevelEnum.High,
      };
    }

    return {
      accuracyBand: lowClarityAccuracyBand,
      confidence: ConfidenceLevelEnum.Low,
    };
  }

  /**
   * Determine the qualitative transition risk label based on the signed
   * viability difference between new and old paths.
   *
   * @param viabilityDifference - `newPathViability − oldPathViability`.
   * @returns A human-readable risk string.
   *
   * @internal
   * @see FR-1406
   */
  private assessTransitionRisk(viabilityDifference: number): string {
    if (viabilityDifference > 20) {
      return 'Low — new path significantly stronger';
    }
    if (viabilityDifference > 0) {
      return 'Moderate — marginal improvement';
    }
    if (viabilityDifference === 0) {
      return 'Moderate — paths equally viable';
    }
    return 'High — abandoning a stronger path';
  }
}
