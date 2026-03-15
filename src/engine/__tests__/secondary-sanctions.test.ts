import { describe, it, expect, beforeEach } from 'vitest';
import { SecondarySanctionsEngine } from '@/engine/secondary-sanctions';
import type {
  SecondarySanctionInput,
  EvasionNetworkInput,
  CryptoInfraInput,
  CryptoDisruptionInput,
} from '@/engine/secondary-sanctions';
import { GAME_CONFIG } from '@/engine/config';
import { SecondarySanctionResponse } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const RUSSIA = 'russia' as FactionId;
const CHINA = 'china' as FactionId;
const TURN = 5 as TurnNumber;

describe('SecondarySanctionsEngine', () => {
  let engine: SecondarySanctionsEngine;

  beforeEach(() => {
    engine = new SecondarySanctionsEngine(GAME_CONFIG.financial);
  });

  // ── FR-1703 — evaluateSecondarySanction ──────────────────────────────

  describe('evaluateSecondarySanction', () => {
    it('returns not eligible when DI < 70 AND GDP share < 0.25', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 50,
        imposerGDPShare: 0.1,
        thirdPartyFaction: CHINA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(false);
      expect(result.thirdPartyCompliant).toBe(false);
      expect(result.imposerLegitimacyCost).toBe(0);
      expect(result.evasionNetworkCreated).toBe(false);
      expect(result.evasionEffectivenessReduction).toBe(0);
    });

    it('is eligible via DI >= 70 with Comply response', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 80,
        imposerGDPShare: 0.1,
        thirdPartyFaction: CHINA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(true);
      expect(result.imposerLegitimacyCost).toBe(-5);
      expect(result.evasionNetworkCreated).toBe(false);
      expect(result.evasionEffectivenessReduction).toBe(0);
    });

    it('is eligible via DI >= 70 with Defy response — evasion network created', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 80,
        imposerGDPShare: 0.1,
        thirdPartyFaction: RUSSIA,
        thirdPartyResponse: SecondarySanctionResponse.Defy,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(false);
      expect(result.imposerLegitimacyCost).toBe(-5);
      expect(result.evasionNetworkCreated).toBe(true);
      expect(result.evasionEffectivenessReduction).toBeCloseTo(0.1);
    });

    it('is eligible via GDP share >= 0.25 (DI < 70) with Comply response', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: CHINA,
        imposerDI: 50,
        imposerGDPShare: 0.3,
        thirdPartyFaction: RUSSIA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(true);
      expect(result.imposerLegitimacyCost).toBe(-5);
      expect(result.evasionNetworkCreated).toBe(false);
    });

    it('is eligible via GDP share >= 0.25 with Defy response — evasion created', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: CHINA,
        imposerDI: 50,
        imposerGDPShare: 0.3,
        thirdPartyFaction: RUSSIA,
        thirdPartyResponse: SecondarySanctionResponse.Defy,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(false);
      expect(result.evasionNetworkCreated).toBe(true);
      expect(result.evasionEffectivenessReduction).toBeCloseTo(0.1);
    });

    it('is eligible when both DI and GDP share thresholds are met', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 85,
        imposerGDPShare: 0.3,
        thirdPartyFaction: CHINA,
        thirdPartyResponse: SecondarySanctionResponse.Defy,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.imposerLegitimacyCost).toBe(-5);
      expect(result.evasionNetworkCreated).toBe(true);
    });

    it('boundary: DI exactly 70 qualifies as eligible', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 70,
        imposerGDPShare: 0.1,
        thirdPartyFaction: RUSSIA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(true);
    });

    it('boundary: GDP share exactly 0.25 qualifies as eligible', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: CHINA,
        imposerDI: 40,
        imposerGDPShare: 0.25,
        thirdPartyFaction: RUSSIA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.eligible).toBe(true);
      expect(result.thirdPartyCompliant).toBe(true);
    });

    it('reason string mentions imposerFaction and thirdPartyFaction when eligible', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: US,
        imposerDI: 80,
        imposerGDPShare: 0.3,
        thirdPartyFaction: CHINA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('china');
    });

    it('reason string mentions both factions when not eligible', () => {
      const input: SecondarySanctionInput = {
        imposerFaction: RUSSIA,
        imposerDI: 30,
        imposerGDPShare: 0.05,
        thirdPartyFaction: CHINA,
        thirdPartyResponse: SecondarySanctionResponse.Comply,
        currentTurn: TURN,
      };

      const result = engine.evaluateSecondarySanction(input);

      expect(result.reason).toContain('russia');
      expect(result.reason).toContain('china');
    });
  });

  // ── FR-1703 — computeEvasionNetworkImpact ────────────────────────────

  describe('computeEvasionNetworkImpact', () => {
    it('no networks → no reduction', () => {
      const input: EvasionNetworkInput = {
        currentSanctionsEffectiveness: 0.8,
        evasionNetworkCount: 0,
        currentTurn: TURN,
      };

      const result = engine.computeEvasionNetworkImpact(input);

      expect(result.previousEffectiveness).toBeCloseTo(0.8);
      expect(result.reducedEffectiveness).toBeCloseTo(0.8);
      expect(result.totalReduction).toBeCloseTo(0);
    });

    it('1 network → reduction of 0.1', () => {
      const input: EvasionNetworkInput = {
        currentSanctionsEffectiveness: 0.8,
        evasionNetworkCount: 1,
        currentTurn: TURN,
      };

      const result = engine.computeEvasionNetworkImpact(input);

      expect(result.reducedEffectiveness).toBeCloseTo(0.7);
      expect(result.totalReduction).toBeCloseTo(0.1);
    });

    it('3 networks → reduction of 0.3', () => {
      const input: EvasionNetworkInput = {
        currentSanctionsEffectiveness: 0.8,
        evasionNetworkCount: 3,
        currentTurn: TURN,
      };

      const result = engine.computeEvasionNetworkImpact(input);

      expect(result.reducedEffectiveness).toBeCloseTo(0.5);
      expect(result.totalReduction).toBeCloseTo(0.3);
    });

    it('floors at 0 when reduction exceeds effectiveness', () => {
      const input: EvasionNetworkInput = {
        currentSanctionsEffectiveness: 0.2,
        evasionNetworkCount: 5,
        currentTurn: TURN,
      };

      const result = engine.computeEvasionNetworkImpact(input);

      expect(result.reducedEffectiveness).toBeCloseTo(0);
      expect(result.totalReduction).toBeCloseTo(0.5);
    });

    it('previousEffectiveness matches input value', () => {
      const input: EvasionNetworkInput = {
        currentSanctionsEffectiveness: 0.65,
        evasionNetworkCount: 2,
        currentTurn: TURN,
      };

      const result = engine.computeEvasionNetworkImpact(input);

      expect(result.previousEffectiveness).toBeCloseTo(0.65);
      expect(result.reducedEffectiveness).toBeCloseTo(0.45);
    });
  });

  // ── FR-1704 — evaluateCryptoInfrastructure ───────────────────────────

  describe('evaluateCryptoInfrastructure', () => {
    it('turn 0 invested: buildProgress = 0, not operational, build cost charged', () => {
      const input: CryptoInfraInput = {
        factionId: RUSSIA,
        turnsInvested: 0,
        isOperational: false,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.operational).toBe(false);
      expect(result.buildProgress).toBeCloseTo(0);
      expect(result.buildCost).toBe(-10);
      expect(result.sanctionsReduction).toBeCloseTo(0);
      expect(result.corruptionUnrestPerTurn).toBe(0);
      expect(result.vulnerable).toBe(false);
    });

    it('turn 1 invested: buildProgress = 1/3, not operational, build cost charged', () => {
      const input: CryptoInfraInput = {
        factionId: RUSSIA,
        turnsInvested: 1,
        isOperational: false,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.operational).toBe(false);
      expect(result.buildProgress).toBeCloseTo(1 / 3);
      expect(result.buildCost).toBe(-10);
      expect(result.sanctionsReduction).toBeCloseTo(0);
    });

    it('turn 3 invested: fully operational with sanctions reduction and unrest', () => {
      const input: CryptoInfraInput = {
        factionId: RUSSIA,
        turnsInvested: 3,
        isOperational: true,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.operational).toBe(true);
      expect(result.buildProgress).toBeCloseTo(1.0);
      expect(result.buildCost).toBe(0);
      expect(result.sanctionsReduction).toBeCloseTo(0.2);
      expect(result.corruptionUnrestPerTurn).toBe(3);
      expect(result.vulnerable).toBe(true);
    });

    it('turn 5 invested: buildProgress clamped at 1.0, still operational', () => {
      const input: CryptoInfraInput = {
        factionId: CHINA,
        turnsInvested: 5,
        isOperational: true,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.operational).toBe(true);
      expect(result.buildProgress).toBeCloseTo(1.0);
      expect(result.buildCost).toBe(0);
      expect(result.sanctionsReduction).toBeCloseTo(0.2);
      expect(result.corruptionUnrestPerTurn).toBe(3);
      expect(result.vulnerable).toBe(true);
    });

    it('disrupted: not operational even if turnsInvested >= 3, no sanctions reduction', () => {
      const input: CryptoInfraInput = {
        factionId: RUSSIA,
        turnsInvested: 4,
        isOperational: false,
        isDisrupted: true,
        disruptionTurnsRemaining: 1,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.operational).toBe(false);
      expect(result.sanctionsReduction).toBeCloseTo(0);
      expect(result.corruptionUnrestPerTurn).toBe(0);
      expect(result.vulnerable).toBe(false);
    });

    it('disrupted reason mentions disruption turns remaining', () => {
      const input: CryptoInfraInput = {
        factionId: RUSSIA,
        turnsInvested: 3,
        isOperational: false,
        isDisrupted: true,
        disruptionTurnsRemaining: 2,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.reason).toContain('DISRUPTED');
      expect(result.reason).toContain('2');
    });

    it('operational reason mentions sanctions reduction and CYBER vulnerability', () => {
      const input: CryptoInfraInput = {
        factionId: CHINA,
        turnsInvested: 3,
        isOperational: true,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.reason).toContain('OPERATIONAL');
      expect(result.reason).toContain('CYBER');
    });

    it('under-construction reason mentions build progress', () => {
      const input: CryptoInfraInput = {
        factionId: US,
        turnsInvested: 2,
        isOperational: false,
        isDisrupted: false,
        disruptionTurnsRemaining: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCryptoInfrastructure(input);

      expect(result.reason).toContain('UNDER CONSTRUCTION');
      expect(result.reason).toContain('2/3');
    });
  });

  // ── FR-1704 — computeCryptoDisruption ────────────────────────────────

  describe('computeCryptoDisruption', () => {
    it('disrupts when infrastructure was operational', () => {
      const input: CryptoDisruptionInput = {
        factionId: RUSSIA,
        wasOperational: true,
        currentTurn: TURN,
      };

      const result = engine.computeCryptoDisruption(input);

      expect(result.disrupted).toBe(true);
      expect(result.sanctionsReductionLost).toBeCloseTo(0.2);
      expect(result.disruptionDuration).toBe(2);
    });

    it('no effect when infrastructure was not operational', () => {
      const input: CryptoDisruptionInput = {
        factionId: RUSSIA,
        wasOperational: false,
        currentTurn: TURN,
      };

      const result = engine.computeCryptoDisruption(input);

      expect(result.disrupted).toBe(false);
      expect(result.sanctionsReductionLost).toBeCloseTo(0);
      expect(result.disruptionDuration).toBe(2);
    });

    it('reason mentions faction and turn when disrupted', () => {
      const input: CryptoDisruptionInput = {
        factionId: CHINA,
        wasOperational: true,
        currentTurn: 10 as TurnNumber,
      };

      const result = engine.computeCryptoDisruption(input);

      expect(result.reason).toContain('china');
      expect(result.reason).toContain('10');
    });

    it('reason mentions faction and turn when not disrupted', () => {
      const input: CryptoDisruptionInput = {
        factionId: US,
        wasOperational: false,
        currentTurn: 7 as TurnNumber,
      };

      const result = engine.computeCryptoDisruption(input);

      expect(result.reason).toContain('us');
      expect(result.reason).toContain('7');
      expect(result.reason).toContain('not operational');
    });
  });
});
