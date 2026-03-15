/**
 * @module CognitiveBias
 * @description Cognitive Bias system for New Order.
 *
 * Implements FR-1504 / DR-120: Each leader carries 2–4 cognitive biases drawn
 * from a registry of 10 bias types. Each bias has a **type**, an **intensity**
 * (0–100), and a **trigger** condition. When the trigger fires during a turn,
 * the bias distorts the leader's utility calculation — boosting certain options
 * and penalising others in ways that reflect real-world psychological effects.
 *
 * Supported bias types:
 *
 * | Bias                      | Trigger                        | Effect                         |
 * |---------------------------|--------------------------------|--------------------------------|
 * | SunkCost                  | N turns invested in strategy   | Bonus to continuing strategy   |
 * | ConfirmationBias          | Intel conflicts with belief    | Bonus to aligned intel weight  |
 * | Groupthink                | Dominant faction score ≥ 80    | Bonus to faction-aligned opts  |
 * | Anchoring                 | First major event of the game  | Bonus to first event weight    |
 * | LossAversion              | Recently lost a position       | Defensive weight multiplier    |
 * | Optimism                  | Leader confidence > 75         | Risk under-estimate            |
 * | AvailabilityHeuristic     | Recent dramatic event (≤ 3 t)  | Threat bonus for recent events |
 * | DunningKruger             | Intel clarity < threshold      | Overconfidence bonus           |
 * | Recency                   | Last interaction was negative  | Bonus to recent event weight   |
 * | EscalationOfCommitment    | Nuclear threshold ≥ trigger    | Penalty to de-escalation       |
 *
 * All functions are **pure** — no mutation of inputs, no side effects.
 *
 * @see FR-1504
 * @see DR-120
 */

import type { LeaderId, LeaderBiasAssignment } from '@/data/types';
import { BiasType } from '@/data/types';
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
// Types & Interfaces
// ---------------------------------------------------------------------------

/**
 * Configuration shape for the psychology sub-system, derived from
 * `GAME_CONFIG.psychology`. This ensures the engine stays in sync with
 * whatever the central config declares.
 *
 * @see FR-1504
 * @see DR-120
 */
export type CognitiveBiasConfig = typeof GAME_CONFIG.psychology;

/**
 * Context snapshot provided by the turn engine when evaluating whether a
 * leader's cognitive biases trigger. Each field corresponds to one or more
 * bias trigger conditions.
 *
 * @see FR-1504
 * @see DR-120
 */
export interface BiasContext {
  /** Number of consecutive turns the leader has pursued the same strategy. */
  readonly turnsInvestedInCurrentStrategy: number;
  /** Whether the latest intelligence report contradicts the leader's beliefs. */
  readonly intelligenceConflictsWithBelief: boolean;
  /** Highest power-base sub-score among the leader's domestic factions. */
  readonly dominantFactionScore: number;
  /** Whether this is the first major event the leader has encountered. */
  readonly isFirstMajorEvent: boolean;
  /** Whether the leader recently lost a territorial or strategic position. */
  readonly recentlyLostPosition: boolean;
  /** The leader's current self-assessed confidence (0–100). */
  readonly leaderConfidence: number;
  /** Turns elapsed since the last dramatic / crisis event. */
  readonly turnsSinceLastDramaticEvent: number;
  /** Intelligence clarity score on the primary target (0–100). */
  readonly intelligenceClarity: number;
  /** Whether the most recent diplomatic interaction was negative. */
  readonly lastInteractionNegative: boolean;
  /** Current nuclear escalation threshold (0–100). */
  readonly nuclearThreshold: number;
  /** The current turn number. */
  readonly currentTurn: number;
}

/**
 * Result of checking whether a single bias type triggers in the current
 * context. Includes a human-readable reason for logging / briefing.
 *
 * @see FR-1504
 * @see DR-120
 */
export interface BiasTriggerResult {
  /** The bias type that was evaluated. */
  readonly biasType: BiasType;
  /** Whether the trigger condition was met. */
  readonly triggered: boolean;
  /** Human-readable explanation of why the bias did or did not trigger. */
  readonly reason: string;
}

/**
 * A single distortion to apply additively to a utility score. Produced only
 * for biases whose trigger fired.
 *
 * @see FR-1504
 * @see DR-120
 */
export interface BiasDistortion {
  /** The bias type producing this distortion. */
  readonly biasType: BiasType;
  /** The intensity of the bias assignment (0–100). */
  readonly intensity: number;
  /** Additive change to utility. Positive = boost, negative = penalty. */
  readonly distortionDelta: number;
  /** Human-readable description of what this distortion represents. */
  readonly description: string;
}

/**
 * Full evaluation result for all of a leader's bias assignments in a single
 * turn. Contains both the individual trigger checks and the resulting
 * distortions, plus an aggregate total.
 *
 * @see FR-1504
 * @see DR-120
 */
export interface BiasEvaluationResult {
  /** The leader whose biases were evaluated. */
  readonly leaderId: LeaderId;
  /** Trigger results for every assigned bias (triggered or not). */
  readonly triggeredBiases: readonly BiasTriggerResult[];
  /** Distortions for biases that actually triggered. */
  readonly distortions: readonly BiasDistortion[];
  /** Sum of all `distortionDelta` values. */
  readonly totalDistortion: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Pure engine that evaluates cognitive biases for leaders during utility
 * calculation. Each leader carries 2–4 {@link LeaderBiasAssignment} entries;
 * this engine checks their triggers against a {@link BiasContext} and
 * computes the resulting {@link BiasDistortion} values.
 *
 * Instantiate with the psychology section of the game config and call
 * {@link evaluateBiases} once per leader per turn.
 *
 * @see FR-1504
 * @see DR-120
 */
export class CognitiveBiasEngine {
  private readonly config: CognitiveBiasConfig;

  /**
   * Create a new CognitiveBiasEngine.
   *
   * @param config - The psychology configuration block from `GAME_CONFIG`.
   */
  constructor(config: CognitiveBiasConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Evaluate all of a leader's bias assignments against the current context.
   *
   * For each {@link LeaderBiasAssignment}:
   * 1. Check whether the trigger fires via {@link checkBiasTrigger}.
   * 2. If triggered, compute the distortion via {@link computeDistortion}.
   * 3. Aggregate every distortion into a total additive delta.
   *
   * @param leaderId    - Branded leader identifier.
   * @param assignments - The leader's 2–4 bias assignments.
   * @param context     - Current-turn context snapshot.
   * @returns A complete {@link BiasEvaluationResult}.
   *
   * @see FR-1504
   * @see DR-120
   */
  evaluateBiases(
    leaderId: LeaderId,
    assignments: readonly LeaderBiasAssignment[],
    context: BiasContext,
  ): BiasEvaluationResult {
    const triggerResults: BiasTriggerResult[] = [];
    const distortions: BiasDistortion[] = [];

    for (const assignment of assignments) {
      const triggerResult = this.checkBiasTrigger(assignment.biasType, context);
      triggerResults.push(triggerResult);

      if (triggerResult.triggered) {
        const clampedIntensity = clamp(assignment.intensity, 0, 100);
        const distortion = this.computeDistortion(
          assignment.biasType,
          clampedIntensity,
        );
        distortions.push(distortion);
      }
    }

    const totalDistortion = distortions.reduce(
      (sum, d) => sum + d.distortionDelta,
      0,
    );

    return {
      leaderId,
      triggeredBiases: triggerResults,
      distortions,
      totalDistortion,
    };
  }

  /**
   * Check whether a single bias type's trigger condition is met.
   *
   * Each bias maps to a specific field (or combination of fields) on
   * {@link BiasContext}. The thresholds are drawn from `GAME_CONFIG`.
   *
   * | BiasType                 | Trigger condition                                       |
   * |--------------------------|---------------------------------------------------------|
   * | SunkCost                 | `turnsInvestedInCurrentStrategy ≥ triggerTurns` (3)     |
   * | ConfirmationBias         | `intelligenceConflictsWithBelief === true`              |
   * | Groupthink               | `dominantFactionScore ≥ 80`                             |
   * | Anchoring                | `isFirstMajorEvent === true`                            |
   * | LossAversion             | `recentlyLostPosition === true`                         |
   * | Optimism                 | `leaderConfidence > 75`                                 |
   * | AvailabilityHeuristic    | `turnsSinceLastDramaticEvent ≤ recencyWindow` (3)       |
   * | DunningKruger            | `intelligenceClarity < competenceThreshold` (30)        |
   * | Recency                  | `lastInteractionNegative === true`                      |
   * | EscalationOfCommitment   | `nuclearThreshold ≥ nuclearThresholdTrigger` (50)       |
   *
   * @param biasType - The bias to evaluate.
   * @param context  - Current-turn context snapshot.
   * @returns A {@link BiasTriggerResult} indicating whether the bias fired.
   *
   * @see FR-1504
   * @see DR-120
   */
  checkBiasTrigger(biasType: BiasType, context: BiasContext): BiasTriggerResult {
    const { cognitiveBiases } = this.config;

    switch (biasType) {
      case BiasType.SunkCost: {
        const threshold = cognitiveBiases.sunkCost.triggerTurns;
        const triggered = context.turnsInvestedInCurrentStrategy >= threshold;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Leader has invested ${context.turnsInvestedInCurrentStrategy} turns in current strategy (threshold: ${threshold})`
            : `Leader has only invested ${context.turnsInvestedInCurrentStrategy} turns (need ${threshold} to trigger)`,
        };
      }

      case BiasType.ConfirmationBias: {
        const triggered = context.intelligenceConflictsWithBelief;
        return {
          biasType,
          triggered,
          reason: triggered
            ? 'Intelligence conflicts with leader beliefs — confirmation bias distorts assessment'
            : 'Intelligence is consistent with leader beliefs — no confirmation bias',
        };
      }

      case BiasType.Groupthink: {
        const threshold = 80;
        const triggered = context.dominantFactionScore >= threshold;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Dominant faction score ${context.dominantFactionScore} ≥ ${threshold} — groupthink active`
            : `Dominant faction score ${context.dominantFactionScore} < ${threshold} — groupthink not triggered`,
        };
      }

      case BiasType.Anchoring: {
        const triggered = context.isFirstMajorEvent;
        return {
          biasType,
          triggered,
          reason: triggered
            ? 'First major event encountered — anchoring bias weights initial assessment'
            : 'Not the first major event — anchoring bias dormant',
        };
      }

      case BiasType.LossAversion: {
        const triggered = context.recentlyLostPosition;
        return {
          biasType,
          triggered,
          reason: triggered
            ? 'Leader recently lost a position — loss aversion amplifies defensive options'
            : 'No recent position loss — loss aversion dormant',
        };
      }

      case BiasType.Optimism: {
        const threshold = 75;
        const triggered = context.leaderConfidence > threshold;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Leader confidence ${context.leaderConfidence} > ${threshold} — optimism bias underestimates risk`
            : `Leader confidence ${context.leaderConfidence} ≤ ${threshold} — optimism bias dormant`,
        };
      }

      case BiasType.AvailabilityHeuristic: {
        const window = cognitiveBiases.availabilityHeuristic.recencyWindow;
        const triggered = context.turnsSinceLastDramaticEvent <= window;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Dramatic event ${context.turnsSinceLastDramaticEvent} turns ago (within ${window}-turn window) — availability heuristic active`
            : `Last dramatic event was ${context.turnsSinceLastDramaticEvent} turns ago (outside ${window}-turn window) — availability heuristic dormant`,
        };
      }

      case BiasType.DunningKruger: {
        const threshold = cognitiveBiases.dunningKruger.competenceThreshold;
        const triggered = context.intelligenceClarity < threshold;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Intelligence clarity ${context.intelligenceClarity} < ${threshold} — Dunning-Kruger overconfidence active`
            : `Intelligence clarity ${context.intelligenceClarity} ≥ ${threshold} — Dunning-Kruger not triggered`,
        };
      }

      case BiasType.Recency: {
        const triggered = context.lastInteractionNegative;
        return {
          biasType,
          triggered,
          reason: triggered
            ? 'Last interaction was negative — recency bias overweights recent hostility'
            : 'Last interaction was not negative — recency bias dormant',
        };
      }

      case BiasType.EscalationOfCommitment: {
        const threshold = cognitiveBiases.escalationOfCommitment.nuclearThresholdTrigger;
        const triggered = context.nuclearThreshold >= threshold;
        return {
          biasType,
          triggered,
          reason: triggered
            ? `Nuclear threshold ${context.nuclearThreshold} ≥ ${threshold} — escalation of commitment penalises de-escalation`
            : `Nuclear threshold ${context.nuclearThreshold} < ${threshold} — escalation of commitment dormant`,
        };
      }
    }
  }

  /**
   * Compute the utility distortion for a single triggered bias.
   *
   * The distortion delta is calculated as:
   *
   *   `delta = configWeight × (intensity / 100)`
   *
   * where `configWeight` is the relevant value from `GAME_CONFIG`:
   *
   * | BiasType                 | Config weight                              | Sign |
   * |--------------------------|--------------------------------------------|------|
   * | SunkCost                 | `continuingWeightBonus` (0.30)             | +    |
   * | ConfirmationBias         | `alignedIntelWeightBonus` (0.25)           | +    |
   * | Groupthink               | `factionAlignedBonus` (0.20)               | +    |
   * | Anchoring                | `firstEventWeightBonus` (0.25)             | +    |
   * | LossAversion             | `defensiveWeightMultiplier − 1` (1.00)     | +    |
   * | Optimism                 | `riskUnderestimate` (0.20)                 | +    |
   * | AvailabilityHeuristic    | `recentEventThreatBonus` (0.40)            | +    |
   * | DunningKruger            | `overconfidenceBonus` (0.15)               | +    |
   * | Recency                  | `recentWeightBonus` (0.20)                 | +    |
   * | EscalationOfCommitment   | `deescalationPenalty` (−0.25)              | −    |
   *
   * @param biasType  - The triggered bias type.
   * @param intensity - The bias intensity (0–100), already clamped by caller.
   * @returns A {@link BiasDistortion} with the computed delta.
   *
   * @see FR-1504
   * @see DR-120
   */
  computeDistortion(biasType: BiasType, intensity: number): BiasDistortion {
    const { cognitiveBiases } = this.config;
    const normalisedIntensity = clamp(intensity, 0, 100) / 100;

    switch (biasType) {
      case BiasType.SunkCost: {
        const weight = cognitiveBiases.sunkCost.continuingWeightBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Sunk cost bias adds +${(weight * normalisedIntensity).toFixed(3)} to continuation options`,
        };
      }

      case BiasType.ConfirmationBias: {
        const weight = cognitiveBiases.confirmationBias.alignedIntelWeightBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Confirmation bias adds +${(weight * normalisedIntensity).toFixed(3)} to belief-aligned intelligence`,
        };
      }

      case BiasType.Groupthink: {
        const weight = cognitiveBiases.groupthink.factionAlignedBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Groupthink adds +${(weight * normalisedIntensity).toFixed(3)} to faction-aligned options`,
        };
      }

      case BiasType.Anchoring: {
        const weight = cognitiveBiases.anchoring.firstEventWeightBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Anchoring bias adds +${(weight * normalisedIntensity).toFixed(3)} to first-event assessment`,
        };
      }

      case BiasType.LossAversion: {
        const weight = cognitiveBiases.lossAversion.defensiveWeightMultiplier - 1;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Loss aversion adds +${(weight * normalisedIntensity).toFixed(3)} to defensive option utility`,
        };
      }

      case BiasType.Optimism: {
        const weight = cognitiveBiases.optimism.riskUnderestimate;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Optimism bias adds +${(weight * normalisedIntensity).toFixed(3)} by underestimating risk`,
        };
      }

      case BiasType.AvailabilityHeuristic: {
        const weight = cognitiveBiases.availabilityHeuristic.recentEventThreatBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Availability heuristic adds +${(weight * normalisedIntensity).toFixed(3)} to recent-event threat`,
        };
      }

      case BiasType.DunningKruger: {
        const weight = cognitiveBiases.dunningKruger.overconfidenceBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Dunning-Kruger adds +${(weight * normalisedIntensity).toFixed(3)} overconfidence to assessment`,
        };
      }

      case BiasType.Recency: {
        const weight = cognitiveBiases.recency.recentWeightBonus;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Recency bias adds +${(weight * normalisedIntensity).toFixed(3)} to recent-event weight`,
        };
      }

      case BiasType.EscalationOfCommitment: {
        const weight = cognitiveBiases.escalationOfCommitment.deescalationPenalty;
        return {
          biasType,
          intensity,
          distortionDelta: weight * normalisedIntensity,
          description: `Escalation of commitment applies ${(weight * normalisedIntensity).toFixed(3)} penalty to de-escalation`,
        };
      }
    }
  }
}
