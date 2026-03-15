/**
 * Loss Condition Early Warning System
 *
 * Monitors all loss conditions (VC-04 through VC-09) and provides graduated
 * urgency alerts so the player (or AI) can take corrective action before a
 * loss condition fires.
 *
 * Urgency is classified into three tiers—watch, warning, critical—based on
 * estimated turns to trigger and distance-from-trigger thresholds drawn from
 * {@link GAME_CONFIG.advisory.lossWarning}.
 *
 * All functions are pure: no side-effects, no state mutation.
 *
 * @see FR-1404 — Loss Condition Early Warning System
 * @module engine/loss-warning
 */

import type { FactionId, TurnNumber } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration slice consumed by the loss-warning engine.
 *
 * Derived from the advisory section of {@link GAME_CONFIG} so the engine is
 * decoupled from the concrete config object during testing.
 *
 * @see FR-1404
 */
export type LossWarningConfig = typeof GAME_CONFIG.advisory;

/**
 * Graduated urgency levels for a loss-condition alert.
 *
 * | Level      | Meaning                                     |
 * |------------|---------------------------------------------|
 * | `watch`    | Loss condition trending; ≤ 12 turns away    |
 * | `warning`  | Loss condition approaching; ≤ 6 turns away  |
 * | `critical` | Loss condition imminent; ≤ 3 turns away     |
 *
 * @see FR-1404
 */
export type UrgencyLevel = 'watch' | 'warning' | 'critical';

/**
 * Status snapshot for a single monitored loss condition.
 *
 * Produced once per condition per evaluation cycle. Consumers can display
 * these in the Strategic Advisory panel.
 *
 * @see FR-1404
 */
export interface LossConditionStatus {
  /** Loss condition identifier (e.g. 'VC-04'). */
  conditionId: string;

  /** Human-readable name. */
  name: string;

  /** Current metric value relevant to this condition. */
  currentValue: number;

  /** Threshold that triggers the loss. */
  triggerThreshold: number;

  /**
   * Distance from trigger as a percentage.
   *
   * - `0` means the metric is at (or past) the threshold.
   * - `1` means the metric is as far from the threshold as possible.
   */
  distanceFromTrigger: number;

  /**
   * Estimated turns until the trigger fires at the current trajectory.
   *
   * `null` when the metric is *not* trending toward the loss condition.
   */
  estimatedTurnsToTrigger: number | null;

  /** Urgency level, or `null` if no alert is warranted. */
  urgency: UrgencyLevel | null;

  /**
   * Recommended counter-actions.
   *
   * Only populated when urgency is `'critical'`.
   */
  counterActions: string[];
}

/**
 * Full assessment across every monitored loss condition for one faction in
 * one turn.
 *
 * @see FR-1404
 */
export interface LossWarningAssessment {
  /** Faction being assessed. */
  factionId: FactionId;

  /** Turn at which the assessment was computed. */
  turn: TurnNumber;

  /** Individual condition alerts (one per monitored loss condition). */
  alerts: LossConditionStatus[];

  /**
   * Minimum distance across all loss conditions, scaled 0-100.
   *
   * Used as the "loss margin" input to the composite strategy score
   * ({@link GAME_CONFIG.advisory.compositeStrategy.lossMarginWeight}).
   */
  minimumLossMargin: number;

  /** `true` when at least one alert is at the `'critical'` level. */
  hasCriticalAlert: boolean;
}

/**
 * Instantaneous metric snapshot fed into the loss-warning evaluator.
 *
 * All values are in their natural [0-100] range unless noted otherwise.
 *
 * @see FR-1404
 */
export interface LossMetricInput {
  /** Current stability (0-100). */
  stability: number;

  /** Current civil unrest (0-100). */
  civilUnrest: number;

  /** Current nuclear threshold (0-100). */
  nuclearThreshold: number;

  /** Average tension level with all other factions (0-100). */
  averageTensionLevel: number;

  /** Number of consecutive turns with negative trade balance. */
  negativeTradeTurns: number;

  /** Military power base (0-100). */
  militaryPowerBase: number;

  /** Security services power base (0-100). */
  securityPowerBase: number;
}

/**
 * Per-turn deltas used to project future metric values.
 *
 * Positive values indicate *increase* per turn; negative values indicate
 * *decrease* per turn.
 *
 * @see FR-1404
 */
export interface LossTrajectoryInput {
  /** Per-turn change in stability. */
  stabilityDelta: number;

  /** Per-turn change in civil unrest. */
  civilUnrestDelta: number;

  /** Per-turn change in nuclear threshold. */
  nuclearThresholdDelta: number;

  /** Per-turn change in average tension. */
  tensionDelta: number;

  /** Per-turn change in military power base. */
  militaryDelta: number;

  /** Per-turn change in security power base. */
  securityDelta: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter-action look-up table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recommended counter-actions keyed by loss-condition identifier.
 *
 * Only surfaced when the urgency level reaches `'critical'`.
 *
 * @internal
 */
const COUNTER_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  'VC-04': [
    'Increase domestic spending',
    'Deploy security forces',
    'Negotiate with opposition',
  ],
  'VC-05': [
    'Open diplomatic backchannel',
    'Reduce military posture',
    'Propose arms control',
  ],
  'VC-06': [
    'Improve bilateral relations',
    'Offer trade concessions',
    'Join multilateral framework',
  ],
  'VC-08': [
    'Increase military funding',
    'Promote loyal officers',
    'Expand security services',
  ],
  'VC-09': [
    'Address public grievances',
    'Reduce inequality',
    'Allow limited reforms',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates all monitored loss conditions and produces graduated urgency
 * alerts for the Strategic Advisory panel.
 *
 * ### Monitored loss conditions
 *
 * | ID    | Name                  | Trigger                                                          |
 * |-------|-----------------------|------------------------------------------------------------------|
 * | VC-04 | Government Collapse   | Stability → 0 **OR** CivilUnrest → 100                          |
 * | VC-05 | Nuclear Winter        | NuclearThreshold → 100                                           |
 * | VC-06 | Isolation             | All tensions > 80 **AND** negative trade balance for 6 turns     |
 * | VC-08 | Coup d'État           | Military < 30 **AND** SecurityServices < 30                      |
 * | VC-09 | People's Revolution   | CivilUnrest → 100 (non-violent)                                  |
 *
 * @see FR-1404 — Loss Condition Early Warning System
 */
export class LossWarningEngine {
  /** Advisory configuration slice (immutable). */
  private readonly cfg: LossWarningConfig;

  /**
   * Create a new loss-warning engine.
   *
   * @param config - The full advisory configuration from
   *   {@link GAME_CONFIG.advisory}.
   *
   * @see FR-1404
   */
  constructor(config: LossWarningConfig) {
    this.cfg = config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Evaluate all five monitored loss conditions for a single faction.
   *
   * Computes distance-from-trigger, estimates turns until trigger, assigns
   * an urgency level, and (for critical alerts) attaches recommended
   * counter-actions.
   *
   * @param factionId  - The faction being evaluated.
   * @param turn       - The current turn number.
   * @param metrics    - Instantaneous metric snapshot.
   * @param trajectory - Per-turn deltas for projection.
   * @returns A {@link LossWarningAssessment} covering every monitored
   *   condition.
   *
   * @see FR-1404
   */
  evaluateLossConditions(
    factionId: FactionId,
    turn: TurnNumber,
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossWarningAssessment {
    const alerts: LossConditionStatus[] = [
      this.evaluateGovernmentCollapse(metrics, trajectory),
      this.evaluateNuclearWinter(metrics, trajectory),
      this.evaluateIsolation(metrics, trajectory),
      this.evaluateCoup(metrics, trajectory),
      this.evaluatePeoplesRevolution(metrics, trajectory),
    ];

    const minimumLossMargin = this.computeLossMargin(alerts);
    const hasCriticalAlert = alerts.some((a) => a.urgency === 'critical');

    return {
      factionId,
      turn,
      alerts,
      minimumLossMargin,
      hasCriticalAlert,
    };
  }

  /**
   * Compute the normalised distance of a metric from its loss-trigger value.
   *
   * - **Lower-bound** triggers (e.g. stability → 0): the distance is how
   *   far *above* zero the metric currently sits, normalised to [0, 1].
   * - **Upper-bound** triggers (e.g. civil unrest → 100): the distance is
   *   how far *below* 100 the metric currently sits, normalised to [0, 1].
   *
   * @param currentValue  - The current metric value.
   * @param triggerValue  - The threshold at which the loss fires (0 or 100).
   * @param isLowerBound  - `true` when the metric trends *down* toward the
   *   trigger (e.g. stability → 0).
   * @returns A value in [0, 1] where 0 = at trigger, 1 = maximum safety.
   *
   * @see FR-1404
   */
  computeDistanceFromTrigger(
    currentValue: number,
    _triggerValue: number,
    isLowerBound: boolean,
  ): number {
    const raw = isLowerBound
      ? currentValue / 100
      : (100 - currentValue) / 100;

    return clamp(raw, 0, 1);
  }

  /**
   * Project how many turns remain before a metric reaches its loss-trigger.
   *
   * The estimate is a simple linear projection: it divides the remaining
   * distance by the absolute per-turn delta.
   *
   * @param currentValue  - The current metric value.
   * @param triggerValue  - The threshold at which the loss fires.
   * @param deltaPerTurn  - Signed per-turn change of the metric.
   * @param isLowerBound  - `true` when the trigger is a lower bound
   *   (e.g. stability → 0).
   * @returns Estimated turns, `0` if already at/past trigger, or `null` if
   *   the metric is trending *away* from the trigger.
   *
   * @see FR-1404
   */
  estimateTurnsToTrigger(
    currentValue: number,
    triggerValue: number,
    deltaPerTurn: number,
    isLowerBound: boolean,
  ): number | null {
    // Already at or past the trigger.
    if (isLowerBound && currentValue <= triggerValue) {
      return 0;
    }
    if (!isLowerBound && currentValue >= triggerValue) {
      return 0;
    }

    if (isLowerBound) {
      // Approaching means delta is negative (value is falling toward 0).
      if (deltaPerTurn >= 0) {
        return null; // Trending away — no threat.
      }
      return Math.ceil(currentValue / Math.abs(deltaPerTurn));
    }

    // Upper-bound: approaching means delta is positive (value rising toward 100).
    if (deltaPerTurn <= 0) {
      return null; // Trending away — no threat.
    }
    return Math.ceil((triggerValue - currentValue) / deltaPerTurn);
  }

  /**
   * Map an estimated-turns value and distance-from-trigger into a graduated
   * urgency level.
   *
   * Uses the thresholds defined in
   * {@link GAME_CONFIG.advisory.lossWarning}.
   *
   * @param estimatedTurns      - Turns until trigger, or `null`.
   * @param distanceFromTrigger - Normalised distance [0, 1].
   * @returns An {@link UrgencyLevel}, or `null` if no alert is warranted.
   *
   * @see FR-1404
   */
  classifyUrgency(
    estimatedTurns: number | null,
    distanceFromTrigger: number,
  ): UrgencyLevel | null {
    // Not trending toward the trigger at all — no alert.
    if (estimatedTurns === null) {
      return null;
    }

    const { watch, warning, critical, criticalPercentage } =
      this.cfg.lossWarning;

    // Critical: within `critical` turns OR metric is within
    // `criticalPercentage` of the threshold.
    if (estimatedTurns <= critical || distanceFromTrigger <= criticalPercentage) {
      return 'critical';
    }

    // Warning: within `warning` turns.
    if (estimatedTurns <= warning) {
      return 'warning';
    }

    // Watch: within `watch` turns.
    if (estimatedTurns <= watch) {
      return 'watch';
    }

    // Outside all alert bands.
    return null;
  }

  /**
   * Look up recommended counter-actions for a loss condition.
   *
   * Counter-actions are only surfaced when the urgency level is
   * `'critical'`.  For lower urgency levels an empty array is returned.
   *
   * @param conditionId - The loss-condition identifier (e.g. `'VC-04'`).
   * @param urgency     - The urgency level of the alert.
   * @returns An array of human-readable counter-action strings.
   *
   * @see FR-1404
   */
  getCounterActions(conditionId: string, urgency: UrgencyLevel): string[] {
    if (urgency !== 'critical') {
      return [];
    }

    const actions = COUNTER_ACTIONS[conditionId];
    return actions ? [...actions] : [];
  }

  /**
   * Compute the composite loss margin across all evaluated conditions.
   *
   * The loss margin is the *minimum* {@link LossConditionStatus.distanceFromTrigger}
   * scaled to [0, 100].  A higher value indicates greater safety from all
   * loss conditions simultaneously.
   *
   * @param alerts - The array of condition statuses from this evaluation
   *   cycle.
   * @returns A value in [0, 100]; 100 when no alerts exist or all
   *   conditions are fully safe.
   *
   * @see FR-1404
   */
  computeLossMargin(alerts: readonly LossConditionStatus[]): number {
    if (alerts.length === 0) {
      return 100;
    }

    let min = 1;
    for (const alert of alerts) {
      if (alert.distanceFromTrigger < min) {
        min = alert.distanceFromTrigger;
      }
    }

    return clamp(min * 100, 0, 100);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private — per-condition evaluators
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * VC-04 Government Collapse
   *
   * Triggered when **Stability reaches 0** OR **CivilUnrest reaches 100**.
   * We evaluate both sub-conditions and report whichever is closer to
   * triggering.
   *
   * @see FR-1404
   */
  private evaluateGovernmentCollapse(
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossConditionStatus {
    const conditionId = 'VC-04';
    const name = 'Government Collapse';

    // Sub-condition A: stability → 0 (lower-bound).
    const distStability = this.computeDistanceFromTrigger(
      metrics.stability,
      0,
      true,
    );
    const turnsStability = this.estimateTurnsToTrigger(
      metrics.stability,
      0,
      trajectory.stabilityDelta,
      true,
    );

    // Sub-condition B: civilUnrest → 100 (upper-bound).
    const distUnrest = this.computeDistanceFromTrigger(
      metrics.civilUnrest,
      100,
      false,
    );
    const turnsUnrest = this.estimateTurnsToTrigger(
      metrics.civilUnrest,
      100,
      trajectory.civilUnrestDelta,
      false,
    );

    // Pick the sub-condition that is *closer* to triggering.
    const useStability = this.isCloser(distStability, turnsStability, distUnrest, turnsUnrest);

    const currentValue = useStability ? metrics.stability : metrics.civilUnrest;
    const triggerThreshold = useStability ? 0 : 100;
    const distanceFromTrigger = useStability ? distStability : distUnrest;
    const estimatedTurnsToTrigger = useStability ? turnsStability : turnsUnrest;

    const urgency = this.classifyUrgency(estimatedTurnsToTrigger, distanceFromTrigger);
    const counterActions = urgency !== null
      ? this.getCounterActions(conditionId, urgency)
      : [];

    return {
      conditionId,
      name,
      currentValue,
      triggerThreshold,
      distanceFromTrigger,
      estimatedTurnsToTrigger,
      urgency,
      counterActions,
    };
  }

  /**
   * VC-05 Nuclear Winter
   *
   * Triggered when any **NuclearThreshold reaches 100** (upper-bound).
   *
   * @see FR-1404
   */
  private evaluateNuclearWinter(
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossConditionStatus {
    const conditionId = 'VC-05';
    const name = 'Nuclear Winter';
    const triggerThreshold = 100;

    const distanceFromTrigger = this.computeDistanceFromTrigger(
      metrics.nuclearThreshold,
      triggerThreshold,
      false,
    );
    const estimatedTurnsToTrigger = this.estimateTurnsToTrigger(
      metrics.nuclearThreshold,
      triggerThreshold,
      trajectory.nuclearThresholdDelta,
      false,
    );

    const urgency = this.classifyUrgency(estimatedTurnsToTrigger, distanceFromTrigger);
    const counterActions = urgency !== null
      ? this.getCounterActions(conditionId, urgency)
      : [];

    return {
      conditionId,
      name,
      currentValue: metrics.nuclearThreshold,
      triggerThreshold,
      distanceFromTrigger,
      estimatedTurnsToTrigger,
      urgency,
      counterActions,
    };
  }

  /**
   * VC-06 Isolation
   *
   * Triggered when **all TensionLevels > 80** AND the **TradeBalance** has
   * been negative for **6 consecutive turns**.
   *
   * We approximate "all tensions > 80" via `averageTensionLevel` and model
   * the trade dimension as a turn-count approaching 6.
   *
   * @see FR-1404
   */
  private evaluateIsolation(
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossConditionStatus {
    const conditionId = 'VC-06';
    const name = 'Isolation';

    // Tension sub-condition: averageTensionLevel → 80+ (upper-bound at 80).
    const tensionTrigger = 80;
    const distTension = this.computeDistanceFromTrigger(
      metrics.averageTensionLevel,
      tensionTrigger,
      false,
    );
    const turnsTension = this.estimateTurnsToTrigger(
      metrics.averageTensionLevel,
      tensionTrigger,
      trajectory.tensionDelta,
      false,
    );

    // Trade sub-condition: negativeTradeTurns → 6 (upper-bound at 6).
    const distTrade = clamp(1 - metrics.negativeTradeTurns / 6, 0, 1);

    // For turns-to-trigger we can only project if trade turns increase each
    // turn (delta = 1 per turn while negative trade persists).  We cap at
    // remaining turns from the raw metric.
    const remainingTradeTurns = 6 - metrics.negativeTradeTurns;
    const turnsTrade = remainingTradeTurns > 0 ? remainingTradeTurns : 0;

    // Composite: take the *maximum* distance (both sub-conditions must be
    // met simultaneously, so the composite distance is the larger gap).
    // Turns estimate: use the *maximum* of both (both must converge).
    const distanceFromTrigger = Math.max(distTension, distTrade);
    const estimatedTurnsToTrigger = this.mergeEstimates(turnsTension, turnsTrade);

    const urgency = this.classifyUrgency(estimatedTurnsToTrigger, distanceFromTrigger);
    const counterActions = urgency !== null
      ? this.getCounterActions(conditionId, urgency)
      : [];

    return {
      conditionId,
      name,
      currentValue: metrics.averageTensionLevel,
      triggerThreshold: tensionTrigger,
      distanceFromTrigger,
      estimatedTurnsToTrigger,
      urgency,
      counterActions,
    };
  }

  /**
   * VC-08 Coup d'État
   *
   * Triggered when **Military < 30** AND **SecurityServices < 30** (both
   * lower-bound conditions that must be met simultaneously).
   *
   * @see FR-1404
   */
  private evaluateCoup(
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossConditionStatus {
    const conditionId = 'VC-08';
    const name = "Coup d'État";
    const triggerThreshold = 30;

    // Military sub-condition: militaryPowerBase → below 30 (lower-bound).
    const militaryAbove = Math.max(0, metrics.militaryPowerBase - triggerThreshold);
    const distMilitary = clamp(militaryAbove / 100, 0, 1);
    const turnsMilitary = this.estimateTurnsToLowerBound(
      metrics.militaryPowerBase,
      triggerThreshold,
      trajectory.militaryDelta,
    );

    // Security sub-condition: securityPowerBase → below 30 (lower-bound).
    const securityAbove = Math.max(0, metrics.securityPowerBase - triggerThreshold);
    const distSecurity = clamp(securityAbove / 100, 0, 1);
    const turnsSecurity = this.estimateTurnsToLowerBound(
      metrics.securityPowerBase,
      triggerThreshold,
      trajectory.securityDelta,
    );

    // Both sub-conditions must be met — use the *maximum* distance.
    const distanceFromTrigger = Math.max(distMilitary, distSecurity);
    const estimatedTurnsToTrigger = this.mergeEstimates(turnsMilitary, turnsSecurity);

    const urgency = this.classifyUrgency(estimatedTurnsToTrigger, distanceFromTrigger);
    const counterActions = urgency !== null
      ? this.getCounterActions(conditionId, urgency)
      : [];

    // Report the lower of the two current values as the "current value".
    const currentValue = Math.min(metrics.militaryPowerBase, metrics.securityPowerBase);

    return {
      conditionId,
      name,
      currentValue,
      triggerThreshold,
      distanceFromTrigger,
      estimatedTurnsToTrigger,
      urgency,
      counterActions,
    };
  }

  /**
   * VC-09 People's Revolution
   *
   * Triggered when **CivilUnrest reaches 100** (non-violent revolution).
   *
   * @see FR-1404
   */
  private evaluatePeoplesRevolution(
    metrics: LossMetricInput,
    trajectory: LossTrajectoryInput,
  ): LossConditionStatus {
    const conditionId = 'VC-09';
    const name = "People's Revolution";
    const triggerThreshold = 100;

    const distanceFromTrigger = this.computeDistanceFromTrigger(
      metrics.civilUnrest,
      triggerThreshold,
      false,
    );
    const estimatedTurnsToTrigger = this.estimateTurnsToTrigger(
      metrics.civilUnrest,
      triggerThreshold,
      trajectory.civilUnrestDelta,
      false,
    );

    const urgency = this.classifyUrgency(estimatedTurnsToTrigger, distanceFromTrigger);
    const counterActions = urgency !== null
      ? this.getCounterActions(conditionId, urgency)
      : [];

    return {
      conditionId,
      name,
      currentValue: metrics.civilUnrest,
      triggerThreshold,
      distanceFromTrigger,
      estimatedTurnsToTrigger,
      urgency,
      counterActions,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private — helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Determine which of two sub-conditions is closer to triggering.
   *
   * Prefers the sub-condition with a non-null turns estimate.  When both
   * are non-null, the lower turns wins.  Falls back to the smaller
   * distance.
   */
  private isCloser(
    distA: number,
    turnsA: number | null,
    distB: number,
    turnsB: number | null,
  ): boolean {
    if (turnsA !== null && turnsB !== null) {
      return turnsA <= turnsB;
    }
    if (turnsA !== null) {
      return true;
    }
    if (turnsB !== null) {
      return false;
    }
    // Neither is trending toward its trigger — compare raw distance.
    return distA <= distB;
  }

  /**
   * Estimate turns until a metric drops *below* a lower-bound threshold.
   *
   * Unlike the generic {@link estimateTurnsToTrigger} (which targets 0 or
   * 100), this targets an arbitrary threshold such as 30.
   *
   * @param currentValue  - Current metric value.
   * @param threshold     - The lower bound to breach.
   * @param deltaPerTurn  - Signed per-turn change.
   * @returns Estimated turns, `0` if already below threshold, or `null` if
   *   not trending toward the threshold.
   */
  private estimateTurnsToLowerBound(
    currentValue: number,
    threshold: number,
    deltaPerTurn: number,
  ): number | null {
    if (currentValue <= threshold) {
      return 0;
    }
    if (deltaPerTurn >= 0) {
      return null; // Trending away or stable.
    }
    const gap = currentValue - threshold;
    return Math.ceil(gap / Math.abs(deltaPerTurn));
  }

  /**
   * Merge two sub-condition turn estimates for a compound loss condition
   * where **both** sub-conditions must be satisfied simultaneously.
   *
   * If either sub-condition is trending away (`null`), the compound cannot
   * trigger, so we return `null`.  Otherwise we return the *maximum* of the
   * two estimates (the last sub-condition to converge gates the trigger).
   */
  private mergeEstimates(
    turnsA: number | null,
    turnsB: number | null,
  ): number | null {
    if (turnsA === null || turnsB === null) {
      return null;
    }
    return Math.max(turnsA, turnsB);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp a number to the inclusive range [`min`, `max`].
 *
 * @internal
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
