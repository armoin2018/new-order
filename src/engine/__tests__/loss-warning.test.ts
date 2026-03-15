import { describe, it, expect, beforeEach } from 'vitest';
import { LossWarningEngine } from '@/engine/loss-warning';
import type { LossMetricInput, LossTrajectoryInput, LossConditionStatus } from '@/engine/loss-warning';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<LossMetricInput> = {}): LossMetricInput {
  return {
    stability: 70,
    civilUnrest: 20,
    nuclearThreshold: 10,
    averageTensionLevel: 30,
    negativeTradeTurns: 0,
    militaryPowerBase: 70,
    securityPowerBase: 60,
    ...overrides,
  };
}

function makeTrajectory(overrides: Partial<LossTrajectoryInput> = {}): LossTrajectoryInput {
  return {
    stabilityDelta: 1,
    civilUnrestDelta: -1,
    nuclearThresholdDelta: 0,
    tensionDelta: 0,
    militaryDelta: 0,
    securityDelta: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('LossWarningEngine', () => {
  let engine: LossWarningEngine;

  beforeEach(() => {
    engine = new LossWarningEngine(GAME_CONFIG.advisory);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeDistanceFromTrigger
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeDistanceFromTrigger', () => {
    it('lower bound — value 50 → 0.5', () => {
      expect(engine.computeDistanceFromTrigger(50, 0, true)).toBe(0.5);
    });

    it('lower bound — value 0 → 0 (at trigger)', () => {
      expect(engine.computeDistanceFromTrigger(0, 0, true)).toBe(0);
    });

    it('lower bound — value 100 → 1 (maximum safety)', () => {
      expect(engine.computeDistanceFromTrigger(100, 0, true)).toBe(1);
    });

    it('upper bound — value 50 → 0.5', () => {
      expect(engine.computeDistanceFromTrigger(50, 100, false)).toBe(0.5);
    });

    it('upper bound — value 0 → 1 (maximum safety)', () => {
      expect(engine.computeDistanceFromTrigger(0, 100, false)).toBe(1);
    });

    it('upper bound — value 100 → 0 (at trigger)', () => {
      expect(engine.computeDistanceFromTrigger(100, 100, false)).toBe(0);
    });

    it('upper bound — value 90 → 0.1', () => {
      expect(engine.computeDistanceFromTrigger(90, 100, false)).toBeCloseTo(0.1);
    });

    it('clamps negative values to 0', () => {
      expect(engine.computeDistanceFromTrigger(-10, 0, true)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // estimateTurnsToTrigger
  // ─────────────────────────────────────────────────────────────────────────

  describe('estimateTurnsToTrigger', () => {
    it('lower bound — already at trigger (value 0) → 0', () => {
      expect(engine.estimateTurnsToTrigger(0, 0, -5, true)).toBe(0);
    });

    it('lower bound — trending away (delta +5) → null', () => {
      expect(engine.estimateTurnsToTrigger(50, 0, 5, true)).toBeNull();
    });

    it('lower bound — value 50, delta -10 → 5', () => {
      expect(engine.estimateTurnsToTrigger(50, 0, -10, true)).toBe(5);
    });

    it('lower bound — value 25, delta -5 → 5', () => {
      expect(engine.estimateTurnsToTrigger(25, 0, -5, true)).toBe(5);
    });

    it('lower bound — value 1, delta -0.5 → 2', () => {
      expect(engine.estimateTurnsToTrigger(1, 0, -0.5, true)).toBe(2);
    });

    it('upper bound — already at trigger (value 100) → 0', () => {
      expect(engine.estimateTurnsToTrigger(100, 100, 5, false)).toBe(0);
    });

    it('upper bound — trending away (delta -5) → null', () => {
      expect(engine.estimateTurnsToTrigger(80, 100, -5, false)).toBeNull();
    });

    it('upper bound — value 80, delta +10 → ceil(20/10) = 2', () => {
      expect(engine.estimateTurnsToTrigger(80, 100, 10, false)).toBe(2);
    });

    it('upper bound — value 90, delta +3 → ceil(10/3) = 4', () => {
      expect(engine.estimateTurnsToTrigger(90, 100, 3, false)).toBe(4);
    });

    it('lower bound — delta exactly 0 → null (stable, not approaching)', () => {
      expect(engine.estimateTurnsToTrigger(50, 0, 0, true)).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // classifyUrgency
  // ─────────────────────────────────────────────────────────────────────────

  describe('classifyUrgency', () => {
    it('null turns → null', () => {
      expect(engine.classifyUrgency(null, 0.5)).toBeNull();
    });

    it('turns 0, distance 0.5 → critical', () => {
      expect(engine.classifyUrgency(0, 0.5)).toBe('critical');
    });

    it('turns 3, distance 0.5 → critical (at boundary)', () => {
      expect(engine.classifyUrgency(3, 0.5)).toBe('critical');
    });

    it('turns 4, distance 0.5 → warning', () => {
      expect(engine.classifyUrgency(4, 0.5)).toBe('warning');
    });

    it('turns 6, distance 0.5 → warning (at boundary)', () => {
      expect(engine.classifyUrgency(6, 0.5)).toBe('warning');
    });

    it('turns 7, distance 0.5 → watch', () => {
      expect(engine.classifyUrgency(7, 0.5)).toBe('watch');
    });

    it('turns 12, distance 0.5 → watch (at boundary)', () => {
      expect(engine.classifyUrgency(12, 0.5)).toBe('watch');
    });

    it('turns 13, distance 0.5 → null (outside all bands)', () => {
      expect(engine.classifyUrgency(13, 0.5)).toBeNull();
    });

    it('turns 20, distance 0.08 → critical (distance ≤ 0.1)', () => {
      expect(engine.classifyUrgency(20, 0.08)).toBe('critical');
    });

    it('turns 20, distance 0.1 → critical (distance exactly at criticalPercentage)', () => {
      expect(engine.classifyUrgency(20, 0.1)).toBe('critical');
    });

    it('turns 20, distance 0.11 → null (outside all bands)', () => {
      expect(engine.classifyUrgency(20, 0.11)).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getCounterActions
  // ─────────────────────────────────────────────────────────────────────────

  describe('getCounterActions', () => {
    it('VC-04 critical → 3 actions', () => {
      const actions = engine.getCounterActions('VC-04', 'critical');
      expect(actions).toHaveLength(3);
      expect(actions[0]!).toBe('Increase domestic spending');
    });

    it('VC-04 warning → empty array', () => {
      expect(engine.getCounterActions('VC-04', 'warning')).toEqual([]);
    });

    it('VC-05 critical → 3 actions', () => {
      const actions = engine.getCounterActions('VC-05', 'critical');
      expect(actions).toHaveLength(3);
      expect(actions[0]!).toBe('Open diplomatic backchannel');
    });

    it('VC-08 critical → 3 actions', () => {
      const actions = engine.getCounterActions('VC-08', 'critical');
      expect(actions).toHaveLength(3);
      expect(actions[0]!).toBe('Increase military funding');
    });

    it('unknown condition, critical → empty array', () => {
      expect(engine.getCounterActions('VC-99', 'critical')).toEqual([]);
    });

    it('VC-09 watch → empty array', () => {
      expect(engine.getCounterActions('VC-09', 'watch')).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeLossMargin
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeLossMargin', () => {
    it('empty array → 100', () => {
      expect(engine.computeLossMargin([])).toBe(100);
    });

    it('single alert, distance 0.5 → 50', () => {
      const alerts: LossConditionStatus[] = [
        {
          conditionId: 'VC-04',
          name: 'Government Collapse',
          currentValue: 50,
          triggerThreshold: 0,
          distanceFromTrigger: 0.5,
          estimatedTurnsToTrigger: 10,
          urgency: 'watch',
          counterActions: [],
        },
      ];
      expect(engine.computeLossMargin(alerts)).toBe(50);
    });

    it('multiple alerts — uses minimum distance (0.2 → 20)', () => {
      const alerts: LossConditionStatus[] = [
        {
          conditionId: 'VC-04',
          name: 'Government Collapse',
          currentValue: 50,
          triggerThreshold: 0,
          distanceFromTrigger: 0.8,
          estimatedTurnsToTrigger: 10,
          urgency: 'watch',
          counterActions: [],
        },
        {
          conditionId: 'VC-05',
          name: 'Nuclear Winter',
          currentValue: 80,
          triggerThreshold: 100,
          distanceFromTrigger: 0.2,
          estimatedTurnsToTrigger: 4,
          urgency: 'warning',
          counterActions: [],
        },
      ];
      expect(engine.computeLossMargin(alerts)).toBe(20);
    });

    it('all alerts at distance 1.0 → 100', () => {
      const alerts: LossConditionStatus[] = [
        {
          conditionId: 'VC-04',
          name: 'Government Collapse',
          currentValue: 100,
          triggerThreshold: 0,
          distanceFromTrigger: 1.0,
          estimatedTurnsToTrigger: null,
          urgency: null,
          counterActions: [],
        },
        {
          conditionId: 'VC-05',
          name: 'Nuclear Winter',
          currentValue: 0,
          triggerThreshold: 100,
          distanceFromTrigger: 1.0,
          estimatedTurnsToTrigger: null,
          urgency: null,
          counterActions: [],
        },
      ];
      expect(engine.computeLossMargin(alerts)).toBe(100);
    });

    it('one alert at distance 0 → 0', () => {
      const alerts: LossConditionStatus[] = [
        {
          conditionId: 'VC-09',
          name: "People's Revolution",
          currentValue: 100,
          triggerThreshold: 100,
          distanceFromTrigger: 0,
          estimatedTurnsToTrigger: 0,
          urgency: 'critical',
          counterActions: ['Address public grievances'],
        },
      ];
      expect(engine.computeLossMargin(alerts)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // evaluateLossConditions
  // ─────────────────────────────────────────────────────────────────────────

  describe('evaluateLossConditions', () => {
    const factionId = 'US' as FactionId;
    const turn = 5 as TurnNumber;

    it('safe nation — all metrics healthy → 5 alerts, no urgency', () => {
      const result = engine.evaluateLossConditions(
        factionId,
        turn,
        makeMetrics(),
        makeTrajectory(),
      );

      expect(result.alerts).toHaveLength(5);
      expect(result.hasCriticalAlert).toBe(false);
      for (const alert of result.alerts) {
        expect(alert.urgency).toBeNull();
      }
    });

    it('returns factionId and turn in result', () => {
      const result = engine.evaluateLossConditions(
        factionId,
        turn,
        makeMetrics(),
        makeTrajectory(),
      );

      expect(result.factionId).toBe(factionId);
      expect(result.turn).toBe(turn);
    });

    it('always returns exactly 5 alerts', () => {
      const result = engine.evaluateLossConditions(
        factionId,
        turn,
        makeMetrics(),
        makeTrajectory(),
      );

      expect(result.alerts).toHaveLength(5);
      const ids = result.alerts.map((a) => a.conditionId);
      expect(ids).toEqual(['VC-04', 'VC-05', 'VC-06', 'VC-08', 'VC-09']);
    });

    it('VC-04 Government Collapse — stability near zero → critical', () => {
      const metrics = makeMetrics({ stability: 5, civilUnrest: 20 });
      const trajectory = makeTrajectory({ stabilityDelta: -2, civilUnrestDelta: 0 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc04 = result.alerts.find((a) => a.conditionId === 'VC-04')!;
      expect(vc04.urgency).toBe('critical');
      expect(vc04.counterActions.length).toBeGreaterThan(0);
    });

    it('VC-04 — stability healthy, civil unrest rising → picks closer sub-condition', () => {
      const metrics = makeMetrics({ stability: 80, civilUnrest: 95 });
      const trajectory = makeTrajectory({ stabilityDelta: 2, civilUnrestDelta: 3 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc04 = result.alerts.find((a) => a.conditionId === 'VC-04')!;
      expect(vc04.urgency).not.toBeNull();
      // Civil unrest is closer: 95 → 100 with delta +3 ≈ 2 turns
      expect(vc04.estimatedTurnsToTrigger).toBeLessThanOrEqual(3);
    });

    it('VC-05 Nuclear Winter — nuclearThreshold near 100 → critical', () => {
      const metrics = makeMetrics({ nuclearThreshold: 95 });
      const trajectory = makeTrajectory({ nuclearThresholdDelta: 5 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc05 = result.alerts.find((a) => a.conditionId === 'VC-05')!;
      expect(vc05.urgency).toBe('critical');
      expect(vc05.estimatedTurnsToTrigger).toBe(1);
      expect(vc05.counterActions.length).toBeGreaterThan(0);
    });

    it('VC-05 — nuclearThreshold trending away → no alert', () => {
      const metrics = makeMetrics({ nuclearThreshold: 50 });
      const trajectory = makeTrajectory({ nuclearThresholdDelta: -5 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc05 = result.alerts.find((a) => a.conditionId === 'VC-05')!;
      expect(vc05.urgency).toBeNull();
      expect(vc05.estimatedTurnsToTrigger).toBeNull();
    });

    it('VC-09 People\'s Revolution — civilUnrest 95, delta +3 → critical', () => {
      const metrics = makeMetrics({ civilUnrest: 95 });
      const trajectory = makeTrajectory({ civilUnrestDelta: 3 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc09 = result.alerts.find((a) => a.conditionId === 'VC-09')!;
      expect(vc09.urgency).toBe('critical');
      expect(vc09.estimatedTurnsToTrigger).toBe(2);
    });

    it('VC-08 Coup d\'État — both military and security below threshold, declining → critical', () => {
      const metrics = makeMetrics({ militaryPowerBase: 25, securityPowerBase: 20 });
      const trajectory = makeTrajectory({ militaryDelta: -5, securityDelta: -3 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc08 = result.alerts.find((a) => a.conditionId === 'VC-08')!;
      expect(vc08.urgency).toBe('critical');
      expect(vc08.counterActions.length).toBeGreaterThan(0);
    });

    it('VC-08 — one metric above threshold, trending up → no critical', () => {
      const metrics = makeMetrics({ militaryPowerBase: 60, securityPowerBase: 25 });
      const trajectory = makeTrajectory({ militaryDelta: 2, securityDelta: -3 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc08 = result.alerts.find((a) => a.conditionId === 'VC-08')!;
      // military trending away → mergeEstimates returns null → no alert
      expect(vc08.urgency).toBeNull();
    });

    it('VC-06 Isolation — high tension and negative trade turns → alert', () => {
      const metrics = makeMetrics({ averageTensionLevel: 75, negativeTradeTurns: 4 });
      const trajectory = makeTrajectory({ tensionDelta: 3 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc06 = result.alerts.find((a) => a.conditionId === 'VC-06')!;
      // Tension: 75 → 80, delta +3 → ceil(25/3) ≈ 9 turns (uses upper bound 100 for distance)
      // Trade: 4 → 6, remaining = 2 turns
      // mergeEstimates takes max → depends on tension turns vs 2
      expect(vc06.urgency).not.toBeNull();
    });

    it('hasCriticalAlert is true when any alert is critical', () => {
      const metrics = makeMetrics({ nuclearThreshold: 98 });
      const trajectory = makeTrajectory({ nuclearThresholdDelta: 5 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      expect(result.hasCriticalAlert).toBe(true);
    });

    it('minimumLossMargin reflects the closest condition', () => {
      const metrics = makeMetrics({ nuclearThreshold: 90 });
      const trajectory = makeTrajectory({ nuclearThresholdDelta: 2 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      // Nuclear distance = (100 - 90) / 100 = 0.1 → margin = 10
      // Other conditions are safe (distances ≥ 0.3) → min is 0.1
      expect(result.minimumLossMargin).toBeCloseTo(10, 0);
    });

    it('safe scenario has high minimumLossMargin', () => {
      const result = engine.evaluateLossConditions(
        factionId,
        turn,
        makeMetrics(),
        makeTrajectory(),
      );

      expect(result.minimumLossMargin).toBeGreaterThan(20);
    });

    it('VC-06 — tension low, no negative trade → no alert', () => {
      const metrics = makeMetrics({ averageTensionLevel: 20, negativeTradeTurns: 0 });
      const trajectory = makeTrajectory({ tensionDelta: 0 });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const vc06 = result.alerts.find((a) => a.conditionId === 'VC-06')!;
      expect(vc06.urgency).toBeNull();
    });

    it('multiple conditions critical simultaneously', () => {
      const metrics = makeMetrics({
        stability: 2,
        civilUnrest: 97,
        nuclearThreshold: 98,
        militaryPowerBase: 28,
        securityPowerBase: 25,
      });
      const trajectory = makeTrajectory({
        stabilityDelta: -2,
        civilUnrestDelta: 3,
        nuclearThresholdDelta: 5,
        militaryDelta: -3,
        securityDelta: -2,
      });

      const result = engine.evaluateLossConditions(factionId, turn, metrics, trajectory);

      const criticalCount = result.alerts.filter((a) => a.urgency === 'critical').length;
      expect(criticalCount).toBeGreaterThanOrEqual(3);
      expect(result.hasCriticalAlert).toBe(true);
      expect(result.minimumLossMargin).toBeLessThan(10);
    });
  });
});
