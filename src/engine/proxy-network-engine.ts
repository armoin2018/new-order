/**
 * Proxy Network Graph and Operations Engine
 *
 * Evaluates proxy network discovery probabilities, consequences of exposure,
 * proxy operation effects (Activate, Arm, PoliticalCampaign), and arming
 * deltas. All public methods are pure functions — no mutations, no side
 * effects. Every numeric result is clamped to its valid range.
 *
 * @module proxy-network-engine
 * @see FR-2001 — Proxy discovery probability and consequences
 * @see FR-2002 — Proxy operation evaluation and arming effects
 */

import { GAME_CONFIG } from '@/engine/config';
import { ProxyOperationType } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing proxy network mechanics.
 * Alias for the `proxy` branch of {@link GAME_CONFIG}.
 *
 * @see FR-2001
 * @see FR-2002
 */
export type ProxyConfig = typeof GAME_CONFIG.proxy;

// ─────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Input for computing discovery probability of a proxy network.
 *
 * @see FR-2001
 */
export interface DiscoveryProbabilityInput {
  /** Current deniability score of the proxy operation (0–100). */
  readonly deniability: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating the consequences of a proxy network being discovered.
 *
 * @see FR-2001
 */
export interface DiscoveryConsequencesInput {
  /** Faction that sponsored the proxy network. */
  readonly sponsorFaction: FactionId;
  /** Faction that discovered the proxy network. */
  readonly discoveredByFaction: FactionId;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating a proxy operation (Activate, Arm, or PoliticalCampaign).
 *
 * @see FR-2002
 */
export interface ProxyOperationInput {
  /** Faction sponsoring the proxy operation. */
  readonly sponsorFaction: FactionId;
  /** Faction targeted by the proxy operation. */
  readonly targetFaction: FactionId;
  /** The type of proxy operation being conducted. */
  readonly operationType: ProxyOperationType;
  /** Current capability score of the proxy group (0–100). */
  readonly proxyCapability: number;
  /** Current deniability score of the proxy operation (0–100). */
  readonly proxyDeniability: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for computing the effects of arming a proxy group.
 *
 * @see FR-2002
 */
export interface ArmingEffectsInput {
  /** Faction sponsoring the arming operation. */
  readonly sponsorFaction: FactionId;
  /** Current capability score of the proxy group (0–100). */
  readonly currentCapability: number;
  /** Current deniability score of the proxy operation (0–100). */
  readonly currentDeniability: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

// ─────────────────────────────────────────────────────────
// Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Result of computing the discovery probability for a proxy network.
 *
 * @see FR-2001
 */
export interface DiscoveryProbabilityResult {
  /** Probability of discovery in range [0, 1]. */
  readonly probability: number;
  /** Human-readable explanation of the calculation. */
  readonly reason: string;
}

/**
 * Result of evaluating the consequences of a proxy network being discovered.
 *
 * @see FR-2001
 */
export interface DiscoveryConsequencesResult {
  /** Bilateral tension increase applied between sponsor and discoverer. */
  readonly tensionIncrease: number;
  /** Legitimacy penalty applied to the sponsoring faction. */
  readonly legitimacyPenalty: number;
  /** Human-readable explanation of the consequences. */
  readonly reason: string;
}

/**
 * Comprehensive result of evaluating a proxy operation across all operation
 * types. Fields not relevant to the given operation type are set to 0.
 *
 * @see FR-2002
 */
export interface ProxyOperationResult {
  /** The type of operation that was evaluated. */
  readonly operationType: ProxyOperationType;
  /** Effect scaling factor based on proxy capability (Activate only). */
  readonly effectScaling: number;
  /** Discovery probability in range [0, 1] (Activate only). */
  readonly discoveryProbability: number;
  /** Capability boost applied to the proxy group. */
  readonly capabilityBoost: number;
  /** Deniability reduction applied to the proxy operation. */
  readonly deniabilityReduction: number;
  /** Treasury cost imposed on the sponsoring faction. */
  readonly treasuryCost: number;
  /** Civil unrest increase in the target nation (PoliticalCampaign only). */
  readonly targetCivilUnrestIncrease: number;
  /** Diplomatic influence cost (PoliticalCampaign only). */
  readonly diCost: number;
  /** Human-readable explanation of the operation effects. */
  readonly reason: string;
}

/**
 * Result of computing the arming effects on a proxy group.
 *
 * @see FR-2002
 */
export interface ArmingEffectsResult {
  /** New capability score after arming, clamped to [0, 100]. */
  readonly newCapability: number;
  /** New deniability score after arming, clamped to [0, 100]. */
  readonly newDeniability: number;
  /** Treasury cost imposed on the sponsoring faction. */
  readonly treasuryCost: number;
  /** Human-readable explanation of the arming effects. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────

/**
 * Pure-function engine for proxy network graph and operations.
 *
 * Computes discovery probabilities, evaluates discovery consequences,
 * determines proxy operation outcomes, and calculates arming deltas.
 * All public methods return new result objects — no mutations, no side
 * effects.
 *
 * @see FR-2001 — Proxy discovery probability and consequences
 * @see FR-2002 — Proxy operation evaluation and arming effects
 */
export class ProxyNetworkEngine {
  /** Proxy configuration values used by all calculations. */
  private readonly config: ProxyConfig;

  /**
   * Create a new ProxyNetworkEngine.
   *
   * @param config - Proxy configuration values. Defaults to
   *   `GAME_CONFIG.proxy`.
   * @see FR-2001
   * @see FR-2002
   */
  constructor(config: ProxyConfig = GAME_CONFIG.proxy) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   *
   * @param value - The value to clamp.
   * @param min   - Minimum allowed value.
   * @param max   - Maximum allowed value.
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  // ───────────────────────────────────────────────────────
  // Public Methods
  // ───────────────────────────────────────────────────────

  /**
   * Compute the probability that a proxy network is discovered this turn.
   *
   * Formula: `clamp((base - deniability) / 100, 0, 1)` where `base` comes
   * from `config.discovery.base` (default 100).
   *
   * - At deniability = 100 the probability is 0 (perfectly hidden).
   * - At deniability = 0 the probability is 1 (certain discovery).
   *
   * @param input - Discovery probability parameters.
   * @returns The discovery probability and explanatory reason.
   * @see FR-2001
   */
  computeDiscoveryProbability(
    input: DiscoveryProbabilityInput,
  ): DiscoveryProbabilityResult {
    const base = this.config.discovery.base;
    const raw = (base - input.deniability) / 100;
    const probability = ProxyNetworkEngine.clamp(raw, 0, 1);

    const reason =
      'Discovery probability = clamp((' +
      String(base) +
      ' - ' +
      String(input.deniability) +
      ') / 100, 0, 1) = ' +
      String(probability) +
      ' on turn ' +
      String(input.currentTurn) +
      '.';

    return { probability, reason };
  }

  /**
   * Evaluate the diplomatic consequences when a proxy network is discovered.
   *
   * Returns the fixed tension increase and legitimacy penalty drawn from the
   * discovery configuration.
   *
   * @param input - Discovery consequences parameters.
   * @returns Tension increase, legitimacy penalty, and explanatory reason.
   * @see FR-2001
   */
  evaluateDiscoveryConsequences(
    input: DiscoveryConsequencesInput,
  ): DiscoveryConsequencesResult {
    const tensionIncrease = this.config.discovery.tensionIncrease;
    const legitimacyPenalty = this.config.discovery.legitimacyPenalty;

    const reason =
      'Proxy network sponsored by ' +
      String(input.sponsorFaction) +
      ' discovered by ' +
      String(input.discoveredByFaction) +
      ' on turn ' +
      String(input.currentTurn) +
      ': tension +' +
      String(tensionIncrease) +
      ', legitimacy ' +
      String(legitimacyPenalty) +
      '.';

    return { tensionIncrease, legitimacyPenalty, reason };
  }

  /**
   * Evaluate a proxy operation and return its full set of effects.
   *
   * Dispatches on {@link ProxyOperationType} with an exhaustive switch:
   *
   * - **Activate** — scales effects by proxy capability, computes discovery
   *   probability from deniability. Deniability reduction is 0 (handled
   *   elsewhere by the deniability engine).
   * - **Arm** — boosts capability, reduces deniability, costs treasury.
   * - **PoliticalCampaign** — increases target civil unrest, costs DI,
   *   reduces deniability.
   *
   * Fields not relevant to a given operation type are set to 0.
   *
   * @param input - Proxy operation parameters.
   * @returns Comprehensive operation result.
   * @see FR-2002
   */
  evaluateProxyOperation(
    input: ProxyOperationInput,
  ): ProxyOperationResult {
    const opType: ProxyOperationType = input.operationType;

    switch (opType) {
      case ProxyOperationType.Activate: {
        const effectScaling = input.proxyCapability / 100;
        const discoveryRaw = (100 - input.proxyDeniability) / 100;
        const discoveryProbability = ProxyNetworkEngine.clamp(
          discoveryRaw,
          0,
          1,
        );

        const reason =
          'Activate proxy by ' +
          String(input.sponsorFaction) +
          ' against ' +
          String(input.targetFaction) +
          ' on turn ' +
          String(input.currentTurn) +
          ': effectScaling=' +
          String(effectScaling) +
          ', discoveryProbability=' +
          String(discoveryProbability) +
          '.';

        return {
          operationType: opType,
          effectScaling,
          discoveryProbability,
          capabilityBoost: 0,
          deniabilityReduction: 0,
          treasuryCost: 0,
          targetCivilUnrestIncrease: 0,
          diCost: 0,
          reason,
        };
      }

      case ProxyOperationType.Arm: {
        const capabilityBoost = this.config.arming.capabilityBoost;
        const deniabilityReduction = this.config.arming.deniabilityReduction;
        const treasuryCost = this.config.arming.treasuryCost;

        const reason =
          'Arm proxy by ' +
          String(input.sponsorFaction) +
          ' against ' +
          String(input.targetFaction) +
          ' on turn ' +
          String(input.currentTurn) +
          ': capabilityBoost=' +
          String(capabilityBoost) +
          ', deniabilityReduction=' +
          String(deniabilityReduction) +
          ', treasuryCost=' +
          String(treasuryCost) +
          '.';

        return {
          operationType: opType,
          effectScaling: 0,
          discoveryProbability: 0,
          capabilityBoost,
          deniabilityReduction,
          treasuryCost,
          targetCivilUnrestIncrease: 0,
          diCost: 0,
          reason,
        };
      }

      case ProxyOperationType.PoliticalCampaign: {
        const targetCivilUnrestIncrease =
          this.config.politicalCampaign.civilUnrestIncrease;
        const diCost = this.config.politicalCampaign.diCost;
        const deniabilityReduction =
          this.config.politicalCampaign.deniabilityReduction;

        const reason =
          'PoliticalCampaign proxy by ' +
          String(input.sponsorFaction) +
          ' against ' +
          String(input.targetFaction) +
          ' on turn ' +
          String(input.currentTurn) +
          ': civilUnrestIncrease=' +
          String(targetCivilUnrestIncrease) +
          ', diCost=' +
          String(diCost) +
          ', deniabilityReduction=' +
          String(deniabilityReduction) +
          '.';

        return {
          operationType: opType,
          effectScaling: 0,
          discoveryProbability: 0,
          capabilityBoost: 0,
          deniabilityReduction,
          treasuryCost: 0,
          targetCivilUnrestIncrease,
          diCost,
          reason,
        };
      }

      default: {
        const _exhaustive: never = opType;
        return _exhaustive;
      }
    }
  }

  /**
   * Compute the effects of arming a proxy group.
   *
   * Applies the configured capability boost and deniability reduction,
   * clamping both values to [0, 100]. Returns the resulting scores and the
   * treasury cost.
   *
   * @param input - Arming effects parameters.
   * @returns New capability, new deniability, treasury cost, and reason.
   * @see FR-2002
   */
  computeArmingEffects(
    input: ArmingEffectsInput,
  ): ArmingEffectsResult {
    const boost = this.config.arming.capabilityBoost;
    const reduction = this.config.arming.deniabilityReduction;
    const treasuryCost = this.config.arming.treasuryCost;

    const newCapability = ProxyNetworkEngine.clamp(
      input.currentCapability + boost,
      0,
      100,
    );
    const newDeniability = ProxyNetworkEngine.clamp(
      input.currentDeniability + reduction,
      0,
      100,
    );

    const reason =
      'Arming proxy for ' +
      String(input.sponsorFaction) +
      ' on turn ' +
      String(input.currentTurn) +
      ': capability ' +
      String(input.currentCapability) +
      ' -> ' +
      String(newCapability) +
      ' (+' +
      String(boost) +
      '), deniability ' +
      String(input.currentDeniability) +
      ' -> ' +
      String(newDeniability) +
      ' (' +
      String(reduction) +
      '), treasuryCost=' +
      String(treasuryCost) +
      '.';

    return { newCapability, newDeniability, treasuryCost, reason };
  }
}
