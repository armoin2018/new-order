import { describe, it, expect } from 'vitest';
import { AllianceEvaluator } from '@/engine/alliance-evaluator';
import { SeededRandom } from '@/engine/rng';
import { FactionId, DecisionStyle, StressResponse } from '@/data/types';

import type { AllianceObligationContext, DefensePact } from '@/engine/alliance-evaluator';
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

function createTestPact(overrides?: Partial<DefensePact>): DefensePact {
  return {
    factionA: FactionId.US,
    factionB: FactionId.Japan,
    strength: 80,
    formal: true,
    ...overrides,
  };
}

function createTestAllianceContext(
  overrides?: Partial<AllianceObligationContext>,
): AllianceObligationContext {
  return {
    evaluatingFaction: FactionId.US,
    allyFaction: FactionId.Japan,
    attackerFaction: FactionId.China,
    pact: createTestPact(),
    evaluatingNationState: createTestNationState(),
    leaderProfile: createTestLeaderProfile(),
    emotionalState: createTestEmotionalState(),
    tensions: {
      [FactionId.US]: 0,
      [FactionId.China]: 60,
      [FactionId.Russia]: 40,
      [FactionId.Japan]: -30,
      [FactionId.Iran]: 50,
      [FactionId.DPRK]: 70,
      [FactionId.EU]: -20,
      [FactionId.Syria]: 20,
    },
    militaryReadiness: 80,
    rng: new SeededRandom(42),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('AllianceEvaluator', () => {
  // ── evaluate ───────────────────────────────────────────

  describe('evaluate', () => {
    it('strong pact + low war cost → honors pact', () => {
      const ctx = createTestAllianceContext({
        pact: createTestPact({ strength: 90, formal: true }),
        militaryReadiness: 90,
        evaluatingNationState: createTestNationState({ stability: 80, treasury: 2000, allianceCredibility: 90 }),
      });
      const result = AllianceEvaluator.evaluate(ctx);
      expect(result.willHonor).toBe(true);
    });

    it('weak pact + high war cost → breaks pact', () => {
      const ctx = createTestAllianceContext({
        pact: createTestPact({ strength: 10, formal: false }),
        militaryReadiness: 20,
        evaluatingNationState: createTestNationState({
          stability: 25,
          treasury: 200,
          allianceCredibility: 10,
        }),
        emotionalState: createTestEmotionalState({ anger: 0, resolve: 0, fear: 80 }),
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            riskTolerance: 20,
            patience: 80,
            stressResponse: StressResponse.Retreat,
          }),
        }),
        tensions: {
          [FactionId.US]: 0,
          [FactionId.China]: 10,
          [FactionId.Russia]: 10,
          [FactionId.Japan]: 0,
          [FactionId.Iran]: 10,
          [FactionId.DPRK]: 10,
          [FactionId.EU]: 10,
          [FactionId.Syria]: 10,
        },
      });
      const result = AllianceEvaluator.evaluate(ctx);
      expect(result.willHonor).toBe(false);
    });

    it('formal pact has higher credibility cost than informal', () => {
      const formalCtx = createTestAllianceContext({
        pact: createTestPact({ strength: 50, formal: true }),
      });
      const informalCtx = createTestAllianceContext({
        pact: createTestPact({ strength: 50, formal: false }),
      });
      const formalResult = AllianceEvaluator.evaluate(formalCtx);
      const informalResult = AllianceEvaluator.evaluate(informalCtx);

      // Formal adds 25 to credibility cost, informal adds 10
      expect(formalResult.analysis.credibilityCost)
        .toBeGreaterThan(informalResult.analysis.credibilityCost);
    });

    it('high alliance credibility → more likely to honor', () => {
      const highCredCtx = createTestAllianceContext({
        evaluatingNationState: createTestNationState({ allianceCredibility: 90 }),
      });
      const lowCredCtx = createTestAllianceContext({
        evaluatingNationState: createTestNationState({ allianceCredibility: 10 }),
      });
      const highResult = AllianceEvaluator.evaluate(highCredCtx);
      const lowResult = AllianceEvaluator.evaluate(lowCredCtx);

      // Higher credibility → higher credibility cost of breaking → more honorable
      expect(highResult.analysis.credibilityCost)
        .toBeGreaterThan(lowResult.analysis.credibilityCost);
    });

    it('low military readiness → less likely to honor', () => {
      const highReadyCtx = createTestAllianceContext({ militaryReadiness: 90 });
      const lowReadyCtx = createTestAllianceContext({ militaryReadiness: 20 });

      const highResult = AllianceEvaluator.evaluate(highReadyCtx);
      const lowResult = AllianceEvaluator.evaluate(lowReadyCtx);

      // Low readiness → high war cost → less net utility
      expect(lowResult.analysis.warCost).toBeGreaterThan(highResult.analysis.warCost);
    });

    it('low stability → less likely to honor (war cost higher)', () => {
      const stableCtx = createTestAllianceContext({
        evaluatingNationState: createTestNationState({ stability: 80 }),
      });
      const unstableCtx = createTestAllianceContext({
        evaluatingNationState: createTestNationState({ stability: 30 }),
      });

      const stableResult = AllianceEvaluator.evaluate(stableCtx);
      const unstableResult = AllianceEvaluator.evaluate(unstableCtx);

      // Low stability < 40 adds 30 to war cost
      expect(unstableResult.analysis.warCost).toBeGreaterThan(stableResult.analysis.warCost);
    });

    it('high anger toward attacker → more likely to honor', () => {
      const angryCtx = createTestAllianceContext({
        emotionalState: createTestEmotionalState({ anger: 90, fear: 0 }),
      });
      const calmCtx = createTestAllianceContext({
        emotionalState: createTestEmotionalState({ anger: 10, fear: 0 }),
      });

      const angryResult = AllianceEvaluator.evaluate(angryCtx);
      const calmResult = AllianceEvaluator.evaluate(calmCtx);

      // Anger contributes positively to emotional bias
      expect(angryResult.analysis.emotionalBias)
        .toBeGreaterThan(calmResult.analysis.emotionalBias);
    });

    it('high fear → less likely to honor', () => {
      const fearfulCtx = createTestAllianceContext({
        emotionalState: createTestEmotionalState({ fear: 90, anger: 0, resolve: 0 }),
      });
      const braveCtx = createTestAllianceContext({
        emotionalState: createTestEmotionalState({ fear: 0, anger: 0, resolve: 0 }),
      });

      const fearfulResult = AllianceEvaluator.evaluate(fearfulCtx);
      const braveResult = AllianceEvaluator.evaluate(braveCtx);

      // Fear contributes negatively to emotional bias
      expect(fearfulResult.analysis.emotionalBias)
        .toBeLessThan(braveResult.analysis.emotionalBias);
    });

    it('Escalate stress response → more likely to honor', () => {
      const escalateCtx = createTestAllianceContext({
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            stressResponse: StressResponse.Escalate,
          }),
        }),
      });
      const baseCtx = createTestAllianceContext({
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            stressResponse: StressResponse.Consolidate,
          }),
        }),
      });

      const escalateResult = AllianceEvaluator.evaluate(escalateCtx);
      const baseResult = AllianceEvaluator.evaluate(baseCtx);

      // Escalate adds +15 to personality factor
      expect(escalateResult.analysis.personalityFactor)
        .toBeGreaterThan(baseResult.analysis.personalityFactor);
    });

    it('Retreat stress response → less likely to honor', () => {
      const retreatCtx = createTestAllianceContext({
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            stressResponse: StressResponse.Retreat,
          }),
        }),
      });
      const baseCtx = createTestAllianceContext({
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            stressResponse: StressResponse.Consolidate,
          }),
        }),
      });

      const retreatResult = AllianceEvaluator.evaluate(retreatCtx);
      const baseResult = AllianceEvaluator.evaluate(baseCtx);

      // Retreat subtracts −15 from personality factor
      expect(retreatResult.analysis.personalityFactor)
        .toBeLessThan(baseResult.analysis.personalityFactor);
    });

    it('Transactional leader evaluates purely on numbers', () => {
      const ctx = createTestAllianceContext({
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            decisionStyle: DecisionStyle.Transactional,
            pragmatism: 30, // below threshold so no pragmatism modifier
            riskTolerance: 50,
            patience: 50,
            stressResponse: StressResponse.Consolidate,
          }),
        }),
      });

      const result = AllianceEvaluator.evaluate(ctx);
      // Transactional adds no numeric modifier — just a rationale note
      expect(result.rationaleChain.some((r) =>
        r.includes('Transactional'),
      )).toBe(true);
    });

    it('returns complete rationale chain', () => {
      const ctx = createTestAllianceContext();
      const result = AllianceEvaluator.evaluate(ctx);

      expect(result.rationaleChain.length).toBeGreaterThan(0);
      // Should have war cost, credibility cost, diplomatic fallout, etc.
      expect(result.rationaleChain.some((r) => r.includes('War Cost'))).toBe(true);
      expect(result.rationaleChain.some((r) => r.includes('Credibility Cost'))).toBe(true);
      expect(result.rationaleChain.some((r) => r.includes('Diplomatic Fallout'))).toBe(true);
      expect(result.rationaleChain.some((r) => r.includes('Net Utility'))).toBe(true);
      expect(result.rationaleChain.some((r) => r.includes('Decision:'))).toBe(true);
    });

    it('confidence reflects margin of decision (abs(netUtility) capped at 100)', () => {
      // Strong honor case → high net utility → high confidence (capped at 100)
      const strongCtx = createTestAllianceContext({
        pact: createTestPact({ strength: 100, formal: true }),
        evaluatingNationState: createTestNationState({ stability: 90, treasury: 5000, allianceCredibility: 100 }),
        militaryReadiness: 95,
      });
      const strongResult = AllianceEvaluator.evaluate(strongCtx);
      expect(strongResult.confidence).toBe(100); // Very high margin → capped at 100

      // Near-zero net utility → low confidence
      // Tune war cost ≈ credibility cost so net utility ≈ 0
      const borderlineCtx = createTestAllianceContext({
        pact: createTestPact({ strength: 20, formal: false }),
        militaryReadiness: 60,
        evaluatingNationState: createTestNationState({
          stability: 50,
          treasury: 600,
          allianceCredibility: 20,
        }),
        emotionalState: createTestEmotionalState({ anger: 0, fear: 0, resolve: 0 }),
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            riskTolerance: 50,
            patience: 50,
            pragmatism: 30,
            stressResponse: StressResponse.Consolidate,
          }),
        }),
        // No friendly factions watching → low diplomatic fallout
        tensions: {
          [FactionId.US]: 0,
          [FactionId.China]: 10,
          [FactionId.Russia]: 10,
          [FactionId.Japan]: 10,
          [FactionId.Iran]: 10,
          [FactionId.DPRK]: 10,
          [FactionId.EU]: 10,
          [FactionId.Syria]: 10,
        },
      });
      const borderlineResult = AllianceEvaluator.evaluate(borderlineCtx);
      expect(borderlineResult.confidence).toBeLessThan(strongResult.confidence);
    });
  });

  // ── calculateWarCost ───────────────────────────────────

  describe('calculateWarCost', () => {
    it('low readiness → high war cost', () => {
      const nationState = createTestNationState({ stability: 80, treasury: 2000 });
      const cost = AllianceEvaluator.calculateWarCost(nationState, 20);
      // (100-20)*0.3 + 0 + 0 = 24
      expect(cost).toBeCloseTo(24, 1);
    });

    it('low stability adds penalty', () => {
      const nationState = createTestNationState({ stability: 30, treasury: 2000 });
      const costLow = AllianceEvaluator.calculateWarCost(nationState, 50);
      // (100-50)*0.3 + 30 + 0 = 15 + 30 = 45
      expect(costLow).toBeCloseTo(45, 1);

      const nationStateStable = createTestNationState({ stability: 60, treasury: 2000 });
      const costStable = AllianceEvaluator.calculateWarCost(nationStateStable, 50);
      // (100-50)*0.3 + 0 + 0 = 15
      expect(costStable).toBeCloseTo(15, 1);
      expect(costLow).toBeGreaterThan(costStable);
    });

    it('low treasury adds penalty', () => {
      const nationState = createTestNationState({ stability: 80, treasury: 300 });
      const cost = AllianceEvaluator.calculateWarCost(nationState, 50);
      // (100-50)*0.3 + 0 + 20 = 15 + 20 = 35
      expect(cost).toBeCloseTo(35, 1);
    });
  });

  // ── calculateCredibilityCost ───────────────────────────

  describe('calculateCredibilityCost', () => {
    it('strong pact → high credibility cost', () => {
      const pact = createTestPact({ strength: 90, formal: true });
      const cost = AllianceEvaluator.calculateCredibilityCost(pact, 80);
      // 90*0.5 + 25 + 80*0.2 = 45 + 25 + 16 = 86
      expect(cost).toBeCloseTo(86, 1);
    });

    it('formal pact → higher than informal', () => {
      const formalPact = createTestPact({ strength: 50, formal: true });
      const informalPact = createTestPact({ strength: 50, formal: false });

      const formalCost = AllianceEvaluator.calculateCredibilityCost(formalPact, 50);
      const informalCost = AllianceEvaluator.calculateCredibilityCost(informalPact, 50);

      // formal: 50*0.5 + 25 + 50*0.2 = 25+25+10 = 60
      // informal: 50*0.5 + 10 + 50*0.2 = 25+10+10 = 45
      expect(formalCost).toBeCloseTo(60, 1);
      expect(informalCost).toBeCloseTo(45, 1);
      expect(formalCost).toBeGreaterThan(informalCost);
    });

    it('high alliance credibility → multiplier applies', () => {
      const pact = createTestPact({ strength: 50, formal: true });
      const highCred = AllianceEvaluator.calculateCredibilityCost(pact, 100);
      const lowCred = AllianceEvaluator.calculateCredibilityCost(pact, 10);

      // high: 50*0.5 + 25 + 100*0.2 = 25+25+20 = 70
      // low:  50*0.5 + 25 + 10*0.2  = 25+25+2  = 52
      expect(highCred).toBeCloseTo(70, 1);
      expect(lowCred).toBeCloseTo(52, 1);
      expect(highCred).toBeGreaterThan(lowCred);
    });
  });
});
