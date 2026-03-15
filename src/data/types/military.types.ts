/**
 * Military & Intelligence Types — DR-103, DR-109, DR-110
 *
 * Unit-level combat data, intelligence agency capabilities,
 * and national force structure.
 */

import type { FactionId, UnitId, UnitType, HexId, Doctrine, TurnNumber } from './enums';

// ---------------------------------------------------------------------------
// DR-103 — Unit Registry
// ---------------------------------------------------------------------------

/**
 * A single military unit on the hex map.
 */
export interface Unit {
  readonly id: UnitId;
  /** Owning faction. */
  factionId: FactionId;
  /** Classification of this unit. */
  unitType: UnitType;
  /** Current hit points. Range: 0–100. */
  hp: number;
  /** Offensive combat power. Range: 0–100. */
  attackPower: number;
  /** Defensive combat power. Range: 0–100. */
  defensePower: number;
  /** Hexes this unit can traverse per turn. Range: 0–10. */
  movementRange: number;
  /** Special abilities (e.g. "Stealth", "EMP", "AntiAir"). */
  specialAbilities: string[];
  /** Current supply/logistics status. Range: 0–100. */
  supplyStatus: number;
  /** Unit morale. Range: 0–100. Low morale degrades combat effectiveness. */
  morale: number;
  /** Current hex location. */
  position: HexId;
  /**
   * Whether this is a ghost unit (false intelligence).
   * Ghost units exist on the map for the opposing player but have no combat value.
   */
  isGhost: boolean;
}

/**
 * The full unit registry keyed by UnitId.
 */
export type UnitRegistry = Record<UnitId, Unit>;

// ---------------------------------------------------------------------------
// DR-109 — Intelligence Capability Matrix
// ---------------------------------------------------------------------------

/** Intelligence sub-scores for a nation. */
export interface IntelligenceCapabilities {
  /** Human intelligence capability. Range: 0–100. */
  humint: number;
  /** Signals intelligence capability. Range: 0–100. */
  sigint: number;
  /** Cyber operations capability. Range: 0–100. */
  cyber: number;
  /** Covert operations capability. Range: 0–100. */
  covert: number;
  /** Counter-intelligence rating. Range: 0–100. */
  counterIntel: number;
}

/** A single intelligence operation in the log. */
export interface IntelOperation {
  /** Unique operation identifier. */
  operationName: string;
  /** Type: HUMINT, SIGINT, CYBER, COVERT. */
  type: 'HUMINT' | 'SIGINT' | 'CYBER' | 'COVERT';
  /** Target nation. */
  targetFaction: FactionId;
  /** Turn this operation was launched. */
  turnLaunched: TurnNumber;
  /** Whether the operation is still active. */
  active: boolean;
  /** Whether the operation has been discovered by the target. */
  discovered: boolean;
  /** Outcome description (populated on completion). */
  outcome: string | null;
}

/** A planted intelligence asset. */
export interface IntelAsset {
  /** Code name of the asset. */
  codeName: string;
  /** Nation where the asset is embedded. */
  targetFaction: FactionId;
  /** Reliability of intelligence from this asset. Range: 0–100. */
  reliability: number;
  /** Risk of exposure per turn. Range: 0–100. */
  exposureRisk: number;
  /** Whether the asset is still active. */
  active: boolean;
}

/**
 * Per-nation intelligence capability matrix (DR-109).
 */
export interface IntelligenceCapabilityMatrix {
  factionId: FactionId;
  capabilities: IntelligenceCapabilities;
  operationsLog: IntelOperation[];
  assetRegistry: IntelAsset[];
}

// ---------------------------------------------------------------------------
// DR-110 — Military Force Structure
// ---------------------------------------------------------------------------

/**
 * Per-nation military force structure.
 *
 * Represents the aggregate military power of a faction,
 * separate from individual unit-level data in the Unit Registry.
 */
export interface MilitaryForceStructure {
  factionId: FactionId;

  /** Total active military personnel (in thousands). */
  activeForces: number;

  /** Size of nuclear arsenal (warhead count). */
  nuclearArsenal: number;

  /** Aggregate naval power score. Range: 0–100. */
  navalPower: number;

  /** Aggregate air power score. Range: 0–100. */
  airPower: number;

  /** Notable special capabilities (e.g. "Hypersonic Missiles", "Space Weapons"). */
  specialCapability: string[];

  /**
   * Ability to deploy military power beyond borders.
   * Function of naval reach, airlift capacity, overseas bases, logistics.
   * Range: 0–100.
   */
  forceProjection: number;

  /** Overall readiness state. Range: 0–100. */
  readiness: number;

  /** Military doctrine governing force employment. */
  doctrine: Doctrine;

  /** Military technology level. Range: 0–100. */
  techLevel: number;
}
