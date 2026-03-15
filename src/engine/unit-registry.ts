/**
 * Unit Registry — FR-802, FR-803 (CNFL-0301)
 *
 * Provides unit templates, a factory for creating units, and a manager
 * class that wraps the UnitRegistry Record with typed query / mutation helpers.
 *
 * FR-802: Eight modern unit types with unique stat blocks.
 * FR-803: Cyber Warfare Suites & Hypersonic Missiles bypass traditional SAM
 *         unless the defender has "Next-Gen Integrated Air Defense."
 */

import type { FactionId, HexId, UnitId, UnitType } from '@/data/types/enums';
import { UnitType as UT } from '@/data/types/enums';
import type { Unit, UnitRegistry } from '@/data/types/military.types';

// ---------------------------------------------------------------------------
// UnitTemplate — static stat block for each UnitType
// ---------------------------------------------------------------------------

/** Category classification for the unit. */
export type UnitCategory = 'land' | 'sea' | 'air' | 'cyber' | 'strategic';

/** Static stat block shared by every instance of a given UnitType. */
export interface UnitTemplate {
  readonly baseHp: number;
  readonly baseAttack: number;
  readonly baseDefense: number;
  readonly baseMovement: number;
  readonly specialAbilities: readonly string[];
  readonly bypassesSAM: boolean;
  readonly requiresNavalSupremacy: boolean;
  readonly isNuclearCapable: boolean;
  readonly category: UnitCategory;
}

// ---------------------------------------------------------------------------
// UNIT_TEMPLATES — canonical stat blocks (FR-802)
// ---------------------------------------------------------------------------

export const UNIT_TEMPLATES: Readonly<Record<UnitType, UnitTemplate>> = {
  [UT.Infantry]: {
    baseHp: 100,
    baseAttack: 40,
    baseDefense: 50,
    baseMovement: 2,
    specialAbilities: ['Garrison', 'UrbanWarfare'],
    bypassesSAM: false,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'land',
  },
  [UT.Armor]: {
    baseHp: 80,
    baseAttack: 70,
    baseDefense: 60,
    baseMovement: 3,
    specialAbilities: ['Breakthrough', 'ArmoredAssault'],
    bypassesSAM: false,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'land',
  },
  [UT.Naval]: {
    baseHp: 90,
    baseAttack: 60,
    baseDefense: 50,
    baseMovement: 5,
    specialAbilities: ['Bombardment', 'SeaControl'],
    bypassesSAM: false,
    requiresNavalSupremacy: true,
    isNuclearCapable: false,
    category: 'sea',
  },
  [UT.Air]: {
    baseHp: 60,
    baseAttack: 80,
    baseDefense: 30,
    baseMovement: 8,
    specialAbilities: ['AirSuperiority', 'GroundStrike', 'Reconnaissance'],
    bypassesSAM: false,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'air',
  },
  [UT.CyberWarfare]: {
    baseHp: 30,
    baseAttack: 90,
    baseDefense: 10,
    baseMovement: 0,
    specialAbilities: ['EMP', 'NetworkIntrusion', 'InfrastructureDisruption', 'BypassSAM'],
    bypassesSAM: true,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'cyber',
  },
  [UT.HypersonicMissile]: {
    baseHp: 20,
    baseAttack: 95,
    baseDefense: 5,
    baseMovement: 10,
    specialAbilities: ['PrecisionStrike', 'BypassSAM', 'TimeCompression'],
    bypassesSAM: true,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'strategic',
  },
  [UT.FishingFleet]: {
    baseHp: 40,
    baseAttack: 20,
    baseDefense: 15,
    baseMovement: 4,
    specialAbilities: ['MaritimeMilitia', 'GrayZone', 'IntelGathering'],
    bypassesSAM: false,
    requiresNavalSupremacy: false,
    isNuclearCapable: false,
    category: 'sea',
  },
  [UT.MobileNuclearLauncher]: {
    baseHp: 50,
    baseAttack: 100,
    baseDefense: 20,
    baseMovement: 1,
    specialAbilities: ['NuclearStrike', 'Concealment', 'SecondStrike'],
    bypassesSAM: false,
    requiresNavalSupremacy: false,
    isNuclearCapable: true,
    category: 'strategic',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers — value clamping
// ---------------------------------------------------------------------------

/** Clamp a value to an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// UnitFactory — creates Unit instances from templates
// ---------------------------------------------------------------------------

/**
 * Factory for spawning new Unit instances.
 *
 * Each factory maintains a monotonically-increasing counter so that every
 * unit it produces receives a globally-unique {@link UnitId}.
 */
export class UnitFactory {
  private counter = 0;

  /** Return the canonical template for a given unit classification. */
  getTemplate(unitType: UnitType): UnitTemplate {
    return UNIT_TEMPLATES[unitType];
  }

  /**
   * Create a concrete {@link Unit} from a template, optionally overriding
   * any field except `id`.
   */
  createUnit(
    factionId: FactionId,
    unitType: UnitType,
    position: HexId,
    overrides?: Partial<Omit<Unit, 'id'>>,
  ): Unit {
    const template = this.getTemplate(unitType);
    const id = this.nextId();

    return {
      id,
      factionId,
      unitType,
      hp: clamp(overrides?.hp ?? template.baseHp, 0, 100),
      attackPower: clamp(overrides?.attackPower ?? template.baseAttack, 0, 100),
      defensePower: clamp(overrides?.defensePower ?? template.baseDefense, 0, 100),
      movementRange: clamp(overrides?.movementRange ?? template.baseMovement, 0, 10),
      specialAbilities: overrides?.specialAbilities ?? [...template.specialAbilities],
      supplyStatus: clamp(overrides?.supplyStatus ?? 100, 0, 100),
      morale: clamp(overrides?.morale ?? 100, 0, 100),
      position: overrides?.position ?? position,
      isGhost: overrides?.isGhost ?? false,
    };
  }

  /**
   * Create a ghost unit used for intelligence deception.
   * Ghost units appear on the opponent's map but have no real combat value.
   */
  createGhostUnit(factionId: FactionId, unitType: UnitType, position: HexId): Unit {
    return this.createUnit(factionId, unitType, position, { isGhost: true });
  }

  // ── internal ──────────────────────────────────────────────────────────
  private nextId(): UnitId {
    this.counter += 1;
    return `unit-${String(this.counter).padStart(6, '0')}` as UnitId;
  }
}

// ---------------------------------------------------------------------------
// UnitRegistryManager — typed wrapper around UnitRegistry Record
// ---------------------------------------------------------------------------

/**
 * Mutable manager that wraps a plain {@link UnitRegistry} Record with
 * ergonomic query and mutation helpers.
 */
export class UnitRegistryManager {
  private readonly units: Map<UnitId, Unit>;

  constructor(existing?: UnitRegistry) {
    this.units = new Map<UnitId, Unit>();
    if (existing) {
      for (const key of Object.keys(existing)) {
        const id = key as UnitId;
        const unit = existing[id];
        if (unit) {
          this.units.set(id, unit);
        }
      }
    }
  }

  // ── size ────────────────────────────────────────────────────────────────
  /** Number of units currently in the registry. */
  get size(): number {
    return this.units.size;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  /** Add a unit to the registry (replaces if id already exists). */
  add(unit: Unit): void {
    this.units.set(unit.id, unit);
  }

  /** Remove a unit by id. Returns `true` if the unit existed. */
  remove(id: UnitId): boolean {
    return this.units.delete(id);
  }

  /** Retrieve a unit by id, or `undefined` if not found. */
  get(id: UnitId): Unit | undefined {
    return this.units.get(id);
  }

  /** Check whether a unit with the given id exists. */
  has(id: UnitId): boolean {
    return this.units.has(id);
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Return all units belonging to a faction. */
  getByFaction(factionId: FactionId): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.factionId === factionId) result.push(unit);
    }
    return result;
  }

  /** Return all units of a specific type across all factions. */
  getByType(unitType: UnitType): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.unitType === unitType) result.push(unit);
    }
    return result;
  }

  /** Return all units currently occupying a hex. */
  getAtPosition(position: HexId): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.position === position) result.push(unit);
    }
    return result;
  }

  /** Return units matching both faction and type. */
  getByFactionAndType(factionId: FactionId, unitType: UnitType): Unit[] {
    const result: Unit[] = [];
    for (const unit of this.units.values()) {
      if (unit.factionId === factionId && unit.unitType === unitType) {
        result.push(unit);
      }
    }
    return result;
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  /**
   * Move a unit to a new hex. Returns `false` if the unit does not exist.
   */
  moveUnit(id: UnitId, newPosition: HexId): boolean {
    const unit = this.units.get(id);
    if (!unit) return false;
    unit.position = newPosition;
    return true;
  }

  /**
   * Apply damage to a unit. HP is clamped to 0–100.
   * Returns `false` (and removes the unit) if HP reaches zero.
   * Returns `true` if the unit survives.
   */
  damageUnit(id: UnitId, damage: number): boolean {
    const unit = this.units.get(id);
    if (!unit) return false;
    unit.hp = clamp(unit.hp - damage, 0, 100);
    if (unit.hp <= 0) {
      this.units.delete(id);
      return false;
    }
    return true;
  }

  /** Heal a unit, clamped to max 100 HP. No-op if unit not found. */
  healUnit(id: UnitId, amount: number): void {
    const unit = this.units.get(id);
    if (!unit) return;
    unit.hp = clamp(unit.hp + amount, 0, 100);
  }

  /** Set morale for a unit, clamped to 0–100. */
  setMorale(id: UnitId, morale: number): void {
    const unit = this.units.get(id);
    if (!unit) return;
    unit.morale = clamp(morale, 0, 100);
  }

  /** Set supply status for a unit, clamped to 0–100. */
  setSupplyStatus(id: UnitId, status: number): void {
    const unit = this.units.get(id);
    if (!unit) return;
    unit.supplyStatus = clamp(status, 0, 100);
  }

  // ── Serialisation ───────────────────────────────────────────────────────

  /** Serialise the registry back to a plain {@link UnitRegistry} Record. */
  toUnitRegistry(): UnitRegistry {
    const registry: Record<string, Unit> = {};
    for (const [id, unit] of this.units) {
      registry[id] = unit;
    }
    return registry as UnitRegistry;
  }

  /** Construct a manager from an existing plain registry. */
  static fromUnitRegistry(registry: UnitRegistry): UnitRegistryManager {
    return new UnitRegistryManager(registry);
  }

  // ── Iteration ───────────────────────────────────────────────────────────

  /** Iterate over every unit in the registry. */
  forEach(callback: (unit: Unit, id: UnitId) => void): void {
    for (const [id, unit] of this.units) {
      callback(unit, id);
    }
  }
}

// ---------------------------------------------------------------------------
// FR-803 — SAM Bypass Logic
// ---------------------------------------------------------------------------

/**
 * Determine whether an attacking unit bypasses traditional SAM defences.
 *
 * **FR-803**: Cyber Warfare Suites and Hypersonic Missiles bypass SAM
 * **unless** the defender has "Next-Gen Integrated Air Defense."
 *
 * @param attacker - The attacking unit.
 * @param defenderHasNextGenIAD - Whether the defending force has Next-Gen IAD.
 * @returns `true` if the attacker bypasses SAM, `false` otherwise.
 */
export function canBypassSAM(attacker: Unit, defenderHasNextGenIAD: boolean): boolean {
  const template = UNIT_TEMPLATES[attacker.unitType];
  if (!template.bypassesSAM) return false;
  return !defenderHasNextGenIAD;
}
