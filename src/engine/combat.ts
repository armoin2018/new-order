/**
 * Combat Resolver — CNFL-0305, FR-804, FR-1106
 *
 * Pure-function combat resolution engine. Applies terrain, supply, morale,
 * tech-differential, readiness, and SAM-bypass modifiers — all sourced from
 * {@link GAME_CONFIG.combat} — and returns a deterministic {@link CombatResult}.
 *
 * No side effects, no DOM access, no RNG (deterministic given inputs).
 *
 * @module engine/combat
 */

import { TerrainType } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';
import { canBypassSAM } from '@/engine/unit-registry';

import type { FactionId, HexId } from '@/data/types';
import type { HexState } from '@/data/types';
import type { Unit } from '@/data/types';
import type { HexGrid } from '@/engine/hex-map';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** All inputs needed to resolve a single combat engagement. */
export interface CombatContext {
  /** The attacking unit. */
  readonly attacker: Unit;
  /** The defending unit. */
  readonly defender: Unit;
  /** Attacker's national tech level (0–100). */
  readonly attackerTechLevel: number;
  /** Defender's national tech level (0–100). */
  readonly defenderTechLevel: number;
  /** The hex where combat takes place. */
  readonly hex: HexState;
  /** Whether the attacker's supply lines are intact. */
  readonly attackerSupplyIntact: boolean;
  /** Whether the defender's supply lines are intact. */
  readonly defenderSupplyIntact: boolean;
  /** Whether the defending force has Next-Gen Integrated Air Defense. */
  readonly defenderHasNextGenIAD: boolean;
}

/** Outcome of a single combat engagement. */
export interface CombatResult {
  /** Damage dealt TO the attacker. */
  readonly attackerDamage: number;
  /** Damage dealt TO the defender. */
  readonly defenderDamage: number;
  /** Whether the attacker was destroyed (HP ≤ 0 after damage). */
  readonly attackerDestroyed: boolean;
  /** Whether the defender was destroyed (HP ≤ 0 after damage). */
  readonly defenderDestroyed: boolean;
  /** Net terrain modifier applied to the defender's defense. */
  readonly terrainModifierApplied: number;
  /** Net supply-line modifier applied. */
  readonly supplyModifierApplied: number;
  /** Net morale modifier applied. */
  readonly moraleModifierApplied: number;
  /** Net tech-differential modifier applied. */
  readonly techModifierApplied: number;
  /** Whether the engagement caused civilian casualties (urban combat). */
  readonly civilianCasualties: boolean;
  /** Whether the attacker bypassed SAM defenses (FR-803). */
  readonly bypassedSAM: boolean;
  /** Human-readable log of every modifier applied during resolution. */
  readonly combatLog: string[];
}

/** Supply-line status for a unit relative to its faction's territory. */
export interface SupplyStatus {
  /** Whether the unit has a path to any friendly hex. */
  readonly connected: boolean;
  /** Hex distance to the nearest friendly supply source. */
  readonly distanceToSource: number;
  /** Supply effectiveness (0–100). Decreases with distance. */
  readonly effectiveness: number;
  /** HexId of the nearest supply source (null if cut off). */
  readonly supplySourceHexId: HexId | null;
}

// ---------------------------------------------------------------------------
// CombatResolver
// ---------------------------------------------------------------------------

/**
 * Stateless combat resolver. All methods are pure static functions.
 */
export class CombatResolver {
  // ── Primary Resolution ─────────────────────────────────────────────────

  /**
   * Resolve a single combat engagement.
   *
   * Modifier application order:
   * 1. Base damage (attack vs defense)
   * 2. Terrain modifier (defender defense, attacker attack)
   * 3. Supply-line modifier
   * 4. Morale modifier
   * 5. Tech-differential modifier
   * 6. Low-readiness penalty (via supply proxy)
   * 7. FR-803 SAM bypass
   * 8. Final damage & destruction check
   */
  static resolve(context: CombatContext): CombatResult {
    const {
      attacker,
      defender,
      attackerTechLevel,
      defenderTechLevel,
      hex,
      attackerSupplyIntact,
      defenderSupplyIntact,
      defenderHasNextGenIAD,
    } = context;

    const cfg = GAME_CONFIG.combat;
    const log: string[] = [];

    // ── 1. Base values ──────────────────────────────────────────────────
    let effectiveAttack = attacker.attackPower;
    let effectiveDefense = defender.defensePower;

    log.push(
      `Base: attacker.attack=${effectiveAttack}, defender.defense=${effectiveDefense}`,
    );

    // ── 2. Terrain modifiers ────────────────────────────────────────────
    let terrainMod = 0;

    // Defense bonus for terrain
    const terrainType = hex.terrainType;
    let defenseBonus = 0;

    switch (terrainType) {
      case TerrainType.Mountain:
        defenseBonus = cfg.terrainModifiers.mountain.defenseBonus;
        break;
      case TerrainType.Urban:
        defenseBonus = cfg.terrainModifiers.urban.defenseBonus;
        break;
      case TerrainType.Forest:
        defenseBonus = cfg.terrainModifiers.forest.defenseBonus;
        break;
      default:
        break;
    }

    if (defenseBonus !== 0) {
      effectiveDefense *= 1 + defenseBonus;
      terrainMod += defenseBonus;
      log.push(
        `Terrain defense (${terrainType}): +${(defenseBonus * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`,
      );
    }

    // Attack modifier for terrain
    let attackMod = 0;

    switch (terrainType) {
      case TerrainType.Plains:
        attackMod = cfg.terrainModifiers.plains.attackBonus;
        break;
      case TerrainType.Desert:
        attackMod = cfg.terrainModifiers.desert.attackerLogisticsPenalty;
        break;
      case TerrainType.Arctic:
        attackMod = cfg.terrainModifiers.arctic.attackerLogisticsPenalty;
        break;
      default:
        break;
    }

    if (attackMod !== 0) {
      effectiveAttack *= 1 + attackMod;
      terrainMod += attackMod;
      log.push(
        `Terrain attack (${terrainType}): ${attackMod > 0 ? '+' : ''}${(attackMod * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`,
      );
    }

    // ── 3. Supply-line modifier ─────────────────────────────────────────
    let supplyMod = 0;

    if (attackerSupplyIntact) {
      const bonus = cfg.supplyLine.intactBonus;
      effectiveAttack *= 1 + bonus;
      supplyMod += bonus;
      log.push(`Attacker supply intact: +${(bonus * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
    } else {
      const penalty = cfg.supplyLine.severedPenalty;
      effectiveAttack *= 1 + penalty; // penalty is negative
      supplyMod += penalty;
      log.push(`Attacker supply severed: ${(penalty * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
    }

    if (defenderSupplyIntact) {
      const bonus = cfg.supplyLine.intactBonus;
      effectiveDefense *= 1 + bonus;
      supplyMod += bonus;
      log.push(`Defender supply intact: +${(bonus * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
    } else {
      const penalty = cfg.supplyLine.severedPenalty;
      effectiveDefense *= 1 + penalty;
      supplyMod += penalty;
      log.push(`Defender supply severed: ${(penalty * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
    }

    // ── 4. Morale modifier ──────────────────────────────────────────────
    let moraleMod = 0;

    // Attacker morale
    if (attacker.morale < cfg.morale.lowThreshold) {
      const penalty = cfg.morale.lowMoralePenalty;
      effectiveAttack *= 1 + penalty;
      moraleMod += penalty;
      log.push(`Attacker low morale (${attacker.morale}): ${(penalty * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
    } else if (attacker.morale > cfg.morale.highThreshold) {
      const bonus = cfg.morale.highMoraleBonus;
      effectiveAttack *= 1 + bonus;
      moraleMod += bonus;
      log.push(`Attacker high morale (${attacker.morale}): +${(bonus * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
    }

    // Defender morale
    if (defender.morale < cfg.morale.lowThreshold) {
      const penalty = cfg.morale.lowMoralePenalty;
      effectiveDefense *= 1 + penalty;
      moraleMod += penalty;
      log.push(`Defender low morale (${defender.morale}): ${(penalty * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
    } else if (defender.morale > cfg.morale.highThreshold) {
      const bonus = cfg.morale.highMoraleBonus;
      effectiveDefense *= 1 + bonus;
      moraleMod += bonus;
      log.push(`Defender high morale (${defender.morale}): +${(bonus * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
    }

    // ── 5. Tech-differential modifier ───────────────────────────────────
    let techMod = 0;
    const techDiff = attackerTechLevel - defenderTechLevel;

    if (techDiff !== 0) {
      const absDiff = Math.abs(techDiff);
      const rawBonus = absDiff * cfg.techDifferential.bonusPerLevel;
      const cappedBonus = Math.min(rawBonus, cfg.techDifferential.maxBonus);

      if (techDiff > 0) {
        // Attacker has tech advantage
        effectiveAttack *= 1 + cappedBonus;
        techMod = cappedBonus;
        log.push(`Attacker tech advantage (+${absDiff}): +${(cappedBonus * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
      } else {
        // Defender has tech advantage
        effectiveDefense *= 1 + cappedBonus;
        techMod = -cappedBonus;
        log.push(`Defender tech advantage (+${absDiff}): +${(cappedBonus * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
      }
    }

    // ── 6. Low readiness penalty ────────────────────────────────────────
    // Applied via supply status as a proxy: if supply < lowReadiness threshold
    if (attacker.supplyStatus < cfg.lowReadiness.threshold) {
      const penalty = cfg.lowReadiness.combatEffectivenessPenalty;
      effectiveAttack *= 1 + penalty;
      log.push(`Attacker low readiness (supply=${attacker.supplyStatus}): ${(penalty * 100).toFixed(4)}% → attack=${effectiveAttack.toFixed(1)}`);
    }
    if (defender.supplyStatus < cfg.lowReadiness.threshold) {
      const penalty = cfg.lowReadiness.combatEffectivenessPenalty;
      effectiveDefense *= 1 + penalty;
      log.push(`Defender low readiness (supply=${defender.supplyStatus}): ${(penalty * 100).toFixed(4)}% → defense=${effectiveDefense.toFixed(1)}`);
    }

    // ── 7. FR-803: SAM bypass ───────────────────────────────────────────
    const bypassedSAM = canBypassSAM(attacker, defenderHasNextGenIAD);

    if (bypassedSAM) {
      effectiveDefense *= 0.5;
      log.push(`SAM bypassed (FR-803): defender defense halved → defense=${effectiveDefense.toFixed(1)}`);
    }

    // ── 8. Final damage calculation ─────────────────────────────────────
    // Damage TO defender = effective attack - portion of effective defense
    // Damage TO attacker = effective defense - portion of effective attack
    // Clamp to minimum 0.
    const damageToDefender = Math.max(0, effectiveAttack - effectiveDefense * 0.5);
    const damageToAttacker = Math.max(0, effectiveDefense - effectiveAttack * 0.5);

    const attackerHpAfter = attacker.hp - damageToAttacker;
    const defenderHpAfter = defender.hp - damageToDefender;

    log.push(
      `Final: damageToDefender=${damageToDefender.toFixed(1)}, damageToAttacker=${damageToAttacker.toFixed(1)}`,
    );
    log.push(
      `HP after: attacker=${attackerHpAfter.toFixed(1)}, defender=${defenderHpAfter.toFixed(1)}`,
    );

    const civilianCasualties =
      hex.terrainType === TerrainType.Urban &&
      GAME_CONFIG.combat.terrainModifiers.urban.causesCivilianCasualties;

    if (civilianCasualties) {
      log.push('Urban combat: civilian casualties incurred');
    }

    return {
      attackerDamage: Math.round(damageToAttacker * 100) / 100,
      defenderDamage: Math.round(damageToDefender * 100) / 100,
      attackerDestroyed: attackerHpAfter <= 0,
      defenderDestroyed: defenderHpAfter <= 0,
      terrainModifierApplied: Math.round(terrainMod * 1000) / 1000,
      supplyModifierApplied: Math.round(supplyMod * 1000) / 1000,
      moraleModifierApplied: Math.round(moraleMod * 1000) / 1000,
      techModifierApplied: Math.round(techMod * 1000) / 1000,
      civilianCasualties,
      bypassedSAM,
      combatLog: log,
    };
  }

  // ── Supply Status ──────────────────────────────────────────────────────

  /**
   * Calculate the supply status of a unit by searching the hex grid for the
   * nearest friendly hex (any hex where `nationControl === factionId`).
   *
   * Uses BFS via `hexGrid.findPath` to determine reachability and distance.
   */
  static calculateSupplyStatus(
    unit: Unit,
    hexGrid: HexGrid,
    factionId: FactionId,
  ): SupplyStatus {
    const friendlyHexes = hexGrid.getHexesByFaction(factionId);

    if (friendlyHexes.length === 0) {
      return { connected: false, distanceToSource: Infinity, effectiveness: 0, supplySourceHexId: null };
    }

    // Check if the unit is already on a friendly hex.
    const currentHex = hexGrid.get(unit.position);
    if (currentHex && currentHex.nationControl === factionId) {
      return { connected: true, distanceToSource: 0, effectiveness: 100, supplySourceHexId: unit.position };
    }

    // Find the nearest reachable friendly hex by distance.
    let nearestId: HexId | null = null;
    let nearestDist = Infinity;

    for (const hexId of friendlyHexes) {
      const dist = hexGrid.distance(unit.position, hexId);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = hexId;
      }
    }

    if (nearestId === null) {
      return { connected: false, distanceToSource: Infinity, effectiveness: 0, supplySourceHexId: null };
    }

    // Verify a path exists (BFS). All hexes are passable for supply purposes.
    const path = hexGrid.findPath(unit.position, nearestId, () => true);

    if (!path) {
      return { connected: false, distanceToSource: nearestDist, effectiveness: 0, supplySourceHexId: null };
    }

    // Effectiveness decreases with distance: −5% per hex from source.
    const effectiveness = Math.max(0, 100 - nearestDist * 5);

    return {
      connected: true,
      distanceToSource: nearestDist,
      effectiveness,
      supplySourceHexId: nearestId,
    };
  }

  // ── Supply Degradation ─────────────────────────────────────────────────

  /**
   * FR-1106: Apply per-turn supply degradation or recovery.
   *
   * - **Cut off**: −15 per turn (min 0).
   * - **Connected**: +10 per turn (max 100) — gradual recovery.
   *
   * @returns The new `supplyStatus` value for the unit.
   */
  static applySupplyDegradation(unit: Unit, connected: boolean): number {
    if (!connected) {
      return Math.max(0, unit.supplyStatus - 15);
    }
    return Math.min(100, unit.supplyStatus + 10);
  }
}
