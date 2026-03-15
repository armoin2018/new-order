/**
 * Resource Security Index Engine — New Order
 *
 * Tracks per-nation resource security across four dimensions (Energy, Food,
 * Water, Critical Minerals). Each dimension ranges 0–100 and triggers
 * escalating crisis effects when it falls below configurable thresholds:
 *
 * - **Warning** (< 30): +5 Inflation, +3 CivilUnrest
 * - **Critical** (< 15): rationing required (CivilUnrest +10, Popularity −10)
 * - **Catastrophic** (< 5): famine/energy collapse (Stability −10/turn,
 *   mass migration begins)
 *
 * All methods are pure computational functions that return new objects.
 * No side effects, no UI, no state management.
 *
 * @module resource-security
 * @see FR-1901 — Resource Security Index
 */

import type {
  TurnNumber,
  StrategicReserves,
  ImportDependency,
  ResourceSecurityIndex,
} from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

/**
 * The four resource dimension keys tracked by the security index.
 * Used to iterate over resource fields without hard-coding strings.
 */
const RESOURCE_KEYS = [
  'energy',
  'food',
  'water',
  'criticalMinerals',
] as const;

/** Union type of the four tracked resource dimension names. */
type ResourceKey = (typeof RESOURCE_KEYS)[number];

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────
// Exported Types & Interfaces
// ─────────────────────────────────────────────────────────

/**
 * Crisis level classification for a single resource dimension.
 *
 * Uses `as const` + type union pattern (no enum).
 *
 * - `stable`       — level ≥ warning threshold (default 30)
 * - `warning`      — level < warning threshold
 * - `critical`     — level < critical threshold (default 15)
 * - `catastrophic` — level < catastrophic threshold (default 5)
 *
 * @see FR-1901
 */
export const ResourceCrisisLevel = {
  Stable: 'stable',
  Warning: 'warning',
  Critical: 'critical',
  Catastrophic: 'catastrophic',
} as const;

/** Union type derived from the `ResourceCrisisLevel` const object. */
export type ResourceCrisisLevel =
  (typeof ResourceCrisisLevel)[keyof typeof ResourceCrisisLevel];

/**
 * Configuration shape for resource security thresholds and effects.
 * Can be injected via constructor for testing or scenario overrides.
 *
 * @see FR-1901
 */
export interface ResourceSecurityConfig {
  /** Warning level threshold (default 30). Below this: inflation & unrest. */
  readonly warning: number;
  /** Inflation increase applied per resource in the warning band. */
  readonly warningInflationIncrease: number;
  /** Civil unrest increase applied per resource in the warning band. */
  readonly warningCivilUnrestIncrease: number;
  /** Critical level threshold (default 15). Below this: rationing. */
  readonly critical: number;
  /** Civil unrest increase applied per resource in the critical band. */
  readonly criticalCivilUnrestIncrease: number;
  /** Popularity penalty applied per resource in the critical band. */
  readonly criticalPopularityPenalty: number;
  /** Catastrophic level threshold (default 5). Below this: collapse. */
  readonly catastrophic: number;
  /** Stability decay per turn applied per resource in the catastrophic band. */
  readonly catastrophicStabilityDecayPerTurn: number;
}

/**
 * Detailed crisis information for a single resource dimension.
 *
 * @see FR-1901
 */
export interface ResourceCrisisDetail {
  /** Resource dimension name. */
  readonly resource: string;
  /** Current level of the resource (0–100). */
  readonly level: number;
  /** Assessed crisis level. */
  readonly crisisLevel: ResourceCrisisLevel;
}

/**
 * Aggregated crisis effects across all four resource dimensions.
 *
 * Effects stack: if two resources are in warning, the inflation delta
 * is doubled, etc.
 *
 * @see FR-1901
 */
export interface CrisisEffects {
  /** Total inflation change from resource crises. */
  readonly inflationDelta: number;
  /** Total civil unrest change from resource crises. */
  readonly civilUnrestDelta: number;
  /** Total popularity change from resource crises. */
  readonly popularityDelta: number;
  /** Total stability change from resource crises. */
  readonly stabilityDelta: number;
  /** Whether any resource is catastrophic, triggering mass migration. */
  readonly migrationTriggered: boolean;
  /** Per-resource crisis breakdown. */
  readonly affectedResources: ResourceCrisisDetail[];
}

/**
 * Delta values applied to each resource dimension per turn.
 * Positive = gain, negative = loss.
 */
export interface ResourceDelta {
  /** Energy delta. */
  readonly energy: number;
  /** Food delta. */
  readonly food: number;
  /** Water delta. */
  readonly water: number;
  /** Critical minerals delta. */
  readonly criticalMinerals: number;
}

/**
 * Result of applying strategic reserves to buffer resource deficits.
 *
 * @see FR-1908
 */
export interface BufferResult {
  /** Remaining deficit after reserves absorbed what they could. */
  readonly remainingDeficit: ResourceDelta;
  /** Updated reserve levels after buffering. */
  readonly updatedReserves: StrategicReserves;
  /** How much of each reserve was consumed. */
  readonly reservesUsed: StrategicReserves;
}

/**
 * Per-turn inputs describing all resource changes for a nation.
 * Each field is a {@link ResourceDelta} or a scalar modifier.
 */
export interface ResourceTurnInput {
  /** Production-based resource changes. */
  readonly productionDelta: ResourceDelta;
  /** Trade-based resource changes (before disruption). */
  readonly tradeDelta: ResourceDelta;
  /** Climate-event resource changes. */
  readonly climateDelta: ResourceDelta;
  /**
   * Percentage of trade lost due to sanctions, blockades, etc.
   * Range: 0–100.
   */
  readonly tradeDisruption: number;
}

/**
 * Complete result of a per-turn resource security computation.
 */
export interface ResourceTurnResult {
  /** The updated resource security index after this turn. */
  readonly index: ResourceSecurityIndex;
  /** Aggregated crisis effects for this turn. */
  readonly crisisEffects: CrisisEffects;
  /** Strategic reserve buffer details for this turn. */
  readonly bufferResult: BufferResult;
}

/**
 * Human-readable summary of the nation's overall resource posture.
 */
export interface ResourceSummary {
  /** The worst crisis level across all four dimensions. */
  readonly overall: ResourceCrisisLevel;
  /** Per-resource breakdown with levels and crisis assessments. */
  readonly resources: ResourceCrisisDetail[];
  /** True if any resource is at catastrophic level. */
  readonly anyMigrationRisk: boolean;
}

// ─────────────────────────────────────────────────────────
// ResourceSecurityEngine
// ─────────────────────────────────────────────────────────

/**
 * Pure computational engine for the Resource Security Index system.
 *
 * Evaluates per-nation resource levels across four dimensions,
 * applies production/trade/climate deltas, manages strategic reserve
 * buffering, and computes escalating crisis effects.
 *
 * All methods are stateless and return new objects. No mutations,
 * no side effects.
 *
 * @example
 * ```ts
 * const engine = new ResourceSecurityEngine();
 * const result = engine.computeTurnResourceSecurity(prevIndex, input, turn);
 * ```
 *
 * @see FR-1901 — Resource Security Index
 */
export class ResourceSecurityEngine {
  /** Active configuration for thresholds and effects. */
  private readonly cfg: ResourceSecurityConfig;

  /**
   * Create a new ResourceSecurityEngine.
   *
   * @param configOverride - Optional configuration override. When omitted,
   *   uses `GAME_CONFIG.resources.securityThresholds`. Useful for testing
   *   or scenario-specific tuning.
   */
  constructor(configOverride?: ResourceSecurityConfig) {
    this.cfg = configOverride ?? GAME_CONFIG.resources.securityThresholds;
  }

  // ───────────────────────────────────────────────────────
  // 1. assessResource
  // ───────────────────────────────────────────────────────

  /**
   * Assess the crisis level for a single resource dimension.
   *
   * Thresholds are evaluated from most severe to least:
   * 1. `catastrophic` (< 5 by default) — famine / energy collapse
   * 2. `critical` (< 15 by default) — rationing required
   * 3. `warning` (< 30 by default) — inflation & unrest pressure
   * 4. `stable` — no crisis
   *
   * @param level - The current resource security level (0–100).
   * @returns The corresponding {@link ResourceCrisisLevel}.
   *
   * @example
   * ```ts
   * engine.assessResource(50); // 'stable'
   * engine.assessResource(25); // 'warning'
   * engine.assessResource(10); // 'critical'
   * engine.assessResource(3);  // 'catastrophic'
   * ```
   *
   * @see FR-1901
   */
  assessResource(level: number): ResourceCrisisLevel {
    if (level < this.cfg.catastrophic) {
      return ResourceCrisisLevel.Catastrophic;
    }
    if (level < this.cfg.critical) {
      return ResourceCrisisLevel.Critical;
    }
    if (level < this.cfg.warning) {
      return ResourceCrisisLevel.Warning;
    }
    return ResourceCrisisLevel.Stable;
  }

  // ───────────────────────────────────────────────────────
  // 2. computeCrisisEffects
  // ───────────────────────────────────────────────────────

  /**
   * Compute aggregated crisis effects for all four resource dimensions.
   *
   * Each resource dimension is independently assessed. Effects **stack**
   * across multiple resources in crisis:
   *
   * | Level        | Effects per resource                          |
   * |-------------|-----------------------------------------------|
   * | Warning     | +inflationDelta, +civilUnrestDelta            |
   * | Critical    | Warning effects + civilUnrest, −popularity    |
   * | Catastrophic| All above + −stability, migration triggered   |
   *
   * @param index - The current {@link ResourceSecurityIndex} for a nation.
   * @returns Aggregated {@link CrisisEffects} across all dimensions.
   *
   * @example
   * ```ts
   * const effects = engine.computeCrisisEffects(nationIndex);
   * if (effects.migrationTriggered) {
   *   // Handle mass migration event
   * }
   * ```
   *
   * @see FR-1901
   */
  computeCrisisEffects(index: ResourceSecurityIndex): CrisisEffects {
    let inflationDelta = 0;
    let civilUnrestDelta = 0;
    let popularityDelta = 0;
    let stabilityDelta = 0;
    let migrationTriggered = false;

    const affectedResources: ResourceCrisisDetail[] = [];

    for (const key of RESOURCE_KEYS) {
      const level = index[key];
      const crisisLevel = this.assessResource(level);

      affectedResources.push({
        resource: key,
        level,
        crisisLevel,
      });

      // Stable resources produce no crisis effects
      if (crisisLevel === ResourceCrisisLevel.Stable) {
        continue;
      }

      // ── Warning band (< 30): inflation + civil unrest ──────────
      // All non-stable levels include warning effects
      inflationDelta += this.cfg.warningInflationIncrease;
      civilUnrestDelta += this.cfg.warningCivilUnrestIncrease;

      // ── Critical band (< 15): rationing — more unrest, popularity hit
      if (
        crisisLevel === ResourceCrisisLevel.Critical ||
        crisisLevel === ResourceCrisisLevel.Catastrophic
      ) {
        civilUnrestDelta += this.cfg.criticalCivilUnrestIncrease;
        popularityDelta += this.cfg.criticalPopularityPenalty;
      }

      // ── Catastrophic band (< 5): collapse — stability decay, migration
      if (crisisLevel === ResourceCrisisLevel.Catastrophic) {
        stabilityDelta += this.cfg.catastrophicStabilityDecayPerTurn;
        migrationTriggered = true;
      }
    }

    return {
      inflationDelta,
      civilUnrestDelta,
      popularityDelta,
      stabilityDelta,
      migrationTriggered,
      affectedResources,
    };
  }

  // ───────────────────────────────────────────────────────
  // 3. applyResourceDelta
  // ───────────────────────────────────────────────────────

  /**
   * Apply per-resource deltas to produce a new {@link ResourceSecurityIndex}.
   *
   * Deltas represent the net change from production, trade, climate events,
   * or any other modifier. All four dimensions are independently updated
   * and clamped to the valid [0, 100] range.
   *
   * Strategic reserves and active leverage are carried forward unchanged.
   *
   * @param prev  - The previous turn's resource security index.
   * @param delta - Per-resource deltas to apply (positive = improvement).
   * @param turn  - The current turn number for the new index.
   * @returns A new {@link ResourceSecurityIndex} with updated levels.
   *
   * @example
   * ```ts
   * const updated = engine.applyResourceDelta(
   *   prevIndex,
   *   { energy: -10, food: 5, water: 0, criticalMinerals: -3 },
   *   currentTurn,
   * );
   * ```
   *
   * @see FR-1901
   */
  applyResourceDelta(
    prev: ResourceSecurityIndex,
    delta: ResourceDelta,
    turn: TurnNumber,
  ): ResourceSecurityIndex {
    return {
      factionId: prev.factionId,
      turn,
      energy: clamp(prev.energy + delta.energy, 0, 100),
      food: clamp(prev.food + delta.food, 0, 100),
      water: clamp(prev.water + delta.water, 0, 100),
      criticalMinerals: clamp(
        prev.criticalMinerals + delta.criticalMinerals,
        0,
        100,
      ),
      strategicReserves: { ...prev.strategicReserves },
      activeResourceLeverage: [...prev.activeResourceLeverage],
      importDependency: { ...prev.importDependency },
    };
  }

  // ───────────────────────────────────────────────────────
  // 4. computeProductionModifier
  // ───────────────────────────────────────────────────────

  /**
   * Compute resource deltas caused by trade disruption.
   *
   * When trade is disrupted (sanctions, blockades, chokepoint closures),
   * resources with high import dependency suffer proportionally more.
   *
   * The formula for each resource dimension:
   * ```
   * delta = -(importDependency / 100) × (tradeDisruption / 100) × 100
   * ```
   *
   * This means a nation with 80% import dependency on energy that suffers
   * 50% trade disruption loses 40 points of energy security.
   *
   * @param importDependency - Per-resource import dependency (0–100 each).
   * @param tradeDisruption  - Percentage of trade lost (0–100).
   * @returns Negative {@link ResourceDelta} proportional to dependency × disruption.
   *
   * @example
   * ```ts
   * const modifier = engine.computeProductionModifier(
   *   { energy: 80, food: 20, water: 5, criticalMinerals: 60 },
   *   50, // 50% trade disrupted
   * );
   * // modifier.energy ≈ -40 (80% dependency × 50% disruption)
   * // modifier.food   ≈ -10 (20% dependency × 50% disruption)
   * ```
   *
   * @see FR-1901
   */
  computeProductionModifier(
    importDependency: ImportDependency,
    tradeDisruption: number,
  ): ResourceDelta {
    const disruptionFactor = clamp(tradeDisruption, 0, 100) / 100;

    return {
      energy: -(importDependency.energy / 100) * disruptionFactor * 100,
      food: -(importDependency.food / 100) * disruptionFactor * 100,
      water: -(importDependency.water / 100) * disruptionFactor * 100,
      criticalMinerals:
        -(importDependency.criticalMinerals / 100) * disruptionFactor * 100,
    };
  }

  // ───────────────────────────────────────────────────────
  // 5. applyReserveBuffer
  // ───────────────────────────────────────────────────────

  /**
   * Apply strategic reserves to absorb resource deficits.
   *
   * When a resource dimension would suffer a negative delta, strategic
   * reserves for that dimension can offset the loss — each reserve unit
   * absorbs 1 point of deficit. Reserves cannot go below 0.
   *
   * Only negative deltas are buffered. Positive deltas pass through
   * unchanged.
   *
   * @param index   - The current resource security index (for reserves).
   * @param deficit - The raw resource delta (may contain negative values).
   * @returns A {@link BufferResult} with remaining deficit, updated
   *   reserves, and how much of each reserve was consumed.
   *
   * @example
   * ```ts
   * const buffer = engine.applyReserveBuffer(
   *   nationIndex,
   *   { energy: -15, food: 3, water: -5, criticalMinerals: 0 },
   * );
   * // If reserves.energy = 10: remainingDeficit.energy = -5, reservesUsed.energy = 10
   * // food passes through (positive): remainingDeficit.food = 3
   * ```
   *
   * @see FR-1908
   */
  applyReserveBuffer(
    index: ResourceSecurityIndex,
    deficit: ResourceDelta,
  ): BufferResult {
    const remainingDeficit: Record<ResourceKey, number> = {
      energy: 0,
      food: 0,
      water: 0,
      criticalMinerals: 0,
    };

    const updatedReserves: Record<ResourceKey, number> = {
      energy: index.strategicReserves.energy,
      food: index.strategicReserves.food,
      water: index.strategicReserves.water,
      criticalMinerals: index.strategicReserves.criticalMinerals,
    };

    const reservesUsed: Record<ResourceKey, number> = {
      energy: 0,
      food: 0,
      water: 0,
      criticalMinerals: 0,
    };

    for (const key of RESOURCE_KEYS) {
      const raw = deficit[key];

      if (raw >= 0) {
        // Positive or zero delta — no buffering needed
        remainingDeficit[key] = raw;
        continue;
      }

      // Negative delta — attempt to buffer with reserves
      const absDeficit = Math.abs(raw);
      const available = updatedReserves[key] ?? 0;
      const absorbed = Math.min(absDeficit, available);

      reservesUsed[key] = absorbed;
      updatedReserves[key] = available - absorbed;
      remainingDeficit[key] = -(absDeficit - absorbed);
    }

    return {
      remainingDeficit: {
        energy: remainingDeficit.energy ?? 0,
        food: remainingDeficit.food ?? 0,
        water: remainingDeficit.water ?? 0,
        criticalMinerals: remainingDeficit.criticalMinerals ?? 0,
      },
      updatedReserves: {
        energy: updatedReserves.energy ?? 0,
        food: updatedReserves.food ?? 0,
        water: updatedReserves.water ?? 0,
        criticalMinerals: updatedReserves.criticalMinerals ?? 0,
      },
      reservesUsed: {
        energy: reservesUsed.energy ?? 0,
        food: reservesUsed.food ?? 0,
        water: reservesUsed.water ?? 0,
        criticalMinerals: reservesUsed.criticalMinerals ?? 0,
      },
    };
  }

  // ───────────────────────────────────────────────────────
  // 6. computeTurnResourceSecurity
  // ───────────────────────────────────────────────────────

  /**
   * Main per-turn resource security computation.
   *
   * Orchestrates the full pipeline for a single nation's turn:
   *
   * 1. **Compute trade disruption modifier** — resources with high import
   *    dependency lose proportionally more when trade is disrupted.
   * 2. **Aggregate raw deltas** — sum production, trade (after disruption),
   *    and climate deltas for each resource dimension.
   * 3. **Buffer with strategic reserves** — reserves absorb negative deltas
   *    before they impact security levels.
   * 4. **Apply remaining delta** — update the security index with clamped
   *    values.
   * 5. **Assess crisis effects** — evaluate thresholds on the new index
   *    and aggregate inflation, unrest, popularity, and stability effects.
   *
   * @param prev  - The previous turn's {@link ResourceSecurityIndex}.
   * @param input - All per-turn resource inputs (production, trade, climate).
   * @param turn  - The current turn number.
   * @returns A {@link ResourceTurnResult} with the new index, crisis effects,
   *   and buffer details.
   *
   * @example
   * ```ts
   * const result = engine.computeTurnResourceSecurity(
   *   prevIndex,
   *   {
   *     productionDelta: { energy: 5, food: 3, water: 2, criticalMinerals: 1 },
   *     tradeDelta: { energy: 10, food: 8, water: 0, criticalMinerals: 5 },
   *     climateDelta: { energy: 0, food: -15, water: -10, criticalMinerals: 0 },
   *     tradeDisruption: 25,
   *   },
   *   currentTurn,
   * );
   * ```
   *
   * @see FR-1901
   */
  computeTurnResourceSecurity(
    prev: ResourceSecurityIndex,
    input: ResourceTurnInput,
    turn: TurnNumber,
  ): ResourceTurnResult {
    // Step 1: Compute trade-disruption modifier based on import dependency
    const disruptionModifier = this.computeProductionModifier(
      prev.importDependency,
      input.tradeDisruption,
    );

    // Step 2: Aggregate all deltas (production + trade + climate + disruption)
    const rawDelta: ResourceDelta = {
      energy:
        input.productionDelta.energy +
        input.tradeDelta.energy +
        input.climateDelta.energy +
        disruptionModifier.energy,
      food:
        input.productionDelta.food +
        input.tradeDelta.food +
        input.climateDelta.food +
        disruptionModifier.food,
      water:
        input.productionDelta.water +
        input.tradeDelta.water +
        input.climateDelta.water +
        disruptionModifier.water,
      criticalMinerals:
        input.productionDelta.criticalMinerals +
        input.tradeDelta.criticalMinerals +
        input.climateDelta.criticalMinerals +
        disruptionModifier.criticalMinerals,
    };

    // Step 3: Buffer negative deltas with strategic reserves
    const bufferResult = this.applyReserveBuffer(prev, rawDelta);

    // Step 4: Apply the remaining (post-buffer) delta to produce new index
    const updatedIndex = this.applyResourceDelta(
      {
        ...prev,
        strategicReserves: bufferResult.updatedReserves,
      },
      bufferResult.remainingDeficit,
      turn,
    );

    // Step 5: Assess crisis effects on the updated index
    const crisisEffects = this.computeCrisisEffects(updatedIndex);

    return {
      index: updatedIndex,
      crisisEffects,
      bufferResult,
    };
  }

  // ───────────────────────────────────────────────────────
  // 7. getResourceSummary
  // ───────────────────────────────────────────────────────

  /**
   * Generate a human-readable summary of a nation's resource posture.
   *
   * Evaluates all four resource dimensions and returns the overall crisis
   * level (the worst level among the four), per-resource breakdown, and
   * whether any migration risk exists.
   *
   * The `overall` level is determined by the most severe individual
   * resource crisis. If any resource is catastrophic, the overall level
   * is catastrophic.
   *
   * @param index - The current {@link ResourceSecurityIndex} for a nation.
   * @returns A {@link ResourceSummary} with overall assessment and details.
   *
   * @example
   * ```ts
   * const summary = engine.getResourceSummary(nationIndex);
   * console.log(`Overall: ${summary.overall}`);
   * for (const r of summary.resources) {
   *   console.log(`  ${r.resource}: ${r.level} (${r.crisisLevel})`);
   * }
   * ```
   *
   * @see FR-1901
   */
  getResourceSummary(index: ResourceSecurityIndex): ResourceSummary {
    const resources: ResourceCrisisDetail[] = RESOURCE_KEYS.map((key) => ({
      resource: key,
      level: index[key],
      crisisLevel: this.assessResource(index[key]),
    }));

    // Determine the worst (most severe) crisis level across all dimensions.
    // Severity ordering: catastrophic > critical > warning > stable.
    const overall = this.worstCrisisLevel(resources);

    const anyMigrationRisk = resources.some(
      (r) => r.crisisLevel === ResourceCrisisLevel.Catastrophic,
    );

    return {
      overall,
      resources,
      anyMigrationRisk,
    };
  }

  // ───────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────

  /**
   * Determine the worst (most severe) crisis level from an array of
   * per-resource assessments.
   *
   * Severity ordering (highest to lowest):
   * `catastrophic` > `critical` > `warning` > `stable`
   *
   * @param details - Per-resource crisis details to evaluate.
   * @returns The single worst {@link ResourceCrisisLevel} found.
   */
  private worstCrisisLevel(
    details: readonly ResourceCrisisDetail[],
  ): ResourceCrisisLevel {
    const severity: Record<ResourceCrisisLevel, number> = {
      [ResourceCrisisLevel.Stable]: 0,
      [ResourceCrisisLevel.Warning]: 1,
      [ResourceCrisisLevel.Critical]: 2,
      [ResourceCrisisLevel.Catastrophic]: 3,
    };

    let worst: ResourceCrisisLevel = ResourceCrisisLevel.Stable;

    for (const detail of details) {
      const currentSeverity = severity[detail.crisisLevel] ?? 0;
      const worstSeverity = severity[worst] ?? 0;

      if (currentSeverity > worstSeverity) {
        worst = detail.crisisLevel;
      }
    }

    return worst;
  }
}
