/**
 * Trade Warfare Engine — Reciprocal Tariffs & Trade Shield (ART Agreement)
 *
 * Implements US-centric tariff imposition mechanics (FR-604) and the
 * American Reciprocal Trade (ART) agreement shield system (FR-605).
 *
 * @module trade-warfare
 * @see FR-604 — Reciprocal tariff effects
 * @see FR-605 — Trade Shield (ART agreement) mechanics
 * @see CNFL-0502 — Trade warfare implementation ticket
 */

import { FactionId } from '@/data/types';
import type { NationState } from '@/data/types';
import { GAME_CONFIG } from './config';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/** Active tariff between two nations. @see FR-604 */
export interface ActiveTariff {
  /** Nation imposing the tariff (always US in v1). */
  imposer: FactionId;
  /** Target nation of the tariff. */
  target: FactionId;
  /** Number of turns this tariff has been active. */
  turnsActive: number;
  /** Whether this tariff is blocked by a Trade Shield. */
  shielded: boolean;
}

/** Result of applying a reciprocal tariff action. @see FR-604 */
export interface TariffActionResult {
  /** Whether the tariff was successfully imposed. */
  success: boolean;
  /** Human-readable explanation of the result. */
  reason: string;
  /** Change to imposer's inflation rate. */
  imposerInflationDelta: number;
  /** Change to imposer's stability (popularity boost). */
  imposerStabilityDelta: number;
  /** Change to target's treasury (negative = drain). */
  targetTreasuryDelta: number;
  /** Per-turn fractional GDP penalty applied to target. */
  targetGDPPenaltyRate: number;
}

/** ART (American Reciprocal Trade) agreement state. @see FR-605 */
export interface TradeShieldAgreement {
  /** The protecting faction (US). */
  protector: FactionId;
  /** The protected entity (e.g. Taiwan — not a FactionId in current model). */
  protected: string;
  /** Whether the agreement is currently active. */
  active: boolean;
  /** Number of turns the agreement has been active. */
  turnsActive: number;
  /** Whether the Diplomatic Influence bonus has been applied. */
  diBonusApplied: boolean;
}

/** Result of processing tariffs for one turn. @see FR-604 */
export interface TariffTurnResult {
  /** The faction receiving tariff effects. */
  factionId: FactionId;
  /** Total treasury drain this turn from all active tariffs. */
  totalTreasuryDrain: number;
  /** Total GDP penalty rate this turn from all active tariffs. */
  totalGDPPenalty: number;
  /** Number of active (non-shielded) tariffs on this faction. */
  activeTariffCount: number;
}

/** China blockade escalation assessment. @see FR-605 */
export interface BlockadeEscalationAssessment {
  /** Whether escalation should occur this turn. */
  shouldEscalate: boolean;
  /** Computed escalation probability (0–1). */
  escalationProbability: number;
  /** Human-readable explanation of the assessment. */
  reason: string;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Manages reciprocal tariff imposition, removal, and per-turn processing,
 * as well as Trade Shield (ART) agreements.
 *
 * @see FR-604 — Reciprocal tariff effects
 * @see FR-605 — Trade Shield (ART agreement) mechanics
 */
export class TradeWarfareEngine {
  private activeTariffs: ActiveTariff[] = [];
  private tradeShields: TradeShieldAgreement[] = [];

  constructor(private readonly config: typeof GAME_CONFIG.economy) {}

  // ── Tariff Operations ───────────────────────────────────

  /**
   * Impose a reciprocal tariff on a target nation.
   *
   * Only the US may impose tariffs in v1. Respects max simultaneous targets
   * and Trade Shield protections.
   *
   * @param imposer         Faction imposing the tariff
   * @param target          Faction targeted by the tariff
   *
   * @see FR-604
   */
  applyReciprocalTariff(
    imposer: FactionId,
    target: FactionId,
  ): TariffActionResult {
    // v1: only US can impose tariffs
    if (imposer !== FactionId.US) {
      return {
        success: false,
        reason: 'Only the US can impose reciprocal tariffs in v1.',
        imposerInflationDelta: 0,
        imposerStabilityDelta: 0,
        targetTreasuryDelta: 0,
        targetGDPPenaltyRate: 0,
      };
    }

    // Check max simultaneous targets
    const currentTargetCount = this.activeTariffs.filter(
      (t) => t.imposer === imposer,
    ).length;
    if (currentTargetCount >= this.config.tariffs.maxSimultaneousTargets) {
      return {
        success: false,
        reason: `Maximum simultaneous tariff targets (${String(this.config.tariffs.maxSimultaneousTargets)}) reached.`,
        imposerInflationDelta: 0,
        imposerStabilityDelta: 0,
        targetTreasuryDelta: 0,
        targetGDPPenaltyRate: 0,
      };
    }

    // Check if target is already tariffed by this imposer
    const existing = this.activeTariffs.find(
      (t) => t.imposer === imposer && t.target === target,
    );
    if (existing) {
      return {
        success: false,
        reason: `Tariff already active on ${target}.`,
        imposerInflationDelta: 0,
        imposerStabilityDelta: 0,
        targetTreasuryDelta: 0,
        targetGDPPenaltyRate: 0,
      };
    }

    // Check if target is shielded by a Trade Shield
    if (this.isShielded(target)) {
      return {
        success: false,
        reason: `Target ${target} is protected by a Trade Shield (ART agreement).`,
        imposerInflationDelta: 0,
        imposerStabilityDelta: 0,
        targetTreasuryDelta: 0,
        targetGDPPenaltyRate: 0,
      };
    }

    // Apply the tariff
    const tariff: ActiveTariff = {
      imposer,
      target,
      turnsActive: 0,
      shielded: false,
    };
    this.activeTariffs.push(tariff);

    return {
      success: true,
      reason: `Reciprocal tariff imposed on ${target} by ${imposer}.`,
      imposerInflationDelta: this.config.tariffs.usInflationIncrease,
      imposerStabilityDelta: this.config.tariffs.usStabilityBoost,
      targetTreasuryDelta: -this.config.tariffs.targetTreasuryDrain,
      targetGDPPenaltyRate: this.config.tariffs.targetGDPPenaltyPerTurn,
    };
  }

  /**
   * Remove an active tariff on the given target nation.
   * @returns `true` if a tariff was removed, `false` if none existed.
   */
  removeTariff(target: FactionId): boolean {
    const idx = this.activeTariffs.findIndex((t) => t.target === target);
    if (idx === -1) return false;
    this.activeTariffs.splice(idx, 1);
    return true;
  }

  /** Get a read-only snapshot of all active tariffs. */
  getActiveTariffs(): readonly ActiveTariff[] {
    return this.activeTariffs;
  }

  /** Get all tariffs currently imposed on a specific nation. */
  getTariffsOnNation(target: FactionId): ActiveTariff[] {
    return this.activeTariffs.filter((t) => t.target === target);
  }

  // ── Trade Shield (ART) Operations ──────────────────────

  /**
   * Activate a Trade Shield (ART agreement) protecting an entity.
   *
   * @see FR-605
   */
  activateTradeShield(
    protector: FactionId,
    protectedEntity: string,
    protectorTreasury: number,
  ): { success: boolean; reason: string; treasuryCost: number; diBonusDelta: number } {
    const cost = this.config.tradeShield.artInitiationCost;

    // Check affordability
    if (protectorTreasury < cost) {
      return {
        success: false,
        reason: `Insufficient treasury (${String(protectorTreasury)}) to initiate ART agreement (cost: ${String(cost)}).`,
        treasuryCost: 0,
        diBonusDelta: 0,
      };
    }

    // Check if shield already exists for this entity
    const existing = this.tradeShields.find(
      (s) => s.protected === protectedEntity && s.active,
    );
    if (existing) {
      return {
        success: false,
        reason: `Trade Shield already active for ${protectedEntity}.`,
        treasuryCost: 0,
        diBonusDelta: 0,
      };
    }

    // Create the agreement
    const shield: TradeShieldAgreement = {
      protector,
      protected: protectedEntity,
      active: true,
      turnsActive: 0,
      diBonusApplied: true,
    };
    this.tradeShields.push(shield);

    // Mark any existing tariffs on the protected entity as shielded
    for (const tariff of this.activeTariffs) {
      if (tariff.target === protectedEntity) {
        tariff.shielded = true;
      }
    }

    return {
      success: true,
      reason: `ART agreement activated protecting ${protectedEntity}.`,
      treasuryCost: cost,
      diBonusDelta: this.config.tradeShield.artDIBonus,
    };
  }

  /**
   * Deactivate a Trade Shield for the given entity.
   * @returns `true` if a shield was deactivated, `false` if none existed.
   */
  deactivateTradeShield(protectedEntity: string): boolean {
    const shield = this.tradeShields.find(
      (s) => s.protected === protectedEntity && s.active,
    );
    if (!shield) return false;
    shield.active = false;

    // Un-shield any tariffs that were protected
    for (const tariff of this.activeTariffs) {
      if (tariff.target === protectedEntity) {
        tariff.shielded = false;
      }
    }
    return true;
  }

  /**
   * Check if an entity is currently protected by an active Trade Shield.
   */
  isShielded(entity: string): boolean {
    return this.tradeShields.some(
      (s) => s.protected === entity && s.active,
    );
  }

  /** Get a read-only snapshot of all Trade Shield agreements. */
  getTradeShields(): readonly TradeShieldAgreement[] {
    return this.tradeShields;
  }

  // ── Blockade Escalation ────────────────────────────────

  /**
   * Assess whether China should escalate to a naval blockade in response
   * to an active ART agreement.
   *
   * Probability = base chance × stability-adjusted modifier.
   * Lower China stability → higher escalation probability.
   *
   * @see FR-605
   */
  assessChinaBlockadeEscalation(
    artActive: boolean,
    chinaStability: number,
    rngValue: number,
  ): BlockadeEscalationAssessment {
    if (!artActive) {
      return {
        shouldEscalate: false,
        escalationProbability: 0,
        reason: 'No ART agreement active — no blockade escalation.',
      };
    }

    const baseChance = this.config.tradeShield.chinaBlockadeEscalationChance;
    // Lower stability increases probability: (60 − stability) / 100
    const stabilityModifier = (60 - chinaStability) / 100;
    const probability = Math.max(0, Math.min(1, baseChance + stabilityModifier));

    const shouldEscalate = rngValue < probability;

    return {
      shouldEscalate,
      escalationProbability: probability,
      reason: shouldEscalate
        ? `China escalates to blockade (probability ${probability.toFixed(2)}, stability ${String(chinaStability)}).`
        : `China does not escalate (probability ${probability.toFixed(2)}, rng ${rngValue.toFixed(2)}).`,
    };
  }

  // ── Turn Processing ────────────────────────────────────

  /**
   * Process all active tariffs and trade shields for one turn.
   *
   * For each nation that has active (non-shielded) tariffs imposed:
   * - Accumulates treasury drain and GDP penalties.
   * - Increments `turnsActive` on all tariffs and shields.
   *
   * @see FR-604
   */
  processTariffTurn(
    nations: Record<FactionId, NationState>,
  ): TariffTurnResult[] {
    const results = new Map<FactionId, TariffTurnResult>();

    for (const tariff of this.activeTariffs) {
      tariff.turnsActive += 1;

      // Shielded tariffs tick but don't apply penalties
      if (tariff.shielded) continue;

      const nation = nations[tariff.target];
      if (!nation) continue;

      const existing = results.get(tariff.target);
      if (existing) {
        existing.totalTreasuryDrain += this.config.tariffs.targetTreasuryDrain;
        existing.totalGDPPenalty += this.config.tariffs.targetGDPPenaltyPerTurn;
        existing.activeTariffCount += 1;
      } else {
        results.set(tariff.target, {
          factionId: tariff.target,
          totalTreasuryDrain: this.config.tariffs.targetTreasuryDrain,
          totalGDPPenalty: this.config.tariffs.targetGDPPenaltyPerTurn,
          activeTariffCount: 1,
        });
      }
    }

    // Increment turnsActive on all active trade shields
    for (const shield of this.tradeShields) {
      if (shield.active) {
        shield.turnsActive += 1;
      }
    }

    return Array.from(results.values());
  }
}
