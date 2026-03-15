import { describe, it, expect } from 'vitest';
import { UtilityEvaluator } from '@/engine/ai-evaluator';
import { SeededRandom } from '@/engine/rng';
import { FactionId, DecisionStyle, StressResponse } from '@/data/types';

import type { AIAction, AIEvaluationContext, UtilityWeights } from '@/engine/ai-evaluator';
import type {
  LeaderProfile,
  LeaderPsychology,
  EmotionalStateSnapshot,
  NationState,
  LeaderId,
  TurnNumber,
} from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function createTestPsychology(overrides?: Partial<LeaderPsychology>): LeaderPsychology {
  return {
    decisionStyle: DecisionStyle.Analytical,
    stressResponse: StressResponse.Consolidate,
    riskTolerance: 50,
    paranoia: 50,
    narcissism: 50,
    pragmatism: 50,
    patience: 50,
    vengefulIndex: 50,
    ...overrides,
  };
}

function createTestLeaderProfile(overrides?: Partial<LeaderProfile>): LeaderProfile {
  return {
    id: 'leader-test-001' as LeaderId,
    identity: {
      name: 'Test Leader',
      title: 'President',
      nation: FactionId.US,
      age: 60,
      ideology: 'Pragmatist',
    },
    psychology: createTestPsychology(),
    motivations: {
      primaryGoal: 'Stability',
      ideologicalCore: 'Centrism',
      redLines: ['Nuclear attack'],
      legacyAmbition: 'Peace',
    },
    powerBase: {
      military: 50,
      oligarchs: 50,
      party: 50,
      clergy: 0,
      public: 50,
      securityServices: 50,
    },
    vulnerabilities: {
      healthRisk: 10,
      successionClarity: 80,
      coupRisk: 5,
      personalScandal: 10,
    },
    historicalAnalog: 'Generic leader',
    ...overrides,
  };
}

function createTestEmotionalState(overrides?: Partial<EmotionalStateSnapshot>): EmotionalStateSnapshot {
  return {
    leaderId: 'leader-test-001' as LeaderId,
    turn: 1 as TurnNumber,
    stress: 30,
    confidence: 50,
    anger: 30,
    fear: 30,
    resolve: 50,
    decisionFatigue: 20,
    stressInoculated: false,
    ...overrides,
  };
}

function createTestNationState(overrides?: Partial<NationState>): NationState {
  return {
    factionId: FactionId.US,
    stability: 60,
    treasury: 1000,
    gdp: 25000,
    inflation: 3,
    militaryReadiness: 75,
    nuclearThreshold: 10,
    diplomaticInfluence: 60,
    popularity: 55,
    allianceCredibility: 70,
    techLevel: 80,
    ...overrides,
  };
}

function createTestAction(overrides?: Partial<AIAction>): AIAction {
  return {
    id: 'test_action',
    category: 'diplomatic',
    name: 'Test Action',
    description: 'A test action for unit testing.',
    baseUtility: 50,
    riskLevel: 20,
    isExtreme: false,
    categoryWeights: { diplomatic: 60 },
    estimatedImpact: { diplomaticInfluence: 5 },
    ...overrides,
  };
}

function createTestWeights(overrides?: Partial<UtilityWeights>): UtilityWeights {
  return {
    aggression: 50,
    economicFocus: 50,
    diplomaticPreference: 50,
    riskTolerance: 50,
    domesticPriority: 50,
    ...overrides,
  };
}

function createTestContext(overrides?: Partial<AIEvaluationContext>): AIEvaluationContext {
  return {
    factionId: FactionId.US,
    nationState: createTestNationState(),
    leaderProfile: createTestLeaderProfile(),
    emotionalState: createTestEmotionalState(),
    weights: createTestWeights(),
    difficulty: 'balanced',
    rng: new SeededRandom(42),
    tensions: {
      [FactionId.US]: 0,
      [FactionId.China]: 40,
      [FactionId.Russia]: 60,
      [FactionId.Japan]: -20,
      [FactionId.Iran]: 50,
      [FactionId.DPRK]: 70,
      [FactionId.EU]: -10,
      [FactionId.Syria]: 30,
    },
    candidateActions: [
      createTestAction({ id: 'diplomatic_summit', category: 'diplomatic', baseUtility: 45, riskLevel: 5 }),
      createTestAction({ id: 'military_deployment', category: 'military', baseUtility: 35, riskLevel: 50, categoryWeights: { military: 80 } }),
      createTestAction({ id: 'economic_stimulus', category: 'economic', baseUtility: 50, riskLevel: 15, categoryWeights: { economic: 90, domestic: 40 } }),
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('UtilityEvaluator', () => {
  // ── deriveWeightsFromProfile ────────────────────────────

  describe('deriveWeightsFromProfile', () => {
    it('high aggression profile yields high aggression weight', () => {
      const psychology = createTestPsychology({
        patience: 10,       // low patience → high (100-10)*0.4 = 36
        vengefulIndex: 90,  // high vengeful → 90*0.3 = 27
        riskTolerance: 80,  // high risk → 80*0.3 = 24
      });
      const weights = UtilityEvaluator.deriveWeightsFromProfile(psychology);
      // aggression = 36 + 27 + 24 = 87
      expect(weights.aggression).toBeCloseTo(87, 1);
      expect(weights.aggression).toBeGreaterThan(70);
    });

    it('patient analytical profile yields high economic/diplomatic, low aggression', () => {
      const psychology = createTestPsychology({
        patience: 90,
        pragmatism: 80,
        riskTolerance: 20,
        paranoia: 20,
        vengefulIndex: 10,
        narcissism: 20,
      });
      const weights = UtilityEvaluator.deriveWeightsFromProfile(psychology);

      // aggression = (100-90)*0.4 + 10*0.3 + 20*0.3 = 4+3+6 = 13
      expect(weights.aggression).toBeCloseTo(13, 1);
      // economicFocus = 80*0.5 + 90*0.3 + (100-20)*0.2 = 40+27+16 = 83
      expect(weights.economicFocus).toBeCloseTo(83, 1);
      // diplomaticPreference = 80*0.4 + 90*0.3 + (100-20)*0.3 = 32+27+24 = 83
      expect(weights.diplomaticPreference).toBeCloseTo(83, 1);
      expect(weights.aggression).toBeLessThan(weights.economicFocus);
      expect(weights.aggression).toBeLessThan(weights.diplomaticPreference);
    });

    it('balanced profile yields moderate weights', () => {
      const psychology = createTestPsychology({
        patience: 50,
        vengefulIndex: 50,
        riskTolerance: 50,
        pragmatism: 50,
        paranoia: 50,
        narcissism: 50,
      });
      const weights = UtilityEvaluator.deriveWeightsFromProfile(psychology);

      // aggression = (100-50)*0.4 + 50*0.3 + 50*0.3 = 20+15+15 = 50
      expect(weights.aggression).toBeCloseTo(50, 1);
      // economicFocus = 50*0.5 + 50*0.3 + (100-50)*0.2 = 25+15+10 = 50
      expect(weights.economicFocus).toBeCloseTo(50, 1);
      // diplomaticPreference = 50*0.4 + 50*0.3 + (100-50)*0.3 = 20+15+15 = 50
      expect(weights.diplomaticPreference).toBeCloseTo(50, 1);
      // domesticPriority = (100-50)*0.3 + 50*0.4 + 50*0.3 = 15+20+15 = 50
      expect(weights.domesticPriority).toBeCloseTo(50, 1);
    });

    it('all values are clamped 0–100', () => {
      // Extreme low values
      const psychologyLow = createTestPsychology({
        patience: 100,
        vengefulIndex: 0,
        riskTolerance: 0,
        pragmatism: 0,
        paranoia: 100,
        narcissism: 100,
      });
      const weightsLow = UtilityEvaluator.deriveWeightsFromProfile(psychologyLow);
      expect(weightsLow.aggression).toBeGreaterThanOrEqual(0);
      expect(weightsLow.economicFocus).toBeGreaterThanOrEqual(0);
      expect(weightsLow.diplomaticPreference).toBeGreaterThanOrEqual(0);
      expect(weightsLow.domesticPriority).toBeGreaterThanOrEqual(0);

      // Extreme high values
      const psychologyHigh = createTestPsychology({
        patience: 0,
        vengefulIndex: 100,
        riskTolerance: 100,
        pragmatism: 100,
        paranoia: 0,
        narcissism: 0,
      });
      const weightsHigh = UtilityEvaluator.deriveWeightsFromProfile(psychologyHigh);
      expect(weightsHigh.aggression).toBeLessThanOrEqual(100);
      expect(weightsHigh.economicFocus).toBeLessThanOrEqual(100);
      expect(weightsHigh.diplomaticPreference).toBeLessThanOrEqual(100);
      expect(weightsHigh.domesticPriority).toBeLessThanOrEqual(100);
    });
  });

  // ── isInDesperationMode ────────────────────────────────

  describe('isInDesperationMode', () => {
    it('stability 19 → true', () => {
      expect(UtilityEvaluator.isInDesperationMode(19)).toBe(true);
    });

    it('stability 20 → false (threshold is strict <20)', () => {
      expect(UtilityEvaluator.isInDesperationMode(20)).toBe(false);
    });

    it('stability 0 → true', () => {
      expect(UtilityEvaluator.isInDesperationMode(0)).toBe(true);
    });

    it('stability 100 → false', () => {
      expect(UtilityEvaluator.isInDesperationMode(100)).toBe(false);
    });
  });

  // ── applyDifficultyScaling ─────────────────────────────

  describe('applyDifficultyScaling', () => {
    it('cautious scales down aggression and risk tolerance', () => {
      const weights = createTestWeights({ aggression: 60, riskTolerance: 60 });
      const scaled = UtilityEvaluator.applyDifficultyScaling(weights, 'cautious');

      // cautious: aggression * 0.5, riskTolerance * 0.5
      expect(scaled.aggression).toBeCloseTo(30, 1);
      expect(scaled.riskTolerance).toBeCloseTo(30, 1);
      // Other weights unchanged
      expect(scaled.economicFocus).toBe(weights.economicFocus);
      expect(scaled.diplomaticPreference).toBe(weights.diplomaticPreference);
      expect(scaled.domesticPriority).toBe(weights.domesticPriority);
    });

    it('balanced returns same values', () => {
      const weights = createTestWeights({ aggression: 60, riskTolerance: 60 });
      const scaled = UtilityEvaluator.applyDifficultyScaling(weights, 'balanced');

      expect(scaled.aggression).toBeCloseTo(60, 1);
      expect(scaled.riskTolerance).toBeCloseTo(60, 1);
    });

    it('aggressive scales up aggression and risk tolerance', () => {
      const weights = createTestWeights({ aggression: 60, riskTolerance: 60 });
      const scaled = UtilityEvaluator.applyDifficultyScaling(weights, 'aggressive');

      // aggressive: aggression * 1.5, riskTolerance * 1.5
      expect(scaled.aggression).toBeCloseTo(90, 1);
      expect(scaled.riskTolerance).toBeCloseTo(90, 1);
    });
  });

  // ── applyEmotionalModifiers ────────────────────────────

  describe('applyEmotionalModifiers', () => {
    it('high anger boosts military actions', () => {
      const action = createTestAction({ category: 'military', categoryWeights: { military: 80 } });
      const emotions = createTestEmotionalState({ anger: 100, fear: 0, confidence: 0, stress: 0, resolve: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // multiplier = 1 + (100/100)*0.20 = 1.20
      expect(result).toBeCloseTo(120, 1);
    });

    it('high fear boosts domestic actions', () => {
      const action = createTestAction({ category: 'domestic', categoryWeights: { domestic: 80 } });
      const emotions = createTestEmotionalState({ fear: 100, anger: 0, confidence: 0, stress: 0, resolve: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // multiplier = 1 + (100/100)*0.15 = 1.15
      expect(result).toBeCloseTo(115, 1);
    });

    it('high confidence boosts aggressive actions (military/nuclear/grey-zone)', () => {
      const action = createTestAction({ category: 'nuclear', categoryWeights: { nuclear: 90 } });
      const emotions = createTestEmotionalState({ confidence: 100, anger: 0, fear: 0, stress: 0, resolve: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // multiplier = 1 + (100/100)*0.10 = 1.10
      expect(result).toBeCloseTo(110, 1);
    });

    it('neutral emotions produce minimal modification', () => {
      const action = createTestAction({ category: 'economic', categoryWeights: { economic: 80 } });
      const emotions = createTestEmotionalState({ anger: 0, fear: 0, confidence: 0, stress: 0, resolve: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // No emotional modifiers apply to economic category (no anger/fear/confidence boost)
      expect(result).toBeCloseTo(100, 1);
    });

    it('high stress penalises intelligence actions', () => {
      const action = createTestAction({ category: 'intelligence', categoryWeights: { intelligence: 80 } });
      const emotions = createTestEmotionalState({ stress: 100, anger: 0, fear: 0, confidence: 0, resolve: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // multiplier = 1 - (100/100)*0.10 = 0.90
      expect(result).toBeCloseTo(90, 1);
    });

    it('resolve boosts extreme actions', () => {
      const action = createTestAction({ isExtreme: true, category: 'military', categoryWeights: { military: 80 } });
      const emotions = createTestEmotionalState({ resolve: 100, anger: 0, fear: 0, confidence: 0, stress: 0 });

      const result = UtilityEvaluator.applyEmotionalModifiers(100, action, emotions);
      // multiplier = 1 + (100/100)*0.08 = 1.08 (resolve) + anger/confidence for military
      // military → anger(0) + confidence(0) = no boost, just resolve
      expect(result).toBeCloseTo(108, 1);
    });
  });

  // ── applyDesperationModifiers ──────────────────────────

  describe('applyDesperationModifiers', () => {
    it('nuclear actions get bigger boost than other extreme actions', () => {
      const stability = 5; // gap = 20 - 5 = 15
      const nuclearAction = createTestAction({ category: 'nuclear', isExtreme: true });
      const extremeAction = createTestAction({ category: 'military', isExtreme: true });

      const nuclearResult = UtilityEvaluator.applyDesperationModifiers(50, nuclearAction, stability);
      const extremeResult = UtilityEvaluator.applyDesperationModifiers(50, extremeAction, stability);

      // nuclear: 50 + 15*5 = 125
      expect(nuclearResult).toBeCloseTo(125, 1);
      // extreme: 50 + 15*3 = 95
      expect(extremeResult).toBeCloseTo(95, 1);
      expect(nuclearResult).toBeGreaterThan(extremeResult);
    });

    it('diplomatic actions (non-extreme) are penalised in desperation', () => {
      const stability = 10; // gap = 20 - 10 = 10
      const diplomaticAction = createTestAction({ category: 'diplomatic', isExtreme: false });

      const result = UtilityEvaluator.applyDesperationModifiers(50, diplomaticAction, stability);
      // 50 - 50*0.30 = 35
      expect(result).toBeCloseTo(35, 1);
    });

    it('normal stability (≥20) → method still computes but zero gap means no change', () => {
      const stability = 20; // gap = 20 - 20 = 0
      const nuclearAction = createTestAction({ category: 'nuclear', isExtreme: true });

      const result = UtilityEvaluator.applyDesperationModifiers(50, nuclearAction, stability);
      // 50 + 0*5 = 50
      expect(result).toBeCloseTo(50, 1);
    });

    it('stability < 20 boosts extreme actions', () => {
      const stability = 10; // gap = 10
      const action = createTestAction({ category: 'military', isExtreme: true });

      const result = UtilityEvaluator.applyDesperationModifiers(50, action, stability);
      // 50 + 10*3 = 80
      expect(result).toBeCloseTo(80, 1);
    });

    it('actions with extremeThreshold only available via evaluate() filtering', () => {
      // extremeThreshold is handled in evaluate(), not applyDesperationModifiers
      // Verify the modifier itself just applies the bonus based on category
      const stability = 5;
      const action = createTestAction({
        category: 'military',
        isExtreme: true,
        extremeThreshold: 40,
      });

      const result = UtilityEvaluator.applyDesperationModifiers(50, action, stability);
      // gap = 15, extreme bonus = 15*3 = 45
      expect(result).toBeCloseTo(95, 1);
    });
  });

  // ── applyDecisionNoise ─────────────────────────────────

  describe('applyDecisionNoise', () => {
    it('Analytical has low noise range', () => {
      const rng = new SeededRandom(42);
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Analytical, rng));
      }
      const maxDev = Math.max(...results.map((r) => Math.abs(r - 100)));
      // Analytical ±5% → most deviations should be under 10 (2σ)
      expect(maxDev).toBeLessThan(15);
    });

    it('Intuitive has higher noise range than Analytical', () => {
      const rngA = new SeededRandom(42);
      const rngI = new SeededRandom(42);

      // Since Intuitive has ±15% vs Analytical ±5%, over many samples
      // Intuitive will show greater variance
      const analyticalResults: number[] = [];
      const intuitiveResults: number[] = [];
      for (let i = 0; i < 200; i++) {
        analyticalResults.push(UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Analytical, rngA));
        intuitiveResults.push(UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Intuitive, rngI));
      }

      const analyticalVariance = variance(analyticalResults);
      const intuitiveVariance = variance(intuitiveResults);
      expect(intuitiveVariance).toBeGreaterThan(analyticalVariance);
    });

    it('same seed produces same noise', () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);

      const result1 = UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Transactional, rng1);
      const result2 = UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Transactional, rng2);

      expect(result1).toBe(result2);
    });

    it('score stays in reasonable range', () => {
      const rng = new SeededRandom(99);
      for (let i = 0; i < 500; i++) {
        const result = UtilityEvaluator.applyDecisionNoise(100, DecisionStyle.Intuitive, rng);
        // With base=100 and ±15% Gaussian, practically never exceeds ±50%
        expect(result).toBeGreaterThan(50);
        expect(result).toBeLessThan(150);
      }
    });
  });

  // ── Full evaluate() ────────────────────────────────────

  describe('evaluate', () => {
    it('selects highest-utility action', () => {
      const ctx = createTestContext();
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.selectedAction).toBeDefined();
      // The selected action should be the same as the first ranked action
      expect(result.selectedAction.id).toBe(result.rankedActions[0]!.action.id);
    });

    it('returns all actions ranked in descending score order', () => {
      const ctx = createTestContext();
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.rankedActions.length).toBe(ctx.candidateActions.length);
      for (let i = 1; i < result.rankedActions.length; i++) {
        expect(result.rankedActions[i - 1]!.finalScore)
          .toBeGreaterThanOrEqual(result.rankedActions[i]!.finalScore);
      }
    });

    it('desperation mode activates when stability < 20', () => {
      const ctx = createTestContext({
        nationState: createTestNationState({ stability: 10 }),
      });
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.desperationMode).toBe(true);
    });

    it('desperation mode is false when stability >= 20', () => {
      const ctx = createTestContext({
        nationState: createTestNationState({ stability: 60 }),
      });
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.desperationMode).toBe(false);
    });

    it('debug mode populates utilityLog', () => {
      const ctx = createTestContext({ debug: true });
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.utilityLog.length).toBeGreaterThan(0);
      // Should have context entry + entries for each action
      const contextEntries = result.utilityLog.filter((e) => e.actionId === '*');
      expect(contextEntries.length).toBeGreaterThan(0);
    });

    it('non-debug mode has empty utilityLog', () => {
      const ctx = createTestContext({ debug: false });
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.utilityLog.length).toBe(0);
    });

    it('actions with extremeThreshold filtered when stability is high', () => {
      const extremeAction = createTestAction({
        id: 'nuclear_posturing',
        category: 'nuclear',
        isExtreme: true,
        extremeThreshold: 30,
        baseUtility: 80,
        riskLevel: 70,
      });
      const normalAction = createTestAction({
        id: 'trade_deal',
        category: 'diplomatic',
        baseUtility: 50,
        riskLevel: 10,
      });

      const ctx = createTestContext({
        nationState: createTestNationState({ stability: 60 }),
        candidateActions: [extremeAction, normalAction],
      });
      const result = UtilityEvaluator.evaluate(ctx);

      // Nuclear action should be filtered out (stability 60 > threshold 30)
      const actionIds = result.rankedActions.map((r) => r.action.id);
      expect(actionIds).not.toContain('nuclear_posturing');
      expect(actionIds).toContain('trade_deal');
    });

    it('actions with extremeThreshold are available when stability is below threshold', () => {
      const extremeAction = createTestAction({
        id: 'nuclear_posturing',
        category: 'nuclear',
        isExtreme: true,
        extremeThreshold: 30,
        baseUtility: 80,
        riskLevel: 70,
      });
      const normalAction = createTestAction({
        id: 'trade_deal',
        category: 'diplomatic',
        baseUtility: 50,
        riskLevel: 10,
      });

      const ctx = createTestContext({
        nationState: createTestNationState({ stability: 15 }),
        candidateActions: [extremeAction, normalAction],
      });
      const result = UtilityEvaluator.evaluate(ctx);

      const actionIds = result.rankedActions.map((r) => r.action.id);
      expect(actionIds).toContain('nuclear_posturing');
    });

    it('different personality weights produce different rankings', () => {
      const aggressiveWeights = createTestWeights({ aggression: 90, diplomaticPreference: 10 });
      const diplomaticWeights = createTestWeights({ aggression: 10, diplomaticPreference: 90 });

      const actions = [
        createTestAction({ id: 'military_strike', category: 'military', baseUtility: 50, riskLevel: 40, categoryWeights: { military: 90 } }),
        createTestAction({ id: 'peace_summit', category: 'diplomatic', baseUtility: 50, riskLevel: 5, categoryWeights: { diplomatic: 90 } }),
      ];

      const aggressiveCtx = createTestContext({
        weights: aggressiveWeights,
        candidateActions: actions,
      });
      const diplomaticCtx = createTestContext({
        weights: diplomaticWeights,
        candidateActions: actions,
        rng: new SeededRandom(42), // Same seed for determinism
      });

      const aggressiveResult = UtilityEvaluator.evaluate(aggressiveCtx);
      const diplomaticResult = UtilityEvaluator.evaluate(diplomaticCtx);

      expect(aggressiveResult.selectedAction.id).toBe('military_strike');
      expect(diplomaticResult.selectedAction.id).toBe('peace_summit');
    });

    it('returns factionId from context', () => {
      const ctx = createTestContext({ factionId: FactionId.China });
      const result = UtilityEvaluator.evaluate(ctx);

      expect(result.factionId).toBe(FactionId.China);
    });

    it('each ranked action has a complete score breakdown', () => {
      const ctx = createTestContext();
      const result = UtilityEvaluator.evaluate(ctx);

      for (const scored of result.rankedActions) {
        expect(scored.breakdown).toBeDefined();
        expect(typeof scored.breakdown.baseUtility).toBe('number');
        expect(typeof scored.breakdown.personalityModifier).toBe('number');
        expect(typeof scored.breakdown.emotionalModifier).toBe('number');
        expect(typeof scored.breakdown.desperationModifier).toBe('number');
        expect(typeof scored.breakdown.difficultyModifier).toBe('number');
        expect(typeof scored.breakdown.noiseModifier).toBe('number');
        expect(typeof scored.breakdown.riskPenalty).toBe('number');
        expect(typeof scored.breakdown.totalScore).toBe('number');
      }
    });

    it('throws when candidateActions is empty', () => {
      const ctx = createTestContext({ candidateActions: [] });
      expect(() => UtilityEvaluator.evaluate(ctx)).toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────

function variance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
}
