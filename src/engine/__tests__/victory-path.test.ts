import { describe, it, expect, beforeEach } from 'vitest';
import { VictoryPathEngine } from '@/engine/victory-path';
import type { NationMetrics, VictoryRequirements, VictoryConditionInput } from '@/engine/victory-path';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber, TurnViabilityAssessment } from '@/data/types';
import { ViabilityLabel, TrendDirection, ConfidenceLevel } from '@/data/types';

describe('VictoryPathEngine', () => {
  let engine: VictoryPathEngine;
  const cfg = GAME_CONFIG.advisory;

  beforeEach(() => {
    engine = new VictoryPathEngine(cfg);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. computeViabilityScore
  // ═══════════════════════════════════════════════════════════════════════

  describe('computeViabilityScore', () => {
    it('returns 100 when all metrics fully met with 30 turns remaining', () => {
      const metrics: NationMetrics = { gdp: 100, stability: 80 };
      const reqs: VictoryRequirements = { gdp: 100, stability: 80 };
      expect(engine.computeViabilityScore(metrics, reqs, 30)).toBe(100);
    });

    it('returns ~50 when all metrics at 50% of target with 12+ turns', () => {
      const metrics: NationMetrics = { gdp: 50, stability: 40 };
      const reqs: VictoryRequirements = { gdp: 100, stability: 80 };
      // avg fulfillment = (0.5 + 0.5) / 2 = 0.5, turnsBonus = 1.0
      // score = round(0.5 * 100 * 1.0) = 50
      expect(engine.computeViabilityScore(metrics, reqs, 12)).toBe(50);
    });

    it('returns 100 when requirements are empty', () => {
      const metrics: NationMetrics = { gdp: 50 };
      const reqs: VictoryRequirements = {};
      expect(engine.computeViabilityScore(metrics, reqs, 20)).toBe(100);
    });

    it('applies 0.5 fallback multiplier when 0 turns remaining', () => {
      const metrics: NationMetrics = { gdp: 100 };
      const reqs: VictoryRequirements = { gdp: 100 };
      // avg fulfillment = 1.0, turnsBonus = 0.5
      // score = round(1.0 * 100 * 0.5) = 50
      expect(engine.computeViabilityScore(metrics, reqs, 0)).toBe(50);
    });

    it('applies turnsBonus = 6/12 = 0.5 when 6 turns remaining', () => {
      const metrics: NationMetrics = { gdp: 100 };
      const reqs: VictoryRequirements = { gdp: 100 };
      // avg fulfillment = 1.0, turnsBonus = min(1.0, 6/12) = 0.5
      // score = round(1.0 * 100 * 0.5) = 50
      expect(engine.computeViabilityScore(metrics, reqs, 6)).toBe(50);
    });

    it('applies full turnsBonus of 1.0 at exactly 12 turns remaining', () => {
      const metrics: NationMetrics = { gdp: 80 };
      const reqs: VictoryRequirements = { gdp: 100 };
      // avg fulfillment = 0.8, turnsBonus = 1.0
      // score = round(0.8 * 100 * 1.0) = 80
      expect(engine.computeViabilityScore(metrics, reqs, 12)).toBe(80);
    });

    it('returns 0 when single metric is at 0', () => {
      const metrics: NationMetrics = { gdp: 0 };
      const reqs: VictoryRequirements = { gdp: 100 };
      expect(engine.computeViabilityScore(metrics, reqs, 30)).toBe(0);
    });

    it('computes correct mixed fulfillment (stability=80/80, gdp=40/100)', () => {
      const metrics: NationMetrics = { stability: 80, gdp: 40 };
      const reqs: VictoryRequirements = { stability: 80, gdp: 100 };
      // avg fulfillment = (1.0 + 0.4) / 2 = 0.7, turnsBonus = 1.0
      // score = round(0.7 * 100 * 1.0) = 70
      expect(engine.computeViabilityScore(metrics, reqs, 12)).toBe(70);
    });

    it('clamps metric fulfillment to 1 when current exceeds target', () => {
      const metrics: NationMetrics = { gdp: 200 };
      const reqs: VictoryRequirements = { gdp: 100 };
      // fulfillment = clamp(200/100, 0, 1) = 1.0, turnsBonus = 1.0
      // score = 100
      expect(engine.computeViabilityScore(metrics, reqs, 12)).toBe(100);
    });

    it('treats unknown metric key as 0 contribution', () => {
      const metrics: NationMetrics = {}; // missing 'gdp'
      const reqs: VictoryRequirements = { gdp: 100 };
      // current defaults to 0, fulfillment = 0/100 = 0
      expect(engine.computeViabilityScore(metrics, reqs, 30)).toBe(0);
    });

    it('clamps score to 0 floor', () => {
      const metrics: NationMetrics = { gdp: -50 };
      const reqs: VictoryRequirements = { gdp: 100 };
      // clamp(-0.5, 0, 1) = 0
      expect(engine.computeViabilityScore(metrics, reqs, 30)).toBe(0);
    });

    it('handles target of 0 as trivially satisfied', () => {
      const metrics: NationMetrics = { gdp: 0 };
      const reqs: VictoryRequirements = { gdp: 0 };
      // target is 0 → ratio = 1
      // score = round(1.0 * 100 * 1.0) = 100
      expect(engine.computeViabilityScore(metrics, reqs, 12)).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. classifyViability
  // ═══════════════════════════════════════════════════════════════════════

  describe('classifyViability', () => {
    it('classifies 0 as Foreclosed', () => {
      expect(engine.classifyViability(0)).toBe(ViabilityLabel.Foreclosed);
    });

    it('classifies 9 as Foreclosed (boundary)', () => {
      expect(engine.classifyViability(9)).toBe(ViabilityLabel.Foreclosed);
    });

    it('classifies 10 as Difficult', () => {
      expect(engine.classifyViability(10)).toBe(ViabilityLabel.Difficult);
    });

    it('classifies 30 as Difficult (boundary)', () => {
      expect(engine.classifyViability(30)).toBe(ViabilityLabel.Difficult);
    });

    it('classifies 31 as Viable', () => {
      expect(engine.classifyViability(31)).toBe(ViabilityLabel.Viable);
    });

    it('classifies 60 as Viable (boundary)', () => {
      expect(engine.classifyViability(60)).toBe(ViabilityLabel.Viable);
    });

    it('classifies 61 as Favorable', () => {
      expect(engine.classifyViability(61)).toBe(ViabilityLabel.Favorable);
    });

    it('classifies 80 as Favorable (boundary)', () => {
      expect(engine.classifyViability(80)).toBe(ViabilityLabel.Favorable);
    });

    it('classifies 81 as Imminent', () => {
      expect(engine.classifyViability(81)).toBe(ViabilityLabel.Imminent);
    });

    it('classifies 100 as Imminent', () => {
      expect(engine.classifyViability(100)).toBe(ViabilityLabel.Imminent);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. computeTrend
  // ═══════════════════════════════════════════════════════════════════════

  describe('computeTrend', () => {
    it('returns Stable when previous is null', () => {
      expect(engine.computeTrend(50, null)).toBe(TrendDirection.Stable);
    });

    it('returns RisingFast for delta of exactly +10', () => {
      expect(engine.computeTrend(60, 50)).toBe(TrendDirection.RisingFast);
    });

    it('returns RisingFast for delta of +15', () => {
      expect(engine.computeTrend(65, 50)).toBe(TrendDirection.RisingFast);
    });

    it('returns Rising for delta of +5', () => {
      expect(engine.computeTrend(55, 50)).toBe(TrendDirection.Rising);
    });

    it('returns Rising for delta of exactly +3', () => {
      expect(engine.computeTrend(53, 50)).toBe(TrendDirection.Rising);
    });

    it('returns Stable for delta of +2', () => {
      expect(engine.computeTrend(52, 50)).toBe(TrendDirection.Stable);
    });

    it('returns Falling for delta of -3', () => {
      expect(engine.computeTrend(47, 50)).toBe(TrendDirection.Falling);
    });

    it('returns FallingFast for delta of -10', () => {
      expect(engine.computeTrend(40, 50)).toBe(TrendDirection.FallingFast);
    });

    it('returns Stable for delta of 0', () => {
      expect(engine.computeTrend(50, 50)).toBe(TrendDirection.Stable);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. estimateTurnsToVictory
  // ═══════════════════════════════════════════════════════════════════════

  describe('estimateTurnsToVictory', () => {
    it('returns null when trajectory is null', () => {
      const metrics: NationMetrics = { gdp: 50 };
      const reqs: VictoryRequirements = { gdp: 100 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, null)).toBeNull();
    });

    it('returns 0 when requirements are empty', () => {
      const metrics: NationMetrics = { gdp: 50 };
      const reqs: VictoryRequirements = {};
      const trajectory: NationMetrics = { gdp: 5 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBe(0);
    });

    it('returns 0 when all requirements already met', () => {
      const metrics: NationMetrics = { gdp: 100, stability: 80 };
      const reqs: VictoryRequirements = { gdp: 100, stability: 80 };
      const trajectory: NationMetrics = { gdp: 5, stability: 3 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBe(0);
    });

    it('computes ceil(gap/rate) for single metric (gap=10, rate=5 → 2)', () => {
      const metrics: NationMetrics = { gdp: 90 };
      const reqs: VictoryRequirements = { gdp: 100 };
      const trajectory: NationMetrics = { gdp: 5 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBe(2);
    });

    it('returns max of individual estimates for multiple metrics', () => {
      const metrics: NationMetrics = { gdp: 80, stability: 60 };
      const reqs: VictoryRequirements = { gdp: 100, stability: 80 };
      const trajectory: NationMetrics = { gdp: 10, stability: 5 };
      // gdp: ceil(20/10) = 2, stability: ceil(20/5) = 4 → max = 4
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBe(4);
    });

    it('returns null when gap exists but rate is 0', () => {
      const metrics: NationMetrics = { gdp: 50 };
      const reqs: VictoryRequirements = { gdp: 100 };
      const trajectory: NationMetrics = { gdp: 0 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBeNull();
    });

    it('returns null when gap exists but rate is negative', () => {
      const metrics: NationMetrics = { gdp: 50 };
      const reqs: VictoryRequirements = { gdp: 100 };
      const trajectory: NationMetrics = { gdp: -2 };
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBeNull();
    });

    it('handles partial fulfillment with mixed rates', () => {
      const metrics: NationMetrics = { gdp: 90, stability: 80 };
      const reqs: VictoryRequirements = { gdp: 100, stability: 80 };
      const trajectory: NationMetrics = { gdp: 3, stability: 5 };
      // gdp: ceil(10/3) = 4, stability: gap = 0 (already met) → max = 4
      expect(engine.estimateTurnsToVictory(metrics, reqs, trajectory)).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. assessVictoryPaths
  // ═══════════════════════════════════════════════════════════════════════

  describe('assessVictoryPaths', () => {
    const faction = 'us' as FactionId;

    it('sets trend to Stable on first turn (null previous)', () => {
      const turn = 1 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 50 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, { gdp: 5 });
      expect(result.paths[0]!.trend).toBe(TrendDirection.Stable);
    });

    it('returns correct number of paths for multiple VCs', () => {
      const turn = 10 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
        { id: 'mil', requirements: { military: 80 } },
        { id: 'diplo', requirements: { influence: 90 } },
      ];
      const metrics: NationMetrics = { gdp: 50, military: 40, influence: 30 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, null);
      expect(result.paths).toHaveLength(3);
    });

    it('sets confidence to Low when trajectory is null', () => {
      const turn = 10 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 50 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, null);
      expect(result.paths[0]!.confidence).toBe(ConfidenceLevel.Low);
    });

    it('sets confidence to High when fewer than 6 turns remain (turn 55)', () => {
      const turn = 55 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 90 };
      const trajectory: NationMetrics = { gdp: 2 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, trajectory);
      // turnsRemaining = 60 - 55 = 5 < 6 → High
      expect(result.paths[0]!.confidence).toBe(ConfidenceLevel.High);
    });

    it('sets confidence to Medium when trajectory exists and turns >= 6 (turn 30)', () => {
      const turn = 30 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 60 };
      const trajectory: NationMetrics = { gdp: 3 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, trajectory);
      // turnsRemaining = 60 - 30 = 30 ≥ 6, trajectory present → Medium
      expect(result.paths[0]!.confidence).toBe(ConfidenceLevel.Medium);
    });

    it('uses previous assessment scores for trend computation', () => {
      const turn = 5 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 80 };
      const trajectory: NationMetrics = { gdp: 5 };

      // Build a previous assessment where econ had a much lower score
      const prevAssessment: TurnViabilityAssessment = {
        turn: 4 as TurnNumber,
        factionId: faction,
        paths: [
          {
            victoryConditionId: 'econ',
            viabilityScore: 30,
            label: ViabilityLabel.Difficult,
            trend: TrendDirection.Stable,
            turnsToVictoryEstimate: 10,
            confidence: ConfidenceLevel.Medium,
          },
        ],
      };

      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, prevAssessment, trajectory);
      // Current score for gdp=80, reqs=100, turnsRemaining=55 → fulfillment=0.8, turnsBonus=min(1,55/12)=1.0 → 80
      // previousScore=30, delta=50 ≥ 10 → RisingFast
      expect(result.paths[0]!.trend).toBe(TrendDirection.RisingFast);
    });

    it('includes correct factionId and turn in result', () => {
      const turn = 20 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 70 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, null);
      expect(result.factionId).toBe(faction);
      expect(result.turn).toBe(turn);
    });

    it('computes viability scores correctly per path', () => {
      const turn = 0 as TurnNumber;
      const vcs: VictoryConditionInput[] = [
        { id: 'econ', requirements: { gdp: 100 } },
      ];
      const metrics: NationMetrics = { gdp: 100 };
      const result = engine.assessVictoryPaths(faction, turn, vcs, metrics, null, null);
      // turnsRemaining = 60, fulfillment = 1.0, turnsBonus = min(1,60/12) = 1.0 → 100
      expect(result.paths[0]!.viabilityScore).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. computeCompositeStrategyScore
  // ═══════════════════════════════════════════════════════════════════════

  describe('computeCompositeStrategyScore', () => {
    it('returns 100 when all inputs are 100', () => {
      expect(engine.computeCompositeStrategyScore(100, 100, 100)).toBe(100);
    });

    it('returns 0 when all inputs are 0', () => {
      expect(engine.computeCompositeStrategyScore(0, 0, 0)).toBe(0);
    });

    it('computes weighted sum: 80*0.4 + 60*0.3 + 70*0.3 = 71', () => {
      expect(engine.computeCompositeStrategyScore(80, 60, 70)).toBe(71);
    });

    it('returns 50 when all inputs are 50', () => {
      expect(engine.computeCompositeStrategyScore(50, 50, 50)).toBe(50);
    });

    it('rounds result to 1 decimal place', () => {
      // 33*0.4 + 33*0.3 + 33*0.3 = 13.2 + 9.9 + 9.9 = 33.0
      expect(engine.computeCompositeStrategyScore(33, 33, 33)).toBe(33);
      // 77*0.4 + 63*0.3 + 41*0.3 = 30.8 + 18.9 + 12.3 = 62.0
      expect(engine.computeCompositeStrategyScore(77, 63, 41)).toBe(62);
    });

    it('clamps result to [0, 100]', () => {
      // Even with all 100s: 100*0.4+100*0.3+100*0.3 = 100 (no over-clamp needed)
      // With very large values that might exceed: the engine should still clamp
      expect(engine.computeCompositeStrategyScore(100, 100, 100)).toBeLessThanOrEqual(100);
      expect(engine.computeCompositeStrategyScore(0, 0, 0)).toBeGreaterThanOrEqual(0);
    });
  });
});
