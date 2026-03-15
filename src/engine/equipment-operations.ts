/**
 * Military Equipment Operations Engine — CNFL-3202, FR-2300
 *
 * Pure-function engine for purchasing, selling, relocating, recalling, and
 * maintaining military equipment inventories.  Every method is side-effect-free
 * and operates exclusively on the data passed in.
 *
 * No DOM access, no RNG, no mutations.
 *
 * @module engine/equipment-operations
 * @see FR-2300 — Military Equipment Operations
 * @see CNFL-3202 — Equipment Buy / Sell / Relocate / Recall
 */

import type { FactionId } from '@/data/types';
import type { MilitaryEquipment } from '@/data/types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * A single line-item in a nation's equipment inventory, representing one
 * equipment type and its current operational state.
 */
export interface EquipmentInventoryItem {
  /** Equipment type identifier (references {@link MilitaryEquipment.equipmentId}). */
  readonly equipmentId: string;
  /** Number of units of this equipment type held. */
  readonly quantity: number;
  /** Operational readiness percentage (0–100). */
  readonly readiness: number;
  /** Theater/region the equipment is currently deployed to, or `null` if in homeland. */
  readonly deployedTo: string | null;
  /** Turns remaining until newly purchased / relocated units become operational. */
  readonly turnsUntilReady: number;
}

/**
 * Complete equipment inventory for a single faction.
 */
export interface EquipmentInventory {
  /** Owning faction. */
  readonly factionId: FactionId;
  /** All equipment line-items. */
  readonly items: readonly EquipmentInventoryItem[];
  /** Aggregate per-turn maintenance cost across all items. */
  readonly totalMaintenanceCost: number;
}

/**
 * A request to purchase equipment.
 */
export interface PurchaseOrder {
  /** Equipment type to procure. */
  readonly equipmentId: string;
  /** Number of units to procure. */
  readonly quantity: number;
  /** Faction placing the order. */
  readonly buyerFaction: FactionId;
}

/**
 * Outcome of a purchase attempt.
 */
export interface PurchaseResult {
  /** Whether the purchase was approved and funded. */
  readonly success: boolean;
  /** Total cost deducted from the treasury (0 if failed). */
  readonly cost: number;
  /** Treasury balance after the purchase. */
  readonly remainingTreasury: number;
  /** Build / delivery time in turns. */
  readonly turnsUntilDelivery: number;
  /** Human-readable error messages (empty array on success). */
  readonly errors: string[];
}

/**
 * Outcome of a sale attempt.
 */
export interface SaleResult {
  /** Whether the sale completed successfully. */
  readonly success: boolean;
  /** Revenue received from the sale (0 if failed). */
  readonly revenue: number;
  /** Human-readable error messages (empty array on success). */
  readonly errors: string[];
}

/**
 * Outcome of a relocate or recall operation.
 */
export interface RelocateResult {
  /** Whether the operation was accepted. */
  readonly success: boolean;
  /** Turns until the equipment arrives at its destination. */
  readonly turnsToArrive: number;
  /** Human-readable error messages (empty array on success). */
  readonly errors: string[];
}

/**
 * Per-turn maintenance cost report for a faction's entire inventory.
 */
export interface MaintenanceReport {
  /** Faction this report covers. */
  readonly factionId: FactionId;
  /** Aggregate maintenance cost this turn. */
  readonly totalCost: number;
  /** Per-equipment breakdown of maintenance costs. */
  readonly itemCosts: readonly {
    readonly equipmentId: string;
    readonly cost: number;
    readonly quantity: number;
  }[];
  /**
   * Aggregate readiness impact across the inventory.
   *
   * Positive values indicate readiness improvement, negative values indicate
   * degradation.  Magnitude depends on budget coverage ratio.
   */
  readonly readinessImpact: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default depreciation rate applied when selling equipment (40%). */
const DEFAULT_DEPRECIATION_RATE = 0.4;

/** Readiness points lost per turn when maintenance is under-funded. */
const READINESS_DECAY_PER_TURN = 5;

/** Readiness points recovered per turn when maintenance is fully funded. */
const READINESS_RECOVERY_PER_TURN = 3;

/** Maximum readiness value. */
const MAX_READINESS = 100;

/** Minimum readiness value. */
const MIN_READINESS = 0;

/** Base turns for a relocate / recall operation. */
const RELOCATE_BASE_TURNS = 2;

/** Minimum readiness threshold for an item to be considered deployable. */
const DEPLOYABLE_READINESS_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine for military equipment buy / sell / relocate / recall
 * operations and maintenance bookkeeping.
 *
 * All methods are pure functions — they accept state and return new values
 * without mutating any input.
 *
 * @see FR-2300 — Military Equipment
 * @see CNFL-3202 — Equipment Operations
 */
export class EquipmentOperationsEngine {
  // ── Purchase ────────────────────────────────────────────────────────────

  /**
   * Attempt to purchase military equipment for a faction.
   *
   * Validates that:
   * 1. The nation's treasury can cover `purchaseCost × quantity`.
   * 2. The nation's tech level meets every domain requirement on the
   *    equipment.
   * 3. The build time is recorded for delivery scheduling.
   *
   * @param order           Purchase request details
   * @param equipment       Equipment definition from the catalog
   * @param treasury        Current treasury balance
   * @param nationTechLevel Nation's aggregate technology level (0–100)
   * @returns Purchase result with cost, remaining treasury, and delivery ETA
   *
   * @see FR-2300
   */
  purchaseEquipment(
    order: PurchaseOrder,
    equipment: MilitaryEquipment,
    treasury: number,
    nationTechLevel: number,
  ): PurchaseResult {
    const errors: string[] = [];

    // ── Validate tech requirements ──────────────────────────────────────
    if (equipment.techRequirements) {
      const unmetDomains = Object.entries(equipment.techRequirements)
        .filter(
          ([, requiredLevel]) =>
            requiredLevel !== undefined && nationTechLevel < requiredLevel,
        )
        .map(
          ([domain, requiredLevel]) =>
            `Tech domain '${domain}' requires level ${requiredLevel} but nation is at ${nationTechLevel}`,
        );

      if (unmetDomains.length > 0) {
        errors.push(...unmetDomains);
      }
    }

    // ── Validate treasury ───────────────────────────────────────────────
    const totalCost = equipment.purchaseCost * order.quantity;

    if (treasury < totalCost) {
      errors.push(
        `Insufficient treasury: need ${totalCost} but only ${treasury} available`,
      );
    }

    // ── Short-circuit on validation failures ────────────────────────────
    if (errors.length > 0) {
      return {
        success: false,
        cost: 0,
        remainingTreasury: treasury,
        turnsUntilDelivery: 0,
        errors,
      };
    }

    // ── Success ─────────────────────────────────────────────────────────
    return {
      success: true,
      cost: totalCost,
      remainingTreasury: treasury - totalCost,
      turnsUntilDelivery: equipment.buildTime,
      errors: [],
    };
  }

  // ── Sale ────────────────────────────────────────────────────────────────

  /**
   * Sell equipment from a nation's inventory at a depreciated price.
   *
   * Sale price = `purchaseCost × (1 − depreciationRate) × quantity`.
   *
   * The caller is responsible for actually mutating the inventory; this
   * method only validates the operation and computes the revenue.
   *
   * @param equipmentId     Equipment type to sell
   * @param quantity        Number of units to sell
   * @param inventory       Faction's current inventory
   * @param equipment       Equipment definition from the catalog
   * @param depreciationRate Fraction of value lost (0–1), defaults to 0.4
   * @returns Sale result with revenue or errors
   */
  sellEquipment(
    equipmentId: string,
    quantity: number,
    inventory: EquipmentInventory,
    equipment: MilitaryEquipment,
    depreciationRate: number = DEFAULT_DEPRECIATION_RATE,
  ): SaleResult {
    const errors: string[] = [];

    // ── Locate the item in inventory ────────────────────────────────────
    const item = inventory.items.find((i) => i.equipmentId === equipmentId);

    if (!item) {
      errors.push(`Equipment '${equipmentId}' not found in inventory`);
      return { success: false, revenue: 0, errors };
    }

    if (item.quantity < quantity) {
      errors.push(
        `Cannot sell ${quantity} units of '${equipmentId}': only ${item.quantity} in inventory`,
      );
      return { success: false, revenue: 0, errors };
    }

    // ── Cannot sell deployed equipment ──────────────────────────────────
    if (item.deployedTo !== null) {
      errors.push(
        `Cannot sell '${equipmentId}': equipment is currently deployed to '${item.deployedTo}'. Recall first.`,
      );
      return { success: false, revenue: 0, errors };
    }

    // ── Compute revenue ─────────────────────────────────────────────────
    const clampedDepreciation = Math.min(Math.max(depreciationRate, 0), 1);
    const revenue =
      equipment.purchaseCost * (1 - clampedDepreciation) * quantity;

    return {
      success: true,
      revenue,
      errors: [],
    };
  }

  // ── Relocate ────────────────────────────────────────────────────────────

  /**
   * Relocate equipment from its current location to a new theater / region.
   *
   * Uses a simplified transit time of {@link RELOCATE_BASE_TURNS} turns.
   *
   * @param equipmentId Equipment type to relocate
   * @param quantity    Number of units to move
   * @param destination Target theater / region identifier
   * @param inventory   Faction's current inventory
   * @returns Relocate result with ETA or errors
   */
  relocateEquipment(
    equipmentId: string,
    quantity: number,
    destination: string,
    inventory: EquipmentInventory,
  ): RelocateResult {
    const errors: string[] = [];

    // ── Locate the item ─────────────────────────────────────────────────
    const item = inventory.items.find((i) => i.equipmentId === equipmentId);

    if (!item) {
      errors.push(`Equipment '${equipmentId}' not found in inventory`);
      return { success: false, turnsToArrive: 0, errors };
    }

    if (item.quantity < quantity) {
      errors.push(
        `Cannot relocate ${quantity} units of '${equipmentId}': only ${item.quantity} available`,
      );
      return { success: false, turnsToArrive: 0, errors };
    }

    // ── Validate destination ────────────────────────────────────────────
    if (!destination || destination.trim().length === 0) {
      errors.push('Destination must be a non-empty string');
      return { success: false, turnsToArrive: 0, errors };
    }

    if (item.deployedTo === destination) {
      errors.push(
        `Equipment '${equipmentId}' is already deployed to '${destination}'`,
      );
      return { success: false, turnsToArrive: 0, errors };
    }

    // ── Compute transit time (simplified: flat base turns) ──────────────
    const turnsToArrive = RELOCATE_BASE_TURNS;

    return {
      success: true,
      turnsToArrive,
      errors: [],
    };
  }

  // ── Recall ──────────────────────────────────────────────────────────────

  /**
   * Recall deployed equipment back to the homeland.
   *
   * Equivalent to a relocate with the destination set to the faction's home
   * territory.  Uses the same simplified transit time.
   *
   * @param equipmentId Equipment type to recall
   * @param quantity    Number of units to recall
   * @param inventory   Faction's current inventory
   * @returns Relocate result with ETA or errors
   */
  recallEquipment(
    equipmentId: string,
    quantity: number,
    inventory: EquipmentInventory,
  ): RelocateResult {
    const errors: string[] = [];

    // ── Locate the item ─────────────────────────────────────────────────
    const item = inventory.items.find((i) => i.equipmentId === equipmentId);

    if (!item) {
      errors.push(`Equipment '${equipmentId}' not found in inventory`);
      return { success: false, turnsToArrive: 0, errors };
    }

    if (item.quantity < quantity) {
      errors.push(
        `Cannot recall ${quantity} units of '${equipmentId}': only ${item.quantity} available`,
      );
      return { success: false, turnsToArrive: 0, errors };
    }

    // ── Must be deployed to recall ──────────────────────────────────────
    if (item.deployedTo === null) {
      errors.push(
        `Equipment '${equipmentId}' is not deployed; nothing to recall`,
      );
      return { success: false, turnsToArrive: 0, errors };
    }

    // ── Compute transit time ────────────────────────────────────────────
    const turnsToArrive = RELOCATE_BASE_TURNS;

    return {
      success: true,
      turnsToArrive,
      errors: [],
    };
  }

  // ── Maintenance ─────────────────────────────────────────────────────────

  /**
   * Calculate the per-turn maintenance bill for an entire faction inventory
   * and determine the aggregate readiness impact based on budget coverage.
   *
   * When `maintenanceBudgetRatio` ≥ 1.0 the inventory is fully funded and
   * readiness improves by {@link READINESS_RECOVERY_PER_TURN} per item.
   * When the ratio is < 1.0, readiness degrades by
   * {@link READINESS_DECAY_PER_TURN} per item.
   *
   * @param inventory              Faction's current inventory
   * @param equipmentCatalog       Map of equipmentId → equipment definition
   * @param maintenanceBudgetRatio Fraction of required maintenance actually
   *                               funded (e.g. 0.8 = 80 %). Values > 1 are
   *                               treated as 1.
   * @returns Detailed maintenance cost report
   */
  calculateMaintenance(
    inventory: EquipmentInventory,
    equipmentCatalog: Map<string, MilitaryEquipment>,
    maintenanceBudgetRatio: number,
  ): MaintenanceReport {
    const itemCosts: { equipmentId: string; cost: number; quantity: number }[] =
      [];
    let totalCost = 0;
    let readinessImpact = 0;

    const clampedRatio = Math.min(Math.max(maintenanceBudgetRatio, 0), 1);
    const isFunded = clampedRatio >= 1.0;

    for (const item of inventory.items) {
      const catalogEntry = equipmentCatalog.get(item.equipmentId);

      if (!catalogEntry) {
        // Unknown equipment — skip (graceful degradation).
        continue;
      }

      const lineCost = catalogEntry.maintenanceCostPerTurn * item.quantity;
      totalCost += lineCost;

      itemCosts.push({
        equipmentId: item.equipmentId,
        cost: lineCost,
        quantity: item.quantity,
      });

      // ── Readiness impact ──────────────────────────────────────────────
      if (isFunded) {
        const headroom = MAX_READINESS - item.readiness;
        const recovery = Math.min(READINESS_RECOVERY_PER_TURN, headroom);
        readinessImpact += recovery * item.quantity;
      } else {
        const room = item.readiness - MIN_READINESS;
        const decay = Math.min(READINESS_DECAY_PER_TURN, room);
        readinessImpact -= decay * item.quantity;
      }
    }

    return {
      factionId: inventory.factionId,
      totalCost,
      itemCosts,
      readinessImpact,
    };
  }

  // ── Readiness ───────────────────────────────────────────────────────────

  /**
   * Return a **new** inventory item with its readiness adjusted based on
   * whether maintenance was funded this turn.
   *
   * - Funded: readiness increases by {@link READINESS_RECOVERY_PER_TURN},
   *   capped at {@link MAX_READINESS}.
   * - Under-funded: readiness decreases by {@link READINESS_DECAY_PER_TURN},
   *   floored at {@link MIN_READINESS}.
   *
   * @param item              The inventory item to update
   * @param maintenanceFunded Whether maintenance was fully funded this turn
   * @returns A new item with updated readiness (original is not mutated)
   */
  updateReadiness(
    item: EquipmentInventoryItem,
    maintenanceFunded: boolean,
  ): EquipmentInventoryItem {
    let newReadiness: number;

    if (maintenanceFunded) {
      newReadiness = Math.min(
        item.readiness + READINESS_RECOVERY_PER_TURN,
        MAX_READINESS,
      );
    } else {
      newReadiness = Math.max(
        item.readiness - READINESS_DECAY_PER_TURN,
        MIN_READINESS,
      );
    }

    return {
      equipmentId: item.equipmentId,
      quantity: item.quantity,
      readiness: newReadiness,
      deployedTo: item.deployedTo,
      turnsUntilReady: item.turnsUntilReady,
    };
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /**
   * Count the number of units of a given equipment type that are ready for
   * immediate deployment (readiness ≥ {@link DEPLOYABLE_READINESS_THRESHOLD},
   * not currently in transit, and `turnsUntilReady` is 0).
   *
   * @param inventory   Faction's current inventory
   * @param equipmentId Equipment type to query
   * @returns Number of deployable units
   */
  getDeployableCount(
    inventory: EquipmentInventory,
    equipmentId: string,
  ): number {
    let deployable = 0;

    for (const item of inventory.items) {
      if (item.equipmentId !== equipmentId) {
        continue;
      }

      if (
        item.readiness >= DEPLOYABLE_READINESS_THRESHOLD &&
        item.turnsUntilReady === 0
      ) {
        deployable += item.quantity;
      }
    }

    return deployable;
  }

  /**
   * Compute the aggregate military strength contributed by all equipment in
   * a faction's inventory.
   *
   * Strength per line-item is:
   *
   * ```
   * (attackPower + defensePower) / 2 × quantity × (readiness / 100)
   * ```
   *
   * Only items that have completed delivery (`turnsUntilReady === 0`) are
   * included.
   *
   * @param inventory        Faction's current inventory
   * @param equipmentCatalog Map of equipmentId → equipment definition
   * @returns Aggregate force strength value
   */
  computeForceStrength(
    inventory: EquipmentInventory,
    equipmentCatalog: Map<string, MilitaryEquipment>,
  ): number {
    let totalStrength = 0;

    for (const item of inventory.items) {
      // Skip items still being built / delivered.
      if (item.turnsUntilReady > 0) {
        continue;
      }

      const catalogEntry = equipmentCatalog.get(item.equipmentId);

      if (!catalogEntry) {
        // Unknown equipment — skip gracefully.
        continue;
      }

      const basePower =
        (catalogEntry.attackPower + catalogEntry.defensePower) / 2;
      const readinessMultiplier = item.readiness / MAX_READINESS;
      const lineStrength = basePower * item.quantity * readinessMultiplier;

      totalStrength += lineStrength;
    }

    return totalStrength;
  }
}
