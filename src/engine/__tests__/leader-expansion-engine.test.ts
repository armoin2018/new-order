import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderExpansionEngine } from '@/engine/leader-expansion-engine';
import type {
  SliderMetadataCollection,
  SliderPreviewResult,
  VulnerabilityTriggerResult,
  VulnerabilityEffectResult,
  OngoingVulnerabilityResult,
  LeaderBalanceAssessment,
  ArchetypeDeviationResult,
} from '@/engine/leader-expansion-engine';
import { GAME_CONFIG } from '@/engine/config';
import type { LeaderPsychology, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeaderExpansionEngine', () => {
  let engine: LeaderExpansionEngine;

  beforeEach(() => {
    engine = new LeaderExpansionEngine(GAME_CONFIG.leaderCreation);
  });

  // =========================================================================
  // 1. generateSliderMetadata
  // =========================================================================

  describe('generateSliderMetadata', () => {
    let result: SliderMetadataCollection;

    beforeEach(() => {
      result = engine.generateSliderMetadata();
    });

    it('returns exactly 8 sliders', () => {
      expect(result.sliders).toHaveLength(8);
    });

    it('contains exactly 2 enum sliders and 6 numeric sliders', () => {
      const enums = result.sliders.filter((s) => s.type === 'enum');
      const numerics = result.sliders.filter((s) => s.type === 'numeric');
      expect(enums).toHaveLength(2);
      expect(numerics).toHaveLength(6);
    });

    it('decisionStyle enum has the correct allowedValues', () => {
      const ds = result.sliders.find((s) => s.key === 'decisionStyle');
      expect(ds).toBeDefined();
      expect(ds!.type).toBe('enum');
      expect(ds!.allowedValues).toEqual([
        'Transactional',
        'Analytical',
        'Intuitive',
        'Ideological',
      ]);
    });

    it('stressResponse enum has the correct allowedValues', () => {
      const sr = result.sliders.find((s) => s.key === 'stressResponse');
      expect(sr).toBeDefined();
      expect(sr!.type).toBe('enum');
      expect(sr!.allowedValues).toEqual([
        'Escalate',
        'Consolidate',
        'Deflect',
        'Retreat',
      ]);
    });

    it('numeric sliders have min=0, max=100, step=1, defaultValue=50', () => {
      const numerics = result.sliders.filter((s) => s.type === 'numeric');
      for (const slider of numerics) {
        expect(slider.min).toBe(0);
        expect(slider.max).toBe(100);
        expect(slider.step).toBe(1);
        expect(slider.defaultValue).toBe(50);
      }
    });

    it('all sliders have non-empty label and description', () => {
      for (const slider of result.sliders) {
        expect(slider.label.length).toBeGreaterThan(0);
        expect(slider.description.length).toBeGreaterThan(0);
      }
    });

    it('numeric sliders include the expected dimension keys', () => {
      const numericKeys = result.sliders
        .filter((s) => s.type === 'numeric')
        .map((s) => s.key);
      expect(numericKeys).toEqual([
        'riskTolerance',
        'paranoia',
        'narcissism',
        'pragmatism',
        'patience',
        'vengefulIndex',
      ]);
    });

    it('enum sliders do not have numeric properties', () => {
      const enums = result.sliders.filter((s) => s.type === 'enum');
      for (const slider of enums) {
        expect(slider.min).toBeUndefined();
        expect(slider.max).toBeUndefined();
        expect(slider.step).toBeUndefined();
        expect(slider.defaultValue).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 2. computeSliderPreview
  // =========================================================================

  describe('computeSliderPreview', () => {
    it('null archetype returns neutral defaults with source=neutral', () => {
      const result: SliderPreviewResult = engine.computeSliderPreview(null, {});
      expect(result.source).toBe('neutral');
      expect(result.psychology.riskTolerance).toBe(50);
      expect(result.psychology.paranoia).toBe(50);
      expect(result.psychology.narcissism).toBe(50);
      expect(result.psychology.pragmatism).toBe(50);
      expect(result.psychology.patience).toBe(50);
      expect(result.psychology.vengefulIndex).toBe(50);
      expect(result.psychology.decisionStyle).toBe('Analytical');
      expect(result.psychology.stressResponse).toBe('Consolidate');
    });

    it('Hawk archetype returns correct preset values with source=archetype', () => {
      const result: SliderPreviewResult = engine.computeSliderPreview('Hawk', {});
      expect(result.source).toBe('archetype');
      expect(result.psychology.riskTolerance).toBe(80);
      expect(result.psychology.paranoia).toBe(60);
      expect(result.psychology.narcissism).toBe(55);
      expect(result.psychology.pragmatism).toBe(40);
      expect(result.psychology.patience).toBe(25);
      expect(result.psychology.vengefulIndex).toBe(75);
      expect(result.psychology.decisionStyle).toBe('Intuitive');
      expect(result.psychology.stressResponse).toBe('Escalate');
    });

    it('overrides are applied on top of an archetype', () => {
      const result = engine.computeSliderPreview('Hawk', {
        riskTolerance: 30,
        patience: 90,
      });
      expect(result.source).toBe('archetype');
      expect(result.psychology.riskTolerance).toBe(30);
      expect(result.psychology.patience).toBe(90);
      // Non-overridden dimensions keep archetype values
      expect(result.psychology.paranoia).toBe(60);
      expect(result.overridesApplied).toBe(2);
    });

    it('invalid archetype falls back to neutral', () => {
      const result = engine.computeSliderPreview('Unknown', {});
      expect(result.source).toBe('neutral');
      expect(result.psychology.riskTolerance).toBe(50);
      expect(result.psychology.paranoia).toBe(50);
    });

    it('overridesApplied counts actual override keys', () => {
      const result = engine.computeSliderPreview(null, {
        riskTolerance: 70,
        paranoia: 20,
        patience: 80,
      });
      expect(result.overridesApplied).toBe(3);
    });

    it('numeric values are clamped to [0, 100]', () => {
      const result = engine.computeSliderPreview(null, {
        riskTolerance: 150,
        paranoia: -20,
      });
      expect(result.psychology.riskTolerance).toBe(100);
      expect(result.psychology.paranoia).toBe(0);
    });

    it('Dove archetype returns correct preset values', () => {
      const result = engine.computeSliderPreview('Dove', {});
      expect(result.source).toBe('archetype');
      expect(result.psychology.riskTolerance).toBe(25);
      expect(result.psychology.paranoia).toBe(30);
      expect(result.psychology.narcissism).toBe(20);
      expect(result.psychology.pragmatism).toBe(75);
      expect(result.psychology.patience).toBe(85);
      expect(result.psychology.vengefulIndex).toBe(15);
    });

    it('overrides on null archetype are applied correctly', () => {
      const result = engine.computeSliderPreview(null, {
        decisionStyle: 'Ideological' as const,
        stressResponse: 'Retreat' as const,
      });
      expect(result.psychology.decisionStyle).toBe('Ideological');
      expect(result.psychology.stressResponse).toBe('Retreat');
      expect(result.overridesApplied).toBe(2);
    });
  });

  // =========================================================================
  // 3. checkVulnerabilityTrigger
  // =========================================================================

  describe('checkVulnerabilityTrigger', () => {
    it('IdeologicalRigidity is always triggered=false (action-based)', () => {
      const result: VulnerabilityTriggerResult = engine.checkVulnerabilityTrigger(
        'IdeologicalRigidity',
        10 as TurnNumber,
        0,
        0.0,
      );
      expect(result.triggered).toBe(false);
      expect(result.vulnerabilityType).toBe('IdeologicalRigidity');
    });

    it('unknown vulnerability type returns triggered=false', () => {
      const result = engine.checkVulnerabilityTrigger(
        'MadeUpVulnerability',
        10 as TurnNumber,
        0,
        0.0,
      );
      expect(result.triggered).toBe(false);
      expect(result.vulnerabilityType).toBe('MadeUpVulnerability');
    });

    it('turn < earliestTriggerTurn (5) is not triggered', () => {
      const result = engine.checkVulnerabilityTrigger(
        'HealthRisk',
        4 as TurnNumber,
        0,
        0.0,
      );
      expect(result.triggered).toBe(false);
    });

    it('triggersFired >= maxTriggersPerGame (1) is not triggered', () => {
      const result = engine.checkVulnerabilityTrigger(
        'HealthRisk',
        10 as TurnNumber,
        1,
        0.0,
      );
      expect(result.triggered).toBe(false);
    });

    it('HealthRisk with roll < 0.03 is triggered', () => {
      const result = engine.checkVulnerabilityTrigger(
        'HealthRisk',
        10 as TurnNumber,
        0,
        0.02,
      );
      expect(result.triggered).toBe(true);
    });

    it('HealthRisk with roll >= 0.03 is not triggered', () => {
      const result = engine.checkVulnerabilityTrigger(
        'HealthRisk',
        10 as TurnNumber,
        0,
        0.03,
      );
      expect(result.triggered).toBe(false);
    });

    it('ScandalExposure with roll < 0.04 is triggered', () => {
      const result = engine.checkVulnerabilityTrigger(
        'ScandalExposure',
        10 as TurnNumber,
        0,
        0.039,
      );
      expect(result.triggered).toBe(true);
    });

    it('turn=5 (exactly earliest) is eligible for triggering', () => {
      const result = engine.checkVulnerabilityTrigger(
        'HealthRisk',
        5 as TurnNumber,
        0,
        0.01,
      );
      expect(result.triggered).toBe(true);
    });
  });

  // =========================================================================
  // 4. resolveVulnerabilityEffect
  // =========================================================================

  describe('resolveVulnerabilityEffect', () => {
    it('HealthRisk: incapacitated=true, durationTurns=2, popularityDelta=0', () => {
      const result: VulnerabilityEffectResult = engine.resolveVulnerabilityEffect(
        'HealthRisk',
        10 as TurnNumber,
      );
      expect(result.incapacitated).toBe(true);
      expect(result.durationTurns).toBe(2);
      expect(result.popularityDelta).toBe(0);
      expect(result.effectType).toBe('incapacitation');
      expect(result.stabilityPenaltyPerTurn).toBe(0);
      expect(result.loyaltyPenalty).toBe(0);
    });

    it('ScandalExposure: popularityDelta=-20, incapacitated=false, durationTurns=0', () => {
      const result = engine.resolveVulnerabilityEffect(
        'ScandalExposure',
        10 as TurnNumber,
      );
      expect(result.popularityDelta).toBe(-20);
      expect(result.incapacitated).toBe(false);
      expect(result.durationTurns).toBe(0);
      expect(result.effectType).toBe('popularityDrop');
      expect(result.loyaltyPenalty).toBe(0);
    });

    it('SuccessionGap: stabilityPenaltyPerTurn=-5, durationTurns=5', () => {
      const result = engine.resolveVulnerabilityEffect(
        'SuccessionGap',
        10 as TurnNumber,
      );
      expect(result.stabilityPenaltyPerTurn).toBe(-5);
      expect(result.durationTurns).toBe(5);
      expect(result.effectType).toBe('instability');
      expect(result.incapacitated).toBe(false);
      expect(result.popularityDelta).toBe(0);
    });

    it('IdeologicalRigidity: popularityDelta=-8, loyaltyPenalty=-5', () => {
      const result = engine.resolveVulnerabilityEffect(
        'IdeologicalRigidity',
        10 as TurnNumber,
      );
      expect(result.popularityDelta).toBe(-8);
      expect(result.loyaltyPenalty).toBe(-5);
      expect(result.effectType).toBe('backlash');
      expect(result.incapacitated).toBe(false);
      expect(result.durationTurns).toBe(0);
    });

    it('unknown type returns effectType=none with all zeros', () => {
      const result = engine.resolveVulnerabilityEffect(
        'FakeVulnerability',
        10 as TurnNumber,
      );
      expect(result.effectType).toBe('none');
      expect(result.popularityDelta).toBe(0);
      expect(result.stabilityPenaltyPerTurn).toBe(0);
      expect(result.incapacitated).toBe(false);
      expect(result.durationTurns).toBe(0);
      expect(result.loyaltyPenalty).toBe(0);
    });

    it('turnTriggered is set to the supplied current turn', () => {
      const result = engine.resolveVulnerabilityEffect(
        'HealthRisk',
        7 as TurnNumber,
      );
      expect(result.turnTriggered).toBe(7);
    });

    it('HealthRisk stabilityPenaltyPerTurn and loyaltyPenalty are both 0', () => {
      const result = engine.resolveVulnerabilityEffect(
        'HealthRisk',
        5 as TurnNumber,
      );
      expect(result.stabilityPenaltyPerTurn).toBe(0);
      expect(result.loyaltyPenalty).toBe(0);
    });

    it('SuccessionGap loyaltyPenalty and popularityDelta are both 0', () => {
      const result = engine.resolveVulnerabilityEffect(
        'SuccessionGap',
        5 as TurnNumber,
      );
      expect(result.loyaltyPenalty).toBe(0);
      expect(result.popularityDelta).toBe(0);
    });
  });

  // =========================================================================
  // 5. computeOngoingVulnerabilityEffect
  // =========================================================================

  describe('computeOngoingVulnerabilityEffect', () => {
    it('HealthRisk at turnsSinceTriggered=0 → active, remainingTurns=2, incapacitated', () => {
      const result: OngoingVulnerabilityResult =
        engine.computeOngoingVulnerabilityEffect('HealthRisk', 0);
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(2);
      expect(result.incapacitated).toBe(true);
      expect(result.stabilityPenaltyPerTurn).toBe(0);
    });

    it('HealthRisk at turnsSinceTriggered=1 → active, remainingTurns=1', () => {
      const result = engine.computeOngoingVulnerabilityEffect('HealthRisk', 1);
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(1);
      expect(result.incapacitated).toBe(true);
    });

    it('HealthRisk at turnsSinceTriggered=2 → inactive, remainingTurns=0', () => {
      const result = engine.computeOngoingVulnerabilityEffect('HealthRisk', 2);
      expect(result.active).toBe(false);
      expect(result.remainingTurns).toBe(0);
      expect(result.incapacitated).toBe(false);
    });

    it('SuccessionGap at turnsSinceTriggered=3 → active, remainingTurns=2, stabilityPenalty=-5', () => {
      const result = engine.computeOngoingVulnerabilityEffect('SuccessionGap', 3);
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(2);
      expect(result.stabilityPenaltyPerTurn).toBe(-5);
      expect(result.incapacitated).toBe(false);
    });

    it('SuccessionGap at turnsSinceTriggered=5 → inactive', () => {
      const result = engine.computeOngoingVulnerabilityEffect('SuccessionGap', 5);
      expect(result.active).toBe(false);
      expect(result.remainingTurns).toBe(0);
      expect(result.stabilityPenaltyPerTurn).toBe(0);
    });

    it('ScandalExposure is always inactive (no ongoing duration)', () => {
      const result = engine.computeOngoingVulnerabilityEffect('ScandalExposure', 0);
      expect(result.active).toBe(false);
      expect(result.remainingTurns).toBe(0);
      expect(result.incapacitated).toBe(false);
    });

    it('IdeologicalRigidity is always inactive (no ongoing duration)', () => {
      const result = engine.computeOngoingVulnerabilityEffect('IdeologicalRigidity', 0);
      expect(result.active).toBe(false);
      expect(result.remainingTurns).toBe(0);
    });

    it('SuccessionGap at turnsSinceTriggered=0 → active, remainingTurns=5', () => {
      const result = engine.computeOngoingVulnerabilityEffect('SuccessionGap', 0);
      expect(result.active).toBe(true);
      expect(result.remainingTurns).toBe(5);
      expect(result.stabilityPenaltyPerTurn).toBe(-5);
    });
  });

  // =========================================================================
  // 6. evaluateLeaderBalance
  // =========================================================================

  describe('evaluateLeaderBalance', () => {
    it('all values=50 → Balanced, extremeCount=0', () => {
      const psych = makePsychology();
      const result: LeaderBalanceAssessment = engine.evaluateLeaderBalance(psych);
      expect(result.rating).toBe('Balanced');
      expect(result.extremeCount).toBe(0);
    });

    it('one value at 10 → Moderate, extremeCount=1', () => {
      const psych = makePsychology({ riskTolerance: 10 });
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.rating).toBe('Moderate');
      expect(result.extremeCount).toBe(1);
    });

    it('three extreme values → Extreme, extremeCount=3', () => {
      const psych = makePsychology({
        riskTolerance: 5,
        paranoia: 95,
        narcissism: 90,
      });
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.rating).toBe('Extreme');
      expect(result.extremeCount).toBe(3);
    });

    it('all six values extreme → Radical, extremeCount=6', () => {
      const psych = makePsychology({
        riskTolerance: 0,
        paranoia: 100,
        narcissism: 5,
        pragmatism: 95,
        patience: 10,
        vengefulIndex: 90,
      });
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.rating).toBe('Radical');
      expect(result.extremeCount).toBe(6);
    });

    it('averageValue is correctly computed for all-50 profile', () => {
      const psych = makePsychology();
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.averageValue).toBe(50);
    });

    it('standardDeviation is 0 when all values are identical', () => {
      const psych = makePsychology();
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.standardDeviation).toBe(0);
    });

    it('averageValue and standardDeviation are correct for mixed values', () => {
      const psych = makePsychology({
        riskTolerance: 80,
        paranoia: 60,
        narcissism: 55,
        pragmatism: 40,
        patience: 25,
        vengefulIndex: 75,
      });
      const result = engine.evaluateLeaderBalance(psych);

      // average = (80+60+55+40+25+75)/6 = 335/6 ≈ 55.833...
      const expectedAvg = Math.round((335 / 6) * 100) / 100;
      expect(result.averageValue).toBeCloseTo(expectedAvg, 2);

      // population stdev
      const mean = 335 / 6;
      const variance =
        ((80 - mean) ** 2 +
          (60 - mean) ** 2 +
          (55 - mean) ** 2 +
          (40 - mean) ** 2 +
          (25 - mean) ** 2 +
          (75 - mean) ** 2) /
        6;
      const expectedStd = Math.round(Math.sqrt(variance) * 100) / 100;
      expect(result.standardDeviation).toBeCloseTo(expectedStd, 2);
    });

    it('two extreme values → Moderate, extremeCount=2', () => {
      const psych = makePsychology({
        riskTolerance: 5,
        paranoia: 95,
      });
      const result = engine.evaluateLeaderBalance(psych);
      expect(result.rating).toBe('Moderate');
      expect(result.extremeCount).toBe(2);
    });
  });

  // =========================================================================
  // 7. computeArchetypeDeviation
  // =========================================================================

  describe('computeArchetypeDeviation', () => {
    it('psychology matching Hawk archetype → totalDeviation=0, all deltas=0', () => {
      const hawkPsych = makePsychology({
        riskTolerance: 80,
        paranoia: 60,
        narcissism: 55,
        pragmatism: 40,
        patience: 25,
        vengefulIndex: 75,
      });
      const result: ArchetypeDeviationResult = engine.computeArchetypeDeviation(
        hawkPsych,
        'Hawk',
      );
      expect(result.totalDeviation).toBe(0);
      expect(result.archetype).toBe('Hawk');
      for (const entry of result.perDimensionDeltas) {
        expect(entry.delta).toBe(0);
      }
    });

    it('different values produce correct signed deltas per dimension', () => {
      const psych = makePsychology({
        riskTolerance: 90,  // hawk=80 → delta=+10
        paranoia: 50,       // hawk=60 → delta=-10
        narcissism: 55,     // hawk=55 → delta=0
        pragmatism: 40,     // hawk=40 → delta=0
        patience: 25,       // hawk=25 → delta=0
        vengefulIndex: 75,  // hawk=75 → delta=0
      });
      const result = engine.computeArchetypeDeviation(psych, 'Hawk');
      expect(result.totalDeviation).toBe(20); // |10| + |-10| + 0+0+0+0

      const rtDelta = result.perDimensionDeltas.find(
        (d) => d.dimension === 'riskTolerance',
      );
      expect(rtDelta!.delta).toBe(10);

      const parDelta = result.perDimensionDeltas.find(
        (d) => d.dimension === 'paranoia',
      );
      expect(parDelta!.delta).toBe(-10);
    });

    it('invalid archetype returns totalDeviation=0 with all deltas=0', () => {
      const psych = makePsychology({ riskTolerance: 90 });
      const result = engine.computeArchetypeDeviation(psych, 'InvalidArchetype');
      expect(result.totalDeviation).toBe(0);
      expect(result.archetype).toBe('InvalidArchetype');
      for (const entry of result.perDimensionDeltas) {
        expect(entry.delta).toBe(0);
      }
    });

    it('perDimensionDeltas contains all 6 numeric dimensions', () => {
      const psych = makePsychology();
      const result = engine.computeArchetypeDeviation(psych, 'Hawk');
      expect(result.perDimensionDeltas).toHaveLength(6);
      const dimensions = result.perDimensionDeltas.map((d) => d.dimension);
      expect(dimensions).toEqual([
        'riskTolerance',
        'paranoia',
        'narcissism',
        'pragmatism',
        'patience',
        'vengefulIndex',
      ]);
    });

    it('Dove archetype deviation is computed correctly', () => {
      // Dove: riskTolerance=25, paranoia=30, narcissism=20, pragmatism=75, patience=85, vengefulIndex=15
      const psych = makePsychology(); // all 50s
      const result = engine.computeArchetypeDeviation(psych, 'Dove');

      // Deltas: 50-25=25, 50-30=20, 50-20=30, 50-75=-25, 50-85=-35, 50-15=35
      // totalDeviation = 25+20+30+25+35+35 = 170
      expect(result.totalDeviation).toBe(170);
    });

    it('all-neutral vs Technocrat yields correct total deviation', () => {
      // Technocrat: riskTolerance=35, paranoia=25, narcissism=15, pragmatism=85, patience=80, vengefulIndex=20
      const psych = makePsychology(); // all 50s
      const result = engine.computeArchetypeDeviation(psych, 'Technocrat');

      // Deltas: 50-35=15, 50-25=25, 50-15=35, 50-85=-35, 50-80=-30, 50-20=30
      // totalDeviation = 15+25+35+35+30+30 = 170
      expect(result.totalDeviation).toBe(170);
    });

    it('archetype property is preserved in the result', () => {
      const psych = makePsychology();
      const result = engine.computeArchetypeDeviation(psych, 'Populist');
      expect(result.archetype).toBe('Populist');
    });

    it('negative deltas are correctly signed (current < archetype)', () => {
      const psych = makePsychology({
        riskTolerance: 20,  // hawk=80 → delta=-60
        paranoia: 10,       // hawk=60 → delta=-50
        narcissism: 5,      // hawk=55 → delta=-50
        pragmatism: 10,     // hawk=40 → delta=-30
        patience: 5,        // hawk=25 → delta=-20
        vengefulIndex: 10,  // hawk=75 → delta=-65
      });
      const result = engine.computeArchetypeDeviation(psych, 'Hawk');

      for (const entry of result.perDimensionDeltas) {
        expect(entry.delta).toBeLessThanOrEqual(0);
      }
      // totalDeviation = sum of absolutes = 60+50+50+30+20+65 = 275
      expect(result.totalDeviation).toBe(275);
    });
  });
});
