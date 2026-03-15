/**
 * Sanctions & SWIFT Disconnection Engine — CNFL-1700
 *
 * Implements the financial-warfare sanctions subsystem for the simulation.
 * Covers SWIFT payment-network disconnection, tiered economic sanctions
 * (targeted / sectoral / comprehensive), and sanctions-fatigue modelling.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.financial`.
 *
 * @module sanctions-engine
 * @see FR-1701 — SWIFT Disconnection
 * @see FR-1702 — Tiered Sanctions
 */

import { GAME_CONFIG } from '@/engine/config';
import { SanctionTier } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.financial` section. */
export type SanctionsConfig = typeof GAME_CONFIG.financial;

// ---------------------------------------------------------------------------
// FR-1701 — SWIFT Disconnection Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating whether a SWIFT disconnection is eligible
 * and what its economic effects would be.
 *
 * @see FR-1701
 */
export interface SwiftDisconnectionInput {
  /** Imposer's Diplomatic Influence score (0–100). */
  readonly imposerDI: number;
  /** Coalition GDP share as a fraction of global GDP (0–1). */
  readonly coalitionGDPShare: number;
  /** Faction ID of the nation being targeted for disconnection. */
  readonly targetFactionId: FactionId;
  /** Number of turns the target has already been disconnected. */
  readonly turnsDisconnected: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of a SWIFT disconnection evaluation.
 *
 * @see FR-1701
 */
export interface SwiftDisconnectionResult {
  /** Whether the imposer meets the threshold to disconnect. */
  readonly eligible: boolean;
  /** Trade-income reduction applied to the target (≤ 0). */
  readonly targetTradeReduction: number;
  /** Per-turn GDP decay applied to the target (≤ 0). */
  readonly targetGDPDecay: number;
  /**
   * Effectiveness of the target's alternative payment systems (0–1).
   * Grows each turn the target remains disconnected.
   */
  readonly altPaymentEffectiveness: number;
  /** Human-readable explanation of the evaluation outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1702 — Tiered Sanctions Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for applying a specific sanction tier against a target.
 *
 * @see FR-1702
 */
export interface SanctionTierInput {
  /** Faction imposing the sanctions. */
  readonly imposerFaction: FactionId;
  /** Faction being sanctioned. */
  readonly targetFaction: FactionId;
  /** Severity tier of the sanctions. */
  readonly tier: SanctionTier;
  /** Number of economic sectors sanctioned (1–5, relevant for Sectoral). */
  readonly sectorCount: number;
  /** Number of turns the sanctions have been active. */
  readonly turnsActive: number;
  /** Accumulated sanctions fatigue (0–1). */
  readonly fatigueDecay: number;
  /** Whether the target is considered a weak state (Legitimacy check). */
  readonly targetIsWeak: boolean;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of applying a sanction tier.
 *
 * @see FR-1702
 */
export interface SanctionTierResult {
  /** The sanction tier that was evaluated. */
  readonly tier: SanctionTier;
  /** Economic effects imposed on the target faction. */
  readonly targetEffects: {
    readonly gdpDecay: number;
    readonly treasuryHit: number;
    readonly oligarchsHit: number;
    readonly civilUnrestPerTurn: number;
  };
  /** Costs / blowback suffered by the imposing faction. */
  readonly imposerEffects: {
    readonly diCost: number;
    readonly ownTradeReduction: number;
    readonly legitimacyCost: number;
  };
  /**
   * Multiplier applied to target effects based on sanctions fatigue.
   * Equal to `1 − fatigueDecay`, clamped to [0, 1].
   */
  readonly effectivenessMultiplier: number;
  /** Human-readable explanation of the sanction impact. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1702 — Sanctions Fatigue Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for computing sanctions-fatigue growth.
 *
 * @see FR-1702
 */
export interface SanctionsFatigueInput {
  /** Current accumulated fatigue (0–1). */
  readonly currentFatigue: number;
  /** Number of turns the sanctions have been active. */
  readonly turnsActive: number;
  /** Number of evasion networks the target has built. */
  readonly evasionNetworkCount: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of sanctions-fatigue progression.
 *
 * @see FR-1702
 */
export interface SanctionsFatigueResult {
  /** Fatigue value before this computation. */
  readonly previousFatigue: number;
  /** Updated fatigue value, clamped to [0, 1]. */
  readonly newFatigue: number;
  /** Delta between new and previous fatigue. */
  readonly fatigueGrowth: number;
  /** Remaining effectiveness after fatigue (1 − newFatigue), clamped to [0, 1]. */
  readonly effectivenessRemaining: number;
  /** Human-readable explanation of the fatigue computation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless sanctions engine that evaluates SWIFT disconnections, tiered
 * sanctions effects, and sanctions-fatigue progression.
 *
 * Every method is a pure function — the engine holds only a reference to
 * the immutable financial configuration section.
 *
 * @see FR-1701 — SWIFT Disconnection
 * @see FR-1702 — Tiered Sanctions
 */
export class SanctionsEngine {
  private readonly config: SanctionsConfig;

  constructor(config: SanctionsConfig) {
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

  // ── FR-1701 — SWIFT Disconnection ──────────────────────────────────────

  /**
   * Evaluate whether a faction is eligible to disconnect a target from the
   * SWIFT international payment network, and compute the resulting economic
   * effects on the target.
   *
   * **Eligibility:** the imposer must meet *at least one* of:
   * - Diplomatic Influence ≥ `diThreshold` (default 60), **or**
   * - Coalition GDP share ≥ `coalitionGDPThreshold` (default 0.6).
   *
   * **Effects when eligible:**
   * - Target trade income reduced by `tradeIncomeReduction` (−70 %).
   * - Target GDP decays by `gdpDecayPerTurn` (−5 % / turn).
   * - Alternative payment effectiveness grows from 30 % base by +5 % per
   *   turn of disconnection, capped at 100 %.
   *
   * @param input - SWIFT disconnection evaluation parameters.
   * @returns The evaluation result with eligibility, effects, and reason.
   *
   * @see FR-1701
   */
  evaluateSwiftDisconnection(
    input: SwiftDisconnectionInput,
  ): SwiftDisconnectionResult {
    const swift = this.config.swiftDisconnection;

    const meetsInfluence = input.imposerDI >= swift.diThreshold;
    const meetsCoalition = input.coalitionGDPShare >= swift.coalitionGDPThreshold;
    const eligible = meetsInfluence || meetsCoalition;

    if (!eligible) {
      return {
        eligible: false,
        targetTradeReduction: 0,
        targetGDPDecay: 0,
        altPaymentEffectiveness: 0,
        reason:
          `Imposer DI (${input.imposerDI}) < ${swift.diThreshold} and ` +
          `coalition GDP share (${input.coalitionGDPShare}) < ${swift.coalitionGDPThreshold}. ` +
          `SWIFT disconnection of ${input.targetFactionId} is not eligible on turn ${input.currentTurn}.`,
      };
    }

    const altPaymentEffectiveness =
      input.turnsDisconnected > 0
        ? SanctionsEngine.clamp(
            swift.altPaymentInitialEffectiveness +
              input.turnsDisconnected * swift.altPaymentImprovementPerTurn,
            0,
            1,
          )
        : 0;

    const qualificationParts: string[] = [];
    if (meetsInfluence) {
      qualificationParts.push(`DI ${input.imposerDI} ≥ ${swift.diThreshold}`);
    }
    if (meetsCoalition) {
      qualificationParts.push(
        `coalition GDP share ${input.coalitionGDPShare} ≥ ${swift.coalitionGDPThreshold}`,
      );
    }

    return {
      eligible: true,
      targetTradeReduction: swift.tradeIncomeReduction,
      targetGDPDecay: swift.gdpDecayPerTurn,
      altPaymentEffectiveness,
      reason:
        `SWIFT disconnection of ${input.targetFactionId} is eligible ` +
        `(${qualificationParts.join('; ')}). ` +
        `Trade income reduced by ${swift.tradeIncomeReduction * 100}%, ` +
        `GDP decays ${swift.gdpDecayPerTurn * 100}%/turn. ` +
        (input.turnsDisconnected > 0
          ? `Alt-payment effectiveness at ${(altPaymentEffectiveness * 100).toFixed(4)}% ` +
            `after ${input.turnsDisconnected} turn(s) disconnected.`
          : `No alt-payment systems active yet (turn ${input.currentTurn}).`),
    };
  }

  // ── FR-1702 — Tiered Sanctions ─────────────────────────────────────────

  /**
   * Apply a specific sanction tier and compute economic effects on the
   * target and blowback costs on the imposer.
   *
   * All target effects are multiplied by the **effectiveness multiplier**,
   * which equals `1 − fatigueDecay` (clamped to [0, 1]). As sanctions
   * fatigue grows, their impact diminishes.
   *
   * **Targeted:** oligarch power-base hit on target; DI cost on imposer.
   * **Sectoral:** GDP decay proportional to number of sectors; own-trade
   *   reduction on imposer.
   * **Comprehensive:** GDP decay + treasury hit + civil unrest on target;
   *   legitimacy cost on imposer if the target is considered weak.
   *
   * @param input - Sanction tier application parameters.
   * @returns The computed sanction effects and effectiveness multiplier.
   *
   * @see FR-1702
   */
  applySanctionTier(input: SanctionTierInput): SanctionTierResult {
    const tiers = this.config.sanctionTiers;
    const mult = SanctionsEngine.clamp(1 - input.fatigueDecay, 0, 1);

    // Base zeroed-out effects
    let targetEffects = {
      gdpDecay: 0,
      treasuryHit: 0,
      oligarchsHit: 0,
      civilUnrestPerTurn: 0,
    };

    let imposerEffects = {
      diCost: 0,
      ownTradeReduction: 0,
      legitimacyCost: 0,
    };

    let tierLabel: string;

    switch (input.tier) {
      case SanctionTier.Targeted: {
        targetEffects = {
          ...targetEffects,
          oligarchsHit: tiers.targeted.oligarchsHit * mult,
        };
        imposerEffects = {
          ...imposerEffects,
          diCost: tiers.targeted.diCost,
        };
        tierLabel = 'Targeted';
        break;
      }

      case SanctionTier.Sectoral: {
        targetEffects = {
          ...targetEffects,
          gdpDecay: tiers.sectoral.gdpDecayPerTurnPerSector * input.sectorCount * mult,
        };
        imposerEffects = {
          ...imposerEffects,
          ownTradeReduction: tiers.sectoral.ownTradeReduction,
        };
        tierLabel = 'Sectoral';
        break;
      }

      case SanctionTier.Comprehensive: {
        targetEffects = {
          gdpDecay: tiers.comprehensive.gdpDecayPerTurn * mult,
          treasuryHit: tiers.comprehensive.treasuryHit * mult,
          oligarchsHit: 0,
          civilUnrestPerTurn: tiers.comprehensive.civilUnrestPerTurn * mult,
        };
        imposerEffects = {
          ...imposerEffects,
          legitimacyCost: input.targetIsWeak
            ? tiers.comprehensive.legitimacyCostIfWeakTarget
            : 0,
        };
        tierLabel = 'Comprehensive';
        break;
      }

      default: {
        // Exhaustive check — should never be reached.
        const _exhaustive: never = input.tier;
        throw new Error(`Unknown SanctionTier: ${_exhaustive as string}`);
      }
    }

    return {
      tier: input.tier,
      targetEffects,
      imposerEffects,
      effectivenessMultiplier: mult,
      reason:
        `${tierLabel} sanctions by ${input.imposerFaction} against ${input.targetFaction} ` +
        `(turn ${input.currentTurn}, active ${input.turnsActive} turn(s)). ` +
        `Effectiveness multiplier: ${(mult * 100).toFixed(4)}% ` +
        `(fatigue ${(input.fatigueDecay * 100).toFixed(4)}%). ` +
        `Target effects — GDP decay: ${targetEffects.gdpDecay}, ` +
        `treasury hit: ${targetEffects.treasuryHit}, ` +
        `oligarchs hit: ${targetEffects.oligarchsHit}, ` +
        `civil unrest/turn: ${targetEffects.civilUnrestPerTurn}. ` +
        `Imposer costs — DI: ${imposerEffects.diCost}, ` +
        `own trade: ${imposerEffects.ownTradeReduction}, ` +
        `legitimacy: ${imposerEffects.legitimacyCost}.`,
    };
  }

  // ── FR-1702 — Sanctions Fatigue ────────────────────────────────────────

  /**
   * Compute the progression of sanctions fatigue for a given turn.
   *
   * Fatigue grows each turn by the base decay rate plus an additional
   * factor for each evasion network the target has established.
   *
   * ```
   * newFatigue = clamp(currentFatigue + baseDecay + evasionNetworks × 0.1, 0, 1)
   * ```
   *
   * As fatigue approaches 1, the effectiveness of sanctions approaches 0.
   *
   * @param input - Sanctions fatigue computation parameters.
   * @returns The updated fatigue state with growth delta and remaining effectiveness.
   *
   * @see FR-1702
   */
  computeSanctionsFatigue(
    input: SanctionsFatigueInput,
  ): SanctionsFatigueResult {
    const baseDecay = this.config.sanctionsFatigueDecayPerTurn;
    const evasionContribution = input.evasionNetworkCount * 0.1;

    const rawNew = input.currentFatigue + baseDecay + evasionContribution;
    const newFatigue = SanctionsEngine.clamp(rawNew, 0, 1);
    const fatigueGrowth = newFatigue - input.currentFatigue;
    const effectivenessRemaining = SanctionsEngine.clamp(1 - newFatigue, 0, 1);

    return {
      previousFatigue: input.currentFatigue,
      newFatigue,
      fatigueGrowth,
      effectivenessRemaining,
      reason:
        `Sanctions fatigue advanced on turn ${input.currentTurn} ` +
        `(active ${input.turnsActive} turn(s)). ` +
        `Base decay: ${baseDecay}, evasion networks: ${input.evasionNetworkCount} ` +
        `(+${evasionContribution.toFixed(2)}). ` +
        `Fatigue: ${input.currentFatigue.toFixed(2)} → ${newFatigue.toFixed(2)} ` +
        `(Δ ${fatigueGrowth >= 0 ? '+' : ''}${fatigueGrowth.toFixed(2)}). ` +
        `Effectiveness remaining: ${(effectivenessRemaining * 100).toFixed(4)}%.`,
    };
  }
}
