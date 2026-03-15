/**
 * Secondary Sanctions & Cryptocurrency Evasion Engine — CNFL-1700
 *
 * Extends the financial-warfare subsystem with secondary-sanctions mechanics
 * and cryptocurrency / alternative-finance evasion infrastructure.
 *
 * **Secondary Sanctions (FR-1703):** A dominant economic power can threaten
 * third parties with sanctions for continuing to trade with a target. Third
 * parties may comply (breaking trade ties) or defy (spawning evasion
 * networks that degrade sanctions effectiveness over time).
 *
 * **Cryptocurrency & Alternative Finance (FR-1704):** A sanctioned nation
 * may invest turns and treasury to build a crypto-based evasion network
 * that permanently reduces sanctions effectiveness but introduces
 * corruption-driven civil unrest. The infrastructure is vulnerable to
 * CYBER disruption.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.financial`.
 *
 * @module secondary-sanctions
 * @see FR-1703 — Secondary Sanctions
 * @see FR-1704 — Cryptocurrency & Alternative Finance
 */

import { GAME_CONFIG } from '@/engine/config';
import { SecondarySanctionResponse } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.financial` section. */
export type SecondarySanctionsConfig = typeof GAME_CONFIG.financial;

// ---------------------------------------------------------------------------
// FR-1703 — Secondary Sanctions Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating whether a faction can impose secondary
 * sanctions on a third party and what the consequences are.
 *
 * @see FR-1703
 */
export interface SecondarySanctionInput {
  /** Faction imposing the secondary sanctions. */
  readonly imposerFaction: FactionId;
  /** Imposer's Diplomatic Influence score (0–100). */
  readonly imposerDI: number;
  /** Imposer's GDP share as a fraction of global GDP (0–1). */
  readonly imposerGDPShare: number;
  /** Faction that must choose whether to comply or defy. */
  readonly thirdPartyFaction: FactionId;
  /** The third party's response to the secondary-sanctions demand. */
  readonly thirdPartyResponse: SecondarySanctionResponse;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of a secondary-sanctions evaluation.
 *
 * @see FR-1703
 */
export interface SecondarySanctionResult {
  /** Whether the imposer meets the eligibility thresholds. */
  readonly eligible: boolean;
  /** Whether the third party chose to comply. */
  readonly thirdPartyCompliant: boolean;
  /** Legitimacy cost paid by the imposer (−5 when eligible, 0 otherwise). */
  readonly imposerLegitimacyCost: number;
  /** Whether the third party's defiance spawned an evasion network. */
  readonly evasionNetworkCreated: boolean;
  /** Per-network reduction in sanctions effectiveness (0–1). */
  readonly evasionEffectivenessReduction: number;
  /** Human-readable explanation of the evaluation outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1703 — Evasion Network Impact Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing the cumulative impact of evasion networks
 * on sanctions effectiveness.
 *
 * @see FR-1703
 */
export interface EvasionNetworkInput {
  /** Current sanctions effectiveness before evasion (0–1). */
  readonly currentSanctionsEffectiveness: number;
  /** Number of active evasion networks. */
  readonly evasionNetworkCount: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of evasion-network cumulative impact.
 *
 * @see FR-1703
 */
export interface EvasionNetworkResult {
  /** Sanctions effectiveness before evasion was applied. */
  readonly previousEffectiveness: number;
  /** Sanctions effectiveness after evasion reduction, floored at 0. */
  readonly reducedEffectiveness: number;
  /** Total reduction from all evasion networks (networkCount × 0.1). */
  readonly totalReduction: number;
  /** Human-readable explanation of the computation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1704 — Cryptocurrency & Alternative Finance Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating the state of a faction's cryptocurrency
 * evasion infrastructure.
 *
 * @see FR-1704
 */
export interface CryptoInfraInput {
  /** Faction building or operating the crypto infrastructure. */
  readonly factionId: FactionId;
  /** Number of turns invested in building the infrastructure (0+). */
  readonly turnsInvested: number;
  /** Whether the infrastructure has reached operational status. */
  readonly isOperational: boolean;
  /** Whether a CYBER attack has disrupted the infrastructure. */
  readonly isDisrupted: boolean;
  /** Remaining turns of disruption (0–2). */
  readonly disruptionTurnsRemaining: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of cryptocurrency infrastructure evaluation.
 *
 * @see FR-1704
 */
export interface CryptoInfraResult {
  /** Whether the infrastructure is currently operational. */
  readonly operational: boolean;
  /** Build progress as a fraction (0–1). */
  readonly buildProgress: number;
  /** Sanctions effectiveness reduction while operational (0–0.2). */
  readonly sanctionsReduction: number;
  /** Corruption-driven civil unrest per turn while operational. */
  readonly corruptionUnrestPerTurn: number;
  /** Treasury cost per turn while still under construction (≤ 0). */
  readonly buildCost: number;
  /** Whether the operational infrastructure can be disrupted by CYBER. */
  readonly vulnerable: boolean;
  /** Human-readable explanation of the infrastructure state. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1704 — Crypto Disruption Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing the result of a CYBER disruption attack
 * against a faction's cryptocurrency infrastructure.
 *
 * @see FR-1704
 */
export interface CryptoDisruptionInput {
  /** Faction whose crypto infrastructure was targeted. */
  readonly factionId: FactionId;
  /** Whether the infrastructure was operational before the attack. */
  readonly wasOperational: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of a CYBER disruption against crypto infrastructure.
 *
 * @see FR-1704
 */
export interface CryptoDisruptionResult {
  /** Whether the disruption succeeded (true if the infra was operational). */
  readonly disrupted: boolean;
  /** Sanctions reduction that was lost due to the disruption (0–0.2). */
  readonly sanctionsReductionLost: number;
  /** Number of turns the disruption lasts. */
  readonly disruptionDuration: number;
  /** Human-readable explanation of the disruption outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine for secondary-sanctions evaluation and cryptocurrency
 * evasion-infrastructure management.
 *
 * Every method is a pure function — the engine holds only a reference to
 * the immutable financial configuration section.
 *
 * @see FR-1703 — Secondary Sanctions
 * @see FR-1704 — Cryptocurrency & Alternative Finance
 */
export class SecondarySanctionsEngine {
  private readonly config: SecondarySanctionsConfig;

  constructor(config: SecondarySanctionsConfig) {
    this.config = config;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   *
   * @param value - The value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // ── FR-1703 — Secondary Sanctions ──────────────────────────────────────

  /**
   * Evaluate whether a faction can impose secondary sanctions on a third
   * party and determine the consequences of the third party's response.
   *
   * **Eligibility:** the imposer must meet *at least one* of:
   * - Diplomatic Influence ≥ `diThreshold` (default 70), **or**
   * - GDP share ≥ `gdpThreshold` (default 0.25).
   *
   * **If not eligible:** no effects are applied.
   *
   * **If eligible + Comply:** the third party complies, breaking trade
   * ties with the target. The imposer pays a legitimacy cost (−5).
   *
   * **If eligible + Defy:** the third party defies, spawning an evasion
   * network that reduces sanctions effectiveness by 0.1. The imposer
   * still pays the legitimacy cost.
   *
   * @param input - Secondary-sanctions evaluation parameters.
   * @returns The evaluation result with eligibility, compliance, and effects.
   *
   * @see FR-1703
   */
  evaluateSecondarySanction(
    input: SecondarySanctionInput,
  ): SecondarySanctionResult {
    const ss = this.config.secondarySanctions;

    const meetsInfluence = input.imposerDI >= ss.diThreshold;
    const meetsGDP = input.imposerGDPShare >= ss.gdpThreshold;
    const eligible = meetsInfluence || meetsGDP;

    if (!eligible) {
      return {
        eligible: false,
        thirdPartyCompliant: false,
        imposerLegitimacyCost: 0,
        evasionNetworkCreated: false,
        evasionEffectivenessReduction: 0,
        reason:
          `${input.imposerFaction} does not meet secondary-sanctions thresholds ` +
          `(DI ${input.imposerDI} < ${ss.diThreshold}, ` +
          `GDP share ${input.imposerGDPShare} < ${ss.gdpThreshold}). ` +
          `No secondary sanctions imposed on ${input.thirdPartyFaction} ` +
          `(turn ${input.currentTurn}).`,
      };
    }

    const qualificationParts: string[] = [];
    if (meetsInfluence) {
      qualificationParts.push(`DI ${input.imposerDI} ≥ ${ss.diThreshold}`);
    }
    if (meetsGDP) {
      qualificationParts.push(
        `GDP share ${input.imposerGDPShare} ≥ ${ss.gdpThreshold}`,
      );
    }
    const qualificationStr = qualificationParts.join('; ');

    switch (input.thirdPartyResponse) {
      case SecondarySanctionResponse.Comply: {
        return {
          eligible: true,
          thirdPartyCompliant: true,
          imposerLegitimacyCost: ss.legitimacyCost,
          evasionNetworkCreated: false,
          evasionEffectivenessReduction: 0,
          reason:
            `${input.imposerFaction} imposed secondary sanctions on ` +
            `${input.thirdPartyFaction} (${qualificationStr}). ` +
            `${input.thirdPartyFaction} chose to COMPLY — trade ties with ` +
            `the target are severed. Imposer legitimacy cost: ${ss.legitimacyCost} ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      case SecondarySanctionResponse.Defy: {
        return {
          eligible: true,
          thirdPartyCompliant: false,
          imposerLegitimacyCost: ss.legitimacyCost,
          evasionNetworkCreated: true,
          evasionEffectivenessReduction: ss.evasionNetworkEffectivenessReduction,
          reason:
            `${input.imposerFaction} imposed secondary sanctions on ` +
            `${input.thirdPartyFaction} (${qualificationStr}). ` +
            `${input.thirdPartyFaction} chose to DEFY — evasion network created, ` +
            `reducing sanctions effectiveness by ` +
            `${ss.evasionNetworkEffectivenessReduction}. ` +
            `Imposer legitimacy cost: ${ss.legitimacyCost} ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = input.thirdPartyResponse;
        throw new Error(
          `Unknown SecondarySanctionResponse: ${_exhaustive as string}`,
        );
      }
    }
  }

  // ── FR-1703 — Evasion Network Impact ───────────────────────────────────

  /**
   * Compute the cumulative impact of active evasion networks on overall
   * sanctions effectiveness.
   *
   * Each evasion network reduces sanctions effectiveness by 0.1 (10 %).
   * The reduced effectiveness is floored at 0.
   *
   * ```
   * reducedEffectiveness = max(0, currentEffectiveness − networkCount × 0.1)
   * ```
   *
   * @param input - Evasion-network impact parameters.
   * @returns The previous and reduced effectiveness with total reduction.
   *
   * @see FR-1703
   */
  computeEvasionNetworkImpact(
    input: EvasionNetworkInput,
  ): EvasionNetworkResult {
    const reductionPerNetwork =
      this.config.secondarySanctions.evasionNetworkEffectivenessReduction;
    const totalReduction = input.evasionNetworkCount * reductionPerNetwork;
    const reducedEffectiveness = SecondarySanctionsEngine.clamp(
      input.currentSanctionsEffectiveness - totalReduction,
      0,
      1,
    );

    return {
      previousEffectiveness: input.currentSanctionsEffectiveness,
      reducedEffectiveness,
      totalReduction,
      reason:
        `Evasion network impact computed on turn ${input.currentTurn}. ` +
        `${input.evasionNetworkCount} active network(s) × ` +
        `${reductionPerNetwork} reduction each = −${totalReduction.toFixed(2)} total. ` +
        `Sanctions effectiveness: ` +
        `${input.currentSanctionsEffectiveness.toFixed(2)} → ` +
        `${reducedEffectiveness.toFixed(2)}.`,
    };
  }

  // ── FR-1704 — Cryptocurrency Infrastructure ────────────────────────────

  /**
   * Evaluate the current state of a faction's cryptocurrency evasion
   * infrastructure.
   *
   * **Build phase:** costs `buildCost` (−10) treasury per turn for
   * `buildTurns` (3) turns. Progress is reported as a fraction 0–1.
   *
   * **Operational:** once built, reduces sanctions effectiveness by
   * `sanctionsReduction` (0.2) but introduces `corruptionUnrestPerTurn`
   * (3) civil-unrest points per turn. The infrastructure is vulnerable
   * to CYBER disruption.
   *
   * **Disrupted:** while disrupted by a CYBER attack, the infrastructure
   * is non-operational and provides no sanctions reduction.
   *
   * @param input - Crypto infrastructure evaluation parameters.
   * @returns The infrastructure state, costs, and effects.
   *
   * @see FR-1704
   */
  evaluateCryptoInfrastructure(
    input: CryptoInfraInput,
  ): CryptoInfraResult {
    const crypto = this.config.cryptoEvasion;

    const buildProgress = SecondarySanctionsEngine.clamp(
      input.turnsInvested / crypto.buildTurns,
      0,
      1,
    );
    const operational =
      input.turnsInvested >= crypto.buildTurns && !input.isDisrupted;
    const buildCost =
      input.turnsInvested < crypto.buildTurns ? crypto.buildCost : 0;
    const sanctionsReduction = operational ? crypto.sanctionsReduction : 0;
    const corruptionUnrestPerTurn = operational
      ? crypto.corruptionUnrestPerTurn
      : 0;
    const vulnerable = operational;

    let reason: string;

    if (input.isDisrupted) {
      reason =
        `${input.factionId} crypto infrastructure is DISRUPTED ` +
        `(${input.disruptionTurnsRemaining} turn(s) remaining). ` +
        `No sanctions reduction active. Build progress: ` +
        `${(buildProgress * 100).toFixed(4)}% ` +
        `(turn ${input.currentTurn}).`;
    } else if (operational) {
      reason =
        `${input.factionId} crypto infrastructure is OPERATIONAL. ` +
        `Sanctions reduced by ${crypto.sanctionsReduction * 100}%, ` +
        `corruption unrest: ${crypto.corruptionUnrestPerTurn}/turn. ` +
        `Vulnerable to CYBER disruption ` +
        `(turn ${input.currentTurn}).`;
    } else {
      reason =
        `${input.factionId} crypto infrastructure UNDER CONSTRUCTION — ` +
        `${input.turnsInvested}/${crypto.buildTurns} turns invested ` +
        `(${(buildProgress * 100).toFixed(4)}% complete). ` +
        `Build cost: ${crypto.buildCost}/turn ` +
        `(turn ${input.currentTurn}).`;
    }

    return {
      operational,
      buildProgress,
      sanctionsReduction,
      corruptionUnrestPerTurn,
      buildCost,
      vulnerable,
      reason,
    };
  }

  // ── FR-1704 — Crypto Disruption ────────────────────────────────────────

  /**
   * Compute the result of a CYBER disruption attack against a faction's
   * cryptocurrency evasion infrastructure.
   *
   * If the infrastructure was operational, it is taken offline for 2 turns
   * and the sanctions reduction it was providing (0.2) is lost for the
   * duration.
   *
   * If the infrastructure was not operational (still building or already
   * disrupted), the attack has no additional effect.
   *
   * @param input - Crypto disruption attack parameters.
   * @returns The disruption result with duration and lost effectiveness.
   *
   * @see FR-1704
   */
  computeCryptoDisruption(
    input: CryptoDisruptionInput,
  ): CryptoDisruptionResult {
    const crypto = this.config.cryptoEvasion;
    const disrupted = input.wasOperational;
    const sanctionsReductionLost = disrupted ? crypto.sanctionsReduction : 0;
    const disruptionDuration = 2;

    return {
      disrupted,
      sanctionsReductionLost,
      disruptionDuration,
      reason: disrupted
        ? `CYBER attack disrupted ${input.factionId}'s crypto infrastructure ` +
          `on turn ${input.currentTurn}. Sanctions reduction of ` +
          `${crypto.sanctionsReduction * 100}% lost for ` +
          `${disruptionDuration} turn(s).`
        : `CYBER attack against ${input.factionId}'s crypto infrastructure ` +
          `had no effect — infrastructure was not operational ` +
          `(turn ${input.currentTurn}).`,
    };
  }
}
