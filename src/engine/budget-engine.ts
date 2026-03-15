/**
 * Turn Budget & Investment Allocation Engine
 *
 * Pure-function module that drives per-turn budget allocation,
 * investment level classification, effect multiplier computation,
 * and end-of-turn budget processing.
 *
 * All functions are **pure** — no side effects, no mutation of inputs.
 *
 * @module budget-engine
 * @see FR-3901 — Budget Dimensions
 * @see FR-3902 — Investment Level Presets
 * @see FR-3903 — AI Budget Recommendations
 * @see FR-3904 — Effect Multiplier Scaling
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';
import {
  BUDGET_DIMENSIONS,
  type BudgetDimension,
  type BudgetState,
  type DimensionAllocation,
  type InvestmentLevel,
  type TurnBudgetAllocation,
} from '@/data/types/budget.types';

// ---------------------------------------------------------------------------
// Config shorthand
// ---------------------------------------------------------------------------

const cfg = GAME_CONFIG.budget;

// ---------------------------------------------------------------------------
// initializeBudgetState
// ---------------------------------------------------------------------------

/**
 * Create an initial {@link BudgetState} with default allocations for every
 * supplied nation.
 *
 * @param nationIds — The faction IDs to initialise budgets for.
 * @returns A fresh BudgetState with default percentages from config.
 * @see FR-3901
 */
export function initializeBudgetState(nationIds: FactionId[]): BudgetState {
  const currentAllocations = {} as Record<FactionId, TurnBudgetAllocation>;
  const history = {} as Record<FactionId, TurnBudgetAllocation[]>;

  for (const id of nationIds) {
    currentAllocations[id] = createAllocation(id, 1 as TurnNumber, 0, { ...cfg.defaultAllocation });
    history[id] = [];
  }

  return { currentAllocations, history };
}

// ---------------------------------------------------------------------------
// createAllocation
// ---------------------------------------------------------------------------

/**
 * Build a {@link TurnBudgetAllocation} from a set of percentage inputs.
 *
 * Any unallocated remainder (100 − Σ supplied) is automatically added to
 * `strategicReserves`. Percentages are clamped to [0, 100].
 *
 * @param nationCode — The faction this allocation belongs to.
 * @param turn       — Current turn number.
 * @param treasury   — Available treasury for this turn.
 * @param percentages — Partial map of dimension → percentage (0–100).
 * @returns A fully-populated TurnBudgetAllocation.
 * @see FR-3901, FR-3902
 */
export function createAllocation(
  nationCode: FactionId,
  turn: TurnNumber,
  treasury: number,
  percentages: Partial<Record<BudgetDimension, number>>,
): TurnBudgetAllocation {
  // Build a complete percentages map — missing dimensions default to 0.
  const full: Record<BudgetDimension, number> = {} as Record<BudgetDimension, number>;
  let total = 0;

  for (const dim of BUDGET_DIMENSIONS) {
    const raw = percentages[dim] ?? 0;
    const clamped = Math.max(0, Math.min(100, raw));
    full[dim] = clamped;
    total += clamped;
  }

  // Assign unallocated remainder to strategicReserves (FR-3901).
  if (total < cfg.maxTotalAllocation) {
    full.strategicReserves += cfg.maxTotalAllocation - total;
  }

  // Cap overshoot: proportionally scale if total > 100.
  const finalTotal = BUDGET_DIMENSIONS.reduce((s, d) => s + full[d], 0);
  if (finalTotal > cfg.maxTotalAllocation) {
    const scale = cfg.maxTotalAllocation / finalTotal;
    for (const dim of BUDGET_DIMENSIONS) {
      full[dim] = Math.round(full[dim] * scale * 100) / 100;
    }
  }

  // Build per-dimension allocation entries.
  const allocations = {} as Record<BudgetDimension, DimensionAllocation>;
  for (const dim of BUDGET_DIMENSIONS) {
    allocations[dim] = {
      percentage: full[dim],
      absoluteAmount: (full[dim] / 100) * treasury,
      effectMultiplier: computeEffectMultiplier(full[dim], dim),
    };
  }

  return {
    nationCode,
    turn,
    treasuryAvailable: treasury,
    allocations,
    aiRecommendation: null,
  };
}

// ---------------------------------------------------------------------------
// validateAllocation
// ---------------------------------------------------------------------------

/**
 * Validate a percentages record for correctness.
 *
 * Checks:
 * - All 8 dimensions are present.
 * - No value is negative.
 * - Total does not exceed 100%.
 *
 * @param percentages — A record to validate.
 * @returns An object with `valid`, `errors`, and `remaining` fields.
 * @see FR-3901
 */
export function validateAllocation(
  percentages: Record<string, number>,
): { valid: boolean; errors: string[]; remaining: number } {
  const errors: string[] = [];

  // Check for missing dimensions.
  for (const dim of BUDGET_DIMENSIONS) {
    if (!(dim in percentages)) {
      errors.push(`Missing dimension: ${dim}`);
    }
  }

  // Check for negative values.
  for (const [key, value] of Object.entries(percentages)) {
    if (value < 0) {
      errors.push(`Negative value for ${key}: ${value}`);
    }
  }

  // Sum and check total.
  const total = Object.values(percentages).reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total > cfg.maxTotalAllocation) {
    errors.push(`Total allocation ${total}% exceeds maximum ${cfg.maxTotalAllocation}%`);
  }

  const remaining = Math.max(0, cfg.maxTotalAllocation - total);

  return { valid: errors.length === 0, errors, remaining };
}

// ---------------------------------------------------------------------------
// getInvestmentLevel
// ---------------------------------------------------------------------------

/**
 * Map a percentage (0–100) to the closest {@link InvestmentLevel} preset.
 *
 * Thresholds are taken from `budgetConfig.investmentLevels`.
 *
 * @param percentage — The allocation percentage for a dimension.
 * @returns The closest InvestmentLevel.
 * @see FR-3902
 */
export function getInvestmentLevel(percentage: number): InvestmentLevel {
  const levels = cfg.investmentLevels;
  if (percentage <= 0) return 'none';
  if (percentage < (levels.none + levels.minimal) / 2) return 'none';
  if (percentage < (levels.minimal + levels.standard) / 2) return 'minimal';
  if (percentage < (levels.standard + levels.priority) / 2) return 'standard';
  if (percentage < (levels.priority + levels.maximum) / 2) return 'priority';
  return 'maximum';
}

// ---------------------------------------------------------------------------
// computeEffectMultiplier
// ---------------------------------------------------------------------------

/**
 * Compute the effect multiplier for a given percentage and dimension.
 *
 * The multiplier is derived from the percentage mapped onto the
 * `effectMultiplierScale` range, then scaled by the dimension's `effectBase`.
 *
 * @param percentage — The allocation percentage (0–100).
 * @param dimension  — The budget dimension key.
 * @returns A non-negative effect multiplier.
 * @see FR-3904
 */
export function computeEffectMultiplier(
  percentage: number,
  dimension: BudgetDimension,
): number {
  const scale = cfg.effectMultiplierScale;
  const dimCfg = cfg.dimensions[dimension];

  // Map percentage (0–100) → raw multiplier (0–max).
  const t = Math.max(0, Math.min(100, percentage)) / 100;
  let raw: number;
  if (t <= 0) {
    raw = scale.zero;
  } else if (t <= 0.25) {
    raw = scale.zero + (scale.low - scale.zero) * (t / 0.25);
  } else if (t <= 0.5) {
    raw = scale.low + (scale.medium - scale.low) * ((t - 0.25) / 0.25);
  } else if (t <= 0.75) {
    raw = scale.medium + (scale.high - scale.medium) * ((t - 0.5) / 0.25);
  } else {
    raw = scale.high + (scale.max - scale.high) * ((t - 0.75) / 0.25);
  }

  return Math.round(raw * dimCfg.effectBase * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// applyBudgetToTreasury
// ---------------------------------------------------------------------------

/**
 * Deduct the total allocated spending from the current treasury.
 *
 * @param allocation     — The turn budget allocation to apply.
 * @param currentTreasury — The nation's current treasury balance.
 * @returns `newTreasury` and `spent` amounts.
 * @see FR-3901
 */
export function applyBudgetToTreasury(
  allocation: TurnBudgetAllocation,
  currentTreasury: number,
): { newTreasury: number; spent: number } {
  let spent = 0;
  for (const dim of BUDGET_DIMENSIONS) {
    spent += allocation.allocations[dim].absoluteAmount;
  }

  // Cannot spend more than available.
  spent = Math.min(spent, currentTreasury);
  const newTreasury = currentTreasury - spent;
  return { newTreasury: Math.round(newTreasury * 100) / 100, spent: Math.round(spent * 100) / 100 };
}

// ---------------------------------------------------------------------------
// processEndOfTurnBudget
// ---------------------------------------------------------------------------

/**
 * End-of-turn budget processing for all nations.
 *
 * For each nation in the supplied `nationStates`:
 * 1. Look up (or create) the current turn allocation.
 * 2. Apply it via {@link applyBudgetToTreasury}.
 * 3. Append the allocation to the nation's history.
 * 4. Return the updated {@link BudgetState}.
 *
 * @param state        — Current BudgetState.
 * @param nationStates — Map of faction → treasury balances.
 * @param turn         — Current turn number.
 * @returns Updated BudgetState with history appended.
 * @see FR-3901, FR-3904
 */
export function processEndOfTurnBudget(
  state: BudgetState,
  nationStates: Record<FactionId, { treasury: number }>,
  turn: TurnNumber,
): BudgetState {
  const newAllocations = { ...state.currentAllocations };
  const newHistory = { ...state.history };

  for (const nationId of Object.keys(nationStates) as FactionId[]) {
    const { treasury } = nationStates[nationId];

    // Use existing allocation or generate one with defaults.
    const allocation =
      newAllocations[nationId] ??
      createAllocation(nationId, turn, treasury, { ...cfg.defaultAllocation });

    // Re-create with current treasury so absoluteAmounts are accurate.
    const updated = createAllocation(
      nationId,
      turn,
      treasury,
      Object.fromEntries(
        BUDGET_DIMENSIONS.map((d) => [d, allocation.allocations[d].percentage]),
      ) as Record<BudgetDimension, number>,
    );

    newAllocations[nationId] = updated;

    // Append to history.
    const historyList = [...(newHistory[nationId] ?? []), updated];
    newHistory[nationId] = historyList;
  }

  return { currentAllocations: newAllocations, history: newHistory };
}
