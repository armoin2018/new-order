/**
 * Tests for ProjectionWhatIfEngine — Multi-Horizon Strategic Projections
 * and What-If Scenario Simulator.
 *
 * @see FR-1402 — Multi-Horizon Strategic Projections
 * @see FR-1408 — What-If Scenario Simulator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectionWhatIfEngine } from '@/engine/projection-whatif-engine';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const TURN = 10 as TurnNumber;

describe('ProjectionWhatIfEngine', () => {
  let engine: ProjectionWhatIfEngine;

  beforeEach(() => {
    engine = new ProjectionWhatIfEngine(GAME_CONFIG.advisory);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // projectMetricsAtHorizon
  // ─────────────────────────────────────────────────────────────────────────

  describe('projectMetricsAtHorizon', () => {
    it('projects multiple metrics forward by the given horizon', () => {
      const result = engine.projectMetricsAtHorizon({
        currentMetrics: { stability: 60, gdp: 80 },
        perTurnTrajectory: { stability: 2, gdp: -1 },
        horizonTurns: 3,
      });

      const stability = result.find((m) => m.metricName === 'stability')!;
      expect(stability.currentValue).toBe(60);
      expect(stability.projectedValue).toBe(66);
      expect(stability.delta).toBe(6);

      const gdp = result.find((m) => m.metricName === 'gdp')!;
      expect(gdp.currentValue).toBe(80);
      expect(gdp.projectedValue).toBe(77);
      expect(gdp.delta).toBe(-3);
    });

    it('defaults trajectory to 0 when a metric has no trajectory entry', () => {
      const result = engine.projectMetricsAtHorizon({
        currentMetrics: { stability: 50 },
        perTurnTrajectory: {},
        horizonTurns: 5,
      });

      const stability = result.find((m) => m.metricName === 'stability')!;
      expect(stability.projectedValue).toBe(50);
      expect(stability.delta).toBe(0);
    });

    it('returns an empty array when currentMetrics is empty', () => {
      const result = engine.projectMetricsAtHorizon({
        currentMetrics: {},
        perTurnTrajectory: { stability: 1 },
        horizonTurns: 5,
      });

      expect(result).toEqual([]);
    });

    it('returns projected equal to current and delta 0 when horizonTurns is 0', () => {
      const result = engine.projectMetricsAtHorizon({
        currentMetrics: { stability: 60, gdp: 80 },
        perTurnTrajectory: { stability: 2, gdp: -1 },
        horizonTurns: 0,
      });

      for (const projection of result) {
        expect(projection.projectedValue).toBe(projection.currentValue);
        expect(projection.delta).toBe(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateMultiHorizonProjection
  // ─────────────────────────────────────────────────────────────────────────

  describe('generateMultiHorizonProjection', () => {
    it('returns exactly 3 horizons', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      expect(result.horizons.length).toBe(3);
    });

    it('computes the Immediate horizon at 3 turns with correct projection', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      const immediate = result.horizons[0]!;
      expect(immediate.horizonTurns).toBe(3);

      const stability = immediate.projections.find(
        (m) => m.metricName === 'stability',
      )!;
      expect(stability.projectedValue).toBe(53);
    });

    it('computes the MediumTerm horizon at 12 turns with correct projection', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      const mediumTerm = result.horizons[1]!;
      expect(mediumTerm.horizonTurns).toBe(12);

      const stability = mediumTerm.projections.find(
        (m) => m.metricName === 'stability',
      )!;
      expect(stability.projectedValue).toBe(62);
    });

    it('computes the Endgame horizon as (60 - currentTurn) turns', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      const endgame = result.horizons[2]!;
      expect(endgame.horizonTurns).toBe(50);

      const stability = endgame.projections.find(
        (m) => m.metricName === 'stability',
      )!;
      expect(stability.projectedValue).toBe(100);
    });

    it('clamps Endgame horizonTurns to 5 when currentTurn is 55', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: 55 as TurnNumber,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      const endgame = result.horizons[2]!;
      expect(endgame.horizonTurns).toBe(5);
    });

    it('sets Endgame horizonTurns to 0 when currentTurn equals 60', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: 60 as TurnNumber,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      const endgame = result.horizons[2]!;
      expect(endgame.horizonTurns).toBe(0);
    });

    it('includes factionId and turn in the reason string', () => {
      const result = engine.generateMultiHorizonProjection({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('10');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // simulateWhatIf
  // ─────────────────────────────────────────────────────────────────────────

  describe('simulateWhatIf', () => {
    it('applies action deltas and projects metrics over the immediate horizon', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: 10 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      const stability = result.projectedMetrics.find(
        (m) => m.metricName === 'stability',
      )!;
      // currentValue = 50 + 10 (action delta) = 60
      expect(stability.currentValue).toBe(60);
      // projectedValue = 60 + 1 * 3 (trajectory × immediate) = 63
      expect(stability.projectedValue).toBe(63);
      // delta = 63 - 60 = 3
      expect(stability.delta).toBe(3);
    });

    it('computes viability impact as clamped mean of action deltas', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: 10 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      // rawImpact = 10 / 2 (metric count) = 5.0, clamped to [-10, 10]
      expect(result.viabilityImpacts['econ']).toBeCloseTo(5.0);
    });

    it('computes newLossMargin as nearestLossMargin + sumOfDeltas × 0.1', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: 10 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      // newLossMargin = 30 + 10 * 0.1 = 31
      expect(result.newLossMargin).toBeCloseTo(31);
    });

    it('sets lossRiskIncreased to false when newLossMargin >= original', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: 10 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      expect(result.lossRiskIncreased).toBe(false);
    });

    it('sets lossRiskIncreased to true when negative deltas lower the margin', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: -20 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      // newLossMargin = 30 + (-20) * 0.1 = 28, which is < 30
      expect(result.lossRiskIncreased).toBe(true);
      expect(result.newLossMargin).toBeCloseTo(28);
    });

    it('reflects only trajectory when actionDeltas is empty', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50, gdp: 80 },
        perTurnTrajectory: { stability: 1, gdp: 0 },
        actionDeltas: [],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      const stability = result.projectedMetrics.find(
        (m) => m.metricName === 'stability',
      )!;
      // No action delta → currentValue unchanged at 50
      expect(stability.currentValue).toBe(50);
      // projectedValue = 50 + 1 * 3 = 53
      expect(stability.projectedValue).toBe(53);
      expect(stability.delta).toBe(3);

      const gdp = result.projectedMetrics.find(
        (m) => m.metricName === 'gdp',
      )!;
      expect(gdp.currentValue).toBe(80);
      expect(gdp.projectedValue).toBe(80);
      expect(gdp.delta).toBe(0);
    });

    it('sets all viability impacts to 0 when actionDeltas is empty', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
        actionDeltas: [],
        currentViabilityScores: { econ: 60, military: 70 },
        nearestLossMargin: 30,
      });

      expect(result.viabilityImpacts['econ']).toBe(0);
      expect(result.viabilityImpacts['military']).toBe(0);
    });

    it('leaves newLossMargin unchanged when actionDeltas is empty', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
        actionDeltas: [],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      expect(result.newLossMargin).toBe(30);
      expect(result.lossRiskIncreased).toBe(false);
    });

    it('includes factionId and delta count in the reason string', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
        actionDeltas: [
          { metricName: 'stability', immediateDelta: 5 },
          { metricName: 'stability', immediateDelta: 3 },
        ],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('2');
    });

    it('uses singular "delta" in reason when exactly 1 action delta is applied', () => {
      const result = engine.simulateWhatIf({
        factionId: US,
        currentTurn: TURN,
        currentMetrics: { stability: 50 },
        perTurnTrajectory: { stability: 1 },
        actionDeltas: [{ metricName: 'stability', immediateDelta: 5 }],
        currentViabilityScores: { econ: 60 },
        nearestLossMargin: 30,
      });

      expect(result.reason).toContain('1 action delta applied');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cloneMetrics
  // ─────────────────────────────────────────────────────────────────────────

  describe('cloneMetrics', () => {
    it('returns an object with identical key-value pairs', () => {
      const original: Record<string, number> = { stability: 50, gdp: 80 };
      const clone = engine.cloneMetrics(original);

      expect(clone['stability']).toBe(50);
      expect(clone['gdp']).toBe(80);
    });

    it('does not share a reference with the original', () => {
      const original: Record<string, number> = { stability: 50, gdp: 80 };
      const clone = engine.cloneMetrics(original);

      clone['stability'] = 999;
      expect(original['stability']).toBe(50);
    });

    it('returns an empty object when given an empty object', () => {
      const clone = engine.cloneMetrics({});
      expect(Object.keys(clone).length).toBe(0);
    });
  });
});
