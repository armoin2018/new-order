/**
 * National Debt Engine — FR-7003
 *
 * Pure-function engine that tracks national debt accumulation,
 * interest payments, credit ratings, and their cascading effects
 * on GDP, stability, and borrowing costs.
 *
 * Debt increases from: military spending, disaster response, deficits.
 * Debt decreases from: trade surpluses, austerity, economic growth.
 */

import type { FactionId } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';
import type { NationalDebt, CreditRating } from '@/data/types/economic-state.types';
import { debtConfig } from './config/macro-economy';

// ─────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────

/** Create initial national debt state from GDP and configured debt-to-GDP ratio. */
export function initNationalDebt(factionId: FactionId, gdp: number): NationalDebt {
  const debtToGDP = debtConfig.initialDebtToGDP[factionId] ?? 50;
  const totalDebt = (debtToGDP / 100) * gdp;
  const rating = computeCreditRating(debtToGDP);
  const interestRate = debtConfig.interestRates[rating] ?? 0.004;

  return {
    totalDebt: Math.round(totalDebt),
    debtToGDP: Math.round(debtToGDP * 10) / 10,
    interestPayments: Math.round(totalDebt * interestRate * 10) / 10,
    creditRating: rating,
    trajectory: 'stable',
    consecutiveDeficits: 0,
  };
}

// ─────────────────────────────────────────────────────────
// Credit Rating Calculation
// ─────────────────────────────────────────────────────────

/** Compute credit rating from debt-to-GDP ratio. */
export function computeCreditRating(debtToGDP: number): CreditRating {
  for (const tier of debtConfig.creditRatingThresholds) {
    if (debtToGDP <= tier.maxDebtToGDP) return tier.rating;
  }
  return debtConfig.defaultRating;
}

/** Get the ordinal index of a credit rating (lower = better). */
function ratingOrdinal(rating: CreditRating): number {
  const order: CreditRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'];
  return order.indexOf(rating);
}

// ─────────────────────────────────────────────────────────
// Per-Turn Debt Processing
// ─────────────────────────────────────────────────────────

export interface DebtTurnInput {
  /** Current debt state. */
  currentDebt: NationalDebt;
  /** Current nation state. */
  nationState: NationState;
  /** Treasury change this turn (positive = surplus, negative = deficit). */
  turnTreasuryDelta: number;
  /** Military spending this turn (billions). */
  militarySpending: number;
  /** Disaster response costs this turn (billions). */
  disasterCosts: number;
  /** Trade balance (exports − imports). */
  tradeBalance: number;
}

export interface DebtTurnResult {
  /** Updated debt state. */
  debt: NationalDebt;
  /** Interest cost deducted from treasury this turn. */
  interestCost: number;
  /** Stability impact from debt changes. */
  stabilityDelta: number;
  /** GDP growth penalty from high debt. */
  gdpGrowthPenalty: number;
  /** Whether credit rating changed this turn. */
  ratingChanged: boolean;
  /** Headline text if significant debt event occurred. */
  headline: string | null;
}

/**
 * Process one turn of national debt changes for a single nation.
 */
export function processDebtTurn(input: DebtTurnInput): DebtTurnResult {
  const { currentDebt, nationState, turnTreasuryDelta, militarySpending, disasterCosts, tradeBalance } = input;
  const cfg = debtConfig;

  // --- Debt changes ---
  let debtDelta = 0;

  // Deficit spending increases debt
  if (turnTreasuryDelta < 0) {
    debtDelta += Math.abs(turnTreasuryDelta);
  }

  // Military spending adds to debt (fraction)
  debtDelta += militarySpending * cfg.militaryDebtFactor;

  // Disaster costs directly add to debt
  debtDelta += disasterCosts * cfg.disasterDebtFactor;

  // Trade surplus reduces debt; deficit increases it
  if (tradeBalance > 0) {
    debtDelta -= tradeBalance * 0.05; // 5% of surplus goes to debt repayment
  } else {
    debtDelta += Math.abs(tradeBalance) * 0.02; // trade deficit adds to debt
  }

  // GDP growth naturally reduces debt burden (via ratio)
  // but raw debt doesn't shrink from GDP growth alone

  // Interest payments
  const interestRate = cfg.interestRates[currentDebt.creditRating] ?? 0.004;
  const interestCost = Math.round(currentDebt.totalDebt * interestRate * 10) / 10;

  // Apply changes
  const newTotalDebt = Math.max(0, currentDebt.totalDebt + debtDelta);
  const gdp = Math.max(1, nationState.gdp); // prevent div by 0
  const newDebtToGDP = Math.round((newTotalDebt / gdp) * 100 * 10) / 10;

  // Credit rating
  const oldRating = currentDebt.creditRating;
  const newRating = computeCreditRating(newDebtToGDP);
  const ratingChanged = oldRating !== newRating;

  // Trajectory
  const trajectory: NationalDebt['trajectory'] =
    debtDelta > 1 ? 'increasing' :
    debtDelta < -1 ? 'decreasing' : 'stable';

  // Consecutive deficits
  const consecutiveDeficits = turnTreasuryDelta < 0
    ? currentDebt.consecutiveDeficits + 1
    : 0;

  // --- Cascading effects ---

  // Stability penalty from credit downgrade
  let stabilityDelta = 0;
  if (ratingChanged) {
    const oldOrd = ratingOrdinal(oldRating);
    const newOrd = ratingOrdinal(newRating);
    if (newOrd > oldOrd) {
      // Downgrade
      stabilityDelta += (newOrd - oldOrd) * cfg.stabilityPenaltyPerDowngrade;
    }
  }

  // Stability penalty from excessive consecutive deficits
  if (consecutiveDeficits > cfg.maxConsecutiveDeficits) {
    stabilityDelta -= 3; // debt crisis
  }

  // GDP growth penalty from high debt
  let gdpGrowthPenalty = 0;
  if (newDebtToGDP > 100) {
    gdpGrowthPenalty = Math.floor((newDebtToGDP - 100) / 10) * cfg.gdpPenaltyPer10PctAbove100;
  }

  // Generate headline for significant events
  let headline: string | null = null;
  if (ratingChanged && ratingOrdinal(newRating) > ratingOrdinal(oldRating)) {
    headline = `Credit downgrade: ${nationState.factionId} now rated ${newRating} (was ${oldRating})`;
  } else if (consecutiveDeficits >= cfg.maxConsecutiveDeficits) {
    headline = `Debt crisis looms in ${nationState.factionId}: ${consecutiveDeficits} consecutive deficits`;
  } else if (newDebtToGDP > 200) {
    headline = `${nationState.factionId} debt surpasses 200% of GDP — economic collapse risk`;
  }

  return {
    debt: {
      totalDebt: Math.round(newTotalDebt),
      debtToGDP: newDebtToGDP,
      interestPayments: interestCost,
      creditRating: newRating,
      trajectory,
      consecutiveDeficits,
    },
    interestCost,
    stabilityDelta,
    gdpGrowthPenalty,
    ratingChanged,
    headline,
  };
}

/**
 * Compute the total debt across all factions (for global metrics).
 */
export function computeGlobalDebt(
  debts: Record<string, NationalDebt>,
): { totalGlobalDebt: number; avgDebtToGDP: number } {
  const entries = Object.values(debts);
  if (entries.length === 0) return { totalGlobalDebt: 0, avgDebtToGDP: 0 };

  const totalGlobalDebt = entries.reduce((sum, d) => sum + d.totalDebt, 0);
  const avgDebtToGDP = entries.reduce((sum, d) => sum + d.debtToGDP, 0) / entries.length;

  return {
    totalGlobalDebt: Math.round(totalGlobalDebt),
    avgDebtToGDP: Math.round(avgDebtToGDP * 10) / 10,
  };
}
