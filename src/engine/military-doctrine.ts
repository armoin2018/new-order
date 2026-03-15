/**
 * Military Doctrine & Readiness Decay Engine — FR-1003, FR-1004
 *
 * Pure-function engine for computing national military doctrine bonuses and
 * modelling readiness decay during active operations.
 *
 * No side effects, no DOM access, no RNG.
 *
 * @module engine/military-doctrine
 */

import { GAME_CONFIG } from '@/engine/config';
import { FactionId, DoctrineId } from '@/data/types';

// ── Config ──────────────────────────────────────────────────────────────────

/**
 * Military configuration subset extracted from {@link GAME_CONFIG}.
 *
 * @see FR-1003
 * @see FR-1004
 */
export type DoctrineConfig = typeof GAME_CONFIG.military;

// ── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Describes the hex where combat is occurring.
 *
 * @see FR-1003
 */
export interface HexContext {
  readonly isHomeTerritory: boolean;
  readonly isIslandChain: boolean;
  readonly isLittoralHex: boolean;
  readonly isCoastalHex: boolean;
  readonly isAlliedTerritory: boolean;
  readonly isNavalEngagement: boolean;
  /** How many consecutive turns of combat at this location. */
  readonly combatTurnCount: number;
}

/**
 * Computed doctrine bonus for a single faction in a given hex context.
 *
 * @see FR-1003
 */
export interface DoctrineBonus {
  readonly doctrineId: DoctrineId;
  readonly factionId: FactionId;
  readonly label: string;
  /** Attack modifier (e.g. +0.1 for coalition attack). */
  readonly attackModifier: number;
  /** Defense modifier (e.g. +0.3 for A2/AD). */
  readonly defenseModifier: number;
  /** Hex projection bonus (e.g. +3 for US). */
  readonly projectionBonus: number;
  /** Attrition modifier (e.g. −0.2 for India). */
  readonly attritionModifier: number;
  /** Readiness decay multiplier (e.g. 0.5 for EU). */
  readonly readinessDecayModifier: number;
  /** Nuclear threshold pressure (e.g. +5 for Russia). */
  readonly nuclearPressure: number;
  /** Whether the doctrine's qualifier is met. */
  readonly active: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * Inputs for computing readiness decay over a single turn.
 *
 * @see FR-1004
 */
export interface ReadinessDecayInput {
  readonly factionId: FactionId;
  readonly currentReadiness: number;
  readonly isInActiveCombat: boolean;
  readonly isTreasuryLow: boolean;
  readonly doctrineBonus: DoctrineBonus | null;
}

/**
 * Result of a readiness-decay computation.
 *
 * @see FR-1004
 */
export interface ReadinessDecayResult {
  readonly factionId: FactionId;
  readonly previousReadiness: number;
  readonly combatDecay: number;
  readonly treasuryDecay: number;
  readonly totalDecay: number;
  readonly newReadiness: number;
  readonly isLowReadiness: boolean;
  /** −0.25 if below threshold, 0 otherwise. */
  readonly combatPenalty: number;
  /** Human-readable summary of the decay. */
  readonly description: string;
}

/**
 * Inputs for computing combined combat modifiers (doctrine + readiness).
 *
 * @see FR-1003
 * @see FR-1004
 */
export interface CombatModifierInput {
  readonly factionId: FactionId;
  readonly doctrineId: DoctrineId;
  readonly hexContext: HexContext;
  readonly readiness: number;
}

/**
 * Combined combat modifier result.
 *
 * @see FR-1003
 * @see FR-1004
 */
export interface CombatModifierResult {
  readonly factionId: FactionId;
  readonly doctrineBonus: DoctrineBonus;
  /** 0 or −0.25 readiness penalty. */
  readonly readinessPenalty: number;
  /** Net attack modifier (doctrine + readiness). */
  readonly totalAttackModifier: number;
  /** Net defense modifier (doctrine + readiness). */
  readonly totalDefenseModifier: number;
  /** Human-readable summary. */
  readonly description: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Map {@link DoctrineId} to runtime {@link FactionId} values. @see FR-1003 */
const DOCTRINE_FACTION_MAP: Readonly<Record<DoctrineId, FactionId>> = {
  [DoctrineId.A2AD]: FactionId.China,
  [DoctrineId.AsymmetricSwarm]: FactionId.Iran,
  [DoctrineId.FortressKorea]: FactionId.DPRK,
  [DoctrineId.GlobalReach]: FactionId.US,
  [DoctrineId.EscalationDominance]: FactionId.Russia,
  [DoctrineId.CollectiveDefense]: FactionId.EU,
  [DoctrineId.MaritimeShield]: FactionId.Japan,
  [DoctrineId.StrategicPatience]: 'india' as FactionId,
};

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Stateful (config-aware) engine for military doctrine bonuses and
 * readiness-decay computations.
 *
 * All public methods are pure — they never mutate their inputs.
 *
 * @see FR-1003
 * @see FR-1004
 */
export class MilitaryDoctrineEngine {
  private readonly cfg: DoctrineConfig;

  constructor(config?: DoctrineConfig) {
    this.cfg = config ?? GAME_CONFIG.military;
  }

  // ── Faction → Doctrine ──────────────────────────────────────────────

  /**
   * Map a {@link FactionId} to its assigned {@link DoctrineId}.
   *
   * Returns `null` for factions without a configured doctrine.
   *
   * @see FR-1003
   */
  getDoctrineForFaction(factionId: FactionId): DoctrineId | null {
    switch (factionId) {
      case FactionId.China:  return DoctrineId.A2AD;
      case FactionId.Iran:   return DoctrineId.AsymmetricSwarm;
      case FactionId.DPRK:   return DoctrineId.FortressKorea;
      case FactionId.US:     return DoctrineId.GlobalReach;
      case FactionId.Russia: return DoctrineId.EscalationDominance;
      case FactionId.EU:     return DoctrineId.CollectiveDefense;
      case FactionId.Japan:  return DoctrineId.MaritimeShield;
      default:               return null;
    }
  }

  // ── Doctrine Bonus ────────────────────────────────────────────────────

  /**
   * Compute the {@link DoctrineBonus} for a doctrine in a given hex context.
   *
   * Each doctrine's qualifier determines whether its passive bonus is active.
   *
   * @see FR-1003
   */
  computeDoctrineBonus(doctrineId: DoctrineId, hexContext: HexContext): DoctrineBonus {
    switch (doctrineId) {
      case DoctrineId.A2AD: {
        const d = this.cfg.doctrines.a2ad;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          defenseModifier: hexContext.isIslandChain ? d.defenseBonus : 0,
        });
      }

      case DoctrineId.AsymmetricSwarm: {
        const d = this.cfg.doctrines.asymmetricSwarm;
        const overrides: BonusOverrides =
          hexContext.isLittoralHex && hexContext.isNavalEngagement
            ? { defenseModifier: d.antiNavalBonus }
            : hexContext.isNavalEngagement
              ? { attackModifier: d.antiNavalBonus }
              : {};
        return buildBonus(
          doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, overrides,
        );
      }

      case DoctrineId.FortressKorea: {
        const d = this.cfg.doctrines.fortressKorea;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          defenseModifier: hexContext.isHomeTerritory ? d.defenseBonus : 0,
        });
      }

      case DoctrineId.GlobalReach: {
        const d = this.cfg.doctrines.globalReach;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          projectionBonus: d.projectionBonus,
          attackModifier: d.coalitionAttackBonus,
        });
      }

      case DoctrineId.EscalationDominance: {
        const d = this.cfg.doctrines.escalationDominance;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          defenseModifier: hexContext.isHomeTerritory ? d.defenseBonus : 0,
          nuclearPressure: d.nuclearThresholdPressure,
        });
      }

      case DoctrineId.CollectiveDefense: {
        const d = this.cfg.doctrines.collectiveDefense;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          defenseModifier: hexContext.isAlliedTerritory ? d.alliedDefenseBonus : 0,
          readinessDecayModifier: d.readinessDecayReduction,
        });
      }

      case DoctrineId.MaritimeShield: {
        const d = this.cfg.doctrines.maritimeShield;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          defenseModifier:
            hexContext.isCoastalHex && hexContext.isNavalEngagement
              ? d.navalDefenseBonus
              : 0,
        });
      }

      case DoctrineId.StrategicPatience: {
        const d = this.cfg.doctrines.strategicPatience;
        return buildBonus(doctrineId, DOCTRINE_FACTION_MAP[doctrineId], d.label, d.description, {
          attritionModifier: -d.attritionReduction,
          attackModifier:
            hexContext.combatTurnCount >= d.prolongedCombatTurnThreshold
              ? d.prolongedCombatBonus
              : 0,
        });
      }

      default: {
        const _exhaustive: never = doctrineId;
        throw new Error(`Unknown doctrine: ${_exhaustive as string}`);
      }
    }
  }

  // ── Readiness Decay ───────────────────────────────────────────────────

  /**
   * Compute readiness decay for a single turn.
   *
   * - Active combat costs {@link GAME_CONFIG.military.readinessDecay.activeCombatPerTurn} per turn.
   * - Low treasury costs {@link GAME_CONFIG.military.readinessDecay.lowTreasuryPerTurn} per turn.
   * - EU Collective Defense doctrine reduces total decay by its modifier.
   * - New readiness is clamped to `[0, 100]`.
   *
   * @see FR-1004
   */
  computeReadinessDecay(input: ReadinessDecayInput): ReadinessDecayResult {
    const { factionId, currentReadiness, isInActiveCombat, isTreasuryLow, doctrineBonus } = input;
    const decay = this.cfg.readinessDecay;
    const lrp = this.cfg.lowReadinessPenalty;

    const combatDecay = isInActiveCombat ? decay.activeCombatPerTurn : 0;
    const treasuryDecay = isTreasuryLow ? decay.lowTreasuryPerTurn : 0;
    const rawDecay = combatDecay + treasuryDecay;

    const decayModifier =
      doctrineBonus !== null && doctrineBonus.readinessDecayModifier < 1
        ? doctrineBonus.readinessDecayModifier
        : 1;

    const totalDecay = rawDecay * decayModifier;
    const newReadiness = clamp(currentReadiness + totalDecay, 0, 100);
    const isLowReadiness = newReadiness < lrp.threshold;
    const combatPenalty = isLowReadiness ? lrp.penalty : 0;

    const parts: string[] = [
      `${factionId}: readiness ${currentReadiness} → ${newReadiness}`,
    ];
    if (combatDecay !== 0) parts.push(`combat(${combatDecay})`);
    if (treasuryDecay !== 0) parts.push(`treasury(${treasuryDecay})`);
    if (decayModifier !== 1) parts.push(`doctrine×${decayModifier}`);
    if (isLowReadiness) parts.push(`LOW READINESS penalty(${combatPenalty})`);

    return {
      factionId,
      previousReadiness: currentReadiness,
      combatDecay,
      treasuryDecay,
      totalDecay,
      newReadiness,
      isLowReadiness,
      combatPenalty,
      description: parts.join(', '),
    };
  }

  // ── Combat Modifier ───────────────────────────────────────────────────

  /**
   * Compute the combined combat modifier (doctrine bonus + readiness penalty).
   *
   * @see FR-1003
   * @see FR-1004
   */
  computeCombatModifier(input: CombatModifierInput): CombatModifierResult {
    const { factionId, doctrineId, hexContext, readiness } = input;

    const doctrineBonus = this.computeDoctrineBonus(doctrineId, hexContext);
    const readinessPenalty = this.getLowReadinessPenalty(readiness);

    const totalAttackModifier = doctrineBonus.attackModifier + readinessPenalty;
    const totalDefenseModifier = doctrineBonus.defenseModifier + readinessPenalty;

    const description = [
      `${factionId}: ${doctrineBonus.label}`,
      `atk=${formatModifier(totalAttackModifier)}`,
      `def=${formatModifier(totalDefenseModifier)}`,
      readinessPenalty !== 0 ? `readiness penalty(${readinessPenalty})` : null,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      factionId,
      doctrineBonus,
      readinessPenalty,
      totalAttackModifier,
      totalDefenseModifier,
      description,
    };
  }

  // ── Readiness Queries ─────────────────────────────────────────────────

  /**
   * Check whether readiness qualifies for the low-readiness penalty.
   *
   * @see FR-1004
   */
  isLowReadiness(readiness: number): boolean {
    return readiness < this.cfg.lowReadinessPenalty.threshold;
  }

  /**
   * Get the combat effectiveness penalty for low readiness.
   *
   * Returns `0` when readiness is at or above the threshold.
   *
   * @see FR-1004
   */
  getLowReadinessPenalty(readiness: number): number {
    return readiness < this.cfg.lowReadinessPenalty.threshold
      ? this.cfg.lowReadinessPenalty.penalty
      : 0;
  }
}

// ── Private Helpers ─────────────────────────────────────────────────────────

/** Overrides for individual doctrine-bonus fields. */
interface BonusOverrides {
  readonly attackModifier?: number;
  readonly defenseModifier?: number;
  readonly projectionBonus?: number;
  readonly attritionModifier?: number;
  readonly readinessDecayModifier?: number;
  readonly nuclearPressure?: number;
}

/** Clamp `value` to the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Construct a {@link DoctrineBonus} with defaults for unset fields.
 *
 * `active` is `true` when any modifier differs from its neutral value.
 */
function buildBonus(
  doctrineId: DoctrineId,
  factionId: FactionId,
  label: string,
  description: string,
  overrides: BonusOverrides,
): DoctrineBonus {
  const attackModifier = overrides.attackModifier ?? 0;
  const defenseModifier = overrides.defenseModifier ?? 0;
  const projectionBonus = overrides.projectionBonus ?? 0;
  const attritionModifier = overrides.attritionModifier ?? 0;
  const readinessDecayModifier = overrides.readinessDecayModifier ?? 1;
  const nuclearPressure = overrides.nuclearPressure ?? 0;

  const active =
    attackModifier !== 0 ||
    defenseModifier !== 0 ||
    projectionBonus !== 0 ||
    attritionModifier !== 0 ||
    readinessDecayModifier !== 1 ||
    nuclearPressure !== 0;

  return {
    doctrineId,
    factionId,
    label,
    attackModifier,
    defenseModifier,
    projectionBonus,
    attritionModifier,
    readinessDecayModifier,
    nuclearPressure,
    active,
    reason: active ? description : `${label}: qualifier not met`,
  };
}

/** Format a modifier as a signed string (e.g. "+0.3" or "-0.25"). */
function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
