/**
 * Arms Bazaar and Failed State Exploitation Engine
 *
 * Evaluates black-market arms purchases for sanctioned and non-sanctioned
 * buyers, surplus weapon sales with leak risk, failed-state classification,
 * exploitation legitimacy effects, stabilization progress, and proxy spawn
 * timing in collapsed nations. All public methods are pure functions — no
 * mutations, no side effects. Every numeric result is clamped to its valid
 * range.
 *
 * @module arms-failedstate-engine
 * @see FR-2004 — Arms Bazaar: black-market pricing, surplus sales, weapon leaks
 * @see FR-2005 — Failed State Exploitation: classification, peacekeeping,
 *                stabilization, proxy spawning
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing arms bazaar and failed-state exploitation
 * mechanics. Alias for the `proxy` branch of {@link GAME_CONFIG}.
 *
 * @see FR-2004
 * @see FR-2005
 */
export type ArmsFailedStateConfig = typeof GAME_CONFIG.proxy;

// ─────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Input for computing the cost and risk profile of a black-market arms
 * purchase. Sanctioned buyers pay a price multiplier, suffer delivery
 * delays, and face defective-equipment risk.
 *
 * @see FR-2004
 */
export interface BlackMarketPurchaseInput {
  /** Faction attempting the purchase. */
  readonly buyerFaction: FactionId;
  /** Nominal unit price before any sanctions markup. */
  readonly basePrice: number;
  /** Whether the buying faction is currently under arms sanctions. */
  readonly isSanctioned: boolean;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for computing surplus-weapon sale revenue and the probability that
 * sold weapons leak to unintended third parties.
 *
 * @see FR-2004
 */
export interface SurplusSaleInput {
  /** Faction selling surplus equipment. */
  readonly sellerFaction: FactionId;
  /** Estimated market value of the surplus lot. */
  readonly baseValue: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating whether a target faction qualifies as a failed
 * state, unlocking reduced intel costs and accelerated proxy spawning.
 *
 * @see FR-2005
 */
export interface FailedStateInput {
  /** Faction whose stability is being assessed. */
  readonly targetFaction: FactionId;
  /** Current stability score of the target faction (0–100). */
  readonly targetStability: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for evaluating the legitimacy consequences of exploiting — or
 * peacekeeping within — a failed state.
 *
 * @see FR-2005
 */
export interface FailedStateExploitationInput {
  /** Faction intervening in the failed state. */
  readonly exploiterFaction: FactionId;
  /** Whether the intervention is framed as peacekeeping. */
  readonly isPeacekeeping: boolean;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for computing progress toward stabilizing a failed state through
 * sustained investment.
 *
 * @see FR-2005
 */
export interface StabilizationEffortInput {
  /** Faction investing in stabilization. */
  readonly stabilizingFaction: FactionId;
  /** Number of consecutive turns already invested. */
  readonly turnsInvested: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Input for determining whether the regular proxy-spawn cycle triggers
 * a new proxy group within a failed state.
 *
 * @see FR-2005
 */
export interface ProxySpawnCheckInput {
  /** Faction within whose territory the proxy may spawn. */
  readonly targetFaction: FactionId;
  /** Number of turns elapsed since the faction was classified as failed. */
  readonly turnsSinceFailed: number;
  /** The current game turn. */
  readonly currentTurn: TurnNumber;
}

// ─────────────────────────────────────────────────────────
// Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Result of a black-market arms purchase computation, including the
 * adjusted price, delivery delay, defective-equipment probability, and
 * a human-readable explanation.
 *
 * @see FR-2004
 */
export interface BlackMarketPurchaseResult {
  /** Final price the buyer must pay. */
  readonly finalPrice: number;
  /** Turns of delivery delay before equipment arrives. */
  readonly deliveryDelay: number;
  /** Probability (0–1) of receiving defective equipment. */
  readonly defectiveChance: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

/**
 * Result of a surplus-weapon sale computation, including net revenue,
 * leak probability, and a human-readable explanation.
 *
 * @see FR-2004
 */
export interface SurplusSaleResult {
  /** Revenue earned from the sale. */
  readonly saleRevenue: number;
  /** Probability (0–1) that weapons leak to unintended recipients. */
  readonly weaponLeakChance: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

/**
 * Result of a failed-state evaluation, indicating whether the target
 * qualifies as failed and the resulting intel / proxy-spawn modifiers.
 *
 * @see FR-2005
 */
export interface FailedStateResult {
  /** Whether the target faction is classified as a failed state. */
  readonly isFailed: boolean;
  /** Fractional reduction (0–1) applied to intel operation costs. */
  readonly intelCostReduction: number;
  /** Turns between automatic proxy spawns (0 = no spawning). */
  readonly proxySpawnRateTurns: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of a failed-state exploitation evaluation, indicating the net
 * legitimacy change for the intervening faction.
 *
 * @see FR-2005
 */
export interface FailedStateExploitationResult {
  /** Net legitimacy change applied to the exploiting faction. */
  readonly legitimacyChange: number;
  /** Human-readable explanation of the evaluation. */
  readonly reason: string;
}

/**
 * Result of a stabilization-effort computation, indicating whether the
 * effort is complete and how many turns remain.
 *
 * @see FR-2005
 */
export interface StabilizationEffortResult {
  /** Whether the stabilization effort has reached its required duration. */
  readonly complete: boolean;
  /** Turns remaining until stabilization completes (>= 0). */
  readonly turnsRemaining: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

/**
 * Result of a proxy-spawn check, indicating whether a new proxy group
 * emerges this turn within the failed state.
 *
 * @see FR-2005
 */
export interface ProxySpawnCheckResult {
  /** Whether a new proxy group spawns this turn. */
  readonly spawnsProxy: boolean;
  /** Human-readable explanation of the check. */
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that computes arms-bazaar transactions, failed-state
 * classification, exploitation legitimacy effects, stabilization progress,
 * and proxy-spawn timing.
 *
 * All public methods are **pure functions** — they accept immutable input
 * objects and return new result objects without mutating any state.
 *
 * @see FR-2004 — Arms Bazaar mechanics
 * @see FR-2005 — Failed State Exploitation mechanics
 */
export class ArmsFailedStateEngine {
  // ── Private configuration ────────────────────────────────

  /** Arms bazaar tuning knobs (sanctioned multiplier, delays, etc.). */
  private readonly armsBazaar: ArmsFailedStateConfig['armsBazaar'];

  /** Failed state classification thresholds and modifiers. */
  private readonly failedState: ArmsFailedStateConfig['failedState'];

  /** Failed state exploitation legitimacy and stabilization values. */
  private readonly failedStateExploitation: ArmsFailedStateConfig['failedStateExploitation'];

  // ── Constructor ──────────────────────────────────────────

  /**
   * Create a new engine instance, optionally overriding the default
   * configuration from {@link GAME_CONFIG.proxy}.
   *
   * @param config - Configuration object; defaults to `GAME_CONFIG.proxy`.
   * @see FR-2004
   * @see FR-2005
   */
  constructor(config: ArmsFailedStateConfig = GAME_CONFIG.proxy) {
    this.armsBazaar = config.armsBazaar;
    this.failedState = config.failedState;
    this.failedStateExploitation = config.failedStateExploitation;
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   *
   * @param value - The value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
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

  // ── Public pure methods ──────────────────────────────────

  /**
   * Compute the effective cost, delivery delay, and defective-equipment
   * probability for a black-market arms purchase.
   *
   * **Sanctioned buyers** pay `basePrice × sanctionedPriceMultiplier`,
   * suffer a `deliveryDelay`-turn wait, and face a `defectiveChance`
   * probability of receiving faulty gear.
   *
   * **Non-sanctioned buyers** pay the nominal base price with no delay
   * and no defective risk.
   *
   * @param input - Purchase parameters.
   * @returns A new {@link BlackMarketPurchaseResult} describing the
   *          transaction.
   *
   * @see FR-2004
   */
  public computeBlackMarketPurchase(
    input: BlackMarketPurchaseInput,
  ): BlackMarketPurchaseResult {
    const { buyerFaction, basePrice, isSanctioned, currentTurn } = input;
    const clampedBasePrice = ArmsFailedStateEngine.clamp(basePrice, 0, Number.MAX_SAFE_INTEGER);

    if (isSanctioned) {
      const finalPrice = clampedBasePrice * this.armsBazaar.sanctionedPriceMultiplier;
      const deliveryDelay = this.armsBazaar.deliveryDelay;
      const defectiveChance = this.armsBazaar.defectiveChance;

      const reason =
        'Faction ' + String(buyerFaction) +
        ' is sanctioned: price multiplied by ' +
        String(this.armsBazaar.sanctionedPriceMultiplier) +
        'x to ' + String(finalPrice) +
        ', delivery delayed by ' + String(deliveryDelay) +
        ' turn(s), defective chance ' +
        String(defectiveChance * 100) + '%' +
        ' (turn ' + String(currentTurn) + ').';

      return {
        finalPrice,
        deliveryDelay,
        defectiveChance,
        reason,
      };
    }

    const reason =
      'Faction ' + String(buyerFaction) +
      ' is not sanctioned: standard pricing at ' +
      String(clampedBasePrice) +
      ', no delivery delay, no defective risk' +
      ' (turn ' + String(currentTurn) + ').';

    return {
      finalPrice: clampedBasePrice,
      deliveryDelay: 0,
      defectiveChance: 0,
      reason,
    };
  }

  /**
   * Compute the revenue from selling surplus weapons and the probability
   * that those weapons leak to unintended third parties.
   *
   * Revenue equals `baseValue × surplusValue`. The leak chance is a
   * fixed probability drawn from configuration regardless of seller.
   *
   * @param input - Sale parameters.
   * @returns A new {@link SurplusSaleResult} describing the transaction.
   *
   * @see FR-2004
   */
  public computeSurplusSale(
    input: SurplusSaleInput,
  ): SurplusSaleResult {
    const { sellerFaction, baseValue, currentTurn } = input;
    const clampedBaseValue = ArmsFailedStateEngine.clamp(baseValue, 0, Number.MAX_SAFE_INTEGER);
    const saleRevenue = clampedBaseValue * this.armsBazaar.surplusValue;
    const weaponLeakChance = this.armsBazaar.weaponLeakChance;

    const reason =
      'Faction ' + String(sellerFaction) +
      ' sells surplus at ' + String(this.armsBazaar.surplusValue * 100) +
      '% value: revenue ' + String(saleRevenue) +
      ', weapon leak chance ' + String(weaponLeakChance * 100) + '%' +
      ' (turn ' + String(currentTurn) + ').';

    return {
      saleRevenue,
      weaponLeakChance,
      reason,
    };
  }

  /**
   * Evaluate whether a target faction qualifies as a **failed state**.
   *
   * A faction is considered failed when its stability score drops below
   * the configured `stabilityThreshold`. Failed states unlock reduced
   * intel-operation costs and periodic proxy-group spawns.
   *
   * @param input - Evaluation parameters.
   * @returns A new {@link FailedStateResult} with classification and
   *          modifiers.
   *
   * @see FR-2005
   */
  public evaluateFailedState(
    input: FailedStateInput,
  ): FailedStateResult {
    const { targetFaction, targetStability, currentTurn } = input;
    const clampedStability = ArmsFailedStateEngine.clamp(targetStability, 0, 100);
    const threshold = this.failedState.stabilityThreshold;
    const isFailed = clampedStability < threshold;

    if (isFailed) {
      const intelCostReduction = this.failedState.intelCostReduction;
      const proxySpawnRateTurns = this.failedState.proxySpawnRateTurns;

      const reason =
        'Faction ' + String(targetFaction) +
        ' stability ' + String(clampedStability) +
        ' < threshold ' + String(threshold) +
        ': classified as failed state. Intel cost reduced by ' +
        String(intelCostReduction * 100) + '%, proxy spawns every ' +
        String(proxySpawnRateTurns) + ' turn(s)' +
        ' (turn ' + String(currentTurn) + ').';

      return {
        isFailed,
        intelCostReduction,
        proxySpawnRateTurns,
        reason,
      };
    }

    const reason =
      'Faction ' + String(targetFaction) +
      ' stability ' + String(clampedStability) +
      ' >= threshold ' + String(threshold) +
      ': not a failed state. No intel discount, no proxy spawning' +
      ' (turn ' + String(currentTurn) + ').';

    return {
      isFailed,
      intelCostReduction: 0,
      proxySpawnRateTurns: 0,
      reason,
    };
  }

  /**
   * Evaluate the legitimacy consequences of intervening in a failed state.
   *
   * **Peacekeeping** operations grant a legitimacy bonus, reflecting
   * international approval of stabilizing efforts. **Exploitation**
   * (non-peacekeeping) operations impose a legitimacy penalty, as the
   * international community views the intervention as predatory.
   *
   * @param input - Exploitation parameters.
   * @returns A new {@link FailedStateExploitationResult} with the net
   *          legitimacy change.
   *
   * @see FR-2005
   */
  public evaluateFailedStateExploitation(
    input: FailedStateExploitationInput,
  ): FailedStateExploitationResult {
    const { exploiterFaction, isPeacekeeping, currentTurn } = input;

    if (isPeacekeeping) {
      const legitimacyChange = this.failedStateExploitation.peacekeepingLegitimacyBonus;

      const reason =
        'Faction ' + String(exploiterFaction) +
        ' conducts peacekeeping: legitimacy ' +
        (legitimacyChange >= 0 ? '+' : '') +
        String(legitimacyChange) +
        ' (turn ' + String(currentTurn) + ').';

      return {
        legitimacyChange,
        reason,
      };
    }

    const legitimacyChange = this.failedStateExploitation.exploitationLegitimacyPenalty;

    const reason =
      'Faction ' + String(exploiterFaction) +
      ' exploits failed state: legitimacy ' +
      String(legitimacyChange) +
      ' (turn ' + String(currentTurn) + ').';

    return {
      legitimacyChange,
      reason,
    };
  }

  /**
   * Compute whether a stabilization effort has reached its required
   * duration and how many turns remain.
   *
   * Stabilization requires `stabilizationTurns` consecutive turns of
   * investment. The effort is complete when `turnsInvested` meets or
   * exceeds that threshold.
   *
   * @param input - Stabilization parameters.
   * @returns A new {@link StabilizationEffortResult} with completion
   *          status and remaining turns.
   *
   * @see FR-2005
   */
  public computeStabilizationEffort(
    input: StabilizationEffortInput,
  ): StabilizationEffortResult {
    const { stabilizingFaction, turnsInvested, currentTurn } = input;
    const requiredTurns = this.failedStateExploitation.stabilizationTurns;
    const clampedInvested = ArmsFailedStateEngine.clamp(turnsInvested, 0, requiredTurns);
    const complete = clampedInvested >= requiredTurns;
    const turnsRemaining = ArmsFailedStateEngine.clamp(
      requiredTurns - clampedInvested,
      0,
      requiredTurns,
    );

    if (complete) {
      const reason =
        'Faction ' + String(stabilizingFaction) +
        ' has invested ' + String(clampedInvested) +
        '/' + String(requiredTurns) +
        ' turns: stabilization complete' +
        ' (turn ' + String(currentTurn) + ').';

      return {
        complete,
        turnsRemaining,
        reason,
      };
    }

    const reason =
      'Faction ' + String(stabilizingFaction) +
      ' has invested ' + String(clampedInvested) +
      '/' + String(requiredTurns) +
      ' turns: ' + String(turnsRemaining) +
      ' turn(s) remaining' +
      ' (turn ' + String(currentTurn) + ').';

    return {
      complete,
      turnsRemaining,
      reason,
    };
  }

  /**
   * Determine whether the periodic proxy-spawn cycle produces a new proxy
   * group within a failed state on the current turn.
   *
   * A proxy spawns when:
   * 1. `turnsSinceFailed` is greater than zero (at least one full turn
   *    has elapsed since the state was classified as failed), **and**
   * 2. `turnsSinceFailed` is evenly divisible by `proxySpawnRateTurns`.
   *
   * @param input - Spawn-check parameters.
   * @returns A new {@link ProxySpawnCheckResult} indicating whether a
   *          proxy spawns.
   *
   * @see FR-2005
   */
  public computeProxySpawnCheck(
    input: ProxySpawnCheckInput,
  ): ProxySpawnCheckResult {
    const { targetFaction, turnsSinceFailed, currentTurn } = input;
    const rate = this.failedState.proxySpawnRateTurns;
    const clampedTurns = ArmsFailedStateEngine.clamp(
      turnsSinceFailed,
      0,
      Number.MAX_SAFE_INTEGER,
    );

    const spawnsProxy = clampedTurns > 0 && clampedTurns % rate === 0;

    if (spawnsProxy) {
      const reason =
        'Faction ' + String(targetFaction) +
        ' failed for ' + String(clampedTurns) +
        ' turn(s) (rate: every ' + String(rate) +
        '): proxy group spawns this turn' +
        ' (turn ' + String(currentTurn) + ').';

      return {
        spawnsProxy,
        reason,
      };
    }

    const reason =
      'Faction ' + String(targetFaction) +
      ' failed for ' + String(clampedTurns) +
      ' turn(s) (rate: every ' + String(rate) +
      '): no proxy spawn this turn' +
      ' (turn ' + String(currentTurn) + ').';

    return {
      spawnsProxy,
      reason,
    };
  }
}
