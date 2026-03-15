import { describe, it, expect } from 'vitest';
import { NuclearStrikeEngine } from '@/engine/nuclear-strike';
import type { RedTelephoneInput } from '@/engine/nuclear-strike';
import { FactionId, NuclearEscalationBand } from '@/data/types';
import type { NationState, TurnNumber } from '@/data/types';
import { SeededRandom } from '@/engine/rng';
import type { NuclearFactionState } from '@/engine/nuclear-escalation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNation(overrides?: Partial<NationState>): NationState {
  return {
    factionId: FactionId.US,
    stability: 70,
    treasury: 500,
    gdp: 21000,
    inflation: 3,
    militaryReadiness: 80,
    nuclearThreshold: 10,
    diplomaticInfluence: 60,
    popularity: 55,
    allianceCredibility: 75,
    techLevel: 90,
    ...overrides,
  };
}

function makeNuclearState(overrides?: Partial<NuclearFactionState>): NuclearFactionState {
  return {
    factionId: FactionId.US,
    threshold: 50,
    band: NuclearEscalationBand.TacticalReadiness,
    lastUpdatedTurn: 0 as TurnNumber,
    mobileLaunchersRepositioned: false,
    tacticalOptionsPrepared: false,
    ...overrides,
  };
}

function makeRedTelephoneInput(overrides?: Partial<RedTelephoneInput>): RedTelephoneInput {
  return {
    initiatingFaction: FactionId.US,
    targetFaction: FactionId.Russia,
    initiatorDI: 50,
    trustLevel: 40,
    lastUsedTurn: null,
    currentTurn: 10 as unknown as number,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NuclearStrikeEngine', () => {
  const engine = new NuclearStrikeEngine();

  // -----------------------------------------------------------------------
  // checkDemonstrationStrikeEligibility
  // -----------------------------------------------------------------------

  describe('checkDemonstrationStrikeEligibility', () => {
    it('eligible: threshold 80, stability 10, capitalThreatened false (stability < 15)', () => {
      const nuclearState = makeNuclearState({ threshold: 80, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 10 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, false);
      expect(result.eligible).toBe(true);
      expect(result.stabilityBelowThreshold).toBe(true);
      expect(result.capitalThreatened).toBe(false);
    });

    it('eligible: threshold 75, stability 50, capitalThreatened true', () => {
      const nuclearState = makeNuclearState({ threshold: 75, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 50 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, true);
      expect(result.eligible).toBe(true);
      expect(result.capitalThreatened).toBe(true);
      expect(result.stabilityBelowThreshold).toBe(false);
    });

    it('eligible: threshold 90, stability 5, capitalThreatened true (both conditions)', () => {
      const nuclearState = makeNuclearState({ threshold: 90, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 5 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, true);
      expect(result.eligible).toBe(true);
      expect(result.capitalThreatened).toBe(true);
      expect(result.stabilityBelowThreshold).toBe(true);
    });

    it('not eligible: threshold 60 (below ThresholdBreach band)', () => {
      const nuclearState = makeNuclearState({ threshold: 60, band: NuclearEscalationBand.TacticalReadiness });
      const nationState = makeNation({ stability: 5 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, true);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('below Threshold Breach');
    });

    it('not eligible: threshold 80, stability 50, capitalThreatened false (neither trigger)', () => {
      const nuclearState = makeNuclearState({ threshold: 80, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 50 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, false);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('neither capital is threatened nor stability is critically low');
    });

    it('boundary: threshold exactly 71, stability exactly 15 → not eligible (stability not < 15)', () => {
      const nuclearState = makeNuclearState({ threshold: 71, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 15 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, false);
      expect(result.eligible).toBe(false);
      expect(result.stabilityBelowThreshold).toBe(false);
    });

    it('boundary: threshold exactly 71, stability exactly 14 → eligible', () => {
      const nuclearState = makeNuclearState({ threshold: 71, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 14 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, false);
      expect(result.eligible).toBe(true);
      expect(result.stabilityBelowThreshold).toBe(true);
    });

    it('boundary: threshold exactly 70 → not eligible (below 71)', () => {
      const nuclearState = makeNuclearState({ threshold: 70, band: NuclearEscalationBand.TacticalReadiness });
      const nationState = makeNation({ stability: 5 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, true);
      expect(result.eligible).toBe(false);
    });

    it('returns reason string mentioning capital when capitalThreatened', () => {
      const nuclearState = makeNuclearState({ threshold: 85, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 50 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, true);
      expect(result.reason).toContain('capital is threatened');
    });

    it('returns reason string mentioning stability when below threshold', () => {
      const nuclearState = makeNuclearState({ threshold: 85, band: NuclearEscalationBand.ThresholdBreach });
      const nationState = makeNation({ stability: 10 });
      const result = engine.checkDemonstrationStrikeEligibility(nuclearState, nationState, false);
      expect(result.reason).toContain('stability');
    });
  });

  // -----------------------------------------------------------------------
  // executeDemonstrationStrike
  // -----------------------------------------------------------------------

  describe('executeDemonstrationStrike', () => {
    it('returns correct penalty values from config defaults', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.Iran,
        threshold: 75,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.Iran,
        targetNuclearState,
        rng,
      );
      expect(result.diPenalty).toBe(-30);
      expect(result.targetStabilityPenalty).toBe(-15);
      expect(result.globalTensionIncrease).toBe(25);
      expect(result.strikerThresholdIncrease).toBe(15);
    });

    it('correctly assigns strikingFaction and targetFaction', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.Iran,
        threshold: 75,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(99);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.Iran,
        targetNuclearState,
        rng,
      );
      expect(result.strikingFaction).toBe(FactionId.US);
      expect(result.targetFaction).toBe(FactionId.Iran);
    });

    it('chains second-strike when target is capable (Russia)', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.Russia,
        threshold: 80,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.Russia,
        targetNuclearState,
        rng,
      );
      expect(result.secondStrikeTriggered).toBe(true);
      expect(result.secondStrikeResult).not.toBeNull();
      expect(result.secondStrikeResult?.respondingFaction).toBe(FactionId.Russia);
      expect(result.secondStrikeResult?.initiatingFaction).toBe(FactionId.US);
    });

    it('no second-strike when target not capable (Iran)', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.Iran,
        threshold: 75,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.Iran,
        targetNuclearState,
        rng,
      );
      expect(result.secondStrikeTriggered).toBe(false);
      expect(result.secondStrikeResult).toBeNull();
    });

    it('second-strike result included when triggered against China', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.China,
        threshold: 85,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(7);
      const result = engine.executeDemonstrationStrike(
        FactionId.Russia,
        FactionId.China,
        targetNuclearState,
        rng,
      );
      expect(result.secondStrikeTriggered).toBe(true);
      expect(result.secondStrikeResult).toBeDefined();
      expect(result.secondStrikeResult?.respondingFaction).toBe(FactionId.China);
    });

    it('returns a description string', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.Iran,
        threshold: 75,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.Iran,
        targetNuclearState,
        rng,
      );
      expect(result.description).toBeTruthy();
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('uses target nuclear state factionId for second-strike capability check', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.US,
        threshold: 80,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.Russia,
        FactionId.US,
        targetNuclearState,
        rng,
      );
      expect(result.secondStrikeTriggered).toBe(true);
    });

    it('no second-strike for DPRK target', () => {
      const targetNuclearState = makeNuclearState({
        factionId: FactionId.DPRK,
        threshold: 80,
        band: NuclearEscalationBand.ThresholdBreach,
      });
      const rng = new SeededRandom(42);
      const result = engine.executeDemonstrationStrike(
        FactionId.US,
        FactionId.DPRK,
        targetNuclearState,
        rng,
      );
      expect(result.secondStrikeTriggered).toBe(false);
      expect(result.secondStrikeResult).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // hasSecondStrikeCapability
  // -----------------------------------------------------------------------

  describe('hasSecondStrikeCapability', () => {
    it('US has second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.US)).toBe(true);
    });

    it('China has second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.China)).toBe(true);
    });

    it('Russia has second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.Russia)).toBe(true);
    });

    it('Iran does NOT have second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.Iran)).toBe(false);
    });

    it('DPRK does NOT have second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.DPRK)).toBe(false);
    });

    it('Japan does NOT have second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.Japan)).toBe(false);
    });

    it('EU does NOT have second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.EU)).toBe(false);
    });

    it('Syria does NOT have second-strike capability', () => {
      expect(engine.hasSecondStrikeCapability(FactionId.Syria)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // resolveSecondStrike
  // -----------------------------------------------------------------------

  describe('resolveSecondStrike', () => {
    it('counter-strike fires when roll < 0.9: stabilityCollapse -50, nuclearWinter true', () => {
      // Find a seed where rng.next() < 0.9 (most seeds will)
      const rng = new SeededRandom(42);
      const roll = rng.next(); // peek at what the roll will be
      // Use a fresh rng for the actual call
      const rng2 = new SeededRandom(42);
      const result = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng2);

      if (roll < 0.9) {
        expect(result.counterStrikeFired).toBe(true);
        expect(result.nuclearWinterTriggered).toBe(true);
        expect(result.stabilityCollapse).toBe(-50);
      } else {
        expect(result.counterStrikeFired).toBe(false);
        expect(result.nuclearWinterTriggered).toBe(false);
        expect(result.stabilityCollapse).toBe(0);
      }
    });

    it('counter-strike does not fire when roll >= 0.9', () => {
      // We need a seed that produces a value >= 0.9
      // Iterate seeds to find one
      let testSeed = 0;
      for (let seed = 0; seed < 10000; seed++) {
        const probe = new SeededRandom(seed);
        if (probe.next() >= 0.9) {
          testSeed = seed;
          break;
        }
      }
      const rng = new SeededRandom(testSeed);
      const result = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      expect(result.counterStrikeFired).toBe(false);
      expect(result.nuclearWinterTriggered).toBe(false);
      expect(result.stabilityCollapse).toBe(0);
    });

    it('deterministic with the same seed', () => {
      const rng1 = new SeededRandom(123);
      const rng2 = new SeededRandom(123);
      const result1 = engine.resolveSecondStrike(FactionId.China, FactionId.US, rng1);
      const result2 = engine.resolveSecondStrike(FactionId.China, FactionId.US, rng2);
      expect(result1.roll).toBe(result2.roll);
      expect(result1.counterStrikeFired).toBe(result2.counterStrikeFired);
      expect(result1.nuclearWinterTriggered).toBe(result2.nuclearWinterTriggered);
      expect(result1.stabilityCollapse).toBe(result2.stabilityCollapse);
    });

    it('correctly assigns respondingFaction and initiatingFaction', () => {
      const rng = new SeededRandom(42);
      const result = engine.resolveSecondStrike(FactionId.China, FactionId.Russia, rng);
      expect(result.respondingFaction).toBe(FactionId.China);
      expect(result.initiatingFaction).toBe(FactionId.Russia);
    });

    it('counterStrikeProbability is 0.9', () => {
      const rng = new SeededRandom(42);
      const result = engine.resolveSecondStrike(FactionId.US, FactionId.Russia, rng);
      expect(result.counterStrikeProbability).toBe(0.9);
    });

    it('roll is between 0 and 1', () => {
      const rng = new SeededRandom(777);
      const result = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      expect(result.roll).toBeGreaterThanOrEqual(0);
      expect(result.roll).toBeLessThan(1);
    });

    it('description is populated', () => {
      const rng = new SeededRandom(42);
      const result = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      expect(result.description).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // checkNuclearWinter
  // -----------------------------------------------------------------------

  describe('checkNuclearWinter', () => {
    it('returns true when counterStrikeFired is true', () => {
      const rng = new SeededRandom(42);
      const secondStrike = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      // Force a scenario where counterStrikeFired is true
      const result = engine.checkNuclearWinter({
        ...secondStrike,
        counterStrikeFired: true,
      });
      expect(result).toBe(true);
    });

    it('returns false when counterStrikeFired is false', () => {
      const rng = new SeededRandom(42);
      const secondStrike = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      const result = engine.checkNuclearWinter({
        ...secondStrike,
        counterStrikeFired: false,
      });
      expect(result).toBe(false);
    });

    it('mirrors the counterStrikeFired field exactly', () => {
      const rng = new SeededRandom(42);
      const secondStrike = engine.resolveSecondStrike(FactionId.Russia, FactionId.US, rng);
      expect(engine.checkNuclearWinter(secondStrike)).toBe(secondStrike.counterStrikeFired);
    });
  });

  // -----------------------------------------------------------------------
  // validateRedTelephone
  // -----------------------------------------------------------------------

  describe('validateRedTelephone', () => {
    it('valid: trust 30, no previous use, DI 20', () => {
      const input = makeRedTelephoneInput({ trustLevel: 30, initiatorDI: 20, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });

    it('invalid: trust 15 (below minimumTrust 20)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 15, initiatorDI: 50 });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Trust');
    });

    it('invalid: cooldown not expired (lastUsedTurn = 5, currentTurn = 7, needs >= 8)', () => {
      const input = makeRedTelephoneInput({
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: 5,
        currentTurn: 7 as unknown as number,
      });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('cooldown');
    });

    it('valid: cooldown expired (lastUsedTurn = 5, currentTurn = 9)', () => {
      const input = makeRedTelephoneInput({
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: 5,
        currentTurn: 9 as unknown as number,
      });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });

    it('valid: cooldown exactly met (lastUsedTurn = 5, currentTurn = 8, turnsSince = 3)', () => {
      const input = makeRedTelephoneInput({
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: 5,
        currentTurn: 8 as unknown as number,
      });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });

    it('invalid: insufficient DI (DI 5, cost 10)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 5, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient Diplomatic Influence');
    });

    it('valid with high trust discount: trust 70, DI 5 (cost becomes 5)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 70, initiatorDI: 5, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
      expect(result.effectiveCost).toBe(5);
    });

    it('invalid with high trust discount: trust 70, DI 4 (still not enough)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 70, initiatorDI: 4, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
      expect(result.effectiveCost).toBe(5);
    });

    it('trust exactly 20 → valid (>= minimumTrust)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 20, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });

    it('trust exactly 19 → invalid (below minimumTrust)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 19, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
    });

    it('trust exactly 60 → no discount (discount only at > 60)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 60, initiatorDI: 10, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
      expect(result.effectiveCost).toBe(10);
    });

    it('trust exactly 61 → discount applies', () => {
      const input = makeRedTelephoneInput({ trustLevel: 61, initiatorDI: 10, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
      expect(result.effectiveCost).toBe(5);
    });

    it('DI exactly equal to cost → valid', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 10, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });

    it('DI just below cost → invalid', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 9, lastUsedTurn: null });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(false);
    });

    it('null lastUsedTurn always passes cooldown check', () => {
      const input = makeRedTelephoneInput({
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: null,
        currentTurn: 1 as unknown as number,
      });
      const result = engine.validateRedTelephone(input);
      expect(result.eligible).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // executeRedTelephone
  // -----------------------------------------------------------------------

  describe('executeRedTelephone', () => {
    it('blocked when validation fails → returns blocked result', () => {
      const input = makeRedTelephoneInput({ trustLevel: 5, initiatorDI: 50 });
      const result = engine.executeRedTelephone(input);
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBeTruthy();
      expect(result.diCostPaid).toBe(0);
      expect(result.thresholdReduction).toBe(0);
    });

    it('success: thresholdReduction is 15 for both nations', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.blocked).toBe(false);
      expect(result.thresholdReduction).toBe(15);
    });

    it('DI cost deducted correctly (standard cost 10)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.diCostPaid).toBe(10);
    });

    it('high trust discount on DI cost (trust 70 → cost 5)', () => {
      const input = makeRedTelephoneInput({ trustLevel: 70, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.diCostPaid).toBe(5);
      expect(result.trustDiscountApplied).toBe(true);
    });

    it('no trust discount when trust is exactly 60', () => {
      const input = makeRedTelephoneInput({ trustLevel: 60, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.diCostPaid).toBe(10);
      expect(result.trustDiscountApplied).toBe(false);
    });

    it('correctly assigns initiatingFaction and targetFaction', () => {
      const input = makeRedTelephoneInput({
        initiatingFaction: FactionId.China,
        targetFaction: FactionId.US,
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: null,
      });
      const result = engine.executeRedTelephone(input);
      expect(result.initiatingFaction).toBe(FactionId.China);
      expect(result.targetFaction).toBe(FactionId.US);
    });

    it('blockReason is null on success', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.blockReason).toBeNull();
    });

    it('blocked due to cooldown → returns blocked result with reason', () => {
      const input = makeRedTelephoneInput({
        trustLevel: 40,
        initiatorDI: 50,
        lastUsedTurn: 8,
        currentTurn: 9 as unknown as number,
      });
      const result = engine.executeRedTelephone(input);
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain('cooldown');
    });

    it('blocked due to insufficient DI → returns blocked result', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 3, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain('Insufficient');
    });

    it('description is populated on success', () => {
      const input = makeRedTelephoneInput({ trustLevel: 40, initiatorDI: 50, lastUsedTurn: null });
      const result = engine.executeRedTelephone(input);
      expect(result.description).toBeTruthy();
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('description mentions Red Telephone on block', () => {
      const input = makeRedTelephoneInput({ trustLevel: 5, initiatorDI: 50 });
      const result = engine.executeRedTelephone(input);
      expect(result.description).toContain('Red Telephone');
    });
  });
});
