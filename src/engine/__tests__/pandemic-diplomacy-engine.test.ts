/**
 * Unit tests for PandemicDiplomacyEngine
 *
 * Covers pandemic risk evaluation, pandemic effects, pandemic response
 * policies, environmental diplomacy actions, and environmental pariah
 * penalties.
 *
 * @see FR-1905 — Pandemic Risk
 * @see FR-1908 — Environmental Diplomacy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PandemicDiplomacyEngine } from '@/engine/pandemic-diplomacy-engine';
import type {
  PandemicRiskInput,
  PandemicEffectsInput,
  PandemicResponseInput,
  EnvironmentalDiplomacyInput,
  EnvironmentalPariahInput,
} from '@/engine/pandemic-diplomacy-engine';
import { GAME_CONFIG } from '@/engine/config';
import { PandemicResponse, EnvironmentalDiplomacyType } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const EU = 'eu' as FactionId;
const RUSSIA = 'russia' as FactionId;
const TURN = 5 as TurnNumber;

describe('PandemicDiplomacyEngine', () => {
  let engine: PandemicDiplomacyEngine;

  beforeEach(() => {
    engine = new PandemicDiplomacyEngine(GAME_CONFIG.resources);
  });

  // ─────────────────────────────────────────────────────────
  // 1. evaluatePandemicRisk
  // ─────────────────────────────────────────────────────────

  describe('evaluatePandemicRisk', () => {
    it('triggers pandemic when all 3 factors are met', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 10,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(true);
      expect(result.riskFactorCount).toBe(3);
      expect(result.riskFactors.warTheaterExceeded).toBe(true);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(true);
      expect(result.riskFactors.biotechBelowThreshold).toBe(true);
      expect(result.reason).toContain('TRIGGERED');
    });

    it('does not trigger pandemic when no factors are met', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 1,
        lowestNationStability: 50,
        globalAverageBiotech: 60,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(0);
      expect(result.riskFactors.warTheaterExceeded).toBe(false);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(false);
      expect(result.riskFactors.biotechBelowThreshold).toBe(false);
      expect(result.reason).toContain('not triggered');
    });

    it('does not trigger when only war theaters factor is met', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 3,
        lowestNationStability: 50,
        globalAverageBiotech: 60,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(1);
      expect(result.riskFactors.warTheaterExceeded).toBe(true);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(false);
      expect(result.riskFactors.biotechBelowThreshold).toBe(false);
    });

    it('does not trigger when only stability factor is met', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 1,
        lowestNationStability: 10,
        globalAverageBiotech: 60,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(1);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(true);
    });

    it('does not trigger when only biotech factor is met', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 1,
        lowestNationStability: 50,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(1);
      expect(result.riskFactors.biotechBelowThreshold).toBe(true);
    });

    it('does not trigger when two factors are met but not the third (missing biotech)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 10,
        globalAverageBiotech: 60,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(2);
      expect(result.riskFactors.warTheaterExceeded).toBe(true);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(true);
      expect(result.riskFactors.biotechBelowThreshold).toBe(false);
    });

    it('does not trigger when two factors are met but not the third (missing stability)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 5,
        lowestNationStability: 50,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.pandemicTriggered).toBe(false);
      expect(result.riskFactorCount).toBe(2);
    });

    it('boundary: warTheaters=3 meets threshold (>=3)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 3,
        lowestNationStability: 10,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.riskFactors.warTheaterExceeded).toBe(true);
      expect(result.pandemicTriggered).toBe(true);
    });

    it('boundary: stability=15 does NOT meet threshold (not <15)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 15,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(false);
      expect(result.pandemicTriggered).toBe(false);
    });

    it('boundary: stability=14 meets threshold (<15)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 14,
        globalAverageBiotech: 20,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.riskFactors.stabilityBelowThreshold).toBe(true);
      expect(result.pandemicTriggered).toBe(true);
    });

    it('boundary: biotech=30 does NOT meet threshold (not <30)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 10,
        globalAverageBiotech: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.riskFactors.biotechBelowThreshold).toBe(false);
      expect(result.pandemicTriggered).toBe(false);
    });

    it('boundary: biotech=29 meets threshold (<30)', () => {
      const input: PandemicRiskInput = {
        activeWarTheaters: 4,
        lowestNationStability: 10,
        globalAverageBiotech: 29,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicRisk(input);
      expect(result.riskFactors.biotechBelowThreshold).toBe(true);
      expect(result.pandemicTriggered).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. evaluatePandemicEffects
  // ─────────────────────────────────────────────────────────

  describe('evaluatePandemicEffects', () => {
    it('high biotech (70) yields 2-turn recovery', () => {
      const input: PandemicEffectsInput = {
        factionId: US,
        factionBiotechLevel: 70,
        turnsSincePandemicStart: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.recoveryTurns).toBe(2);
      expect(result.reason).toContain('recovery in 2');
    });

    it('boundary: biotech=50 yields 2-turn recovery (>=50)', () => {
      const input: PandemicEffectsInput = {
        factionId: CHINA,
        factionBiotechLevel: 50,
        turnsSincePandemicStart: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.recoveryTurns).toBe(2);
    });

    it('boundary: biotech=49 yields 4-turn recovery (<50)', () => {
      const input: PandemicEffectsInput = {
        factionId: RUSSIA,
        factionBiotechLevel: 49,
        turnsSincePandemicStart: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.recoveryTurns).toBe(4);
    });

    it('no countermeasures when turnsSincePandemicStart < recoveryTurns (1 < 2)', () => {
      const input: PandemicEffectsInput = {
        factionId: US,
        factionBiotechLevel: 70,
        turnsSincePandemicStart: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.hasCountermeasures).toBe(false);
      expect(result.activeEffects).toBe(true);
      expect(result.reason).toContain('effects ACTIVE');
    });

    it('countermeasures when turnsSincePandemicStart equals recoveryTurns (2 >= 2)', () => {
      const input: PandemicEffectsInput = {
        factionId: US,
        factionBiotechLevel: 70,
        turnsSincePandemicStart: 2,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.hasCountermeasures).toBe(true);
      expect(result.activeEffects).toBe(false);
      expect(result.reason).toContain('countermeasures ACTIVE');
    });

    it('countermeasures when turnsSincePandemicStart exceeds recoveryTurns (3 > 2)', () => {
      const input: PandemicEffectsInput = {
        factionId: US,
        factionBiotechLevel: 70,
        turnsSincePandemicStart: 3,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.hasCountermeasures).toBe(true);
      expect(result.activeEffects).toBe(false);
    });

    it('gdpPenaltyPerTurn always returns the config value -0.03', () => {
      const input: PandemicEffectsInput = {
        factionId: EU,
        factionBiotechLevel: 40,
        turnsSincePandemicStart: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicEffects(input);
      expect(result.gdpPenaltyPerTurn).toBeCloseTo(-0.03);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. evaluatePandemicResponse
  // ─────────────────────────────────────────────────────────

  describe('evaluatePandemicResponse', () => {
    it('Cooperate yields legitimacy +10, no GDP penalty, no spread reduction, trade open', () => {
      const input: PandemicResponseInput = {
        factionId: US,
        response: PandemicResponse.Cooperate,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicResponse(input);
      expect(result.response).toBe(PandemicResponse.Cooperate);
      expect(result.legitimacyChange).toBe(10);
      expect(result.gdpPenalty).toBe(0);
      expect(result.spreadReduction).toBe(false);
      expect(result.tradeHalted).toBe(false);
      expect(result.reason).toContain('Cooperate');
    });

    it('Hoard yields legitimacy -10, no GDP penalty, no spread reduction, trade open', () => {
      const input: PandemicResponseInput = {
        factionId: CHINA,
        response: PandemicResponse.Hoard,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicResponse(input);
      expect(result.response).toBe(PandemicResponse.Hoard);
      expect(result.legitimacyChange).toBe(-10);
      expect(result.gdpPenalty).toBe(0);
      expect(result.spreadReduction).toBe(false);
      expect(result.tradeHalted).toBe(false);
      expect(result.reason).toContain('Hoard');
    });

    it('BorderClose yields legitimacy 0, GDP penalty -0.05, spread reduction, trade halted', () => {
      const input: PandemicResponseInput = {
        factionId: RUSSIA,
        response: PandemicResponse.BorderClose,
        currentTurn: TURN,
      };
      const result = engine.evaluatePandemicResponse(input);
      expect(result.response).toBe(PandemicResponse.BorderClose);
      expect(result.legitimacyChange).toBe(0);
      expect(result.gdpPenalty).toBeCloseTo(-0.05);
      expect(result.spreadReduction).toBe(true);
      expect(result.tradeHalted).toBe(true);
      expect(result.reason).toContain('BorderClose');
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. evaluateEnvironmentalDiplomacy
  // ─────────────────────────────────────────────────────────

  describe('evaluateEnvironmentalDiplomacy', () => {
    it('ClimateAccords yields legitimacy +5, GDP cost -0.02, no chemistry or trust', () => {
      const input: EnvironmentalDiplomacyInput = {
        factionId: EU,
        partnerFaction: US,
        diplomacyType: EnvironmentalDiplomacyType.ClimateAccords,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalDiplomacy(input);
      expect(result.diplomacyType).toBe(EnvironmentalDiplomacyType.ClimateAccords);
      expect(result.legitimacyChange).toBe(5);
      expect(result.gdpCost).toBeCloseTo(-0.02);
      expect(result.chemistryBonus).toBe(0);
      expect(result.trustBonus).toBe(0);
      expect(result.reason).toContain('ClimateAccords');
    });

    it('ResourceSharingTreaty yields all zeros (no direct effects)', () => {
      const input: EnvironmentalDiplomacyInput = {
        factionId: CHINA,
        partnerFaction: RUSSIA,
        diplomacyType: EnvironmentalDiplomacyType.ResourceSharingTreaty,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalDiplomacy(input);
      expect(result.diplomacyType).toBe(EnvironmentalDiplomacyType.ResourceSharingTreaty);
      expect(result.legitimacyChange).toBe(0);
      expect(result.gdpCost).toBe(0);
      expect(result.chemistryBonus).toBe(0);
      expect(result.trustBonus).toBe(0);
      expect(result.reason).toContain('ResourceSharingTreaty');
    });

    it('JointDisasterResponse yields chemistry +10, trust +5, no legitimacy or GDP', () => {
      const input: EnvironmentalDiplomacyInput = {
        factionId: US,
        partnerFaction: EU,
        diplomacyType: EnvironmentalDiplomacyType.JointDisasterResponse,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalDiplomacy(input);
      expect(result.diplomacyType).toBe(EnvironmentalDiplomacyType.JointDisasterResponse);
      expect(result.legitimacyChange).toBe(0);
      expect(result.gdpCost).toBe(0);
      expect(result.chemistryBonus).toBe(10);
      expect(result.trustBonus).toBe(5);
      expect(result.reason).toContain('JointDisasterResponse');
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. evaluateEnvironmentalPariah
  // ─────────────────────────────────────────────────────────

  describe('evaluateEnvironmentalPariah', () => {
    it('5 turns of non-cooperation yields cumulative penalty of -10', () => {
      const input: EnvironmentalPariahInput = {
        factionId: RUSSIA,
        turnsOfNonCooperation: 5,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalPariah(input);
      expect(result.cumulativeLegitimacyPenalty).toBe(-10);
      expect(result.reason).toContain('-10');
    });

    it('0 turns of non-cooperation yields no penalty', () => {
      const input: EnvironmentalPariahInput = {
        factionId: EU,
        turnsOfNonCooperation: 0,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalPariah(input);
      // 0 * -2 produces -0 in JS; use toBeCloseTo to treat -0 and 0 as equal
      expect(result.cumulativeLegitimacyPenalty).toBeCloseTo(0);
      expect(result.reason).toContain('0');
    });

    it('1 turn of non-cooperation yields penalty of -2', () => {
      const input: EnvironmentalPariahInput = {
        factionId: CHINA,
        turnsOfNonCooperation: 1,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalPariah(input);
      expect(result.cumulativeLegitimacyPenalty).toBe(-2);
      expect(result.reason).toContain('-2');
    });

    it('10 turns of non-cooperation yields penalty of -20', () => {
      const input: EnvironmentalPariahInput = {
        factionId: US,
        turnsOfNonCooperation: 10,
        currentTurn: TURN,
      };
      const result = engine.evaluateEnvironmentalPariah(input);
      expect(result.cumulativeLegitimacyPenalty).toBe(-20);
      expect(result.reason).toContain('-20');
    });
  });
});
