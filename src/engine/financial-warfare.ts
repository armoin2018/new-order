/**
 * Financial Warfare Engine — Debt-Trap Diplomacy & Currency Manipulation
 *
 * Implements the core financial-warfare mechanics for predatory lending
 * and currency-based economic attacks.
 *
 * **Debt-Trap Diplomacy (FR-1705):** A lender faction extends an
 * infrastructure loan to a borrower. The borrower enjoys an initial GDP
 * boost for a configurable number of turns. Once the boost phase ends,
 * the borrower must service the debt. If its GDP is insufficient to cover
 * the loan, it defaults — suffering legitimacy loss and financial
 * blockage while the lender gains Diplomatic Influence and concession
 * leverage. A third-party bailout may rescue the borrower.
 *
 * **Currency Manipulation (FR-1706):** A faction with a dominant economy
 * can weaponise its currency through three distinct actions:
 * - *Devaluation* — boosts trade competitiveness at the cost of domestic
 *   inflation and civil unrest.
 * - *Reserve Weaponization* — spends reserves to restrict a target's
 *   access to the global financial system (chokepoint effect).
 * - *Currency Attack* — a direct assault on a target's currency,
 *   requiring GDP superiority and reserve commitment.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 * Every threshold and modifier is drawn from `GAME_CONFIG.financial`.
 *
 * @module financial-warfare
 * @see FR-1705 — Debt-Trap Diplomacy
 * @see FR-1706 — Currency Manipulation
 */

import { GAME_CONFIG } from '@/engine/config';
import { CurrencyManipulationType, DebtTrapStatus } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Config Type Alias
// ---------------------------------------------------------------------------

/** Resolved type of the `GAME_CONFIG.financial` section. */
export type FinancialWarfareConfig = typeof GAME_CONFIG.financial;

// ---------------------------------------------------------------------------
// FR-1705 — Debt-Trap Diplomacy Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating the current state of a debt-trap loan
 * between a lender and a borrower faction.
 *
 * @see FR-1705
 */
export interface DebtTrapInput {
  /** Faction that issued the predatory infrastructure loan. */
  readonly lenderFaction: FactionId;
  /** Faction that received the loan. */
  readonly borrowerFaction: FactionId;
  /** Number of turns elapsed since the loan was issued (0+). */
  readonly turnsElapsed: number;
  /** Borrower's current GDP. */
  readonly borrowerGDP: number;
  /** Original loan principal amount. */
  readonly loanAmount: number;
  /** Current lifecycle status of the debt-trap loan. */
  readonly status: DebtTrapStatus;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of a debt-trap loan evaluation, including the next
 * lifecycle status and effects on both lender and borrower.
 *
 * @see FR-1705
 */
export interface DebtTrapResult {
  /** Computed next lifecycle status of the loan. */
  readonly status: DebtTrapStatus;
  /** GDP boost applied to the borrower this turn (15 during BoostPhase, 0 otherwise). */
  readonly gdpBoost: number;
  /** Whether the borrower's GDP is sufficient to service the debt. */
  readonly canServiceDebt: boolean;
  /** Effects applied to the lender faction. */
  readonly lenderEffects: {
    /** Diplomatic Influence bonus (20 on default, 0 otherwise). */
    readonly diBonus: number;
    /** Whether the lender may extract concessions (true on default). */
    readonly concessionAvailable: boolean;
  };
  /** Effects applied to the borrower faction. */
  readonly borrowerEffects: {
    /** Legitimacy penalty (−10 on default, 0 otherwise). */
    readonly legitimacyPenalty: number;
    /** Number of turns the borrower is blocked from financial markets. */
    readonly financeBlockTurns: number;
  };
  /** Human-readable explanation of the evaluation outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// FR-1706 — Currency Manipulation Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for evaluating a currency manipulation action.
 *
 * @see FR-1706
 */
export interface CurrencyManipulationInput {
  /** Faction performing the currency manipulation. */
  readonly manipulatorFaction: FactionId;
  /** Type of currency manipulation being executed. */
  readonly manipulationType: CurrencyManipulationType;
  /** Target faction (null for Devaluation, which targets self). */
  readonly targetFaction: FactionId | null;
  /** Manipulator's current treasury reserves. */
  readonly manipulatorTreasury: number;
  /** Target's current treasury reserves (for CurrencyAttack success check). */
  readonly targetTreasury: number;
  /** Manipulator's current GDP (must be in top 3 globally — caller determines eligibility). */
  readonly manipulatorGDP: number;
  /** Target's current GDP (for CurrencyAttack: attacker GDP must be > 2× target). */
  readonly targetGDP: number;
  /** Current simulation turn. */
  readonly currentTurn: TurnNumber;
}

/**
 * Computed result of a currency manipulation evaluation, including
 * success status and numerical effects on both manipulator and target.
 *
 * @see FR-1706
 */
export interface CurrencyManipulationResult {
  /** Type of currency manipulation that was evaluated. */
  readonly manipulationType: CurrencyManipulationType;
  /** Whether the manipulation succeeded. */
  readonly success: boolean;
  /** Effects applied to the manipulator faction. */
  readonly manipulatorEffects: {
    /** Trade competitiveness boost (0.1 for Devaluation, 0 otherwise). */
    readonly tradeBoost: number;
    /** Domestic inflation increase (5 for Devaluation, 0 otherwise). */
    readonly inflationIncrease: number;
    /** Treasury cost incurred (negative value; −10 for ReserveWeaponization, −20 for failed CurrencyAttack). */
    readonly treasuryCost: number;
    /** Domestic civil unrest increase from inflation/manipulation blowback. */
    readonly civilUnrestIncrease: number;
  };
  /** Effects applied to the target faction. */
  readonly targetEffects: {
    /** Direct treasury damage to the target (negative value). */
    readonly treasuryHit: number;
    /** Inflation increase imposed on the target. */
    readonly inflationIncrease: number;
    /** Civil unrest increase imposed on the target. */
    readonly civilUnrestIncrease: number;
  };
  /** Human-readable explanation of the evaluation outcome. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Neutral-Effects Factories
// ---------------------------------------------------------------------------

/**
 * Construct a zero-effect manipulator effects object.
 * @returns A manipulator effects object with all values set to 0.
 */
function neutralManipulatorEffects(): CurrencyManipulationResult['manipulatorEffects'] {
  return {
    tradeBoost: 0,
    inflationIncrease: 0,
    treasuryCost: 0,
    civilUnrestIncrease: 0,
  };
}

/**
 * Construct a zero-effect target effects object.
 * @returns A target effects object with all values set to 0.
 */
function neutralTargetEffects(): CurrencyManipulationResult['targetEffects'] {
  return {
    treasuryHit: 0,
    inflationIncrease: 0,
    civilUnrestIncrease: 0,
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine for debt-trap diplomacy evaluation and currency
 * manipulation mechanics.
 *
 * Every method is a pure function — the engine holds only a reference to
 * the immutable financial configuration section.
 *
 * @see FR-1705 — Debt-Trap Diplomacy
 * @see FR-1706 — Currency Manipulation
 */
export class FinancialWarfareEngine {
  private readonly config: FinancialWarfareConfig;

  constructor(config: FinancialWarfareConfig) {
    this.config = config;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Clamp a numeric value to the inclusive range [min, max].
   *
   * @param value - The value to clamp.
   * @param min   - Lower bound (inclusive).
   * @param max   - Upper bound (inclusive).
   * @returns The clamped value.
   */
  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // ── FR-1705 — Debt-Trap Diplomacy ──────────────────────────────────────

  /**
   * Evaluate the current state of a debt-trap loan and compute the next
   * lifecycle status along with effects on the lender and borrower.
   *
   * **Lifecycle states (exhaustive):**
   *
   * - `BoostPhase` — The borrower enjoys a GDP boost of
   *   `gdpBoostPerTurn` (15) each turn for `gdpBoostDuration` (3) turns.
   *   Once the boost duration elapses, the loan transitions to
   *   `RepaymentDue`.
   *
   * - `RepaymentDue` — The borrower must now service the debt.
   *   If `borrowerGDP ≥ loanAmount`, the loan moves to `Servicing`.
   *   Otherwise, the borrower defaults (`Defaulted`).
   *
   * - `Servicing` — Stable state; the borrower is meeting its
   *   obligations. No effects are applied.
   *
   * - `Defaulted` — The borrower suffers a legitimacy penalty
   *   (`defaultLegitimacyPenalty`, −10) and is blocked from financial
   *   markets for `defaultFinanceBlockTurns` (5) turns. The lender
   *   receives a Diplomatic Influence bonus (`lenderDIBonus`, 20) and
   *   gains concession leverage.
   *
   * - `BailedOut` — A third party rescued the borrower. No effects
   *   are applied; the loan is settled.
   *
   * @param input - Debt-trap evaluation parameters.
   * @returns The evaluation result with next status and effects.
   *
   * @see FR-1705
   */
  evaluateDebtTrapLoan(input: DebtTrapInput): DebtTrapResult {
    const dt = this.config.debtTrap;
    const canServiceDebt = input.borrowerGDP >= input.loanAmount;

    switch (input.status) {
      // ── BoostPhase ────────────────────────────────────────────────────
      case DebtTrapStatus.BoostPhase: {
        if (input.turnsElapsed < dt.gdpBoostDuration) {
          return {
            status: DebtTrapStatus.BoostPhase,
            gdpBoost: dt.gdpBoostPerTurn,
            canServiceDebt,
            lenderEffects: { diBonus: 0, concessionAvailable: false },
            borrowerEffects: { legitimacyPenalty: 0, financeBlockTurns: 0 },
            reason:
              `${input.lenderFaction} → ${input.borrowerFaction} debt-trap loan ` +
              `in BoostPhase (turn ${input.turnsElapsed + 1}/${dt.gdpBoostDuration}). ` +
              `GDP boost: +${dt.gdpBoostPerTurn}. ` +
              `Borrower GDP: ${input.borrowerGDP}, loan: ${input.loanAmount} ` +
              `(turn ${input.currentTurn}).`,
          };
        }

        // Boost duration elapsed — transition to RepaymentDue
        return {
          status: DebtTrapStatus.RepaymentDue,
          gdpBoost: 0,
          canServiceDebt,
          lenderEffects: { diBonus: 0, concessionAvailable: false },
          borrowerEffects: { legitimacyPenalty: 0, financeBlockTurns: 0 },
          reason:
            `${input.lenderFaction} → ${input.borrowerFaction} debt-trap loan ` +
            `BoostPhase ended after ${dt.gdpBoostDuration} turns. ` +
            `Transitioning to RepaymentDue. ` +
            `Borrower GDP: ${input.borrowerGDP}, loan: ${input.loanAmount} ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── RepaymentDue ──────────────────────────────────────────────────
      case DebtTrapStatus.RepaymentDue: {
        if (canServiceDebt) {
          return {
            status: DebtTrapStatus.Servicing,
            gdpBoost: 0,
            canServiceDebt: true,
            lenderEffects: { diBonus: 0, concessionAvailable: false },
            borrowerEffects: { legitimacyPenalty: 0, financeBlockTurns: 0 },
            reason:
              `${input.borrowerFaction} can service debt to ${input.lenderFaction} ` +
              `(GDP ${input.borrowerGDP} ≥ loan ${input.loanAmount}). ` +
              `Transitioning to Servicing ` +
              `(turn ${input.currentTurn}).`,
          };
        }

        // Cannot service — default
        return {
          status: DebtTrapStatus.Defaulted,
          gdpBoost: 0,
          canServiceDebt: false,
          lenderEffects: {
            diBonus: dt.lenderDIBonus,
            concessionAvailable: true,
          },
          borrowerEffects: {
            legitimacyPenalty: dt.defaultLegitimacyPenalty,
            financeBlockTurns: dt.defaultFinanceBlockTurns,
          },
          reason:
            `${input.borrowerFaction} DEFAULTED on debt to ${input.lenderFaction} ` +
            `(GDP ${input.borrowerGDP} < loan ${input.loanAmount}). ` +
            `Borrower: legitimacy ${dt.defaultLegitimacyPenalty}, ` +
            `finance blocked ${dt.defaultFinanceBlockTurns} turns. ` +
            `Lender: DI +${dt.lenderDIBonus}, concessions available ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── Servicing ─────────────────────────────────────────────────────
      case DebtTrapStatus.Servicing: {
        return {
          status: DebtTrapStatus.Servicing,
          gdpBoost: 0,
          canServiceDebt,
          lenderEffects: { diBonus: 0, concessionAvailable: false },
          borrowerEffects: { legitimacyPenalty: 0, financeBlockTurns: 0 },
          reason:
            `${input.borrowerFaction} is servicing debt to ${input.lenderFaction}. ` +
            `Stable state — no additional effects ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── Defaulted ─────────────────────────────────────────────────────
      case DebtTrapStatus.Defaulted: {
        return {
          status: DebtTrapStatus.Defaulted,
          gdpBoost: 0,
          canServiceDebt,
          lenderEffects: {
            diBonus: dt.lenderDIBonus,
            concessionAvailable: true,
          },
          borrowerEffects: {
            legitimacyPenalty: dt.defaultLegitimacyPenalty,
            financeBlockTurns: dt.defaultFinanceBlockTurns,
          },
          reason:
            `${input.borrowerFaction} remains in DEFAULT on debt to ` +
            `${input.lenderFaction}. ` +
            `Borrower: legitimacy ${dt.defaultLegitimacyPenalty}, ` +
            `finance blocked ${dt.defaultFinanceBlockTurns} turns. ` +
            `Lender: DI +${dt.lenderDIBonus}, concessions available ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── BailedOut ─────────────────────────────────────────────────────
      case DebtTrapStatus.BailedOut: {
        return {
          status: DebtTrapStatus.BailedOut,
          gdpBoost: 0,
          canServiceDebt,
          lenderEffects: { diBonus: 0, concessionAvailable: false },
          borrowerEffects: { legitimacyPenalty: 0, financeBlockTurns: 0 },
          reason:
            `${input.borrowerFaction} debt to ${input.lenderFaction} was ` +
            `resolved by third-party bailout. No further effects ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── Exhaustive guard ──────────────────────────────────────────────
      default: {
        const _exhaustive: never = input.status;
        throw new Error(`Unknown DebtTrapStatus: ${_exhaustive as string}`);
      }
    }
  }

  // ── FR-1706 — Currency Manipulation ────────────────────────────────────

  /**
   * Evaluate a currency manipulation action and compute effects on both
   * the manipulator and the target.
   *
   * **Action types (exhaustive):**
   *
   * - `Devaluation` — Always succeeds. The manipulator gains a trade
   *   competitiveness boost (`devaluationTradeBoost`, 0.1) but suffers
   *   domestic inflation (`devaluationInflationIncrease`, 5) and a civil
   *   unrest increase of 3. Self-targeting; no effects on a target.
   *
   * - `ReserveWeaponization` — Always succeeds. The manipulator spends
   *   reserves (`reserveWeaponizationSpend`, −10) per turn to restrict
   *   the target's access to the global financial system (downstream
   *   chokepoint effect). No direct numerical target effects in this
   *   engine; the restriction is applied downstream.
   *
   * - `CurrencyAttack` — Requires both:
   *     1. `manipulatorGDP > 2 × targetGDP`, and
   *     2. `manipulatorTreasury ≥ currencyAttackReservesRequired` (20).
   *
   *   **Success (both met):** target suffers treasury hit (−15),
   *   inflation (+5), and civil unrest (+5).
   *
   *   **Failure (targetTreasury > 50):** attack absorbed; manipulator
   *   loses invested reserves (−20).
   *
   *   **Failure (GDP not > 2×):** attack ineligible; no effects.
   *
   * @param input - Currency manipulation evaluation parameters.
   * @returns The evaluation result with success status and effects.
   *
   * @see FR-1706
   */
  evaluateCurrencyManipulation(
    input: CurrencyManipulationInput,
  ): CurrencyManipulationResult {
    const cm = this.config.currencyManipulation;

    switch (input.manipulationType) {
      // ── Devaluation ───────────────────────────────────────────────────
      case CurrencyManipulationType.Devaluation: {
        const civilUnrestFromInflation = 3;

        return {
          manipulationType: CurrencyManipulationType.Devaluation,
          success: true,
          manipulatorEffects: {
            tradeBoost: cm.devaluationTradeBoost,
            inflationIncrease: cm.devaluationInflationIncrease,
            treasuryCost: 0,
            civilUnrestIncrease: civilUnrestFromInflation,
          },
          targetEffects: neutralTargetEffects(),
          reason:
            `${input.manipulatorFaction} devalued its currency. ` +
            `Trade boost: +${cm.devaluationTradeBoost}, ` +
            `inflation: +${cm.devaluationInflationIncrease}, ` +
            `civil unrest: +${civilUnrestFromInflation}. ` +
            `Self-targeting — no external target effects ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── ReserveWeaponization ──────────────────────────────────────────
      case CurrencyManipulationType.ReserveWeaponization: {
        return {
          manipulationType: CurrencyManipulationType.ReserveWeaponization,
          success: true,
          manipulatorEffects: {
            ...neutralManipulatorEffects(),
            treasuryCost: cm.reserveWeaponizationSpend,
          },
          targetEffects: neutralTargetEffects(),
          reason:
            `${input.manipulatorFaction} weaponised reserves against ` +
            `${input.targetFaction ?? 'unknown'}. ` +
            `Treasury cost: ${cm.reserveWeaponizationSpend}/turn. ` +
            `Target's access to global financial system restricted ` +
            `(downstream chokepoint effect) ` +
            `(turn ${input.currentTurn}).`,
        };
      }

      // ── CurrencyAttack ────────────────────────────────────────────────
      case CurrencyManipulationType.CurrencyAttack: {
        return this.evaluateCurrencyAttack(input, cm);
      }

      // ── Exhaustive guard ──────────────────────────────────────────────
      default: {
        const _exhaustive: never = input.manipulationType;
        throw new Error(
          `Unknown CurrencyManipulationType: ${_exhaustive as string}`,
        );
      }
    }
  }

  // ── CurrencyAttack sub-evaluation ──────────────────────────────────────

  /**
   * Evaluate a direct currency attack against a target faction.
   *
   * This private helper is extracted from `evaluateCurrencyManipulation`
   * for readability. It handles the three possible CurrencyAttack
   * outcomes: GDP-ineligible, target-absorbed, or success.
   *
   * @param input - The full currency manipulation input.
   * @param cm    - The currency manipulation config section.
   * @returns The currency attack evaluation result.
   *
   * @see FR-1706
   */
  private evaluateCurrencyAttack(
    input: CurrencyManipulationInput,
    cm: FinancialWarfareConfig['currencyManipulation'],
  ): CurrencyManipulationResult {
    const gdpSuperior = input.manipulatorGDP > 2 * input.targetGDP;
    const hasReserves =
      input.manipulatorTreasury >= cm.currencyAttackReservesRequired;

    // ── Failure: GDP not > 2× target ──────────────────────────────────
    if (!gdpSuperior) {
      return {
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        success: false,
        manipulatorEffects: neutralManipulatorEffects(),
        targetEffects: neutralTargetEffects(),
        reason:
          `${input.manipulatorFaction} currency attack on ` +
          `${input.targetFaction ?? 'unknown'} FAILED — ` +
          `GDP ${input.manipulatorGDP} is not > 2× target GDP ` +
          `${input.targetGDP}. No effects ` +
          `(turn ${input.currentTurn}).`,
      };
    }

    // ── Failure: GDP sufficient but target treasury absorbs the attack ─
    if (!hasReserves || input.targetTreasury > 50) {
      const treasuryLoss = -20;
      return {
        manipulationType: CurrencyManipulationType.CurrencyAttack,
        success: false,
        manipulatorEffects: {
          ...neutralManipulatorEffects(),
          treasuryCost: FinancialWarfareEngine.clamp(treasuryLoss, -100, 0),
        },
        targetEffects: neutralTargetEffects(),
        reason:
          `${input.manipulatorFaction} currency attack on ` +
          `${input.targetFaction ?? 'unknown'} FAILED — ` +
          (input.targetTreasury > 50
            ? `target treasury ${input.targetTreasury} > 50 absorbed the attack`
            : `insufficient reserves ${input.manipulatorTreasury} < ` +
              `${cm.currencyAttackReservesRequired} required`) +
          `. Manipulator lost ${treasuryLoss} invested treasury ` +
          `(turn ${input.currentTurn}).`,
      };
    }

    // ── Success: GDP > 2× AND reserves sufficient AND target vulnerable ─
    const targetTreasuryHit = -15;
    const targetInflation = 5;
    const targetUnrest = 5;

    return {
      manipulationType: CurrencyManipulationType.CurrencyAttack,
      success: true,
      manipulatorEffects: neutralManipulatorEffects(),
      targetEffects: {
        treasuryHit: FinancialWarfareEngine.clamp(targetTreasuryHit, -100, 0),
        inflationIncrease: FinancialWarfareEngine.clamp(
          targetInflation,
          0,
          100,
        ),
        civilUnrestIncrease: FinancialWarfareEngine.clamp(
          targetUnrest,
          0,
          100,
        ),
      },
      reason:
        `${input.manipulatorFaction} currency attack on ` +
        `${input.targetFaction ?? 'unknown'} SUCCEEDED — ` +
        `GDP ${input.manipulatorGDP} > 2× target GDP ${input.targetGDP}, ` +
        `reserves ${input.manipulatorTreasury} ≥ ` +
        `${cm.currencyAttackReservesRequired}. ` +
        `Target: treasury ${targetTreasuryHit}, ` +
        `inflation +${targetInflation}, unrest +${targetUnrest} ` +
        `(turn ${input.currentTurn}).`,
    };
  }
}
