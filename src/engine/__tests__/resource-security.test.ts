import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResourceSecurityEngine,
  ResourceCrisisLevel,
} from '@/engine/resource-security';
import { FactionId } from '@/data/types';

import type {
  ResourceSecurityConfig,
  ResourceDelta,
  ResourceTurnInput,
} from '@/engine/resource-security';
import type {
  TurnNumber,
  StrategicReserves,
  ImportDependency,
  ResourceSecurityIndex,
} from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Default config matching GAME_CONFIG.resources.securityThresholds. */
const DEFAULT_CONFIG: ResourceSecurityConfig = {
  warning: 30,
  warningInflationIncrease: 5,
  warningCivilUnrestIncrease: 3,
  critical: 15,
  criticalCivilUnrestIncrease: 10,
  criticalPopularityPenalty: -10,
  catastrophic: 5,
  catastrophicStabilityDecayPerTurn: -10,
};

/** Create a ResourceSecurityIndex with sensible defaults. */
function makeIndex(
  overrides: Partial<ResourceSecurityIndex> = {},
): ResourceSecurityIndex {
  return {
    factionId: FactionId.US as FactionId,
    turn: 1 as TurnNumber,
    energy: 50,
    food: 50,
    water: 50,
    criticalMinerals: 50,
    strategicReserves: {
      energy: 10,
      food: 10,
      water: 10,
      criticalMinerals: 10,
    },
    activeResourceLeverage: [],
    importDependency: {
      energy: 50,
      food: 50,
      water: 50,
      criticalMinerals: 50,
    },
    ...overrides,
  };
}

/** Create a zero-value ResourceDelta. */
function zeroDelta(): ResourceDelta {
  return { energy: 0, food: 0, water: 0, criticalMinerals: 0 };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('ResourceSecurityEngine', () => {
  let engine: ResourceSecurityEngine;

  beforeEach(() => {
    engine = new ResourceSecurityEngine(DEFAULT_CONFIG);
  });

  // ── assessResource ───────────────────────────────────────

  describe('assessResource', () => {
    it('returns stable at exactly the warning threshold (30)', () => {
      expect(engine.assessResource(30)).toBe(ResourceCrisisLevel.Stable);
    });

    it('returns stable at 100', () => {
      expect(engine.assessResource(100)).toBe(ResourceCrisisLevel.Stable);
    });

    it('returns warning at 29', () => {
      expect(engine.assessResource(29)).toBe(ResourceCrisisLevel.Warning);
    });

    it('returns critical at 14', () => {
      expect(engine.assessResource(14)).toBe(ResourceCrisisLevel.Critical);
    });

    it('returns catastrophic at 4', () => {
      expect(engine.assessResource(4)).toBe(ResourceCrisisLevel.Catastrophic);
    });

    it('returns catastrophic at 0', () => {
      expect(engine.assessResource(0)).toBe(ResourceCrisisLevel.Catastrophic);
    });
  });

  // ── computeCrisisEffects ─────────────────────────────────

  describe('computeCrisisEffects', () => {
    it('produces no effects when all resources are stable (>= 30)', () => {
      const index = makeIndex({
        energy: 50,
        food: 60,
        water: 70,
        criticalMinerals: 80,
      });
      const effects = engine.computeCrisisEffects(index);

      expect(effects.inflationDelta).toBe(0);
      expect(effects.civilUnrestDelta).toBe(0);
      expect(effects.popularityDelta).toBe(0);
      expect(effects.stabilityDelta).toBe(0);
      expect(effects.migrationTriggered).toBe(false);
    });

    it('applies warning effects: +5 inflation, +3 civil unrest per resource', () => {
      const index = makeIndex({
        energy: 25,
        food: 50,
        water: 50,
        criticalMinerals: 50,
      });
      const effects = engine.computeCrisisEffects(index);

      expect(effects.inflationDelta).toBe(5);
      expect(effects.civilUnrestDelta).toBe(3);
      expect(effects.popularityDelta).toBe(0);
      expect(effects.stabilityDelta).toBe(0);
      expect(effects.migrationTriggered).toBe(false);
    });

    it('applies critical effects: adds +10 civil unrest and -10 popularity', () => {
      const index = makeIndex({
        energy: 10,
        food: 50,
        water: 50,
        criticalMinerals: 50,
      });
      const effects = engine.computeCrisisEffects(index);

      // Warning effects + critical effects for 1 resource
      expect(effects.inflationDelta).toBe(5);
      expect(effects.civilUnrestDelta).toBe(3 + 10);
      expect(effects.popularityDelta).toBe(-10);
      expect(effects.stabilityDelta).toBe(0);
      expect(effects.migrationTriggered).toBe(false);
    });

    it('applies catastrophic effects: -10 stability per turn and migration triggered', () => {
      const index = makeIndex({
        energy: 2,
        food: 50,
        water: 50,
        criticalMinerals: 50,
      });
      const effects = engine.computeCrisisEffects(index);

      // Warning + critical + catastrophic for 1 resource
      expect(effects.inflationDelta).toBe(5);
      expect(effects.civilUnrestDelta).toBe(3 + 10);
      expect(effects.popularityDelta).toBe(-10);
      expect(effects.stabilityDelta).toBe(-10);
      expect(effects.migrationTriggered).toBe(true);
    });

    it('stacks effects across multiple resources in crisis', () => {
      const index = makeIndex({
        energy: 25,
        food: 25,
        water: 50,
        criticalMinerals: 50,
      });
      const effects = engine.computeCrisisEffects(index);

      // Two resources at warning
      expect(effects.inflationDelta).toBe(10);
      expect(effects.civilUnrestDelta).toBe(6);
    });

    it('aggregates mixed crisis levels correctly', () => {
      const index = makeIndex({
        energy: 2,  // catastrophic
        food: 10,   // critical
        water: 25,  // warning
        criticalMinerals: 50, // stable
      });
      const effects = engine.computeCrisisEffects(index);

      // 3 non-stable resources contribute warning inflation
      expect(effects.inflationDelta).toBe(5 + 5 + 5);

      // Warning unrest: 3 * 3 = 9
      // Critical unrest: catastrophic(10) + critical(10) = 20
      expect(effects.civilUnrestDelta).toBe(9 + 20);

      // Critical popularity: catastrophic(-10) + critical(-10) = -20
      expect(effects.popularityDelta).toBe(-20);

      // Catastrophic stability: -10
      expect(effects.stabilityDelta).toBe(-10);

      expect(effects.migrationTriggered).toBe(true);
    });

    it('lists all non-stable resources in affectedResources', () => {
      const index = makeIndex({
        energy: 25,
        food: 10,
        water: 50,
        criticalMinerals: 2,
      });
      const effects = engine.computeCrisisEffects(index);

      const nonStable = effects.affectedResources.filter(
        (r) => r.crisisLevel !== ResourceCrisisLevel.Stable,
      );
      expect(nonStable).toHaveLength(3);

      const resourceNames = nonStable.map((r) => r.resource);
      expect(resourceNames).toContain('energy');
      expect(resourceNames).toContain('food');
      expect(resourceNames).toContain('criticalMinerals');
    });
  });

  // ── applyResourceDelta ───────────────────────────────────

  describe('applyResourceDelta', () => {
    it('applies positive deltas', () => {
      const prev = makeIndex({ energy: 40, food: 40, water: 40, criticalMinerals: 40 });
      const delta: ResourceDelta = { energy: 10, food: 5, water: 15, criticalMinerals: 20 };
      const result = engine.applyResourceDelta(prev, delta, 2 as TurnNumber);

      expect(result.energy).toBe(50);
      expect(result.food).toBe(45);
      expect(result.water).toBe(55);
      expect(result.criticalMinerals).toBe(60);
    });

    it('applies negative deltas', () => {
      const prev = makeIndex({ energy: 40, food: 30, water: 50, criticalMinerals: 60 });
      const delta: ResourceDelta = { energy: -10, food: -5, water: -15, criticalMinerals: -20 };
      const result = engine.applyResourceDelta(prev, delta, 2 as TurnNumber);

      expect(result.energy).toBe(30);
      expect(result.food).toBe(25);
      expect(result.water).toBe(35);
      expect(result.criticalMinerals).toBe(40);
    });

    it('clamps to 0 (floor)', () => {
      const prev = makeIndex({ energy: 5 });
      const delta: ResourceDelta = { energy: -20, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.applyResourceDelta(prev, delta, 2 as TurnNumber);

      expect(result.energy).toBe(0);
    });

    it('clamps to 100 (ceiling)', () => {
      const prev = makeIndex({ energy: 95 });
      const delta: ResourceDelta = { energy: 20, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.applyResourceDelta(prev, delta, 2 as TurnNumber);

      expect(result.energy).toBe(100);
    });

    it('preserves factionId, reserves, leverage, and importDependency', () => {
      const reserves: StrategicReserves = { energy: 99, food: 88, water: 77, criticalMinerals: 66 };
      const importDep: ImportDependency = { energy: 10, food: 20, water: 30, criticalMinerals: 40 };
      const prev = makeIndex({
        factionId: FactionId.China as FactionId,
        strategicReserves: reserves,
        importDependency: importDep,
        activeResourceLeverage: [],
      });
      const delta = zeroDelta();
      const result = engine.applyResourceDelta(prev, delta, 3 as TurnNumber);

      expect(result.factionId).toBe(FactionId.China);
      expect(result.strategicReserves.energy).toBe(99);
      expect(result.strategicReserves.food).toBe(88);
      expect(result.importDependency.energy).toBe(10);
      expect(result.importDependency.criticalMinerals).toBe(40);
      expect(result.activeResourceLeverage).toEqual([]);
    });

    it('updates the turn number', () => {
      const prev = makeIndex({ turn: 5 as TurnNumber });
      const result = engine.applyResourceDelta(prev, zeroDelta(), 6 as TurnNumber);

      expect(result.turn).toBe(6);
    });
  });

  // ── computeProductionModifier ────────────────────────────

  describe('computeProductionModifier', () => {
    it('returns zero deltas when there is no disruption', () => {
      const dep: ImportDependency = { energy: 80, food: 60, water: 40, criticalMinerals: 20 };
      const result = engine.computeProductionModifier(dep, 0);

      expect(result.energy).toBeCloseTo(0);
      expect(result.food).toBeCloseTo(0);
      expect(result.water).toBeCloseTo(0);
      expect(result.criticalMinerals).toBeCloseTo(0);
    });

    it('returns maximum negative delta at 100% disruption × 100% dependency', () => {
      const dep: ImportDependency = { energy: 100, food: 100, water: 100, criticalMinerals: 100 };
      const result = engine.computeProductionModifier(dep, 100);

      expect(result.energy).toBe(-100);
      expect(result.food).toBe(-100);
      expect(result.water).toBe(-100);
      expect(result.criticalMinerals).toBe(-100);
    });

    it('scales proportionally with partial disruption', () => {
      const dep: ImportDependency = { energy: 80, food: 20, water: 50, criticalMinerals: 60 };
      const result = engine.computeProductionModifier(dep, 50);

      // -(dep/100) * (50/100) * 100
      expect(result.energy).toBe(-40);
      expect(result.food).toBe(-10);
      expect(result.water).toBe(-25);
      expect(result.criticalMinerals).toBe(-30);
    });

    it('returns zero impact when dependency is zero regardless of disruption', () => {
      const dep: ImportDependency = { energy: 0, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.computeProductionModifier(dep, 100);

      expect(result.energy).toBeCloseTo(0);
      expect(result.food).toBeCloseTo(0);
      expect(result.water).toBeCloseTo(0);
      expect(result.criticalMinerals).toBeCloseTo(0);
    });

    it('computes each resource independently', () => {
      const dep: ImportDependency = { energy: 100, food: 0, water: 50, criticalMinerals: 25 };
      const result = engine.computeProductionModifier(dep, 50);

      expect(result.energy).toBe(-50);
      expect(result.food).toBeCloseTo(0);
      expect(result.water).toBe(-25);
      expect(result.criticalMinerals).toBe(-12.5);
    });
  });

  // ── applyReserveBuffer ───────────────────────────────────

  describe('applyReserveBuffer', () => {
    it('absorbs deficit when reserves are available', () => {
      const index = makeIndex({
        strategicReserves: { energy: 20, food: 10, water: 10, criticalMinerals: 10 },
      });
      const deficit: ResourceDelta = { energy: -15, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.applyReserveBuffer(index, deficit);

      expect(result.remainingDeficit.energy).toBeCloseTo(0);
      expect(result.updatedReserves.energy).toBe(5);
      expect(result.reservesUsed.energy).toBe(15);
    });

    it('partially absorbs when reserves are insufficient', () => {
      const index = makeIndex({
        strategicReserves: { energy: 5, food: 10, water: 10, criticalMinerals: 10 },
      });
      const deficit: ResourceDelta = { energy: -15, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.applyReserveBuffer(index, deficit);

      expect(result.remainingDeficit.energy).toBe(-10);
      expect(result.updatedReserves.energy).toBe(0);
      expect(result.reservesUsed.energy).toBe(5);
    });

    it('has no effect when deficit is positive (surplus)', () => {
      const index = makeIndex({
        strategicReserves: { energy: 10, food: 10, water: 10, criticalMinerals: 10 },
      });
      const deficit: ResourceDelta = { energy: 5, food: 10, water: 3, criticalMinerals: 0 };
      const result = engine.applyReserveBuffer(index, deficit);

      expect(result.remainingDeficit.energy).toBe(5);
      expect(result.remainingDeficit.food).toBe(10);
      expect(result.updatedReserves.energy).toBe(10);
      expect(result.reservesUsed.energy).toBe(0);
    });

    it('does not let reserves go below 0', () => {
      const index = makeIndex({
        strategicReserves: { energy: 3, food: 10, water: 10, criticalMinerals: 10 },
      });
      const deficit: ResourceDelta = { energy: -100, food: 0, water: 0, criticalMinerals: 0 };
      const result = engine.applyReserveBuffer(index, deficit);

      expect(result.updatedReserves.energy).toBe(0);
    });

    it('returns correct reservesUsed', () => {
      const index = makeIndex({
        strategicReserves: { energy: 8, food: 5, water: 20, criticalMinerals: 0 },
      });
      const deficit: ResourceDelta = {
        energy: -10,
        food: -3,
        water: -5,
        criticalMinerals: -7,
      };
      const result = engine.applyReserveBuffer(index, deficit);

      expect(result.reservesUsed.energy).toBe(8);
      expect(result.reservesUsed.food).toBe(3);
      expect(result.reservesUsed.water).toBe(5);
      expect(result.reservesUsed.criticalMinerals).toBe(0);
    });
  });

  // ── computeTurnResourceSecurity (integration) ────────────

  describe('computeTurnResourceSecurity', () => {
    it('processes all inputs and returns a complete result', () => {
      const prev = makeIndex();
      const input: ResourceTurnInput = {
        productionDelta: { energy: 5, food: 3, water: 2, criticalMinerals: 1 },
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 0,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      expect(result.index).toBeDefined();
      expect(result.crisisEffects).toBeDefined();
      expect(result.bufferResult).toBeDefined();
      expect(result.index.turn).toBe(2);
    });

    it('reduces resources proportional to import dependency when trade is disrupted', () => {
      const prev = makeIndex({
        energy: 80,
        food: 80,
        water: 80,
        criticalMinerals: 80,
        importDependency: { energy: 100, food: 50, water: 0, criticalMinerals: 25 },
        strategicReserves: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
      });
      const input: ResourceTurnInput = {
        productionDelta: zeroDelta(),
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 50,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      // disruption modifier: -(dep/100) * (50/100) * 100
      // energy: -50, food: -25, water: 0, minerals: -12.5
      expect(result.index.energy).toBe(30);
      expect(result.index.food).toBe(55);
      expect(result.index.water).toBe(80);
      expect(result.index.criticalMinerals).toBeCloseTo(67.5);
    });

    it('uses reserves to buffer negative changes', () => {
      const prev = makeIndex({
        energy: 20,
        strategicReserves: { energy: 15, food: 10, water: 10, criticalMinerals: 10 },
        importDependency: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
      });
      const input: ResourceTurnInput = {
        productionDelta: { energy: -10, food: 0, water: 0, criticalMinerals: 0 },
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 0,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      // -10 deficit buffered by 10 from reserves => remaining deficit = 0
      expect(result.bufferResult.reservesUsed.energy).toBe(10);
      expect(result.index.energy).toBe(20); // deficit fully absorbed
    });

    it('computes crisis effects from the final state', () => {
      const prev = makeIndex({
        energy: 10,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        strategicReserves: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
        importDependency: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
      });
      const input: ResourceTurnInput = {
        productionDelta: { energy: -8, food: 0, water: 0, criticalMinerals: 0 },
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 0,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      // Energy at 2 => catastrophic
      expect(result.index.energy).toBe(2);
      expect(result.crisisEffects.migrationTriggered).toBe(true);
      expect(result.crisisEffects.stabilityDelta).toBe(-10);
    });

    it('handles all-positive inputs with no crisis', () => {
      const prev = makeIndex({
        energy: 50,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        importDependency: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
      });
      const input: ResourceTurnInput = {
        productionDelta: { energy: 10, food: 10, water: 10, criticalMinerals: 10 },
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 0,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      expect(result.crisisEffects.inflationDelta).toBe(0);
      expect(result.crisisEffects.migrationTriggered).toBe(false);
      expect(result.index.energy).toBe(60);
    });

    it('handles severe multi-resource crisis', () => {
      const prev = makeIndex({
        energy: 5,
        food: 5,
        water: 5,
        criticalMinerals: 5,
        strategicReserves: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
        importDependency: { energy: 0, food: 0, water: 0, criticalMinerals: 0 },
      });
      const input: ResourceTurnInput = {
        productionDelta: { energy: -3, food: -3, water: -3, criticalMinerals: -3 },
        tradeDelta: zeroDelta(),
        climateDelta: zeroDelta(),
        tradeDisruption: 0,
      };
      const result = engine.computeTurnResourceSecurity(prev, input, 2 as TurnNumber);

      // All at 2 => all catastrophic
      expect(result.index.energy).toBe(2);
      expect(result.index.food).toBe(2);
      expect(result.index.water).toBe(2);
      expect(result.index.criticalMinerals).toBe(2);
      expect(result.crisisEffects.migrationTriggered).toBe(true);

      // 4 resources catastrophic: stability = 4 * -10 = -40
      expect(result.crisisEffects.stabilityDelta).toBe(-40);
    });
  });

  // ── getResourceSummary ───────────────────────────────────

  describe('getResourceSummary', () => {
    it('returns stable overall when all resources are healthy', () => {
      const index = makeIndex({
        energy: 60,
        food: 70,
        water: 80,
        criticalMinerals: 90,
      });
      const summary = engine.getResourceSummary(index);

      expect(summary.overall).toBe(ResourceCrisisLevel.Stable);
      expect(summary.anyMigrationRisk).toBe(false);
    });

    it('returns the worst crisis level as overall', () => {
      const index = makeIndex({
        energy: 50,
        food: 10, // critical
        water: 50,
        criticalMinerals: 50,
      });
      const summary = engine.getResourceSummary(index);

      expect(summary.overall).toBe(ResourceCrisisLevel.Critical);
    });

    it('sets anyMigrationRisk to true when any resource is catastrophic', () => {
      const index = makeIndex({
        energy: 3,
        food: 50,
        water: 50,
        criticalMinerals: 50,
      });
      const summary = engine.getResourceSummary(index);

      expect(summary.anyMigrationRisk).toBe(true);
      expect(summary.overall).toBe(ResourceCrisisLevel.Catastrophic);
    });

    it('lists all 4 resources in detail', () => {
      const index = makeIndex();
      const summary = engine.getResourceSummary(index);

      expect(summary.resources).toHaveLength(4);
      const names = summary.resources.map((r) => r.resource);
      expect(names).toContain('energy');
      expect(names).toContain('food');
      expect(names).toContain('water');
      expect(names).toContain('criticalMinerals');
    });
  });

  // ── config override ──────────────────────────────────────

  describe('config override', () => {
    it('respects a custom warning threshold', () => {
      const custom = new ResourceSecurityEngine({
        ...DEFAULT_CONFIG,
        warning: 50,
      });

      // 49 is below custom warning (50) → warning
      expect(custom.assessResource(49)).toBe(ResourceCrisisLevel.Warning);
      // 50 is at threshold → stable
      expect(custom.assessResource(50)).toBe(ResourceCrisisLevel.Stable);
    });

    it('respects a custom catastrophic threshold', () => {
      const custom = new ResourceSecurityEngine({
        ...DEFAULT_CONFIG,
        catastrophic: 10,
      });

      // 9 is below custom catastrophic (10) → catastrophic
      expect(custom.assessResource(9)).toBe(ResourceCrisisLevel.Catastrophic);
      // 10 is at threshold → critical (since 10 < 15)
      expect(custom.assessResource(10)).toBe(ResourceCrisisLevel.Critical);
    });
  });
});
