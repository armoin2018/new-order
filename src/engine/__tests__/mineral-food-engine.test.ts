/**
 * Tests for the MineralFoodEngine class.
 *
 * Covers:
 * - FR-1901 — Resource Security Index
 * - FR-1902 — Critical Mineral Competition (leverage + alternatives)
 * - FR-1906 — Food as Weapon
 * - FR-1907 — Strategic Reserves (stockpiling + depletion)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MineralFoodEngine } from '@/engine/mineral-food-engine';
import type {
  ResourceSecurityInput,
  MineralLeverageInput,
  MineralAlternativeInput,
  FoodWeaponInput,
  StockpilingInput,
  ReserveDepletionInput,
} from '@/engine/mineral-food-engine';
import { GAME_CONFIG } from '@/engine/config';
import { MineralAlternative } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const RUSSIA = 'russia' as FactionId;
const EU = 'eu' as FactionId;
const TURN = 5 as TurnNumber;

describe('MineralFoodEngine', () => {
  let engine: MineralFoodEngine;

  beforeEach(() => {
    engine = new MineralFoodEngine(GAME_CONFIG.resources);
  });

  // ─────────────────────────────────────────────────────
  // FR-1901 — evaluateResourceSecurity
  // ─────────────────────────────────────────────────────

  describe('evaluateResourceSecurity', () => {
    it('returns zero effects when all resources are above 30', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 50,
        food: 60,
        water: 80,
        criticalMinerals: 45,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.inflationIncrease).toBe(0);
      expect(result.civilUnrestIncrease).toBe(0);
      expect(result.popularityPenalty).toBe(0);
      expect(result.stabilityDecayPerTurn).toBe(0);
      expect(result.massMigrationTriggered).toBe(false);
      expect(result.reason).toContain('All resources above warning thresholds');
    });

    it('triggers warning effects when one resource is below 30', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 29,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.inflationIncrease).toBe(5);
      expect(result.civilUnrestIncrease).toBe(3);
      expect(result.popularityPenalty).toBe(0);
      expect(result.stabilityDecayPerTurn).toBe(0);
      expect(result.massMigrationTriggered).toBe(false);
      expect(result.reason).toContain('1 resource(s) below warning threshold');
    });

    it('stacks warning effects when two resources are below 30', () => {
      const input: ResourceSecurityInput = {
        factionId: CHINA,
        energy: 29,
        food: 25,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.inflationIncrease).toBe(10);
      expect(result.civilUnrestIncrease).toBe(6);
      expect(result.popularityPenalty).toBe(0);
      expect(result.reason).toContain('2 resource(s) below warning threshold');
    });

    it('triggers critical effects on top of warning when a resource is below 15', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 14,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      // Warning: +5 inflation, +3 unrest. Critical: +10 unrest, -10 popularity.
      expect(result.inflationIncrease).toBe(5);
      expect(result.civilUnrestIncrease).toBe(13);
      expect(result.popularityPenalty).toBe(-10);
      expect(result.stabilityDecayPerTurn).toBe(0);
      expect(result.massMigrationTriggered).toBe(false);
      expect(result.reason).toContain('below critical threshold');
    });

    it('triggers all three bands when a resource is below 5', () => {
      const input: ResourceSecurityInput = {
        factionId: EU,
        energy: 4,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      // Warning: +5 inflation, +3 unrest. Critical: +10 unrest, -10 popularity. Catastrophic: -10 stability, migration.
      expect(result.inflationIncrease).toBe(5);
      expect(result.civilUnrestIncrease).toBe(13);
      expect(result.popularityPenalty).toBe(-10);
      expect(result.stabilityDecayPerTurn).toBe(-10);
      expect(result.massMigrationTriggered).toBe(true);
      expect(result.reason).toContain('below catastrophic threshold');
    });

    it('stacks stability decay when multiple resources are below catastrophic', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 3,
        food: 2,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.stabilityDecayPerTurn).toBe(-20);
      expect(result.massMigrationTriggered).toBe(true);
      expect(result.reason).toContain('2 resource(s) below catastrophic threshold');
    });

    it('reports the correct lowest resource name and level', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 40,
        food: 12,
        water: 55,
        criticalMinerals: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.lowestResource.name).toBe('food');
      expect(result.lowestResource.level).toBe(12);
    });

    it('produces no effects when all resources are exactly 30', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 30,
        food: 30,
        water: 30,
        criticalMinerals: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      expect(result.inflationIncrease).toBe(0);
      expect(result.civilUnrestIncrease).toBe(0);
      expect(result.popularityPenalty).toBe(0);
      expect(result.stabilityDecayPerTurn).toBe(0);
      expect(result.massMigrationTriggered).toBe(false);
    });

    it('triggers only warning effects when a resource is exactly 15', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 15,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      // 15 < 30 → warning; 15 is NOT < 15 → no critical
      expect(result.inflationIncrease).toBe(5);
      expect(result.civilUnrestIncrease).toBe(3);
      expect(result.popularityPenalty).toBe(0);
      expect(result.stabilityDecayPerTurn).toBe(0);
    });

    it('triggers warning + critical but not catastrophic when a resource is exactly 5', () => {
      const input: ResourceSecurityInput = {
        factionId: US,
        energy: 5,
        food: 50,
        water: 50,
        criticalMinerals: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateResourceSecurity(input);

      // 5 < 30 → warning; 5 < 15 → critical; 5 is NOT < 5 → no catastrophic
      expect(result.inflationIncrease).toBe(5);
      expect(result.civilUnrestIncrease).toBe(13);
      expect(result.popularityPenalty).toBe(-10);
      expect(result.stabilityDecayPerTurn).toBe(0);
      expect(result.massMigrationTriggered).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // FR-1902 — evaluateMineralLeverage
  // ─────────────────────────────────────────────────────

  describe('evaluateMineralLeverage', () => {
    it('is eligible with full effects when share exceeds threshold', () => {
      const input: MineralLeverageInput = {
        controllerFaction: CHINA,
        targetFaction: US,
        controllerMineralShare: 0.55,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralLeverage(input);

      expect(result.eligible).toBe(true);
      expect(result.targetSemiconductorCostIncrease).toBeCloseTo(0.3);
      expect(result.targetGDPReduction).toBeCloseTo(-0.03);
      expect(result.reason).toContain('55%');
    });

    it('is eligible when share is exactly at the threshold (0.4)', () => {
      const input: MineralLeverageInput = {
        controllerFaction: CHINA,
        targetFaction: EU,
        controllerMineralShare: 0.4,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralLeverage(input);

      expect(result.eligible).toBe(true);
      expect(result.targetSemiconductorCostIncrease).toBeCloseTo(0.3);
      expect(result.targetGDPReduction).toBeCloseTo(-0.03);
    });

    it('is not eligible when share is just below the threshold', () => {
      const input: MineralLeverageInput = {
        controllerFaction: CHINA,
        targetFaction: US,
        controllerMineralShare: 0.39,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralLeverage(input);

      expect(result.eligible).toBe(false);
      expect(result.targetSemiconductorCostIncrease).toBe(0);
      expect(result.targetGDPReduction).toBe(0);
      expect(result.reason).toContain('No leverage');
    });

    it('is not eligible when share is zero', () => {
      const input: MineralLeverageInput = {
        controllerFaction: EU,
        targetFaction: US,
        controllerMineralShare: 0.0,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralLeverage(input);

      expect(result.eligible).toBe(false);
      expect(result.targetSemiconductorCostIncrease).toBe(0);
      expect(result.targetGDPReduction).toBe(0);
    });

    it('is eligible when share is 1.0 (full control)', () => {
      const input: MineralLeverageInput = {
        controllerFaction: CHINA,
        targetFaction: US,
        controllerMineralShare: 1.0,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralLeverage(input);

      expect(result.eligible).toBe(true);
      expect(result.targetSemiconductorCostIncrease).toBeCloseTo(0.3);
      expect(result.targetGDPReduction).toBeCloseTo(-0.03);
    });
  });

  // ─────────────────────────────────────────────────────
  // FR-1902 — evaluateMineralAlternative
  // ─────────────────────────────────────────────────────

  describe('evaluateMineralAlternative', () => {
    it('DomesticMining is always eligible with 3× cost multiplier', () => {
      const input: MineralAlternativeInput = {
        factionId: US,
        method: MineralAlternative.DomesticMining,
        factionSpaceLevel: 10,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralAlternative(input);

      expect(result.eligible).toBe(true);
      expect(result.costMultiplier).toBeCloseTo(3.0);
      expect(result.timeTurns).toBe(0);
      expect(result.dependencyReduction).toBe(0);
      expect(result.reason).toContain('DomesticMining');
    });

    it('DeepSeaMining is eligible when spaceLevel exceeds requirement', () => {
      const input: MineralAlternativeInput = {
        factionId: US,
        method: MineralAlternative.DeepSeaMining,
        factionSpaceLevel: 55,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralAlternative(input);

      expect(result.eligible).toBe(true);
      expect(result.costMultiplier).toBeCloseTo(1.0);
      expect(result.timeTurns).toBe(5);
      expect(result.dependencyReduction).toBe(0);
      expect(result.reason).toContain('DeepSeaMining');
    });

    it('DeepSeaMining is eligible when spaceLevel is exactly 40', () => {
      const input: MineralAlternativeInput = {
        factionId: CHINA,
        method: MineralAlternative.DeepSeaMining,
        factionSpaceLevel: 40,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralAlternative(input);

      expect(result.eligible).toBe(true);
      expect(result.costMultiplier).toBeCloseTo(1.0);
      expect(result.timeTurns).toBe(5);
    });

    it('DeepSeaMining is not eligible when spaceLevel is below 40', () => {
      const input: MineralAlternativeInput = {
        factionId: EU,
        method: MineralAlternative.DeepSeaMining,
        factionSpaceLevel: 39,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralAlternative(input);

      expect(result.eligible).toBe(false);
      expect(result.costMultiplier).toBe(0);
      expect(result.timeTurns).toBe(0);
      expect(result.reason).toContain('ineligible');
    });

    it('Recycling is always eligible with 0.2 dependency reduction', () => {
      const input: MineralAlternativeInput = {
        factionId: US,
        method: MineralAlternative.Recycling,
        factionSpaceLevel: 10,
        currentTurn: TURN,
      };
      const result = engine.evaluateMineralAlternative(input);

      expect(result.eligible).toBe(true);
      expect(result.costMultiplier).toBeCloseTo(1.0);
      expect(result.timeTurns).toBe(0);
      expect(result.dependencyReduction).toBeCloseTo(0.2);
      expect(result.reason).toContain('Recycling');
    });
  });

  // ─────────────────────────────────────────────────────
  // FR-1906 — evaluateFoodWeapon
  // ─────────────────────────────────────────────────────

  describe('evaluateFoodWeapon', () => {
    it('is eligible with full effects when grain share exceeds threshold', () => {
      const input: FoodWeaponInput = {
        wielderFaction: RUSSIA,
        targetFaction: EU,
        wielderGrainShare: 0.35,
        currentTurn: TURN,
      };
      const result = engine.evaluateFoodWeapon(input);

      expect(result.eligible).toBe(true);
      expect(result.targetFoodReduction).toBe(-20);
      expect(result.targetCivilUnrestIncrease).toBe(10);
      expect(result.targetStabilityDecay).toBe(-5);
      expect(result.wielderLegitimacyCost).toBe(-15);
      expect(result.reason).toContain('35%');
    });

    it('is eligible when grain share is exactly at the threshold (0.3)', () => {
      const input: FoodWeaponInput = {
        wielderFaction: RUSSIA,
        targetFaction: EU,
        wielderGrainShare: 0.3,
        currentTurn: TURN,
      };
      const result = engine.evaluateFoodWeapon(input);

      expect(result.eligible).toBe(true);
      expect(result.targetFoodReduction).toBe(-20);
      expect(result.targetCivilUnrestIncrease).toBe(10);
      expect(result.targetStabilityDecay).toBe(-5);
      expect(result.wielderLegitimacyCost).toBe(-15);
    });

    it('is not eligible when grain share is below the threshold', () => {
      const input: FoodWeaponInput = {
        wielderFaction: RUSSIA,
        targetFaction: EU,
        wielderGrainShare: 0.29,
        currentTurn: TURN,
      };
      const result = engine.evaluateFoodWeapon(input);

      expect(result.eligible).toBe(false);
      expect(result.targetFoodReduction).toBe(0);
      expect(result.targetCivilUnrestIncrease).toBe(0);
      expect(result.targetStabilityDecay).toBe(0);
      expect(result.wielderLegitimacyCost).toBe(0);
      expect(result.reason).toContain('Not eligible');
    });

    it('is not eligible when grain share is zero', () => {
      const input: FoodWeaponInput = {
        wielderFaction: EU,
        targetFaction: US,
        wielderGrainShare: 0.0,
        currentTurn: TURN,
      };
      const result = engine.evaluateFoodWeapon(input);

      expect(result.eligible).toBe(false);
      expect(result.targetFoodReduction).toBe(0);
      expect(result.targetCivilUnrestIncrease).toBe(0);
      expect(result.targetStabilityDecay).toBe(0);
      expect(result.wielderLegitimacyCost).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // FR-1907 — computeStockpilingCost
  // ─────────────────────────────────────────────────────

  describe('computeStockpilingCost', () => {
    it('calculates cost for 25 units as 3 batches × -5 = -15', () => {
      const input: StockpilingInput = {
        factionId: US,
        unitsToStockpile: 25,
        currentTurn: TURN,
      };
      const result = engine.computeStockpilingCost(input);

      expect(result.treasuryCost).toBe(-15);
      expect(result.unitsBought).toBe(25);
      expect(result.reason).toContain('3 batch(es)');
    });

    it('calculates cost for exactly 10 units as 1 batch × -5 = -5', () => {
      const input: StockpilingInput = {
        factionId: CHINA,
        unitsToStockpile: 10,
        currentTurn: TURN,
      };
      const result = engine.computeStockpilingCost(input);

      expect(result.treasuryCost).toBe(-5);
      expect(result.unitsBought).toBe(10);
      expect(result.reason).toContain('1 batch(es)');
    });

    it('rounds up to 1 batch for a single unit', () => {
      const input: StockpilingInput = {
        factionId: EU,
        unitsToStockpile: 1,
        currentTurn: TURN,
      };
      const result = engine.computeStockpilingCost(input);

      expect(result.treasuryCost).toBe(-5);
      expect(result.unitsBought).toBe(1);
    });

    it('returns zero cost and zero units for 0 units', () => {
      const input: StockpilingInput = {
        factionId: US,
        unitsToStockpile: 0,
        currentTurn: TURN,
      };
      const result = engine.computeStockpilingCost(input);

      expect(result.treasuryCost).toBe(-0);
      expect(result.unitsBought).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // FR-1907 — computeReserveDepletion
  // ─────────────────────────────────────────────────────

  describe('computeReserveDepletion', () => {
    it('depletes reserves by deficit rate and estimates turns remaining', () => {
      const input: ReserveDepletionInput = {
        factionId: EU,
        currentReserves: 30,
        deficitRate: 7,
        currentTurn: TURN,
      };
      const result = engine.computeReserveDepletion(input);

      expect(result.remainingReserves).toBe(23);
      expect(result.turnsUntilDepleted).toBe(4);
      expect(result.depleted).toBe(false);
      expect(result.reason).toContain('23 remaining');
    });

    it('marks as depleted when reserves equal deficit rate', () => {
      const input: ReserveDepletionInput = {
        factionId: US,
        currentReserves: 5,
        deficitRate: 5,
        currentTurn: TURN,
      };
      const result = engine.computeReserveDepletion(input);

      expect(result.remainingReserves).toBe(0);
      expect(result.turnsUntilDepleted).toBe(0);
      expect(result.depleted).toBe(true);
      expect(result.reason).toContain('DEPLETED');
    });

    it('clamps remaining to zero when deficit exceeds reserves', () => {
      const input: ReserveDepletionInput = {
        factionId: CHINA,
        currentReserves: 5,
        deficitRate: 10,
        currentTurn: TURN,
      };
      const result = engine.computeReserveDepletion(input);

      expect(result.remainingReserves).toBe(0);
      expect(result.depleted).toBe(true);
      expect(result.reason).toContain('DEPLETED');
    });

    it('returns Infinity turns when deficit rate is zero', () => {
      const input: ReserveDepletionInput = {
        factionId: RUSSIA,
        currentReserves: 50,
        deficitRate: 0,
        currentTurn: TURN,
      };
      const result = engine.computeReserveDepletion(input);

      expect(result.remainingReserves).toBe(50);
      expect(result.turnsUntilDepleted).toBe(Infinity);
      expect(result.depleted).toBe(false);
    });
  });
});
