/**
 * Discovery Engine — Grey Zone Action Discovery & Retaliation Evaluation
 *
 * Implements the discovery probability mechanics for grey-zone operations.
 * When a faction conducts covert actions (insurgency funding, maritime militia
 * blockades, cyber operations), there is a configurable chance of discovery
 * by the target nation. Discovery triggers diplomatic consequences: bilateral
 * tension spikes, legitimacy penalties for the aggressor, and a rally-around-
 * the-flag stability boost for the target.
 *
 * All public methods are **pure** — they return result objects rather than
 * mutating game state directly. The caller (turn engine) is responsible for
 * applying the deltas to {@link NationState} and bilateral relations.
 *
 * @module discovery-engine
 * @see CNFL-0702 — Discovery probability & retaliation implementation ticket
 * @see FR-404   — Discovery probability requirements
 */

import type { FactionId, TurnNumber } from '@/data/types';
import { GAME_CONFIG } from './config';
import type { SeededRandom } from './rng';

// ─────────────────────────────────────────────────────────
// Configuration Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing discovery probability mechanics.
 * Alias for the `greyZone.discovery` branch of {@link GAME_CONFIG}.
 *
 * @see FR-404
 */
export type DiscoveryConfig = typeof GAME_CONFIG.greyZone.discovery;

// ─────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────

/**
 * Classification of grey-zone action types.
 * Each type carries a different severity multiplier for discovery consequences.
 *
 * @see FR-404
 */
export type GreyZoneActionType = 'insurgency' | 'blockade' | 'cyberOp';

/**
 * Describes a single grey-zone action submitted for discovery evaluation.
 *
 * @see FR-404
 */
export interface GreyZoneAction {
  /** Faction conducting the covert action. */
  readonly actorFaction: FactionId;
  /** Faction targeted by the covert action. */
  readonly targetFaction: FactionId;
  /** Classification of the grey-zone operation. */
  readonly actionType: GreyZoneActionType;
  /** Actor's covert operations capability score (0–100). */
  readonly actorCovert: number;
  /** Target's counter-intelligence rating (0–100). */
  readonly targetCounterIntel: number;
  /**
   * Optional per-action base chance override.
   * When omitted, the global `config.baseChance` is used.
   */
  readonly actionBaseChance?: number;
}

/**
 * Quantified consequences of a discovered grey-zone action.
 *
 * All values are deltas to be applied by the turn engine.
 *
 * @see FR-404
 */
export interface DiscoveryConsequences {
  /** Bilateral tension delta (positive = increased tension). */
  readonly tensionDelta: number;
  /** Actor legitimacy delta (negative = penalty). */
  readonly legitimacyDelta: number;
  /** Target stability delta (positive = rally-around-flag boost). */
  readonly targetStabilityDelta: number;
}

/**
 * Full result of evaluating discovery for a single grey-zone action.
 *
 * @see FR-404
 */
export interface DiscoveryResult {
  /** The action that was evaluated. */
  readonly action: GreyZoneAction;
  /** Computed discovery probability (0–1). */
  readonly discoveryChance: number;
  /** Whether the action was discovered by the target. */
  readonly discovered: boolean;
  /** Consequence deltas (zeroed when not discovered). */
  readonly consequences: DiscoveryConsequences;
  /** Turn on which this evaluation occurred. */
  readonly turn: TurnNumber;
  /** Signal for the AI system to evaluate retaliatory actions. */
  readonly shouldRetaliate: boolean;
}

/**
 * Aggregated results of processing all grey-zone actions for a single turn.
 *
 * @see FR-404
 */
export interface TurnDiscoveryResult {
  /** All individual discovery results for the turn. */
  readonly results: readonly DiscoveryResult[];
  /** Subset of results where the action was discovered. */
  readonly discovered: readonly DiscoveryResult[];
  /** Subset of results where the action remained covert. */
  readonly undiscovered: readonly DiscoveryResult[];
  /**
   * Aggregated bilateral tension deltas keyed by `"actorId→targetId"`.
   * Only contains entries with non-zero deltas.
   */
  readonly aggregateTensionDeltas: Record<string, number>;
  /**
   * Aggregated legitimacy deltas keyed by actor faction ID.
   * Only contains entries with non-zero deltas.
   */
  readonly aggregateLegitimacyDeltas: Record<string, number>;
  /**
   * Aggregated stability deltas keyed by target faction ID.
   * Only contains entries with non-zero deltas.
   */
  readonly aggregateStabilityDeltas: Record<string, number>;
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/**
 * Severity multipliers per action type.
 * Modulates the base consequence values from config.
 *
 * - **insurgency**: ×1.0 — baseline severity.
 * - **blockade**: ×0.8 — more deniable as "civilian fishing activity".
 * - **cyberOp**: ×1.2 — seen as aggressive, especially against critical infra.
 *
 * @see FR-404
 */
const SEVERITY_MULTIPLIERS: Readonly<Record<GreyZoneActionType, number>> = {
  insurgency: 1.0,
  blockade: 0.8,
  cyberOp: 1.2,
} as const;

/**
 * Bilateral tension threshold above which the AI system should evaluate
 * retaliatory actions following a discovery event.
 *
 * @see FR-404
 */
const RETALIATION_TENSION_THRESHOLD = 50;

/**
 * Modifier applied to the target's counter-intelligence score when
 * computing discovery probability.
 *
 * @see FR-404
 */
const TARGET_COUNTER_INTEL_MODIFIER = 0.003;

/** Zero-value consequences returned for undiscovered actions. */
const ZERO_CONSEQUENCES: DiscoveryConsequences = {
  tensionDelta: 0,
  legitimacyDelta: 0,
  targetStabilityDelta: 0,
} as const;

// ─────────────────────────────────────────────────────────
// Discovery Engine
// ─────────────────────────────────────────────────────────

/**
 * Evaluates discovery probability and consequences for grey-zone operations.
 *
 * The engine is stateless — all randomness is delegated to an injected
 * {@link SeededRandom} instance for full determinism (NFR-402).
 *
 * ### Workflow
 * 1. Per action: calculate discovery chance → roll → compute consequences.
 * 2. Per turn: process all actions → aggregate bilateral deltas.
 * 3. Signal retaliation when bilateral tension exceeds threshold.
 *
 * @see CNFL-0702
 * @see FR-404
 */
export class DiscoveryEngine {
  /** Discovery configuration constants. @see FR-404 */
  private readonly config: DiscoveryConfig;

  /** Seeded PRNG for deterministic discovery rolls. @see NFR-402 */
  private readonly rng: SeededRandom;

  /**
   * Create a new DiscoveryEngine.
   *
   * @param config — Discovery probability configuration constants.
   * @param rng    — Seeded PRNG instance shared with the simulation.
   *
   * @see FR-404
   */
  constructor(config: DiscoveryConfig, rng: SeededRandom) {
    this.config = config;
    this.rng = rng;
  }

  // ── Core Probability ─────────────────────────────────

  /**
   * Calculate the probability of a grey-zone action being discovered.
   *
   * **Formula:**
   * ```
   * discoveryChance = (actionBaseChance ?? config.baseChance)
   *                 + (100 - actorCovert) × config.covertModifier
   *                 + targetCounterIntel  × TARGET_COUNTER_INTEL_MODIFIER
   * ```
   *
   * Higher actor COVERT score → lower discovery chance.
   * Higher target counter-intelligence → higher discovery chance.
   * Result is clamped to [0, 1].
   *
   * @param actorCovert       — Actor's covert ops capability (0–100).
   * @param targetCounterIntel — Target's counter-intelligence rating (0–100).
   * @param actionBaseChance   — Optional per-action base chance override.
   * @returns Discovery probability in the range [0, 1].
   *
   * @see FR-404
   */
  calculateDiscoveryChance(
    actorCovert: number,
    targetCounterIntel: number,
    actionBaseChance?: number,
  ): number {
    const base = actionBaseChance ?? this.config.baseChance;
    const covertPenalty = (100 - actorCovert) * this.config.covertModifier;
    const counterIntelBonus = targetCounterIntel * TARGET_COUNTER_INTEL_MODIFIER;

    const raw = base + covertPenalty + counterIntelBonus;

    return Math.max(0, Math.min(1, raw));
  }

  // ── Discovery Roll ───────────────────────────────────

  /**
   * Roll the PRNG to determine whether a grey-zone action is discovered.
   *
   * @param discoveryChance — Probability of discovery (0–1).
   * @returns `true` if the action is discovered, `false` otherwise.
   *
   * @see FR-404
   * @see NFR-402
   */
  rollDiscovery(discoveryChance: number): boolean {
    return this.rng.nextFloat(0, 1) < discoveryChance;
  }

  // ── Consequence Computation ──────────────────────────

  /**
   * Compute the diplomatic consequences for a discovered grey-zone action.
   *
   * Base values are pulled from config and scaled by the action type's
   * severity multiplier:
   *
   * | Action Type  | Multiplier | Rationale                              |
   * |-------------|------------|----------------------------------------|
   * | insurgency  | ×1.0       | Baseline severity                      |
   * | blockade    | ×0.8       | More deniable as civilian activity      |
   * | cyberOp     | ×1.2       | Aggressive, critical infrastructure risk|
   *
   * @param actionType — The type of grey-zone action that was discovered.
   * @returns Consequence deltas to be applied by the turn engine.
   *
   * @see FR-404
   */
  computeConsequences(actionType: GreyZoneActionType): DiscoveryConsequences {
    const multiplier = SEVERITY_MULTIPLIERS[actionType];

    return {
      tensionDelta: Math.round(
        this.config.tensionSpikeOnDiscovery * multiplier,
      ),
      legitimacyDelta: Math.round(
        this.config.legitimacyPenaltyOnDiscovery * multiplier,
      ),
      targetStabilityDelta: Math.round(
        this.config.targetStabilityBoostOnDiscovery * multiplier,
      ),
    };
  }

  // ── Single-Action Evaluation ─────────────────────────

  /**
   * Evaluate discovery for a single grey-zone action.
   *
   * Combines probability calculation, PRNG roll, and consequence computation
   * into a single atomic result. If the action is not discovered, all
   * consequence deltas are zero.
   *
   * @param actorFaction       — Faction conducting the covert action.
   * @param targetFaction      — Faction targeted by the action.
   * @param actorCovert        — Actor's covert ops capability (0–100).
   * @param targetCounterIntel — Target's counter-intelligence rating (0–100).
   * @param actionType         — Classification of the grey-zone operation.
   * @param currentTurn        — Current simulation turn number.
   * @param actionBaseChance   — Optional per-action base chance override.
   * @returns Full discovery evaluation result.
   *
   * @see FR-404
   */
  evaluateDiscovery(
    actorFaction: FactionId,
    targetFaction: FactionId,
    actorCovert: number,
    targetCounterIntel: number,
    actionType: GreyZoneActionType,
    currentTurn: TurnNumber,
    actionBaseChance?: number,
  ): DiscoveryResult {
    const discoveryChance = this.calculateDiscoveryChance(
      actorCovert,
      targetCounterIntel,
      actionBaseChance,
    );

    const discovered = this.rollDiscovery(discoveryChance);

    const consequences = discovered
      ? this.computeConsequences(actionType)
      : ZERO_CONSEQUENCES;

    const action: GreyZoneAction = {
      actorFaction,
      targetFaction,
      actionType,
      actorCovert,
      targetCounterIntel,
      actionBaseChance,
    };

    const shouldRetaliate = discovered
      ? this.shouldRetaliateOnDiscovery(consequences.tensionDelta)
      : false;

    return {
      action,
      discoveryChance,
      discovered,
      consequences,
      turn: currentTurn,
      shouldRetaliate,
    };
  }

  // ── Turn-Level Batch Processing ──────────────────────

  /**
   * Process all grey-zone actions for a single turn.
   *
   * Rolls discovery for each action, partitions results into discovered
   * and undiscovered buckets, and aggregates consequence deltas per
   * bilateral pair (tension), per actor (legitimacy), and per target
   * (stability).
   *
   * @param actions     — Array of grey-zone actions to evaluate.
   * @param currentTurn — Current simulation turn number.
   * @returns Aggregated turn-level discovery results.
   *
   * @see FR-404
   */
  processDiscoveriesForTurn(
    actions: readonly GreyZoneAction[],
    currentTurn: TurnNumber,
  ): TurnDiscoveryResult {
    const results: DiscoveryResult[] = [];
    const discoveredResults: DiscoveryResult[] = [];
    const undiscoveredResults: DiscoveryResult[] = [];

    const tensionDeltas: Record<string, number> = {};
    const legitimacyDeltas: Record<string, number> = {};
    const stabilityDeltas: Record<string, number> = {};

    for (const action of actions) {
      const result = this.evaluateDiscovery(
        action.actorFaction,
        action.targetFaction,
        action.actorCovert,
        action.targetCounterIntel,
        action.actionType,
        currentTurn,
        action.actionBaseChance,
      );

      results.push(result);

      if (result.discovered) {
        discoveredResults.push(result);

        // Aggregate tension deltas per bilateral pair
        const pairKey = `${action.actorFaction as string}→${action.targetFaction as string}`;
        tensionDeltas[pairKey] =
          (tensionDeltas[pairKey] ?? 0) + result.consequences.tensionDelta;

        // Aggregate legitimacy deltas per actor
        const actorKey = action.actorFaction as string;
        legitimacyDeltas[actorKey] =
          (legitimacyDeltas[actorKey] ?? 0) + result.consequences.legitimacyDelta;

        // Aggregate stability deltas per target
        const targetKey = action.targetFaction as string;
        stabilityDeltas[targetKey] =
          (stabilityDeltas[targetKey] ?? 0) + result.consequences.targetStabilityDelta;
      } else {
        undiscoveredResults.push(result);
      }
    }

    return {
      results,
      discovered: discoveredResults,
      undiscovered: undiscoveredResults,
      aggregateTensionDeltas: tensionDeltas,
      aggregateLegitimacyDeltas: legitimacyDeltas,
      aggregateStabilityDeltas: stabilityDeltas,
    };
  }

  // ── Retaliation Signal ───────────────────────────────

  /**
   * Determine whether the AI system should evaluate retaliatory actions
   * following a discovery event.
   *
   * Simple threshold check: if bilateral tension exceeds
   * {@link RETALIATION_TENSION_THRESHOLD} after the spike, retaliation
   * is deemed likely and the AI subsystem is signalled.
   *
   * @param tensionAfterSpike — Bilateral tension value after the discovery
   *                            tension spike has been applied.
   * @returns `true` if retaliation should be evaluated.
   *
   * @see FR-404
   */
  shouldRetaliateOnDiscovery(tensionAfterSpike: number): boolean {
    return tensionAfterSpike > RETALIATION_TENSION_THRESHOLD;
  }
}
