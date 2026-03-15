import { describe, it, expect } from 'vitest';
import {
  STANDARD_AI_ACTIONS,
  AI_FACTION_CONFIGS,
  getAIFactionConfig,
  getStandardActions,
  evaluateFactionTurn,
} from '@/engine/ai-profiles';
import { SeededRandom } from '@/engine/rng';
import { FactionId, DecisionStyle, StressResponse } from '@/data/types';

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

function createBaseTensions(): Record<string, number> {
  return {
    [FactionId.US]: 0,
    [FactionId.China]: 40,
    [FactionId.Russia]: 60,
    [FactionId.Japan]: -20,
    [FactionId.Iran]: 50,
    [FactionId.DPRK]: 70,
    [FactionId.EU]: -10,
    [FactionId.Syria]: 30,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('AI Profiles & Action Catalog', () => {
  // ── STANDARD_AI_ACTIONS ────────────────────────────────

  describe('STANDARD_AI_ACTIONS', () => {
    it('contains exactly 22 actions', () => {
      expect(STANDARD_AI_ACTIONS).toHaveLength(22);
    });

    it('covers all 7 categories', () => {
      const categories = new Set(STANDARD_AI_ACTIONS.map((a) => a.category));
      expect(categories).toEqual(
        new Set(['diplomatic', 'military', 'economic', 'intelligence', 'domestic', 'nuclear', 'grey-zone']),
      );
    });

    it('extreme actions have isExtreme = true', () => {
      const extremeActions = STANDARD_AI_ACTIONS.filter((a) => a.isExtreme);
      expect(extremeActions.length).toBeGreaterThan(0);
      for (const action of extremeActions) {
        expect(action.isExtreme).toBe(true);
      }
    });

    it('nuclear actions have extremeThreshold', () => {
      const nuclearActions = STANDARD_AI_ACTIONS.filter((a) => a.category === 'nuclear');
      expect(nuclearActions.length).toBe(2);
      for (const action of nuclearActions) {
        expect(action.extremeThreshold).toBeDefined();
        expect(action.isExtreme).toBe(true);
      }
    });

    it('all actions have unique ids', () => {
      const ids = STANDARD_AI_ACTIONS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all base utilities are in valid range (0–100)', () => {
      for (const action of STANDARD_AI_ACTIONS) {
        expect(action.baseUtility).toBeGreaterThanOrEqual(0);
        expect(action.baseUtility).toBeLessThanOrEqual(100);
      }
    });

    it('all risk levels are in valid range (0–100)', () => {
      for (const action of STANDARD_AI_ACTIONS) {
        expect(action.riskLevel).toBeGreaterThanOrEqual(0);
        expect(action.riskLevel).toBeLessThanOrEqual(100);
      }
    });

    it('has expected category distribution', () => {
      const byCategory = new Map<string, number>();
      for (const action of STANDARD_AI_ACTIONS) {
        byCategory.set(action.category, (byCategory.get(action.category) ?? 0) + 1);
      }
      expect(byCategory.get('diplomatic')).toBe(4);
      expect(byCategory.get('military')).toBe(4);
      expect(byCategory.get('economic')).toBe(4);
      expect(byCategory.get('intelligence')).toBe(3);
      expect(byCategory.get('domestic')).toBe(3);
      expect(byCategory.get('nuclear')).toBe(2);
      expect(byCategory.get('grey-zone')).toBe(2);
    });
  });

  // ── AI_FACTION_CONFIGS ─────────────────────────────────

  describe('AI_FACTION_CONFIGS', () => {
    it('has all 8 factions', () => {
      const factions = Object.keys(AI_FACTION_CONFIGS);
      expect(factions).toHaveLength(8);
      expect(factions).toContain(FactionId.US);
      expect(factions).toContain(FactionId.China);
      expect(factions).toContain(FactionId.Russia);
      expect(factions).toContain(FactionId.Japan);
      expect(factions).toContain(FactionId.Iran);
      expect(factions).toContain(FactionId.DPRK);
      expect(factions).toContain(FactionId.EU);
      expect(factions).toContain(FactionId.Syria);
    });

    it('Trump (US): high aggression, high risk tolerance, Transactional', () => {
      const us = AI_FACTION_CONFIGS[FactionId.US];
      expect(us).toBeDefined();
      expect(us.leaderName).toBe('Donald Trump');
      expect(us.weights.aggression).toBeGreaterThanOrEqual(60);
      expect(us.weights.riskTolerance).toBeGreaterThanOrEqual(70);
      expect(us.decisionStyle).toBe(DecisionStyle.Transactional);
    });

    it('Xi (China): high economic focus, low risk tolerance, Analytical', () => {
      const china = AI_FACTION_CONFIGS[FactionId.China];
      expect(china).toBeDefined();
      expect(china.leaderName).toBe('Xi Jinping');
      expect(china.weights.economicFocus).toBeGreaterThanOrEqual(60);
      expect(china.weights.riskTolerance).toBeLessThanOrEqual(50);
      expect(china.decisionStyle).toBe(DecisionStyle.Analytical);
    });

    it('Takaichi (Japan): moderate aggression, Intuitive, Escalate', () => {
      const japan = AI_FACTION_CONFIGS[FactionId.Japan];
      expect(japan).toBeDefined();
      expect(japan.leaderName).toBe('Sanae Takaichi');
      expect(japan.weights.aggression).toBeGreaterThan(40);
      expect(japan.weights.aggression).toBeLessThan(70);
      expect(japan.decisionStyle).toBe(DecisionStyle.Intuitive);
      expect(japan.stressResponse).toBe(StressResponse.Escalate);
    });

    it('Iran: high domestic priority, Ideological, Consolidate', () => {
      const iran = AI_FACTION_CONFIGS[FactionId.Iran];
      expect(iran).toBeDefined();
      expect(iran.weights.domesticPriority).toBeGreaterThanOrEqual(60);
      expect(iran.decisionStyle).toBe(DecisionStyle.Ideological);
      expect(iran.stressResponse).toBe(StressResponse.Consolidate);
    });

    it('each faction has unique weights (not all identical)', () => {
      const configs = Object.values(AI_FACTION_CONFIGS);
      const weightStrings = configs.map((c) => JSON.stringify(c.weights));
      const uniqueWeights = new Set(weightStrings);
      // All 8 factions should have unique weight configurations
      expect(uniqueWeights.size).toBe(8);
    });

    it('each faction has behavioral notes', () => {
      for (const config of Object.values(AI_FACTION_CONFIGS)) {
        expect(config.behaviorNotes).toBeDefined();
        expect(config.behaviorNotes.length).toBeGreaterThan(0);
      }
    });

    it('all weight values are in valid range (0–100)', () => {
      for (const config of Object.values(AI_FACTION_CONFIGS)) {
        expect(config.weights.aggression).toBeGreaterThanOrEqual(0);
        expect(config.weights.aggression).toBeLessThanOrEqual(100);
        expect(config.weights.economicFocus).toBeGreaterThanOrEqual(0);
        expect(config.weights.economicFocus).toBeLessThanOrEqual(100);
        expect(config.weights.diplomaticPreference).toBeGreaterThanOrEqual(0);
        expect(config.weights.diplomaticPreference).toBeLessThanOrEqual(100);
        expect(config.weights.riskTolerance).toBeGreaterThanOrEqual(0);
        expect(config.weights.riskTolerance).toBeLessThanOrEqual(100);
        expect(config.weights.domesticPriority).toBeGreaterThanOrEqual(0);
        expect(config.weights.domesticPriority).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── getAIFactionConfig ─────────────────────────────────

  describe('getAIFactionConfig', () => {
    it('returns config for valid faction', () => {
      const config = getAIFactionConfig(FactionId.US);
      expect(config).toBeDefined();
      expect(config!.factionId).toBe(FactionId.US);
    });

    it('all 8 factions return defined configs', () => {
      for (const factionId of [
        FactionId.US,
        FactionId.China,
        FactionId.Russia,
        FactionId.Japan,
        FactionId.Iran,
        FactionId.DPRK,
        FactionId.EU,
        FactionId.Syria,
      ]) {
        expect(getAIFactionConfig(factionId)).toBeDefined();
      }
    });

    it('returns undefined for non-existent faction', () => {
      const config = getAIFactionConfig('nonexistent' as typeof FactionId.US);
      expect(config).toBeUndefined();
    });
  });

  // ── getStandardActions ─────────────────────────────────

  describe('getStandardActions', () => {
    it('returns readonly array', () => {
      const actions = getStandardActions();
      expect(actions).toBeDefined();
      // `as const` gives TypeScript-level readonly; verify the reference
      // is the same canonical array on every call.
      expect(actions).toBe(STANDARD_AI_ACTIONS);
    });

    it('returns all 22 actions', () => {
      const actions = getStandardActions();
      expect(actions).toHaveLength(22);
    });
  });

  // ── evaluateFactionTurn ────────────────────────────────

  describe('evaluateFactionTurn', () => {
    it('returns valid AIEvaluationResult', () => {
      const result = evaluateFactionTurn({
        factionId: FactionId.US,
        nationState: createTestNationState({ factionId: FactionId.US }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      expect(result).toBeDefined();
      expect(result.factionId).toBe(FactionId.US);
      expect(result.selectedAction).toBeDefined();
      expect(result.rankedActions.length).toBeGreaterThan(0);
      expect(typeof result.desperationMode).toBe('boolean');
    });

    it('uses faction-specific weights from AI_FACTION_CONFIGS', () => {
      const resultUS = evaluateFactionTurn({
        factionId: FactionId.US,
        nationState: createTestNationState({ factionId: FactionId.US }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      const resultChina = evaluateFactionTurn({
        factionId: FactionId.China,
        nationState: createTestNationState({ factionId: FactionId.China }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      // Different factions should have different top actions (likely)
      // At minimum, the scoring should differ
      const usTopScore = resultUS.rankedActions[0]!.finalScore;
      const chinaTopScore = resultChina.rankedActions[0]!.finalScore;
      // Scores should differ because different weights are applied
      expect(usTopScore).not.toBeCloseTo(chinaTopScore, 0);
    });

    it('different factions rank actions differently (Trump favors economic/aggression, Xi favors economic stability)', () => {
      const rng = new SeededRandom(42);
      const resultUS = evaluateFactionTurn({
        factionId: FactionId.US,
        nationState: createTestNationState({ factionId: FactionId.US }),
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            decisionStyle: DecisionStyle.Transactional,
          }),
        }),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng,
        tensions: createBaseTensions(),
      });

      const rng2 = new SeededRandom(42);
      const resultChina = evaluateFactionTurn({
        factionId: FactionId.China,
        nationState: createTestNationState({ factionId: FactionId.China }),
        leaderProfile: createTestLeaderProfile({
          psychology: createTestPsychology({
            decisionStyle: DecisionStyle.Analytical,
          }),
        }),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: rng2,
        tensions: createBaseTensions(),
      });

      // Both should produce valid ranked actions
      expect(resultUS.rankedActions.length).toBe(resultChina.rankedActions.length);

      // The rankings shouldn't be identical (different weights)
      const usRanking = resultUS.rankedActions.map((r) => r.action.id);
      const chinaRanking = resultChina.rankedActions.map((r) => r.action.id);
      // Not every position needs to differ, but the top 5 should show differences
      const topDiffers = usRanking.slice(0, 5).some(
        (id, i) => id !== chinaRanking[i],
      );
      expect(topDiffers).toBe(true);
    });

    it('works with all 4 MVP factions (US, China, Japan, Iran)', () => {
      const mvpFactions = [FactionId.US, FactionId.China, FactionId.Japan, FactionId.Iran] as const;

      for (const factionId of mvpFactions) {
        const result = evaluateFactionTurn({
          factionId,
          nationState: createTestNationState({ factionId }),
          leaderProfile: createTestLeaderProfile(),
          emotionalState: createTestEmotionalState(),
          difficulty: 'balanced',
          rng: new SeededRandom(42),
          tensions: createBaseTensions(),
        });

        expect(result.factionId).toBe(factionId);
        expect(result.selectedAction).toBeDefined();
        expect(result.rankedActions.length).toBeGreaterThan(0);
      }
    });

    it('handles desperation mode when stability < 20', () => {
      const result = evaluateFactionTurn({
        factionId: FactionId.Iran,
        nationState: createTestNationState({ factionId: FactionId.Iran, stability: 10 }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      expect(result.desperationMode).toBe(true);
      // In desperation mode, extreme actions with threshold <= stability
      // should be available and potentially boosted
      expect(result.rankedActions.length).toBeGreaterThan(0);
    });

    it('all ranked actions reference valid STANDARD_AI_ACTIONS ids', () => {
      const validIds = new Set(STANDARD_AI_ACTIONS.map((a) => a.id));

      const result = evaluateFactionTurn({
        factionId: FactionId.US,
        nationState: createTestNationState({ factionId: FactionId.US }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      for (const ranked of result.rankedActions) {
        expect(validIds.has(ranked.action.id)).toBe(true);
      }
    });

    it('filters extreme-threshold actions when stability is high', () => {
      const result = evaluateFactionTurn({
        factionId: FactionId.US,
        nationState: createTestNationState({ factionId: FactionId.US, stability: 80 }),
        leaderProfile: createTestLeaderProfile(),
        emotionalState: createTestEmotionalState(),
        difficulty: 'balanced',
        rng: new SeededRandom(42),
        tensions: createBaseTensions(),
      });

      // Actions with extremeThreshold (nuclear_posturing=30, tactical_nuclear=15,
      // emergency_martial_law=30, launch_strike=40) should be filtered at stability=80
      const actionIds = result.rankedActions.map((r) => r.action.id);
      expect(actionIds).not.toContain('nuclear_posturing');
      expect(actionIds).not.toContain('tactical_nuclear_deployment');
      expect(actionIds).not.toContain('emergency_martial_law');
      expect(actionIds).not.toContain('launch_strike');
    });
  });
});
