/**
 * Force Structure & Projection Engine — FR-1001, FR-1002
 *
 * Pure-function engine for modelling national military force structures and
 * computing force-projection range (max hex reach from national borders).
 *
 * No side effects, no DOM access, no RNG.
 *
 * @module engine/force-structure
 */

import { GAME_CONFIG } from '@/engine/config';

import type { FactionId } from '@/data/types';

// ── Config ──────────────────────────────────────────────────────────────────

/**
 * Military configuration subset extracted from {@link GAME_CONFIG}.
 *
 * @see FR-1001
 * @see FR-1002
 */
export type MilitaryConfig = typeof GAME_CONFIG.military;

// ── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Aggregate military force structure for a single faction.
 *
 * All numeric fields use a 0-100 normalised scale.
 *
 * @see FR-1001
 */
export interface ForceStructure {
  /** Owning faction. */
  readonly factionId: FactionId;
  /** Aggregate military strength (0-100). */
  readonly activeForces: number;
  /** Nuclear arsenal score (0-100). */
  readonly nuclearArsenal: number;
  /** Naval power score (0-100). */
  readonly navalPower: number;
  /** Air power score (0-100). */
  readonly airPower: number;
  /** Special capability keys (e.g. "HypersonicMissiles"). */
  readonly specialCapabilities: readonly string[];
  /** Ability to project force beyond national borders (0-100). */
  readonly forceProjection: number;
  /** Overall readiness state (0-100). */
  readonly readiness: number;
}

/**
 * Inputs required to compute force projection range.
 *
 * @see FR-1002
 */
export interface ProjectionInput {
  /** The faction's current force structure. */
  readonly forceStructure: ForceStructure;
  /** Count of overseas bases. */
  readonly overseasBases: number;
  /** Count of deployed carrier groups. */
  readonly carrierDeployments: number;
}

/**
 * Result of a force-projection computation.
 *
 * @see FR-1002
 */
export interface ProjectionResult {
  /** Faction this projection belongs to. */
  readonly factionId: FactionId;
  /** Hex range before overseas-base and carrier bonuses. */
  readonly baseRange: number;
  /** Total bonus hex range from overseas bases. */
  readonly overseasBaseBonus: number;
  /** Total bonus hex range from carrier deployments. */
  readonly carrierBonus: number;
  /** Final clamped hex range. */
  readonly totalRange: number;
  /** True when forceProjection is below the border-only threshold. */
  readonly isBorderOnly: boolean;
  /** Human-readable summary of the projection calculation. */
  readonly description: string;
}

/**
 * Result of validating a {@link ForceStructure} record.
 *
 * @see FR-1001
 */
export interface ForceValidationResult {
  /** True when every field is within legal bounds. */
  readonly valid: boolean;
  /** Diagnostic messages for any out-of-range values. */
  readonly warnings: readonly string[];
}

/**
 * Inputs required to check whether a military action is within range.
 *
 * @see FR-1002
 */
export interface RangeCheckInput {
  /** The faction's computed projection result. */
  readonly projection: ProjectionResult;
  /** Hex distance from the nearest national border to the target. */
  readonly distanceFromBorder: number;
}

/**
 * Result of a range-check query.
 *
 * @see FR-1002
 */
export interface RangeCheckResult {
  /** True if the target hex is reachable. */
  readonly withinRange: boolean;
  /** Maximum hex range available. */
  readonly maxRange: number;
  /** Distance that was checked. */
  readonly distanceFromBorder: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Weights used to compute aggregate military power. @see FR-1001 */
const POWER_WEIGHTS = {
  activeForces: 0.3,
  navalPower: 0.2,
  airPower: 0.2,
  readiness: 0.2,
  nuclearDeterrent: 0.1,
} as const;

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Stateful (config-aware) engine for force-structure queries and
 * force-projection calculations.
 *
 * All public methods are pure — they never mutate their inputs.
 *
 * @see FR-1001
 * @see FR-1002
 */
export class ForceStructureEngine {
  private readonly cfg: MilitaryConfig;

  constructor(config?: MilitaryConfig) {
    this.cfg = config ?? GAME_CONFIG.military;
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /**
   * Create an immutable {@link ForceStructure} record.
   *
   * @see FR-1001
   */
  static createForceStructure(
    factionId: FactionId,
    activeForces: number,
    nuclearArsenal: number,
    navalPower: number,
    airPower: number,
    specialCapabilities: readonly string[],
    forceProjection: number,
    readiness: number,
  ): ForceStructure {
    return {
      factionId,
      activeForces,
      nuclearArsenal,
      navalPower,
      airPower,
      specialCapabilities: [...specialCapabilities],
      forceProjection,
      readiness,
    };
  }

  // ── Validation ──────────────────────────────────────────────────────────

  /**
   * Validate that every numeric field in a {@link ForceStructure} falls
   * within the legal 0-100 range.
   *
   * @see FR-1001
   */
  validateForceStructure(fs: ForceStructure): ForceValidationResult {
    const warnings: string[] = [];

    validateRange(warnings, 'activeForces', fs.activeForces);
    validateRange(warnings, 'nuclearArsenal', fs.nuclearArsenal);
    validateRange(warnings, 'navalPower', fs.navalPower);
    validateRange(warnings, 'airPower', fs.airPower);
    validateRange(warnings, 'forceProjection', fs.forceProjection);
    validateRange(warnings, 'readiness', fs.readiness);

    if (!Array.isArray(fs.specialCapabilities)) {
      warnings.push('specialCapabilities must be an array');
    }

    return { valid: warnings.length === 0, warnings };
  }

  // ── Force Projection ───────────────────────────────────────────────────

  /**
   * Compute the force-projection hex range for a faction.
   *
   * - Nations with `forceProjection < borderOnlyThreshold` are limited to
   *   border-adjacent hexes (`baseRange = 1`).
   * - Otherwise `baseRange = floor(forceProjection / hexRangeDivisor)`.
   * - Overseas bases add `+overseasBaseBonus` per base.
   * - Carrier deployments add `+carrierDeploymentBonus` per group.
   * - Total is clamped to `[minRange, maxRange]`.
   *
   * @see FR-1002
   */
  computeProjection(input: ProjectionInput): ProjectionResult {
    const { forceStructure, overseasBases, carrierDeployments } = input;
    const fp = forceStructure.forceProjection;
    const fpCfg = this.cfg.forceProjection;

    const isBorderOnly = fp < fpCfg.borderOnlyThreshold;

    const baseRange = isBorderOnly
      ? fpCfg.minRange
      : Math.floor(fp / fpCfg.hexRangeDivisor);

    const overseasBonus = overseasBases * fpCfg.overseasBaseBonus;
    const carrierBonus = carrierDeployments * fpCfg.carrierDeploymentBonus;

    const totalRange = clamp(
      baseRange + overseasBonus + carrierBonus,
      fpCfg.minRange,
      fpCfg.maxRange,
    );

    const description = isBorderOnly
      ? `${forceStructure.factionId}: border-only (fp=${fp}), range=${totalRange}`
      : `${forceStructure.factionId}: base=${baseRange} + bases(${overseasBonus}) + carriers(${carrierBonus}) = ${totalRange}`;

    return {
      factionId: forceStructure.factionId,
      baseRange,
      overseasBaseBonus: overseasBonus,
      carrierBonus,
      totalRange,
      isBorderOnly,
      description,
    };
  }

  // ── Range Check ─────────────────────────────────────────────────────────

  /**
   * Determine whether a military operation at a given hex distance from
   * the national border is within the faction's projection range.
   *
   * @see FR-1002
   */
  checkRange(input: RangeCheckInput): RangeCheckResult {
    const { projection, distanceFromBorder } = input;
    const withinRange = distanceFromBorder <= projection.totalRange;

    const reason = withinRange
      ? `Distance ${distanceFromBorder} is within max range ${projection.totalRange}`
      : `Distance ${distanceFromBorder} exceeds max range ${projection.totalRange}`;

    return {
      withinRange,
      maxRange: projection.totalRange,
      distanceFromBorder,
      reason,
    };
  }

  // ── Military Power ──────────────────────────────────────────────────────

  /**
   * Compute an aggregate military-power score as a weighted sum of force
   * structure components.
   *
   * Weights:
   * - activeForces  : 0.3
   * - navalPower    : 0.2
   * - airPower      : 0.2
   * - readiness     : 0.2
   * - nuclearArsenal: 0.1 (deterrent value)
   *
   * @see FR-1001
   */
  computeMilitaryPower(fs: ForceStructure): {
    readonly factionId: FactionId;
    readonly power: number;
    readonly breakdown: {
      readonly activeForces: number;
      readonly navalPower: number;
      readonly airPower: number;
      readonly readiness: number;
      readonly nuclearDeterrent: number;
    };
  } {
    const activeForces = fs.activeForces * POWER_WEIGHTS.activeForces;
    const navalPower = fs.navalPower * POWER_WEIGHTS.navalPower;
    const airPower = fs.airPower * POWER_WEIGHTS.airPower;
    const readiness = fs.readiness * POWER_WEIGHTS.readiness;
    const nuclearDeterrent = fs.nuclearArsenal * POWER_WEIGHTS.nuclearDeterrent;

    const power = activeForces + navalPower + airPower + readiness + nuclearDeterrent;

    return {
      factionId: fs.factionId,
      power: Math.round(power * 100) / 100,
      breakdown: {
        activeForces: Math.round(activeForces * 100) / 100,
        navalPower: Math.round(navalPower * 100) / 100,
        airPower: Math.round(airPower * 100) / 100,
        readiness: Math.round(readiness * 100) / 100,
        nuclearDeterrent: Math.round(nuclearDeterrent * 100) / 100,
      },
    };
  }

  // ── Capability Query ────────────────────────────────────────────────────

  /**
   * Check whether a faction possesses a specific special capability.
   *
   * @see FR-1001
   */
  static hasCapability(fs: ForceStructure, capability: string): boolean {
    return fs.specialCapabilities.includes(capability);
  }
}

// ── Private Helpers ─────────────────────────────────────────────────────────

/** Clamp `value` to the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Push a warning if `value` is outside the 0-100 range. */
function validateRange(
  warnings: string[],
  field: string,
  value: number,
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    warnings.push(`${field} must be a number, got ${String(value)}`);
  } else if (value < 0 || value > 100) {
    warnings.push(`${field} must be 0-100, got ${value}`);
  }
}
