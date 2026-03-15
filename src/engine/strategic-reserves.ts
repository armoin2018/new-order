/**
 * Strategic Reserves Stockpiling Engine — New Order
 *
 * Manages the stockpiling, depletion, transfer, and assessment of strategic
 * reserves across four resource dimensions: Energy, Food, Water, and Critical
 * Minerals. Reserves act as a buffer against supply disruptions, sanctions,
 * and blockades — providing a key asymmetric advantage for prepared nations.
 *
 * - **Stockpiling**: Treasury −5 per 10 units added to reserves.
 * - **Depletion**: Reserves consumed during deficit turns to cover shortfalls.
 * - **Transfer**: Reserves tradeable / donatable between nations for leverage.
 * - **Adequacy**: Rated per-resource as surplus / adequate / low / depleted.
 * - **Per-turn update**: Production adds, consumption depletes, net tracked.
 *
 * All methods are pure computational functions that return new objects.
 * No side effects, no UI, no state management.
 *
 * @module strategic-reserves
 * @see FR-1907 — Strategic Reserves Stockpiling
 */

import type { StrategicReserves } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/** The four resource dimension keys tracked by strategic reserves. */
const RESOURCE_KEYS = [
  'energy',
  'food',
  'water',
  'criticalMinerals',
] as const;

// ─────────────────────────────────────────────────────────
// Exported Types & Interfaces
// ─────────────────────────────────────────────────────────

/** Union type of the four tracked resource dimension names. */
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

/**
 * Adequacy level classification for a single resource reserve.
 * Uses `as const` + type union pattern (no enum). @see FR-1907
 */
export const AdequacyLevel = {
  /** Reserves exceed 6 months of consumption. */
  Surplus: 'surplus',
  /** Reserves cover 3–6 months of consumption. */
  Adequate: 'adequate',
  /** Reserves cover less than 3 months of consumption. */
  Low: 'low',
  /** Reserves are completely exhausted. */
  Depleted: 'depleted',
} as const;

/** Union type derived from the `AdequacyLevel` const object. */
export type AdequacyLevel = (typeof AdequacyLevel)[keyof typeof AdequacyLevel];

/**
 * Configuration shape for the strategic reserves engine.
 * @see FR-1907
 */
export interface StrategicReservesConfig {
  /** Treasury cost per 10 units of reserves stockpiled (negative). */
  readonly costPer10Units: number;
}

/** Result of a {@link StrategicReservesEngine.stockpile} operation. @see FR-1907 */
export interface StockpileResult {
  /** Updated reserves after stockpiling. */
  readonly reserves: StrategicReserves;
  /** Treasury cost incurred (always negative). */
  readonly treasuryCost: number;
}

/** Result of a {@link StrategicReservesEngine.deplete} operation. @see FR-1907 */
export interface DepleteResult {
  /** Updated reserves after depletion. */
  readonly reserves: StrategicReserves;
  /** Actual amount depleted (may be less than requested). Always ≥ 0. */
  readonly actualDepleted: number;
}

/** Per-resource buffer duration estimate in turns. @see FR-1907 */
export interface BufferDurationResult {
  /** Turns of energy buffer at current deficit rate. */
  readonly energy: number;
  /** Turns of food buffer at current deficit rate. */
  readonly food: number;
  /** Turns of water buffer at current deficit rate. */
  readonly water: number;
  /** Turns of critical minerals buffer at current deficit rate. */
  readonly criticalMinerals: number;
  /** Minimum buffer across all dimensions (weakest link). */
  readonly minimumBuffer: number;
}

/** Result of a reserve transfer between two nations. @see FR-1907 */
export interface TransferResult {
  /** Updated reserves for the source (giving) nation. */
  readonly fromReserves: StrategicReserves;
  /** Updated reserves for the destination (receiving) nation. */
  readonly toReserves: StrategicReserves;
  /** Actual amount transferred (capped to source availability). */
  readonly actualTransferred: number;
}

/** Per-resource adequacy assessment plus overall rating. @see FR-1907 */
export interface ReserveAdequacy {
  readonly energy: AdequacyLevel;
  readonly food: AdequacyLevel;
  readonly water: AdequacyLevel;
  readonly criticalMinerals: AdequacyLevel;
  /** Overall adequacy — the *worst* level across all four dimensions. */
  readonly overall: AdequacyLevel;
}

/** Result of a per-turn reserve update with new levels and net changes. @see FR-1907 */
export interface ReserveUpdateResult {
  /** Updated reserves after applying production and consumption. */
  readonly reserves: StrategicReserves;
  /** Net change per resource (positive = accumulation, negative = drawdown). */
  readonly netChange: StrategicReserves;
}

/** High-level summary of a nation's reserve posture. @see FR-1907 */
export interface ReservesSummary {
  /** Per-resource and overall adequacy ratings. */
  readonly adequacy: ReserveAdequacy;
  /** Total units across all four reserve categories. */
  readonly totalUnits: number;
  /** Estimated turns of buffer at current consumption (weakest dimension). */
  readonly estimatedBufferTurns: number;
  /** Human-readable: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'. */
  readonly preparednessRating: string;
}

// ─────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────

/**
 * Preparedness tiers mapped to minimum total reserve units.
 * Evaluated top-down — first tier whose threshold is met wins.
 * @internal
 */
const PREPAREDNESS_TIERS: ReadonlyArray<
  Readonly<{ readonly threshold: number; readonly rating: string }>
> = [
  { threshold: 48, rating: 'excellent' },
  { threshold: 24, rating: 'good' },
  { threshold: 12, rating: 'fair' },
  { threshold: 4, rating: 'poor' },
  { threshold: 0, rating: 'critical' },
] as const;

/** Months of consumption above which a resource is rated surplus. @internal */
const SURPLUS_MONTHS_THRESHOLD = 6;

/** Months of consumption at or above which a resource is adequate. @internal */
const ADEQUATE_MONTHS_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 * @internal
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Create a zeroed-out {@link StrategicReserves} object.
 * @internal
 */
function emptyReserves(): StrategicReserves {
  return { energy: 0, food: 0, water: 0, criticalMinerals: 0 };
}

/**
 * Shallow-copy a {@link StrategicReserves} so mutations don't leak.
 * @internal
 */
function copyReserves(r: StrategicReserves): StrategicReserves {
  return {
    energy: r.energy,
    food: r.food,
    water: r.water,
    criticalMinerals: r.criticalMinerals,
  };
}

/**
 * Sum all four resource fields of a {@link StrategicReserves} object.
 * @internal
 */
function totalReserves(r: StrategicReserves): number {
  return r.energy + r.food + r.water + r.criticalMinerals;
}

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Strategic Reserves Stockpiling Engine.
 *
 * Pure-functional methods to stockpile, deplete, transfer, and assess
 * strategic reserves for a nation. Every method returns a new result
 * object — inputs are never mutated.
 *
 * ```ts
 * const engine = new StrategicReservesEngine();
 * const result = engine.stockpile(currentReserves, 'energy', 25);
 * // result.treasuryCost === -15 (ceil(25/10) × -5)
 * ```
 *
 * @see FR-1907 — Strategic Reserves Stockpiling
 */
export class StrategicReservesEngine {
  /** Resolved configuration (game defaults merged with overrides). */
  private readonly config: Readonly<StrategicReservesConfig>;

  /**
   * @param configOverride - Optional partial config for testing or
   *   scenario overrides. Falls back to `GAME_CONFIG.resources.strategicReserves`.
   */
  constructor(configOverride?: Partial<StrategicReservesConfig>) {
    const defaults = GAME_CONFIG.resources.strategicReserves;
    this.config = Object.freeze({
      costPer10Units: configOverride?.costPer10Units ?? defaults.costPer10Units,
    });
  }

  // ───────────────────────────────────────────────────────
  // 1. computeStockpileCost
  // ───────────────────────────────────────────────────────

  /**
   * Calculate the treasury cost to stockpile a given number of units.
   *
   * `cost = ceil(units / 10) × costPer10Units`
   *
   * Returns a negative number (treasury drain), or `0` for invalid input.
   *
   * @param units - Number of resource units to stockpile. Must be ≥ 0.
   * @returns The treasury cost (negative), or 0 if units ≤ 0.
   * @see FR-1907
   */
  public computeStockpileCost(units: number): number {
    if (units <= 0) {
      return 0;
    }
    const blocks = Math.ceil(units / 10);
    return blocks * this.config.costPer10Units;
  }

  // ───────────────────────────────────────────────────────
  // 2. stockpile
  // ───────────────────────────────────────────────────────

  /**
   * Add units to a specified resource reserve.
   *
   * Returns updated reserves (new object — input is not mutated)
   * and the treasury cost incurred. Non-positive units are a no-op.
   *
   * @param reserves - Current strategic reserve levels.
   * @param resource - Which resource dimension to stockpile.
   * @param units    - Number of units to add. Must be > 0.
   * @returns A {@link StockpileResult} with updated reserves and cost.
   * @see FR-1907
   */
  public stockpile(
    reserves: StrategicReserves,
    resource: ResourceKey,
    units: number,
  ): StockpileResult {
    if (units <= 0) {
      return { reserves: copyReserves(reserves), treasuryCost: 0 };
    }

    const updated = copyReserves(reserves);
    updated[resource] = clamp(updated[resource] + units, 0, Infinity);

    return {
      reserves: updated,
      treasuryCost: this.computeStockpileCost(units),
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. deplete
  // ───────────────────────────────────────────────────────

  /**
   * Remove units from a specified resource reserve.
   *
   * Reserves cannot go below zero. If the requested depletion exceeds
   * the current level, only the available amount is depleted.
   *
   * @param reserves - Current strategic reserve levels.
   * @param resource - Which resource dimension to deplete.
   * @param units    - Number of units to remove. Must be > 0.
   * @returns A {@link DepleteResult} with updated reserves and actual
   *   amount depleted.
   * @see FR-1907
   */
  public deplete(
    reserves: StrategicReserves,
    resource: ResourceKey,
    units: number,
  ): DepleteResult {
    if (units <= 0) {
      return { reserves: copyReserves(reserves), actualDepleted: 0 };
    }

    const updated = copyReserves(reserves);
    const available = updated[resource];
    const actualDepleted = Math.min(units, available);

    updated[resource] = clamp(available - actualDepleted, 0, Infinity);

    return { reserves: updated, actualDepleted };
  }

  // ───────────────────────────────────────────────────────
  // 4. computeBufferDuration
  // ───────────────────────────────────────────────────────

  /**
   * Estimate how many turns each reserve can sustain at a given
   * deficit-per-turn rate.
   *
   * Per resource: `bufferTurns = deficit > 0 ? floor(reserve / deficit) : Infinity`
   *
   * `minimumBuffer` is the smallest finite value (weakest link).
   *
   * @param reserves       - Current strategic reserve levels.
   * @param deficitPerTurn - Consumption rate per turn per resource (≥ 0).
   * @returns A {@link BufferDurationResult} with per-resource estimates.
   * @see FR-1907
   */
  public computeBufferDuration(
    reserves: StrategicReserves,
    deficitPerTurn: StrategicReserves,
  ): BufferDurationResult {
    const perResource: Record<ResourceKey, number> = {
      energy: 0,
      food: 0,
      water: 0,
      criticalMinerals: 0,
    };

    for (const key of RESOURCE_KEYS) {
      const deficit = deficitPerTurn[key];
      perResource[key] = deficit <= 0
        ? Infinity
        : Math.floor(reserves[key] / deficit);
    }

    let minimumBuffer = Infinity;
    for (const key of RESOURCE_KEYS) {
      const turns = perResource[key];
      if (turns < minimumBuffer) {
        minimumBuffer = turns;
      }
    }

    return {
      energy: perResource.energy,
      food: perResource.food,
      water: perResource.water,
      criticalMinerals: perResource.criticalMinerals,
      minimumBuffer,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. transferReserves
  // ───────────────────────────────────────────────────────

  /**
   * Transfer reserves of a single resource from one nation to another.
   *
   * Covers both trade and donation use cases. The actual amount
   * transferred is capped to the source's available supply.
   *
   * @param from     - Source nation's current reserves.
   * @param to       - Destination nation's current reserves.
   * @param resource - Which resource dimension to transfer.
   * @param units    - Number of units to transfer. Must be > 0.
   * @returns A {@link TransferResult} with both updated reserves and
   *   actual amount transferred.
   * @see FR-1907
   */
  public transferReserves(
    from: StrategicReserves,
    to: StrategicReserves,
    resource: ResourceKey,
    units: number,
  ): TransferResult {
    if (units <= 0) {
      return {
        fromReserves: copyReserves(from),
        toReserves: copyReserves(to),
        actualTransferred: 0,
      };
    }

    const actualTransferred = Math.min(units, from[resource]);
    const updatedFrom = copyReserves(from);
    const updatedTo = copyReserves(to);

    updatedFrom[resource] = clamp(
      updatedFrom[resource] - actualTransferred,
      0,
      Infinity,
    );
    updatedTo[resource] = clamp(
      updatedTo[resource] + actualTransferred,
      0,
      Infinity,
    );

    return {
      fromReserves: updatedFrom,
      toReserves: updatedTo,
      actualTransferred,
    };
  }

  // ───────────────────────────────────────────────────────
  // 6. assessReserveAdequacy
  // ───────────────────────────────────────────────────────

  /**
   * Compare reserves to consumption rates and classify each dimension.
   *
   * | Level      | Condition                     |
   * |------------|-------------------------------|
   * | surplus    | > 6 months consumption        |
   * | adequate   | 3–6 months                    |
   * | low        | 0 < reserves < 3 months       |
   * | depleted   | reserves ≤ 0                  |
   *
   * `overall` = worst level across all four dimensions.
   *
   * @param reserves    - Current strategic reserve levels.
   * @param consumption - Monthly consumption rates per resource.
   * @returns A {@link ReserveAdequacy} with per-resource and overall levels.
   * @see FR-1907
   */
  public assessReserveAdequacy(
    reserves: StrategicReserves,
    consumption: StrategicReserves,
  ): ReserveAdequacy {
    const levels: Record<ResourceKey, AdequacyLevel> = {
      energy: AdequacyLevel.Depleted,
      food: AdequacyLevel.Depleted,
      water: AdequacyLevel.Depleted,
      criticalMinerals: AdequacyLevel.Depleted,
    };

    for (const key of RESOURCE_KEYS) {
      levels[key] = this.classifyAdequacy(reserves[key], consumption[key]);
    }

    const overall = this.worstAdequacy([
      levels.energy,
      levels.food,
      levels.water,
      levels.criticalMinerals,
    ]);

    return {
      energy: levels.energy,
      food: levels.food,
      water: levels.water,
      criticalMinerals: levels.criticalMinerals,
      overall,
    };
  }

  // ───────────────────────────────────────────────────────
  // 7. computeTurnReserveUpdate
  // ───────────────────────────────────────────────────────

  /**
   * Main per-turn update. Production adds to reserves, consumption
   * depletes them. Reserves are clamped to zero (never negative).
   *
   * `newLevel = clamp(current + production - consumption, 0, ∞)`
   * `netChange = newLevel - current`
   *
   * @param reserves    - Current reserve levels at start of turn.
   * @param consumption - Units consumed this turn per resource.
   * @param production  - Units produced this turn per resource.
   * @returns A {@link ReserveUpdateResult} with updated levels and
   *   net change per resource.
   * @see FR-1907
   */
  public computeTurnReserveUpdate(
    reserves: StrategicReserves,
    consumption: StrategicReserves,
    production: StrategicReserves,
  ): ReserveUpdateResult {
    const updated = emptyReserves();
    const netChange = emptyReserves();

    for (const key of RESOURCE_KEYS) {
      const current = reserves[key];
      const produced = Math.max(0, production[key]);
      const consumed = Math.max(0, consumption[key]);

      const raw = current + produced - consumed;
      updated[key] = clamp(raw, 0, Infinity);
      netChange[key] = updated[key] - current;
    }

    return { reserves: updated, netChange };
  }

  // ───────────────────────────────────────────────────────
  // 8. getReservesSummary
  // ───────────────────────────────────────────────────────

  /**
   * Generate a high-level summary of a nation's reserve posture.
   *
   * Aggregates adequacy ratings, total units, buffer turns (weakest
   * dimension), and a preparedness rating:
   *
   * | Rating    | Total units ≥ |
   * |-----------|---------------|
   * | excellent | 48            |
   * | good      | 24            |
   * | fair      | 12            |
   * | poor      | 4             |
   * | critical  | < 4           |
   *
   * @param reserves    - Current strategic reserve levels.
   * @param consumption - Monthly consumption rates per resource.
   * @returns A {@link ReservesSummary} with all aggregate metrics.
   * @see FR-1907
   */
  public getReservesSummary(
    reserves: StrategicReserves,
    consumption: StrategicReserves,
  ): ReservesSummary {
    const adequacy = this.assessReserveAdequacy(reserves, consumption);
    const total = totalReserves(reserves);

    const bufferResult = this.computeBufferDuration(reserves, consumption);
    const estimatedBufferTurns = Number.isFinite(bufferResult.minimumBuffer)
      ? bufferResult.minimumBuffer
      : 0;

    return {
      adequacy,
      totalUnits: total,
      estimatedBufferTurns,
      preparednessRating: this.computePreparednessRating(total),
    };
  }

  // ───────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────

  /**
   * Classify a single resource's adequacy from reserve / consumption ratio.
   * @internal
   */
  private classifyAdequacy(
    reserve: number,
    consumption: number,
  ): AdequacyLevel {
    if (reserve <= 0) {
      return AdequacyLevel.Depleted;
    }
    if (consumption <= 0) {
      return AdequacyLevel.Surplus;
    }

    const monthsCoverage = reserve / consumption;

    if (monthsCoverage > SURPLUS_MONTHS_THRESHOLD) {
      return AdequacyLevel.Surplus;
    }
    if (monthsCoverage >= ADEQUATE_MONTHS_THRESHOLD) {
      return AdequacyLevel.Adequate;
    }
    return AdequacyLevel.Low;
  }

  /**
   * Return the worst (most critical) adequacy level from a list.
   * Ordering: surplus > adequate > low > depleted.
   * @internal
   */
  private worstAdequacy(levels: readonly AdequacyLevel[]): AdequacyLevel {
    const ordering: readonly AdequacyLevel[] = [
      AdequacyLevel.Surplus,
      AdequacyLevel.Adequate,
      AdequacyLevel.Low,
      AdequacyLevel.Depleted,
    ];

    let worstIndex = 0;
    for (const level of levels) {
      const idx = ordering.indexOf(level);
      if (idx > worstIndex) {
        worstIndex = idx;
      }
    }

    return ordering[worstIndex] ?? AdequacyLevel.Depleted;
  }

  /**
   * Map total reserve units to a preparedness rating string.
   * Evaluates {@link PREPAREDNESS_TIERS} top-down.
   * @internal
   */
  private computePreparednessRating(totalUnits: number): string {
    for (const tier of PREPAREDNESS_TIERS) {
      if (totalUnits >= tier.threshold) {
        return tier.rating;
      }
    }
    return 'critical';
  }
}
