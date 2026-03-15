import { describe, it, expect } from 'vitest';
import { GeographicPostureEngine } from '@/engine/geographic-posture';
import { TerrainType, FactionId } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';
import { createDefaultHexState } from '@/engine/hex-map';

import type { HexId } from '@/data/types';
import type { GeographicPosture } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makePosture(
  factionId: string,
  overrides: Partial<GeographicPosture> = {},
): GeographicPosture {
  return {
    factionId: factionId as GeographicPosture['factionId'],
    strategicDepth: 50,
    naturalDefenses: ['mountains'],
    keyVulnerabilities: ['coastline'],
    chokepointControl: [],
    terrainAdvantage: 10,
    energyDependency: 30,
    ...overrides,
  };
}

function createEngine(): GeographicPostureEngine {
  const postures = {
    [FactionId.US]: makePosture(FactionId.US, {
      strategicDepth: 90,
      terrainAdvantage: 20,
    }),
    [FactionId.China]: makePosture(FactionId.China, {
      strategicDepth: 70,
      terrainAdvantage: 15,
    }),
  } as Record<GeographicPosture['factionId'], GeographicPosture>;

  return new GeographicPostureEngine(postures);
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('GeographicPostureEngine', () => {
  describe('constructor & getPosture', () => {
    it('constructs with posture data', () => {
      const engine = createEngine();
      expect(engine).toBeDefined();
    });

    it('getPosture returns correct posture for known faction', () => {
      const engine = createEngine();
      const posture = engine.getPosture(FactionId.US);
      expect(posture).toBeDefined();
      expect(posture?.strategicDepth).toBe(90);
    });

    it('getPosture returns undefined for missing faction', () => {
      const engine = createEngine();
      expect(engine.getPosture(FactionId.DPRK)).toBeUndefined();
    });
  });

  // ── Terrain Defense Modifier ─────────────────────────────

  describe('getTerrainDefenseModifier', () => {
    const engine = createEngine();

    it('Mountain → 0.3', () => {
      expect(engine.getTerrainDefenseModifier(TerrainType.Mountain)).toBe(
        GAME_CONFIG.combat.terrainModifiers.mountain.defenseBonus,
      );
    });

    it('Urban → 0.2', () => {
      expect(engine.getTerrainDefenseModifier(TerrainType.Urban)).toBe(
        GAME_CONFIG.combat.terrainModifiers.urban.defenseBonus,
      );
    });

    it('Forest → 0.15', () => {
      expect(engine.getTerrainDefenseModifier(TerrainType.Forest)).toBe(
        GAME_CONFIG.combat.terrainModifiers.forest.defenseBonus,
      );
    });

    it('Plains → 0 (no defense bonus)', () => {
      expect(engine.getTerrainDefenseModifier(TerrainType.Plains)).toBe(0);
    });
  });

  // ── Terrain Attack Modifier ──────────────────────────────

  describe('getTerrainAttackModifier', () => {
    const engine = createEngine();

    it('Plains → +0.1', () => {
      expect(engine.getTerrainAttackModifier(TerrainType.Plains)).toBe(
        GAME_CONFIG.combat.terrainModifiers.plains.attackBonus,
      );
    });

    it('Desert → −0.1', () => {
      expect(engine.getTerrainAttackModifier(TerrainType.Desert)).toBe(
        GAME_CONFIG.combat.terrainModifiers.desert.attackerLogisticsPenalty,
      );
    });

    it('Arctic → −0.15', () => {
      expect(engine.getTerrainAttackModifier(TerrainType.Arctic)).toBe(
        GAME_CONFIG.combat.terrainModifiers.arctic.attackerLogisticsPenalty,
      );
    });

    it('Mountain → 0 (no attack modifier)', () => {
      expect(engine.getTerrainAttackModifier(TerrainType.Mountain)).toBe(0);
    });
  });

  // ── Special Terrain Flags ──────────────────────────────

  describe('doesTerrainCauseCivilianCasualties', () => {
    const engine = createEngine();

    it('Urban → true', () => {
      expect(engine.doesTerrainCauseCivilianCasualties(TerrainType.Urban)).toBe(true);
    });

    it('Plains → false', () => {
      expect(engine.doesTerrainCauseCivilianCasualties(TerrainType.Plains)).toBe(false);
    });

    it('Forest → false', () => {
      expect(engine.doesTerrainCauseCivilianCasualties(TerrainType.Forest)).toBe(false);
    });
  });

  describe('requiresNavalSupremacy', () => {
    const engine = createEngine();

    it('Island → true', () => {
      expect(engine.requiresNavalSupremacy(TerrainType.Island)).toBe(true);
    });

    it('Coastal → false', () => {
      expect(engine.requiresNavalSupremacy(TerrainType.Coastal)).toBe(false);
    });

    it('Mountain → false', () => {
      expect(engine.requiresNavalSupremacy(TerrainType.Mountain)).toBe(false);
    });
  });

  // ── Combined Modifier Result ───────────────────────────

  describe('getTerrainModifiers', () => {
    const engine = createEngine();

    it('Mountain returns defense bonus and no civilian casualties', () => {
      const mods = engine.getTerrainModifiers(TerrainType.Mountain);
      expect(mods.defenseBonus).toBe(0.3);
      expect(mods.attackModifier).toBe(0);
      expect(mods.causesCivilianCasualties).toBe(false);
      expect(mods.requiresNavalSupremacy).toBe(false);
    });

    it('Arctic returns attack penalty and attrition', () => {
      const mods = engine.getTerrainModifiers(TerrainType.Arctic);
      expect(mods.attackModifier).toBe(-0.15);
      expect(mods.attritionPerTurn).toBe(
        GAME_CONFIG.combat.terrainModifiers.arctic.attritionPerTurn,
      );
    });

    it('Coastal returns naval bombardment bonus', () => {
      const mods = engine.getTerrainModifiers(TerrainType.Coastal);
      expect(mods.navalBombardmentBonus).toBe(
        GAME_CONFIG.combat.terrainModifiers.coastal.navalBombardmentBonus,
      );
    });
  });

  // ── Hex-Level Application ──────────────────────────────

  describe('applyTerrainBonusToHex', () => {
    const engine = createEngine();

    it('Mountain hex gets terrainBonus of 20', () => {
      const hex = createDefaultHexState('0:0' as HexId, TerrainType.Mountain);
      const bonus = engine.applyTerrainBonusToHex(hex);
      expect(bonus).toBe(20);
      expect(hex.terrainBonus).toBe(20);
    });

    it('Urban hex gets terrainBonus of ~13.33', () => {
      const hex = createDefaultHexState('0:0' as HexId, TerrainType.Urban);
      const bonus = engine.applyTerrainBonusToHex(hex);
      expect(bonus).toBeCloseTo(13.33, 2);
      expect(hex.terrainBonus).toBeCloseTo(13.33, 2);
    });

    it('Forest hex gets terrainBonus of 10', () => {
      const hex = createDefaultHexState('0:0' as HexId, TerrainType.Forest);
      const bonus = engine.applyTerrainBonusToHex(hex);
      expect(bonus).toBe(10);
    });

    it('Plains hex gets terrainBonus of 0', () => {
      const hex = createDefaultHexState('0:0' as HexId, TerrainType.Plains);
      const bonus = engine.applyTerrainBonusToHex(hex);
      expect(bonus).toBe(0);
    });
  });

  // ── Terrain Advantage ──────────────────────────────────

  describe('getTerrainAdvantage', () => {
    it('returns nation terrain advantage score', () => {
      const engine = createEngine();
      expect(engine.getTerrainAdvantage(FactionId.US)).toBe(20);
    });

    it('returns 0 for unknown faction', () => {
      const engine = createEngine();
      expect(engine.getTerrainAdvantage(FactionId.Syria)).toBe(0);
    });
  });
});
