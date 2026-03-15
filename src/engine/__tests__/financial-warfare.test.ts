import { describe, it, expect, beforeEach } from 'vitest';
import { FinancialWarfareEngine } from '@/engine/financial-warfare';
import type {
  DebtTrapInput,
  CurrencyManipulationInput,
} from '@/engine/financial-warfare';
import { GAME_CONFIG } from '@/engine/config';
import { CurrencyManipulationType, DebtTrapStatus } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const CHINA = 'china' as FactionId;
const US = 'us' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 5 as TurnNumber;

describe('FinancialWarfareEngine', () => {
  let engine: FinancialWarfareEngine;

  beforeEach(() => {
    engine = new FinancialWarfareEngine(GAME_CONFIG.financial);
  });

  // ── FR-1705 — evaluateDebtTrapLoan ─────────────────────────────────────

  describe('evaluateDebtTrapLoan', () => {
    // ── BoostPhase ────────────────────────────────────────────────────────

    it('BoostPhase turn 0: stays BoostPhase with gdpBoost 15', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 0,
        borrowerGDP: 80,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.BoostPhase);
      expect(result.gdpBoost).toBe(15);
      expect(result.lenderEffects.diBonus).toBe(0);
      expect(result.lenderEffects.concessionAvailable).toBe(false);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(0);
      expect(result.borrowerEffects.financeBlockTurns).toBe(0);
    });

    it('BoostPhase turn 1: stays BoostPhase with gdpBoost 15', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 1,
        borrowerGDP: 80,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.BoostPhase);
      expect(result.gdpBoost).toBe(15);
    });

    it('BoostPhase turn 2 (< duration 3): stays BoostPhase', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 2,
        borrowerGDP: 80,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.BoostPhase);
      expect(result.gdpBoost).toBe(15);
    });

    it('BoostPhase turn 3 (>= duration): transitions to RepaymentDue with gdpBoost 0', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 3,
        borrowerGDP: 80,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.RepaymentDue);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(0);
      expect(result.lenderEffects.concessionAvailable).toBe(false);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(0);
      expect(result.borrowerEffects.financeBlockTurns).toBe(0);
    });

    // ── RepaymentDue ──────────────────────────────────────────────────────

    it('RepaymentDue, can service (GDP 200 >= loan 100): transitions to Servicing', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 4,
        borrowerGDP: 200,
        loanAmount: 100,
        status: DebtTrapStatus.RepaymentDue,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.Servicing);
      expect(result.canServiceDebt).toBe(true);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(0);
      expect(result.lenderEffects.concessionAvailable).toBe(false);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(0);
      expect(result.borrowerEffects.financeBlockTurns).toBe(0);
    });

    it('RepaymentDue, cannot service (GDP 50 < loan 100): transitions to Defaulted', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 4,
        borrowerGDP: 50,
        loanAmount: 100,
        status: DebtTrapStatus.RepaymentDue,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.Defaulted);
      expect(result.canServiceDebt).toBe(false);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(20);
      expect(result.lenderEffects.concessionAvailable).toBe(true);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(-10);
      expect(result.borrowerEffects.financeBlockTurns).toBe(5);
    });

    // ── Servicing ─────────────────────────────────────────────────────────

    it('Servicing: stays Servicing with no effects', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 6,
        borrowerGDP: 200,
        loanAmount: 100,
        status: DebtTrapStatus.Servicing,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.Servicing);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(0);
      expect(result.lenderEffects.concessionAvailable).toBe(false);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(0);
      expect(result.borrowerEffects.financeBlockTurns).toBe(0);
    });

    // ── Defaulted ─────────────────────────────────────────────────────────

    it('Defaulted: stays Defaulted with ongoing penalties', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 8,
        borrowerGDP: 50,
        loanAmount: 100,
        status: DebtTrapStatus.Defaulted,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.Defaulted);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(20);
      expect(result.lenderEffects.concessionAvailable).toBe(true);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(-10);
      expect(result.borrowerEffects.financeBlockTurns).toBe(5);
    });

    // ── BailedOut ─────────────────────────────────────────────────────────

    it('BailedOut: stays BailedOut with no effects', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 10,
        borrowerGDP: 50,
        loanAmount: 100,
        status: DebtTrapStatus.BailedOut,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.BailedOut);
      expect(result.gdpBoost).toBe(0);
      expect(result.lenderEffects.diBonus).toBe(0);
      expect(result.lenderEffects.concessionAvailable).toBe(false);
      expect(result.borrowerEffects.legitimacyPenalty).toBe(0);
      expect(result.borrowerEffects.financeBlockTurns).toBe(0);
    });

    // ── canServiceDebt correctness ────────────────────────────────────────

    it('canServiceDebt is true when borrowerGDP equals loanAmount exactly', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 0,
        borrowerGDP: 100,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.canServiceDebt).toBe(true);
    });

    it('canServiceDebt is false when borrowerGDP is below loanAmount', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 0,
        borrowerGDP: 99,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.canServiceDebt).toBe(false);
    });

    it('canServiceDebt is true when borrowerGDP exceeds loanAmount', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 5,
        borrowerGDP: 300,
        loanAmount: 100,
        status: DebtTrapStatus.Servicing,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.canServiceDebt).toBe(true);
    });

    it('canServiceDebt is correctly computed in Defaulted state', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 8,
        borrowerGDP: 30,
        loanAmount: 100,
        status: DebtTrapStatus.Defaulted,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.canServiceDebt).toBe(false);
    });

    it('canServiceDebt is correctly computed in BailedOut state', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 10,
        borrowerGDP: 150,
        loanAmount: 100,
        status: DebtTrapStatus.BailedOut,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.canServiceDebt).toBe(true);
    });

    it('RepaymentDue boundary: GDP exactly equals loan transitions to Servicing', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 4,
        borrowerGDP: 100,
        loanAmount: 100,
        status: DebtTrapStatus.RepaymentDue,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.status).toBe(DebtTrapStatus.Servicing);
      expect(result.canServiceDebt).toBe(true);
    });

    it('reason string includes faction names and turn info', () => {
      const input: DebtTrapInput = {
        lenderFaction: CHINA,
        borrowerFaction: IRAN,
        turnsElapsed: 0,
        borrowerGDP: 80,
        loanAmount: 100,
        status: DebtTrapStatus.BoostPhase,
        currentTurn: TURN,
      };

      const result = engine.evaluateDebtTrapLoan(input);

      expect(result.reason).toContain('china');
      expect(result.reason).toContain('iran');
      expect(result.reason).toContain(String(TURN));
    });
  });

  // ── FR-1706 — evaluateCurrencyManipulation ─────────────────────────────

  describe('evaluateCurrencyManipulation', () => {
    // ── Devaluation ───────────────────────────────────────────────────────

    it('Devaluation: always succeeds with trade boost and inflation', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: CHINA,
        manipulationType: CurrencyManipulationType.Devaluation,
        targetFaction: null,
        manipulatorTreasury: 50,
        targetTreasury: 0,
        manipulatorGDP: 1000,
        targetGDP: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.manipulationType).toBe(CurrencyManipulationType.Devaluation);
      expect(result.success).toBe(true);
      expect(result.manipulatorEffects.tradeBoost).toBeCloseTo(0.1);
      expect(result.manipulatorEffects.inflationIncrease).toBe(5);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(3);
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      // Self-targeting — no target effects
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    // ── ReserveWeaponization ──────────────────────────────────────────────

    it('ReserveWeaponization: always succeeds with treasury cost', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.ReserveWeaponization,
        targetFaction: IRAN,
        manipulatorTreasury: 100,
        targetTreasury: 30,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.manipulationType).toBe(CurrencyManipulationType.ReserveWeaponization);
      expect(result.success).toBe(true);
      expect(result.manipulatorEffects.treasuryCost).toBe(-10);
      expect(result.manipulatorEffects.tradeBoost).toBe(0);
      expect(result.manipulatorEffects.inflationIncrease).toBe(0);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(0);
      // Downstream effect — no direct target effects
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    // ── CurrencyAttack — SUCCESS ──────────────────────────────────────────

    it('CurrencyAttack SUCCESS: GDP > 2× target, treasury >= 20, targetTreasury <= 50', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 50,
        targetTreasury: 30,
        manipulatorGDP: 500,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.manipulationType).toBe(CurrencyManipulationType.CurrencyAttack);
      expect(result.success).toBe(true);
      expect(result.targetEffects.treasuryHit).toBe(-15);
      expect(result.targetEffects.inflationIncrease).toBe(5);
      expect(result.targetEffects.civilUnrestIncrease).toBe(5);
      // Successful attack — no manipulator cost
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      expect(result.manipulatorEffects.tradeBoost).toBe(0);
      expect(result.manipulatorEffects.inflationIncrease).toBe(0);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(0);
    });

    // ── CurrencyAttack — FAIL (GDP not superior) ─────────────────────────

    it('CurrencyAttack FAIL: GDP NOT > 2× target → no effects', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: IRAN,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: US,
        manipulatorTreasury: 50,
        targetTreasury: 30,
        manipulatorGDP: 300,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      expect(result.manipulatorEffects.tradeBoost).toBe(0);
      expect(result.manipulatorEffects.inflationIncrease).toBe(0);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(0);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    // ── CurrencyAttack — FAIL (target absorbs) ───────────────────────────

    it('CurrencyAttack FAIL: GDP > 2× but targetTreasury > 50 → absorbed, manipulator loses -20', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: CHINA,
        manipulatorTreasury: 50,
        targetTreasury: 60,
        manipulatorGDP: 1000,
        targetGDP: 400,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(-20);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    // ── CurrencyAttack — FAIL (insufficient reserves) ────────────────────

    it('CurrencyAttack FAIL: GDP > 2× but treasury < 20 → manipulator loses -20', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 10,
        targetTreasury: 30,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(-20);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    // ── Boundary: GDP exactly 2× ─────────────────────────────────────────

    it('Boundary: GDP exactly 2× target → NOT sufficient (must be > 2×)', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 50,
        targetTreasury: 30,
        manipulatorGDP: 400,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      // 400 is NOT > 2 × 200 (400 === 400), so fails the GDP check
      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      expect(result.targetEffects.treasuryHit).toBe(0);
    });

    // ── Boundary: GDP = 2× + 1 ───────────────────────────────────────────

    it('Boundary: GDP = 2× + 1 → sufficient for attack', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 50,
        targetTreasury: 30,
        manipulatorGDP: 401,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      // 401 > 2 × 200 (401 > 400), succeeds
      expect(result.success).toBe(true);
      expect(result.targetEffects.treasuryHit).toBe(-15);
      expect(result.targetEffects.inflationIncrease).toBe(5);
      expect(result.targetEffects.civilUnrestIncrease).toBe(5);
    });

    // ── Boundary: targetTreasury exactly 50 ──────────────────────────────

    it('Boundary: targetTreasury exactly 50 → attack can succeed (<=50 passes)', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 50,
        targetTreasury: 50,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      // targetTreasury 50 is NOT > 50, so the absorption check passes
      expect(result.success).toBe(true);
      expect(result.targetEffects.treasuryHit).toBe(-15);
      expect(result.targetEffects.inflationIncrease).toBe(5);
      expect(result.targetEffects.civilUnrestIncrease).toBe(5);
    });

    // ── Boundary: targetTreasury = 51 ────────────────────────────────────

    it('Boundary: targetTreasury 51 → absorbed (> 50 fails)', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 50,
        targetTreasury: 51,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(-20);
      expect(result.targetEffects.treasuryHit).toBe(0);
    });

    // ── Additional coverage ───────────────────────────────────────────────

    it('Devaluation reason includes faction name and turn', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: CHINA,
        manipulationType: CurrencyManipulationType.Devaluation,
        targetFaction: null,
        manipulatorTreasury: 50,
        targetTreasury: 0,
        manipulatorGDP: 1000,
        targetGDP: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.reason).toContain('china');
      expect(result.reason).toContain(String(TURN));
    });

    it('ReserveWeaponization reason includes target faction', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.ReserveWeaponization,
        targetFaction: IRAN,
        manipulatorTreasury: 100,
        targetTreasury: 30,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.reason).toContain('iran');
    });

    it('CurrencyAttack success: manipulatorEffects are all neutral', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 100,
        targetTreasury: 20,
        manipulatorGDP: 1000,
        targetGDP: 100,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(true);
      expect(result.manipulatorEffects.tradeBoost).toBe(0);
      expect(result.manipulatorEffects.inflationIncrease).toBe(0);
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(0);
    });

    it('CurrencyAttack fail (GDP not superior): all target effects zero', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: IRAN,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: US,
        manipulatorTreasury: 100,
        targetTreasury: 20,
        manipulatorGDP: 100,
        targetGDP: 500,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(0);
      expect(result.manipulatorEffects.tradeBoost).toBe(0);
      expect(result.manipulatorEffects.inflationIncrease).toBe(0);
      expect(result.manipulatorEffects.civilUnrestIncrease).toBe(0);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.inflationIncrease).toBe(0);
      expect(result.targetEffects.civilUnrestIncrease).toBe(0);
    });

    it('Boundary: treasury exactly 20 with GDP > 2× and targetTreasury <= 50 → succeeds', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 20,
        targetTreasury: 50,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      // treasury 20 >= 20 required, passes
      expect(result.success).toBe(true);
      expect(result.targetEffects.treasuryHit).toBe(-15);
    });

    it('Boundary: treasury 19 with GDP > 2× → insufficient reserves, fails', () => {
      const input: CurrencyManipulationInput = {
        manipulatorFaction: US,
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        targetFaction: IRAN,
        manipulatorTreasury: 19,
        targetTreasury: 30,
        manipulatorGDP: 1000,
        targetGDP: 200,
        currentTurn: TURN,
      };

      const result = engine.evaluateCurrencyManipulation(input);

      expect(result.success).toBe(false);
      expect(result.manipulatorEffects.treasuryCost).toBe(-20);
    });
  });
});
