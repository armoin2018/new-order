/**
 * Strategy Scoring Engine — Unit Tests
 *
 * Tests for the StrategyScoringEngine class covering consistency evaluation,
 * composite score computation, grade classification, preset weighting, and
 * mid-game preset switching.
 *
 * @see FR-1412 — Strategic Consistency (rolling window, focus bonus, drift penalty)
 * @see FR-1413 — Composite Strategy Score (weighted formula, grade classification)
 * @see FR-1414 — Strategic Presets / Grand Strategy (preset weighting, mid-game switch)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyScoringEngine } from '@/engine/strategy-scoring-engine';
import { GAME_CONFIG } from '@/engine/config';
import { GrandStrategyPreset } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const TURN = 10 as TurnNumber;

describe('StrategyScoringEngine', () => {
  let engine: StrategyScoringEngine;

  beforeEach(() => {
    engine = new StrategyScoringEngine(GAME_CONFIG.advisory);
  });

  /* ---------------------------------------------------------------- */
  /*  evaluateConsistency                                              */
  /* ---------------------------------------------------------------- */

  describe('evaluateConsistency', () => {
    it('returns 100% consistency and focus bonus when all 6 actions align to one path', () => {
      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: Array.from({ length: 6 }, (_, i) => ({
          turn: (i + 1) as TurnNumber,
          alignedVictoryPath: 'econ',
        })),
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBe(100);
      expect(result.dominantPath).toBe('econ');
      expect(result.hasFocusBonus).toBe(true);
      expect(result.effectivenessModifier).toBe(0.05);
      expect(result.headlineTriggered).toBe(false);
      expect(result.headline).toBe('');
    });

    it('returns ~83.33% consistency and focus bonus when 5 of 6 actions align', () => {
      const actions = [
        ...Array.from({ length: 5 }, (_, i) => ({
          turn: (i + 1) as TurnNumber,
          alignedVictoryPath: 'econ',
        })),
        { turn: 6 as TurnNumber, alignedVictoryPath: 'mil' },
      ];

      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: actions,
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBeCloseTo(83.33, 1);
      expect(result.dominantPath).toBe('econ');
      expect(result.hasFocusBonus).toBe(true);
      expect(result.effectivenessModifier).toBe(0.05);
    });

    it('returns 50% consistency with no bonus and no penalty for moderate diversity (3/2/1)', () => {
      const actions = [
        { turn: 1 as TurnNumber, alignedVictoryPath: 'econ' },
        { turn: 2 as TurnNumber, alignedVictoryPath: 'econ' },
        { turn: 3 as TurnNumber, alignedVictoryPath: 'econ' },
        { turn: 4 as TurnNumber, alignedVictoryPath: 'mil' },
        { turn: 5 as TurnNumber, alignedVictoryPath: 'mil' },
        { turn: 6 as TurnNumber, alignedVictoryPath: 'dip' },
      ];

      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: actions,
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBe(50);
      expect(result.dominantPath).toBe('econ');
      expect(result.hasFocusBonus).toBe(false);
      expect(result.hasDriftPenalty).toBe(false);
      expect(result.effectivenessModifier).toBe(0);
    });

    it('returns ~16.67% consistency with drift penalty when all 6 actions differ', () => {
      const actions = [
        { turn: 1 as TurnNumber, alignedVictoryPath: 'econ' },
        { turn: 2 as TurnNumber, alignedVictoryPath: 'mil' },
        { turn: 3 as TurnNumber, alignedVictoryPath: 'dip' },
        { turn: 4 as TurnNumber, alignedVictoryPath: 'surv' },
        { turn: 5 as TurnNumber, alignedVictoryPath: 'nuke' },
        { turn: 6 as TurnNumber, alignedVictoryPath: 'tech' },
      ];

      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: actions,
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBeCloseTo(16.67, 1);
      expect(result.hasDriftPenalty).toBe(true);
      expect(result.effectivenessModifier).toBe(-0.05);
      expect(result.headlineTriggered).toBe(true);
      expect(result.headline).toBe('Indecisive Leadership');
      expect(result.popularityDecayPerTurn).toBe(-2);
    });

    it('returns neutral score of 50 when recentActions is empty', () => {
      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: [],
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBe(50);
      expect(result.dominantPath).toBe('');
      expect(result.hasFocusBonus).toBe(false);
      expect(result.hasDriftPenalty).toBe(false);
      expect(result.effectivenessModifier).toBe(0);
      expect(result.popularityDecayPerTurn).toBe(0);
      expect(result.headlineTriggered).toBe(false);
    });

    it('slices to last 6 actions when more than 6 are provided', () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        turn: (i + 1) as TurnNumber,
        alignedVictoryPath: i < 4 ? 'mil' : 'econ', // first 4 mil, last 6 econ
      }));
      // window = actions[4..9] → 6 'econ' entries

      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: actions,
        currentTurn: TURN,
      });

      expect(result.consistencyScore).toBe(100);
      expect(result.dominantPath).toBe('econ');
      expect(result.hasFocusBonus).toBe(true);
    });

    it('includes factionId and state label in reason string', () => {
      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: Array.from({ length: 6 }, (_, i) => ({
          turn: (i + 1) as TurnNumber,
          alignedVictoryPath: 'econ',
        })),
        currentTurn: TURN,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('Focus Bonus');
    });

    it('includes "Drift Penalty" in reason when drift penalty is active', () => {
      const actions = [
        { turn: 1 as TurnNumber, alignedVictoryPath: 'econ' },
        { turn: 2 as TurnNumber, alignedVictoryPath: 'mil' },
        { turn: 3 as TurnNumber, alignedVictoryPath: 'dip' },
        { turn: 4 as TurnNumber, alignedVictoryPath: 'surv' },
        { turn: 5 as TurnNumber, alignedVictoryPath: 'nuke' },
        { turn: 6 as TurnNumber, alignedVictoryPath: 'tech' },
      ];

      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: actions,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('Drift Penalty');
    });

    it('includes "Normal" in reason when no bonus or penalty applies', () => {
      const result = engine.evaluateConsistency({
        factionId: US,
        recentActions: [],
        currentTurn: TURN,
      });

      expect(result.reason).toContain('Normal');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  computeCompositeScore                                            */
  /* ---------------------------------------------------------------- */

  describe('computeCompositeScore', () => {
    it('computes weighted composite score correctly (80/70/60 → 71.0, grade B)', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 80,
        consistencyScore: 70,
        nearestLossMargin: 60,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBeCloseTo(71.0, 1);
      expect(result.grade).toBe('B');
    });

    it('returns perfect score of 100 and grade S for max inputs', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 100,
        consistencyScore: 100,
        nearestLossMargin: 100,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBe(100);
      expect(result.grade).toBe('S');
    });

    it('returns score 0 and grade F for all-zero inputs', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 0,
        consistencyScore: 0,
        nearestLossMargin: 0,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('returns score 90 and grade S for 90/90/90 inputs', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 90,
        consistencyScore: 90,
        nearestLossMargin: 90,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBeCloseTo(90.0, 1);
      expect(result.grade).toBe('S');
    });

    it('returns score 75 and grade A for 75/75/75 inputs', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 75,
        consistencyScore: 75,
        nearestLossMargin: 75,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBeCloseTo(75.0, 1);
      expect(result.grade).toBe('A');
    });

    it('clamps composite score to 100 when inputs exceed 100', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 200,
        consistencyScore: 200,
        nearestLossMargin: 200,
        currentTurn: TURN,
      });

      expect(result.strategyScore).toBe(100);
      expect(result.grade).toBe('S');
    });

    it('includes factionId, score, and grade in reason string', () => {
      const result = engine.computeCompositeScore({
        factionId: US,
        topViabilityScore: 80,
        consistencyScore: 70,
        nearestLossMargin: 60,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('71.0');
      expect(result.reason).toContain('B');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  classifyGrade                                                    */
  /* ---------------------------------------------------------------- */

  describe('classifyGrade', () => {
    it('returns S for score 90', () => {
      expect(engine.classifyGrade(90)).toBe('S');
    });

    it('returns A for score 89', () => {
      expect(engine.classifyGrade(89)).toBe('A');
    });

    it('returns A for score 75', () => {
      expect(engine.classifyGrade(75)).toBe('A');
    });

    it('returns B for score 74', () => {
      expect(engine.classifyGrade(74)).toBe('B');
    });

    it('returns B for score 60', () => {
      expect(engine.classifyGrade(60)).toBe('B');
    });

    it('returns C for score 59', () => {
      expect(engine.classifyGrade(59)).toBe('C');
    });

    it('returns C for score 45', () => {
      expect(engine.classifyGrade(45)).toBe('C');
    });

    it('returns D for score 44', () => {
      expect(engine.classifyGrade(44)).toBe('D');
    });

    it('returns D for score 30', () => {
      expect(engine.classifyGrade(30)).toBe('D');
    });

    it('returns F for score 29', () => {
      expect(engine.classifyGrade(29)).toBe('F');
    });

    it('returns F for score 0', () => {
      expect(engine.classifyGrade(0)).toBe('F');
    });

    it('returns S for score 100', () => {
      expect(engine.classifyGrade(100)).toBe('S');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getPresetWeighting                                               */
  /* ---------------------------------------------------------------- */

  describe('getPresetWeighting', () => {
    it('returns EconomicHegemon weighting with economic=2.0 and isAdaptive=false', () => {
      const result = engine.getPresetWeighting({
        factionId: US,
        preset: GrandStrategyPreset.EconomicHegemon,
        currentTurn: TURN,
      });

      expect(result.preset).toBe('EconomicHegemon');
      expect(result.weighting.economic).toBe(2.0);
      expect(result.weighting.military).toBe(0.5);
      expect(result.weighting.diplomatic).toBe(1.0);
      expect(result.weighting.survival).toBe(0.5);
      expect(result.isAdaptive).toBe(false);
    });

    it('returns Adaptive weighting with all 1.0 and isAdaptive=true', () => {
      const result = engine.getPresetWeighting({
        factionId: US,
        preset: GrandStrategyPreset.Adaptive,
        currentTurn: TURN,
      });

      expect(result.weighting.economic).toBe(1.0);
      expect(result.weighting.military).toBe(1.0);
      expect(result.weighting.diplomatic).toBe(1.0);
      expect(result.weighting.survival).toBe(1.0);
      expect(result.isAdaptive).toBe(true);
    });

    it('returns MilitarySuperpower weighting with military=2.0', () => {
      const result = engine.getPresetWeighting({
        factionId: US,
        preset: GrandStrategyPreset.MilitarySuperpower,
        currentTurn: TURN,
      });

      expect(result.weighting.military).toBe(2.0);
      expect(result.weighting.economic).toBe(0.5);
      expect(result.weighting.diplomatic).toBe(0.5);
      expect(result.weighting.survival).toBe(1.0);
      expect(result.isAdaptive).toBe(false);
    });

    it('includes factionId and preset name in reason string', () => {
      const result = engine.getPresetWeighting({
        factionId: US,
        preset: GrandStrategyPreset.EconomicHegemon,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('EconomicHegemon');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  evaluatePresetSwitch                                             */
  /* ---------------------------------------------------------------- */

  describe('evaluatePresetSwitch', () => {
    it('resets consistency to 0 when switching to a different preset', () => {
      const result = engine.evaluatePresetSwitch({
        factionId: US,
        oldPreset: GrandStrategyPreset.EconomicHegemon,
        newPreset: GrandStrategyPreset.MilitarySuperpower,
        currentConsistencyScore: 75,
        currentTurn: TURN,
      });

      expect(result.newConsistencyScore).toBe(0);
      expect(result.consistencyReset).toBe(true);
    });

    it('preserves consistency when switching to the same preset (no-op)', () => {
      const result = engine.evaluatePresetSwitch({
        factionId: US,
        oldPreset: GrandStrategyPreset.Adaptive,
        newPreset: GrandStrategyPreset.Adaptive,
        currentConsistencyScore: 60,
        currentTurn: TURN,
      });

      expect(result.newConsistencyScore).toBe(60);
      expect(result.consistencyReset).toBe(false);
    });

    it('includes "consistency reset to 0" in reason when preset changes', () => {
      const result = engine.evaluatePresetSwitch({
        factionId: US,
        oldPreset: GrandStrategyPreset.EconomicHegemon,
        newPreset: GrandStrategyPreset.MilitarySuperpower,
        currentConsistencyScore: 75,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('consistency reset to 0');
    });

    it('includes "no change" in reason when preset stays the same', () => {
      const result = engine.evaluatePresetSwitch({
        factionId: US,
        oldPreset: GrandStrategyPreset.Adaptive,
        newPreset: GrandStrategyPreset.Adaptive,
        currentConsistencyScore: 60,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('no change');
    });
  });
});
