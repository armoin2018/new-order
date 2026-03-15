/**
 * Combat–Equipment Integration Engine — CNFL-3204, FR-2301
 *
 * Bridges the military equipment catalog ({@link MilitaryEquipment}) with
 * the combat resolver and force-structure engines.  Converts equipment
 * inventories into force-structure values, applies equipment bonuses to
 * combat resolution, and computes national military power from an equipment
 * portfolio.
 *
 * Pure-function engine — no side effects, no DOM access, no RNG, no mutations.
 *
 * @module engine/combat-equipment-integration
 * @see CNFL-3204 — Combat Equipment Integration
 * @see FR-2301 — Equipment → Force Structure Bridge
 */

import type { FactionId } from '@/data/types';
import type { MilitaryEquipment, EquipmentCategory } from '@/data/types/model.types';
import type { EquipmentInventory, EquipmentInventoryItem } from './equipment-operations';
import type { ForceStructure } from './force-structure';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The value to constrain.
 * @param min   - Lower bound (default `0`).
 * @param max   - Upper bound (default `100`).
 * @returns The clamped value.
 */
function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Apply logarithmic scaling to a raw power sum so that super-powers cannot
 * trivially saturate every dimension at 100.
 *
 * Uses `100 * ln(1 + raw) / ln(1 + ceiling)` where `ceiling` represents an
 * empirically-chosen upper bound on realistic raw totals.
 *
 * @param raw     - Unnormalised power sum.
 * @param ceiling - The raw value that maps to 100.  Default `5000`.
 * @returns A value in the range [0, 100].
 */
function logScale(raw: number, ceiling = 5000): number {
  if (raw <= 0) return 0;
  const scaled = (100 * Math.log(1 + raw)) / Math.log(1 + ceiling);
  return clamp(Math.round(scaled * 100) / 100);
}

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Equipment contribution to each dimension of a faction's force structure.
 *
 * Every numeric field uses a normalised 0–100 scale.
 */
export interface EquipmentForceContribution {
  /** Owning faction. */
  readonly factionId: FactionId;
  /** Aggregate air-power score (0–100). */
  readonly airPower: number;
  /** Aggregate naval-power score (0–100). */
  readonly navalPower: number;
  /** Aggregate ground-power score (0–100). */
  readonly groundPower: number;
  /** Aggregate cyber-capability score (0–100). */
  readonly cyberCapability: number;
  /** Aggregate intelligence-capability score (0–100). */
  readonly intelCapability: number;
  /** Aggregate domestic-control score (0–100). */
  readonly domesticControl: number;
  /** Aggregate drone-capability score (0–100). */
  readonly droneCapability: number;
  /** Weighted composite military power (0–100). */
  readonly totalMilitaryPower: number;
}

/**
 * Combat modifier derived from comparing attacker and defender equipment.
 */
export interface EquipmentCombatModifier {
  /** Bonus applied to attacker's combat roll. */
  readonly attackBonus: number;
  /** Bonus applied to defender's combat roll. */
  readonly defenseBonus: number;
  /** Advantage from stealth-capable equipment (0–100). */
  readonly stealthAdvantage: number;
  /** Advantage from superior technology levels (0–100). */
  readonly techAdvantage: number;
  /** Unique special-ability names collected from deployed equipment. */
  readonly specialAbilityBonuses: readonly string[];
}

/**
 * Full portfolio analysis for a faction's equipment inventory.
 */
export interface EquipmentPortfolioAnalysis {
  /** Analysed faction. */
  readonly factionId: FactionId;
  /** Total number of individual equipment units across all line-items. */
  readonly totalEquipmentCount: number;
  /** Aggregate per-turn maintenance cost. */
  readonly totalMaintenanceCost: number;
  /** Mean readiness across all inventory items (0–100). */
  readonly averageReadiness: number;
  /** Equipment count by {@link EquipmentCategory}. */
  readonly categoryBreakdown: Readonly<Record<string, number>>;
  /** Categories with zero or critically-low representation. */
  readonly weaknesses: readonly string[];
  /** Categories with strong quantity × readiness scores. */
  readonly strengths: readonly string[];
  /** Derived force-structure contribution. */
  readonly forceContribution: EquipmentForceContribution;
}

/**
 * Result of comparing two factions' equipment portfolios.
 */
export interface ForceComparison {
  /** First faction in the comparison. */
  readonly factionA: FactionId;
  /** Second faction in the comparison. */
  readonly factionB: FactionId;
  /** Which faction holds the overall advantage, or `'balanced'`. */
  readonly overallAdvantage: 'factionA' | 'factionB' | 'balanced';
  /** Magnitude of the advantage (0–100). */
  readonly advantageMargin: number;
  /** Per-category advantage breakdown. */
  readonly categoryAdvantages: Readonly<Record<string, 'factionA' | 'factionB' | 'balanced'>>;
  /** Human-readable assessment of the comparison. */
  readonly assessment: string;
}

// ---------------------------------------------------------------------------
// Category → Force Dimension Mapping
// ---------------------------------------------------------------------------

/** Map from {@link EquipmentCategory} to the force-contribution dimension it feeds. */
const CATEGORY_DIMENSION_MAP: Readonly<Record<EquipmentCategory, keyof Omit<EquipmentForceContribution, 'factionId' | 'totalMilitaryPower'>>> = {
  'air': 'airPower',
  'sea': 'navalPower',
  'ground': 'groundPower',
  'cyber-offense': 'cyberCapability',
  'cyber-defense': 'cyberCapability',
  'spy-covert': 'intelCapability',
  'domestic': 'domesticControl',
  'drone': 'droneCapability',
};

/**
 * Weights used when aggregating dimension scores into
 * {@link EquipmentForceContribution.totalMilitaryPower}.
 */
const DIMENSION_WEIGHTS: Readonly<Record<string, number>> = {
  groundPower: 0.25,
  airPower: 0.25,
  navalPower: 0.20,
  cyberCapability: 0.15,
  intelCapability: 0.10,
  droneCapability: 0.05,
};

/** Threshold below which a category is flagged as a weakness. */
const WEAKNESS_THRESHOLD = 5;

/** Threshold above which a category is flagged as a strength. */
const STRENGTH_THRESHOLD = 50;

/** Margin within which two forces are considered balanced. */
const BALANCED_MARGIN = 5;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Integrates the military equipment catalog with the combat resolver and
 * force-structure engines.
 *
 * All methods are pure — they accept data, return new objects, and never
 * mutate their arguments.
 *
 * @see CNFL-3204
 * @see FR-2301
 */
export class CombatEquipmentIntegration {
  // ── Force Contribution ──────────────────────────────────────────────

  /**
   * Convert an equipment inventory into a normalised force-structure
   * contribution across every military dimension.
   *
   * Each inventory item is matched to its catalog entry; its combined
   * attack + defense power is weighted by quantity and readiness and
   * accumulated into the dimension dictated by
   * {@link CATEGORY_DIMENSION_MAP}.  Raw totals are log-scaled to
   * prevent super-powers from trivially saturating 100 on every axis.
   *
   * @param inventory - Faction equipment inventory.
   * @param catalog   - Complete equipment catalog for look-ups.
   * @returns Normalised contribution per dimension plus a weighted
   *          composite total.
   */
  computeForceContribution(
    inventory: EquipmentInventory,
    catalog: readonly MilitaryEquipment[],
  ): EquipmentForceContribution {
    const catalogMap = this.buildCatalogMap(catalog);

    /** Mutable accumulators for raw power per dimension. */
    const rawTotals: Record<string, number> = {
      airPower: 0,
      navalPower: 0,
      groundPower: 0,
      cyberCapability: 0,
      intelCapability: 0,
      domesticControl: 0,
      droneCapability: 0,
    };

    for (const item of inventory.items) {
      const equipment = catalogMap.get(item.equipmentId);
      if (!equipment) continue;

      const dimension = CATEGORY_DIMENSION_MAP[equipment.category];
      const combinedPower = equipment.attackPower + equipment.defensePower;
      const effective = combinedPower * item.quantity * (item.readiness / 100);
      rawTotals[dimension] += effective;
    }

    const airPower = logScale(rawTotals.airPower);
    const navalPower = logScale(rawTotals.navalPower);
    const groundPower = logScale(rawTotals.groundPower);
    const cyberCapability = logScale(rawTotals.cyberCapability);
    const intelCapability = logScale(rawTotals.intelCapability);
    const domesticControl = logScale(rawTotals.domesticControl);
    const droneCapability = logScale(rawTotals.droneCapability);

    const totalMilitaryPower = clamp(Math.round((
      groundPower * DIMENSION_WEIGHTS.groundPower +
      airPower * DIMENSION_WEIGHTS.airPower +
      navalPower * DIMENSION_WEIGHTS.navalPower +
      cyberCapability * DIMENSION_WEIGHTS.cyberCapability +
      intelCapability * DIMENSION_WEIGHTS.intelCapability +
      droneCapability * DIMENSION_WEIGHTS.droneCapability
    ) * 100) / 100);

    return {
      factionId: inventory.factionId,
      airPower,
      navalPower,
      groundPower,
      cyberCapability,
      intelCapability,
      domesticControl,
      droneCapability,
      totalMilitaryPower,
    };
  }

  // ── Combat Modifier ─────────────────────────────────────────────────

  /**
   * Derive combat modifiers by comparing attacker and defender equipment.
   *
   * - **attackBonus** — sum of attack power across the attacker's
   *   *deployed* equipment (readiness &gt; 50, `deployedTo` not null),
   *   log-scaled.
   * - **defenseBonus** — sum of defense power across the defender's
   *   *homeland* equipment (`deployedTo` is null), log-scaled.
   * - **stealthAdvantage** — count of attacker items with a
   *   `stealthRating` above 50, log-scaled.
   * - **techAdvantage** — difference in average tech-requirement level
   *   between attacker and defender, clamped to [0, 100].
   * - **specialAbilityBonuses** — unique ability names collected from the
   *   attacker's deployed equipment.
   *
   * @param attackerInventory - Attacker's equipment inventory.
   * @param defenderInventory - Defender's equipment inventory.
   * @param catalog           - Complete equipment catalog.
   * @returns Combat modifier record.
   */
  computeCombatModifier(
    attackerInventory: EquipmentInventory,
    defenderInventory: EquipmentInventory,
    catalog: readonly MilitaryEquipment[],
  ): EquipmentCombatModifier {
    const catalogMap = this.buildCatalogMap(catalog);

    // ── Attack bonus (deployed equipment only) ──────────────────────
    let rawAttack = 0;
    let stealthCount = 0;
    const abilitySet = new Set<string>();
    let attackerTechSum = 0;
    let attackerTechCount = 0;

    for (const item of attackerInventory.items) {
      const eq = catalogMap.get(item.equipmentId);
      if (!eq) continue;

      if (item.readiness > 50 && item.deployedTo !== null) {
        rawAttack += eq.attackPower * item.quantity * (item.readiness / 100);

        if (eq.stealthRating !== undefined && eq.stealthRating > 50) {
          stealthCount += item.quantity;
        }

        if (eq.specialAbilities) {
          for (const ability of eq.specialAbilities) {
            abilitySet.add(ability.name);
          }
        }
      }

      // Tech level for all attacker equipment (not just deployed).
      if (eq.techRequirements) {
        const levels = Object.values(eq.techRequirements) as number[];
        for (const lvl of levels) {
          attackerTechSum += lvl;
          attackerTechCount += 1;
        }
      }
    }

    // ── Defense bonus (homeland equipment) ──────────────────────────
    let rawDefense = 0;
    let defenderTechSum = 0;
    let defenderTechCount = 0;

    for (const item of defenderInventory.items) {
      const eq = catalogMap.get(item.equipmentId);
      if (!eq) continue;

      if (item.deployedTo === null) {
        rawDefense += eq.defensePower * item.quantity * (item.readiness / 100);
      }

      if (eq.techRequirements) {
        const levels = Object.values(eq.techRequirements) as number[];
        for (const lvl of levels) {
          defenderTechSum += lvl;
          defenderTechCount += 1;
        }
      }
    }

    const attackBonus = logScale(rawAttack);
    const defenseBonus = logScale(rawDefense);
    const stealthAdvantage = logScale(stealthCount, 200);

    const attackerAvgTech = attackerTechCount > 0 ? attackerTechSum / attackerTechCount : 0;
    const defenderAvgTech = defenderTechCount > 0 ? defenderTechSum / defenderTechCount : 0;
    const techAdvantage = clamp(Math.round((attackerAvgTech - defenderAvgTech) * 10));

    return {
      attackBonus,
      defenseBonus,
      stealthAdvantage,
      techAdvantage,
      specialAbilityBonuses: [...abilitySet].sort(),
    };
  }

  // ── Portfolio Analysis ──────────────────────────────────────────────

  /**
   * Produce a comprehensive analysis of a faction's equipment portfolio.
   *
   * The analysis includes total counts, maintenance costs, per-category
   * breakdowns, identified weaknesses (categories at or below
   * {@link WEAKNESS_THRESHOLD}), strengths (categories at or above
   * {@link STRENGTH_THRESHOLD}), and the derived force contribution.
   *
   * @param inventory - Faction equipment inventory.
   * @param catalog   - Complete equipment catalog.
   * @returns Full portfolio analysis.
   */
  analyzePortfolio(
    inventory: EquipmentInventory,
    catalog: readonly MilitaryEquipment[],
  ): EquipmentPortfolioAnalysis {
    const catalogMap = this.buildCatalogMap(catalog);

    let totalEquipmentCount = 0;
    let totalMaintenance = 0;
    let readinessSum = 0;
    let readinessCount = 0;

    /** Count of equipment units per category. */
    const categoryBreakdown: Record<string, number> = {};

    for (const item of inventory.items) {
      const eq = catalogMap.get(item.equipmentId);
      if (!eq) continue;

      totalEquipmentCount += item.quantity;
      totalMaintenance += eq.maintenanceCostPerTurn * item.quantity;

      readinessSum += item.readiness * item.quantity;
      readinessCount += item.quantity;

      const cat = eq.category as string;
      categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + item.quantity;
    }

    const averageReadiness = readinessCount > 0
      ? clamp(Math.round((readinessSum / readinessCount) * 100) / 100)
      : 0;

    // Identify weaknesses and strengths based on category effective scores.
    const allCategories: EquipmentCategory[] = [
      'air', 'sea', 'ground', 'cyber-offense', 'cyber-defense',
      'spy-covert', 'domestic', 'drone',
    ];

    const weaknesses: string[] = [];
    const strengths: string[] = [];

    for (const cat of allCategories) {
      const count = categoryBreakdown[cat] ?? 0;
      if (count <= WEAKNESS_THRESHOLD) {
        weaknesses.push(cat);
      }
      // Strength requires meaningful quantity weighted by average readiness.
      if (count * (averageReadiness / 100) >= STRENGTH_THRESHOLD) {
        strengths.push(cat);
      }
    }

    const forceContribution = this.computeForceContribution(inventory, catalog);

    return {
      factionId: inventory.factionId,
      totalEquipmentCount,
      totalMaintenanceCost: totalMaintenance,
      averageReadiness,
      categoryBreakdown,
      weaknesses,
      strengths,
      forceContribution,
    };
  }

  // ── Force Comparison ────────────────────────────────────────────────

  /**
   * Compare two factions' equipment portfolios and determine per-category
   * and overall advantage.
   *
   * The overall advantage is based on {@link EquipmentForceContribution.totalMilitaryPower};
   * category advantages compare the corresponding dimension scores.
   *
   * @param inventoryA - First faction's equipment inventory.
   * @param inventoryB - Second faction's equipment inventory.
   * @param catalog    - Complete equipment catalog.
   * @returns Detailed force comparison.
   */
  compareForces(
    inventoryA: EquipmentInventory,
    inventoryB: EquipmentInventory,
    catalog: readonly MilitaryEquipment[],
  ): ForceComparison {
    const contribA = this.computeForceContribution(inventoryA, catalog);
    const contribB = this.computeForceContribution(inventoryB, catalog);

    const diff = contribA.totalMilitaryPower - contribB.totalMilitaryPower;
    const margin = clamp(Math.round(Math.abs(diff) * 100) / 100);

    const overallAdvantage: ForceComparison['overallAdvantage'] =
      Math.abs(diff) <= BALANCED_MARGIN ? 'balanced'
        : diff > 0 ? 'factionA'
          : 'factionB';

    // Per-dimension comparison.
    const dimensionKeys = [
      'airPower', 'navalPower', 'groundPower',
      'cyberCapability', 'intelCapability', 'domesticControl', 'droneCapability',
    ] as const;

    const categoryAdvantages: Record<string, 'factionA' | 'factionB' | 'balanced'> = {};

    for (const key of dimensionKeys) {
      const d = (contribA[key] as number) - (contribB[key] as number);
      categoryAdvantages[key] =
        Math.abs(d) <= BALANCED_MARGIN ? 'balanced'
          : d > 0 ? 'factionA'
            : 'factionB';
    }

    // Generate assessment.
    const winner = overallAdvantage === 'balanced'
      ? 'Neither faction'
      : overallAdvantage === 'factionA'
        ? String(inventoryA.factionId)
        : String(inventoryB.factionId);

    const assessment = overallAdvantage === 'balanced'
      ? `Forces are broadly balanced (margin ${margin.toFixed(1)}). ` +
        `Both factions should focus on category-specific advantages.`
      : `${winner} holds an overall advantage of ${margin.toFixed(1)} points. ` +
        `Key strengths lie in ${this.summariseAdvantages(categoryAdvantages, overallAdvantage)}.`;

    return {
      factionA: inventoryA.factionId,
      factionB: inventoryB.factionId,
      overallAdvantage,
      advantageMargin: margin,
      categoryAdvantages,
      assessment,
    };
  }

  // ── Force Structure Bridge ──────────────────────────────────────────

  /**
   * Convert an equipment inventory into a {@link ForceStructure} record
   * compatible with the force-structure engine.
   *
   * Mapping rules:
   * - `activeForces`       ← `groundPower` from the contribution.
   * - `nuclearArsenal`     ← `0` (nuclear capability is not derived from
   *   conventional equipment).
   * - `navalPower`         ← `navalPower` from the contribution.
   * - `airPower`           ← `airPower` from the contribution.
   * - `specialCapabilities`← unique special-ability IDs across all items.
   * - `forceProjection`    ← heuristic based on carrier-class sea
   *   equipment, long-range air platforms, and overall naval strength.
   * - `readiness`          ← weighted-average readiness of all items.
   *
   * @param inventory - Faction equipment inventory.
   * @param catalog   - Complete equipment catalog.
   * @returns An immutable {@link ForceStructure} record.
   */
  computeForceStructure(
    inventory: EquipmentInventory,
    catalog: readonly MilitaryEquipment[],
  ): ForceStructure {
    const catalogMap = this.buildCatalogMap(catalog);
    const contribution = this.computeForceContribution(inventory, catalog);

    // ── Collect special capabilities ────────────────────────────────
    const capabilities = new Set<string>();
    for (const item of inventory.items) {
      const eq = catalogMap.get(item.equipmentId);
      if (!eq?.specialAbilities) continue;
      for (const ability of eq.specialAbilities) {
        capabilities.add(ability.abilityId);
      }
    }

    // ── Force projection heuristic ──────────────────────────────────
    // Carriers and long-range aircraft dramatically improve power
    // projection.  We look for sea items with large range (proxy for
    // carriers) and air items with high range.
    let carrierScore = 0;
    let longRangeAirScore = 0;

    for (const item of inventory.items) {
      const eq = catalogMap.get(item.equipmentId);
      if (!eq) continue;

      if (eq.category === 'sea' && (eq.range ?? 0) >= 80) {
        carrierScore += item.quantity * (item.readiness / 100);
      }
      if (eq.category === 'air' && (eq.range ?? 0) >= 60) {
        longRangeAirScore += item.quantity * (item.readiness / 100);
      }
    }

    const projectionRaw =
      contribution.navalPower * 0.4 +
      logScale(carrierScore, 50) * 0.35 +
      logScale(longRangeAirScore, 100) * 0.25;

    const forceProjection = clamp(Math.round(projectionRaw * 100) / 100);

    // ── Average readiness ───────────────────────────────────────────
    let readinessWeightedSum = 0;
    let totalQuantity = 0;

    for (const item of inventory.items) {
      readinessWeightedSum += item.readiness * item.quantity;
      totalQuantity += item.quantity;
    }

    const readiness = totalQuantity > 0
      ? clamp(Math.round((readinessWeightedSum / totalQuantity) * 100) / 100)
      : 0;

    return {
      factionId: inventory.factionId,
      activeForces: contribution.groundPower,
      nuclearArsenal: 0,
      navalPower: contribution.navalPower,
      airPower: contribution.airPower,
      specialCapabilities: [...capabilities].sort(),
      forceProjection,
      readiness,
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  /**
   * Build a look-up map from equipment ID to its catalog definition.
   *
   * @param catalog - Array of all known equipment definitions.
   * @returns Map keyed by {@link MilitaryEquipment.equipmentId}.
   */
  private buildCatalogMap(
    catalog: readonly MilitaryEquipment[],
  ): ReadonlyMap<string, MilitaryEquipment> {
    const map = new Map<string, MilitaryEquipment>();
    for (const eq of catalog) {
      map.set(eq.equipmentId, eq);
    }
    return map;
  }

  /**
   * Summarise which dimensions favour the winning side in a force
   * comparison.
   *
   * @param advantages - Per-dimension advantage map.
   * @param winner     - The side that holds the overall advantage.
   * @returns Comma-separated list of dimension names.
   */
  private summariseAdvantages(
    advantages: Readonly<Record<string, 'factionA' | 'factionB' | 'balanced'>>,
    winner: 'factionA' | 'factionB',
  ): string {
    const dims = Object.entries(advantages)
      .filter(([, side]) => side === winner)
      .map(([dim]) => dim.replace(/([A-Z])/g, ' $1').trim().toLowerCase());

    return dims.length > 0 ? dims.join(', ') : 'marginal advantages across multiple domains';
  }
}
