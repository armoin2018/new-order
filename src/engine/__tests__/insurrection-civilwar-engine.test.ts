import { describe, it, expect, beforeEach } from 'vitest';
import { InsurrectionCivilWarEngine } from '@/engine/insurrection-civilwar-engine';
import type {
  InsurrectionOnsetResult,
  InsurrectionEffectsResult,
  CivilWarOnsetResult,
  CivilWarEffectsResult,
  EthnicFundingResult,
  MilitaryLoyaltySplitResult,
} from '@/engine/insurrection-civilwar-engine';
import { GAME_CONFIG } from '@/engine/config';
import { EscalationStage, NationSplitStatus } from '@/data/types';
import type { FactionId, TurnNumber, NationFaultLines, EthnicFaultLine } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makeFaultLine(overrides?: Partial<EthnicFaultLine>): EthnicFaultLine {
  return {
    groupName: 'Test Group',
    tensionBase: 30,
    triggers: [],
    foreignSponsorVulnerability: 50,
    affectedHexRegions: [],
    ...overrides,
  };
}

function makeFaultLines(lines: EthnicFaultLine[]): NationFaultLines {
  return {
    factionId: 'us' as FactionId,
    faultLines: lines,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('InsurrectionCivilWarEngine', () => {
  let engine: InsurrectionCivilWarEngine;

  beforeEach(() => {
    engine = new InsurrectionCivilWarEngine(GAME_CONFIG.stability);
  });

  // ─────────────────────────────────────────────────────
  // 1. evaluateInsurrectionOnset
  // ─────────────────────────────────────────────────────

  describe('evaluateInsurrectionOnset', () => {
    it('triggers when unrest is 61 and previousStage is Grumbling', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        61,
        EscalationStage.Grumbling,
      );
      expect(result.triggered).toBe(true);
      expect(result.factionsSpawned).toBe(2);
      expect(result.factionStrength).toBe(40);
      expect(result.affectedHexCount).toBe(3);
    });

    it('triggers when unrest is 80 and previousStage is Protests', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        80,
        EscalationStage.Protests,
      );
      expect(result.triggered).toBe(true);
      expect(result.factionsSpawned).toBe(2);
      expect(result.factionStrength).toBe(40);
      expect(result.affectedHexCount).toBe(3);
    });

    it('triggers when unrest is 70 and previousStage is Riots', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        70,
        EscalationStage.Riots,
      );
      expect(result.triggered).toBe(true);
      expect(result.factionsSpawned).toBe(2);
    });

    it('does NOT trigger if previousStage is already Insurrection', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        70,
        EscalationStage.Insurrection,
      );
      expect(result.triggered).toBe(false);
      expect(result.factionsSpawned).toBe(0);
      expect(result.factionStrength).toBe(0);
      expect(result.affectedHexCount).toBe(0);
    });

    it('does NOT trigger if previousStage is CivilWar', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        65,
        EscalationStage.CivilWar,
      );
      expect(result.triggered).toBe(false);
      expect(result.factionsSpawned).toBe(0);
    });

    it('does NOT trigger if unrest is below 61 (boundary: 60)', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        60,
        EscalationStage.Riots,
      );
      expect(result.triggered).toBe(false);
      expect(result.factionsSpawned).toBe(0);
    });

    it('does NOT trigger if unrest is above 80 (boundary: 81)', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        81,
        EscalationStage.Riots,
      );
      expect(result.triggered).toBe(false);
      expect(result.factionsSpawned).toBe(0);
    });

    it('clamps unrest above 100 — still not in insurrection band', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        150,
        EscalationStage.Riots,
      );
      // clamp(150,0,100)=100, which is >= 81 (civil war band), not 61-80
      expect(result.triggered).toBe(false);
    });

    it('clamps negative unrest to 0 — does not trigger', () => {
      const result: InsurrectionOnsetResult = engine.evaluateInsurrectionOnset(
        -10,
        EscalationStage.Grumbling,
      );
      expect(result.triggered).toBe(false);
      expect(result.factionsSpawned).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. computeInsurrectionEffects
  // ─────────────────────────────────────────────────────

  describe('computeInsurrectionEffects', () => {
    it('loses 3 hexes when government controls more than 3', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        20,
        50,
      );
      expect(result.hexControlLost).toBe(3);
      // (20 - 3) / 50 * 100 = 34
      expect(result.remainingControlPercent).toBe(34);
      expect(result.militaryReadinessDelta).toBe(-5);
    });

    it('loses only hexControlled when fewer than hexControlLossPerTurn', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        2,
        50,
      );
      expect(result.hexControlLost).toBe(2);
      // (2 - 2) / 50 * 100 = 0
      expect(result.remainingControlPercent).toBe(0);
    });

    it('returns hexControlLost=0 when hexControlled is 0', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        0,
        50,
      );
      expect(result.hexControlLost).toBe(0);
      expect(result.remainingControlPercent).toBe(0);
    });

    it('returns remainingControlPercent=0 when totalHexes is 0 (edge case)', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        10,
        0,
      );
      expect(result.remainingControlPercent).toBe(0);
    });

    it('computes 100% remaining when all hexes still controlled (large territory)', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        100,
        100,
      );
      expect(result.hexControlLost).toBe(3);
      // (100 - 3) / 100 * 100 = 97
      expect(result.remainingControlPercent).toBe(97);
    });

    it('always returns militaryReadinessDelta of -5', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        5 as TurnNumber,
        30,
        60,
      );
      expect(result.militaryReadinessDelta).toBe(-5);
    });

    it('golden-value: hexControlled=3, totalHexes=10 → 0% remaining', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        1 as TurnNumber,
        3,
        10,
      );
      expect(result.hexControlLost).toBe(3);
      // (3 - 3) / 10 * 100 = 0
      expect(result.remainingControlPercent).toBe(0);
    });

    it('golden-value: hexControlled=50, totalHexes=100 → 47% remaining', () => {
      const result: InsurrectionEffectsResult = engine.computeInsurrectionEffects(
        2 as TurnNumber,
        50,
        100,
      );
      expect(result.hexControlLost).toBe(3);
      // (50 - 3) / 100 * 100 = 47
      expect(result.remainingControlPercent).toBe(47);
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. evaluateCivilWarOnset
  // ─────────────────────────────────────────────────────

  describe('evaluateCivilWarOnset', () => {
    it('triggers with 2 factions when unrest is 81 and previous is Insurrection', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        81,
        EscalationStage.Insurrection,
        1000,
      );
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(2);
      expect(result.splitStatus).toBe(NationSplitStatus.Split);
      // treasurySplitEqual=true → 1000/2 = 500
      expect(result.treasuryPerFaction).toBe(500);
    });

    it('triggers with 3 factions when unrest is 90 (midpoint boundary)', () => {
      // midpoint = 81 + floor((100-81)/2) = 81 + 9 = 90, so >= 90 → 3 factions
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        90,
        EscalationStage.Insurrection,
        600,
      );
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(3);
      // treasurySplitEqual=true → 600/3 = 200
      expect(result.treasuryPerFaction).toBe(200);
    });

    it('triggers with 2 factions when unrest is 89 (just below midpoint)', () => {
      // 89 < 90 → 2 factions
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        89,
        EscalationStage.Insurrection,
        600,
      );
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(2);
      // treasurySplitEqual=true → 600/2 = 300
      expect(result.treasuryPerFaction).toBe(300);
    });

    it('triggers with 3 factions when unrest is 91 (midpoint)', () => {
      // midpoint = 90, so >= 91 → 3 factions
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        91,
        EscalationStage.Riots,
        900,
      );
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(3);
      // treasurySplitEqual=true → 900/3 = 300
      expect(result.treasuryPerFaction).toBe(300);
    });

    it('triggers with 3 factions when unrest is 100', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        100,
        EscalationStage.Insurrection,
        1200,
      );
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(3);
      expect(result.treasuryPerFaction).toBe(400);
    });

    it('does NOT trigger when previousStage is already CivilWar', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        95,
        EscalationStage.CivilWar,
        1000,
      );
      expect(result.triggered).toBe(false);
      expect(result.splitFactions).toBe(0);
      expect(result.splitStatus).toBe(NationSplitStatus.Intact);
      expect(result.treasuryPerFaction).toBe(1000);
    });

    it('does NOT trigger when unrest is below 81 (boundary: 80)', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        80,
        EscalationStage.Insurrection,
        500,
      );
      expect(result.triggered).toBe(false);
      expect(result.splitStatus).toBe(NationSplitStatus.Intact);
      expect(result.treasuryPerFaction).toBe(500);
    });

    it('handles zero treasury correctly', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        85,
        EscalationStage.Riots,
        0,
      );
      expect(result.triggered).toBe(true);
      expect(result.treasuryPerFaction).toBe(0);
    });

    it('clamps unrest above 100 — still triggers at max band with 3 factions', () => {
      const result: CivilWarOnsetResult = engine.evaluateCivilWarOnset(
        120,
        EscalationStage.Insurrection,
        300,
      );
      // clamp(120,0,100)=100 → >=91 → 3 factions
      expect(result.triggered).toBe(true);
      expect(result.splitFactions).toBe(3);
      expect(result.treasuryPerFaction).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. computeCivilWarEffects
  // ─────────────────────────────────────────────────────

  describe('computeCivilWarEffects', () => {
    it('returns correct effects for 2 split factions', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        2,
        1 as TurnNumber,
      );
      expect(result.stabilityDelta).toBe(-10);
      expect(result.economicGrowthMultiplier).toBe(-0.5);
      expect(result.militaryReadinessDeltaPerFaction).toBe(-10);
      expect(result.totalMilitaryReadinessDelta).toBe(-20);
    });

    it('returns correct effects for 3 split factions', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        3,
        1 as TurnNumber,
      );
      expect(result.stabilityDelta).toBe(-10);
      expect(result.economicGrowthMultiplier).toBe(-0.5);
      expect(result.militaryReadinessDeltaPerFaction).toBe(-10);
      expect(result.totalMilitaryReadinessDelta).toBe(-30);
    });

    it('clamps splitFactions below 2 up to minSplitFactions (2)', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        1,
        1 as TurnNumber,
      );
      // clamped to 2
      expect(result.totalMilitaryReadinessDelta).toBe(-20);
    });

    it('clamps splitFactions above 3 down to maxSplitFactions (3)', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        10,
        1 as TurnNumber,
      );
      // clamped to 3
      expect(result.totalMilitaryReadinessDelta).toBe(-30);
    });

    it('clamps splitFactions of 0 up to 2', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        0,
        1 as TurnNumber,
      );
      expect(result.totalMilitaryReadinessDelta).toBe(-20);
    });

    it('stability delta is always -10 regardless of factions', () => {
      const r2: CivilWarEffectsResult = engine.computeCivilWarEffects(2, 1 as TurnNumber);
      const r3: CivilWarEffectsResult = engine.computeCivilWarEffects(3, 1 as TurnNumber);
      expect(r2.stabilityDelta).toBe(-10);
      expect(r3.stabilityDelta).toBe(-10);
    });

    it('economic growth multiplier is always -0.5 regardless of factions', () => {
      const r2: CivilWarEffectsResult = engine.computeCivilWarEffects(2, 5 as TurnNumber);
      const r3: CivilWarEffectsResult = engine.computeCivilWarEffects(3, 5 as TurnNumber);
      expect(r2.economicGrowthMultiplier).toBe(-0.5);
      expect(r3.economicGrowthMultiplier).toBe(-0.5);
    });

    it('golden-value: splitFactions=2 → total readiness delta = -20', () => {
      const result: CivilWarEffectsResult = engine.computeCivilWarEffects(
        2,
        3 as TurnNumber,
      );
      expect(result.militaryReadinessDeltaPerFaction).toBe(-10);
      expect(result.totalMilitaryReadinessDelta).toBe(-10 * 2);
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. computeEthnicFunding
  // ─────────────────────────────────────────────────────

  describe('computeEthnicFunding', () => {
    it('returns totalTensionIncrease=0 for empty fault lines', () => {
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        makeFaultLines([]),
        10,
        2,
      );
      expect(result.totalTensionIncrease).toBe(0);
      expect(result.faultLineUpdates).toHaveLength(0);
    });

    it('computes funding tension correctly for single fault line', () => {
      // fundingTension = 10 * 0.15 * (50/100) = 0.75
      // hostileTension = 0 * 8 = 0
      // tensionDelta = 0.75
      // newTension = clamp(30 + 0.75, 0, 100) = 30.75
      const faultLines = makeFaultLines([makeFaultLine()]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        10,
        0,
      );
      expect(result.faultLineUpdates).toHaveLength(1);
      expect(result.faultLineUpdates[0].tensionDelta).toBeCloseTo(0.75, 5);
      expect(result.faultLineUpdates[0].newTension).toBeCloseTo(30.75, 5);
      expect(result.totalTensionIncrease).toBeCloseTo(0.75, 5);
    });

    it('computes hostile tension correctly with no foreign funding', () => {
      // fundingTension = 0 * 0.15 * (50/100) = 0
      // hostileTension = 2 * 8 = 16
      // tensionDelta = 0 + 16 = 16
      // newTension = clamp(30 + 16, 0, 100) = 46
      const faultLines = makeFaultLines([makeFaultLine()]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        0,
        2,
      );
      expect(result.faultLineUpdates[0].tensionDelta).toBe(16);
      expect(result.faultLineUpdates[0].newTension).toBe(46);
    });

    it('caps funding tension at maxFundingBoostPerTurn (10)', () => {
      // fundingTension = 1000 * 0.15 * (100/100) = 150 → capped at 10
      // hostileTension = 0
      // tensionDelta = 10
      const line = makeFaultLine({ foreignSponsorVulnerability: 100, tensionBase: 20 });
      const faultLines = makeFaultLines([line]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        1000,
        0,
      );
      expect(result.faultLineUpdates[0].tensionDelta).toBe(10);
      expect(result.faultLineUpdates[0].newTension).toBe(30);
    });

    it('clamps newTension at 100 when tension would exceed max', () => {
      // tensionBase = 95, hostileTension = 1 * 8 = 8
      // fundingTension = 5 * 0.15 * (50/100) = 0.375
      // tensionDelta = 0.375 + 8 = 8.375
      // newTension = clamp(95 + 8.375, 0, 100) = 100
      const line = makeFaultLine({ tensionBase: 95 });
      const faultLines = makeFaultLines([line]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        5,
        1,
      );
      expect(result.faultLineUpdates[0].newTension).toBe(100);
    });

    it('clamps newTension at 0 when tensionBase is 0 and no inputs', () => {
      const line = makeFaultLine({ tensionBase: 0, foreignSponsorVulnerability: 0 });
      const faultLines = makeFaultLines([line]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        0,
        0,
      );
      expect(result.faultLineUpdates[0].newTension).toBe(0);
      expect(result.faultLineUpdates[0].tensionDelta).toBe(0);
    });

    it('handles multiple fault lines independently', () => {
      const line1 = makeFaultLine({
        groupName: 'Group A',
        tensionBase: 20,
        foreignSponsorVulnerability: 100,
      });
      const line2 = makeFaultLine({
        groupName: 'Group B',
        tensionBase: 60,
        foreignSponsorVulnerability: 0,
      });
      const faultLines = makeFaultLines([line1, line2]);

      // line1: fundingTension = 10 * 0.15 * (100/100) = 1.5, hostile = 1*8 = 8 → delta = 9.5
      // line2: fundingTension = 10 * 0.15 * (0/100) = 0, hostile = 1*8 = 8 → delta = 8
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        10,
        1,
      );
      expect(result.faultLineUpdates).toHaveLength(2);
      expect(result.faultLineUpdates[0].groupName).toBe('Group A');
      expect(result.faultLineUpdates[0].tensionDelta).toBeCloseTo(9.5, 5);
      expect(result.faultLineUpdates[0].newTension).toBeCloseTo(29.5, 5);
      expect(result.faultLineUpdates[1].groupName).toBe('Group B');
      expect(result.faultLineUpdates[1].tensionDelta).toBe(8);
      expect(result.faultLineUpdates[1].newTension).toBe(68);
      expect(result.totalTensionIncrease).toBeCloseTo(17.5, 5);
    });

    it('treats negative foreignCovertFunding as 0', () => {
      const faultLines = makeFaultLines([makeFaultLine()]);
      const result: EthnicFundingResult = engine.computeEthnicFunding(
        faultLines,
        -5,
        0,
      );
      // max(-5, 0) = 0 → fundingTension = 0
      expect(result.faultLineUpdates[0].tensionDelta).toBe(0);
      expect(result.faultLineUpdates[0].newTension).toBe(30);
    });
  });

  // ─────────────────────────────────────────────────────
  // 6. evaluateMilitaryLoyaltySplit
  // ─────────────────────────────────────────────────────

  describe('evaluateMilitaryLoyaltySplit', () => {
    it('golden-value: military=60, split=3 → loyal=0.6, 2 rebels at 0.2 each', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(60, 3);
      expect(result.loyalFraction).toBe(0.6);
      expect(result.rebelFractions).toHaveLength(2);
      expect(result.rebelFractions[0].factionIndex).toBe(0);
      expect(result.rebelFractions[0].fraction).toBe(0.2);
      expect(result.rebelFractions[1].factionIndex).toBe(1);
      expect(result.rebelFractions[1].fraction).toBe(0.2);
    });

    it('golden-value: military=60, split=2 → loyal=0.6, 1 rebel at 0.4', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(60, 2);
      expect(result.loyalFraction).toBe(0.6);
      expect(result.rebelFractions).toHaveLength(1);
      expect(result.rebelFractions[0].fraction).toBe(0.4);
    });

    it('clamps loyalFraction to 0.9 when powerBaseMilitary is 100', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(100, 2);
      expect(result.loyalFraction).toBe(0.9);
      expect(result.rebelFractions).toHaveLength(1);
      expect(result.rebelFractions[0].fraction).toBe(0.1);
    });

    it('clamps loyalFraction to 0.1 when powerBaseMilitary is 0', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(0, 3);
      expect(result.loyalFraction).toBe(0.1);
      expect(result.rebelFractions).toHaveLength(2);
      // (1 - 0.1) / 2 = 0.45
      expect(result.rebelFractions[0].fraction).toBe(0.45);
      expect(result.rebelFractions[1].fraction).toBe(0.45);
    });

    it('clamps loyalFraction to 0.1 when powerBaseMilitary is negative', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(-20, 2);
      expect(result.loyalFraction).toBe(0.1);
      expect(result.rebelFractions).toHaveLength(1);
      // (1 - 0.1) / 1 = 0.9
      expect(result.rebelFractions[0].fraction).toBe(0.9);
    });

    it('clamps splitFactions below 2 up to minSplitFactions (2)', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(50, 1);
      // clamped to 2 → 1 rebel faction
      expect(result.loyalFraction).toBe(0.5);
      expect(result.rebelFractions).toHaveLength(1);
      expect(result.rebelFractions[0].fraction).toBe(0.5);
    });

    it('clamps splitFactions above 3 down to maxSplitFactions (3)', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(50, 10);
      // clamped to 3 → 2 rebel factions
      expect(result.loyalFraction).toBe(0.5);
      expect(result.rebelFractions).toHaveLength(2);
      expect(result.rebelFractions[0].fraction).toBe(0.25);
      expect(result.rebelFractions[1].fraction).toBe(0.25);
    });

    it('loyal + rebel fractions sum to 1.0', () => {
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(75, 3);
      const rebelSum = result.rebelFractions.reduce((s, r) => s + r.fraction, 0);
      expect(result.loyalFraction + rebelSum).toBeCloseTo(1.0, 2);
    });

    it('rounds fractions to 3 decimal places', () => {
      // powerBaseMilitary=33 → loyalFraction = clamp(0.33, 0.1, 0.9) = 0.33
      // rebelTotal = 0.67, rebelCount=2 → 0.335 → rounded to 0.335
      const result: MilitaryLoyaltySplitResult = engine.evaluateMilitaryLoyaltySplit(33, 3);
      expect(result.loyalFraction).toBe(0.33);
      expect(result.rebelFractions[0].fraction).toBe(0.335);
      expect(result.rebelFractions[1].fraction).toBe(0.335);
    });
  });
});
