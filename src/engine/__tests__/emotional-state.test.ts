/**
 * Unit tests for EmotionalStateEngine.
 *
 * @see FR-1501 — Five-dimensional emotional model per leader
 * @see FR-1502 — Emotional modifiers on AI utility calculations
 * @see FR-1507 — Stress inoculation after prolonged high-stress exposure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmotionalStateEngine } from '@/engine/emotional-state';
import type { EmotionalEvent } from '@/engine/emotional-state';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId, TurnNumber, EmotionalStateSnapshot } from '@/data/types';

describe('EmotionalStateEngine', () => {
  let engine: EmotionalStateEngine;
  const cfg = GAME_CONFIG.psychology;

  beforeEach(() => {
    engine = new EmotionalStateEngine(cfg);
  });

  /** Helper to create a snapshot with sensible defaults. */
  function makeSnapshot(overrides: Partial<EmotionalStateSnapshot> = {}): EmotionalStateSnapshot {
    return {
      leaderId: 'trump' as LeaderId,
      turn: 1 as TurnNumber,
      stress: 50,
      confidence: 50,
      anger: 50,
      fear: 50,
      resolve: 50,
      decisionFatigue: 0,
      stressInoculated: false,
      ...overrides,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. createInitialState
  // ─────────────────────────────────────────────────────────────────────────

  describe('createInitialState', () => {
    it('should set all dimensions to 50 by default', () => {
      const state = engine.createInitialState('trump' as LeaderId, 1 as TurnNumber);
      expect(state.stress).toBe(50);
      expect(state.confidence).toBe(50);
      expect(state.anger).toBe(50);
      expect(state.fear).toBe(50);
      expect(state.resolve).toBe(50);
    });

    it('should set decisionFatigue to 0 and stressInoculated to false', () => {
      const state = engine.createInitialState('trump' as LeaderId, 1 as TurnNumber);
      expect(state.decisionFatigue).toBe(0);
      expect(state.stressInoculated).toBe(false);
    });

    it('should stamp leaderId and turn correctly', () => {
      const state = engine.createInitialState('xi' as LeaderId, 5 as TurnNumber);
      expect(state.leaderId).toBe('xi');
      expect(state.turn).toBe(5);
    });

    it('should respect explicit overrides for each dimension', () => {
      const state = engine.createInitialState('trump' as LeaderId, 1 as TurnNumber, {
        stress: 10,
        confidence: 80,
        anger: 30,
        fear: 90,
        resolve: 5,
      });
      expect(state.stress).toBe(10);
      expect(state.confidence).toBe(80);
      expect(state.anger).toBe(30);
      expect(state.fear).toBe(90);
      expect(state.resolve).toBe(5);
    });

    it('should clamp overrides above 100 down to 100', () => {
      const state = engine.createInitialState('trump' as LeaderId, 1 as TurnNumber, {
        stress: 150,
        confidence: 200,
      });
      expect(state.stress).toBe(100);
      expect(state.confidence).toBe(100);
    });

    it('should clamp overrides below 0 up to 0', () => {
      const state = engine.createInitialState('trump' as LeaderId, 1 as TurnNumber, {
        anger: -20,
        fear: -5,
      });
      expect(state.anger).toBe(0);
      expect(state.fear).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. computeStressGain
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeStressGain', () => {
    it('should return raw delta when resolve is below threshold and not inoculated', () => {
      const result = engine.computeStressGain(10, 50, false);
      expect(result).toBe(10);
    });

    it('should halve delta when resolve is exactly at threshold (70)', () => {
      const result = engine.computeStressGain(10, 70, false);
      expect(result).toBe(5);
    });

    it('should halve delta when resolve is above threshold', () => {
      const result = engine.computeStressGain(20, 85, false);
      expect(result).toBe(10);
    });

    it('should reduce delta by 20% when inoculated but resolve is below threshold', () => {
      const result = engine.computeStressGain(10, 50, true);
      expect(result).toBe(8);
    });

    it('should apply both resolve and inoculation reductions when both active', () => {
      // 10 * 0.5 (resolve) * 0.8 (inoculation) = 4
      const result = engine.computeStressGain(10, 70, true);
      expect(result).toBe(4);
    });

    it('should return 0 for zero delta', () => {
      const result = engine.computeStressGain(0, 70, true);
      expect(result).toBe(0);
    });

    it('should handle large delta with both reductions', () => {
      // 100 * 0.5 * 0.8 = 40
      const result = engine.computeStressGain(100, 80, true);
      expect(result).toBe(40);
    });

    it('should not apply resolve reduction when resolve is 69 (below threshold)', () => {
      const result = engine.computeStressGain(10, 69, false);
      expect(result).toBe(10);
    });

    it('should never return a negative value', () => {
      const result = engine.computeStressGain(0.001, 100, true);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. updateEmotionalState
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateEmotionalState', () => {
    it('should return unchanged dimensions when events array is empty', () => {
      const snap = makeSnapshot();
      const result = engine.updateEmotionalState(snap, [], 2 as TurnNumber);
      expect(result.newState.stress).toBe(50);
      expect(result.newState.confidence).toBe(50);
      expect(result.newState.anger).toBe(50);
      expect(result.newState.fear).toBe(50);
      expect(result.newState.resolve).toBe(50);
    });

    it('should update the turn number on the new state', () => {
      const snap = makeSnapshot({ turn: 1 as TurnNumber });
      const result = engine.updateEmotionalState(snap, [], 5 as TurnNumber);
      expect(result.newState.turn).toBe(5);
    });

    it('should apply computeStressGain for positive stress deltas', () => {
      // resolve = 70 → half stress gain. 20 * 0.5 = 10
      const snap = makeSnapshot({ stress: 30, resolve: 70 });
      const events: EmotionalEvent[] = [
        { dimension: 'stress', delta: 20, source: 'combat_loss' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.stress).toBe(40); // 30 + 10
    });

    it('should apply stress decreases directly without resolve reduction', () => {
      const snap = makeSnapshot({ stress: 80, resolve: 70 });
      const events: EmotionalEvent[] = [
        { dimension: 'stress', delta: -20, source: 'peacetime' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.stress).toBe(60); // 80 - 20, no resolve reduction
    });

    it('should apply a single anger increase directly', () => {
      const snap = makeSnapshot({ anger: 40 });
      const events: EmotionalEvent[] = [
        { dimension: 'anger', delta: 15, source: 'diplomatic_insult' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.anger).toBe(55);
    });

    it('should accumulate multiple events sequentially', () => {
      const snap = makeSnapshot({ anger: 30, fear: 20 });
      const events: EmotionalEvent[] = [
        { dimension: 'anger', delta: 10, source: 'insult' },
        { dimension: 'anger', delta: 5, source: 'border_incident' },
        { dimension: 'fear', delta: 15, source: 'nuclear_test' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.anger).toBe(45); // 30 + 10 + 5
      expect(result.newState.fear).toBe(35);  // 20 + 15
    });

    it('should clamp dimensions at 100 ceiling', () => {
      const snap = makeSnapshot({ anger: 95 });
      const events: EmotionalEvent[] = [
        { dimension: 'anger', delta: 20, source: 'provocation' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.anger).toBe(100);
    });

    it('should clamp dimensions at 0 floor', () => {
      const snap = makeSnapshot({ fear: 5 });
      const events: EmotionalEvent[] = [
        { dimension: 'fear', delta: -20, source: 'reassurance' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.fear).toBe(0);
    });

    it('should update confidence dimension correctly', () => {
      const snap = makeSnapshot({ confidence: 40 });
      const events: EmotionalEvent[] = [
        { dimension: 'confidence', delta: 25, source: 'military_victory' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.confidence).toBe(65);
    });

    it('should update resolve dimension correctly', () => {
      const snap = makeSnapshot({ resolve: 60 });
      const events: EmotionalEvent[] = [
        { dimension: 'resolve', delta: 10, source: 'national_rally' },
      ];
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.newState.resolve).toBe(70);
    });

    it('should trigger stress inoculation when turn >= 20 and stress >= 50', () => {
      const snap = makeSnapshot({ stress: 55, stressInoculated: false });
      const result = engine.updateEmotionalState(snap, [], 20 as TurnNumber);
      expect(result.stressInoculationTriggered).toBe(true);
      expect(result.newState.stressInoculated).toBe(true);
    });

    it('should NOT trigger stress inoculation when turn < 20', () => {
      const snap = makeSnapshot({ stress: 60, stressInoculated: false });
      const result = engine.updateEmotionalState(snap, [], 19 as TurnNumber);
      expect(result.stressInoculationTriggered).toBe(false);
      expect(result.newState.stressInoculated).toBe(false);
    });

    it('should NOT trigger stress inoculation when stress < 50 after events', () => {
      const snap = makeSnapshot({ stress: 55, stressInoculated: false });
      const events: EmotionalEvent[] = [
        { dimension: 'stress', delta: -10, source: 'rest' },
      ];
      const result = engine.updateEmotionalState(snap, events, 25 as TurnNumber);
      // stress = 55 - 10 = 45 → below threshold
      expect(result.newState.stress).toBe(45);
      expect(result.stressInoculationTriggered).toBe(false);
      expect(result.newState.stressInoculated).toBe(false);
    });

    it('should NOT trigger inoculation if already inoculated', () => {
      const snap = makeSnapshot({ stress: 60, stressInoculated: true });
      const result = engine.updateEmotionalState(snap, [], 25 as TurnNumber);
      expect(result.stressInoculationTriggered).toBe(false);
      expect(result.newState.stressInoculated).toBe(true);
    });

    it('should reference the original state as previousState', () => {
      const snap = makeSnapshot();
      const result = engine.updateEmotionalState(snap, [], 2 as TurnNumber);
      expect(result.previousState).toBe(snap);
    });

    it('should reference the input events as appliedEvents', () => {
      const events: EmotionalEvent[] = [
        { dimension: 'anger', delta: 5, source: 'test' },
      ];
      const snap = makeSnapshot();
      const result = engine.updateEmotionalState(snap, events, 2 as TurnNumber);
      expect(result.appliedEvents).toBe(events);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. applyEmotionalModifiers
  // ─────────────────────────────────────────────────────────────────────────

  describe('applyEmotionalModifiers', () => {
    it('should return unmodified utility when all dimensions are below thresholds', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0.5);
      expect(result.modifiedUtility).toBe(1.0);
      expect(result.aggressiveBonus).toBe(0);
      expect(result.defensiveBonus).toBe(0);
      expect(result.confidenceRiskBoost).toBe(0);
      expect(result.noiseApplied).toBe(0);
      expect(result.resolveStressReduction).toBe(false);
    });

    it('should apply aggressive bonus when anger is exactly at threshold (60)', () => {
      const snap = makeSnapshot({ anger: 60, fear: 30, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.aggressiveBonus).toBe(0.2);
      expect(result.modifiedUtility).toBeCloseTo(1.2);
    });

    it('should NOT apply aggressive bonus when anger is 59', () => {
      const snap = makeSnapshot({ anger: 59, fear: 30, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.aggressiveBonus).toBe(0);
      expect(result.modifiedUtility).toBe(1.0);
    });

    it('should apply defensive bonus when fear is exactly at threshold (60)', () => {
      const snap = makeSnapshot({ anger: 30, fear: 60, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.defensiveBonus).toBe(0.15);
      expect(result.modifiedUtility).toBeCloseTo(1.15);
    });

    it('should NOT apply defensive bonus when fear is 59', () => {
      const snap = makeSnapshot({ anger: 30, fear: 59, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.defensiveBonus).toBe(0);
      expect(result.modifiedUtility).toBe(1.0);
    });

    it('should set confidenceRiskBoost when confidence is exactly at threshold (70)', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 70, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.confidenceRiskBoost).toBe(15);
    });

    it('should NOT include confidenceRiskBoost in modifiedUtility', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 90, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.confidenceRiskBoost).toBe(15);
      expect(result.modifiedUtility).toBe(1.0); // utility unchanged by confidence
    });

    it('should NOT set confidenceRiskBoost when confidence is 69', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 69, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.confidenceRiskBoost).toBe(0);
    });

    it('should apply positive noise when stress >= 70 and noise is positive', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 70, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 1.0);
      expect(result.noiseApplied).toBeCloseTo(0.15);
      expect(result.modifiedUtility).toBeCloseTo(1.15);
    });

    it('should apply negative noise when stress >= 70 and noise is negative', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 70, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, -1.0);
      expect(result.noiseApplied).toBeCloseTo(-0.15);
      expect(result.modifiedUtility).toBeCloseTo(0.85);
    });

    it('should apply zero noise when stress >= 70 and noise is 0', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 70, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.noiseApplied).toBe(0);
      expect(result.modifiedUtility).toBe(1.0);
    });

    it('should NOT apply noise when stress is 69', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 69, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 1.0);
      expect(result.noiseApplied).toBe(0);
      expect(result.modifiedUtility).toBe(1.0);
    });

    it('should set resolveStressReduction to true when resolve >= 70', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 30, resolve: 70 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.resolveStressReduction).toBe(true);
    });

    it('should set resolveStressReduction to false when resolve is 69', () => {
      const snap = makeSnapshot({ anger: 30, fear: 30, stress: 30, confidence: 30, resolve: 69 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.resolveStressReduction).toBe(false);
    });

    it('should apply both aggressive and defensive bonuses simultaneously', () => {
      const snap = makeSnapshot({ anger: 80, fear: 80, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.aggressiveBonus).toBe(0.2);
      expect(result.defensiveBonus).toBe(0.15);
      expect(result.modifiedUtility).toBeCloseTo(1.35); // 1.0 + 0.2 + 0.15
    });

    it('should apply all modifiers when all thresholds exceeded', () => {
      const snap = makeSnapshot({ anger: 80, fear: 80, stress: 90, confidence: 90, resolve: 90 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 1.0);
      expect(result.aggressiveBonus).toBe(0.2);
      expect(result.defensiveBonus).toBe(0.15);
      expect(result.confidenceRiskBoost).toBe(15);
      expect(result.noiseApplied).toBeCloseTo(0.15);
      expect(result.resolveStressReduction).toBe(true);
      // modifiedUtility = 1.0 + 0.2 + 0.15 + 0.15 = 1.5  (confidence NOT in utility)
      expect(result.modifiedUtility).toBeCloseTo(1.5);
    });

    it('should correctly compute modifiedUtility = base + aggressive + defensive + noise', () => {
      const snap = makeSnapshot({ anger: 70, fear: 65, stress: 75, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 2.0, 0.5);
      // aggressiveBonus = 0.2, defensiveBonus = 0.15, noise = 0.15 * 0.5 = 0.075
      const expected = 2.0 + 0.2 + 0.15 + 0.075;
      expect(result.modifiedUtility).toBeCloseTo(expected);
    });

    it('should return bonuses as modified utility when base utility is 0', () => {
      const snap = makeSnapshot({ anger: 80, fear: 80, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 0, 0);
      expect(result.modifiedUtility).toBeCloseTo(0.35); // 0 + 0.2 + 0.15
    });

    it('should handle negative base utility correctly', () => {
      const snap = makeSnapshot({ anger: 80, fear: 80, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, -1.0, 0);
      expect(result.modifiedUtility).toBeCloseTo(-0.65); // -1.0 + 0.2 + 0.15
    });

    it('should preserve originalUtility in the result', () => {
      const snap = makeSnapshot({ anger: 80 });
      const result = engine.applyEmotionalModifiers(snap, 3.5, 0);
      expect(result.originalUtility).toBe(3.5);
    });

    it('should apply aggressive bonus for anger above threshold', () => {
      const snap = makeSnapshot({ anger: 100, fear: 30, stress: 30, confidence: 30, resolve: 30 });
      const result = engine.applyEmotionalModifiers(snap, 1.0, 0);
      expect(result.aggressiveBonus).toBe(0.2);
      expect(result.modifiedUtility).toBeCloseTo(1.2);
    });
  });
});
