import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionFatigueEngine } from '@/engine/decision-fatigue';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId, TurnNumber } from '@/data/types';

describe('DecisionFatigueEngine', () => {
  let engine: DecisionFatigueEngine;
  const cfg = GAME_CONFIG.psychology;

  beforeEach(() => {
    engine = new DecisionFatigueEngine(cfg);
  });

  // ───────────────────────────────────────────────
  // 1. computeStressMultiplier
  // ───────────────────────────────────────────────
  describe('computeStressMultiplier', () => {
    it('returns 1.0 for stress 0', () => {
      expect(engine.computeStressMultiplier(0)).toBe(1.0);
    });

    it('returns 1.0 for stress 25', () => {
      expect(engine.computeStressMultiplier(25)).toBe(1.0);
    });

    it('returns 1.0 for stress 50', () => {
      expect(engine.computeStressMultiplier(50)).toBe(1.0);
    });

    it('returns 1.02 for stress 51', () => {
      expect(engine.computeStressMultiplier(51)).toBeCloseTo(1.02, 5);
    });

    it('returns 1.5 for stress 75', () => {
      expect(engine.computeStressMultiplier(75)).toBe(1.5);
    });

    it('returns 2.0 for stress 100', () => {
      expect(engine.computeStressMultiplier(100)).toBe(2.0);
    });

    it('returns 1.0 for negative stress (max floors it)', () => {
      expect(engine.computeStressMultiplier(-10)).toBe(1.0);
    });
  });

  // ───────────────────────────────────────────────
  // 2. accumulateFatigue
  // ───────────────────────────────────────────────
  describe('accumulateFatigue', () => {
    it('gains 0 fatigue with 0 actions and stress 50', () => {
      const result = engine.accumulateFatigue(30, 0, 50);
      expect(result.fatigueGain).toBe(0);
      expect(result.newFatigue).toBe(30);
    });

    it('gains 3 fatigue with 3 actions and stress 0 (mult 1.0)', () => {
      const result = engine.accumulateFatigue(0, 3, 0);
      expect(result.fatigueGain).toBe(3);
      expect(result.newFatigue).toBe(3);
    });

    it('gains 3 fatigue with 3 actions and stress 50 (mult 1.0)', () => {
      const result = engine.accumulateFatigue(10, 3, 50);
      expect(result.fatigueGain).toBe(3);
      expect(result.newFatigue).toBe(13);
    });

    it('gains 6 fatigue with 3 actions and stress 100 (mult 2.0)', () => {
      const result = engine.accumulateFatigue(10, 3, 100);
      expect(result.fatigueGain).toBe(6);
      expect(result.newFatigue).toBe(16);
    });

    it('clamps newFatigue at 100', () => {
      const result = engine.accumulateFatigue(95, 3, 100);
      expect(result.newFatigue).toBe(100);
    });

    it('preserves previousFatigue matching input', () => {
      const result = engine.accumulateFatigue(42, 2, 50);
      expect(result.previousFatigue).toBe(42);
    });

    it('includes stressMultiplier in result', () => {
      const result = engine.accumulateFatigue(0, 1, 100);
      expect(result.stressMultiplier).toBe(2.0);
    });

    it('gains 1.5 with 1 action and stress 75 (mult 1.5)', () => {
      const result = engine.accumulateFatigue(0, 1, 75);
      expect(result.fatigueGain).toBeCloseTo(1.5, 5);
      expect(result.newFatigue).toBeCloseTo(1.5, 5);
    });

    it('gains 20 with 10 actions and stress 100 (mult 2.0)', () => {
      const result = engine.accumulateFatigue(0, 10, 100);
      expect(result.fatigueGain).toBe(20);
      expect(result.newFatigue).toBe(20);
    });

    it('records actionsThisTurn in the result', () => {
      const result = engine.accumulateFatigue(0, 7, 50);
      expect(result.actionsThisTurn).toBe(7);
    });
  });

  // ───────────────────────────────────────────────
  // 3. evaluateFatigueEffect
  // ───────────────────────────────────────────────
  describe('evaluateFatigueEffect', () => {
    it('returns none with thresholdExceeded false for fatigue 0', () => {
      const result = engine.evaluateFatigueEffect(0, 0);
      expect(result.effectType).toBe('none');
      expect(result.thresholdExceeded).toBe(false);
    });

    it('returns none with thresholdExceeded false for fatigue exactly at threshold (60)', () => {
      const result = engine.evaluateFatigueEffect(60, 0);
      expect(result.effectType).toBe('none');
      expect(result.thresholdExceeded).toBe(false);
    });

    it('returns defaulting for fatigue 61 and roll 0.0', () => {
      const result = engine.evaluateFatigueEffect(61, 0.0);
      expect(result.effectType).toBe('defaulting');
      expect(result.thresholdExceeded).toBe(true);
    });

    it('returns defaulting for fatigue 61 and roll 0.29', () => {
      const result = engine.evaluateFatigueEffect(61, 0.29);
      expect(result.effectType).toBe('defaulting');
    });

    it('returns deferral for fatigue 61 and roll 0.3', () => {
      const result = engine.evaluateFatigueEffect(61, 0.3);
      expect(result.effectType).toBe('deferral');
    });

    it('returns deferral for fatigue 61 and roll 0.49', () => {
      const result = engine.evaluateFatigueEffect(61, 0.49);
      expect(result.effectType).toBe('deferral');
    });

    it('returns impulsivity for fatigue 61 and roll 0.5', () => {
      const result = engine.evaluateFatigueEffect(61, 0.5);
      expect(result.effectType).toBe('impulsivity');
    });

    it('returns impulsivity for fatigue 61 and roll 0.59', () => {
      const result = engine.evaluateFatigueEffect(61, 0.59);
      expect(result.effectType).toBe('impulsivity');
    });

    it('returns none (composure) for fatigue 61 and roll 0.6, thresholdExceeded true', () => {
      const result = engine.evaluateFatigueEffect(61, 0.6);
      expect(result.effectType).toBe('none');
      expect(result.thresholdExceeded).toBe(true);
    });

    it('returns none (composure) for fatigue 61 and roll 0.99', () => {
      const result = engine.evaluateFatigueEffect(61, 0.99);
      expect(result.effectType).toBe('none');
    });

    it('returns defaulting for fatigue 100 and roll 0.15', () => {
      const result = engine.evaluateFatigueEffect(100, 0.15);
      expect(result.effectType).toBe('defaulting');
    });

    it('includes a non-empty reason string', () => {
      const result = engine.evaluateFatigueEffect(80, 0.1);
      expect(result.reason).toBeTruthy();
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('reports fatigueLevel matching the input', () => {
      const result = engine.evaluateFatigueEffect(73, 0.4);
      expect(result.fatigueLevel).toBe(73);
    });

    it('reports fatigueLevel matching input even below threshold', () => {
      const result = engine.evaluateFatigueEffect(25, 0.5);
      expect(result.fatigueLevel).toBe(25);
    });
  });

  // ───────────────────────────────────────────────
  // 4. applyPeacetimeReset
  // ───────────────────────────────────────────────
  describe('applyPeacetimeReset', () => {
    it('reduces fatigue by 20 when at peace (50 → 30)', () => {
      const result = engine.applyPeacetimeReset(50, true);
      expect(result.newFatigue).toBe(30);
      expect(result.resetAmount).toBe(20);
    });

    it('does not reduce fatigue when not at peace (50 → 50)', () => {
      const result = engine.applyPeacetimeReset(50, false);
      expect(result.newFatigue).toBe(50);
      expect(result.resetAmount).toBe(0);
    });

    it('clamps fatigue at 0 when peace reset would go negative (10 → 0)', () => {
      const result = engine.applyPeacetimeReset(10, true);
      expect(result.newFatigue).toBe(0);
    });

    it('keeps fatigue at 0 when already 0 and at peace', () => {
      const result = engine.applyPeacetimeReset(0, true);
      expect(result.newFatigue).toBe(0);
    });

    it('reduces fatigue 100 to 80 when at peace', () => {
      const result = engine.applyPeacetimeReset(100, true);
      expect(result.newFatigue).toBe(80);
    });

    it('keeps fatigue at 100 when not at peace', () => {
      const result = engine.applyPeacetimeReset(100, false);
      expect(result.newFatigue).toBe(100);
    });

    it('preserves previousFatigue matching input', () => {
      const result = engine.applyPeacetimeReset(65, true);
      expect(result.previousFatigue).toBe(65);
    });

    it('includes atPeace flag in result', () => {
      const resultPeace = engine.applyPeacetimeReset(40, true);
      expect(resultPeace.atPeace).toBe(true);

      const resultWar = engine.applyPeacetimeReset(40, false);
      expect(resultWar.atPeace).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // 5. createInitialFatigueState
  // ───────────────────────────────────────────────
  describe('createInitialFatigueState', () => {
    it('returns the correct leaderId and turn', () => {
      const state = engine.createInitialFatigueState(
        'leader-alpha' as LeaderId,
        5 as TurnNumber,
      );
      expect(state.leaderId).toBe('leader-alpha');
      expect(state.turn).toBe(5);
    });

    it('initialises currentFatigue to 0', () => {
      const state = engine.createInitialFatigueState(
        'leader-beta' as LeaderId,
        1 as TurnNumber,
      );
      expect(state.currentFatigue).toBe(0);
    });

    it('initialises actionsThisTurn to 0', () => {
      const state = engine.createInitialFatigueState(
        'leader-gamma' as LeaderId,
        1 as TurnNumber,
      );
      expect(state.actionsThisTurn).toBe(0);
    });

    it('initialises stressMultiplier to 1.0', () => {
      const state = engine.createInitialFatigueState(
        'leader-delta' as LeaderId,
        1 as TurnNumber,
      );
      expect(state.stressMultiplier).toBe(1.0);
    });
  });
});
