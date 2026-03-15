/**
 * Nuclear Strike Engine — Demonstration Strikes, Second-Strike Response,
 * Nuclear Winter, and Red Telephone De-escalation
 *
 * Pure functions — no side effects, no mutation of input, no Math.random.
 *
 * @see FR-504 — Demonstration Strike on remote military target
 * @see FR-505 — Automated second-strike response + Nuclear Winter game over
 * @see FR-507 — Red Telephone de-escalation
 */

import type { FactionId } from '@/data/types';
import type { NationState } from '@/data/types';
import type { NuclearFactionState } from './nuclear-escalation';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Nuclear strike configuration shape (derived from GAME_CONFIG.nuclear). */
export type NuclearStrikeConfig = typeof GAME_CONFIG.nuclear;

/** Eligibility check for a demonstration strike. */
export interface DemonstrationStrikeEligibility {
  eligible: boolean;
  reason: string;
  /** Whether the capital is threatened (boosted threshold). */
  capitalThreatened: boolean;
  /** Whether stability is below threshold. */
  stabilityBelowThreshold: boolean;
}

/** Result of executing a demonstration strike. @see FR-504 */
export interface DemonstrationStrikeResult {
  /** Faction that struck. */
  strikingFaction: FactionId;
  /** Target faction (remote military target). */
  targetFaction: FactionId;
  /** DI penalty applied to striker. */
  diPenalty: number;
  /** Stability penalty applied to target. */
  targetStabilityPenalty: number;
  /** Threshold increase for striker. */
  strikerThresholdIncrease: number;
  /** Global tension increase applied to all rivals. */
  globalTensionIncrease: number;
  /** Whether a second-strike response was triggered. */
  secondStrikeTriggered: boolean;
  /** Result of second strike (if triggered). */
  secondStrikeResult: SecondStrikeResult | null;
  /** Human-readable narrative. */
  description: string;
}

/** Result of a second-strike automated response. @see FR-505 */
export interface SecondStrikeResult {
  /** Faction performing the counter-strike. */
  respondingFaction: FactionId;
  /** Faction that initiated the first strike. */
  initiatingFaction: FactionId;
  /** Probability used for resolution. */
  counterStrikeProbability: number;
  /** The random roll (0–1). */
  roll: number;
  /** Whether the counter-strike fired. */
  counterStrikeFired: boolean;
  /** Whether Nuclear Winter was triggered. */
  nuclearWinterTriggered: boolean;
  /** Stability collapse applied (if exchange occurred). */
  stabilityCollapse: number;
  /** Description. */
  description: string;
}

/** Result of a Red Telephone de-escalation. @see FR-507 */
export interface RedTelephoneResult {
  /** Initiating faction. */
  initiatingFaction: FactionId;
  /** Target faction. */
  targetFaction: FactionId;
  /** DI cost paid by initiator. */
  diCostPaid: number;
  /** Threshold reduction for both nations. */
  thresholdReduction: number;
  /** Whether a trust discount was applied. */
  trustDiscountApplied: boolean;
  /** Whether the action was blocked (insufficient DI or trust). */
  blocked: boolean;
  /** Reason if blocked. */
  blockReason: string | null;
  /** Description. */
  description: string;
}

/** Red Telephone eligibility input. */
export interface RedTelephoneInput {
  initiatingFaction: FactionId;
  targetFaction: FactionId;
  /** Initiator's current DI. */
  initiatorDI: number;
  /** Trust level between the two leaders (from ChemistryTrustEngine). */
  trustLevel: number;
  /** Turn of last Red Telephone use between this pair (null if never used). */
  lastUsedTurn: number | null;
  /** Current turn. */
  currentTurn: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold Breach band lower bound. */
const THRESHOLD_BREACH_MIN = 71;

/** Trust level above which the high-trust DI discount applies. */
const HIGH_TRUST_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class NuclearStrikeEngine {
  private readonly cfg: NuclearStrikeConfig;

  constructor(config?: NuclearStrikeConfig) {
    this.cfg = config ?? GAME_CONFIG.nuclear;
  }

  // ── FR-504 — Demonstration Strike ──────────────────────────────────────

  /**
   * Check if a faction is eligible for a demonstration strike.
   *
   * Eligibility requires:
   * 1. Threshold is in the Breach band (>= 71)
   * 2. Capital is threatened OR stability < stabilityThreshold (15)
   *
   * @see FR-504
   */
  checkDemonstrationStrikeEligibility(
    nuclearState: NuclearFactionState,
    nationState: NationState,
    capitalThreatened: boolean,
  ): DemonstrationStrikeEligibility {
    const { stabilityThreshold } = this.cfg.demonstrationStrike;
    const inBreachBand = nuclearState.threshold >= THRESHOLD_BREACH_MIN;
    const stabilityBelowThreshold = nationState.stability < stabilityThreshold;

    if (!inBreachBand) {
      return {
        eligible: false,
        reason: `Nuclear threshold ${nuclearState.threshold} is below Threshold Breach band (>= ${THRESHOLD_BREACH_MIN}).`,
        capitalThreatened,
        stabilityBelowThreshold,
      };
    }

    if (!capitalThreatened && !stabilityBelowThreshold) {
      return {
        eligible: false,
        reason:
          'Threshold is in Breach band but neither capital is threatened nor stability is critically low.',
        capitalThreatened,
        stabilityBelowThreshold,
      };
    }

    const reasons: string[] = [];
    if (capitalThreatened) {
      reasons.push('capital is threatened');
    }
    if (stabilityBelowThreshold) {
      reasons.push(`stability (${nationState.stability}) is below threshold (${stabilityThreshold})`);
    }

    return {
      eligible: true,
      reason: `Demonstration strike authorized: ${reasons.join(' and ')}.`,
      capitalThreatened,
      stabilityBelowThreshold,
    };
  }

  /**
   * Execute a demonstration strike.
   *
   * Computes cascading consequences but does NOT mutate state.
   * If the target has second-strike capability, resolves automated response.
   *
   * @see FR-504
   */
  executeDemonstrationStrike(
    strikingFaction: FactionId,
    targetFaction: FactionId,
    targetNuclearState: NuclearFactionState,
    rng: SeededRandom,
  ): DemonstrationStrikeResult {
    const { diPenalty, targetStabilityPenalty, globalTensionIncrease, thresholdIncrease } =
      this.cfg.demonstrationStrike;

    // Determine if target can retaliate
    const targetHasSecondStrike = this.hasSecondStrikeCapability(targetNuclearState.factionId);
    let secondStrikeResult: SecondStrikeResult | null = null;
    let secondStrikeTriggered = false;

    if (targetHasSecondStrike) {
      secondStrikeResult = this.resolveSecondStrike(targetFaction, strikingFaction, rng);
      secondStrikeTriggered = true;
    }

    const narrativeParts: string[] = [
      `${strikingFaction} launched a demonstration strike against a remote military target in ${targetFaction}.`,
      `Diplomatic Influence: ${diPenalty}. Target stability: ${targetStabilityPenalty}. Global tension: +${globalTensionIncrease}.`,
      `Striker threshold increased by ${thresholdIncrease}.`,
    ];

    if (secondStrikeTriggered && secondStrikeResult) {
      narrativeParts.push(secondStrikeResult.description);
    }

    return {
      strikingFaction,
      targetFaction,
      diPenalty,
      targetStabilityPenalty,
      strikerThresholdIncrease: thresholdIncrease,
      globalTensionIncrease,
      secondStrikeTriggered,
      secondStrikeResult,
      description: narrativeParts.join(' '),
    };
  }

  // ── FR-505 — Second-Strike Automated Response ──────────────────────────

  /**
   * Check if a faction has second-strike capability.
   *
   * @see FR-505
   */
  hasSecondStrikeCapability(factionId: FactionId): boolean {
    return this.cfg.secondStrike.capableFactions.includes(factionId);
  }

  /**
   * Resolve second-strike automated response.
   *
   * Uses SeededRandom for the probability roll. If the counter-strike fires,
   * both nations suffer catastrophic stability collapse and Nuclear Winter
   * is triggered.
   *
   * @see FR-505
   */
  resolveSecondStrike(
    respondingFaction: FactionId,
    initiatingFaction: FactionId,
    rng: SeededRandom,
  ): SecondStrikeResult {
    const { counterStrikeProbability, exchangeStabilityCollapse } = this.cfg.secondStrike;
    const roll = rng.next();
    const counterStrikeFired = roll < counterStrikeProbability;

    if (counterStrikeFired) {
      return {
        respondingFaction,
        initiatingFaction,
        counterStrikeProbability,
        roll,
        counterStrikeFired: true,
        nuclearWinterTriggered: true,
        stabilityCollapse: exchangeStabilityCollapse,
        description:
          `${respondingFaction} second-strike systems activated (roll ${roll.toFixed(3)} < ${counterStrikeProbability}). ` +
          `Full nuclear exchange — stability collapse of ${exchangeStabilityCollapse} for both parties. Nuclear Winter triggered.`,
      };
    }

    return {
      respondingFaction,
      initiatingFaction,
      counterStrikeProbability,
      roll,
      counterStrikeFired: false,
      nuclearWinterTriggered: false,
      stabilityCollapse: 0,
      description:
        `${respondingFaction} second-strike systems did not fire (roll ${roll.toFixed(3)} >= ${counterStrikeProbability}). ` +
        'Catastrophe narrowly averted.',
    };
  }

  /**
   * Check if a nuclear exchange triggers Nuclear Winter.
   *
   * Nuclear Winter occurs when a counter-strike fired (both thresholds
   * reach the maximum of 100).
   *
   * @see FR-505
   */
  checkNuclearWinter(secondStrikeResult: SecondStrikeResult): boolean {
    return secondStrikeResult.counterStrikeFired;
  }

  // ── FR-507 — Red Telephone De-escalation ───────────────────────────────

  /**
   * Validate Red Telephone eligibility.
   *
   * Checks:
   * 1. Trust >= minimumTrust (20)
   * 2. Cooldown elapsed (cooldownTurns since last use)
   * 3. DI >= effective cost (discounted at high trust > 60)
   *
   * @see FR-507
   */
  validateRedTelephone(
    input: RedTelephoneInput,
  ): { eligible: boolean; reason: string; effectiveCost: number } {
    const { diCost, minimumTrust, highTrustDiscount, cooldownTurns } = this.cfg.redTelephone;

    // 1. Trust check
    if (input.trustLevel < minimumTrust) {
      return {
        eligible: false,
        reason: `Trust level (${input.trustLevel}) is below minimum (${minimumTrust}). Red Telephone unavailable.`,
        effectiveCost: diCost,
      };
    }

    // 2. Cooldown check
    if (input.lastUsedTurn !== null) {
      const turnsSinceLastUse = input.currentTurn - input.lastUsedTurn;
      if (turnsSinceLastUse < cooldownTurns) {
        const turnsRemaining = cooldownTurns - turnsSinceLastUse;
        return {
          eligible: false,
          reason: `Red Telephone is on cooldown. ${turnsRemaining} turn(s) remaining.`,
          effectiveCost: diCost,
        };
      }
    }

    // 3. Compute effective cost (high trust discount)
    const trustDiscountApplied = input.trustLevel > HIGH_TRUST_THRESHOLD;
    const effectiveCost = trustDiscountApplied ? diCost * highTrustDiscount : diCost;

    // 4. DI check
    if (input.initiatorDI < effectiveCost) {
      return {
        eligible: false,
        reason: `Insufficient Diplomatic Influence (${input.initiatorDI}) for Red Telephone cost (${effectiveCost}).`,
        effectiveCost,
      };
    }

    return {
      eligible: true,
      reason: trustDiscountApplied
        ? `Red Telephone available at discounted cost (${effectiveCost} DI, high trust).`
        : `Red Telephone available (${effectiveCost} DI).`,
      effectiveCost,
    };
  }

  /**
   * Execute Red Telephone de-escalation.
   *
   * Validates eligibility first. If blocked, returns a blocked result.
   * If valid, returns the threshold reduction for both nations and the
   * DI cost paid by the initiator.
   *
   * @see FR-507
   */
  executeRedTelephone(input: RedTelephoneInput): RedTelephoneResult {
    const validation = this.validateRedTelephone(input);

    if (!validation.eligible) {
      return {
        initiatingFaction: input.initiatingFaction,
        targetFaction: input.targetFaction,
        diCostPaid: 0,
        thresholdReduction: 0,
        trustDiscountApplied: false,
        blocked: true,
        blockReason: validation.reason,
        description: `Red Telephone blocked: ${validation.reason}`,
      };
    }

    const { thresholdReduction } = this.cfg.redTelephone;
    const trustDiscountApplied = input.trustLevel > HIGH_TRUST_THRESHOLD;

    return {
      initiatingFaction: input.initiatingFaction,
      targetFaction: input.targetFaction,
      diCostPaid: validation.effectiveCost,
      thresholdReduction,
      trustDiscountApplied,
      blocked: false,
      blockReason: null,
      description:
        `${input.initiatingFaction} activated Red Telephone with ${input.targetFaction}. ` +
        `Nuclear threshold reduced by ${thresholdReduction} for both nations. ` +
        `DI cost: ${validation.effectiveCost}${trustDiscountApplied ? ' (high-trust discount)' : ''}.`,
    };
  }
}
