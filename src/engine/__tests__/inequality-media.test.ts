import { describe, it, expect, beforeEach } from 'vitest';
import { InequalityMediaEngine } from '@/engine/inequality-media';
import type {
  InequalityInput,
  InequalityResult,
  MediaManipulationInput,
  MediaManipulationResult,
  ForeignPropagandaInput,
  ForeignPropagandaResult,
} from '@/engine/inequality-media';
import { GAME_CONFIG } from '@/engine/config';

describe('InequalityMediaEngine', () => {
  let engine: InequalityMediaEngine;
  const cfg = GAME_CONFIG.stability;

  beforeEach(() => {
    engine = new InequalityMediaEngine(cfg);
  });

  // ── computeInequality ──────────────────────────────────────────────

  describe('computeInequality', () => {
    it('applies no growth pressure when GDP growth is below threshold', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 1, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(50);
      expect(result.delta).toBe(0);
    });

    it('applies no growth pressure when GDP growth is exactly at threshold (2)', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 2, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(50);
      expect(result.delta).toBe(0);
    });

    it('applies growth pressure of 3 when GDP growth exceeds threshold', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 3, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(53);
      expect(result.delta).toBe(3);
    });

    it('reduces inequality via social spending', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 0, socialSpending: 4 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(48);
      expect(result.delta).toBe(-2);
    });

    it('combines growth pressure and spending relief', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 3, socialSpending: 4 };
      const result = engine.computeInequality(input);
      // growthPressure=3, spendingRelief=4*-0.5=-2, rawDelta=1
      expect(result.newInequality).toBe(51);
      expect(result.delta).toBe(1);
    });

    it('clamps inequality at max (100)', () => {
      const input: InequalityInput = { currentInequality: 99, gdpGrowthRate: 3, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(100);
      expect(result.delta).toBe(1);
    });

    it('clamps inequality at min (0)', () => {
      const input: InequalityInput = { currentInequality: 1, gdpGrowthRate: 0, socialSpending: 10 };
      const result = engine.computeInequality(input);
      // relief = 10 * -0.5 = -5, raw new = 1 + (-5) = -4, clamped to 0
      expect(result.newInequality).toBe(0);
      expect(result.delta).toBe(-1);
    });

    it('returns no change when all inputs are zero-effect', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 0, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(50);
      expect(result.delta).toBe(0);
    });

    it('sets previousInequality to the input currentInequality', () => {
      const input: InequalityInput = { currentInequality: 42, gdpGrowthRate: 3, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.previousInequality).toBe(42);
    });

    it('returns a non-empty driverDescription string', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 3, socialSpending: 2 };
      const result: InequalityResult = engine.computeInequality(input);
      expect(typeof result.driverDescription).toBe('string');
      expect(result.driverDescription.length).toBeGreaterThan(0);
    });

    it('applies no growth pressure for negative GDP growth', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: -2, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(50);
      expect(result.delta).toBe(0);
    });

    it('allows large spending to overwhelm growth pressure', () => {
      const input: InequalityInput = { currentInequality: 50, gdpGrowthRate: 5, socialSpending: 20 };
      const result = engine.computeInequality(input);
      // growthPressure=3, spendingRelief=20*-0.5=-10, rawDelta=-7
      expect(result.newInequality).toBe(43);
      expect(result.delta).toBe(-7);
    });

    it('keeps inequality at 0 when already at floor with no pressure', () => {
      const input: InequalityInput = { currentInequality: 0, gdpGrowthRate: 0, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(0);
      expect(result.delta).toBe(0);
    });

    it('keeps inequality at 100 when already at ceiling with growth pressure', () => {
      const input: InequalityInput = { currentInequality: 100, gdpGrowthRate: 10, socialSpending: 0 };
      const result = engine.computeInequality(input);
      expect(result.newInequality).toBe(100);
      expect(result.delta).toBe(0);
    });
  });

  // ── attemptMediaManipulation ───────────────────────────────────────

  describe('attemptMediaManipulation', () => {
    it('does not attempt when DI is below cost', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 3, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(false);
      expect(result.success).toBe(false);
      expect(result.diSpent).toBe(0);
      expect(result.foreignPropagandaRisk).toBe(0);
    });

    it('attempts manipulation when DI is exactly at cost (5)', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 5, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(true);
      expect(result.diSpent).toBe(5);
    });

    it('succeeds when roll is below success probability', () => {
      // pressFreedom 50 → probability = 0.55; roll 0.1 < 0.55
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('fails when roll is above success probability', () => {
      // pressFreedom 50 → probability = 0.55; roll 0.9 > 0.55
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 50, roll: 0.9 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
    });

    it('sets foreignPropagandaRisk on success in autocracy (pressFreedom < 40)', () => {
      // pressFreedom 30 → probability = 0.65; roll 0.1 → success
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 30, roll: 0.1 };
      const result: MediaManipulationResult = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(true);
      expect(result.foreignPropagandaRisk).toBe(5);
    });

    it('sets foreignPropagandaRisk to 0 on success in democracy (pressFreedom >= 40)', () => {
      // pressFreedom 40 → probability = 0.6; roll 0.1 → success
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 40, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(true);
      expect(result.foreignPropagandaRisk).toBe(0);
    });

    it('sets foreignPropagandaRisk to 0 on failure regardless of low pressFreedom', () => {
      // pressFreedom 10 → probability = 0.75; roll 0.9 → fail
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 10, roll: 0.9 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(false);
      expect(result.foreignPropagandaRisk).toBe(0);
    });

    it('succeeds with roll at 0 (guaranteed success)', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 100, roll: 0 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('succeeds when roll is just below the probability boundary', () => {
      // pressFreedom 0 → probability = 0.8; roll 0.79 → success
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 0, roll: 0.79 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(true);
    });

    it('fails when roll is just above the probability boundary', () => {
      // pressFreedom 0 → probability = 0.8; roll 0.81 → fail
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 0, roll: 0.81 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(false);
    });

    it('does not attempt when DI is 0', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 0, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.attempted).toBe(false);
      expect(result.diSpent).toBe(0);
    });

    it('spends exactly 5 DI regardless of available DI', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 100, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.diSpent).toBe(5);
    });

    it('includes a non-empty reason string in the result', () => {
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 50, roll: 0.1 };
      const result = engine.attemptMediaManipulation(input);
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('sets foreignPropagandaRisk to 0 on failure in autocracy (pressFreedom 20)', () => {
      // pressFreedom 20 → probability = 0.7; roll 0.9 → fail
      const input: MediaManipulationInput = { currentDiplomaticInfluence: 10, pressFreedom: 20, roll: 0.9 };
      const result = engine.attemptMediaManipulation(input);
      expect(result.success).toBe(false);
      expect(result.foreignPropagandaRisk).toBe(0);
    });
  });

  // ── computeForeignPropaganda ───────────────────────────────────────

  describe('computeForeignPropaganda', () => {
    it('returns 0 unrest increase for 0 covert capability', () => {
      const input: ForeignPropagandaInput = { covertCapability: 0 };
      const result: ForeignPropagandaResult = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBe(0);
    });

    it('computes unrest increase for covert capability 50', () => {
      const input: ForeignPropagandaInput = { covertCapability: 50 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBe(5);
    });

    it('computes unrest increase for covert capability 100', () => {
      const input: ForeignPropagandaInput = { covertCapability: 100 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBe(10);
    });

    it('does not clamp high covert capability (200)', () => {
      const input: ForeignPropagandaInput = { covertCapability: 200 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBe(20);
    });

    it('returns negative unrest increase for negative covert capability', () => {
      const input: ForeignPropagandaInput = { covertCapability: -30 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBeCloseTo(-3);
    });

    it('handles small covert capability with fractional result', () => {
      const input: ForeignPropagandaInput = { covertCapability: 1 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBeCloseTo(0.1);
    });

    it('handles fractional covert capability', () => {
      const input: ForeignPropagandaInput = { covertCapability: 33 };
      const result = engine.computeForeignPropaganda(input);
      expect(result.unrestIncrease).toBeCloseTo(3.3);
    });
  });

  // ── computeSuccessProbability ──────────────────────────────────────

  describe('computeSuccessProbability', () => {
    it('returns 0.8 for pressFreedom 0', () => {
      expect(engine.computeSuccessProbability(0)).toBeCloseTo(0.8);
    });

    it('returns 0.3 for pressFreedom 100', () => {
      expect(engine.computeSuccessProbability(100)).toBeCloseTo(0.3);
    });

    it('returns 0.55 for pressFreedom 50', () => {
      expect(engine.computeSuccessProbability(50)).toBeCloseTo(0.55);
    });

    it('clamps to 1.0 for extreme negative pressFreedom (-100)', () => {
      expect(engine.computeSuccessProbability(-100)).toBe(1.0);
    });

    it('clamps to 0 for extreme high pressFreedom (200)', () => {
      expect(engine.computeSuccessProbability(200)).toBe(0);
    });

    it('returns 0.7 for pressFreedom 20', () => {
      expect(engine.computeSuccessProbability(20)).toBeCloseTo(0.7);
    });

    it('returns 0.4 for pressFreedom 80', () => {
      expect(engine.computeSuccessProbability(80)).toBeCloseTo(0.4);
    });

    it('returns 0.6 for pressFreedom 40 (autocracy boundary)', () => {
      expect(engine.computeSuccessProbability(40)).toBeCloseTo(0.6);
    });
  });
});
