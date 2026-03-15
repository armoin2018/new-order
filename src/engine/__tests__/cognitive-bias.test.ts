import { describe, it, expect, beforeEach } from 'vitest';
import { CognitiveBiasEngine } from '@/engine/cognitive-bias';
import type { BiasContext } from '@/engine/cognitive-bias';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderId, LeaderBiasAssignment } from '@/data/types';
import { BiasType } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<BiasContext> = {}): BiasContext {
  return {
    turnsInvestedInCurrentStrategy: 0,
    intelligenceConflictsWithBelief: false,
    dominantFactionScore: 50,
    isFirstMajorEvent: false,
    recentlyLostPosition: false,
    leaderConfidence: 50,
    turnsSinceLastDramaticEvent: 10,
    intelligenceClarity: 50,
    lastInteractionNegative: false,
    nuclearThreshold: 25,
    currentTurn: 1,
    ...overrides,
  };
}

function makeAssignment(biasType: BiasType, intensity: number = 100): LeaderBiasAssignment {
  return { biasType, intensity, trigger: 'test' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CognitiveBiasEngine', () => {
  let engine: CognitiveBiasEngine;

  beforeEach(() => {
    engine = new CognitiveBiasEngine(GAME_CONFIG.psychology);
  });

  // -----------------------------------------------------------------------
  // checkBiasTrigger — 20 tests (2 per bias: triggered + not triggered)
  // -----------------------------------------------------------------------
  describe('checkBiasTrigger', () => {
    // SunkCost
    it('triggers SunkCost when turnsInvestedInCurrentStrategy >= 3', () => {
      const ctx = makeContext({ turnsInvestedInCurrentStrategy: 3 });
      const result = engine.checkBiasTrigger(BiasType.SunkCost, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger SunkCost when turnsInvestedInCurrentStrategy < 3', () => {
      const ctx = makeContext({ turnsInvestedInCurrentStrategy: 2 });
      const result = engine.checkBiasTrigger(BiasType.SunkCost, ctx);
      expect(result.triggered).toBe(false);
    });

    // ConfirmationBias
    it('triggers ConfirmationBias when intelligenceConflictsWithBelief is true', () => {
      const ctx = makeContext({ intelligenceConflictsWithBelief: true });
      const result = engine.checkBiasTrigger(BiasType.ConfirmationBias, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger ConfirmationBias when intelligenceConflictsWithBelief is false', () => {
      const ctx = makeContext({ intelligenceConflictsWithBelief: false });
      const result = engine.checkBiasTrigger(BiasType.ConfirmationBias, ctx);
      expect(result.triggered).toBe(false);
    });

    // Groupthink
    it('triggers Groupthink when dominantFactionScore >= 80', () => {
      const ctx = makeContext({ dominantFactionScore: 80 });
      const result = engine.checkBiasTrigger(BiasType.Groupthink, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger Groupthink when dominantFactionScore < 80', () => {
      const ctx = makeContext({ dominantFactionScore: 79 });
      const result = engine.checkBiasTrigger(BiasType.Groupthink, ctx);
      expect(result.triggered).toBe(false);
    });

    // Anchoring
    it('triggers Anchoring when isFirstMajorEvent is true', () => {
      const ctx = makeContext({ isFirstMajorEvent: true });
      const result = engine.checkBiasTrigger(BiasType.Anchoring, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger Anchoring when isFirstMajorEvent is false', () => {
      const ctx = makeContext({ isFirstMajorEvent: false });
      const result = engine.checkBiasTrigger(BiasType.Anchoring, ctx);
      expect(result.triggered).toBe(false);
    });

    // LossAversion
    it('triggers LossAversion when recentlyLostPosition is true', () => {
      const ctx = makeContext({ recentlyLostPosition: true });
      const result = engine.checkBiasTrigger(BiasType.LossAversion, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger LossAversion when recentlyLostPosition is false', () => {
      const ctx = makeContext({ recentlyLostPosition: false });
      const result = engine.checkBiasTrigger(BiasType.LossAversion, ctx);
      expect(result.triggered).toBe(false);
    });

    // Optimism
    it('triggers Optimism when leaderConfidence > 75', () => {
      const ctx = makeContext({ leaderConfidence: 76 });
      const result = engine.checkBiasTrigger(BiasType.Optimism, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger Optimism when leaderConfidence <= 75', () => {
      const ctx = makeContext({ leaderConfidence: 75 });
      const result = engine.checkBiasTrigger(BiasType.Optimism, ctx);
      expect(result.triggered).toBe(false);
    });

    // AvailabilityHeuristic
    it('triggers AvailabilityHeuristic when turnsSinceLastDramaticEvent <= 3', () => {
      const ctx = makeContext({ turnsSinceLastDramaticEvent: 3 });
      const result = engine.checkBiasTrigger(BiasType.AvailabilityHeuristic, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger AvailabilityHeuristic when turnsSinceLastDramaticEvent > 3', () => {
      const ctx = makeContext({ turnsSinceLastDramaticEvent: 4 });
      const result = engine.checkBiasTrigger(BiasType.AvailabilityHeuristic, ctx);
      expect(result.triggered).toBe(false);
    });

    // DunningKruger
    it('triggers DunningKruger when intelligenceClarity < 30', () => {
      const ctx = makeContext({ intelligenceClarity: 29 });
      const result = engine.checkBiasTrigger(BiasType.DunningKruger, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger DunningKruger when intelligenceClarity >= 30', () => {
      const ctx = makeContext({ intelligenceClarity: 30 });
      const result = engine.checkBiasTrigger(BiasType.DunningKruger, ctx);
      expect(result.triggered).toBe(false);
    });

    // Recency
    it('triggers Recency when lastInteractionNegative is true', () => {
      const ctx = makeContext({ lastInteractionNegative: true });
      const result = engine.checkBiasTrigger(BiasType.Recency, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger Recency when lastInteractionNegative is false', () => {
      const ctx = makeContext({ lastInteractionNegative: false });
      const result = engine.checkBiasTrigger(BiasType.Recency, ctx);
      expect(result.triggered).toBe(false);
    });

    // EscalationOfCommitment
    it('triggers EscalationOfCommitment when nuclearThreshold >= 50', () => {
      const ctx = makeContext({ nuclearThreshold: 50 });
      const result = engine.checkBiasTrigger(BiasType.EscalationOfCommitment, ctx);
      expect(result.triggered).toBe(true);
    });

    it('does not trigger EscalationOfCommitment when nuclearThreshold < 50', () => {
      const ctx = makeContext({ nuclearThreshold: 49 });
      const result = engine.checkBiasTrigger(BiasType.EscalationOfCommitment, ctx);
      expect(result.triggered).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // computeDistortion — 12 tests
  // -----------------------------------------------------------------------
  describe('computeDistortion', () => {
    it('SunkCost at intensity 100 → distortionDelta 0.3', () => {
      const result = engine.computeDistortion(BiasType.SunkCost, 100);
      expect(result.distortionDelta).toBeCloseTo(0.3);
    });

    it('SunkCost at intensity 50 → distortionDelta 0.15', () => {
      const result = engine.computeDistortion(BiasType.SunkCost, 50);
      expect(result.distortionDelta).toBeCloseTo(0.15);
    });

    it('SunkCost at intensity 0 → distortionDelta 0', () => {
      const result = engine.computeDistortion(BiasType.SunkCost, 0);
      expect(result.distortionDelta).toBeCloseTo(0);
    });

    it('ConfirmationBias at intensity 100 → distortionDelta 0.25', () => {
      const result = engine.computeDistortion(BiasType.ConfirmationBias, 100);
      expect(result.distortionDelta).toBeCloseTo(0.25);
    });

    it('LossAversion at intensity 100 → distortionDelta 1.0', () => {
      const result = engine.computeDistortion(BiasType.LossAversion, 100);
      expect(result.distortionDelta).toBeCloseTo(1.0);
    });

    it('EscalationOfCommitment at intensity 100 → distortionDelta -0.25 (negative)', () => {
      const result = engine.computeDistortion(BiasType.EscalationOfCommitment, 100);
      expect(result.distortionDelta).toBeCloseTo(-0.25);
    });

    it('AvailabilityHeuristic at intensity 100 → distortionDelta 0.4', () => {
      const result = engine.computeDistortion(BiasType.AvailabilityHeuristic, 100);
      expect(result.distortionDelta).toBeCloseTo(0.4);
    });

    it('DunningKruger at intensity 80 → distortionDelta 0.12', () => {
      const result = engine.computeDistortion(BiasType.DunningKruger, 80);
      expect(result.distortionDelta).toBeCloseTo(0.12);
    });

    it('Groupthink at intensity 100 → distortionDelta 0.2', () => {
      const result = engine.computeDistortion(BiasType.Groupthink, 100);
      expect(result.distortionDelta).toBeCloseTo(0.2);
    });

    it('Optimism at intensity 100 → distortionDelta 0.2', () => {
      const result = engine.computeDistortion(BiasType.Optimism, 100);
      expect(result.distortionDelta).toBeCloseTo(0.2);
    });

    it('Recency at intensity 100 → distortionDelta 0.2', () => {
      const result = engine.computeDistortion(BiasType.Recency, 100);
      expect(result.distortionDelta).toBeCloseTo(0.2);
    });

    it('Anchoring at intensity 100 → distortionDelta 0.25', () => {
      const result = engine.computeDistortion(BiasType.Anchoring, 100);
      expect(result.distortionDelta).toBeCloseTo(0.25);
    });
  });

  // -----------------------------------------------------------------------
  // evaluateBiases — 10 tests
  // -----------------------------------------------------------------------
  describe('evaluateBiases', () => {
    const leaderId = 'leader-test-01' as LeaderId;

    it('returns empty results for empty assignments', () => {
      const ctx = makeContext();
      const result = engine.evaluateBiases(leaderId, [], ctx);
      expect(result.leaderId).toBe(leaderId);
      expect(result.triggeredBiases).toHaveLength(0);
      expect(result.distortions).toHaveLength(0);
      expect(result.totalDistortion).toBe(0);
    });

    it('returns leaderId in result', () => {
      const ctx = makeContext();
      const result = engine.evaluateBiases(leaderId, [], ctx);
      expect(result.leaderId).toBe(leaderId);
    });

    it('triggers a single bias that meets its condition', () => {
      const ctx = makeContext({ turnsInvestedInCurrentStrategy: 5 });
      const assignments = [makeAssignment(BiasType.SunkCost, 100)];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);
      expect(result.triggeredBiases).toHaveLength(1);
      expect(result.distortions).toHaveLength(1);
      expect(result.totalDistortion).toBeCloseTo(0.3);
    });

    it('does not produce distortion for a bias that does not trigger', () => {
      const ctx = makeContext({ turnsInvestedInCurrentStrategy: 1 });
      const assignments = [makeAssignment(BiasType.SunkCost, 100)];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);

      const triggered = result.triggeredBiases.filter((b) => b.triggered);
      expect(triggered).toHaveLength(0);
      expect(result.distortions).toHaveLength(0);
      expect(result.totalDistortion).toBe(0);
    });

    it('handles multiple biases where some trigger and some do not', () => {
      const ctx = makeContext({
        turnsInvestedInCurrentStrategy: 5, // SunkCost triggers
        intelligenceConflictsWithBelief: false, // ConfirmationBias does NOT trigger
        dominantFactionScore: 90, // Groupthink triggers
      });
      const assignments = [
        makeAssignment(BiasType.SunkCost, 100),
        makeAssignment(BiasType.ConfirmationBias, 100),
        makeAssignment(BiasType.Groupthink, 100),
      ];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);

      const triggered = result.triggeredBiases.filter((b) => b.triggered);
      expect(triggered).toHaveLength(2);
      expect(result.distortions).toHaveLength(2);
    });

    it('sums totalDistortion from all triggered biases', () => {
      const ctx = makeContext({
        turnsInvestedInCurrentStrategy: 5, // SunkCost triggers
        dominantFactionScore: 90, // Groupthink triggers
      });
      const assignments = [
        makeAssignment(BiasType.SunkCost, 100),
        makeAssignment(BiasType.Groupthink, 100),
      ];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);
      // 0.3 (SunkCost) + 0.2 (Groupthink) = 0.5
      expect(result.totalDistortion).toBeCloseTo(0.5);
    });

    it('evaluates all 10 bias types when all trigger', () => {
      const ctx = makeContext({
        turnsInvestedInCurrentStrategy: 5,
        intelligenceConflictsWithBelief: true,
        dominantFactionScore: 90,
        isFirstMajorEvent: true,
        recentlyLostPosition: true,
        leaderConfidence: 80,
        turnsSinceLastDramaticEvent: 1,
        intelligenceClarity: 10,
        lastInteractionNegative: true,
        nuclearThreshold: 60,
      });
      const assignments = [
        makeAssignment(BiasType.SunkCost, 100),
        makeAssignment(BiasType.ConfirmationBias, 100),
        makeAssignment(BiasType.Groupthink, 100),
        makeAssignment(BiasType.Anchoring, 100),
        makeAssignment(BiasType.LossAversion, 100),
        makeAssignment(BiasType.Optimism, 100),
        makeAssignment(BiasType.AvailabilityHeuristic, 100),
        makeAssignment(BiasType.DunningKruger, 100),
        makeAssignment(BiasType.Recency, 100),
        makeAssignment(BiasType.EscalationOfCommitment, 100),
      ];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);

      const triggered = result.triggeredBiases.filter((b) => b.triggered);
      expect(triggered).toHaveLength(10);
      expect(result.distortions).toHaveLength(10);
    });

    it('totalDistortion equals sum of individual distortionDeltas for all biases', () => {
      const ctx = makeContext({
        turnsInvestedInCurrentStrategy: 5,
        intelligenceConflictsWithBelief: true,
        dominantFactionScore: 90,
        isFirstMajorEvent: true,
        recentlyLostPosition: true,
        leaderConfidence: 80,
        turnsSinceLastDramaticEvent: 1,
        intelligenceClarity: 10,
        lastInteractionNegative: true,
        nuclearThreshold: 60,
      });
      const assignments = [
        makeAssignment(BiasType.SunkCost, 100),
        makeAssignment(BiasType.ConfirmationBias, 100),
        makeAssignment(BiasType.Groupthink, 100),
        makeAssignment(BiasType.Anchoring, 100),
        makeAssignment(BiasType.LossAversion, 100),
        makeAssignment(BiasType.Optimism, 100),
        makeAssignment(BiasType.AvailabilityHeuristic, 100),
        makeAssignment(BiasType.DunningKruger, 100),
        makeAssignment(BiasType.Recency, 100),
        makeAssignment(BiasType.EscalationOfCommitment, 100),
      ];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);

      const sumOfDeltas = result.distortions.reduce(
        (sum, d) => sum + d.distortionDelta,
        0,
      );
      expect(result.totalDistortion).toBeCloseTo(sumOfDeltas);
      // 0.3 + 0.25 + 0.2 + 0.25 + 1.0 + 0.2 + 0.4 + 0.15 + 0.2 + (-0.25) = 2.7
      expect(result.totalDistortion).toBeCloseTo(2.7);
    });

    it('respects intensity when computing distortion in evaluateBiases', () => {
      const ctx = makeContext({ turnsInvestedInCurrentStrategy: 5 });
      const assignments = [makeAssignment(BiasType.SunkCost, 50)];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);
      // 0.3 * 50/100 = 0.15
      expect(result.totalDistortion).toBeCloseTo(0.15);
    });

    it('includes negative distortion from EscalationOfCommitment in total', () => {
      const ctx = makeContext({ nuclearThreshold: 60 });
      const assignments = [makeAssignment(BiasType.EscalationOfCommitment, 100)];
      const result = engine.evaluateBiases(leaderId, assignments, ctx);
      expect(result.totalDistortion).toBeCloseTo(-0.25);
    });
  });
});
