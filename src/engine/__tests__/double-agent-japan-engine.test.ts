import { describe, it, expect, beforeEach } from 'vitest';
import type { TurnNumber } from '@/data/types';
import {
  DoubleAgentStatus,
  JapanNuclearPhase,
} from '@/data/types';
import { DoubleAgentJapanEngine } from '@/engine/double-agent-japan-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const turn = (n: number) => n as TurnNumber;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DoubleAgentJapanEngine', () => {
  let engine: DoubleAgentJapanEngine;

  beforeEach(() => {
    engine = new DoubleAgentJapanEngine();
  });

  // =========================================================================
  // FR-906 — Double Agent Operations
  // =========================================================================

  // ── evaluateDetection ───────────────────────────────────────────────────

  describe('evaluateDetection', () => {
    it('returns detected=false and probability=0 when no rival asset is present', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 80,
        rivalAssetPresent: false,
        currentTurn: turn(1),
      });
      expect(result.detected).toBe(false);
      expect(result.detectionProbability).toBe(0);
      expect(result.reason).toContain('No rival asset present');
    });

    it('does not detect with low counter-intel score (30 → prob 0.3)', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 30,
        rivalAssetPresent: true,
        currentTurn: turn(2),
      });
      expect(result.detected).toBe(false);
      expect(result.detectionProbability).toBeCloseTo(0.3);
    });

    it('detects at exact threshold (score=50 → prob 0.5 >= 0.5)', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 50,
        rivalAssetPresent: true,
        currentTurn: turn(3),
      });
      expect(result.detected).toBe(true);
      expect(result.detectionProbability).toBeCloseTo(0.5);
    });

    it('detects with high counter-intel score (80 → prob 0.8)', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 80,
        rivalAssetPresent: true,
        currentTurn: turn(4),
      });
      expect(result.detected).toBe(true);
      expect(result.detectionProbability).toBeCloseTo(0.8);
    });

    it('clamps probability to 1.0 for extreme counter-intel score (score=150)', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 150,
        rivalAssetPresent: true,
        currentTurn: turn(5),
      });
      expect(result.detected).toBe(true);
      expect(result.detectionProbability).toBe(1.0);
    });

    it('returns probability=0 for counter-intel score of 0 with rival present', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 0,
        rivalAssetPresent: true,
        currentTurn: turn(6),
      });
      expect(result.detected).toBe(false);
      expect(result.detectionProbability).toBe(0);
    });

    it('does not detect just below threshold (score=49 → prob 0.49)', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 49,
        rivalAssetPresent: true,
        currentTurn: turn(7),
      });
      expect(result.detected).toBe(false);
      expect(result.detectionProbability).toBeCloseTo(0.49);
    });

    it('includes turn number in the reason string', () => {
      const result = engine.evaluateDetection({
        counterIntelScore: 60,
        rivalAssetPresent: true,
        currentTurn: turn(12),
      });
      expect(result.reason).toContain('Turn 12');
    });
  });

  // ── evaluateTurnAttempt ─────────────────────────────────────────────────

  describe('evaluateTurnAttempt', () => {
    it('fails when counter-intel score is below minimum (score=39)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 39,
        covertScore: 100,
        currentTurn: turn(5),
      });
      expect(result.success).toBe(false);
      expect(result.turnProbability).toBe(0);
      expect(result.newStatus).toBe(DoubleAgentStatus.Detected);
      expect(result.reason).toContain('below minimum');
    });

    it('fails at exact minimum counter-intel boundary (score=40) with covert=50 (prob=0.5 < 0.6)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 40,
        covertScore: 50,
        currentTurn: turn(6),
      });
      expect(result.success).toBe(false);
      expect(result.turnProbability).toBeCloseTo(0.5);
      expect(result.newStatus).toBe(DoubleAgentStatus.Expelled);
    });

    it('succeeds when covert=70 (prob = 0.5 + 20×0.005 = 0.6 >= 0.6)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 40,
        covertScore: 70,
        currentTurn: turn(7),
      });
      expect(result.success).toBe(true);
      expect(result.turnProbability).toBeCloseTo(0.6);
      expect(result.newStatus).toBe(DoubleAgentStatus.Turned);
    });

    it('succeeds with high covert score (100 → prob = 0.5 + 50×0.005 = 0.75)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 60,
        covertScore: 100,
        currentTurn: turn(8),
      });
      expect(result.success).toBe(true);
      expect(result.turnProbability).toBeCloseTo(0.75);
      expect(result.newStatus).toBe(DoubleAgentStatus.Turned);
    });

    it('fails just below success threshold (covert=69 → prob = 0.5 + 19×0.005 = 0.595)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 50,
        covertScore: 69,
        currentTurn: turn(9),
      });
      expect(result.success).toBe(false);
      expect(result.turnProbability).toBeCloseTo(0.595);
      expect(result.newStatus).toBe(DoubleAgentStatus.Expelled);
    });

    it('gives no covert bonus when covert score is below 50 (covert=30 → prob=0.5)', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 45,
        covertScore: 30,
        currentTurn: turn(10),
      });
      expect(result.success).toBe(false);
      expect(result.turnProbability).toBeCloseTo(0.5);
    });

    it('includes turn number in reason for successful turn', () => {
      const result = engine.evaluateTurnAttempt({
        counterIntelScore: 50,
        covertScore: 80,
        currentTurn: turn(15),
      });
      expect(result.success).toBe(true);
      expect(result.reason).toContain('Turn 15');
    });
  });

  // ── computeDisinformation ───────────────────────────────────────────────

  describe('computeDisinformation', () => {
    it('is active at turnsActive=0 with 4 remaining turns', () => {
      const result = engine.computeDisinformation({
        turnsActive: 0,
        currentTurn: turn(10),
      });
      expect(result.active).toBe(true);
      expect(result.ghostUnitsInjected).toBe(2);
      expect(result.falsePactsInjected).toBe(1);
      expect(result.remainingTurns).toBe(4);
    });

    it('is active at turnsActive=1 with 3 remaining turns', () => {
      const result = engine.computeDisinformation({
        turnsActive: 1,
        currentTurn: turn(11),
      });
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(3);
      expect(result.ghostUnitsInjected).toBe(2);
      expect(result.falsePactsInjected).toBe(1);
    });

    it('is active at turnsActive=3 with 1 remaining turn', () => {
      const result = engine.computeDisinformation({
        turnsActive: 3,
        currentTurn: turn(13),
      });
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(1);
      expect(result.ghostUnitsInjected).toBe(2);
      expect(result.falsePactsInjected).toBe(1);
    });

    it('expires at turnsActive=4 (equal to duration)', () => {
      const result = engine.computeDisinformation({
        turnsActive: 4,
        currentTurn: turn(14),
      });
      expect(result.active).toBe(false);
      expect(result.ghostUnitsInjected).toBe(0);
      expect(result.falsePactsInjected).toBe(0);
      expect(result.remainingTurns).toBe(0);
    });

    it('stays expired well past duration (turnsActive=10)', () => {
      const result = engine.computeDisinformation({
        turnsActive: 10,
        currentTurn: turn(20),
      });
      expect(result.active).toBe(false);
      expect(result.ghostUnitsInjected).toBe(0);
      expect(result.falsePactsInjected).toBe(0);
      expect(result.remainingTurns).toBe(0);
    });

    it('includes "expired" in reason when campaign is over', () => {
      const result = engine.computeDisinformation({
        turnsActive: 4,
        currentTurn: turn(14),
      });
      expect(result.reason).toContain('expired');
    });

    it('includes ghost unit and false pact counts in active reason', () => {
      const result = engine.computeDisinformation({
        turnsActive: 2,
        currentTurn: turn(12),
      });
      expect(result.reason).toContain('2 ghost units');
      expect(result.reason).toContain('1 false pacts');
    });
  });

  // ── evaluateExpulsion ───────────────────────────────────────────────────

  describe('evaluateExpulsion', () => {
    it('returns configured tension increase of 10', () => {
      const result = engine.evaluateExpulsion({ currentTurn: turn(5) });
      expect(result.tensionIncrease).toBe(10);
    });

    it('sets new status to Expelled', () => {
      const result = engine.evaluateExpulsion({ currentTurn: turn(5) });
      expect(result.newStatus).toBe(DoubleAgentStatus.Expelled);
    });

    it('includes turn number in reason', () => {
      const result = engine.evaluateExpulsion({ currentTurn: turn(8) });
      expect(result.reason).toContain('Turn 8');
    });

    it('mentions tension increase in the reason', () => {
      const result = engine.evaluateExpulsion({ currentTurn: turn(3) });
      expect(result.reason).toContain('10');
    });
  });

  // =========================================================================
  // FR-1007 — Japan Latent Nuclear Program
  // =========================================================================

  // ── advanceNuclearRnD ───────────────────────────────────────────────────

  describe('advanceNuclearRnD', () => {
    it('transitions from Dormant to RnDInProgress with turnsCompleted=1', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.Dormant,
        turnsCompleted: 0,
        currentTurn: turn(1),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.RnDInProgress);
      expect(result.turnsCompleted).toBe(1);
      expect(result.turnsRemaining).toBe(5);
    });

    it('increments turns in mid-RnD (turnsCompleted=3 → 4, remaining=2)', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.RnDInProgress,
        turnsCompleted: 3,
        currentTurn: turn(4),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.RnDInProgress);
      expect(result.turnsCompleted).toBe(4);
      expect(result.turnsRemaining).toBe(2);
    });

    it('completes RnD at turnsCompleted=5 → AmendmentPending (6/6)', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.RnDInProgress,
        turnsCompleted: 5,
        currentTurn: turn(6),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.AmendmentPending);
      expect(result.turnsCompleted).toBe(6);
      expect(result.turnsRemaining).toBe(0);
    });

    it('is a no-op when phase is AmendmentPending', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.AmendmentPending,
        turnsCompleted: 6,
        currentTurn: turn(7),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.AmendmentPending);
      expect(result.turnsCompleted).toBe(6);
      expect(result.turnsRemaining).toBe(0);
      expect(result.reason).toContain('not applicable');
    });

    it('is a no-op when phase is Active', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.Active,
        turnsCompleted: 6,
        currentTurn: turn(10),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.Active);
      expect(result.turnsCompleted).toBe(6);
      expect(result.turnsRemaining).toBe(0);
    });

    it('is a no-op when phase is Failed', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.Failed,
        turnsCompleted: 6,
        currentTurn: turn(10),
      });
      expect(result.newPhase).toBe(JapanNuclearPhase.Failed);
      expect(result.turnsCompleted).toBe(6);
    });

    it('shows correct remaining turns early in RnD (turnsCompleted=1 → remaining=4)', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.RnDInProgress,
        turnsCompleted: 1,
        currentTurn: turn(2),
      });
      expect(result.turnsCompleted).toBe(2);
      expect(result.turnsRemaining).toBe(4);
    });

    it('includes turn number in reason for Dormant → RnDInProgress', () => {
      const result = engine.advanceNuclearRnD({
        currentPhase: JapanNuclearPhase.Dormant,
        turnsCompleted: 0,
        currentTurn: turn(3),
      });
      expect(result.reason).toContain('Turn 3');
    });
  });

  // ── evaluateConstitutionalAmendment ─────────────────────────────────────

  describe('evaluateConstitutionalAmendment', () => {
    it('returns passed=false when phase is not AmendmentPending (Dormant)', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 100,
        currentPhase: JapanNuclearPhase.Dormant,
        currentTurn: turn(5),
      });
      expect(result.passed).toBe(false);
      expect(result.newPhase).toBe(JapanNuclearPhase.Dormant);
      expect(result.reason).toContain('not applicable');
    });

    it('returns passed=false when phase is RnDInProgress', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 100,
        currentPhase: JapanNuclearPhase.RnDInProgress,
        currentTurn: turn(5),
      });
      expect(result.passed).toBe(false);
      expect(result.newPhase).toBe(JapanNuclearPhase.RnDInProgress);
    });

    it('returns passed=false when phase is Active', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 100,
        currentPhase: JapanNuclearPhase.Active,
        currentTurn: turn(5),
      });
      expect(result.passed).toBe(false);
      expect(result.newPhase).toBe(JapanNuclearPhase.Active);
    });

    it('passes amendment at exact stability threshold (stability=40)', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 40,
        currentPhase: JapanNuclearPhase.AmendmentPending,
        currentTurn: turn(7),
      });
      expect(result.passed).toBe(true);
      expect(result.newPhase).toBe(JapanNuclearPhase.Active);
    });

    it('fails amendment just below threshold (stability=39)', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 39,
        currentPhase: JapanNuclearPhase.AmendmentPending,
        currentTurn: turn(7),
      });
      expect(result.passed).toBe(false);
      expect(result.newPhase).toBe(JapanNuclearPhase.Failed);
    });

    it('passes amendment with high stability (stability=100)', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 100,
        currentPhase: JapanNuclearPhase.AmendmentPending,
        currentTurn: turn(8),
      });
      expect(result.passed).toBe(true);
      expect(result.newPhase).toBe(JapanNuclearPhase.Active);
    });

    it('fails amendment with stability=0', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 0,
        currentPhase: JapanNuclearPhase.AmendmentPending,
        currentTurn: turn(8),
      });
      expect(result.passed).toBe(false);
      expect(result.newPhase).toBe(JapanNuclearPhase.Failed);
    });

    it('includes stability values in reason when amendment passes', () => {
      const result = engine.evaluateConstitutionalAmendment({
        currentStability: 75,
        currentPhase: JapanNuclearPhase.AmendmentPending,
        currentTurn: turn(9),
      });
      expect(result.reason).toContain('75');
      expect(result.reason).toContain('40');
    });
  });

  // ── computeNuclearCascade ───────────────────────────────────────────────

  describe('computeNuclearCascade', () => {
    it('returns stability penalty of -25', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(10) });
      expect(result.stabilityPenalty).toBe(-25);
    });

    it('returns DI penalty of -30', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(10) });
      expect(result.diPenalty).toBe(-30);
    });

    it('returns China nuclear threshold increase of 15', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(10) });
      expect(result.chinaNuclearThresholdIncrease).toBe(15);
    });

    it('returns DPRK nuclear threshold increase of 20', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(10) });
      expect(result.dprkNuclearThresholdIncrease).toBe(20);
    });

    it('returns all cascade values together', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(12) });
      expect(result).toMatchObject({
        stabilityPenalty: -25,
        diPenalty: -30,
        chinaNuclearThresholdIncrease: 15,
        dprkNuclearThresholdIncrease: 20,
      });
    });

    it('includes all cascade values in the reason string', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(12) });
      expect(result.reason).toContain('-25');
      expect(result.reason).toContain('-30');
      expect(result.reason).toContain('+15');
      expect(result.reason).toContain('+20');
    });

    it('includes turn number in reason', () => {
      const result = engine.computeNuclearCascade({ currentTurn: turn(20) });
      expect(result.reason).toContain('Turn 20');
    });
  });

  // =========================================================================
  // Config defaults verification
  // =========================================================================

  describe('config defaults', () => {
    it('uses GAME_CONFIG.doubleAgent.detectionMultiplier = 0.01', () => {
      expect(GAME_CONFIG.doubleAgent.detectionMultiplier).toBe(0.01);
    });

    it('uses GAME_CONFIG.doubleAgent.minCounterIntelToTurn = 40', () => {
      expect(GAME_CONFIG.doubleAgent.minCounterIntelToTurn).toBe(40);
    });

    it('uses GAME_CONFIG.doubleAgent.disinformationDurationTurns = 4', () => {
      expect(GAME_CONFIG.doubleAgent.disinformationDurationTurns).toBe(4);
    });

    it('uses GAME_CONFIG.military.japanLatentNuclear.rdTurns = 6', () => {
      expect(GAME_CONFIG.military.japanLatentNuclear.rdTurns).toBe(6);
    });

    it('uses GAME_CONFIG.military.japanLatentNuclear.amendmentStabilityThreshold = 40', () => {
      expect(GAME_CONFIG.military.japanLatentNuclear.amendmentStabilityThreshold).toBe(40);
    });
  });
});
