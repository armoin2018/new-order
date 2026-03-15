import { describe, it, expect, beforeEach } from 'vitest';
import { ExportControlsEngine } from '@/engine/export-controls-engine';
import type {
  ExportControlInput,
  SemiconductorChokepointInput,
  CircumventionInput,
  CoalitionEligibilityInput,
} from '@/engine/export-controls-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ExportControlType, CircumventionMethod, TechDomain } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const JAPAN = 'japan' as FactionId;
const EU = 'eu' as FactionId;
const TURN = 5 as TurnNumber;

// ---------------------------------------------------------------------------
// Engine under test
// ---------------------------------------------------------------------------

let engine: ExportControlsEngine;
beforeEach(() => {
  engine = new ExportControlsEngine(GAME_CONFIG.technology);
});

// ===========================================================================
// evaluateExportControl
// ===========================================================================

describe('ExportControlsEngine', () => {
  describe('evaluateExportControl', () => {
    it('unilateral control is always eligible', () => {
      const input: ExportControlInput = {
        imposerFaction: US,
        targetFaction: CHINA,
        controlType: ExportControlType.Unilateral,
        domain: TechDomain.AI,
        coalitionDomainShare: 0.3,
        currentTurn: TURN,
      };

      const result = engine.evaluateExportControl(input);

      expect(result.controlType).toBe(ExportControlType.Unilateral);
      expect(result.eligible).toBe(true);
      expect(result.imposerEffects.diCost).toBe(-3);
      expect(result.targetEffects.investmentCostIncrease).toBe(0);
      expect(result.reason).toBeTruthy();
    });

    it('multilateral control is eligible when coalitionDomainShare >= 0.6', () => {
      const input: ExportControlInput = {
        imposerFaction: US,
        targetFaction: CHINA,
        controlType: ExportControlType.Multilateral,
        domain: TechDomain.AI,
        coalitionDomainShare: 0.6,
        currentTurn: TURN,
      };

      const result = engine.evaluateExportControl(input);

      expect(result.controlType).toBe(ExportControlType.Multilateral);
      expect(result.eligible).toBe(true);
      expect(result.imposerEffects.diCost).toBe(0);
      expect(result.targetEffects.investmentCostIncrease).toBeCloseTo(0.5);
      expect(result.reason).toBeTruthy();
    });

    it('multilateral control is NOT eligible when coalitionDomainShare is 0.59', () => {
      const input: ExportControlInput = {
        imposerFaction: US,
        targetFaction: CHINA,
        controlType: ExportControlType.Multilateral,
        domain: TechDomain.AI,
        coalitionDomainShare: 0.59,
        currentTurn: TURN,
      };

      const result = engine.evaluateExportControl(input);

      expect(result.controlType).toBe(ExportControlType.Multilateral);
      expect(result.eligible).toBe(false);
      expect(result.imposerEffects.diCost).toBe(0);
      expect(result.targetEffects.investmentCostIncrease).toBe(0);
      expect(result.reason).toBeTruthy();
    });

    it('multilateral control is eligible when coalitionDomainShare is 1.0', () => {
      const input: ExportControlInput = {
        imposerFaction: US,
        targetFaction: CHINA,
        controlType: ExportControlType.Multilateral,
        domain: TechDomain.AI,
        coalitionDomainShare: 1.0,
        currentTurn: TURN,
      };

      const result = engine.evaluateExportControl(input);

      expect(result.eligible).toBe(true);
      expect(result.imposerEffects.diCost).toBe(0);
      expect(result.targetEffects.investmentCostIncrease).toBeCloseTo(0.5);
    });

    it('multilateral control is NOT eligible when coalitionDomainShare is 0', () => {
      const input: ExportControlInput = {
        imposerFaction: US,
        targetFaction: CHINA,
        controlType: ExportControlType.Multilateral,
        domain: TechDomain.AI,
        coalitionDomainShare: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateExportControl(input);

      expect(result.eligible).toBe(false);
      expect(result.imposerEffects.diCost).toBe(0);
      expect(result.targetEffects.investmentCostIncrease).toBe(0);
    });
  });

  // =========================================================================
  // evaluateSemiconductorChokepoint
  // =========================================================================

  describe('evaluateSemiconductorChokepoint', () => {
    it('is eligible when production share exceeds threshold (0.6 > 0.5)', () => {
      const input: SemiconductorChokepointInput = {
        controllerFaction: US,
        targetFaction: CHINA,
        controllerProductionShare: 0.6,
        currentTurn: TURN,
      };

      const result = engine.evaluateSemiconductorChokepoint(input);

      expect(result.eligible).toBe(true);
      expect(result.targetMilitaryModernizationHalted).toBe(true);
      expect(result.targetAIDevelopmentCostIncrease).toBeCloseTo(1.0);
      expect(result.reason).toBeTruthy();
    });

    it('is NOT eligible when production share equals threshold (strict >)', () => {
      const input: SemiconductorChokepointInput = {
        controllerFaction: US,
        targetFaction: CHINA,
        controllerProductionShare: 0.5,
        currentTurn: TURN,
      };

      const result = engine.evaluateSemiconductorChokepoint(input);

      expect(result.eligible).toBe(false);
      expect(result.targetMilitaryModernizationHalted).toBe(false);
      expect(result.targetAIDevelopmentCostIncrease).toBe(0);
      expect(result.reason).toBeTruthy();
    });

    it('is eligible when production share is 0.51 (just above threshold)', () => {
      const input: SemiconductorChokepointInput = {
        controllerFaction: US,
        targetFaction: CHINA,
        controllerProductionShare: 0.51,
        currentTurn: TURN,
      };

      const result = engine.evaluateSemiconductorChokepoint(input);

      expect(result.eligible).toBe(true);
      expect(result.targetMilitaryModernizationHalted).toBe(true);
      expect(result.targetAIDevelopmentCostIncrease).toBeCloseTo(1.0);
    });

    it('is NOT eligible when production share is 0', () => {
      const input: SemiconductorChokepointInput = {
        controllerFaction: US,
        targetFaction: CHINA,
        controllerProductionShare: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateSemiconductorChokepoint(input);

      expect(result.eligible).toBe(false);
      expect(result.targetMilitaryModernizationHalted).toBe(false);
      expect(result.targetAIDevelopmentCostIncrease).toBe(0);
    });

    it('is eligible when production share is 1.0', () => {
      const input: SemiconductorChokepointInput = {
        controllerFaction: JAPAN,
        targetFaction: CHINA,
        controllerProductionShare: 1.0,
        currentTurn: TURN,
      };

      const result = engine.evaluateSemiconductorChokepoint(input);

      expect(result.eligible).toBe(true);
      expect(result.targetMilitaryModernizationHalted).toBe(true);
      expect(result.targetAIDevelopmentCostIncrease).toBeCloseTo(1.0);
    });
  });

  // =========================================================================
  // evaluateCircumvention
  // =========================================================================

  describe('evaluateCircumvention', () => {
    it('Espionage has costMultiplier=0, timeMultiplier=1.0, and high risk', () => {
      const input: CircumventionInput = {
        factionId: CHINA,
        method: CircumventionMethod.Espionage,
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCircumvention(input);

      expect(result.method).toBe(CircumventionMethod.Espionage);
      expect(result.costMultiplier).toBeCloseTo(0);
      expect(result.timeMultiplier).toBeCloseTo(1.0);
      expect(result.riskDescription).toMatch(/[Hh]igh risk/);
      expect(result.reason).toBeTruthy();
    });

    it('ThirdPartyTransshipment has costMultiplier=1.0, timeMultiplier=1.0, and moderate risk', () => {
      const input: CircumventionInput = {
        factionId: CHINA,
        method: CircumventionMethod.ThirdPartyTransshipment,
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCircumvention(input);

      expect(result.method).toBe(CircumventionMethod.ThirdPartyTransshipment);
      expect(result.costMultiplier).toBeCloseTo(1.0);
      expect(result.timeMultiplier).toBeCloseTo(1.0);
      expect(result.riskDescription).toMatch(/[Mm]oderate risk/);
      expect(result.reason).toBeTruthy();
    });

    it('DomesticSubstitution has costMultiplier=2.0, timeMultiplier=1.5, and no risk', () => {
      const input: CircumventionInput = {
        factionId: CHINA,
        method: CircumventionMethod.DomesticSubstitution,
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCircumvention(input);

      expect(result.method).toBe(CircumventionMethod.DomesticSubstitution);
      expect(result.costMultiplier).toBeCloseTo(2.0);
      expect(result.timeMultiplier).toBeCloseTo(1.5);
      expect(result.riskDescription).toMatch(/[Nn]o risk/);
      expect(result.reason).toBeTruthy();
    });
  });

  // =========================================================================
  // evaluateCoalitionEligibility
  // =========================================================================

  describe('evaluateCoalitionEligibility', () => {
    it('2 factions summing to 0.7 are eligible', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [US, JAPAN],
        domainShares: { [US]: 0.4, [JAPAN]: 0.3 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.combinedShare).toBeCloseTo(0.7);
      expect(result.memberCount).toBe(2);
      expect(result.reason).toBeTruthy();
    });

    it('2 factions summing to 0.5 are NOT eligible', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [US, JAPAN],
        domainShares: { [US]: 0.3, [JAPAN]: 0.2 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.combinedShare).toBeCloseTo(0.5);
      expect(result.memberCount).toBe(2);
      expect(result.reason).toBeTruthy();
    });

    it('single faction at 0.6 is eligible', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [US],
        domainShares: { [US]: 0.6 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.combinedShare).toBeCloseTo(0.6);
      expect(result.memberCount).toBe(1);
    });

    it('faction not in domainShares map is treated as 0', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [US, CHINA],
        domainShares: { [US]: 0.4 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.combinedShare).toBeCloseTo(0.4);
      expect(result.memberCount).toBe(2);
    });

    it('3 factions exactly at 0.6 are eligible', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [US, JAPAN, EU],
        domainShares: { [US]: 0.2, [JAPAN]: 0.2, [EU]: 0.2 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.combinedShare).toBeCloseTo(0.6);
      expect(result.memberCount).toBe(3);
    });

    it('empty coalition is NOT eligible with combinedShare=0 and memberCount=0', () => {
      const input: CoalitionEligibilityInput = {
        coalitionFactions: [],
        domainShares: { [US]: 0.9 },
        domain: TechDomain.AI,
        currentTurn: TURN,
      };

      const result = engine.evaluateCoalitionEligibility(input);

      expect(result.eligible).toBe(false);
      expect(result.combinedShare).toBeCloseTo(0);
      expect(result.memberCount).toBe(0);
    });
  });
});
