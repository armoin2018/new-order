import { describe, it, expect } from 'vitest';
import { CombatResolver } from '@/engine/combat';
import { HexGrid, hexIdFromAxial } from '@/engine/hex-map';
import { TerrainType, FactionId, UnitType } from '@/data/types';

import type { CombatContext } from '@/engine/combat';
import type { HexId, UnitId } from '@/data/types';
import type { Unit } from '@/data/types';
import type { HexState } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-test-001' as UnitId,
    factionId: FactionId.US,
    unitType: UnitType.Infantry,
    hp: 100,
    attackPower: 50,
    defensePower: 50,
    movementRange: 2,
    specialAbilities: [],
    supplyStatus: 100,
    morale: 50,
    position: '0:0' as HexId,
    isGhost: false,
    ...overrides,
  };
}

function makeHex(terrain: TerrainType): HexState {
  return {
    id: '0:0' as HexId,
    nationControl: null,
    terrainType: terrain,
    terrainBonus: 0,
    resourceYield: 10,
    civilianUnrest: 0,
    militaryPresence: 0,
    infrastructureLevel: 0,
  };
}

function baseContext(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    attacker: makeUnit(),
    defender: makeUnit({ id: 'unit-test-002' as UnitId, factionId: FactionId.China }),
    attackerTechLevel: 50,
    defenderTechLevel: 50,
    hex: makeHex(TerrainType.Coastal),
    attackerSupplyIntact: true,
    defenderSupplyIntact: true,
    defenderHasNextGenIAD: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('CombatResolver', () => {
  // ── Basic Combat ───────────────────────────────────────

  describe('basic combat (no terrain modifiers)', () => {
    it('equal units on Coastal terrain deal symmetric damage', () => {
      const ctx = baseContext();
      const result = CombatResolver.resolve(ctx);

      // Coastal: no terrain modifier
      // Supply intact: both × 1.1 → attack=55, defense=55
      // damage = 55 - 27.5 = 27.5 each
      expect(result.defenderDamage).toBeCloseTo(27.5, 2);
      expect(result.attackerDamage).toBeCloseTo(27.5, 2);
      expect(result.attackerDestroyed).toBe(false);
      expect(result.defenderDestroyed).toBe(false);
    });
  });

  // ── Terrain Modifiers ──────────────────────────────────

  describe('terrain modifiers', () => {
    it('Mountain defense bonus reduces damage to defender', () => {
      const ctx = baseContext({ hex: makeHex(TerrainType.Mountain) });
      const result = CombatResolver.resolve(ctx);

      // defense 50 × 1.3 = 65, then supply: attack=55, defense=71.5
      // defenderDamage = 55 - 35.75 = 19.25
      // attackerDamage = 71.5 - 27.5 = 44
      expect(result.defenderDamage).toBeCloseTo(19.25, 2);
      expect(result.attackerDamage).toBeCloseTo(44, 2);
      expect(result.terrainModifierApplied).toBeGreaterThan(0);
    });

    it('Desert imposes attacker logistics penalty', () => {
      const ctx = baseContext({ hex: makeHex(TerrainType.Desert) });
      const result = CombatResolver.resolve(ctx);

      // attack 50 × 0.9 = 45, then supply: attack=49.5, defense=55
      // defenderDamage = 49.5 - 27.5 = 22
      // attackerDamage = 55 - 24.75 = 30.25
      expect(result.defenderDamage).toBeCloseTo(22, 2);
      expect(result.attackerDamage).toBeCloseTo(30.25, 2);
    });

    it('Urban terrain causes civilian casualties', () => {
      const ctx = baseContext({ hex: makeHex(TerrainType.Urban) });
      const result = CombatResolver.resolve(ctx);
      expect(result.civilianCasualties).toBe(true);
    });
  });

  // ── Supply Line ────────────────────────────────────────

  describe('supply line modifiers', () => {
    it('intact supply gives +10% to both sides', () => {
      const ctx = baseContext();
      const result = CombatResolver.resolve(ctx);
      // Both supply intact → symmetric
      expect(result.supplyModifierApplied).toBeCloseTo(0.2, 3); // 0.1 + 0.1
    });

    it('severed attacker supply penalizes attack by −20%', () => {
      const ctx = baseContext({ attackerSupplyIntact: false });
      const result = CombatResolver.resolve(ctx);

      // attack 50 × 0.8 = 40, defense 50 × 1.1 = 55
      // defenderDamage = 40 - 27.5 = 12.5
      // attackerDamage = 55 - 20 = 35
      expect(result.defenderDamage).toBeCloseTo(12.5, 2);
      expect(result.attackerDamage).toBeCloseTo(35, 2);
    });
  });

  // ── Morale ─────────────────────────────────────────────

  describe('morale modifiers', () => {
    it('low attacker morale reduces attack effectiveness', () => {
      const ctx = baseContext({
        attacker: makeUnit({ morale: 20 }),
      });
      const result = CombatResolver.resolve(ctx);

      // attack=50, supply: 55, morale penalty: 55*0.85=46.75
      // defense=50, supply: 55
      // defenderDamage = 46.75 - 27.5 = 19.25
      expect(result.defenderDamage).toBeCloseTo(19.25, 2);
      expect(result.moraleModifierApplied).toBeLessThan(0);
    });

    it('high defender morale boosts defense effectiveness', () => {
      const ctx = baseContext({
        defender: makeUnit({
          id: 'unit-test-002' as UnitId,
          factionId: FactionId.China,
          morale: 80,
        }),
      });
      const result = CombatResolver.resolve(ctx);

      // defense=50, supply: 55, morale bonus: 55*1.1=60.5
      // attack=50, supply: 55
      // defenderDamage = 55 - 30.25 = 24.75
      // attackerDamage = 60.5 - 27.5 = 33
      expect(result.defenderDamage).toBeCloseTo(24.75, 2);
      expect(result.attackerDamage).toBeCloseTo(33, 2);
    });
  });

  // ── Tech Differential ──────────────────────────────────

  describe('tech differential', () => {
    it('attacker tech advantage boosts attack', () => {
      const ctx = baseContext({
        attackerTechLevel: 70,
        defenderTechLevel: 50,
      });
      const result = CombatResolver.resolve(ctx);

      // diff=20, raw=1.0, capped=0.25
      // attack=50, supply: 55, tech: 55*1.25=68.75
      // defense=50, supply: 55
      // defenderDamage = 68.75 - 27.5 = 41.25
      expect(result.defenderDamage).toBeCloseTo(41.25, 2);
      expect(result.techModifierApplied).toBeCloseTo(0.25, 3);
    });

    it('cap prevents excessive bonus', () => {
      const ctx = baseContext({
        attackerTechLevel: 100,
        defenderTechLevel: 0,
      });
      const result = CombatResolver.resolve(ctx);
      // diff=100, raw=5.0, capped=0.25 → same max as above
      expect(result.techModifierApplied).toBeCloseTo(0.25, 3);
    });
  });

  // ── FR-803: SAM Bypass ─────────────────────────────────

  describe('FR-803 SAM bypass', () => {
    it('CyberWarfare bypasses SAM (defense halved)', () => {
      const ctx = baseContext({
        attacker: makeUnit({
          unitType: UnitType.CyberWarfare,
          attackPower: 90,
          defensePower: 10,
          hp: 30,
        }),
      });
      const result = CombatResolver.resolve(ctx);

      // attack=90, supply: 99, defense=50, supply: 55, SAM bypass: 27.5
      // defenderDamage = 99 - 13.75 = 85.25
      // attackerDamage = 27.5 - 49.5 = 0
      expect(result.bypassedSAM).toBe(true);
      expect(result.defenderDamage).toBeCloseTo(85.25, 2);
      expect(result.attackerDamage).toBeCloseTo(0, 2);
    });

    it('HypersonicMissile bypasses SAM', () => {
      const ctx = baseContext({
        attacker: makeUnit({
          unitType: UnitType.HypersonicMissile,
          attackPower: 95,
          defensePower: 5,
          hp: 20,
        }),
      });
      const result = CombatResolver.resolve(ctx);
      expect(result.bypassedSAM).toBe(true);
    });

    it('NextGen IAD blocks CyberWarfare SAM bypass', () => {
      const ctx = baseContext({
        attacker: makeUnit({
          unitType: UnitType.CyberWarfare,
          attackPower: 90,
          defensePower: 10,
          hp: 30,
        }),
        defenderHasNextGenIAD: true,
      });
      const result = CombatResolver.resolve(ctx);
      expect(result.bypassedSAM).toBe(false);
    });
  });

  // ── Island Terrain ─────────────────────────────────────

  describe('island terrain', () => {
    it('has no terrain modifier in combat resolver', () => {
      const ctx = baseContext({ hex: makeHex(TerrainType.Island) });
      const result = CombatResolver.resolve(ctx);

      // Island terrain not handled in combat switch → no terrain mod
      expect(result.terrainModifierApplied).toBe(0);
      // Combat should still produce valid results
      expect(result.defenderDamage).toBeCloseTo(27.5, 2);
    });
  });

  // ── Low Readiness ──────────────────────────────────────

  describe('low readiness penalty', () => {
    it('attacker with low supply status gets penalty', () => {
      const ctx = baseContext({
        attacker: makeUnit({ supplyStatus: 20 }),
      });
      const result = CombatResolver.resolve(ctx);

      // attack=50, supply intact: 55, readiness penalty: 55*0.75=41.25
      // defense=50, supply intact: 55
      // defenderDamage = 41.25 - 27.5 = 13.75
      expect(result.defenderDamage).toBeCloseTo(13.75, 2);
    });
  });

  // ── Combined Modifiers ─────────────────────────────────

  describe('combined modifiers', () => {
    it('mountain + severed supply + low morale = heavy attacker disadvantage', () => {
      const ctx = baseContext({
        hex: makeHex(TerrainType.Mountain),
        attacker: makeUnit({ morale: 20 }),
        attackerSupplyIntact: false,
      });
      const result = CombatResolver.resolve(ctx);

      // attack=50, mountain: no attack mod
      // defense=50*1.3=65
      // supply: attack*0.8=40, defense*1.1=71.5
      // morale: attack*0.85=34
      // defenderDamage = 34 - 35.75 = 0 (clamped)
      // attackerDamage = 71.5 - 17 = 54.5
      expect(result.defenderDamage).toBeCloseTo(0, 2);
      expect(result.attackerDamage).toBeCloseTo(54.5, 2);
    });
  });

  // ── Unit Destruction ───────────────────────────────────

  describe('unit destruction', () => {
    it('both units destroyed when HP is low enough', () => {
      const ctx = baseContext({
        attacker: makeUnit({ hp: 10 }),
        defender: makeUnit({
          id: 'unit-test-002' as UnitId,
          factionId: FactionId.China,
          hp: 10,
        }),
      });
      const result = CombatResolver.resolve(ctx);

      // damage ≈ 27.5 each, both start at 10 HP
      expect(result.attackerDestroyed).toBe(true);
      expect(result.defenderDestroyed).toBe(true);
    });

    it('only defender destroyed when attacker has high HP', () => {
      const ctx = baseContext({
        attacker: makeUnit({ hp: 100, attackPower: 80 }),
        defender: makeUnit({
          id: 'unit-test-002' as UnitId,
          factionId: FactionId.China,
          hp: 10,
          defensePower: 20,
        }),
      });
      const result = CombatResolver.resolve(ctx);

      expect(result.defenderDestroyed).toBe(true);
      expect(result.attackerDestroyed).toBe(false);
    });
  });

  // ── Supply Status ──────────────────────────────────────

  describe('calculateSupplyStatus', () => {
    it('connected when unit is on a friendly hex', () => {
      const grid = HexGrid.create(5, 5);
      const hex = grid.get(hexIdFromAxial(0, 0))!;
      (hex as { nationControl: string | null }).nationControl = FactionId.US;

      const unit = makeUnit({ position: hexIdFromAxial(0, 0) });
      const status = CombatResolver.calculateSupplyStatus(unit, grid, FactionId.US);

      expect(status.connected).toBe(true);
      expect(status.distanceToSource).toBe(0);
      expect(status.effectiveness).toBe(100);
    });

    it('isolated when no friendly hexes exist', () => {
      const grid = HexGrid.create(3, 3);
      // All hexes have nationControl = null (default)
      const unit = makeUnit({ position: hexIdFromAxial(0, 0) });
      const status = CombatResolver.calculateSupplyStatus(unit, grid, FactionId.US);

      expect(status.connected).toBe(false);
      expect(status.effectiveness).toBe(0);
    });

    it('effectiveness decreases with distance from supply', () => {
      const grid = HexGrid.create(10, 1);
      // Set hex (0,0) as US-controlled
      const hex = grid.get(hexIdFromAxial(0, 0))!;
      (hex as { nationControl: string | null }).nationControl = FactionId.US;

      // Unit at distance 4 from supply
      const unit = makeUnit({ position: hexIdFromAxial(4, 0) });
      const status = CombatResolver.calculateSupplyStatus(unit, grid, FactionId.US);

      expect(status.connected).toBe(true);
      expect(status.distanceToSource).toBe(4);
      // effectiveness = 100 - 4*5 = 80
      expect(status.effectiveness).toBe(80);
    });
  });

  // ── Supply Degradation ─────────────────────────────────

  describe('applySupplyDegradation', () => {
    it('cut supply degrades by 15 per turn', () => {
      const unit = makeUnit({ supplyStatus: 100 });
      expect(CombatResolver.applySupplyDegradation(unit, false)).toBe(85);
    });

    it('cut supply clamps to 0', () => {
      const unit = makeUnit({ supplyStatus: 10 });
      expect(CombatResolver.applySupplyDegradation(unit, false)).toBe(0);
    });

    it('connected supply recovers by 10 per turn', () => {
      const unit = makeUnit({ supplyStatus: 80 });
      expect(CombatResolver.applySupplyDegradation(unit, true)).toBe(90);
    });

    it('connected supply clamps to 100', () => {
      const unit = makeUnit({ supplyStatus: 95 });
      expect(CombatResolver.applySupplyDegradation(unit, true)).toBe(100);
    });
  });
});
