/**
 * Rival Trajectory Estimation & Strategic Pivot Detection Engine — Tests
 *
 * @see FR-1405 — Rival Trajectories
 * @see FR-1406 — Strategic Pivot Detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RivalPivotEngine } from '@/engine/rival-pivot-engine';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const RUSSIA = 'russia' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 10 as TurnNumber;

describe('RivalPivotEngine', () => {
  let engine: RivalPivotEngine;

  beforeEach(() => {
    engine = new RivalPivotEngine(GAME_CONFIG.advisory);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // estimateRivalTrajectory
  // ─────────────────────────────────────────────────────────────────────────

  describe('estimateRivalTrajectory', () => {
    const viabilities = [
      { victoryConditionId: 'econ', viabilityScore: 80, turnsEstimate: 10 },
      { victoryConditionId: 'mil', viabilityScore: 60, turnsEstimate: 20 },
    ];

    it('returns the highest-viability VC with high clarity', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: viabilities,
        intelClarity: 70,
        currentTurn: TURN,
      });

      expect(result.closestVictoryCondition).toBe('econ');
      expect(result.estimatedTurnsToVictory).toBe(10);
      expect(result.accuracyBand).toBe(3);
      expect(result.confidence).toBe('high');
    });

    it('uses the low-clarity accuracy band when clarity is below threshold', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: viabilities,
        intelClarity: 30,
        currentTurn: TURN,
      });

      expect(result.accuracyBand).toBe(8);
      expect(result.confidence).toBe('low');
    });

    it('treats clarity exactly at the threshold as high clarity', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: viabilities,
        intelClarity: 50,
        currentTurn: TURN,
      });

      expect(result.accuracyBand).toBe(3);
      expect(result.confidence).toBe('high');
    });

    it('treats clarity one below threshold as low clarity', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: viabilities,
        intelClarity: 49,
        currentTurn: TURN,
      });

      expect(result.accuracyBand).toBe(8);
      expect(result.confidence).toBe('low');
    });

    it('returns none with null turns when viabilities are empty', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: [],
        intelClarity: 70,
        currentTurn: TURN,
      });

      expect(result.closestVictoryCondition).toBe('none');
      expect(result.estimatedTurnsToVictory).toBe(null);
    });

    it('includes the rival faction and ±accuracyBand in the reason', () => {
      const result = engine.estimateRivalTrajectory({
        rivalFactionId: CHINA,
        victoryViabilities: viabilities,
        intelClarity: 70,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('china');
      expect(result.reason).toContain('±3');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // assessRivalLeaderboard
  // ─────────────────────────────────────────────────────────────────────────

  describe('assessRivalLeaderboard', () => {
    it('sorts rivals by estimatedTurnsToVictory ascending with nulls last', () => {
      const result = engine.assessRivalLeaderboard({
        rivals: [
          {
            rivalFactionId: CHINA,
            victoryViabilities: [{ victoryConditionId: 'econ', viabilityScore: 80, turnsEstimate: 10 }],
            intelClarity: 70,
            currentTurn: TURN,
          },
          {
            rivalFactionId: RUSSIA,
            victoryViabilities: [{ victoryConditionId: 'mil', viabilityScore: 90, turnsEstimate: 5 }],
            intelClarity: 70,
            currentTurn: TURN,
          },
          {
            rivalFactionId: IRAN,
            victoryViabilities: [],
            intelClarity: 70,
            currentTurn: TURN,
          },
        ],
        currentTurn: TURN,
      });

      expect(result.entries.length).toBe(3);
      expect(result.entries[0]!.estimatedTurnsToVictory).toBe(5);
      expect(result.entries[1]!.estimatedTurnsToVictory).toBe(10);
      expect(result.entries[2]!.estimatedTurnsToVictory).toBe(null);
    });

    it('keeps nulls in stable order when all estimates are null', () => {
      const result = engine.assessRivalLeaderboard({
        rivals: [
          {
            rivalFactionId: CHINA,
            victoryViabilities: [],
            intelClarity: 70,
            currentTurn: TURN,
          },
          {
            rivalFactionId: RUSSIA,
            victoryViabilities: [],
            intelClarity: 70,
            currentTurn: TURN,
          },
        ],
        currentTurn: TURN,
      });

      expect(result.entries.length).toBe(2);
      expect(result.entries[0]!.estimatedTurnsToVictory).toBe(null);
      expect(result.entries[1]!.estimatedTurnsToVictory).toBe(null);
    });

    it('returns empty entries for an empty rivals array', () => {
      const result = engine.assessRivalLeaderboard({
        rivals: [],
        currentTurn: TURN,
      });

      expect(result.entries.length).toBe(0);
    });

    it('includes the faction count and turn in the reason', () => {
      const result = engine.assessRivalLeaderboard({
        rivals: [
          {
            rivalFactionId: CHINA,
            victoryViabilities: [{ victoryConditionId: 'econ', viabilityScore: 80, turnsEstimate: 10 }],
            intelClarity: 70,
            currentTurn: TURN,
          },
        ],
        currentTurn: TURN,
      });

      expect(result.reason).toContain('1');
      expect(result.reason).toContain('10');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // detectStrategicPivot
  // ─────────────────────────────────────────────────────────────────────────

  describe('detectStrategicPivot', () => {
    it('detects a pivot when consecutive tail entries meet the threshold and path changed', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [
          { turn: 1 as TurnNumber, topVictoryPath: 'mil' },
          { turn: 2 as TurnNumber, topVictoryPath: 'mil' },
        ],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.pivotDetected).toBe(true);
      expect(result.consecutiveTurnsChanged).toBe(2);
    });

    it('does NOT detect a pivot when only 1 consecutive tail entry matches (below threshold)', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [
          { turn: 1 as TurnNumber, topVictoryPath: 'econ' },
          { turn: 2 as TurnNumber, topVictoryPath: 'mil' },
        ],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.pivotDetected).toBe(false);
      expect(result.consecutiveTurnsChanged).toBe(1);
    });

    it('detects a pivot when history tail has 3 consecutive matches', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [
          { turn: 1 as TurnNumber, topVictoryPath: 'econ' },
          { turn: 2 as TurnNumber, topVictoryPath: 'mil' },
          { turn: 3 as TurnNumber, topVictoryPath: 'mil' },
        ],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.pivotDetected).toBe(true);
      expect(result.consecutiveTurnsChanged).toBe(2);
    });

    it('does NOT detect a pivot when currentTopPath equals previousTopPath', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [
          { turn: 1 as TurnNumber, topVictoryPath: 'mil' },
          { turn: 2 as TurnNumber, topVictoryPath: 'mil' },
        ],
        currentTopPath: 'mil',
        previousTopPath: 'mil',
        currentTurn: TURN,
      });

      expect(result.pivotDetected).toBe(false);
    });

    it('does NOT detect a pivot with an empty pivotHistory', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.pivotDetected).toBe(false);
      expect(result.consecutiveTurnsChanged).toBe(0);
    });

    it('includes "Strategic pivot detected" in the reason when pivot fires', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [
          { turn: 1 as TurnNumber, topVictoryPath: 'mil' },
          { turn: 2 as TurnNumber, topVictoryPath: 'mil' },
        ],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.reason).toContain('Strategic pivot detected');
    });

    it('includes "No strategic pivot" in the reason when no pivot detected', () => {
      const result = engine.detectStrategicPivot({
        factionId: US,
        pivotHistory: [],
        currentTopPath: 'mil',
        previousTopPath: 'econ',
        currentTurn: TURN,
      });

      expect(result.reason).toContain('No strategic pivot');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateCrossroadsNotification
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateCrossroadsNotification', () => {
    it('returns Low risk when new path is significantly stronger (diff > 20)', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 80,
        currentTurn: TURN,
      });

      expect(result.viabilityDifference).toBe(30);
      expect(result.transitionRisk).toBe('Low — new path significantly stronger');
    });

    it('returns Moderate risk for marginal improvement (0 < diff <= 20)', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 55,
        currentTurn: TURN,
      });

      expect(result.viabilityDifference).toBe(5);
      expect(result.transitionRisk).toBe('Moderate — marginal improvement');
    });

    it('returns Moderate risk when paths are equally viable (diff === 0)', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 50,
        currentTurn: TURN,
      });

      expect(result.viabilityDifference).toBe(0);
      expect(result.transitionRisk).toBe('Moderate — paths equally viable');
    });

    it('returns High risk when abandoning a stronger path (diff < 0)', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 60,
        newPath: 'mil',
        newPathViability: 40,
        currentTurn: TURN,
      });

      expect(result.viabilityDifference).toBe(-20);
      expect(result.transitionRisk).toBe('High — abandoning a stronger path');
    });

    it('always sets the title to Strategic Crossroads', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 80,
        currentTurn: TURN,
      });

      expect(result.title).toBe('Strategic Crossroads');
    });

    it('includes the old path name and viability in oldPathSummary', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 80,
        currentTurn: TURN,
      });

      expect(result.oldPathSummary).toContain('econ');
      expect(result.oldPathSummary).toContain('50');
    });

    it('includes the new path name and viability in newPathSummary', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 80,
        currentTurn: TURN,
      });

      expect(result.newPathSummary).toContain('mil');
      expect(result.newPathSummary).toContain('80');
    });

    it('includes the factionId and turn in the reason', () => {
      const result = engine.generateCrossroadsNotification({
        factionId: US,
        oldPath: 'econ',
        oldPathViability: 50,
        newPath: 'mil',
        newPathViability: 80,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('10');
    });
  });
});
