/**
 * Multi-Horizon Strategic Projections & What-If Scenario Simulator
 *
 * Projects key metrics (Stability, GDP, MilitaryReadiness, DiplomaticInfluence,
 * CivilUnrest, NuclearThreshold) at three time horizons—immediate, medium-term,
 * and endgame—using linear extrapolation from per-turn trajectory deltas.
 *
 * Also provides a zero-side-effect What-If simulator that clones state, applies
 * hypothetical action deltas, computes projected metric changes over the
 * immediate horizon, and assesses viability impact and loss-margin risk.
 *
 * All functions are pure: no side-effects, no state mutation.
 *
 * @see FR-1402 — Multi-Horizon Strategic Projections
 * @see FR-1408 — What-If Scenario Simulator
 * @module engine/projection-whatif-engine
 */

import type { FactionId, TurnNumber, ProjectionHorizonType } from '@/data/types';
import { ProjectionHorizonType as ProjectionHorizonTypeEnum } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound.
 * @param max   - Upper bound.
 * @returns The clamped value.
 *
 * @internal
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration slice consumed by the projection / what-if engine.
 *
 * Derived from the advisory section of {@link GAME_CONFIG} so the engine is
 * decoupled from the concrete config object during testing.
 *
 * @see FR-1402
 * @see FR-1408
 */
export type ProjectionConfig = typeof GAME_CONFIG.advisory;

/**
 * A single metric's current value, projected value, and the delta between
 * them over a given horizon.
 *
 * @see FR-1402
 */
export interface MetricProjection {
  /** Name of the projected metric (e.g. `"Stability"`, `"GDP"`). */
  metricName: string;

  /** Value of the metric at the time of projection. */
  currentValue: number;

  /**
   * Linearly projected value at the end of the horizon.
   *
   * `projectedValue = currentValue + trajectory × horizonTurns`
   */
  projectedValue: number;

  /** Absolute change: `projectedValue − currentValue`. */
  delta: number;
}

/**
 * All metric projections for a single time horizon.
 *
 * @see FR-1402
 */
export interface HorizonProjection {
  /** Which horizon this projection covers. */
  horizon: ProjectionHorizonType;

  /** Number of turns in this projection window. */
  horizonTurns: number;

  /** Per-metric projections for this horizon. */
  projections: MetricProjection[];
}

/**
 * Input required to produce a multi-horizon projection for one faction.
 *
 * @see FR-1402
 */
export interface MultiHorizonProjectionInput {
  /** Faction being projected. */
  factionId: FactionId;

  /** Current game turn at the time of projection. */
  currentTurn: TurnNumber;

  /**
   * Snapshot of the faction's current metric values.
   *
   * Keys are metric names (e.g. `"Stability"`, `"GDP"`).
   */
  currentMetrics: Record<string, number>;

  /**
   * Per-turn delta for each metric, capturing the current policy trajectory.
   *
   * Keys must match those in {@link currentMetrics}.
   */
  perTurnTrajectory: Record<string, number>;
}

/**
 * Full multi-horizon projection result for a single faction and turn.
 *
 * Contains immediate, medium-term, and endgame horizon projections.
 *
 * @see FR-1402
 */
export interface MultiHorizonProjectionResult {
  /** Faction whose metrics are projected. */
  factionId: FactionId;

  /** Turn number at which the projection was computed. */
  currentTurn: TurnNumber;

  /**
   * Array of three {@link HorizonProjection} objects — one for each
   * horizon (immediate, medium-term, endgame).
   */
  horizons: HorizonProjection[];

  /** Human-readable explanation of the projection context. */
  reason: string;
}

/**
 * A single hypothetical action delta to apply in a what-if simulation.
 *
 * @see FR-1408
 */
export interface WhatIfActionDelta {
  /** The metric affected by this action (e.g. `"Stability"`). */
  metricName: string;

  /** Immediate additive delta applied to the metric before projection. */
  immediateDelta: number;
}

/**
 * Full input bundle for a what-if simulation.
 *
 * Captures the faction's current state, hypothetical action deltas, current
 * viability scores, and the nearest loss margin—everything the simulator
 * needs to project outcomes without touching live state.
 *
 * @see FR-1408
 */
export interface WhatIfSimulationInput {
  /** Faction being simulated. */
  factionId: FactionId;

  /** Current game turn. */
  currentTurn: TurnNumber;

  /**
   * Snapshot of the faction's current metric values.
   *
   * Keys are metric names (e.g. `"Stability"`, `"GDP"`).
   */
  currentMetrics: Record<string, number>;

  /**
   * Per-turn deltas for each metric (current policy trajectory).
   *
   * Keys must match those in {@link currentMetrics}.
   */
  perTurnTrajectory: Record<string, number>;

  /**
   * Hypothetical action deltas to apply before forward-projection.
   *
   * Each delta is applied additively to the cloned metrics snapshot.
   */
  actionDeltas: WhatIfActionDelta[];

  /**
   * Current viability scores for the faction, keyed by viability category
   * (e.g. `"military"`, `"economic"`, `"diplomatic"`).
   */
  currentViabilityScores: Record<string, number>;

  /**
   * The faction's nearest loss-condition margin (0–100 scale) as produced
   * by the loss-warning engine.
   *
   * @see FR-1404
   */
  nearestLossMargin: number;
}

/**
 * Result of a what-if simulation: projected metrics after hypothetical
 * actions, viability impact assessment, and loss-margin risk analysis.
 *
 * @see FR-1408
 */
export interface WhatIfSimulationResult {
  /** Faction that was simulated. */
  factionId: FactionId;

  /** Turn at which the simulation was computed. */
  currentTurn: TurnNumber;

  /**
   * Per-metric projections after applying action deltas and projecting
   * forward by the immediate horizon (3 turns).
   *
   * `currentValue` is the cloned value *after* the action deltas are
   * applied; `projectedValue` is the forward projection.
   */
  projectedMetrics: MetricProjection[];

  /**
   * Estimated impact on each viability category.
   *
   * Positive values indicate improvement; negative values indicate
   * degradation. Clamped to the `[−10, +10]` range.
   */
  viabilityImpacts: Record<string, number>;

  /**
   * Updated loss margin after applying action deltas.
   *
   * Computed as:
   * `newLossMargin = nearestLossMargin + sumOfActionDeltas × 0.1`
   */
  newLossMargin: number;

  /**
   * `true` when the simulation indicates that the player moves *closer*
   * to a loss condition (i.e. the new margin is less than the original).
   */
  lossRiskIncreased: boolean;

  /** Human-readable explanation of the simulation. */
  reason: string;
}

/**
 * Input for projecting metrics at a single horizon.
 *
 * Used internally by {@link ProjectionWhatIfEngine.projectMetricsAtHorizon}
 * and exposed for direct testing.
 *
 * @see FR-1402
 */
export interface SingleHorizonInput {
  /**
   * Snapshot of the faction's current metric values.
   *
   * Keys are metric names (e.g. `"Stability"`, `"GDP"`).
   */
  currentMetrics: Record<string, number>;

  /**
   * Per-turn delta for each metric.
   *
   * Keys must match those in {@link currentMetrics}.
   */
  perTurnTrajectory: Record<string, number>;

  /** Number of turns to project forward. */
  horizonTurns: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Projection and What-If simulation engine.
 *
 * Provides:
 * 1. **Multi-horizon projections** — linear extrapolation of faction metrics
 *    across immediate (3 turns), medium-term (12 turns), and endgame
 *    (remaining turns to turn 60) horizons.
 * 2. **What-If simulations** — apply hypothetical action deltas to a
 *    deep-cloned state snapshot, project forward, and assess viability and
 *    loss-margin impact—all with zero side-effects on live state.
 *
 * Construct with a {@link ProjectionConfig} (normally
 * `GAME_CONFIG.advisory`) to decouple from the global config singleton in
 * tests.
 *
 * @example
 * ```ts
 * const engine = new ProjectionWhatIfEngine(GAME_CONFIG.advisory);
 *
 * const projection = engine.generateMultiHorizonProjection({
 *   factionId: 'US' as FactionId,
 *   currentTurn: 10 as TurnNumber,
 *   currentMetrics: { Stability: 70, GDP: 500 },
 *   perTurnTrajectory: { Stability: -1.5, GDP: 3 },
 * });
 *
 * const whatIf = engine.simulateWhatIf({
 *   factionId: 'US' as FactionId,
 *   currentTurn: 10 as TurnNumber,
 *   currentMetrics: { Stability: 70, GDP: 500 },
 *   perTurnTrajectory: { Stability: -1.5, GDP: 3 },
 *   actionDeltas: [{ metricName: 'Stability', immediateDelta: 5 }],
 *   currentViabilityScores: { military: 60, economic: 70 },
 *   nearestLossMargin: 25,
 * });
 * ```
 *
 * @see FR-1402 — Multi-Horizon Strategic Projections
 * @see FR-1408 — What-If Scenario Simulator
 */
export class ProjectionWhatIfEngine {
  /** Advisory configuration slice (immutable after construction). */
  private readonly cfg: ProjectionConfig;

  /**
   * Create a new projection / what-if engine.
   *
   * @param config - The full advisory configuration from
   *   {@link GAME_CONFIG.advisory}. Stored as-is; no mutations are applied.
   *
   * @see FR-1402
   * @see FR-1408
   */
  constructor(config: ProjectionConfig) {
    this.cfg = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API — Projections (FR-1402)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Project all metrics forward by a single horizon.
   *
   * For each metric key in `currentMetrics`:
   *
   * ```
   * projectedValue = currentValue + (trajectory[key] ?? 0) × horizonTurns
   * delta          = projectedValue − currentValue
   * ```
   *
   * The function is **pure**: `currentMetrics` and `perTurnTrajectory` are
   * never mutated.
   *
   * @param input - Current metrics, per-turn trajectory, and horizon length.
   * @returns An array of {@link MetricProjection} objects—one per metric.
   *
   * @see FR-1402
   */
  projectMetricsAtHorizon(input: SingleHorizonInput): MetricProjection[] {
    const { currentMetrics, perTurnTrajectory, horizonTurns } = input;
    const projections: MetricProjection[] = [];

    for (const metricName of Object.keys(currentMetrics)) {
      const currentValue = currentMetrics[metricName]!;
      const trajectory = perTurnTrajectory[metricName] ?? 0;
      const projectedValue = currentValue + trajectory * horizonTurns;
      const delta = projectedValue - currentValue;

      projections.push({
        metricName,
        currentValue,
        projectedValue,
        delta,
      });
    }

    return projections;
  }

  /**
   * Generate projections across all three strategic horizons.
   *
   * | Horizon     | Window                                             |
   * |-------------|----------------------------------------------------|
   * | Immediate   | `cfg.projectionHorizons.immediate` turns (3)       |
   * | Medium-term | `cfg.projectionHorizons.mediumTerm` turns (12)     |
   * | Endgame     | `max(0, cfg.projectionHorizons.endgame − turn)` turns |
   *
   * Each horizon delegates to {@link projectMetricsAtHorizon} for per-metric
   * linear extrapolation.
   *
   * @param input - Faction, turn, current metrics, and trajectory.
   * @returns A {@link MultiHorizonProjectionResult} containing all three
   *   horizon projections.
   *
   * @see FR-1402
   */
  generateMultiHorizonProjection(
    input: MultiHorizonProjectionInput,
  ): MultiHorizonProjectionResult {
    const { factionId, currentTurn, currentMetrics, perTurnTrajectory } = input;

    const immediateTurns = this.cfg.projectionHorizons.immediate;
    const mediumTermTurns = this.cfg.projectionHorizons.mediumTerm;
    const endgameTurns = Math.max(
      0,
      this.cfg.projectionHorizons.endgame - (currentTurn as number),
    );

    const immediateProjection: HorizonProjection = {
      horizon: ProjectionHorizonTypeEnum.Immediate,
      horizonTurns: immediateTurns,
      projections: this.projectMetricsAtHorizon({
        currentMetrics,
        perTurnTrajectory,
        horizonTurns: immediateTurns,
      }),
    };

    const mediumTermProjection: HorizonProjection = {
      horizon: ProjectionHorizonTypeEnum.MediumTerm,
      horizonTurns: mediumTermTurns,
      projections: this.projectMetricsAtHorizon({
        currentMetrics,
        perTurnTrajectory,
        horizonTurns: mediumTermTurns,
      }),
    };

    const endgameProjection: HorizonProjection = {
      horizon: ProjectionHorizonTypeEnum.Endgame,
      horizonTurns: endgameTurns,
      projections: this.projectMetricsAtHorizon({
        currentMetrics,
        perTurnTrajectory,
        horizonTurns: endgameTurns,
      }),
    };

    return {
      factionId,
      currentTurn,
      horizons: [immediateProjection, mediumTermProjection, endgameProjection],
      reason:
        `Multi-horizon projection for ${factionId as string}` +
        ` at turn ${currentTurn as number}`,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API — What-If Simulation (FR-1408)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Run a zero-side-effect what-if simulation.
   *
   * The algorithm proceeds in six steps:
   *
   * 1. **Clone** the current metrics snapshot (deep copy via spread).
   * 2. **Apply** each action delta additively to the cloned metrics.
   * 3. **Project** the cloned metrics forward by the immediate horizon
   *    (`cfg.projectionHorizons.immediate` turns) using the existing
   *    per-turn trajectory.
   * 4. **Build** the projected-metrics array (current = post-action value,
   *    projected = value after immediate horizon, delta = projected − current).
   * 5. **Assess viability impact** — for each viability key, compute the
   *    mean of all action deltas normalised by the number of metrics,
   *    clamped to `[−10, +10]`.
   * 6. **Assess loss-margin risk** — the new loss margin equals
   *    `nearestLossMargin + sumOfActionDeltas × 0.1`. If the new margin is
   *    lower than the original, `lossRiskIncreased` is `true`.
   *
   * **Live state is never mutated.**
   *
   * @param input - Full what-if simulation input including faction state,
   *   action deltas, viability scores, and nearest loss margin.
   * @returns A {@link WhatIfSimulationResult} with projected metrics,
   *   viability impacts, updated loss margin, and risk flag.
   *
   * @see FR-1408
   */
  simulateWhatIf(input: WhatIfSimulationInput): WhatIfSimulationResult {
    const {
      factionId,
      currentTurn,
      currentMetrics,
      perTurnTrajectory,
      actionDeltas,
      currentViabilityScores,
      nearestLossMargin,
    } = input;

    // Step 1: Deep-clone metrics — guarantees zero side-effects.
    const clonedMetrics = this.cloneMetrics(currentMetrics);

    // Step 2: Apply action deltas to the cloned snapshot.
    for (const delta of actionDeltas) {
      clonedMetrics[delta.metricName] =
        (clonedMetrics[delta.metricName] ?? 0) + delta.immediateDelta;
    }

    // Step 3 & 4: Project the cloned (post-action) metrics forward by the
    // immediate horizon and build the projectedMetrics array.
    const immediateTurns = this.cfg.projectionHorizons.immediate;
    const projectedMetrics = this.projectMetricsAtHorizon({
      currentMetrics: clonedMetrics,
      perTurnTrajectory,
      horizonTurns: immediateTurns,
    });

    // Step 5: Viability impact heuristic.
    //
    // For each viability category, the impact is the mean of all action
    // deltas divided by the total number of metrics, clamped to [−10, +10].
    const metricCount = Object.keys(currentMetrics).length || 1;
    const sumOfActionDeltas = actionDeltas.reduce(
      (acc, d) => acc + d.immediateDelta,
      0,
    );
    const rawImpact = sumOfActionDeltas / metricCount;

    const viabilityImpacts: Record<string, number> = {};
    for (const viabilityKey of Object.keys(currentViabilityScores)) {
      viabilityImpacts[viabilityKey] = clamp(rawImpact, -10, 10);
    }

    // Step 6: Loss-margin risk assessment.
    //
    // Each +1 aggregate action delta grants +0.1 margin improvement.
    const lossMarginAdjustment = sumOfActionDeltas * 0.1;
    const newLossMargin = nearestLossMargin + lossMarginAdjustment;
    const lossRiskIncreased = newLossMargin < nearestLossMargin;

    return {
      factionId,
      currentTurn,
      projectedMetrics,
      viabilityImpacts,
      newLossMargin,
      lossRiskIncreased,
      reason:
        `What-If simulation for ${factionId as string}: ` +
        `${actionDeltas.length} action delta${actionDeltas.length === 1 ? '' : 's'} applied`,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public Utilities
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create a shallow clone of a metrics record.
   *
   * Returns a **new** object with the same key-value pairs, guaranteeing
   * that mutations to the clone never affect the original. Exposed as a
   * public method for testability.
   *
   * @param metrics - The metrics record to clone.
   * @returns A new record with identical key-value pairs.
   *
   * @see FR-1408
   */
  cloneMetrics(metrics: Record<string, number>): Record<string, number> {
    return { ...metrics };
  }
}
