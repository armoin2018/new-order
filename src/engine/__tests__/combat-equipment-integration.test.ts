import { describe, it, expect } from 'vitest';
import { CombatEquipmentIntegration } from '@/engine/combat-equipment-integration';
import type { MilitaryEquipment } from '@/data/types/model.types';
import type { EquipmentInventory } from '@/engine/equipment-operations';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCatalog: MilitaryEquipment[] = [
  {
    schemaVersion: '1.0.0',
    equipmentId: 'f-35a',
    name: 'F-35A',
    category: 'air',
    description: 'test',
    purchaseCost: 80,
    maintenanceCostPerTurn: 2,
    attackPower: 90,
    defensePower: 60,
    buildTime: 3,
    tags: [],
  },
  {
    schemaVersion: '1.0.0',
    equipmentId: 'm1a2',
    name: 'M1A2',
    category: 'ground',
    description: 'test',
    purchaseCost: 10,
    maintenanceCostPerTurn: 0.5,
    attackPower: 75,
    defensePower: 85,
    buildTime: 2,
    tags: [],
  },
  {
    schemaVersion: '1.0.0',
    equipmentId: 'burke',
    name: 'Burke',
    category: 'sea',
    description: 'test',
    purchaseCost: 200,
    maintenanceCostPerTurn: 5,
    attackPower: 70,
    defensePower: 80,
    buildTime: 5,
    tags: [],
  },
  {
    schemaVersion: '1.0.0',
    equipmentId: 'reaper-drone',
    name: 'Reaper',
    category: 'drone',
    description: 'test',
    purchaseCost: 15,
    maintenanceCostPerTurn: 0.8,
    attackPower: 50,
    defensePower: 10,
    buildTime: 1,
    tags: [],
  },
  {
    schemaVersion: '1.0.0',
    equipmentId: 'cyber-offense-1',
    name: 'Cyber Toolkit',
    category: 'cyber-offense',
    description: 'test',
    purchaseCost: 5,
    maintenanceCostPerTurn: 0.3,
    attackPower: 60,
    defensePower: 20,
    buildTime: 1,
    tags: [],
  },
];

function makeInventory(
  factionId: string,
  items: { equipmentId: string; quantity: number; readiness: number; deployedTo?: string | null }[],
): EquipmentInventory {
  return {
    factionId: factionId as EquipmentInventory['factionId'],
    items: items.map((i) => ({
      equipmentId: i.equipmentId,
      quantity: i.quantity,
      readiness: i.readiness,
      deployedTo: i.deployedTo ?? null,
      turnsUntilReady: 0,
    })),
    totalMaintenanceCost: 0,
  };
}

const usInventory = makeInventory('us', [
  { equipmentId: 'f-35a', quantity: 100, readiness: 90 },
  { equipmentId: 'm1a2', quantity: 500, readiness: 85 },
  { equipmentId: 'burke', quantity: 30, readiness: 88 },
  { equipmentId: 'reaper-drone', quantity: 50, readiness: 80 },
]);

const smallInventory = makeInventory('dprk', [
  { equipmentId: 'm1a2', quantity: 50, readiness: 55 },
]);

const engine = new CombatEquipmentIntegration();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CombatEquipmentIntegration', () => {
  // ── computeForceContribution ────────────────────────────────────────

  it('returns values in 0-100 range', () => {
    const result = engine.computeForceContribution(usInventory, mockCatalog);
    expect(result.airPower).toBeGreaterThanOrEqual(0);
    expect(result.airPower).toBeLessThanOrEqual(100);
    expect(result.groundPower).toBeGreaterThanOrEqual(0);
    expect(result.groundPower).toBeLessThanOrEqual(100);
    expect(result.navalPower).toBeGreaterThanOrEqual(0);
    expect(result.navalPower).toBeLessThanOrEqual(100);
    expect(result.totalMilitaryPower).toBeGreaterThanOrEqual(0);
    expect(result.totalMilitaryPower).toBeLessThanOrEqual(100);
  });

  it('maps air equipment to airPower', () => {
    const airOnlyInventory = makeInventory('us', [
      { equipmentId: 'f-35a', quantity: 200, readiness: 95 },
    ]);
    const result = engine.computeForceContribution(airOnlyInventory, mockCatalog);
    expect(result.airPower).toBeGreaterThan(0);
    expect(result.groundPower).toBe(0);
    expect(result.navalPower).toBe(0);
  });

  it('maps ground equipment to groundPower', () => {
    const groundOnlyInventory = makeInventory('us', [
      { equipmentId: 'm1a2', quantity: 200, readiness: 90 },
    ]);
    const result = engine.computeForceContribution(groundOnlyInventory, mockCatalog);
    expect(result.groundPower).toBeGreaterThan(0);
    expect(result.airPower).toBe(0);
    expect(result.navalPower).toBe(0);
  });

  it('maps sea equipment to navalPower', () => {
    const seaOnlyInventory = makeInventory('us', [
      { equipmentId: 'burke', quantity: 20, readiness: 88 },
    ]);
    const result = engine.computeForceContribution(seaOnlyInventory, mockCatalog);
    expect(result.navalPower).toBeGreaterThan(0);
    expect(result.airPower).toBe(0);
    expect(result.groundPower).toBe(0);
  });

  // ── computeCombatModifier ───────────────────────────────────────────

  it('produces attack and defense bonuses', () => {
    const attackerInventory = makeInventory('us', [
      { equipmentId: 'f-35a', quantity: 50, readiness: 90, deployedTo: 'theater-1' },
    ]);
    const defenderInventory = makeInventory('china', [
      { equipmentId: 'm1a2', quantity: 200, readiness: 80, deployedTo: null },
    ]);

    const modifier = engine.computeCombatModifier(
      attackerInventory,
      defenderInventory,
      mockCatalog,
    );

    expect(modifier.attackBonus).toBeGreaterThanOrEqual(0);
    expect(modifier.defenseBonus).toBeGreaterThanOrEqual(0);
    expect(typeof modifier.stealthAdvantage).toBe('number');
    expect(typeof modifier.techAdvantage).toBe('number');
    expect(Array.isArray(modifier.specialAbilityBonuses)).toBe(true);
  });

  // ── analyzePortfolio ────────────────────────────────────────────────

  it('identifies strengths and weaknesses', () => {
    const analysis = engine.analyzePortfolio(usInventory, mockCatalog);
    expect(Array.isArray(analysis.weaknesses)).toBe(true);
    expect(Array.isArray(analysis.strengths)).toBe(true);
    // We know some categories are missing from usInventory → weaknesses
    expect(analysis.weaknesses.length).toBeGreaterThan(0);
  });

  it('computes correct total equipment count', () => {
    const analysis = engine.analyzePortfolio(usInventory, mockCatalog);
    // 100 + 500 + 30 + 50 = 680
    expect(analysis.totalEquipmentCount).toBe(680);
  });

  it('computes average readiness in 0-100 range', () => {
    const analysis = engine.analyzePortfolio(usInventory, mockCatalog);
    expect(analysis.averageReadiness).toBeGreaterThanOrEqual(0);
    expect(analysis.averageReadiness).toBeLessThanOrEqual(100);
  });

  // ── compareForces ───────────────────────────────────────────────────

  it('identifies advantage correctly', () => {
    const comparison = engine.compareForces(usInventory, smallInventory, mockCatalog);
    expect(comparison.factionA).toBe('us');
    expect(comparison.factionB).toBe('dprk');
    // US has far more equipment → should hold advantage
    expect(comparison.overallAdvantage).toBe('factionA');
    expect(comparison.advantageMargin).toBeGreaterThan(0);
    expect(typeof comparison.assessment).toBe('string');
  });

  // ── computeForceStructure ───────────────────────────────────────────

  it('returns valid ForceStructure', () => {
    const fs = engine.computeForceStructure(usInventory, mockCatalog);
    expect(fs.factionId).toBe('us');
    expect(fs.activeForces).toBeGreaterThanOrEqual(0);
    expect(fs.activeForces).toBeLessThanOrEqual(100);
    expect(fs.navalPower).toBeGreaterThanOrEqual(0);
    expect(fs.airPower).toBeGreaterThanOrEqual(0);
    expect(fs.nuclearArsenal).toBe(0);
    expect(fs.readiness).toBeGreaterThanOrEqual(0);
    expect(fs.readiness).toBeLessThanOrEqual(100);
    expect(Array.isArray(fs.specialCapabilities)).toBe(true);
    expect(typeof fs.forceProjection).toBe('number');
  });
});
