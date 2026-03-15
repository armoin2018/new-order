import { describe, it, expect, beforeEach } from 'vitest';
import { AiPerceptionEngine } from '@/engine/ai-perception-engine';
import type {
  AiPerceptionState,
} from '@/engine/ai-perception-engine';
import { GAME_CONFIG } from '@/engine/config';
import { FactionId, ALL_FACTIONS, DecisionStyle, StressResponse } from '@/data/types';
import type { LeaderId, LeaderPsychology, PowerBase } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makePsychology(overrides?: Partial<LeaderPsychology>): LeaderPsychology {
  return {
    decisionStyle: 'Analytical' as const,
    stressResponse: 'Consolidate' as const,
    riskTolerance: 50,
    paranoia: 50,
    narcissism: 50,
    pragmatism: 50,
    patience: 50,
    vengefulIndex: 50,
    ...overrides,
  };
}

function makePowerBase(overrides?: Partial<PowerBase>): PowerBase {
  return {
    military: 50,
    oligarchs: 50,
    party: 50,
    clergy: 50,
    public: 50,
    securityServices: 50,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('AiPerceptionEngine', () => {
  let engine: AiPerceptionEngine;

  beforeEach(() => {
    engine = new AiPerceptionEngine(GAME_CONFIG.leaderCreation);
  });

  // ─────────────────────────────────────────────────────
  // 1. initializePerception
  // ─────────────────────────────────────────────────────

  describe('initializePerception', () => {
    it('creates one entry per faction for all 8 factions', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      expect(state.perceptions).toHaveLength(8);
    });

    it('sets all initial accuracies to 70 (initialAccuracy)', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      for (const entry of state.perceptions) {
        expect(entry.accuracy).toBe(70);
      }
    });

    it('initializes totalConsistentActions and totalInconsistentActions to 0', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      expect(state.totalConsistentActions).toBe(0);
      expect(state.totalInconsistentActions).toBe(0);
    });

    it('sets updatesApplied to 0 for every entry', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      for (const entry of state.perceptions) {
        expect(entry.updatesApplied).toBe(0);
      }
    });

    it('stores the target leader id', () => {
      const lid = 'leader-abc' as LeaderId;
      const state = engine.initializePerception(lid, ALL_FACTIONS);
      expect(state.targetLeaderId).toBe(lid);
    });

    it('works with a faction subset (3 factions)', () => {
      const subset: readonly FactionId[] = [FactionId.US, FactionId.China, FactionId.Russia];
      const state = engine.initializePerception('leader-2' as LeaderId, subset);
      expect(state.perceptions).toHaveLength(3);
      expect(state.perceptions.map((p) => p.factionId)).toEqual(subset);
    });

    it('preserves faction ordering from input array', () => {
      const reversed = [...ALL_FACTIONS].reverse() as readonly FactionId[];
      const state = engine.initializePerception('leader-3' as LeaderId, reversed);
      const resultFactions = state.perceptions.map((p) => p.factionId);
      expect(resultFactions).toEqual(reversed);
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. updatePerceptionAccuracy
  // ─────────────────────────────────────────────────────

  describe('updatePerceptionAccuracy', () => {
    let baseState: AiPerceptionState;

    beforeEach(() => {
      baseState = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
    });

    it('increases accuracy by 2 for consistent action', () => {
      const updated = engine.updatePerceptionAccuracy(baseState, true);
      for (const entry of updated.perceptions) {
        expect(entry.accuracy).toBe(72);
      }
    });

    it('decreases accuracy by 5 for inconsistent action', () => {
      const updated = engine.updatePerceptionAccuracy(baseState, false);
      for (const entry of updated.perceptions) {
        expect(entry.accuracy).toBe(65);
      }
    });

    it('increments totalConsistentActions on consistent action', () => {
      const updated = engine.updatePerceptionAccuracy(baseState, true);
      expect(updated.totalConsistentActions).toBe(1);
      expect(updated.totalInconsistentActions).toBe(0);
    });

    it('increments totalInconsistentActions on inconsistent action', () => {
      const updated = engine.updatePerceptionAccuracy(baseState, false);
      expect(updated.totalConsistentActions).toBe(0);
      expect(updated.totalInconsistentActions).toBe(1);
    });

    it('increments updatesApplied by 1 per call', () => {
      const once = engine.updatePerceptionAccuracy(baseState, true);
      const twice = engine.updatePerceptionAccuracy(once, false);
      for (const entry of once.perceptions) {
        expect(entry.updatesApplied).toBe(1);
      }
      for (const entry of twice.perceptions) {
        expect(entry.updatesApplied).toBe(2);
      }
    });

    it('clamps accuracy to maximum of 95', () => {
      // Start at 70, add 2 per consistent action. After 13 calls: 70 + 26 = 96 → clamped to 95
      let state = baseState;
      for (let i = 0; i < 13; i++) {
        state = engine.updatePerceptionAccuracy(state, true);
      }
      for (const entry of state.perceptions) {
        expect(entry.accuracy).toBe(95);
      }
    });

    it('clamps accuracy to minimum of 20', () => {
      // Start at 70, subtract 5 per inconsistent action. After 11 calls: 70 - 55 = 15 → clamped to 20
      let state = baseState;
      for (let i = 0; i < 11; i++) {
        state = engine.updatePerceptionAccuracy(state, false);
      }
      for (const entry of state.perceptions) {
        expect(entry.accuracy).toBe(20);
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. evaluateCounterStrategyBonus
  // ─────────────────────────────────────────────────────

  describe('evaluateCounterStrategyBonus', () => {
    it('returns active=true and bonus=0.15 when accuracy > 70', () => {
      const result = engine.evaluateCounterStrategyBonus(80);
      expect(result.active).toBe(true);
      expect(result.bonus).toBe(0.15);
    });

    it('returns active=false and bonus=0 when accuracy <= 70', () => {
      const result = engine.evaluateCounterStrategyBonus(60);
      expect(result.active).toBe(false);
      expect(result.bonus).toBe(0);
    });

    it('boundary: accuracy=70 is NOT active', () => {
      const result = engine.evaluateCounterStrategyBonus(70);
      expect(result.active).toBe(false);
      expect(result.bonus).toBe(0);
    });

    it('boundary: accuracy=71 IS active', () => {
      const result = engine.evaluateCounterStrategyBonus(71);
      expect(result.active).toBe(true);
      expect(result.bonus).toBe(0.15);
    });

    it('passes through the accuracy value in the result', () => {
      const result = engine.evaluateCounterStrategyBonus(42);
      expect(result.accuracy).toBe(42);
    });

    it('handles accuracy=0 (edge case)', () => {
      const result = engine.evaluateCounterStrategyBonus(0);
      expect(result.active).toBe(false);
      expect(result.bonus).toBe(0);
    });

    it('handles accuracy=100 (edge case)', () => {
      const result = engine.evaluateCounterStrategyBonus(100);
      expect(result.active).toBe(true);
      expect(result.bonus).toBe(0.15);
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. computePerceivedProfile
  // ─────────────────────────────────────────────────────

  describe('computePerceivedProfile', () => {
    it('at accuracy=100, perceived equals actual (drift=0)', () => {
      const psychology = makePsychology({
        riskTolerance: 80,
        paranoia: 30,
        narcissism: 60,
        pragmatism: 25,
        patience: 90,
        vengefulIndex: 10,
      });
      const result = engine.computePerceivedProfile(psychology, 100);
      expect(result.perceivedPsychology.riskTolerance).toBe(80);
      expect(result.perceivedPsychology.paranoia).toBe(30);
      expect(result.perceivedPsychology.narcissism).toBe(60);
      expect(result.perceivedPsychology.pragmatism).toBe(25);
      expect(result.perceivedPsychology.patience).toBe(90);
      expect(result.perceivedPsychology.vengefulIndex).toBe(10);
      expect(result.driftMagnitude).toBe(0);
    });

    it('at accuracy=0, all numerics drift to 50', () => {
      const psychology = makePsychology({
        riskTolerance: 80,
        paranoia: 30,
        narcissism: 60,
        pragmatism: 25,
        patience: 90,
        vengefulIndex: 10,
      });
      const result = engine.computePerceivedProfile(psychology, 0);
      expect(result.perceivedPsychology.riskTolerance).toBe(50);
      expect(result.perceivedPsychology.paranoia).toBe(50);
      expect(result.perceivedPsychology.narcissism).toBe(50);
      expect(result.perceivedPsychology.pragmatism).toBe(50);
      expect(result.perceivedPsychology.patience).toBe(50);
      expect(result.perceivedPsychology.vengefulIndex).toBe(50);
    });

    it('correctly applies drift formula: perceived = actual + (50 - actual) * (1 - accuracy/100)', () => {
      // actual=80, accuracy=60 → perceived = 80 + (50-80)*(1-0.6) = 80 + (-30)*0.4 = 68
      const psychology = makePsychology({ riskTolerance: 80 });
      const result = engine.computePerceivedProfile(psychology, 60);
      expect(result.perceivedPsychology.riskTolerance).toBeCloseTo(68, 10);
    });

    it('preserves non-numeric fields (decisionStyle, stressResponse)', () => {
      const psychology = makePsychology({
        decisionStyle: DecisionStyle.Ideological,
        stressResponse: StressResponse.Deflect,
      });
      const result = engine.computePerceivedProfile(psychology, 40);
      expect(result.perceivedPsychology.decisionStyle).toBe(DecisionStyle.Ideological);
      expect(result.perceivedPsychology.stressResponse).toBe(StressResponse.Deflect);
    });

    it('driftMagnitude equals average |perceived - actual| across 6 numeric dims', () => {
      // All numerics at 50 → drift is 0 regardless of accuracy (50 is the drift target)
      const psychology = makePsychology(); // all 50
      const result = engine.computePerceivedProfile(psychology, 30);
      expect(result.driftMagnitude).toBe(0);
    });

    it('computes correct driftMagnitude for non-uniform profile at accuracy=50', () => {
      // actual=100 for all 6, accuracy=50 → perceived = 100 + (50-100)*0.5 = 75
      // drift per dimension = |75-100| = 25, average = 25
      const psychology = makePsychology({
        riskTolerance: 100,
        paranoia: 100,
        narcissism: 100,
        pragmatism: 100,
        patience: 100,
        vengefulIndex: 100,
      });
      const result = engine.computePerceivedProfile(psychology, 50);
      expect(result.perceivedPsychology.riskTolerance).toBeCloseTo(75, 10);
      expect(result.driftMagnitude).toBeCloseTo(25, 10);
    });

    it('passes through accuracy value in the result', () => {
      const result = engine.computePerceivedProfile(makePsychology(), 37);
      expect(result.accuracy).toBe(37);
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. buildFactionAiProfile
  // ─────────────────────────────────────────────────────

  describe('buildFactionAiProfile', () => {
    it('returns a valid profile for every one of the 8 factions', () => {
      for (const fid of ALL_FACTIONS) {
        const profile = engine.buildFactionAiProfile(fid);
        expect(profile.factionId).toBe(fid);
      }
    });

    it('each profile has numeric psychology values in [0, 100]', () => {
      const numericKeys: (keyof LeaderPsychology)[] = [
        'riskTolerance',
        'paranoia',
        'narcissism',
        'pragmatism',
        'patience',
        'vengefulIndex',
      ];
      for (const fid of ALL_FACTIONS) {
        const profile = engine.buildFactionAiProfile(fid);
        for (const key of numericKeys) {
          const val = profile.defaultPsychology[key] as number;
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      }
    });

    it('each profile has a non-empty historicalAnalog', () => {
      for (const fid of ALL_FACTIONS) {
        const profile = engine.buildFactionAiProfile(fid);
        expect(profile.historicalAnalog.length).toBeGreaterThan(0);
      }
    });

    it('US has riskTolerance=55 and pragmatism=70', () => {
      const profile = engine.buildFactionAiProfile(FactionId.US);
      expect(profile.defaultPsychology.riskTolerance).toBe(55);
      expect(profile.defaultPsychology.pragmatism).toBe(70);
    });

    it('Russia has paranoia=75 and vengefulIndex=80', () => {
      const profile = engine.buildFactionAiProfile(FactionId.Russia);
      expect(profile.defaultPsychology.paranoia).toBe(75);
      expect(profile.defaultPsychology.vengefulIndex).toBe(80);
    });

    it('DPRK has paranoia=95', () => {
      const profile = engine.buildFactionAiProfile(FactionId.DPRK);
      expect(profile.defaultPsychology.paranoia).toBe(95);
    });

    it('Iran uses DecisionStyle.Ideological', () => {
      const profile = engine.buildFactionAiProfile(FactionId.Iran);
      expect(profile.defaultPsychology.decisionStyle).toBe(DecisionStyle.Ideological);
    });
  });

  // ─────────────────────────────────────────────────────
  // 6. evaluateDesperationMode
  // ─────────────────────────────────────────────────────

  describe('evaluateDesperationMode', () => {
    it('returns inDesperation=false when all values are normal', () => {
      const result = engine.evaluateDesperationMode(makePowerBase(), 60, 30);
      expect(result.inDesperation).toBe(false);
      expect(result.triggers).toHaveLength(0);
    });

    it('returns zero modifiers when not in desperation', () => {
      const result = engine.evaluateDesperationMode(makePowerBase(), 60, 30);
      expect(result.psychologyModifiers.riskToleranceDelta).toBe(0);
      expect(result.psychologyModifiers.paranoiaDelta).toBe(0);
      expect(result.psychologyModifiers.patienceDelta).toBe(0);
    });

    it('triggers when stability < 20', () => {
      const result = engine.evaluateDesperationMode(makePowerBase(), 15, 30);
      expect(result.inDesperation).toBe(true);
      expect(result.triggers.some((t) => t.includes('Stability'))).toBe(true);
    });

    it('triggers when any powerBase sub-score < 15', () => {
      const result = engine.evaluateDesperationMode(makePowerBase({ military: 10 }), 60, 30);
      expect(result.inDesperation).toBe(true);
      expect(result.triggers.some((t) => t.includes('military'))).toBe(true);
    });

    it('triggers when civilUnrest > 80', () => {
      const result = engine.evaluateDesperationMode(makePowerBase(), 60, 85);
      expect(result.inDesperation).toBe(true);
      expect(result.triggers.some((t) => t.includes('Civil unrest'))).toBe(true);
    });

    it('applies correct modifiers in desperation: riskTolerance+30, paranoia+20, patience-30', () => {
      const result = engine.evaluateDesperationMode(makePowerBase(), 10, 30);
      expect(result.psychologyModifiers.riskToleranceDelta).toBe(30);
      expect(result.psychologyModifiers.paranoiaDelta).toBe(20);
      expect(result.psychologyModifiers.patienceDelta).toBe(-30);
    });

    it('collects multiple triggers simultaneously', () => {
      const result = engine.evaluateDesperationMode(
        makePowerBase({ clergy: 5, public: 3 }),
        10,
        90,
      );
      expect(result.inDesperation).toBe(true);
      // stability + civilUnrest + clergy + public = 4 triggers
      expect(result.triggers.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─────────────────────────────────────────────────────
  // 7. computePerceptionDrift
  // ─────────────────────────────────────────────────────

  describe('computePerceptionDrift', () => {
    it('reports zero drift for a freshly-initialized state', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      const drift = engine.computePerceptionDrift(state, 0);
      expect(drift.averageDrift).toBe(0);
      expect(drift.criticallyLowCount).toBe(0);
    });

    it('drift = |initialAccuracy(70) - currentAccuracy|', () => {
      let state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      // 3 inconsistent actions: 70 - 15 = 55
      state = engine.updatePerceptionAccuracy(state, false);
      state = engine.updatePerceptionAccuracy(state, false);
      state = engine.updatePerceptionAccuracy(state, false);
      const drift = engine.computePerceptionDrift(state, 3);
      // each faction: |70 - 55| = 15
      for (const fd of drift.perFactionDrift) {
        expect(fd.drift).toBe(15);
        expect(fd.accuracy).toBe(55);
      }
    });

    it('averageDrift equals mean of all per-faction drifts', () => {
      let state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      state = engine.updatePerceptionAccuracy(state, false); // all at 65
      const drift = engine.computePerceptionDrift(state, 1);
      // each drift = |70 - 65| = 5, average = 5
      expect(drift.averageDrift).toBe(5);
    });

    it('criticallyLow when accuracy < 30', () => {
      let state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      // 9 inconsistent actions: 70 - 45 = 25, but clamped to 20 after 10+ calls
      // 70 - 9*5 = 25 — not yet clamped
      for (let i = 0; i < 9; i++) {
        state = engine.updatePerceptionAccuracy(state, false);
      }
      // All factions at 25, which is < 30 → all critically low
      const drift = engine.computePerceptionDrift(state, 9);
      expect(drift.criticallyLowCount).toBe(8);
    });

    it('criticallyLow count is 0 when all accuracies are >= 30', () => {
      let state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      state = engine.updatePerceptionAccuracy(state, false); // all at 65
      const drift = engine.computePerceptionDrift(state, 1);
      expect(drift.criticallyLowCount).toBe(0);
    });

    it('passes through turnsElapsed value', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      const drift = engine.computePerceptionDrift(state, 42);
      expect(drift.turnsElapsed).toBe(42);
    });

    it('has one entry per faction in perFactionDrift', () => {
      const state = engine.initializePerception('leader-1' as LeaderId, ALL_FACTIONS);
      const drift = engine.computePerceptionDrift(state, 0);
      expect(drift.perFactionDrift).toHaveLength(8);
      const factionIds = drift.perFactionDrift.map((d) => d.factionId);
      for (const fid of ALL_FACTIONS) {
        expect(factionIds).toContain(fid);
      }
    });
  });
});
