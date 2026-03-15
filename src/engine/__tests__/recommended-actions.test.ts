import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendedActionsEngine } from '@/engine/recommended-actions';
import type { ActionCandidate, ConsistencyActionEntry, ConsistencyResult } from '@/engine/recommended-actions';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber, VictoryPathViability } from '@/data/types';
import { ViabilityLabel, TrendDirection, ConfidenceLevel as ConfidenceLevelEnum } from '@/data/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePath(id: string, score: number, label: string = ViabilityLabel.Viable): VictoryPathViability {
  return {
    victoryConditionId: id,
    viabilityScore: score,
    label: label as VictoryPathViability['label'],
    trend: TrendDirection.Stable,
    turnsToVictoryEstimate: 10,
    confidence: ConfidenceLevelEnum.Medium,
  };
}

function makeAction(overrides: Partial<ActionCandidate> & { actionId: string; name: string; targetVictoryPath: string }): ActionCandidate {
  return {
    expectedImpact: 30,
    resourceCost: 10,
    riskLevel: 5,
    estimatedTurnsToVictory: 10,
    ...overrides,
  };
}

function makeConsistencyEntry(turn: number, path: string): ConsistencyActionEntry {
  return { turn: turn as TurnNumber, alignedVictoryPath: path };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('RecommendedActionsEngine', () => {
  let engine: RecommendedActionsEngine;

  beforeEach(() => {
    engine = new RecommendedActionsEngine(GAME_CONFIG.advisory);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. selectTopPaths
  // ─────────────────────────────────────────────────────────────────────────

  describe('selectTopPaths', () => {
    it('returns empty array when paths is empty', () => {
      const result = engine.selectTopPaths([]);
      expect(result).toEqual([]);
    });

    it('returns empty array when all paths are Foreclosed', () => {
      const paths = [
        makePath('a', 10, ViabilityLabel.Foreclosed),
        makePath('b', 20, ViabilityLabel.Foreclosed),
      ];
      const result = engine.selectTopPaths(paths);
      expect(result).toEqual([]);
    });

    it('filters out Foreclosed and returns top 3 sorted by score', () => {
      const paths = [
        makePath('a', 40, ViabilityLabel.Viable),
        makePath('b', 80, ViabilityLabel.Favorable),
        makePath('c', 5, ViabilityLabel.Foreclosed),
        makePath('d', 60, ViabilityLabel.Viable),
        makePath('e', 3, ViabilityLabel.Foreclosed),
      ];
      const result = engine.selectTopPaths(paths);
      expect(result).toHaveLength(3);
      expect(result[0]!.victoryConditionId).toBe('b');
      expect(result[1]!.victoryConditionId).toBe('d');
      expect(result[2]!.victoryConditionId).toBe('a');
    });

    it('returns fewer than count when not enough non-foreclosed paths', () => {
      const paths = [
        makePath('a', 50, ViabilityLabel.Viable),
        makePath('b', 5, ViabilityLabel.Foreclosed),
      ];
      const result = engine.selectTopPaths(paths);
      expect(result).toHaveLength(1);
      expect(result[0]!.victoryConditionId).toBe('a');
    });

    it('respects custom count=1', () => {
      const paths = [
        makePath('a', 50, ViabilityLabel.Viable),
        makePath('b', 70, ViabilityLabel.Favorable),
        makePath('c', 60, ViabilityLabel.Viable),
      ];
      const result = engine.selectTopPaths(paths, 1);
      expect(result).toHaveLength(1);
      expect(result[0]!.victoryConditionId).toBe('b');
    });

    it('returns correctly when paths are already sorted descending', () => {
      const paths = [
        makePath('a', 90, ViabilityLabel.Imminent),
        makePath('b', 70, ViabilityLabel.Favorable),
        makePath('c', 50, ViabilityLabel.Viable),
      ];
      const result = engine.selectTopPaths(paths);
      expect(result[0]!.victoryConditionId).toBe('a');
      expect(result[1]!.victoryConditionId).toBe('b');
      expect(result[2]!.victoryConditionId).toBe('c');
    });

    it('preserves array position for tied scores', () => {
      const paths = [
        makePath('first', 60, ViabilityLabel.Viable),
        makePath('second', 60, ViabilityLabel.Viable),
        makePath('third', 60, ViabilityLabel.Viable),
      ];
      const result = engine.selectTopPaths(paths);
      expect(result).toHaveLength(3);
      // Sort is stable; original order preserved for ties
      expect(result[0]!.victoryConditionId).toBe('first');
      expect(result[1]!.victoryConditionId).toBe('second');
      expect(result[2]!.victoryConditionId).toBe('third');
    });

    it('returns all non-foreclosed when count exceeds available', () => {
      const paths = [
        makePath('a', 80, ViabilityLabel.Favorable),
        makePath('b', 60, ViabilityLabel.Viable),
      ];
      const result = engine.selectTopPaths(paths, 5);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. scoreAction
  // ─────────────────────────────────────────────────────────────────────────

  describe('scoreAction', () => {
    it('scores impact 50, cost 0, risk 0 → capped at 100', () => {
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 50, resourceCost: 0, riskLevel: 0 });
      expect(engine.scoreAction(action)).toBe(100);
    });

    it('scores impact 30, cost 20, risk 10 → 40', () => {
      // 30*2 - 20*0.5 - 10*1 = 60 - 10 - 10 = 40
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 30, resourceCost: 20, riskLevel: 10 });
      expect(engine.scoreAction(action)).toBe(40);
    });

    it('clamps negative scores to 0', () => {
      // 0*2 - 100*0.5 - 100*1 = 0 - 50 - 100 = -150 → 0
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 0, resourceCost: 100, riskLevel: 100 });
      expect(engine.scoreAction(action)).toBe(0);
    });

    it('caps at 100 for very high impact', () => {
      // 80*2 - 0 - 0 = 160 → 100
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 80, resourceCost: 0, riskLevel: 0 });
      expect(engine.scoreAction(action)).toBe(100);
    });

    it('scores impact 10, cost 10, risk 5 → 10', () => {
      // 10*2 - 10*0.5 - 5*1 = 20 - 5 - 5 = 10
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 10, resourceCost: 10, riskLevel: 5 });
      expect(engine.scoreAction(action)).toBe(10);
    });

    it('scores all zeros → 0', () => {
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 0, resourceCost: 0, riskLevel: 0 });
      expect(engine.scoreAction(action)).toBe(0);
    });

    it('scores exactly at 100 boundary → 100', () => {
      // 50*2 - 0 - 0 = 100 exactly
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 50, resourceCost: 0, riskLevel: 0 });
      expect(engine.scoreAction(action)).toBe(100);
    });

    it('handles fractional result correctly', () => {
      // 15*2 - 7*0.5 - 3*1 = 30 - 3.5 - 3 = 23.5
      const action = makeAction({ actionId: 'a', name: 'A', targetVictoryPath: 'p', expectedImpact: 15, resourceCost: 7, riskLevel: 3 });
      expect(engine.scoreAction(action)).toBeCloseTo(23.5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. rankActionsForPath
  // ─────────────────────────────────────────────────────────────────────────

  describe('rankActionsForPath', () => {
    it('returns empty when no actions match the path', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'other' }),
      ];
      const result = engine.rankActionsForPath(actions, 'target');
      expect(result).toEqual([]);
    });

    it('ranks 3 matching actions when maxActions=5', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco', expectedImpact: 20 }),
        makeAction({ actionId: 'a2', name: 'A2', targetVictoryPath: 'eco', expectedImpact: 40 }),
        makeAction({ actionId: 'a3', name: 'A3', targetVictoryPath: 'eco', expectedImpact: 30 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco');
      expect(result).toHaveLength(3);
    });

    it('truncates to maxActions=5 when 6 matching actions exist', () => {
      const actions = Array.from({ length: 6 }, (_, i) =>
        makeAction({ actionId: `a${i}`, name: `A${i}`, targetVictoryPath: 'mil', expectedImpact: (i + 1) * 5 }),
      );
      const result = engine.rankActionsForPath(actions, 'mil');
      expect(result).toHaveLength(5);
    });

    it('assigns 1-based sequential ranks', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco', expectedImpact: 40 }),
        makeAction({ actionId: 'a2', name: 'A2', targetVictoryPath: 'eco', expectedImpact: 20 }),
        makeAction({ actionId: 'a3', name: 'A3', targetVictoryPath: 'eco', expectedImpact: 30 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco');
      expect(result[0]!.rank).toBe(1);
      expect(result[1]!.rank).toBe(2);
      expect(result[2]!.rank).toBe(3);
    });

    it('sorts by compositeScore descending', () => {
      const actions = [
        makeAction({ actionId: 'low', name: 'Low', targetVictoryPath: 'eco', expectedImpact: 10 }),
        makeAction({ actionId: 'high', name: 'High', targetVictoryPath: 'eco', expectedImpact: 50 }),
        makeAction({ actionId: 'mid', name: 'Mid', targetVictoryPath: 'eco', expectedImpact: 30 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco');
      expect(result[0]!.action.actionId).toBe('high');
      expect(result[1]!.action.actionId).toBe('mid');
      expect(result[2]!.action.actionId).toBe('low');
    });

    it('excludes actions targeting other paths', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco', expectedImpact: 40 }),
        makeAction({ actionId: 'a2', name: 'A2', targetVictoryPath: 'mil', expectedImpact: 50 }),
        makeAction({ actionId: 'a3', name: 'A3', targetVictoryPath: 'eco', expectedImpact: 30 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco');
      expect(result).toHaveLength(2);
      expect(result.every(r => r.action.targetVictoryPath === 'eco')).toBe(true);
    });

    it('respects custom maxActions=2', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco', expectedImpact: 40 }),
        makeAction({ actionId: 'a2', name: 'A2', targetVictoryPath: 'eco', expectedImpact: 20 }),
        makeAction({ actionId: 'a3', name: 'A3', targetVictoryPath: 'eco', expectedImpact: 30 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco', 2);
      expect(result).toHaveLength(2);
      expect(result[0]!.rank).toBe(1);
      expect(result[1]!.rank).toBe(2);
    });

    it('includes compositeScore on each ranked action', () => {
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco', expectedImpact: 30, resourceCost: 10, riskLevel: 5 }),
      ];
      const result = engine.rankActionsForPath(actions, 'eco');
      // 30*2 - 10*0.5 - 5*1 = 60 - 5 - 5 = 50
      expect(result[0]!.compositeScore).toBe(50);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. generateRecommendations
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateRecommendations', () => {
    const factionId = 'USA' as FactionId;
    const turn = 5 as TurnNumber;

    it('returns empty recommendations when no non-foreclosed paths exist', () => {
      const paths = [
        makePath('a', 5, ViabilityLabel.Foreclosed),
        makePath('b', 3, ViabilityLabel.Foreclosed),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      expect(result.recommendations).toHaveLength(0);
    });

    it('returns 3 recommendations for 3 viable paths with actions', () => {
      const paths = [
        makePath('eco', 80, ViabilityLabel.Favorable),
        makePath('mil', 60, ViabilityLabel.Viable),
        makePath('dip', 50, ViabilityLabel.Viable),
      ];
      const actions = [
        makeAction({ actionId: 'a1', name: 'A1', targetVictoryPath: 'eco' }),
        makeAction({ actionId: 'a2', name: 'A2', targetVictoryPath: 'mil' }),
        makeAction({ actionId: 'a3', name: 'A3', targetVictoryPath: 'dip' }),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, actions, { trend: 1 });
      expect(result.recommendations).toHaveLength(3);
    });

    it('returns Low confidence when trajectory is null', () => {
      const paths = [
        makePath('eco', 80, ViabilityLabel.Favorable),
        makePath('mil', 60, ViabilityLabel.Viable),
        makePath('dip', 50, ViabilityLabel.Viable),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], null);
      expect(result.confidence).toBe(ConfidenceLevelEnum.Low);
    });

    it('returns Medium confidence when fewer than 3 non-foreclosed paths', () => {
      const paths = [
        makePath('eco', 80, ViabilityLabel.Favorable),
        makePath('mil', 60, ViabilityLabel.Viable),
        makePath('dip', 5, ViabilityLabel.Foreclosed),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      expect(result.confidence).toBe(ConfidenceLevelEnum.Medium);
    });

    it('returns High confidence with ≥ 3 non-foreclosed and trajectory', () => {
      const paths = [
        makePath('eco', 80, ViabilityLabel.Favorable),
        makePath('mil', 60, ViabilityLabel.Viable),
        makePath('dip', 50, ViabilityLabel.Viable),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      expect(result.confidence).toBe(ConfidenceLevelEnum.High);
    });

    it('includes correct factionId and turn in the result', () => {
      const paths = [makePath('eco', 80, ViabilityLabel.Favorable)];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      expect(result.factionId).toBe(factionId);
      expect(result.turn).toBe(turn);
    });

    it('each recommendation has victoryPathId and currentViability', () => {
      const paths = [
        makePath('eco', 80, ViabilityLabel.Favorable),
        makePath('mil', 60, ViabilityLabel.Viable),
        makePath('dip', 50, ViabilityLabel.Viable),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      for (const rec of result.recommendations) {
        expect(rec.victoryPathId).toBeDefined();
        expect(typeof rec.currentViability).toBe('number');
      }
    });

    it('recommendations are ordered by path viability score descending', () => {
      const paths = [
        makePath('low', 30, ViabilityLabel.Viable),
        makePath('high', 90, ViabilityLabel.Imminent),
        makePath('mid', 60, ViabilityLabel.Viable),
      ];
      const result = engine.generateRecommendations(factionId, turn, paths, [], { trend: 1 });
      expect(result.recommendations[0]!.victoryPathId).toBe('high');
      expect(result.recommendations[1]!.victoryPathId).toBe('mid');
      expect(result.recommendations[2]!.victoryPathId).toBe('low');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. computeConsistency
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeConsistency', () => {
    it('returns neutral defaults for empty actions', () => {
      const result = engine.computeConsistency([]);
      expect(result.score).toBe(50);
      expect(result.dominantPath).toBe('');
      expect(result.hasFocusBonus).toBe(false);
      expect(result.hasDriftPenalty).toBe(false);
      expect(result.effectivenessModifier).toBe(0);
      expect(result.popularityDecayPerTurn).toBe(0);
    });

    it('scores 100 with focus bonus when all 6 actions are the same path', () => {
      const actions = Array.from({ length: 6 }, (_, i) => makeConsistencyEntry(i + 1, 'eco'));
      const result = engine.computeConsistency(actions);
      expect(result.score).toBe(100);
      expect(result.dominantPath).toBe('eco');
      expect(result.hasFocusBonus).toBe(true);
      expect(result.hasDriftPenalty).toBe(false);
    });

    it('scores ~83.3 when 5 of 6 actions align to the same path', () => {
      const actions = [
        makeConsistencyEntry(1, 'eco'),
        makeConsistencyEntry(2, 'eco'),
        makeConsistencyEntry(3, 'eco'),
        makeConsistencyEntry(4, 'eco'),
        makeConsistencyEntry(5, 'eco'),
        makeConsistencyEntry(6, 'mil'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.score).toBeCloseTo(83.33, 1);
      expect(result.hasFocusBonus).toBe(true);
    });

    it('scores ~16.7 with drift penalty when all 6 actions are different paths', () => {
      const actions = [
        makeConsistencyEntry(1, 'a'),
        makeConsistencyEntry(2, 'b'),
        makeConsistencyEntry(3, 'c'),
        makeConsistencyEntry(4, 'd'),
        makeConsistencyEntry(5, 'e'),
        makeConsistencyEntry(6, 'f'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.score).toBeCloseTo(16.67, 1);
      expect(result.hasDriftPenalty).toBe(true);
      expect(result.hasFocusBonus).toBe(false);
    });

    it('scores 50 (no bonus, no penalty) when 3 of 6 actions align', () => {
      const actions = [
        makeConsistencyEntry(1, 'eco'),
        makeConsistencyEntry(2, 'eco'),
        makeConsistencyEntry(3, 'eco'),
        makeConsistencyEntry(4, 'mil'),
        makeConsistencyEntry(5, 'dip'),
        makeConsistencyEntry(6, 'tech'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.score).toBe(50);
      expect(result.hasFocusBonus).toBe(false);
      expect(result.hasDriftPenalty).toBe(false);
    });

    it('uses only last windowSize entries when more actions provided', () => {
      const actions = [
        makeConsistencyEntry(1, 'old1'),
        makeConsistencyEntry(2, 'old2'),
        makeConsistencyEntry(3, 'old3'),
        makeConsistencyEntry(4, 'eco'),
        makeConsistencyEntry(5, 'eco'),
        makeConsistencyEntry(6, 'eco'),
      ];
      const result = engine.computeConsistency(actions, 3);
      expect(result.score).toBe(100);
      expect(result.dominantPath).toBe('eco');
    });

    it('identifies the most frequent path as dominantPath', () => {
      const actions = [
        makeConsistencyEntry(1, 'eco'),
        makeConsistencyEntry(2, 'mil'),
        makeConsistencyEntry(3, 'eco'),
        makeConsistencyEntry(4, 'eco'),
        makeConsistencyEntry(5, 'mil'),
        makeConsistencyEntry(6, 'eco'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.dominantPath).toBe('eco');
    });

    it('returns effectivenessModifier +0.05 for focus bonus', () => {
      const actions = Array.from({ length: 6 }, (_, i) => makeConsistencyEntry(i + 1, 'eco'));
      const result = engine.computeConsistency(actions);
      expect(result.effectivenessModifier).toBe(0.05);
    });

    it('returns effectivenessModifier -0.05 for drift penalty', () => {
      const actions = [
        makeConsistencyEntry(1, 'a'),
        makeConsistencyEntry(2, 'b'),
        makeConsistencyEntry(3, 'c'),
        makeConsistencyEntry(4, 'd'),
        makeConsistencyEntry(5, 'e'),
        makeConsistencyEntry(6, 'f'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.effectivenessModifier).toBe(-0.05);
    });

    it('returns effectivenessModifier 0 for normal consistency', () => {
      const actions = [
        makeConsistencyEntry(1, 'eco'),
        makeConsistencyEntry(2, 'eco'),
        makeConsistencyEntry(3, 'eco'),
        makeConsistencyEntry(4, 'mil'),
        makeConsistencyEntry(5, 'mil'),
        makeConsistencyEntry(6, 'dip'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.effectivenessModifier).toBe(0);
    });

    it('returns popularityDecayPerTurn -2 for drift penalty', () => {
      const actions = [
        makeConsistencyEntry(1, 'a'),
        makeConsistencyEntry(2, 'b'),
        makeConsistencyEntry(3, 'c'),
        makeConsistencyEntry(4, 'd'),
        makeConsistencyEntry(5, 'e'),
        makeConsistencyEntry(6, 'f'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.popularityDecayPerTurn).toBe(-2);
    });

    it('returns popularityDecayPerTurn 0 for normal consistency', () => {
      const actions = [
        makeConsistencyEntry(1, 'eco'),
        makeConsistencyEntry(2, 'eco'),
        makeConsistencyEntry(3, 'eco'),
        makeConsistencyEntry(4, 'mil'),
        makeConsistencyEntry(5, 'mil'),
        makeConsistencyEntry(6, 'dip'),
      ];
      const result = engine.computeConsistency(actions);
      expect(result.popularityDecayPerTurn).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. applyEffectivenessModifier
  // ─────────────────────────────────────────────────────────────────────────

  describe('applyEffectivenessModifier', () => {
    it('applies focus bonus: base 1.0 → 1.05', () => {
      const consistency: ConsistencyResult = {
        score: 100,
        dominantPath: 'eco',
        hasFocusBonus: true,
        hasDriftPenalty: false,
        effectivenessModifier: 0.05,
        popularityDecayPerTurn: 0,
      };
      expect(engine.applyEffectivenessModifier(1.0, consistency)).toBeCloseTo(1.05);
    });

    it('applies drift penalty: base 1.0 → 0.95', () => {
      const consistency: ConsistencyResult = {
        score: 10,
        dominantPath: 'a',
        hasFocusBonus: false,
        hasDriftPenalty: true,
        effectivenessModifier: -0.05,
        popularityDecayPerTurn: -2,
      };
      expect(engine.applyEffectivenessModifier(1.0, consistency)).toBeCloseTo(0.95);
    });

    it('applies neutral modifier: base 1.0 → 1.0', () => {
      const consistency: ConsistencyResult = {
        score: 50,
        dominantPath: 'eco',
        hasFocusBonus: false,
        hasDriftPenalty: false,
        effectivenessModifier: 0,
        popularityDecayPerTurn: 0,
      };
      expect(engine.applyEffectivenessModifier(1.0, consistency)).toBe(1.0);
    });

    it('returns 0 when base is 0 even with focus bonus', () => {
      const consistency: ConsistencyResult = {
        score: 100,
        dominantPath: 'eco',
        hasFocusBonus: true,
        hasDriftPenalty: false,
        effectivenessModifier: 0.05,
        popularityDecayPerTurn: 0,
      };
      expect(engine.applyEffectivenessModifier(0, consistency)).toBe(0);
    });

    it('clamps at 2 for large base values', () => {
      const consistency: ConsistencyResult = {
        score: 100,
        dominantPath: 'eco',
        hasFocusBonus: true,
        hasDriftPenalty: false,
        effectivenessModifier: 0.05,
        popularityDecayPerTurn: 0,
      };
      // 3.0 * 1.05 = 3.15 → clamped to 2
      expect(engine.applyEffectivenessModifier(3.0, consistency)).toBe(2);
    });

    it('clamps at 0 for negative base values', () => {
      const consistency: ConsistencyResult = {
        score: 10,
        dominantPath: 'a',
        hasFocusBonus: false,
        hasDriftPenalty: true,
        effectivenessModifier: -0.05,
        popularityDecayPerTurn: -2,
      };
      // -1 * 0.95 = -0.95 → clamped to 0
      expect(engine.applyEffectivenessModifier(-1, consistency)).toBe(0);
    });
  });
});
