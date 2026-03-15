import { describe, it, expect, beforeEach } from 'vitest';
import {
  FogOfIntentEngine,
  IntentType,
} from '@/engine/fog-of-intent';
import type {
  IntentAssessmentInput,
  IntentAssessment,
  IntentProbabilities,
  MisreadResult,
} from '@/engine/fog-of-intent';
import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFactionId(id: string): FactionId {
  return id as FactionId;
}

function makeAssessmentInput(
  overrides: Partial<IntentAssessmentInput> = {},
): IntentAssessmentInput {
  return {
    observerFaction: makeFactionId('us'),
    targetFaction: makeFactionId('russia'),
    humint: 50,
    psychProfile: 50,
    trueIntent: IntentType.Defensive,
    baseEscalation: 30,
    ...overrides,
  };
}

function sumProbabilities(probs: IntentProbabilities): number {
  return probs.defensive + probs.signal + probs.exercise + probs.attackPrep;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FogOfIntentEngine', () => {
  let engine: FogOfIntentEngine;

  beforeEach(() => {
    engine = new FogOfIntentEngine();
  });

  // -----------------------------------------------------------------------
  // computeAccuracyScore
  // -----------------------------------------------------------------------
  describe('computeAccuracyScore', () => {
    it('computes weighted sum (humint*0.6 + psych*0.4)', () => {
      // 80*0.6 + 60*0.4 = 48 + 24 = 72
      const result = engine.computeAccuracyScore(80, 60);
      expect(result).toBeCloseTo(72);
    });

    it('clamps to 0 for negative inputs', () => {
      const result = engine.computeAccuracyScore(-50, -50);
      expect(result).toBe(0);
    });

    it('clamps to 100 for excessive inputs', () => {
      const result = engine.computeAccuracyScore(200, 200);
      expect(result).toBe(100);
    });

    it('handles zero inputs', () => {
      const result = engine.computeAccuracyScore(0, 0);
      expect(result).toBe(0);
    });

    it('handles max inputs (100, 100)', () => {
      // 100*0.6 + 100*0.4 = 100
      const result = engine.computeAccuracyScore(100, 100);
      expect(result).toBe(100);
    });

    it('gives more weight to humint than psychProfile', () => {
      const humintHigh = engine.computeAccuracyScore(100, 0);  // 60
      const psychHigh = engine.computeAccuracyScore(0, 100);   // 40
      expect(humintHigh).toBeGreaterThan(psychHigh);
    });
  });

  // -----------------------------------------------------------------------
  // classifyAccuracy
  // -----------------------------------------------------------------------
  describe('classifyAccuracy', () => {
    it('returns "high" at/above threshold (60)', () => {
      expect(engine.classifyAccuracy(80)).toBe('high');
    });

    it('returns "medium" between thresholds', () => {
      expect(engine.classifyAccuracy(40)).toBe('medium');
    });

    it('returns "low" at/below threshold (25)', () => {
      expect(engine.classifyAccuracy(10)).toBe('low');
    });

    it('boundary: 60 is high', () => {
      expect(engine.classifyAccuracy(60)).toBe('high');
    });

    it('boundary: 25 is low', () => {
      expect(engine.classifyAccuracy(25)).toBe('low');
    });

    it('boundary: 26 is medium', () => {
      expect(engine.classifyAccuracy(26)).toBe('medium');
    });

    it('boundary: 59 is medium', () => {
      expect(engine.classifyAccuracy(59)).toBe('medium');
    });
  });

  // -----------------------------------------------------------------------
  // computeNoiseFactor
  // -----------------------------------------------------------------------
  describe('computeNoiseFactor', () => {
    it('max noise at accuracy 0 (0.25)', () => {
      const result = engine.computeNoiseFactor(0);
      expect(result).toBeCloseTo(0.25);
    });

    it('min noise at accuracy 100 (0.03)', () => {
      const result = engine.computeNoiseFactor(100);
      expect(result).toBeCloseTo(0.03);
    });

    it('interpolates linearly at midpoint', () => {
      const result = engine.computeNoiseFactor(50);
      // maxNoise + 0.5 * (minNoise - maxNoise) = 0.25 + 0.5 * (0.03 - 0.25)
      // = 0.25 + 0.5 * (-0.22) = 0.25 - 0.11 = 0.14
      expect(result).toBeCloseTo(0.14);
    });

    it('clamps negative accuracy to max noise', () => {
      const result = engine.computeNoiseFactor(-20);
      expect(result).toBeCloseTo(0.25);
    });

    it('noise decreases as accuracy increases', () => {
      const lowAcc = engine.computeNoiseFactor(10);
      const highAcc = engine.computeNoiseFactor(90);
      expect(lowAcc).toBeGreaterThan(highAcc);
    });
  });

  // -----------------------------------------------------------------------
  // computeIntentDistribution
  // -----------------------------------------------------------------------
  describe('computeIntentDistribution', () => {
    it('high accuracy: true intent dominates', () => {
      const dist = engine.computeIntentDistribution(IntentType.Defensive, 100);
      expect(dist.defensive).toBeGreaterThan(0.9);
    });

    it('low accuracy: approaches default distribution (defensive ~0.6)', () => {
      const dist = engine.computeIntentDistribution(IntentType.AttackPrep, 0);
      // At accuracy 0, clarity=0 → purely default distribution
      expect(dist.defensive).toBeCloseTo(0.6);
      expect(dist.signal).toBeCloseTo(0.25);
      expect(dist.exercise).toBeCloseTo(0.1);
      expect(dist.attackPrep).toBeCloseTo(0.05);
    });

    it('probabilities sum to 1.0', () => {
      const dist = engine.computeIntentDistribution(IntentType.Signal, 50);
      expect(sumProbabilities(dist)).toBeCloseTo(1.0);
    });

    it('returns valid distribution for all 4 intent types', () => {
      for (const intent of Object.values(IntentType)) {
        const dist = engine.computeIntentDistribution(intent, 75);
        expect(dist.defensive).toBeGreaterThanOrEqual(0);
        expect(dist.signal).toBeGreaterThanOrEqual(0);
        expect(dist.exercise).toBeGreaterThanOrEqual(0);
        expect(dist.attackPrep).toBeGreaterThanOrEqual(0);
        expect(sumProbabilities(dist)).toBeCloseTo(1.0);
      }
    });

    it('deterministic: same inputs produce same outputs', () => {
      const dist1 = engine.computeIntentDistribution(IntentType.Exercise, 45);
      const dist2 = engine.computeIntentDistribution(IntentType.Exercise, 45);
      expect(dist1.defensive).toBe(dist2.defensive);
      expect(dist1.signal).toBe(dist2.signal);
      expect(dist1.exercise).toBe(dist2.exercise);
      expect(dist1.attackPrep).toBe(dist2.attackPrep);
    });

    it('medium accuracy blends truth and default', () => {
      const dist = engine.computeIntentDistribution(IntentType.AttackPrep, 50);
      // clarity = 0.5; attackPrep = 0.5 * 1.0 + 0.5 * 0.05 = 0.525 (before normalisation)
      // All others get 0.5 * 0 + 0.5 * default
      expect(dist.attackPrep).toBeGreaterThan(dist.defensive);
    });

    it('all probabilities non-negative', () => {
      const dist = engine.computeIntentDistribution(IntentType.Signal, 20);
      expect(dist.defensive).toBeGreaterThanOrEqual(0);
      expect(dist.signal).toBeGreaterThanOrEqual(0);
      expect(dist.exercise).toBeGreaterThanOrEqual(0);
      expect(dist.attackPrep).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateMisread
  // -----------------------------------------------------------------------
  describe('evaluateMisread', () => {
    it('no misread when dominant matches actual', () => {
      const probs: IntentProbabilities = {
        defensive: 0.7,
        signal: 0.15,
        exercise: 0.1,
        attackPrep: 0.05,
      };
      const result: MisreadResult = engine.evaluateMisread(probs, IntentType.Defensive);
      expect(result.misread).toBe(false);
    });

    it('misread when dominant differs from actual', () => {
      const probs: IntentProbabilities = {
        defensive: 0.7,
        signal: 0.15,
        exercise: 0.1,
        attackPrep: 0.05,
      };
      const result = engine.evaluateMisread(probs, IntentType.AttackPrep);
      expect(result.misread).toBe(true);
    });

    it('returns correct perceived intent', () => {
      const probs: IntentProbabilities = {
        defensive: 0.1,
        signal: 0.6,
        exercise: 0.2,
        attackPrep: 0.1,
      };
      const result = engine.evaluateMisread(probs, IntentType.Signal);
      expect(result.perceivedIntent).toBe('signal');
    });

    it('returns correct actual intent', () => {
      const probs: IntentProbabilities = {
        defensive: 0.7,
        signal: 0.15,
        exercise: 0.1,
        attackPrep: 0.05,
      };
      const result = engine.evaluateMisread(probs, IntentType.AttackPrep);
      expect(result.actualIntent).toBe('attackPrep');
    });

    it('returns escalationRisk of 0 (before multiplier)', () => {
      const probs: IntentProbabilities = {
        defensive: 0.7,
        signal: 0.15,
        exercise: 0.1,
        attackPrep: 0.05,
      };
      const result = engine.evaluateMisread(probs, IntentType.Defensive);
      expect(result.escalationRisk).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computeEscalationRisk
  // -----------------------------------------------------------------------
  describe('computeEscalationRisk', () => {
    it('multiplies base by 1.5 on misread', () => {
      const misread: MisreadResult = {
        misread: true,
        perceivedIntent: 'defensive',
        actualIntent: 'attackPrep',
        escalationRisk: 0,
      };
      const result = engine.computeEscalationRisk(misread, 40);
      expect(result).toBeCloseTo(60); // 40 * 1.5
    });

    it('returns base unchanged on no misread', () => {
      const noMisread: MisreadResult = {
        misread: false,
        perceivedIntent: 'defensive',
        actualIntent: 'defensive',
        escalationRisk: 0,
      };
      const result = engine.computeEscalationRisk(noMisread, 40);
      expect(result).toBe(40);
    });

    it('handles zero base escalation', () => {
      const misread: MisreadResult = {
        misread: true,
        perceivedIntent: 'defensive',
        actualIntent: 'attackPrep',
        escalationRisk: 0,
      };
      const result = engine.computeEscalationRisk(misread, 0);
      expect(result).toBe(0);
    });

    it('clamps result to 100', () => {
      const misread: MisreadResult = {
        misread: true,
        perceivedIntent: 'defensive',
        actualIntent: 'attackPrep',
        escalationRisk: 0,
      };
      const result = engine.computeEscalationRisk(misread, 80);
      expect(result).toBe(100); // 80 * 1.5 = 120 → clamped to 100
    });
  });

  // -----------------------------------------------------------------------
  // assessIntent (integration)
  // -----------------------------------------------------------------------
  describe('assessIntent', () => {
    it('high HUMINT + high psych = accurate reading', () => {
      const input = makeAssessmentInput({
        humint: 100,
        psychProfile: 100,
        trueIntent: IntentType.Defensive,
      });
      const result: IntentAssessment = engine.assessIntent(input);
      expect(result.accuracyLevel).toBe('high');
      expect(result.misread).toBe(false);
      expect(result.perceivedIntent).toBe('defensive');
    });

    it('low HUMINT + low psych = likely misread', () => {
      const input = makeAssessmentInput({
        humint: 5,
        psychProfile: 5,
        trueIntent: IntentType.AttackPrep,
        baseEscalation: 30,
      });
      const result = engine.assessIntent(input);
      expect(result.accuracyLevel).toBe('low');
      // With very low accuracy, the default distribution dominates (defensive ~0.6)
      // so an attackPrep true intent gets misread as defensive
      expect(result.misread).toBe(true);
      expect(result.perceivedIntent).toBe('defensive');
    });

    it('returns all fields populated', () => {
      const input = makeAssessmentInput();
      const result = engine.assessIntent(input);
      expect(result.observerFaction).toBeDefined();
      expect(result.targetFaction).toBeDefined();
      expect(result.perceivedProbabilities).toBeDefined();
      expect(result.accuracyScore).toBeDefined();
      expect(result.accuracyLevel).toBeDefined();
      expect(result.noiseFactor).toBeDefined();
      expect(typeof result.misread).toBe('boolean');
      expect(result.perceivedIntent).toBeDefined();
      expect(result.actualIntent).toBeDefined();
      expect(result.escalationRisk).toBeDefined();
    });

    it('probabilities sum to 1.0', () => {
      const input = makeAssessmentInput({
        humint: 50,
        psychProfile: 50,
        trueIntent: IntentType.Signal,
      });
      const result = engine.assessIntent(input);
      expect(sumProbabilities(result.perceivedProbabilities)).toBeCloseTo(1.0);
    });

    it('escalation risk increases on misread', () => {
      const input = makeAssessmentInput({
        humint: 5,
        psychProfile: 5,
        trueIntent: IntentType.AttackPrep,
        baseEscalation: 30,
      });
      const result = engine.assessIntent(input);
      // misread → base * 1.5 = 45
      expect(result.misread).toBe(true);
      expect(result.escalationRisk).toBeCloseTo(45);
    });

    it('escalation risk equals base when no misread', () => {
      const input = makeAssessmentInput({
        humint: 100,
        psychProfile: 100,
        trueIntent: IntentType.Defensive,
        baseEscalation: 30,
      });
      const result = engine.assessIntent(input);
      expect(result.misread).toBe(false);
      expect(result.escalationRisk).toBe(30);
    });

    it('uses correct faction IDs', () => {
      const input = makeAssessmentInput({
        observerFaction: makeFactionId('japan'),
        targetFaction: makeFactionId('china'),
      });
      const result = engine.assessIntent(input);
      expect(result.observerFaction).toBe('japan');
      expect(result.targetFaction).toBe('china');
    });

    it('defensive intent perceived correctly at high accuracy', () => {
      const input = makeAssessmentInput({
        humint: 90,
        psychProfile: 90,
        trueIntent: IntentType.Defensive,
      });
      const result = engine.assessIntent(input);
      expect(result.perceivedIntent).toBe('defensive');
      expect(result.actualIntent).toBe('defensive');
      expect(result.misread).toBe(false);
    });

    it('attack prep correctly identified at high accuracy', () => {
      const input = makeAssessmentInput({
        humint: 100,
        psychProfile: 100,
        trueIntent: IntentType.AttackPrep,
      });
      const result = engine.assessIntent(input);
      expect(result.perceivedIntent).toBe('attackPrep');
      expect(result.actualIntent).toBe('attackPrep');
      expect(result.misread).toBe(false);
    });

    it('attack prep often misread at low accuracy', () => {
      const input = makeAssessmentInput({
        humint: 0,
        psychProfile: 0,
        trueIntent: IntentType.AttackPrep,
      });
      const result = engine.assessIntent(input);
      // At accuracy 0, defaults dominate → defensive is perceived
      expect(result.misread).toBe(true);
      expect(result.actualIntent).toBe('attackPrep');
      expect(result.perceivedIntent).not.toBe('attackPrep');
    });
  });

  // -----------------------------------------------------------------------
  // config override
  // -----------------------------------------------------------------------
  describe('config override', () => {
    it('respects custom accuracy thresholds', () => {
      const custom = new FogOfIntentEngine({
        highAccuracyThreshold: 80,
        lowAccuracyThreshold: 40,
      });
      // 60 is medium under custom thresholds (not high like default)
      expect(custom.classifyAccuracy(60)).toBe('medium');
      expect(custom.classifyAccuracy(80)).toBe('high');
      expect(custom.classifyAccuracy(40)).toBe('low');
    });

    it('respects custom noise bounds', () => {
      const custom = new FogOfIntentEngine({
        maxNoise: 0.5,
        minNoise: 0.1,
      });
      expect(custom.computeNoiseFactor(0)).toBeCloseTo(0.5);
      expect(custom.computeNoiseFactor(100)).toBeCloseTo(0.1);
    });

    it('respects custom weights', () => {
      const custom = new FogOfIntentEngine({
        humintWeight: 0.5,
        psychProfileWeight: 0.5,
      });
      // Equal weighting: 80*0.5 + 60*0.5 = 70
      const result = custom.computeAccuracyScore(80, 60);
      expect(result).toBeCloseTo(70);
    });

    it('respects custom default probabilities', () => {
      const custom = new FogOfIntentEngine({
        defaultProbabilities: {
          defensive: 0.25,
          signal: 0.25,
          exercise: 0.25,
          attackPrep: 0.25,
        },
      });
      // At accuracy 0, defaults dominate
      const dist = custom.computeIntentDistribution(IntentType.Defensive, 0);
      expect(dist.defensive).toBeCloseTo(0.25);
      expect(dist.signal).toBeCloseTo(0.25);
      expect(dist.exercise).toBeCloseTo(0.25);
      expect(dist.attackPrep).toBeCloseTo(0.25);
    });

    it('respects custom misread escalation multiplier', () => {
      const custom = new FogOfIntentEngine({
        misreadEscalationMultiplier: 2.0,
      });
      const misread: MisreadResult = {
        misread: true,
        perceivedIntent: 'defensive',
        actualIntent: 'attackPrep',
        escalationRisk: 0,
      };
      const result = custom.computeEscalationRisk(misread, 40);
      expect(result).toBeCloseTo(80); // 40 * 2.0
    });
  });

  // -----------------------------------------------------------------------
  // IntentType constant
  // -----------------------------------------------------------------------
  describe('IntentType', () => {
    it('has all four intent values', () => {
      expect(IntentType.Defensive).toBe('defensive');
      expect(IntentType.Signal).toBe('signal');
      expect(IntentType.Exercise).toBe('exercise');
      expect(IntentType.AttackPrep).toBe('attackPrep');
    });
  });
});
