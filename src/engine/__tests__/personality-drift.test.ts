import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalityDriftEngine } from '@/engine/personality-drift';
import type {
  StressDriftInput,
  TraumaInput,
  BetrayalDriftInput,
  VictoryDriftInput,
  NearLossDriftInput,
  InoculationInput,
} from '@/engine/personality-drift';
import { GAME_CONFIG } from '@/engine/config';
import { TraumaType } from '@/data/types';
import type { LeaderId, TurnNumber } from '@/data/types';

const LEADER = 'leader-1' as LeaderId;
const TURN = 5 as TurnNumber;

describe('PersonalityDriftEngine', () => {
  let engine: PersonalityDriftEngine;

  beforeEach(() => {
    engine = new PersonalityDriftEngine(GAME_CONFIG.psychology);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeStressDrift (FR-1505)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeStressDrift', () => {
    const baseInput: StressDriftInput = {
      leaderId: LEADER,
      consecutiveHighStressTurns: 6,
      currentStress: 60,
      stressResponse: 'escalate',
      currentRiskTolerance: 50,
      currentTurn: TURN,
    };

    it('triggers drift with escalate response and applies +10 delta', () => {
      const result = engine.computeStressDrift(baseInput);
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(10);
      expect(result.newRiskTolerance).toBe(60);
    });

    it('triggers drift with lash_out response and applies +10 delta', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        stressResponse: 'lash_out',
      });
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(10);
      expect(result.newRiskTolerance).toBe(60);
    });

    it('triggers drift with consolidate response and applies -10 delta', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        stressResponse: 'consolidate',
      });
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(-10);
      expect(result.newRiskTolerance).toBe(40);
    });

    it('triggers drift with retreat response and applies -10 delta', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        stressResponse: 'retreat',
      });
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(-10);
      expect(result.newRiskTolerance).toBe(40);
    });

    it('does NOT trigger when consecutiveHighStressTurns < 6', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        consecutiveHighStressTurns: 5,
      });
      expect(result.drifted).toBe(false);
      expect(result.delta).toBe(0);
      expect(result.newRiskTolerance).toBe(50);
    });

    it('does NOT trigger when currentStress < 60 even with enough turns', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        currentStress: 59,
      });
      expect(result.drifted).toBe(false);
      expect(result.delta).toBe(0);
      expect(result.newRiskTolerance).toBe(50);
    });

    it('clamps newRiskTolerance to 0 when delta would push below', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        stressResponse: 'consolidate',
        currentRiskTolerance: 5,
      });
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(-10);
      expect(result.newRiskTolerance).toBe(0);
    });

    it('clamps newRiskTolerance to 100 when delta would push above', () => {
      const result = engine.computeStressDrift({
        ...baseInput,
        stressResponse: 'escalate',
        currentRiskTolerance: 95,
      });
      expect(result.drifted).toBe(true);
      expect(result.delta).toBe(10);
      expect(result.newRiskTolerance).toBe(100);
    });

    it('produces a DriftEvent with correct trigger, dimension, and delta', () => {
      const result = engine.computeStressDrift(baseInput);
      expect(result.driftEvent).not.toBeNull();
      expect(result.driftEvent!.trigger).toContain('stress_drift_');
      expect(result.driftEvent!.dimension).toBe('riskTolerance');
      expect(result.driftEvent!.delta).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeTraumaResponse (FR-1506)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeTraumaResponse', () => {
    it('NuclearStrike sets fear to 70 and overrides stress response to escalate', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.NuclearStrike,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.emotionalEffects.fear).toBe(70);
      expect(result.stressResponseOverride).toBe('escalate');
    });

    it('NuclearStrike produces 1 drift event with trigger containing nuclear_strike', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.NuclearStrike,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.driftEvents).toHaveLength(1);
      expect(result.driftEvents[0].trigger).toContain('nuclear_strike');
    });

    it('AssassinationAttempt boosts paranoia, security, and penalises public power', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.AssassinationAttempt,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.emotionalEffects.paranoia).toBe(25);
      expect(result.powerBaseEffects.securityServices).toBe(10);
      expect(result.powerBaseEffects.public).toBe(-5);
    });

    it('AssassinationAttempt has no stress response override and normal fatigue', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.AssassinationAttempt,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.stressResponseOverride).toBeNull();
      expect(result.fatigueMultiplier).toBe(1);
    });

    it('CapitalSiege spikes all emotional dimensions to 80', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.CapitalSiege,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.emotionalEffects.stress).toBe(80);
      expect(result.emotionalEffects.fear).toBe(80);
      expect(result.emotionalEffects.anger).toBe(80);
      expect(result.emotionalEffects.confidence).toBe(-80);
      expect(result.emotionalEffects.resolve).toBe(80);
    });

    it('CapitalSiege applies 3x fatigue multiplier for 6 turns', () => {
      const input: TraumaInput = {
        leaderId: LEADER,
        traumaType: TraumaType.CapitalSiege,
        currentTurn: TURN,
      };
      const result = engine.computeTraumaResponse(input);
      expect(result.fatigueMultiplier).toBe(3);
      expect(result.fatigueMultiplierDuration).toBe(6);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeBetrayalDrift (FR-1505)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeBetrayalDrift', () => {
    it('increases paranoia by 15 from a normal baseline', () => {
      const input: BetrayalDriftInput = {
        leaderId: LEADER,
        currentParanoia: 50,
        currentTurn: TURN,
      };
      const result = engine.computeBetrayalDrift(input);
      expect(result.newParanoia).toBe(65);
      expect(result.delta).toBe(15);
    });

    it('clamps paranoia to 100 when delta would exceed max', () => {
      const input: BetrayalDriftInput = {
        leaderId: LEADER,
        currentParanoia: 90,
        currentTurn: TURN,
      };
      const result = engine.computeBetrayalDrift(input);
      expect(result.newParanoia).toBe(100);
      expect(result.delta).toBe(15);
    });

    it('produces a driftEvent with trigger betrayal_paranoia_drift and dimension paranoia', () => {
      const input: BetrayalDriftInput = {
        leaderId: LEADER,
        currentParanoia: 50,
        currentTurn: TURN,
      };
      const result = engine.computeBetrayalDrift(input);
      expect(result.driftEvent).not.toBeNull();
      expect(result.driftEvent.trigger).toBe('betrayal_paranoia_drift');
      expect(result.driftEvent.dimension).toBe('paranoia');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeVictoryDrift (FR-1505)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeVictoryDrift', () => {
    it('boosts confidence by 10 and narcissism by 5', () => {
      const input: VictoryDriftInput = {
        leaderId: LEADER,
        currentConfidence: 50,
        currentNarcissism: 50,
        currentTurn: TURN,
      };
      const result = engine.computeVictoryDrift(input);
      expect(result.newConfidence).toBe(60);
      expect(result.newNarcissism).toBe(55);
      expect(result.confidenceDelta).toBe(10);
      expect(result.narcissismDelta).toBe(5);
    });

    it('clamps confidence and narcissism to 100', () => {
      const input: VictoryDriftInput = {
        leaderId: LEADER,
        currentConfidence: 95,
        currentNarcissism: 98,
        currentTurn: TURN,
      };
      const result = engine.computeVictoryDrift(input);
      expect(result.newConfidence).toBe(100);
      expect(result.newNarcissism).toBe(100);
    });

    it('produces 2 drift events', () => {
      const input: VictoryDriftInput = {
        leaderId: LEADER,
        currentConfidence: 50,
        currentNarcissism: 50,
        currentTurn: TURN,
      };
      const result = engine.computeVictoryDrift(input);
      expect(result.driftEvents).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeNearLossDrift (FR-1505)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeNearLossDrift', () => {
    it('triggers when stability fell below 10 and has since recovered above 10', () => {
      const input: NearLossDriftInput = {
        leaderId: LEADER,
        currentResolve: 50,
        currentPragmatism: 50,
        lowestStability: 5,
        currentStability: 15,
        currentTurn: TURN,
      };
      const result = engine.computeNearLossDrift(input);
      expect(result.triggered).toBe(true);
      expect(result.resolveDelta).toBe(10);
      expect(result.pragmatismDelta).toBe(10);
      expect(result.newResolve).toBe(60);
      expect(result.newPragmatism).toBe(60);
    });

    it('does NOT trigger when stability never fell below threshold', () => {
      const input: NearLossDriftInput = {
        leaderId: LEADER,
        currentResolve: 50,
        currentPragmatism: 50,
        lowestStability: 15,
        currentStability: 20,
        currentTurn: TURN,
      };
      const result = engine.computeNearLossDrift(input);
      expect(result.triggered).toBe(false);
      expect(result.resolveDelta).toBe(0);
      expect(result.pragmatismDelta).toBe(0);
    });

    it('does NOT trigger when stability fell below threshold but has not yet recovered', () => {
      const input: NearLossDriftInput = {
        leaderId: LEADER,
        currentResolve: 50,
        currentPragmatism: 50,
        lowestStability: 5,
        currentStability: 8,
        currentTurn: TURN,
      };
      const result = engine.computeNearLossDrift(input);
      expect(result.triggered).toBe(false);
      expect(result.resolveDelta).toBe(0);
      expect(result.pragmatismDelta).toBe(0);
    });

    it('produces 2 drift events when triggered', () => {
      const input: NearLossDriftInput = {
        leaderId: LEADER,
        currentResolve: 50,
        currentPragmatism: 50,
        lowestStability: 5,
        currentStability: 15,
        currentTurn: TURN,
      };
      const result = engine.computeNearLossDrift(input);
      expect(result.driftEvents).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // computeStressInoculation (FR-1507)
  // ─────────────────────────────────────────────────────────────────────────

  describe('computeStressInoculation', () => {
    it('newly inoculates after 20 turns above stress threshold', () => {
      const input: InoculationInput = {
        leaderId: LEADER,
        turnsAboveStressThreshold: 20,
        alreadyInoculated: false,
        currentPragmatism: 50,
        currentTurn: TURN,
      };
      const result = engine.computeStressInoculation(input);
      expect(result.inoculated).toBe(true);
      expect(result.newlyInoculated).toBe(true);
      expect(result.stressGainModifier).toBe(-0.2);
      expect(result.pragmatismDelta).toBe(10);
      expect(result.ideologyDelta).toBe(-10);
    });

    it('returns ongoing benefits when already inoculated without new events', () => {
      const input: InoculationInput = {
        leaderId: LEADER,
        turnsAboveStressThreshold: 25,
        alreadyInoculated: true,
        currentPragmatism: 60,
        currentTurn: TURN,
      };
      const result = engine.computeStressInoculation(input);
      expect(result.inoculated).toBe(true);
      expect(result.newlyInoculated).toBe(false);
      expect(result.stressGainModifier).toBe(-0.2);
      expect(result.pragmatismDelta).toBe(0);
      expect(result.driftEvents).toHaveLength(0);
    });

    it('does NOT inoculate when turns below threshold (19 < 20)', () => {
      const input: InoculationInput = {
        leaderId: LEADER,
        turnsAboveStressThreshold: 19,
        alreadyInoculated: false,
        currentPragmatism: 50,
        currentTurn: TURN,
      };
      const result = engine.computeStressInoculation(input);
      expect(result.inoculated).toBe(false);
      expect(result.newlyInoculated).toBe(false);
      expect(result.stressGainModifier).toBe(0);
    });

    it('produces 2 drift events when newly inoculated', () => {
      const input: InoculationInput = {
        leaderId: LEADER,
        turnsAboveStressThreshold: 20,
        alreadyInoculated: false,
        currentPragmatism: 50,
        currentTurn: TURN,
      };
      const result = engine.computeStressInoculation(input);
      expect(result.driftEvents).toHaveLength(2);
    });
  });
});
