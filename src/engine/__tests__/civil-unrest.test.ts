import { describe, it, expect, beforeEach } from 'vitest';
import { CivilUnrestEngine } from '@/engine/civil-unrest';
import type {
  UnrestComputationInput,
  StageEffects,
  EscalationResult,
  EthnicTensionResult,
} from '@/engine/civil-unrest';
import { GAME_CONFIG } from '@/engine/config';
import type {
  FactionId,
  TurnNumber,
  NationFaultLines,
  EthnicFaultLine,
  CivilUnrestComponents,
} from '@/data/types';
import { EscalationStage } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function makeInput(
  overrides?: Partial<UnrestComputationInput>,
): UnrestComputationInput {
  return {
    inflation: 0,
    inequality: 0,
    repressionBacklash: 0,
    ethnicTension: 0,
    foreignPropaganda: 0,
    ...overrides,
  };
}

function makeFaultLine(
  overrides?: Partial<EthnicFaultLine>,
): EthnicFaultLine {
  return {
    groupName: 'Test Group',
    tensionBase: 50,
    triggers: [],
    foreignSponsorVulnerability: 0,
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

describe('CivilUnrestEngine', () => {
  let engine: CivilUnrestEngine;
  const cfg = GAME_CONFIG.stability;

  beforeEach(() => {
    engine = new CivilUnrestEngine(cfg);
  });

  // ─────────────────────────────────────────────────────
  // 1. computeCivilUnrest
  // ─────────────────────────────────────────────────────

  describe('computeCivilUnrest', () => {
    it('returns 0 when all inputs are zero', () => {
      expect(engine.computeCivilUnrest(makeInput())).toBe(0);
    });

    it('returns 100 when all inputs are 100', () => {
      const input = makeInput({
        inflation: 100,
        inequality: 100,
        repressionBacklash: 100,
        ethnicTension: 100,
        foreignPropaganda: 100,
      });
      expect(engine.computeCivilUnrest(input)).toBe(100);
    });

    it('returns 30 when only inflation is 100', () => {
      expect(engine.computeCivilUnrest(makeInput({ inflation: 100 }))).toBe(30);
    });

    it('returns 20 when only inequality is 100', () => {
      expect(engine.computeCivilUnrest(makeInput({ inequality: 100 }))).toBe(20);
    });

    it('returns 20 when only repressionBacklash is 100', () => {
      expect(
        engine.computeCivilUnrest(makeInput({ repressionBacklash: 100 })),
      ).toBe(20);
    });

    it('returns 15 when only ethnicTension is 100', () => {
      expect(
        engine.computeCivilUnrest(makeInput({ ethnicTension: 100 })),
      ).toBe(15);
    });

    it('returns 15 when only foreignPropaganda is 100', () => {
      expect(
        engine.computeCivilUnrest(makeInput({ foreignPropaganda: 100 })),
      ).toBe(15);
    });

    it('clamps negative inputs to produce 0', () => {
      const input = makeInput({
        inflation: -50,
        inequality: -50,
        repressionBacklash: -50,
        ethnicTension: -50,
        foreignPropaganda: -50,
      });
      expect(engine.computeCivilUnrest(input)).toBe(0);
    });

    it('clamps results above 100 when inputs exceed 100', () => {
      const input = makeInput({
        inflation: 200,
        inequality: 200,
        repressionBacklash: 200,
        ethnicTension: 200,
        foreignPropaganda: 200,
      });
      expect(engine.computeCivilUnrest(input)).toBe(100);
    });

    it('computes correct weighted sum for mixed realistic values', () => {
      const input = makeInput({
        inflation: 50,
        inequality: 40,
        repressionBacklash: 30,
        ethnicTension: 20,
        foreignPropaganda: 10,
      });
      // 50*0.3 + 40*0.2 + 30*0.2 + 20*0.15 + 10*0.15 = 15+8+6+3+1.5 = 33.5
      expect(engine.computeCivilUnrest(input)).toBeCloseTo(33.5);
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. determineEscalationStage
  // ─────────────────────────────────────────────────────

  describe('determineEscalationStage', () => {
    it('returns Grumbling for 0', () => {
      expect(engine.determineEscalationStage(0)).toBe(
        EscalationStage.Grumbling,
      );
    });

    it('returns Grumbling at upper boundary (20)', () => {
      expect(engine.determineEscalationStage(20)).toBe(
        EscalationStage.Grumbling,
      );
    });

    it('returns Grumbling for mid-range value (10)', () => {
      expect(engine.determineEscalationStage(10)).toBe(
        EscalationStage.Grumbling,
      );
    });

    it('returns Protests at lower boundary (21)', () => {
      expect(engine.determineEscalationStage(21)).toBe(
        EscalationStage.Protests,
      );
    });

    it('returns Protests for mid-range value (30)', () => {
      expect(engine.determineEscalationStage(30)).toBe(
        EscalationStage.Protests,
      );
    });

    it('returns Protests at upper boundary (40)', () => {
      expect(engine.determineEscalationStage(40)).toBe(
        EscalationStage.Protests,
      );
    });

    it('returns Riots at lower boundary (41)', () => {
      expect(engine.determineEscalationStage(41)).toBe(EscalationStage.Riots);
    });

    it('returns Riots for mid-range value (50)', () => {
      expect(engine.determineEscalationStage(50)).toBe(EscalationStage.Riots);
    });

    it('returns Riots at upper boundary (60)', () => {
      expect(engine.determineEscalationStage(60)).toBe(EscalationStage.Riots);
    });

    it('returns Insurrection at lower boundary (61)', () => {
      expect(engine.determineEscalationStage(61)).toBe(
        EscalationStage.Insurrection,
      );
    });

    it('returns Insurrection for mid-range value (70)', () => {
      expect(engine.determineEscalationStage(70)).toBe(
        EscalationStage.Insurrection,
      );
    });

    it('returns Insurrection at upper boundary (80)', () => {
      expect(engine.determineEscalationStage(80)).toBe(
        EscalationStage.Insurrection,
      );
    });

    it('returns CivilWar at lower boundary (81)', () => {
      expect(engine.determineEscalationStage(81)).toBe(
        EscalationStage.CivilWar,
      );
    });

    it('returns CivilWar for mid-range value (90)', () => {
      expect(engine.determineEscalationStage(90)).toBe(
        EscalationStage.CivilWar,
      );
    });

    it('returns CivilWar at upper boundary (100)', () => {
      expect(engine.determineEscalationStage(100)).toBe(
        EscalationStage.CivilWar,
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. computeStageEffects
  // ─────────────────────────────────────────────────────

  describe('computeStageEffects', () => {
    it('returns all zeros for Grumbling', () => {
      const effects: StageEffects = engine.computeStageEffects(
        EscalationStage.Grumbling,
      );
      expect(effects).toEqual({
        popularityDelta: 0,
        stabilityDelta: 0,
        economicGrowthMultiplier: 0,
        militaryReadinessDelta: 0,
        moraleHitPerRiotHex: 0,
      });
    });

    it('returns popularity and economic decay for Protests', () => {
      const effects: StageEffects = engine.computeStageEffects(
        EscalationStage.Protests,
      );
      expect(effects).toEqual({
        popularityDelta: -2,
        stabilityDelta: 0,
        economicGrowthMultiplier: -1,
        militaryReadinessDelta: 0,
        moraleHitPerRiotHex: 0,
      });
    });

    it('returns stability, FDI, and morale penalties for Riots', () => {
      const effects: StageEffects = engine.computeStageEffects(
        EscalationStage.Riots,
      );
      expect(effects).toEqual({
        popularityDelta: 0,
        stabilityDelta: -3,
        economicGrowthMultiplier: -0.2,
        militaryReadinessDelta: 0,
        moraleHitPerRiotHex: -10,
      });
    });

    it('returns stability and military readiness decay for Insurrection', () => {
      const effects: StageEffects = engine.computeStageEffects(
        EscalationStage.Insurrection,
      );
      expect(effects).toEqual({
        popularityDelta: 0,
        stabilityDelta: -5,
        economicGrowthMultiplier: 0,
        militaryReadinessDelta: -5,
        moraleHitPerRiotHex: 0,
      });
    });

    it('returns severe penalties for CivilWar', () => {
      const effects: StageEffects = engine.computeStageEffects(
        EscalationStage.CivilWar,
      );
      expect(effects).toEqual({
        popularityDelta: 0,
        stabilityDelta: -10,
        economicGrowthMultiplier: -0.5,
        militaryReadinessDelta: -10,
        moraleHitPerRiotHex: 0,
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. evaluateEscalation
  // ─────────────────────────────────────────────────────

  describe('evaluateEscalation', () => {
    it('returns correct civilUnrest score from inputs', () => {
      const input = makeInput({ inflation: 50, inequality: 40 });
      // 50*0.3 + 40*0.2 = 15 + 8 = 23
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.Grumbling,
      );
      expect(result.civilUnrest).toBeCloseTo(23);
    });

    it('reports stageChanged false when stage remains the same', () => {
      // civilUnrest = 15*0.3 = 4.5 → Grumbling
      const input = makeInput({ inflation: 15 });
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.Grumbling,
      );
      expect(result.stageChanged).toBe(false);
      expect(result.currentStage).toBe(EscalationStage.Grumbling);
    });

    it('reports stageChanged true when stage escalates up', () => {
      // civilUnrest = 100*0.3 + 100*0.2 + 100*0.2 = 70 → Insurrection
      const input = makeInput({
        inflation: 100,
        inequality: 100,
        repressionBacklash: 100,
      });
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.Grumbling,
      );
      expect(result.stageChanged).toBe(true);
      expect(result.currentStage).toBe(EscalationStage.Insurrection);
    });

    it('reports stageChanged true when stage de-escalates down', () => {
      // civilUnrest = 10*0.3 = 3 → Grumbling
      const input = makeInput({ inflation: 10 });
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.Riots,
      );
      expect(result.stageChanged).toBe(true);
      expect(result.currentStage).toBe(EscalationStage.Grumbling);
    });

    it('preserves previousStage in the result', () => {
      const input = makeInput({ inflation: 100 });
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.CivilWar,
      );
      expect(result.previousStage).toBe(EscalationStage.CivilWar);
    });

    it('includes correct effects for the current stage', () => {
      // civilUnrest = 100*0.3 + 100*0.2 = 50 → Riots
      const input = makeInput({ inflation: 100, inequality: 100 });
      const result: EscalationResult = engine.evaluateEscalation(
        input,
        EscalationStage.Grumbling,
      );
      expect(result.currentStage).toBe(EscalationStage.Riots);
      expect(result.effects).toEqual({
        popularityDelta: 0,
        stabilityDelta: -3,
        economicGrowthMultiplier: -0.2,
        militaryReadinessDelta: 0,
        moraleHitPerRiotHex: -10,
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. computeEthnicTension
  // ─────────────────────────────────────────────────────

  describe('computeEthnicTension', () => {
    it('returns zero tension and empty scores for no fault lines', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([]),
      );
      expect(result).toEqual({ totalTension: 0, faultLineScores: [] });
    });

    it('returns tensionBase as totalTension for a single fault line', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([makeFaultLine({ groupName: 'Kurds', tensionBase: 60 })]),
      );
      expect(result.totalTension).toBe(60);
    });

    it('computes arithmetic mean for two fault lines', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([
          makeFaultLine({ groupName: 'Group A', tensionBase: 40 }),
          makeFaultLine({ groupName: 'Group B', tensionBase: 80 }),
        ]),
      );
      // mean = (40 + 80) / 2 = 60
      expect(result.totalTension).toBe(60);
    });

    it('computes arithmetic mean for three fault lines', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([
          makeFaultLine({ groupName: 'A', tensionBase: 50 }),
          makeFaultLine({ groupName: 'B', tensionBase: 30 }),
          makeFaultLine({ groupName: 'C', tensionBase: 20 }),
        ]),
      );
      // mean = (50 + 30 + 20) / 3 ≈ 33.333
      expect(result.totalTension).toBeCloseTo(33.333, 2);
    });

    it('returns matching faultLineScores entries', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([
          makeFaultLine({ groupName: 'Sunni', tensionBase: 70 }),
          makeFaultLine({ groupName: 'Shia', tensionBase: 45 }),
        ]),
      );
      expect(result.faultLineScores).toEqual([
        { groupName: 'Sunni', tension: 70 },
        { groupName: 'Shia', tension: 45 },
      ]);
    });

    it('clamps negative tensionBase values to 0', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([
          makeFaultLine({ groupName: 'Neg', tensionBase: -20 }),
        ]),
      );
      expect(result.totalTension).toBe(0);
      expect(result.faultLineScores).toEqual([
        { groupName: 'Neg', tension: 0 },
      ]);
    });

    it('clamps tensionBase values above 100 to 100', () => {
      const result: EthnicTensionResult = engine.computeEthnicTension(
        makeFaultLines([
          makeFaultLine({ groupName: 'Over', tensionBase: 150 }),
        ]),
      );
      expect(result.totalTension).toBe(100);
      expect(result.faultLineScores).toEqual([
        { groupName: 'Over', tension: 100 },
      ]);
    });
  });

  // ─────────────────────────────────────────────────────
  // 6. buildUnrestComponents
  // ─────────────────────────────────────────────────────

  describe('buildUnrestComponents', () => {
    const factionId = 'us' as FactionId;
    const turn = 3 as TurnNumber;
    const input = makeInput({
      inflation: 40,
      inequality: 30,
      repressionBacklash: 20,
      ethnicTension: 10,
      foreignPropaganda: 5,
    });

    it('preserves factionId in result', () => {
      const components: CivilUnrestComponents = engine.buildUnrestComponents(
        factionId,
        turn,
        input,
        EscalationStage.Grumbling,
      );
      expect(components.factionId).toBe('us');
    });

    it('preserves turn in result', () => {
      const components: CivilUnrestComponents = engine.buildUnrestComponents(
        factionId,
        turn,
        input,
        EscalationStage.Grumbling,
      );
      expect(components.turn).toBe(3);
    });

    it('computes civilUnrest from input drivers', () => {
      const components: CivilUnrestComponents = engine.buildUnrestComponents(
        factionId,
        turn,
        input,
        EscalationStage.Grumbling,
      );
      // 40*0.3 + 30*0.2 + 20*0.2 + 10*0.15 + 5*0.15 = 12+6+4+1.5+0.75 = 24.25
      expect(components.civilUnrest).toBeCloseTo(24.25);
    });

    it('copies all five input driver fields', () => {
      const components: CivilUnrestComponents = engine.buildUnrestComponents(
        factionId,
        turn,
        input,
        EscalationStage.Protests,
      );
      expect(components.inflation).toBe(40);
      expect(components.inequality).toBe(30);
      expect(components.repressionBacklash).toBe(20);
      expect(components.ethnicTension).toBe(10);
      expect(components.foreignPropaganda).toBe(5);
    });

    it('uses the provided escalation stage directly', () => {
      const components: CivilUnrestComponents = engine.buildUnrestComponents(
        factionId,
        turn,
        input,
        EscalationStage.Insurrection,
      );
      expect(components.escalationStage).toBe(EscalationStage.Insurrection);
    });
  });
});
