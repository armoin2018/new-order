/**
 * Geographic Posture Engine — CNFL-0302, FR-1101, FR-1105
 *
 * Evaluates terrain modifiers, geographic advantages, and per-faction
 * strategic posture data. All modifiers are sourced from GAME_CONFIG.combat
 * so tuning requires no code changes.
 *
 * Pure module — no side effects, no DOM access.
 *
 * @module engine/geographic-posture
 */

import { TerrainType } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

import type { FactionId } from '@/data/types';
import type { HexState } from '@/data/types';
import type { GeographicPosture } from '@/data/types';

// ---------------------------------------------------------------------------
// Result Interface
// ---------------------------------------------------------------------------

/**
 * Combined terrain modifier result for a single terrain type.
 * Aggregates all combat-relevant modifiers from GAME_CONFIG.
 */
export interface TerrainModifierResult {
  /** Defense bonus applied to units defending on this terrain (0+). */
  readonly defenseBonus: number;
  /** Attack modifier applied to the attacker (negative = penalty). */
  readonly attackModifier: number;
  /** Whether combat on this terrain causes civilian casualties. */
  readonly causesCivilianCasualties: boolean;
  /** Whether attacking this terrain requires naval supremacy. */
  readonly requiresNavalSupremacy: boolean;
  /** Naval bombardment bonus for coastal hexes. */
  readonly navalBombardmentBonus: number;
  /** Per-turn attrition rate in hostile environments (e.g. arctic). */
  readonly attritionPerTurn: number;
}

// ---------------------------------------------------------------------------
// GeographicPostureEngine
// ---------------------------------------------------------------------------

/**
 * Manages per-faction geographic posture data and exposes terrain modifier
 * lookups driven entirely by {@link GAME_CONFIG.combat.terrainModifiers}.
 */
export class GeographicPostureEngine {
  private readonly postures: ReadonlyMap<FactionId, GeographicPosture>;

  constructor(postures: Record<FactionId, GeographicPosture>) {
    const map = new Map<FactionId, GeographicPosture>();
    for (const key of Object.keys(postures)) {
      const fid = key as FactionId;
      const posture = postures[fid];
      if (posture) {
        map.set(fid, posture);
      }
    }
    this.postures = map;
  }

  // ── Posture Accessors ──────────────────────────────────────────────────

  /** Retrieve the geographic posture for a faction, if loaded. */
  getPosture(factionId: FactionId): GeographicPosture | undefined {
    return this.postures.get(factionId);
  }

  /** Return the faction's terrain advantage score (from scenario data). */
  getTerrainAdvantage(factionId: FactionId): number {
    return this.postures.get(factionId)?.terrainAdvantage ?? 0;
  }

  // ── Terrain Defense Modifier ───────────────────────────────────────────

  /**
   * Defense modifier for a given terrain type.
   *
   * - Mountain: +0.30
   * - Urban:    +0.20
   * - Forest:   +0.15
   * - Others:    0
   */
  getTerrainDefenseModifier(terrainType: TerrainType): number {
    const tm = GAME_CONFIG.combat.terrainModifiers;

    switch (terrainType) {
      case TerrainType.Mountain:
        return tm.mountain.defenseBonus;
      case TerrainType.Urban:
        return tm.urban.defenseBonus;
      case TerrainType.Forest:
        return tm.forest.defenseBonus;
      default:
        return 0;
    }
  }

  // ── Terrain Attack Modifier ────────────────────────────────────────────

  /**
   * Attack modifier for a given terrain type (applies to the attacker).
   *
   * - Plains: +0.10
   * - Desert: −0.10 (logistics penalty)
   * - Arctic: −0.15 (logistics penalty)
   * - Others:  0
   */
  getTerrainAttackModifier(terrainType: TerrainType): number {
    const tm = GAME_CONFIG.combat.terrainModifiers;

    switch (terrainType) {
      case TerrainType.Plains:
        return tm.plains.attackBonus;
      case TerrainType.Desert:
        return tm.desert.attackerLogisticsPenalty;
      case TerrainType.Arctic:
        return tm.arctic.attackerLogisticsPenalty;
      default:
        return 0;
    }
  }

  // ── Special Terrain Flags ──────────────────────────────────────────────

  /** Whether combat on this terrain causes civilian casualties. */
  doesTerrainCauseCivilianCasualties(terrainType: TerrainType): boolean {
    return terrainType === TerrainType.Urban;
  }

  /** Whether attacking this terrain requires naval supremacy. */
  requiresNavalSupremacy(terrainType: TerrainType): boolean {
    return terrainType === TerrainType.Island;
  }

  // ── Combined Modifier Result ───────────────────────────────────────────

  /**
   * Return the full set of combat-relevant terrain modifiers for a hex's
   * terrain type, aggregated from GAME_CONFIG.
   */
  getTerrainModifiers(terrainType: TerrainType): TerrainModifierResult {
    const tm = GAME_CONFIG.combat.terrainModifiers;

    return {
      defenseBonus: this.getTerrainDefenseModifier(terrainType),
      attackModifier: this.getTerrainAttackModifier(terrainType),
      causesCivilianCasualties: this.doesTerrainCauseCivilianCasualties(terrainType),
      requiresNavalSupremacy: this.requiresNavalSupremacy(terrainType),
      navalBombardmentBonus:
        terrainType === TerrainType.Coastal ? tm.coastal.navalBombardmentBonus : 0,
      attritionPerTurn:
        terrainType === TerrainType.Arctic ? tm.arctic.attritionPerTurn : 0,
    };
  }

  // ── Hex-Level Application ──────────────────────────────────────────────

  /**
   * Compute and write the `terrainBonus` field on a hex based on its terrain.
   *
   * The terrain bonus is the defense modifier scaled to the HexState range
   * (−20 to +20). The raw defense modifier (0–0.30) is mapped to 0–20
   * by multiplying by ~66.67.
   *
   * @returns The computed terrainBonus value.
   */
  applyTerrainBonusToHex(hexState: HexState): number {
    const defMod = this.getTerrainDefenseModifier(hexState.terrainType);
    // Scale from fractional (0–0.30) to the HexState range (0–20).
    // 0.30 → 20, 0.20 → ~13.3, 0.15 → 10, 0 → 0.
    const scaled = Math.round(defMod * (20 / 0.3) * 100) / 100;
    const clamped = Math.max(-20, Math.min(20, scaled));

    // Mutate the hex state in place and return.
    (hexState as { terrainBonus: number }).terrainBonus = clamped;
    return clamped;
  }
}
