import { describe, it, expect } from 'vitest';
import {
  UNIT_TEMPLATES,
  UnitFactory,
  UnitRegistryManager,
  canBypassSAM,
} from '@/engine/unit-registry';
import { UnitType, FactionId } from '@/data/types';

import type { HexId, UnitId } from '@/data/types';
import type { Unit } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const POS = '0:0' as HexId;
const FACTION = FactionId.US;

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-000001' as UnitId,
    factionId: FactionId.US,
    unitType: UnitType.Infantry,
    hp: 100,
    attackPower: 40,
    defensePower: 50,
    movementRange: 2,
    specialAbilities: ['Garrison', 'UrbanWarfare'],
    supplyStatus: 100,
    morale: 100,
    position: POS,
    isGhost: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('UNIT_TEMPLATES', () => {
  it('contains all 8 unit types', () => {
    const keys = Object.keys(UNIT_TEMPLATES);
    expect(keys).toHaveLength(8);
  });

  it('every template has required numeric stats', () => {
    for (const ut of Object.values(UnitType)) {
      const t = UNIT_TEMPLATES[ut];
      expect(t.baseHp).toBeGreaterThan(0);
      expect(t.baseAttack).toBeGreaterThanOrEqual(0);
      expect(t.baseDefense).toBeGreaterThanOrEqual(0);
      expect(t.baseMovement).toBeGreaterThanOrEqual(0);
    }
  });

  it('CyberWarfare and HypersonicMissile bypass SAM', () => {
    expect(UNIT_TEMPLATES[UnitType.CyberWarfare].bypassesSAM).toBe(true);
    expect(UNIT_TEMPLATES[UnitType.HypersonicMissile].bypassesSAM).toBe(true);
  });
});

describe('UnitFactory', () => {
  describe('createUnit', () => {
    it('generates a unit with a unique ID', () => {
      const factory = new UnitFactory();
      const u1 = factory.createUnit(FACTION, UnitType.Infantry, POS);
      const u2 = factory.createUnit(FACTION, UnitType.Armor, POS);
      expect(u1.id).not.toBe(u2.id);
    });

    it('populates stats from the template', () => {
      const factory = new UnitFactory();
      const unit = factory.createUnit(FACTION, UnitType.Armor, POS);
      const template = UNIT_TEMPLATES[UnitType.Armor];
      expect(unit.hp).toBe(template.baseHp);
      expect(unit.attackPower).toBe(template.baseAttack);
      expect(unit.defensePower).toBe(template.baseDefense);
      expect(unit.movementRange).toBe(template.baseMovement);
    });

    it('applies custom overrides', () => {
      const factory = new UnitFactory();
      const unit = factory.createUnit(FACTION, UnitType.Infantry, POS, {
        hp: 50,
        morale: 30,
      });
      expect(unit.hp).toBe(50);
      expect(unit.morale).toBe(30);
    });
  });

  describe('createGhostUnit', () => {
    it('creates a unit with isGhost === true', () => {
      const factory = new UnitFactory();
      const ghost = factory.createGhostUnit(FACTION, UnitType.Armor, POS);
      expect(ghost.isGhost).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('returns the matching template', () => {
      const factory = new UnitFactory();
      const tmpl = factory.getTemplate(UnitType.Naval);
      expect(tmpl.category).toBe('sea');
      expect(tmpl.baseMovement).toBe(5);
    });
  });
});

describe('UnitRegistryManager', () => {
  // ── CRUD ───────────────────────────────────────────────

  describe('add / get / has / remove', () => {
    it('adds and retrieves a unit', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      expect(mgr.get(unit.id)).toBe(unit);
    });

    it('has returns true for existing unit', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      expect(mgr.has(unit.id)).toBe(true);
    });

    it('remove deletes a unit and returns true', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      expect(mgr.remove(unit.id)).toBe(true);
      expect(mgr.has(unit.id)).toBe(false);
    });

    it('remove returns false for non-existent unit', () => {
      const mgr = new UnitRegistryManager();
      expect(mgr.remove('nope' as UnitId)).toBe(false);
    });
  });

  // ── Queries ────────────────────────────────────────────

  describe('queries', () => {
    function populatedManager(): UnitRegistryManager {
      const factory = new UnitFactory();
      const mgr = new UnitRegistryManager();
      mgr.add(factory.createUnit(FactionId.US, UnitType.Infantry, '0:0' as HexId));
      mgr.add(factory.createUnit(FactionId.US, UnitType.Armor, '1:0' as HexId));
      mgr.add(factory.createUnit(FactionId.China, UnitType.Infantry, '0:0' as HexId));
      mgr.add(factory.createUnit(FactionId.China, UnitType.Naval, '2:0' as HexId));
      return mgr;
    }

    it('getByFaction returns correct units', () => {
      const mgr = populatedManager();
      expect(mgr.getByFaction(FactionId.US)).toHaveLength(2);
    });

    it('getByType returns correct units', () => {
      const mgr = populatedManager();
      expect(mgr.getByType(UnitType.Infantry)).toHaveLength(2);
    });

    it('getAtPosition returns units at the given hex', () => {
      const mgr = populatedManager();
      expect(mgr.getAtPosition('0:0' as HexId)).toHaveLength(2);
    });

    it('getByFactionAndType returns correct intersection', () => {
      const mgr = populatedManager();
      const result = mgr.getByFactionAndType(FactionId.China, UnitType.Infantry);
      expect(result).toHaveLength(1);
      expect(result[0]?.factionId).toBe(FactionId.China);
    });
  });

  // ── Mutations ──────────────────────────────────────────

  describe('mutations', () => {
    it('moveUnit updates position', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      const ok = mgr.moveUnit(unit.id, '5:5' as HexId);
      expect(ok).toBe(true);
      expect(mgr.get(unit.id)?.position).toBe('5:5');
    });

    it('moveUnit returns false for missing unit', () => {
      const mgr = new UnitRegistryManager();
      expect(mgr.moveUnit('nope' as UnitId, POS)).toBe(false);
    });

    it('damageUnit reduces HP and returns true when surviving', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit({ hp: 100 });
      mgr.add(unit);
      expect(mgr.damageUnit(unit.id, 30)).toBe(true);
      expect(mgr.get(unit.id)?.hp).toBe(70);
    });

    it('damageUnit destroys unit at 0 HP and returns false', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit({ hp: 10 });
      mgr.add(unit);
      expect(mgr.damageUnit(unit.id, 20)).toBe(false);
      expect(mgr.has(unit.id)).toBe(false);
    });

    it('healUnit increases HP capped at 100', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit({ hp: 50 });
      mgr.add(unit);
      mgr.healUnit(unit.id, 30);
      expect(mgr.get(unit.id)?.hp).toBe(80);
      mgr.healUnit(unit.id, 30);
      expect(mgr.get(unit.id)?.hp).toBe(100);
    });

    it('setMorale clamps to 0–100', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      mgr.setMorale(unit.id, 200);
      expect(mgr.get(unit.id)?.morale).toBe(100);
      mgr.setMorale(unit.id, -10);
      expect(mgr.get(unit.id)?.morale).toBe(0);
    });

    it('setSupplyStatus clamps to 0–100', () => {
      const mgr = new UnitRegistryManager();
      const unit = makeUnit();
      mgr.add(unit);
      mgr.setSupplyStatus(unit.id, 150);
      expect(mgr.get(unit.id)?.supplyStatus).toBe(100);
      mgr.setSupplyStatus(unit.id, -5);
      expect(mgr.get(unit.id)?.supplyStatus).toBe(0);
    });
  });

  // ── Serialization ──────────────────────────────────────

  describe('toUnitRegistry / fromUnitRegistry roundtrip', () => {
    it('preserves all units through serialization', () => {
      const factory = new UnitFactory();
      const mgr = new UnitRegistryManager();
      mgr.add(factory.createUnit(FACTION, UnitType.Infantry, POS));
      mgr.add(factory.createUnit(FACTION, UnitType.Armor, POS));

      const registry = mgr.toUnitRegistry();
      const mgr2 = UnitRegistryManager.fromUnitRegistry(registry);

      expect(mgr2.size).toBe(2);
    });
  });

  // ── Iteration ──────────────────────────────────────────

  describe('forEach', () => {
    it('visits every unit', () => {
      const factory = new UnitFactory();
      const mgr = new UnitRegistryManager();
      mgr.add(factory.createUnit(FACTION, UnitType.Infantry, POS));
      mgr.add(factory.createUnit(FACTION, UnitType.Armor, POS));

      const ids: UnitId[] = [];
      mgr.forEach((_unit, id) => {
        ids.push(id);
      });
      expect(ids).toHaveLength(2);
    });
  });

  describe('size', () => {
    it('reflects current unit count', () => {
      const mgr = new UnitRegistryManager();
      expect(mgr.size).toBe(0);
      mgr.add(makeUnit());
      expect(mgr.size).toBe(1);
    });
  });
});

describe('canBypassSAM', () => {
  it('CyberWarfare bypasses SAM when no NextGen IAD', () => {
    const unit = makeUnit({ unitType: UnitType.CyberWarfare });
    expect(canBypassSAM(unit, false)).toBe(true);
  });

  it('HypersonicMissile bypasses SAM when no NextGen IAD', () => {
    const unit = makeUnit({ unitType: UnitType.HypersonicMissile });
    expect(canBypassSAM(unit, false)).toBe(true);
  });

  it('Infantry never bypasses SAM', () => {
    const unit = makeUnit({ unitType: UnitType.Infantry });
    expect(canBypassSAM(unit, false)).toBe(false);
  });

  it('NextGen IAD blocks CyberWarfare bypass', () => {
    const unit = makeUnit({ unitType: UnitType.CyberWarfare });
    expect(canBypassSAM(unit, true)).toBe(false);
  });
});
