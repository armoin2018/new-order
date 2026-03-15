import { describe, it, expect } from 'vitest';
import { MBTIIntegrationEngine } from '@/engine/mbti-integration';
import type { MBTIDecisionWeights } from '@/engine/mbti-integration';
import type {
  FactionId,
  MBTITypeProfile,
  ExtendedLeaderProfile,
} from '@/data/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Te-dominant ENTJ — "The Commander" */
function makeENTJ(overrides: Partial<MBTITypeProfile> = {}): MBTITypeProfile {
  return {
    schemaVersion: '1.0.0',
    typeCode: 'ENTJ',
    typeName: 'The Commander',
    cognitiveStack: ['Te', 'Ni', 'Se', 'Fi'],
    strengthDomains: ['strategic execution', 'organizational leadership'],
    blindSpots: ['emotional nuance'],
    stressPattern: 'grip',
    decisionSpeed: 80,
    adaptability: 55,
    leadershipStyle: 'commanding',
    diplomaticApproach: 'transactional',
    conflictResponse: 'dominate',
    ...overrides,
  };
}

/** Fe-dominant ENFJ — "The Protagonist" */
function makeENFJ(overrides: Partial<MBTITypeProfile> = {}): MBTITypeProfile {
  return {
    schemaVersion: '1.0.0',
    typeCode: 'ENFJ',
    typeName: 'The Protagonist',
    cognitiveStack: ['Fe', 'Ni', 'Se', 'Ti'],
    strengthDomains: ['diplomacy', 'consensus building'],
    blindSpots: ['logical detachment'],
    stressPattern: 'grip',
    decisionSpeed: 65,
    adaptability: 70,
    leadershipStyle: 'diplomatic',
    diplomaticApproach: 'relational',
    conflictResponse: 'collaborate',
    ...overrides,
  };
}

/** INTJ — "The Architect" — Ni-dominant, complementary to ENFJ's Fe */
function makeINTJ(): MBTITypeProfile {
  return {
    schemaVersion: '1.0.0',
    typeCode: 'INTJ',
    typeName: 'The Architect',
    cognitiveStack: ['Ni', 'Te', 'Fi', 'Se'],
    strengthDomains: ['strategic planning', 'systems thinking'],
    blindSpots: ['emotional sensitivity'],
    stressPattern: 'grip',
    decisionSpeed: 35,
    adaptability: 40,
    leadershipStyle: 'visionary',
    diplomaticApproach: 'pragmatic',
    conflictResponse: 'collaborate',
  };
}

function makeLeader(overrides: Partial<ExtendedLeaderProfile> = {}): ExtendedLeaderProfile {
  return {
    schemaVersion: '1.0.0',
    leaderId: 'us-president',
    name: 'US President',
    factionId: 'us',
    mbtiType: 'ENTJ',
    psychology: {
      decisionStyle: 'analytical',
      stressResponse: 'escalate',
      riskTolerance: 65,
      paranoia: 40,
      narcissism: 55,
      pragmatism: 70,
      patience: 45,
      vengefulIndex: 30,
    },
    motivations: {
      primary: 'power',
      secondary: 'legacy',
    },
    powerBase: {
      source: 'popular',
      consolidation: 70,
      legitimacy: 80,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MBTIIntegrationEngine', () => {
  const engine = new MBTIIntegrationEngine();

  // ── computeDecisionWeights ────────────────────────────────────────────

  describe('computeDecisionWeights', () => {
    it('Te dominant → high economic and innovation weights', () => {
      const weights = engine.computeDecisionWeights(makeENTJ());

      // Te maps primary to economicWeight, secondary to innovationWeight
      // Plus commanding leadership → militaryWeight boost
      expect(weights.economicWeight).toBeGreaterThan(50);
      expect(weights.innovationWeight).toBeGreaterThan(50);
      expect(weights.aggressionWeight).toBeGreaterThan(50);
    });

    it('Fe dominant → high diplomacy and alliance weights', () => {
      const weights = engine.computeDecisionWeights(makeENFJ());

      // Fe maps primary to diplomacyWeight, secondary to allianceWeight
      expect(weights.diplomacyWeight).toBeGreaterThan(50);
      expect(weights.allianceWeight).toBeGreaterThan(50);
      // collaborate conflict response further reduces aggression
      expect(weights.aggressionWeight).toBeLessThan(50);
    });
  });

  // ── buildLeaderDecisionProfile ────────────────────────────────────────

  describe('buildLeaderDecisionProfile', () => {
    it('combines leader psychology + MBTI correctly', () => {
      const profile = engine.buildLeaderDecisionProfile(
        makeLeader(),
        makeENTJ(),
        'us' as FactionId,
      );

      expect(profile.leaderId).toBe('us-president');
      expect(profile.factionId).toBe('us');
      expect(profile.mbtiTypeCode).toBe('ENTJ');
      expect(profile.decisionWeights.riskTolerance).toBeGreaterThan(0);
      expect(profile.decisionWeights.riskTolerance).toBeLessThanOrEqual(1);
      expect(Object.keys(profile.biasModifiers).length).toBeGreaterThan(0);
      expect(profile.stressResponse.behavior).toBeTruthy();
    });
  });

  // ── evaluateAction ────────────────────────────────────────────────────

  describe('evaluateAction', () => {
    it('military action scored higher for high militaryWeight', () => {
      const weights: MBTIDecisionWeights = {
        allianceWeight: 50,
        aggressionWeight: 70,
        diplomacyWeight: 40,
        economicWeight: 60,
        militaryWeight: 85,
        innovationWeight: 55,
        riskTolerance: 0.7,
        timeHorizon: 'short',
      };

      const eval1 = engine.evaluateAction('attack-ops', 50, weights, 'military');
      const eval2 = engine.evaluateAction('trade-deal', 50, weights, 'diplomatic');

      // Military weight 85 > 50 → positive adjustment; diplomatic weight 40 < 50 → negative
      expect(eval1.finalScore).toBeGreaterThan(eval2.finalScore);
      expect(eval1.mbtiAdjustment).toBeGreaterThan(0);
    });

    it('final score is clamped to 0–100', () => {
      const weights: MBTIDecisionWeights = {
        allianceWeight: 100,
        aggressionWeight: 100,
        diplomacyWeight: 100,
        economicWeight: 100,
        militaryWeight: 100,
        innovationWeight: 100,
        riskTolerance: 1.0,
        timeHorizon: 'short',
      };

      const result = engine.evaluateAction('max-action', 95, weights, 'military');
      expect(result.finalScore).toBeLessThanOrEqual(100);
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ── computeCompatibility ──────────────────────────────────────────────

  describe('computeCompatibility', () => {
    it('complementary types get positive score', () => {
      // ENTJ (Te, Ni) + ENFJ (Fe, Ni): Te↔Fi not directly matched, but Ni shared
      // Let's use ENTJ (Te, Ni) + INFP (Fi, Ne): Te↔Fi complementary pair
      const infp: MBTITypeProfile = {
        schemaVersion: '1.0.0',
        typeCode: 'INFP',
        typeName: 'The Mediator',
        cognitiveStack: ['Fi', 'Ne', 'Si', 'Te'],
        strengthDomains: ['empathy', 'creativity'],
        blindSpots: ['practical execution'],
        stressPattern: 'grip',
        decisionSpeed: 30,
        adaptability: 75,
        leadershipStyle: 'servant',
        diplomaticApproach: 'principled',
        conflictResponse: 'avoid',
      };

      const result = engine.computeCompatibility(makeENTJ(), infp);

      // Te (ENTJ top-2) + Fi (INFP dominant) → complementary pair bonus
      expect(result.compatibilityScore).toBeGreaterThan(0);
      expect(result.cooperationBonus).toBeGreaterThan(0);
      expect(result.conflictPenalty).toBe(0);
    });

    it('conflicting types get negative score', () => {
      // Two Te-dominant types: ENTJ vs ESTJ
      const estj: MBTITypeProfile = {
        schemaVersion: '1.0.0',
        typeCode: 'ESTJ',
        typeName: 'The Executive',
        cognitiveStack: ['Te', 'Si', 'Ne', 'Fi'],
        strengthDomains: ['organization', 'logistics'],
        blindSpots: ['emotional awareness'],
        stressPattern: 'grip',
        decisionSpeed: 75,
        adaptability: 35,
        leadershipStyle: 'commanding',
        diplomaticApproach: 'transactional',
        conflictResponse: 'dominate',
      };

      const result = engine.computeCompatibility(makeENTJ(), estj);

      // Same Te dominant → conflicting pair −15 and same dominant non-perceiving −10
      expect(result.compatibilityScore).toBeLessThan(0);
      expect(result.conflictPenalty).toBeGreaterThan(0);
    });
  });

  // ── getStressResponse ─────────────────────────────────────────────────

  describe('getStressResponse', () => {
    it('grip pattern produces expected behavior changes for extraverted dominant', () => {
      // ENTJ: Te (extraverted) dominant + grip pattern
      const response = engine.getStressResponse(makeENTJ(), 80);

      expect(response.behavior).toContain('Grip stress');
      expect(response.behavior).toContain('withdrawn');
      // Extraverted dominant under grip → negative decision speed change
      expect(response.decisionSpeedChange).toBeLessThan(0);
      // Extraverted dominant under grip → reduced risk tolerance
      expect(response.riskToleranceChange).toBeLessThan(0);
    });

    it('grip pattern for introverted dominant produces opposite changes', () => {
      // INTJ: Ni (introverted) dominant + grip pattern
      const response = engine.getStressResponse(makeINTJ(), 80);

      expect(response.behavior).toContain('Grip stress');
      expect(response.behavior).toContain('impulsive');
      // Introverted dominant under grip → positive decision speed change (reactive)
      expect(response.decisionSpeedChange).toBeGreaterThan(0);
      expect(response.riskToleranceChange).toBeGreaterThan(0);
    });
  });

  // ── computeBiasModifiers ──────────────────────────────────────────────

  describe('computeBiasModifiers', () => {
    it('produces non-zero bias values', () => {
      const biases = engine.computeBiasModifiers(makeENTJ());

      expect(Object.keys(biases).length).toBeGreaterThan(0);
      // Te dominant → ConfirmationBias 15, SunkCost 10
      expect(biases['ConfirmationBias']).toBeGreaterThan(0);
      expect(biases['SunkCost']).toBeGreaterThan(0);

      // All biases are within 0–50 range
      for (const value of Object.values(biases)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(50);
      }
    });
  });

  // ── adjustForPersonality ──────────────────────────────────────────────

  describe('adjustForPersonality', () => {
    it('returns sorted by finalScore descending', () => {
      const weights: MBTIDecisionWeights = {
        allianceWeight: 50,
        aggressionWeight: 60,
        diplomacyWeight: 40,
        economicWeight: 70,
        militaryWeight: 80,
        innovationWeight: 55,
        riskTolerance: 0.6,
        timeHorizon: 'medium',
      };

      const actions = [
        { id: 'a1', score: 50, category: 'diplomatic' },
        { id: 'a2', score: 50, category: 'military' },
        { id: 'a3', score: 50, category: 'economic' },
      ];

      const evaluations = engine.adjustForPersonality(actions, weights);

      expect(evaluations.length).toBe(3);
      // Verify descending sort
      for (let i = 0; i < evaluations.length - 1; i++) {
        expect(evaluations[i].finalScore).toBeGreaterThanOrEqual(
          evaluations[i + 1].finalScore,
        );
      }
      // Military should be ranked highest (weight 80 → strongest positive adjustment)
      expect(evaluations[0].actionId).toBe('a2');
    });
  });
});
