import { describe, it, expect, beforeEach } from 'vitest';
import { RegimePowerBaseEngine } from '@/engine/regime-powerbase-engine';
import type {
  MartialLawResult,
  RegimeChangeTriggerResult,
  RegimeChangeResult,
  PowerBaseErosionResult,
  HostileFactionResult,
  CoupAttemptResult,
  PowerBaseSnapshotResult,
} from '@/engine/regime-powerbase-engine';
import { GAME_CONFIG } from '@/engine/config';
import { CoupOutcome, RegimeChangeType, PowerBaseCategory } from '@/data/types';
import type { LeaderPsychology, PowerBase } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('RegimePowerBaseEngine', () => {
  let engine: RegimePowerBaseEngine;

  beforeEach(() => {
    engine = new RegimePowerBaseEngine({
      stability: GAME_CONFIG.stability,
      powerBase: GAME_CONFIG.powerBase,
    });
  });

  // ─────────────────────────────────────────────────────
  // 1. evaluateMartialLaw
  // ─────────────────────────────────────────────────────

  describe('evaluateMartialLaw', () => {
    it('should return fixed unrestDelta of -30', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(60, 70);
      expect(result.unrestDelta).toBe(-30);
    });

    it('should return fixed popularityDelta of -20', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(40, 70);
      expect(result.popularityDelta).toBe(-20);
    });

    it('should return fixed economicGrowthMultiplier of -0.3', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(80, 70);
      expect(result.economicGrowthMultiplier).toBe(-0.3);
    });

    it('should return fixed tensionDelta of 10', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(20, 70);
      expect(result.tensionDelta).toBe(10);
    });

    it('should trigger coup risk when military power base is below 50', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(50, 49);
      expect(result.coupRiskTriggered).toBe(true);
    });

    it('should NOT trigger coup risk when military power base is exactly 50', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(50, 50);
      expect(result.coupRiskTriggered).toBe(false);
    });

    it('should NOT trigger coup risk when military power base is above 50', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(50, 80);
      expect(result.coupRiskTriggered).toBe(false);
    });

    it('should return all expected fields regardless of currentUnrest value', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(0, 50);
      expect(result).toEqual({
        unrestDelta: -30,
        popularityDelta: -20,
        economicGrowthMultiplier: -0.3,
        tensionDelta: 10,
        coupRiskTriggered: false,
      });
    });

    it('should trigger coup risk at military=0 (extreme low)', () => {
      const result: MartialLawResult = engine.evaluateMartialLaw(100, 0);
      expect(result.coupRiskTriggered).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. checkRegimeChangeTrigger
  // ─────────────────────────────────────────────────────

  describe('checkRegimeChangeTrigger', () => {
    it('should trigger StabilityCollapse when stability is 0', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(0, 50);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe(RegimeChangeType.StabilityCollapse);
    });

    it('should trigger StabilityCollapse when stability is negative', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(-10, 50);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe(RegimeChangeType.StabilityCollapse);
    });

    it('should trigger CivilUnrest when civilUnrest is 100', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(50, 100);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe(RegimeChangeType.CivilUnrest);
    });

    it('should prioritize StabilityCollapse when both conditions are met', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(0, 100);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe(RegimeChangeType.StabilityCollapse);
    });

    it('should NOT trigger when stability > 0 and civilUnrest < 100', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(1, 99);
      expect(result.triggered).toBe(false);
      expect(result.triggerType).toBeNull();
    });

    it('should preserve input values in the result', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(42, 73);
      expect(result.stability).toBe(42);
      expect(result.civilUnrest).toBe(73);
    });

    it('should NOT trigger at stability=1 (boundary above threshold)', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(1, 0);
      expect(result.triggered).toBe(false);
      expect(result.triggerType).toBeNull();
    });

    it('should NOT trigger at civilUnrest=99 (boundary below threshold)', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(50, 99);
      expect(result.triggered).toBe(false);
      expect(result.triggerType).toBeNull();
    });

    it('should trigger CivilUnrest when civilUnrest exceeds 100', () => {
      const result: RegimeChangeTriggerResult = engine.checkRegimeChangeTrigger(50, 120);
      expect(result.triggered).toBe(true);
      expect(result.triggerType).toBe(RegimeChangeType.CivilUnrest);
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. executeRegimeChange
  // ─────────────────────────────────────────────────────

  describe('executeRegimeChange', () => {
    it('should return playerGameOver=true for player with successionClarity below threshold', () => {
      const psych = makePsychology();
      const pb = makePowerBase();
      const result: RegimeChangeResult = engine.executeRegimeChange(psych, pb, true, 50);
      expect(result.playerGameOver).toBe(true);
      expect(result.successionAvailable).toBe(false);
      expect(result.newPsychology).toBeNull();
      expect(result.newPowerBase).toBeNull();
    });

    it('should return playerGameOver=true for player with successionClarity exactly at threshold (60)', () => {
      const psych = makePsychology();
      const pb = makePowerBase();
      const result: RegimeChangeResult = engine.executeRegimeChange(psych, pb, true, 60);
      expect(result.playerGameOver).toBe(true);
      expect(result.successionAvailable).toBe(false);
    });

    it('should allow succession for player with successionClarity above threshold (65)', () => {
      const psych = makePsychology();
      const pb = makePowerBase();
      const result: RegimeChangeResult = engine.executeRegimeChange(psych, pb, true, 65);
      expect(result.playerGameOver).toBe(false);
      expect(result.successionAvailable).toBe(true);
      expect(result.newPsychology).not.toBeNull();
      expect(result.newPowerBase).not.toBeNull();
    });

    it('should reduce all power base values by 20 for player succession', () => {
      const pb = makePowerBase({ military: 50, oligarchs: 60, party: 40, clergy: 30, public: 70, securityServices: 55 });
      const result: RegimeChangeResult = engine.executeRegimeChange(makePsychology(), pb, true, 65);
      expect(result.newPowerBase).toEqual({
        military: 30,
        oligarchs: 40,
        party: 20,
        clergy: 10,
        public: 50,
        securityServices: 35,
      });
    });

    it('should clamp power base values to 0 when reduction exceeds current value', () => {
      const pb = makePowerBase({ military: 10, oligarchs: 5, party: 0, clergy: 15, public: 20, securityServices: 100 });
      const result: RegimeChangeResult = engine.executeRegimeChange(makePsychology(), pb, true, 65);
      expect(result.newPowerBase!.military).toBe(0);
      expect(result.newPowerBase!.oligarchs).toBe(0);
      expect(result.newPowerBase!.party).toBe(0);
      expect(result.newPowerBase!.clergy).toBe(0);
      expect(result.newPowerBase!.public).toBe(0);
      expect(result.newPowerBase!.securityServices).toBe(80);
    });

    it('should produce shifted psychology for AI faction', () => {
      const psych = makePsychology();
      const pb = makePowerBase();
      const result: RegimeChangeResult = engine.executeRegimeChange(psych, pb, false, 0);

      expect(result.playerGameOver).toBe(false);
      expect(result.successionAvailable).toBe(false);
      expect(result.newPsychology).not.toBeNull();

      // Deterministic formula: delta = 20 * sign * ((i+1)/6)
      // i=0 riskTolerance: +20*(1)*(1/6) = +3.33 → 53.33
      // i=1 paranoia:      +20*(-1)*(2/6) = -6.67 → 43.33
      // i=2 narcissism:    +20*(1)*(3/6) = +10   → 60
      // i=3 pragmatism:    +20*(-1)*(4/6) = -13.33 → 36.67
      // i=4 patience:      +20*(1)*(5/6) = +16.67 → 66.67
      // i=5 vengefulIndex:  +20*(-1)*(6/6) = -20   → 30
      const np = result.newPsychology!;
      expect(np.riskTolerance).toBeCloseTo(50 + 20 * (1 / 6), 5);
      expect(np.paranoia).toBeCloseTo(50 - 20 * (2 / 6), 5);
      expect(np.narcissism).toBeCloseTo(50 + 20 * (3 / 6), 5);
      expect(np.pragmatism).toBeCloseTo(50 - 20 * (4 / 6), 5);
      expect(np.patience).toBeCloseTo(50 + 20 * (5 / 6), 5);
      expect(np.vengefulIndex).toBeCloseTo(50 - 20 * (6 / 6), 5);
    });

    it('should preserve decisionStyle and stressResponse for AI faction', () => {
      const psych = makePsychology({ decisionStyle: 'Analytical' as const, stressResponse: 'Consolidate' as const });
      const result: RegimeChangeResult = engine.executeRegimeChange(psych, makePowerBase(), false, 0);
      expect(result.newPsychology!.decisionStyle).toBe('Analytical');
      expect(result.newPsychology!.stressResponse).toBe('Consolidate');
    });

    it('should reduce AI power base by 20', () => {
      const pb = makePowerBase({ military: 80, oligarchs: 70, party: 60, clergy: 50, public: 40, securityServices: 30 });
      const result: RegimeChangeResult = engine.executeRegimeChange(makePsychology(), pb, false, 0);
      expect(result.newPowerBase).toEqual({
        military: 60,
        oligarchs: 50,
        party: 40,
        clergy: 30,
        public: 20,
        securityServices: 10,
      });
    });

    it('should always set regimeChanged=true and changeType=StabilityCollapse', () => {
      const result: RegimeChangeResult = engine.executeRegimeChange(makePsychology(), makePowerBase(), false, 0);
      expect(result.regimeChanged).toBe(true);
      expect(result.changeType).toBe(RegimeChangeType.StabilityCollapse);
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. applyPowerBaseErosion
  // ─────────────────────────────────────────────────────

  describe('applyPowerBaseErosion', () => {
    it('should apply unpopularWar deltas correctly', () => {
      const pb = makePowerBase();
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unpopularWar');
      expect(result.newPowerBase.military).toBe(55);    // +5
      expect(result.newPowerBase.oligarchs).toBe(47);   // -3
      expect(result.newPowerBase.party).toBe(48);       // -2
      expect(result.newPowerBase.clergy).toBe(50);      // +0
      expect(result.newPowerBase.public).toBe(40);      // -10
      expect(result.newPowerBase.securityServices).toBe(53); // +3
    });

    it('should record correct deltas for unpopularWar', () => {
      const pb = makePowerBase();
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unpopularWar');
      expect(result.deltas).toEqual({
        military: 5,
        oligarchs: -3,
        party: -2,
        clergy: 0,
        public: -10,
        securityServices: 3,
      });
    });

    it('should return zero deltas for unknown action category', () => {
      const pb = makePowerBase();
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unknownAction');
      expect(result.deltas).toEqual({
        military: 0,
        oligarchs: 0,
        party: 0,
        clergy: 0,
        public: 0,
        securityServices: 0,
      });
    });

    it('should leave power base unchanged for unknown action category', () => {
      const pb = makePowerBase({ military: 30, oligarchs: 40, party: 50, clergy: 60, public: 70, securityServices: 80 });
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unknownAction');
      expect(result.newPowerBase).toEqual(pb);
    });

    it('should clamp values to minimum of 0', () => {
      const pb = makePowerBase({ public: 5 }); // unpopularWar → -10 would go to -5
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unpopularWar');
      expect(result.newPowerBase.public).toBe(0);
    });

    it('should clamp values to maximum of 100', () => {
      const pb = makePowerBase({ military: 98 }); // unpopularWar → +5 would go to 103
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unpopularWar');
      expect(result.newPowerBase.military).toBe(100);
    });

    it('should preserve the previous power base in the result', () => {
      const pb = makePowerBase({ military: 70 });
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'unpopularWar');
      expect(result.previousPowerBase.military).toBe(70);
      expect(result.newPowerBase.military).toBe(75);
    });

    it('should record actionCategory in the result', () => {
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(makePowerBase(), 'economicSanctions');
      expect(result.actionCategory).toBe('economicSanctions');
    });

    it('should apply economicSanctions deltas correctly', () => {
      const pb = makePowerBase();
      const result: PowerBaseErosionResult = engine.applyPowerBaseErosion(pb, 'economicSanctions');
      expect(result.newPowerBase.military).toBe(50);     // 0
      expect(result.newPowerBase.oligarchs).toBe(42);    // -8
      expect(result.newPowerBase.party).toBe(47);        // -3
      expect(result.newPowerBase.clergy).toBe(50);       // 0
      expect(result.newPowerBase.public).toBe(45);       // -5
      expect(result.newPowerBase.securityServices).toBe(50); // 0
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. detectHostileFactions
  // ─────────────────────────────────────────────────────

  describe('detectHostileFactions', () => {
    it('should detect no hostiles when all values are above 15', () => {
      const pb = makePowerBase({ military: 20, oligarchs: 30, party: 40, clergy: 50, public: 60, securityServices: 70 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hasHostile).toBe(false);
      expect(result.hostileCount).toBe(0);
      expect(result.hostileFactions).toHaveLength(0);
    });

    it('should NOT flag a faction at exactly 15 (hostile is strictly < 15)', () => {
      const pb = makePowerBase({ military: 15, oligarchs: 15, party: 15, clergy: 15, public: 15, securityServices: 15 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hasHostile).toBe(false);
      expect(result.hostileCount).toBe(0);
    });

    it('should flag a single hostile faction below 15', () => {
      const pb = makePowerBase({ military: 10 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hasHostile).toBe(true);
      expect(result.hostileCount).toBe(1);
      expect(result.hostileFactions[0]!.category).toBe(PowerBaseCategory.Military);
      expect(result.hostileFactions[0]!.value).toBe(10);
    });

    it('should flag multiple hostile factions below 15', () => {
      const pb = makePowerBase({ military: 10, oligarchs: 5, public: 14 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hasHostile).toBe(true);
      expect(result.hostileCount).toBe(3);
      const categories = result.hostileFactions.map((f) => f.category);
      expect(categories).toContain(PowerBaseCategory.Military);
      expect(categories).toContain(PowerBaseCategory.Oligarchs);
      expect(categories).toContain(PowerBaseCategory.Public);
    });

    it('should detect hostiles at value 0', () => {
      const pb = makePowerBase({ clergy: 0 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hasHostile).toBe(true);
      const clergyFaction = result.hostileFactions.find(
        (f) => f.category === PowerBaseCategory.Clergy,
      );
      expect(clergyFaction).toBeDefined();
      expect(clergyFaction!.value).toBe(0);
    });

    it('should flag all six factions when all are below 15', () => {
      const pb = makePowerBase({ military: 1, oligarchs: 2, party: 3, clergy: 4, public: 5, securityServices: 6 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      expect(result.hostileCount).toBe(6);
      expect(result.hostileFactions).toHaveLength(6);
    });

    it('should return correct value for each hostile faction', () => {
      const pb = makePowerBase({ military: 14, securityServices: 7 });
      const result: HostileFactionResult = engine.detectHostileFactions(pb);
      const milFaction = result.hostileFactions.find(
        (f) => f.category === PowerBaseCategory.Military,
      );
      const secFaction = result.hostileFactions.find(
        (f) => f.category === PowerBaseCategory.SecurityServices,
      );
      expect(milFaction!.value).toBe(14);
      expect(secFaction!.value).toBe(7);
    });
  });

  // ─────────────────────────────────────────────────────
  // 6. evaluateCoupAttempt
  // ─────────────────────────────────────────────────────

  describe('evaluateCoupAttempt', () => {
    it('should be eligible when military < 30 AND securityServices < 30', () => {
      const pb = makePowerBase({ military: 20, securityServices: 20 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 50);
      expect(result.eligible).toBe(true);
      expect(result.militaryBelow).toBe(true);
      expect(result.securityBelow).toBe(true);
    });

    it('should NOT be eligible when military >= 30', () => {
      const pb = makePowerBase({ military: 30, securityServices: 20 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 50);
      expect(result.eligible).toBe(false);
      expect(result.coupChance).toBe(0);
      expect(result.outcome).toBe(CoupOutcome.Averted);
    });

    it('should NOT be eligible when securityServices >= 30', () => {
      const pb = makePowerBase({ military: 20, securityServices: 30 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 50);
      expect(result.eligible).toBe(false);
      expect(result.coupChance).toBe(0);
      expect(result.outcome).toBe(CoupOutcome.Averted);
    });

    it('should NOT be eligible when both military and securityServices >= 30', () => {
      const pb = makePowerBase({ military: 50, securityServices: 50 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 50);
      expect(result.eligible).toBe(false);
      expect(result.militaryBelow).toBe(false);
      expect(result.securityBelow).toBe(false);
    });

    it('should calculate correct coupChance with formula: (100-mil)*0.3 + (100-sec)*0.3 - pop*0.2', () => {
      // military=10, security=10, popularity=20
      // (90)*0.3 + (90)*0.3 - (20)*0.2 = 27 + 27 - 4 = 50
      const pb = makePowerBase({ military: 10, securityServices: 10 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 20);
      expect(result.coupChance).toBe(50);
      expect(result.outcome).toBe(CoupOutcome.Failed);
    });

    it('should return Success when coupChance >= 60', () => {
      // military=0, security=0, popularity=0
      // (100)*0.3 + (100)*0.3 - 0 = 60
      const pb = makePowerBase({ military: 0, securityServices: 0 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 0);
      expect(result.coupChance).toBe(60);
      expect(result.outcome).toBe(CoupOutcome.Success);
    });

    it('should return Failed when coupChance >= 30 and < 60', () => {
      // military=10, security=10, popularity=30
      // (90)*0.3 + (90)*0.3 - (30)*0.2 = 27 + 27 - 6 = 48
      const pb = makePowerBase({ military: 10, securityServices: 10 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 30);
      expect(result.coupChance).toBe(48);
      expect(result.outcome).toBe(CoupOutcome.Failed);
    });

    it('should return Averted when coupChance < 30', () => {
      // military=29, security=29, popularity=100
      // (71)*0.3 + (71)*0.3 - (100)*0.2 = 21.3 + 21.3 - 20 = 22.6
      const pb = makePowerBase({ military: 29, securityServices: 29 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 100);
      expect(result.coupChance).toBeCloseTo(22.6, 5);
      expect(result.outcome).toBe(CoupOutcome.Averted);
    });

    it('should clamp coupChance to minimum of 0', () => {
      // military=29, security=29, popularity=100 (high popularity can drive chance low)
      // But let's use extreme: military=29, security=29, popularity=500 (hypothetical)
      // (71)*0.3 + (71)*0.3 - (500)*0.2 = 21.3 + 21.3 - 100 = -57.4 → clamped to 0
      const pb = makePowerBase({ military: 29, securityServices: 29 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 500);
      expect(result.coupChance).toBe(0);
      expect(result.outcome).toBe(CoupOutcome.Averted);
    });

    it('should report militaryBelow and securityBelow flags correctly when ineligible', () => {
      const pb = makePowerBase({ military: 10, securityServices: 50 });
      const result: CoupAttemptResult = engine.evaluateCoupAttempt(pb, 50);
      expect(result.militaryBelow).toBe(true);
      expect(result.securityBelow).toBe(false);
      expect(result.eligible).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────
  // 7. computePowerBaseSnapshot
  // ─────────────────────────────────────────────────────

  describe('computePowerBaseSnapshot', () => {
    it('should return unchanged power base when no actions are provided', () => {
      const pb = makePowerBase();
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, []);
      expect(result.finalPowerBase).toEqual(pb);
      expect(result.actionsApplied).toBe(0);
    });

    it('should apply a single recognized action', () => {
      const pb = makePowerBase();
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, ['unpopularWar']);
      expect(result.finalPowerBase.military).toBe(55);
      expect(result.finalPowerBase.public).toBe(40);
      expect(result.actionsApplied).toBe(1);
    });

    it('should apply multiple actions sequentially', () => {
      const pb = makePowerBase();
      // unpopularWar: military+5=55, oligarchs-3=47, party-2=48, clergy=50, public-10=40, security+3=53
      // then militarySpending: military+6=61, oligarchs-2=45, party=48, clergy=50, public-3=37, security+2=55
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, [
        'unpopularWar',
        'militarySpending',
      ]);
      expect(result.finalPowerBase.military).toBe(61);
      expect(result.finalPowerBase.oligarchs).toBe(45);
      expect(result.finalPowerBase.party).toBe(48);
      expect(result.finalPowerBase.clergy).toBe(50);
      expect(result.finalPowerBase.public).toBe(37);
      expect(result.finalPowerBase.securityServices).toBe(55);
      expect(result.actionsApplied).toBe(2);
    });

    it('should skip unrecognized actions and not count them', () => {
      const pb = makePowerBase();
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, [
        'unpopularWar',
        'bogusAction',
        'militarySpending',
      ]);
      expect(result.actionsApplied).toBe(2);
      // Same result as two recognized actions
      expect(result.finalPowerBase.military).toBe(61);
    });

    it('should detect hostile factions in the final state', () => {
      // Start with low public; unpopularWar will push it to 0
      const pb = makePowerBase({ public: 5 });
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, ['unpopularWar']);
      // public: 5-10 = clamped 0 → hostile (< 15)
      expect(result.hostileFactions.length).toBeGreaterThanOrEqual(1);
      const publicHostile = result.hostileFactions.find(
        (f) => f.category === PowerBaseCategory.Public,
      );
      expect(publicHostile).toBeDefined();
      expect(publicHostile!.value).toBe(0);
    });

    it('should evaluate coup eligibility after all erosions', () => {
      // Start with low military and security, erosion pushes further down
      const pb = makePowerBase({ military: 20, securityServices: 20, public: 50 });
      // unpopularWar: military+5=25, security+3=23, public-10=40
      // intelligenceExpansion: military+0=25, security+8=31, public-4=36
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, [
        'unpopularWar',
        'intelligenceExpansion',
      ]);
      // After actions: military=25 (<30), security=31 (>=30) → NOT eligible
      expect(result.coupEligible).toBe(false);
      expect(result.coupChance).toBe(0);
    });

    it('should detect coup eligibility when both military and security end below 30', () => {
      // socialReform: military-2, security+0
      // Need final military < 30 AND securityServices < 30
      const pb = makePowerBase({ military: 25, securityServices: 25, public: 50 });
      // socialReform: military-2=23, oligarchs-3=47, party=50, clergy=50, public+8=58, security=25
      const result: PowerBaseSnapshotResult = engine.computePowerBaseSnapshot(pb, ['socialReform']);
      // military=23 (<30), security=25 (<30) → eligible
      // coupChance = (100-23)*0.3 + (100-25)*0.3 - 58*0.2
      //            = 77*0.3 + 75*0.3 - 58*0.2
      //            = 23.1 + 22.5 - 11.6 = 34.0
      expect(result.coupEligible).toBe(true);
      expect(result.coupChance).toBeCloseTo(34.0, 5);
    });
  });
});
