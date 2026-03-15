import { describe, it, expect } from 'vitest';
import { EquipmentOperationsEngine } from '@/engine/equipment-operations';
import type { EquipmentInventory, EquipmentInventoryItem, PurchaseOrder } from '@/engine/equipment-operations';
import type { FactionId, MilitaryEquipment } from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEquipment(overrides: Partial<MilitaryEquipment> = {}): MilitaryEquipment {
  return {
    schemaVersion: '1.0.0',
    equipmentId: 'f-35a-lightning',
    name: 'F-35A Lightning II',
    category: 'air',
    description: 'Fifth-generation stealth multirole fighter.',
    purchaseCost: 80,
    maintenanceCostPerTurn: 8,
    attackPower: 78,
    defensePower: 60,
    buildTime: 6,
    ...overrides,
  };
}

function makeInventoryItem(overrides: Partial<EquipmentInventoryItem> = {}): EquipmentInventoryItem {
  return {
    equipmentId: 'f-35a-lightning',
    quantity: 10,
    readiness: 85,
    deployedTo: null,
    turnsUntilReady: 0,
    ...overrides,
  };
}

function makeInventory(
  items: EquipmentInventoryItem[] = [makeInventoryItem()],
  factionId: FactionId = 'us' as FactionId,
): EquipmentInventory {
  return {
    factionId,
    items,
    totalMaintenanceCost: 0,
  };
}

function makeOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    equipmentId: 'f-35a-lightning',
    quantity: 5,
    buyerFaction: 'us' as FactionId,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EquipmentOperationsEngine', () => {
  const engine = new EquipmentOperationsEngine();

  // ── purchaseEquipment ──────────────────────────────────────────────────

  describe('purchaseEquipment', () => {
    it('successful purchase with sufficient treasury', () => {
      const result = engine.purchaseEquipment(makeOrder(), makeEquipment(), 1000, 90);

      expect(result.success).toBe(true);
      // 80 × 5 = 400
      expect(result.cost).toBe(400);
      expect(result.remainingTreasury).toBe(600);
      expect(result.turnsUntilDelivery).toBe(6);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when treasury insufficient', () => {
      const result = engine.purchaseEquipment(makeOrder(), makeEquipment(), 100, 90);

      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.remainingTreasury).toBe(100);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Insufficient treasury');
    });

    it('fails when tech level too low', () => {
      const equipment = makeEquipment({
        techRequirements: { ai: 80, cyber: 70 },
      });
      const result = engine.purchaseEquipment(makeOrder(), equipment, 1000, 50);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Tech domain');
    });
  });

  // ── sellEquipment ─────────────────────────────────────────────────────

  describe('sellEquipment', () => {
    it('calculates correct revenue with depreciation', () => {
      const inventory = makeInventory([makeInventoryItem({ quantity: 10 })]);
      const result = engine.sellEquipment('f-35a-lightning', 3, inventory, makeEquipment());

      expect(result.success).toBe(true);
      // 80 × (1 - 0.4) × 3 = 144
      expect(result.revenue).toBeCloseTo(144, 2);
      expect(result.errors).toHaveLength(0);
    });

    it('fails for deployed equipment', () => {
      const inventory = makeInventory([
        makeInventoryItem({ deployedTo: 'pacific-theater' }),
      ]);
      const result = engine.sellEquipment('f-35a-lightning', 1, inventory, makeEquipment());

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('deployed');
    });
  });

  // ── relocateEquipment ─────────────────────────────────────────────────

  describe('relocateEquipment', () => {
    it('returns correct transit time', () => {
      const inventory = makeInventory();
      const result = engine.relocateEquipment('f-35a-lightning', 5, 'europe', inventory);

      expect(result.success).toBe(true);
      expect(result.turnsToArrive).toBe(2); // RELOCATE_BASE_TURNS
      expect(result.errors).toHaveLength(0);
    });
  });

  // ── recallEquipment ───────────────────────────────────────────────────

  describe('recallEquipment', () => {
    it('works for deployed equipment', () => {
      const inventory = makeInventory([
        makeInventoryItem({ deployedTo: 'middle-east' }),
      ]);
      const result = engine.recallEquipment('f-35a-lightning', 5, inventory);

      expect(result.success).toBe(true);
      expect(result.turnsToArrive).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('fails for non-deployed equipment', () => {
      const inventory = makeInventory([makeInventoryItem({ deployedTo: null })]);
      const result = engine.recallEquipment('f-35a-lightning', 5, inventory);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not deployed');
    });
  });

  // ── calculateMaintenance ──────────────────────────────────────────────

  describe('calculateMaintenance', () => {
    it('correct total cost', () => {
      const equipment = makeEquipment({ maintenanceCostPerTurn: 8 });
      const catalog = new Map([['f-35a-lightning', equipment]]);
      const inventory = makeInventory([makeInventoryItem({ quantity: 10 })]);

      const report = engine.calculateMaintenance(inventory, catalog, 1.0);

      // 8 × 10 = 80
      expect(report.totalCost).toBe(80);
      expect(report.itemCosts).toHaveLength(1);
      expect(report.itemCosts[0].cost).toBe(80);
    });
  });

  // ── updateReadiness ───────────────────────────────────────────────────

  describe('updateReadiness', () => {
    it('increases when funded', () => {
      const item = makeInventoryItem({ readiness: 70 });
      const updated = engine.updateReadiness(item, true);

      expect(updated.readiness).toBe(73); // 70 + READINESS_RECOVERY_PER_TURN (3)
    });

    it('decreases when not funded', () => {
      const item = makeInventoryItem({ readiness: 70 });
      const updated = engine.updateReadiness(item, false);

      expect(updated.readiness).toBe(65); // 70 - READINESS_DECAY_PER_TURN (5)
    });
  });

  // ── getDeployableCount ────────────────────────────────────────────────

  describe('getDeployableCount', () => {
    it('counts only ready items', () => {
      const inventory = makeInventory([
        makeInventoryItem({ equipmentId: 'f-35a-lightning', quantity: 10, readiness: 80, turnsUntilReady: 0 }),
        makeInventoryItem({ equipmentId: 'f-35a-lightning', quantity: 5, readiness: 30, turnsUntilReady: 0 }),
        makeInventoryItem({ equipmentId: 'f-35a-lightning', quantity: 3, readiness: 90, turnsUntilReady: 2 }),
      ]);

      const count = engine.getDeployableCount(inventory, 'f-35a-lightning');

      // Only first item: readiness ≥ 50 and turnsUntilReady === 0
      expect(count).toBe(10);
    });
  });

  // ── computeForceStrength ──────────────────────────────────────────────

  describe('computeForceStrength', () => {
    it('aggregates correctly', () => {
      const equipment = makeEquipment({ attackPower: 78, defensePower: 60 });
      const catalog = new Map([['f-35a-lightning', equipment]]);
      const inventory = makeInventory([
        makeInventoryItem({ quantity: 10, readiness: 100, turnsUntilReady: 0 }),
      ]);

      const strength = engine.computeForceStrength(inventory, catalog);

      // (78 + 60) / 2 × 10 × (100/100) = 69 × 10 = 690
      expect(strength).toBeCloseTo(690, 2);
    });

    it('excludes items in transit', () => {
      const equipment = makeEquipment();
      const catalog = new Map([['f-35a-lightning', equipment]]);
      const inventory = makeInventory([
        makeInventoryItem({ quantity: 5, readiness: 100, turnsUntilReady: 3 }),
      ]);

      const strength = engine.computeForceStrength(inventory, catalog);
      expect(strength).toBe(0);
    });
  });
});
