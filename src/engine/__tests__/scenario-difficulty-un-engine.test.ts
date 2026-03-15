import { describe, it, expect, beforeEach } from 'vitest';
import type { FactionId, TurnNumber } from '@/data/types';
import {
  UNResolutionType,
  AIDifficultyLevel,
} from '@/data/types';
import {
  ScenarioDifficultyUNEngine,
  type FactionVoteResult,
} from '@/engine/scenario-difficulty-un-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fid = (id: string) => id as FactionId;
const turn = (n: number) => n as TurnNumber;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioDifficultyUNEngine', () => {
  let engine: ScenarioDifficultyUNEngine;

  beforeEach(() => {
    engine = new ScenarioDifficultyUNEngine();
  });

  // =========================================================================
  // 1. listScenarios
  // =========================================================================

  describe('listScenarios', () => {
    it('returns empty list when no scenarios are available', () => {
      const result = engine.listScenarios({ availableIds: [] });

      expect(result.scenarios).toHaveLength(0);
      expect(result.defaultScenarioId).toBe('march-2026');
      expect(result.reason).toContain('0');
    });

    it('returns all scenarios when fewer than max', () => {
      const ids = ['alpha', 'bravo', 'charlie'];
      const result = engine.listScenarios({ availableIds: ids });

      expect(result.scenarios).toHaveLength(3);
      expect(result.scenarios.map((s) => s.id)).toEqual(ids);
    });

    it('returns exactly max scenarios when available count equals max', () => {
      const ids = Array.from({ length: 20 }, (_, i) => `scenario-${i}`);
      const result = engine.listScenarios({ availableIds: ids });

      expect(result.scenarios).toHaveLength(20);
    });

    it('caps at maxScenarioListSize when more than max are available', () => {
      const ids = Array.from({ length: 30 }, (_, i) => `scenario-${i}`);
      const result = engine.listScenarios({ availableIds: ids });

      expect(result.scenarios).toHaveLength(20);
      expect(result.reason).toContain('first 20');
      expect(result.reason).toContain('30');
    });

    it('marks the default scenario when it is present', () => {
      const ids = ['march-2026', 'alt-scenario'];
      const result = engine.listScenarios({ availableIds: ids });

      const defaultEntry = result.scenarios.find((s) => s.id === 'march-2026');
      expect(defaultEntry?.isDefault).toBe(true);

      const otherEntry = result.scenarios.find((s) => s.id === 'alt-scenario');
      expect(otherEntry?.isDefault).toBe(false);
    });

    it('marks no entry as default when the default is not in the list', () => {
      const ids = ['alt-1', 'alt-2'];
      const result = engine.listScenarios({ availableIds: ids });

      expect(result.scenarios.every((s) => !s.isDefault)).toBe(true);
      expect(result.defaultScenarioId).toBe('march-2026');
    });
  });

  // =========================================================================
  // 2. validateScenarioId
  // =========================================================================

  describe('validateScenarioId', () => {
    it('returns valid=true for a known scenario ID', () => {
      const result = engine.validateScenarioId({
        scenarioId: 'march-2026',
        availableIds: ['march-2026', 'alt-scenario'],
      });

      expect(result.valid).toBe(true);
      expect(result.scenarioId).toBe('march-2026');
      expect(result.reason).toContain('valid');
    });

    it('returns valid=false for an unknown scenario ID', () => {
      const result = engine.validateScenarioId({
        scenarioId: 'nonexistent',
        availableIds: ['march-2026', 'alt-scenario'],
      });

      expect(result.valid).toBe(false);
      expect(result.scenarioId).toBe('nonexistent');
      expect(result.reason).toContain('not found');
    });

    it('returns valid=false when available list is empty', () => {
      const result = engine.validateScenarioId({
        scenarioId: 'march-2026',
        availableIds: [],
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('0');
    });
  });

  // =========================================================================
  // 3. computeDifficultyScaling
  // =========================================================================

  describe('computeDifficultyScaling', () => {
    const baseParams = {
      baseRiskTolerance: 50,
      baseAggression: 50,
      baseEconomicFocus: 50,
      baseDiplomaticPreference: 50,
    };

    it('applies Cautious multipliers correctly', () => {
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Cautious,
        ...baseParams,
      });

      expect(result.difficulty).toBe(AIDifficultyLevel.Cautious);
      expect(result.scaledRiskTolerance).toBe(50 * GAME_CONFIG.aiDifficulty.cautious.riskToleranceMultiplier);
      expect(result.scaledAggression).toBe(50 * GAME_CONFIG.aiDifficulty.cautious.aggressionMultiplier);
      expect(result.scaledEconomicFocus).toBe(50 * GAME_CONFIG.aiDifficulty.cautious.economicFocusMultiplier);
      expect(result.scaledDiplomaticPreference).toBe(50 * GAME_CONFIG.aiDifficulty.cautious.diplomaticPreferenceMultiplier);
    });

    it('applies Balanced multipliers (identity ×1.0)', () => {
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Balanced,
        ...baseParams,
      });

      expect(result.scaledRiskTolerance).toBe(50);
      expect(result.scaledAggression).toBe(50);
      expect(result.scaledEconomicFocus).toBe(50);
      expect(result.scaledDiplomaticPreference).toBe(50);
    });

    it('applies Aggressive multipliers correctly', () => {
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Aggressive,
        ...baseParams,
      });

      expect(result.difficulty).toBe(AIDifficultyLevel.Aggressive);
      expect(result.scaledRiskTolerance).toBe(50 * GAME_CONFIG.aiDifficulty.aggressive.riskToleranceMultiplier);
      expect(result.scaledAggression).toBe(50 * GAME_CONFIG.aiDifficulty.aggressive.aggressionMultiplier);
      expect(result.scaledEconomicFocus).toBe(50 * GAME_CONFIG.aiDifficulty.aggressive.economicFocusMultiplier);
      expect(result.scaledDiplomaticPreference).toBe(50 * GAME_CONFIG.aiDifficulty.aggressive.diplomaticPreferenceMultiplier);
    });

    it('returns all zeros when base values are 0', () => {
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Aggressive,
        baseRiskTolerance: 0,
        baseAggression: 0,
        baseEconomicFocus: 0,
        baseDiplomaticPreference: 0,
      });

      expect(result.scaledRiskTolerance).toBe(0);
      expect(result.scaledAggression).toBe(0);
      expect(result.scaledEconomicFocus).toBe(0);
      expect(result.scaledDiplomaticPreference).toBe(0);
    });

    it('clamps at 100 when scaled value would exceed it', () => {
      // Aggressive: riskTolerance×1.5 → 100*1.5=150→100, aggression×1.8 → 100*1.8=180→100
      // economicFocus×0.7 → 70 (no clamp needed), diplomaticPref×0.6 → 60 (no clamp needed)
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Aggressive,
        baseRiskTolerance: 100,
        baseAggression: 100,
        baseEconomicFocus: 100,
        baseDiplomaticPreference: 100,
      });

      expect(result.scaledRiskTolerance).toBe(100);  // 150 clamped → 100
      expect(result.scaledAggression).toBe(100);      // 180 clamped → 100
      expect(result.scaledEconomicFocus).toBe(70);    // 70, no clamping
      expect(result.scaledDiplomaticPreference).toBe(60); // 60, no clamping
    });

    it('clamps scaled values that would exceed 100', () => {
      // Cautious economicFocus multiplier is 1.3 → 80 * 1.3 = 104 → clamped to 100
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Cautious,
        baseRiskTolerance: 80,
        baseAggression: 80,
        baseEconomicFocus: 80,
        baseDiplomaticPreference: 80,
      });

      expect(result.scaledEconomicFocus).toBe(100); // 80 * 1.3 = 104 → 100
    });

    it('includes the difficulty level in the reason string', () => {
      const result = engine.computeDifficultyScaling({
        difficulty: AIDifficultyLevel.Cautious,
        ...baseParams,
      });

      expect(result.reason).toContain('Cautious');
    });
  });

  // =========================================================================
  // 4. proposeResolution
  // =========================================================================

  describe('proposeResolution', () => {
    it('creates a Sanctions proposal', () => {
      const result = engine.proposeResolution({
        proposer: fid('usa'),
        target: fid('russia'),
        resolutionType: UNResolutionType.Sanctions,
        currentTurn: turn(5),
      });

      expect(result.proposer).toBe('usa');
      expect(result.target).toBe('russia');
      expect(result.resolutionType).toBe(UNResolutionType.Sanctions);
      expect(result.proposalTurn).toBe(5);
      expect(result.reason).toContain('Sanctions');
    });

    it('creates a Peacekeeping proposal', () => {
      const result = engine.proposeResolution({
        proposer: fid('eu'),
        target: fid('iran'),
        resolutionType: UNResolutionType.Peacekeeping,
        currentTurn: turn(10),
      });

      expect(result.proposer).toBe('eu');
      expect(result.target).toBe('iran');
      expect(result.resolutionType).toBe(UNResolutionType.Peacekeeping);
      expect(result.proposalTurn).toBe(10);
    });

    it('creates a Condemnation proposal', () => {
      const result = engine.proposeResolution({
        proposer: fid('china'),
        target: fid('usa'),
        resolutionType: UNResolutionType.Condemnation,
        currentTurn: turn(1),
      });

      expect(result.resolutionType).toBe(UNResolutionType.Condemnation);
      expect(result.proposalTurn).toBe(1);
      expect(result.reason).toContain('Condemnation');
    });
  });

  // =========================================================================
  // 5. computeFactionVote
  // =========================================================================

  describe('computeFactionVote', () => {
    const baseVoteInput = {
      proposer: fid('usa'),
      target: fid('russia'),
      resolutionType: UNResolutionType.Sanctions as UNResolutionType,
    };

    it('returns yea when utility is clearly positive', () => {
      const result = engine.computeFactionVote({
        voter: fid('eu'),
        ...baseVoteInput,
        relationshipWithProposer: 80,
        relationshipWithTarget: -60,
        strategicInterest: 50,
        legitimacyImpact: 40,
      });

      // utility = 0.3*80 + 0.3*60 + 0.2*50 + 0.2*40 = 24 + 18 + 10 + 8 = 60
      expect(result.vote).toBe('yea');
      expect(result.utilityScore).toBeCloseTo(60, 5);
      expect(result.voter).toBe('eu');
    });

    it('returns nay when utility is clearly negative', () => {
      const result = engine.computeFactionVote({
        voter: fid('china'),
        ...baseVoteInput,
        relationshipWithProposer: -80,
        relationshipWithTarget: 60,
        strategicInterest: -50,
        legitimacyImpact: -40,
      });

      // utility = 0.3*(-80) + 0.3*(-60) + 0.2*(-50) + 0.2*(-40) = -24 + -18 + -10 + -8 = -60
      expect(result.vote).toBe('nay');
      expect(result.utilityScore).toBeCloseTo(-60, 5);
    });

    it('returns abstain when utility is near zero', () => {
      const result = engine.computeFactionVote({
        voter: fid('india'),
        ...baseVoteInput,
        relationshipWithProposer: 0,
        relationshipWithTarget: 0,
        strategicInterest: 0,
        legitimacyImpact: 0,
      });

      expect(result.vote).toBe('abstain');
      expect(result.utilityScore).toBe(0);
    });

    it('returns abstain at exactly +5 threshold (not strictly greater)', () => {
      // Need utility = exactly 5
      // 0.3*a + 0.3*(-b) + 0.2*c + 0.2*d = 5
      // a=10, b=0, c=10, d=0 → 3 + 0 + 2 + 0 = 5
      const result = engine.computeFactionVote({
        voter: fid('japan'),
        ...baseVoteInput,
        relationshipWithProposer: 10,
        relationshipWithTarget: 0,
        strategicInterest: 10,
        legitimacyImpact: 0,
      });

      expect(result.utilityScore).toBeCloseTo(5, 10);
      expect(result.vote).toBe('abstain');
    });

    it('returns yea just above +5 threshold', () => {
      // 0.3*10 + 0.3*0 + 0.2*10 + 0.2*1 = 3 + 0 + 2 + 0.2 = 5.2
      const result = engine.computeFactionVote({
        voter: fid('japan'),
        ...baseVoteInput,
        relationshipWithProposer: 10,
        relationshipWithTarget: 0,
        strategicInterest: 10,
        legitimacyImpact: 1,
      });

      expect(result.utilityScore).toBeCloseTo(5.2, 10);
      expect(result.vote).toBe('yea');
    });

    it('returns abstain at exactly -5 threshold (not strictly less)', () => {
      // 0.3*(-10) + 0.3*0 + 0.2*(-10) + 0.2*0 = -3 + 0 + -2 + 0 = -5
      const result = engine.computeFactionVote({
        voter: fid('brazil'),
        ...baseVoteInput,
        relationshipWithProposer: -10,
        relationshipWithTarget: 0,
        strategicInterest: -10,
        legitimacyImpact: 0,
      });

      expect(result.utilityScore).toBeCloseTo(-5, 10);
      expect(result.vote).toBe('abstain');
    });

    it('returns nay just below -5 threshold', () => {
      // 0.3*(-10) + 0.3*0 + 0.2*(-10) + 0.2*(-1) = -3 + 0 + -2 + -0.2 = -5.2
      const result = engine.computeFactionVote({
        voter: fid('brazil'),
        ...baseVoteInput,
        relationshipWithProposer: -10,
        relationshipWithTarget: 0,
        strategicInterest: -10,
        legitimacyImpact: -1,
      });

      expect(result.utilityScore).toBeCloseTo(-5.2, 10);
      expect(result.vote).toBe('nay');
    });

    it('includes voter ID in the result', () => {
      const result = engine.computeFactionVote({
        voter: fid('turkey'),
        ...baseVoteInput,
        relationshipWithProposer: 0,
        relationshipWithTarget: 0,
        strategicInterest: 0,
        legitimacyImpact: 0,
      });

      expect(result.voter).toBe('turkey');
      expect(result.reason).toContain('turkey');
    });
  });

  // =========================================================================
  // 6. resolveVote
  // =========================================================================

  describe('resolveVote', () => {
    const makeVote = (
      voter: string,
      vote: 'yea' | 'nay' | 'abstain',
    ): FactionVoteResult => ({
      voter: fid(voter),
      vote,
      utilityScore: 0,
      reason: 'test',
    });

    const baseResolveInput = {
      proposer: fid('usa'),
      target: fid('russia'),
      resolutionType: UNResolutionType.Sanctions as UNResolutionType,
      currentTurn: turn(5),
    };

    it('passes when all votes are yea', () => {
      const votes = [
        makeVote('eu', 'yea'),
        makeVote('china', 'yea'),
        makeVote('india', 'yea'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(true);
      expect(result.yeaCount).toBe(3);
      expect(result.nayCount).toBe(0);
      expect(result.abstainCount).toBe(0);
    });

    it('fails when all votes are nay', () => {
      const votes = [
        makeVote('eu', 'nay'),
        makeVote('china', 'nay'),
        makeVote('india', 'nay'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(false);
      expect(result.yeaCount).toBe(0);
      expect(result.nayCount).toBe(3);
    });

    it('passes on a tie (yea/(yea+nay) = 0.5 >= threshold)', () => {
      const votes = [
        makeVote('eu', 'yea'),
        makeVote('china', 'nay'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(true);
      expect(result.yeaCount).toBe(1);
      expect(result.nayCount).toBe(1);
    });

    it('excludes abstentions from the denominator', () => {
      const votes = [
        makeVote('eu', 'yea'),
        makeVote('china', 'nay'),
        makeVote('india', 'abstain'),
        makeVote('japan', 'abstain'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      // yea/(yea+nay) = 1/2 = 0.5 >= 0.5 → passes
      expect(result.passed).toBe(true);
      expect(result.abstainCount).toBe(2);
    });

    it('fails when all votes are abstain (ratio = 0)', () => {
      const votes = [
        makeVote('eu', 'abstain'),
        makeVote('china', 'abstain'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(false);
      expect(result.yeaCount).toBe(0);
      expect(result.nayCount).toBe(0);
      expect(result.abstainCount).toBe(2);
    });

    it('applies Sanctions effects when passed', () => {
      const votes = [makeVote('eu', 'yea')];
      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(true);
      expect(result.effects.gdpGrowthPenalty).toBe(GAME_CONFIG.unResolutions.sanctions.gdpGrowthPenalty);
      expect(result.effects.tradeReduction).toBe(GAME_CONFIG.unResolutions.sanctions.tradeReduction);
      expect(result.effects.legitimacyPenalty).toBe(GAME_CONFIG.unResolutions.sanctions.legitimacyPenalty);
      // Non-applicable fields remain 0
      expect(result.effects.stabilityBonus).toBe(0);
      expect(result.effects.civilUnrestReduction).toBe(0);
      expect(result.effects.diPenalty).toBe(0);
      expect(result.effects.diCostToProposer).toBe(0);
    });

    it('applies Peacekeeping effects when passed', () => {
      const votes = [makeVote('eu', 'yea')];
      const result = engine.resolveVote({
        votes,
        proposer: fid('usa'),
        target: fid('iran'),
        resolutionType: UNResolutionType.Peacekeeping,
        currentTurn: turn(10),
      });

      expect(result.passed).toBe(true);
      expect(result.effects.stabilityBonus).toBe(GAME_CONFIG.unResolutions.peacekeeping.stabilityBonus);
      expect(result.effects.civilUnrestReduction).toBe(GAME_CONFIG.unResolutions.peacekeeping.civilUnrestReduction);
      expect(result.effects.diCostToProposer).toBe(GAME_CONFIG.unResolutions.peacekeeping.diCostToProposer);
      // Non-applicable fields remain 0
      expect(result.effects.gdpGrowthPenalty).toBe(0);
      expect(result.effects.tradeReduction).toBe(0);
    });

    it('applies Condemnation effects when passed', () => {
      const votes = [makeVote('eu', 'yea')];
      const result = engine.resolveVote({
        votes,
        proposer: fid('usa'),
        target: fid('china'),
        resolutionType: UNResolutionType.Condemnation,
        currentTurn: turn(3),
      });

      expect(result.passed).toBe(true);
      expect(result.effects.legitimacyPenalty).toBe(GAME_CONFIG.unResolutions.condemnation.legitimacyPenalty);
      expect(result.effects.diPenalty).toBe(GAME_CONFIG.unResolutions.condemnation.diPenalty);
      // Non-applicable fields remain 0
      expect(result.effects.gdpGrowthPenalty).toBe(0);
      expect(result.effects.tradeReduction).toBe(0);
      expect(result.effects.stabilityBonus).toBe(0);
    });

    it('returns all-zero effects when resolution fails', () => {
      const votes = [makeVote('eu', 'nay')];
      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(false);
      expect(result.effects.gdpGrowthPenalty).toBe(0);
      expect(result.effects.tradeReduction).toBe(0);
      expect(result.effects.stabilityBonus).toBe(0);
      expect(result.effects.civilUnrestReduction).toBe(0);
      expect(result.effects.legitimacyPenalty).toBe(0);
      expect(result.effects.diPenalty).toBe(0);
      expect(result.effects.diCostToProposer).toBe(0);
    });

    it('sets expiryTurn to enacted + duration when passed', () => {
      const votes = [makeVote('eu', 'yea')];
      const result = engine.resolveVote({ votes, ...baseResolveInput });

      // Sanctions duration = 12, currentTurn = 5 → expiry = 17
      expect(result.passed).toBe(true);
      expect(result.expiryTurn).toBe(5 + GAME_CONFIG.unResolutions.sanctions.durationTurns);
    });

    it('sets expiryTurn to currentTurn when resolution fails', () => {
      const votes = [makeVote('eu', 'nay')];
      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.passed).toBe(false);
      expect(result.expiryTurn).toBe(5);
    });

    it('handles mixed votes with majority yea', () => {
      const votes = [
        makeVote('eu', 'yea'),
        makeVote('china', 'yea'),
        makeVote('india', 'nay'),
        makeVote('japan', 'abstain'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      // yea/(yea+nay) = 2/3 ≈ 0.667 >= 0.5 → passes
      expect(result.passed).toBe(true);
      expect(result.yeaCount).toBe(2);
      expect(result.nayCount).toBe(1);
      expect(result.abstainCount).toBe(1);
    });

    it('fails with majority nay in mixed votes', () => {
      const votes = [
        makeVote('eu', 'yea'),
        makeVote('china', 'nay'),
        makeVote('india', 'nay'),
        makeVote('japan', 'nay'),
      ];

      const result = engine.resolveVote({ votes, ...baseResolveInput });

      // yea/(yea+nay) = 1/4 = 0.25 < 0.5 → fails
      expect(result.passed).toBe(false);
      expect(result.yeaCount).toBe(1);
      expect(result.nayCount).toBe(3);
    });

    it('includes pass/fail status in reason', () => {
      const votes = [makeVote('eu', 'yea')];
      const result = engine.resolveVote({ votes, ...baseResolveInput });

      expect(result.reason).toContain('PASSED');
    });
  });

  // =========================================================================
  // 7. computeResolutionExpiry
  // =========================================================================

  describe('computeResolutionExpiry', () => {
    it('computes Sanctions expiry (duration = 12)', () => {
      const result = engine.computeResolutionExpiry({
        resolutionType: UNResolutionType.Sanctions,
        enactedTurn: turn(5),
      });

      expect(result.durationTurns).toBe(12);
      expect(result.expiryTurn).toBe(17);
      expect(result.reason).toContain('Sanctions');
    });

    it('computes Peacekeeping expiry (duration = 8)', () => {
      const result = engine.computeResolutionExpiry({
        resolutionType: UNResolutionType.Peacekeeping,
        enactedTurn: turn(10),
      });

      expect(result.durationTurns).toBe(8);
      expect(result.expiryTurn).toBe(18);
      expect(result.reason).toContain('Peacekeeping');
    });

    it('computes Condemnation expiry (duration = 6)', () => {
      const result = engine.computeResolutionExpiry({
        resolutionType: UNResolutionType.Condemnation,
        enactedTurn: turn(20),
      });

      expect(result.durationTurns).toBe(6);
      expect(result.expiryTurn).toBe(26);
    });

    it('correctly handles turn 1 as enacted turn', () => {
      const result = engine.computeResolutionExpiry({
        resolutionType: UNResolutionType.Sanctions,
        enactedTurn: turn(1),
      });

      expect(result.expiryTurn).toBe(13);
    });

    it('includes duration in the reason string', () => {
      const result = engine.computeResolutionExpiry({
        resolutionType: UNResolutionType.Peacekeeping,
        enactedTurn: turn(1),
      });

      expect(result.reason).toContain('8');
    });
  });
});
