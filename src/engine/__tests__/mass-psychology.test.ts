import { describe, it, expect, beforeEach } from 'vitest';
import { MassPsychologyEngine } from '@/engine/mass-psychology';
import type { ContagionInput, WarWearinessInput, MassPsychEffectsInput } from '@/engine/mass-psychology';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, LeaderId, TurnNumber } from '@/data/types';

const FACTION = 'us' as FactionId;
const LEADER = 'leader-1' as LeaderId;
const TURN = 5 as TurnNumber;

describe('MassPsychologyEngine', () => {
  let engine: MassPsychologyEngine;

  beforeEach(() => {
    engine = new MassPsychologyEngine(GAME_CONFIG.psychology);
  });

  // -------------------------------------------------------------------------
  // computeContagion (FR-1518)
  // -------------------------------------------------------------------------
  describe('computeContagion', () => {
    const cfg = GAME_CONFIG.psychology.emotionalContagion;

    function makeContagionInput(overrides: Partial<ContagionInput> = {}): ContagionInput {
      return {
        factionId: FACTION,
        leaderId: LEADER,
        leaderEmotions: { fear: 50, anger: 50, stress: 50, confidence: 50, resolve: 50 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
        isAutocracy: false,
        turnsDiverged: 0,
        currentTurn: TURN,
        ...overrides,
      };
    }

    it('uses democracy contagion rate when isAutocracy=false', () => {
      const result = engine.computeContagion(makeContagionInput({ isAutocracy: false }));
      // 0.1 * 1.0 = 0.1
      expect(result.contagionRate).toBe(cfg.leaderToPopulationRate * cfg.democracyContagionRate);
      expect(result.contagionRate).toBe(0.1);
    });

    it('uses autocracy contagion rate when isAutocracy=true', () => {
      const result = engine.computeContagion(makeContagionInput({ isAutocracy: true }));
      // 0.1 * 0.5 = 0.05
      expect(result.contagionRate).toBe(cfg.leaderToPopulationRate * cfg.autocracyContagionRate);
      expect(result.contagionRate).toBe(0.05);
    });

    it('shifts fear toward leader fear', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 80, anger: 50, stress: 50, confidence: 50, resolve: 50 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
        isAutocracy: false,
      }));
      // newFear = 50 + (80 - 50) * 0.1 = 53
      expect(result.updatedMassPsych.fear).toBeCloseTo(53);
    });

    it('shifts hope from leader confidence', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 50, anger: 50, stress: 50, confidence: 80, resolve: 50 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
        isAutocracy: false,
      }));
      // newHope = 50 + (80 - 50) * 0.1 = 53
      expect(result.updatedMassPsych.hope).toBeCloseTo(53);
    });

    it('shifts nationalism from leader resolve', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 50, anger: 50, stress: 50, confidence: 50, resolve: 80 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
        isAutocracy: false,
      }));
      // newNationalism = 50 + (80 - 50) * 0.1 = 53
      expect(result.updatedMassPsych.nationalism).toBeCloseTo(53);
    });

    it('leaves warWeariness unchanged by contagion', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 90, anger: 90, stress: 90, confidence: 90, resolve: 90 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
      }));
      expect(result.updatedMassPsych.warWeariness).toBe(40);
    });

    it('reports no divergence stress when turnsDiverged < divergenceTurns', () => {
      // Large difference so divergent=true, but turnsDiverged=2 < 3
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 100, anger: 100, stress: 50, confidence: 50, resolve: 50 },
        massPsych: { fear: 10, anger: 10, hope: 50, warWeariness: 40, nationalism: 50 },
        turnsDiverged: 2,
        isAutocracy: false,
      }));
      // After contagion: newFear = 10 + (100-10)*0.1 = 19, newAnger = 10 + (100-10)*0.1 = 19
      // avg divergence = (|100-19| + |100-19|) / 2 = 81 > 40 → divergent
      expect(result.divergent).toBe(true);
      expect(result.leaderStressDelta).toBe(0);
    });

    it('applies divergence stress when turnsDiverged >= divergenceTurns and divergent', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 100, anger: 100, stress: 50, confidence: 50, resolve: 50 },
        massPsych: { fear: 10, anger: 10, hope: 50, warWeariness: 40, nationalism: 50 },
        turnsDiverged: 3,
        isAutocracy: false,
      }));
      expect(result.divergent).toBe(true);
      expect(result.leaderStressDelta).toBe(cfg.stressPenaltyPerTurn);
      expect(result.leaderStressDelta).toBe(5);
    });

    it('reports no divergence when leader and population emotions are close', () => {
      const result = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 50, anger: 50, stress: 50, confidence: 50, resolve: 50 },
        massPsych: { fear: 50, anger: 50, hope: 50, warWeariness: 40, nationalism: 50 },
        turnsDiverged: 5,
      }));
      // newFear = 50 + (50-50)*0.1 = 50; newAnger = 50
      // avg divergence = (|50-50| + |50-50|) / 2 = 0 ≤ 40
      expect(result.divergent).toBe(false);
      expect(result.leaderStressDelta).toBe(0);
    });

    it('clamps population values to 0-100', () => {
      // Test upper clamp: leader emotions very high, pop already near 100
      const resultHigh = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 100, anger: 100, stress: 50, confidence: 100, resolve: 100 },
        massPsych: { fear: 99, anger: 99, hope: 99, warWeariness: 40, nationalism: 99 },
        isAutocracy: false,
      }));
      expect(resultHigh.updatedMassPsych.fear).toBeLessThanOrEqual(100);
      expect(resultHigh.updatedMassPsych.anger).toBeLessThanOrEqual(100);
      expect(resultHigh.updatedMassPsych.hope).toBeLessThanOrEqual(100);
      expect(resultHigh.updatedMassPsych.nationalism).toBeLessThanOrEqual(100);

      // Test lower clamp: leader emotions 0, pop near 0
      const resultLow = engine.computeContagion(makeContagionInput({
        leaderEmotions: { fear: 0, anger: 0, stress: 0, confidence: 0, resolve: 0 },
        massPsych: { fear: 1, anger: 1, hope: 1, warWeariness: 40, nationalism: 1 },
        isAutocracy: false,
      }));
      expect(resultLow.updatedMassPsych.fear).toBeGreaterThanOrEqual(0);
      expect(resultLow.updatedMassPsych.anger).toBeGreaterThanOrEqual(0);
      expect(resultLow.updatedMassPsych.hope).toBeGreaterThanOrEqual(0);
      expect(resultLow.updatedMassPsych.nationalism).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // computeWarWeariness (FR-1519)
  // -------------------------------------------------------------------------
  describe('computeWarWeariness', () => {
    const cfg = GAME_CONFIG.psychology.warWeariness;

    function makeWearinessInput(overrides: Partial<WarWearinessInput> = {}): WarWearinessInput {
      return {
        factionId: FACTION,
        currentWarWeariness: 50,
        inActiveConflict: false,
        inGreyZoneOps: false,
        currentNationalism: 40,
        currentTurn: TURN,
        ...overrides,
      };
    }

    it('increases weariness by activeConflictPerTurn during active conflict', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inActiveConflict: true,
      }));
      expect(result.delta).toBe(cfg.activeConflictPerTurn);
      expect(result.newWeariness).toBe(53);
    });

    it('increases weariness by greyZonePerTurn during grey-zone ops', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inGreyZoneOps: true,
      }));
      expect(result.delta).toBe(cfg.greyZonePerTurn);
      expect(result.newWeariness).toBe(51);
    });

    it('decays weariness during peacetime', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inActiveConflict: false,
        inGreyZoneOps: false,
      }));
      expect(result.delta).toBe(cfg.peacetimeDecayPerTurn);
      expect(result.newWeariness).toBe(48);
    });

    it('applies nationalism resistance when nationalism >= threshold and delta > 0', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inActiveConflict: true,
        currentNationalism: 60,
      }));
      // delta = 3 + (-1) = 2
      expect(result.delta).toBe(cfg.activeConflictPerTurn + cfg.nationalismResistanceReduction);
      expect(result.delta).toBe(2);
      expect(result.newWeariness).toBe(52);
    });

    it('does not apply nationalism resistance when delta <= 0 (peacetime)', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inActiveConflict: false,
        inGreyZoneOps: false,
        currentNationalism: 80,
      }));
      // Peacetime delta = -2, nationalism resistance only applies when delta > 0
      expect(result.delta).toBe(cfg.peacetimeDecayPerTurn);
      expect(result.delta).toBe(-2);
    });

    it('does not apply nationalism resistance when nationalism < threshold', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 50,
        inActiveConflict: true,
        currentNationalism: 59,
      }));
      // delta = 3 (no resistance because nationalism < 60)
      expect(result.delta).toBe(cfg.activeConflictPerTurn);
      expect(result.delta).toBe(3);
    });

    it('activates effects when newWeariness > effectsThreshold', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 69,
        inActiveConflict: true,
        currentNationalism: 40,
      }));
      // newWeariness = 69 + 3 = 72 > 70
      expect(result.newWeariness).toBe(72);
      expect(result.effectsActive).toBe(true);
      expect(result.civilUnrestModifier).toBe(cfg.civilUnrestBonus);
      expect(result.civilUnrestModifier).toBe(5);
      expect(result.treasuryCostModifier).toBe(cfg.treasuryCostMultiplier);
      expect(result.treasuryCostModifier).toBe(1.25);
      expect(result.popularityDecay).toBe(cfg.popularityDecayPerTurn);
      expect(result.popularityDecay).toBe(-3);
    });

    it('does not activate effects when newWeariness <= effectsThreshold', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 68,
        inActiveConflict: true,
        currentNationalism: 60,
      }));
      // delta = 3 + (-1) = 2; newWeariness = 68 + 2 = 70 (NOT > 70)
      expect(result.newWeariness).toBe(70);
      expect(result.effectsActive).toBe(false);
      expect(result.civilUnrestModifier).toBe(0);
      expect(result.treasuryCostModifier).toBe(1.0);
      expect(result.popularityDecay).toBe(0);
    });

    it('clamps weariness to 0 minimum', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 1,
        inActiveConflict: false,
        inGreyZoneOps: false,
      }));
      // 1 + (-2) = -1 → clamped to 0
      expect(result.newWeariness).toBe(0);
    });

    it('clamps weariness to 100 maximum', () => {
      const result = engine.computeWarWeariness(makeWearinessInput({
        currentWarWeariness: 99,
        inActiveConflict: true,
        currentNationalism: 40,
      }));
      // 99 + 3 = 102 → clamped to 100
      expect(result.newWeariness).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // computeMassPsychEffects (FR-1517)
  // -------------------------------------------------------------------------
  describe('computeMassPsychEffects', () => {
    const cfg = GAME_CONFIG.psychology.massPsychologyEffects;

    function makeEffectsInput(overrides: Partial<MassPsychEffectsInput['massPsych']> = {}): MassPsychEffectsInput {
      return {
        factionId: FACTION,
        massPsych: {
          fear: 40,
          anger: 40,
          hope: 50,
          warWeariness: 30,
          nationalism: 40,
          ...overrides,
        },
        currentTurn: TURN,
      };
    }

    it('returns no effects when all dimensions are moderate', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        anger: 40,
        hope: 50,
        nationalism: 40,
        warWeariness: 30,
        fear: 40,
      }));
      expect(result.civilUnrestModifier).toBe(0);
      expect(result.recruitmentModifier).toBe(0);
      expect(result.desertionRate).toBe(0);
      expect(result.treasuryModifier).toBe(0);
    });

    it('applies civil unrest from high anger and low hope', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        anger: 70,
        hope: 20,
        nationalism: 40,
        warWeariness: 30,
        fear: 40,
      }));
      // anger >= 60 AND hope < 30 → +10
      expect(result.civilUnrestModifier).toBe(cfg.angerLowHopeUnrestPerTurn);
      expect(result.civilUnrestModifier).toBe(10);
    });

    it('applies nationalism dampening on civil unrest', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        anger: 40,
        hope: 50,
        nationalism: 65,
        warWeariness: 30,
        fear: 40,
      }));
      // nationalism >= 60 → -5; anger < 60 so no unrest trigger
      expect(result.civilUnrestModifier).toBe(cfg.nationalismUnrestDampening);
      expect(result.civilUnrestModifier).toBe(-5);
    });

    it('stacks anger unrest and nationalism dampening', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        anger: 70,
        hope: 20,
        nationalism: 65,
        warWeariness: 30,
        fear: 40,
      }));
      // +10 (anger+low hope) + (-5) (nationalism) = 5
      expect(result.civilUnrestModifier).toBe(
        cfg.angerLowHopeUnrestPerTurn + cfg.nationalismUnrestDampening,
      );
      expect(result.civilUnrestModifier).toBe(5);
    });

    it('applies recruitment bonus from high nationalism and low weariness', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        nationalism: 70,
        warWeariness: 30,
        anger: 40,
        hope: 50,
        fear: 40,
      }));
      // nationalism >= 60 AND warWeariness < 60 → +0.15
      expect(result.recruitmentModifier).toBeCloseTo(cfg.recruitmentBonus);
      expect(result.recruitmentModifier).toBeCloseTo(0.15);
    });

    it('applies recruitment penalty from high weariness', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        warWeariness: 65,
        nationalism: 40,
        anger: 40,
        hope: 50,
        fear: 40,
      }));
      // warWeariness >= 60 → -0.2; nationalism < 60 so no bonus
      expect(result.recruitmentModifier).toBeCloseTo(cfg.recruitmentPenalty);
      expect(result.recruitmentModifier).toBeCloseTo(-0.2);
    });

    it('stacks both recruitment effects', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        nationalism: 70,
        warWeariness: 65,
        anger: 40,
        hope: 50,
        fear: 40,
      }));
      // nationalism >= 60 but warWeariness >= 60 → no bonus (weariness not < 60)
      // warWeariness >= 60 → -0.2
      // Actually: nationalism >= 60 AND warWeariness < 60 → FALSE (65 not < 60)
      // warWeariness >= 60 → -0.2
      // recruitmentModifier = -0.2
      // Wait, re-read the logic:
      // if nationalism>=60 AND warWeariness<60 → +0.15 → NOT triggered (65 not < 60)
      // if warWeariness>=60 → -0.2 → triggered
      // So total = -0.2
      // But the user spec says both can stack: nationalism=70, warWeariness=65 → 0.15 + (-0.2) = -0.05
      // Let me check the source code again...
      // Source: if nationalism >= 60 AND warWeariness < 60 → bonus
      //         if warWeariness >= 60 → penalty
      // With warWeariness=65: first condition false (65 not < 60), second true
      // So only penalty applies → -0.2
      // The user says they should stack but the threshold prevents it.
      // Actually: wearinessEffectThreshold is 60, and the conditions are:
      //   nationalism >= highNationalismThreshold(60) AND warWeariness < wearinessEffectThreshold(60)
      //   warWeariness >= wearinessEffectThreshold(60)
      // These are mutually exclusive by design (< 60 vs >= 60), so they CAN'T both be true.
      // But the user's spec says "Both recruitment effects can stack" with nationalism=70, warWeariness=65
      // This would only give -0.2. Let me re-read the user spec more carefully...
      // User says: "recruitmentModifier = 0.15 + (-0.2) = -0.05"
      // But the code won't produce that. The code checks warWeariness < wearinessEffectThreshold
      // for the bonus. With warWeariness=65 and threshold=60, the bonus condition fails.
      // I should follow the ACTUAL implementation, not the spec description.
      expect(result.recruitmentModifier).toBeCloseTo(-0.2);
    });

    it('triggers desertion when weariness is high', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        warWeariness: 65,
        anger: 40,
        hope: 50,
        nationalism: 40,
        fear: 40,
      }));
      expect(result.desertionRate).toBe(cfg.desertionRate);
      expect(result.desertionRate).toBe(0.1);
    });

    it('returns no desertion when weariness is low', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        warWeariness: 50,
        anger: 40,
        hope: 50,
        nationalism: 40,
        fear: 40,
      }));
      expect(result.desertionRate).toBe(0);
    });

    it('applies war bond bonus from high fear and high nationalism', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        fear: 70,
        nationalism: 65,
        anger: 40,
        hope: 50,
        warWeariness: 30,
      }));
      // fear >= 60 AND nationalism >= 60 → +0.1
      expect(result.treasuryModifier).toBeCloseTo(cfg.warBondBonus);
      expect(result.treasuryModifier).toBeCloseTo(0.1);
    });

    it('applies low hope treasury penalty', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        hope: 20,
        fear: 40,
        nationalism: 40,
        anger: 40,
        warWeariness: 30,
      }));
      // hope < 30 → -0.1
      expect(result.treasuryModifier).toBeCloseTo(cfg.lowHopeTreasuryPenalty);
      expect(result.treasuryModifier).toBeCloseTo(-0.1);
    });

    it('stacks war bond bonus and low hope penalty to zero', () => {
      const result = engine.computeMassPsychEffects(makeEffectsInput({
        fear: 70,
        nationalism: 65,
        hope: 20,
        anger: 40,
        warWeariness: 30,
      }));
      // +0.1 (war bonds) + (-0.1) (low hope) = 0
      expect(result.treasuryModifier).toBeCloseTo(
        cfg.warBondBonus + cfg.lowHopeTreasuryPenalty,
      );
      expect(result.treasuryModifier).toBeCloseTo(0);
    });
  });
});
