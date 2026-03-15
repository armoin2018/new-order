import { describe, it, expect } from 'vitest';
import {
  initializeBudgetState,
  createAllocation,
  validateAllocation,
  getInvestmentLevel,
  computeEffectMultiplier,
  applyBudgetToTreasury,
  processEndOfTurnBudget,
} from '@/engine/budget-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ALL_FACTIONS, FactionId } from '@/data/types';
import {
  BUDGET_DIMENSIONS,
  type BudgetDimension,
  type TurnBudgetAllocation,
  type BudgetState,
} from '@/data/types/budget.types';
import type { TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cfg = GAME_CONFIG.budget;

/** Shortcut: typed turn number (branded). */
function turn(n: number): TurnNumber {
  return n as TurnNumber;
}

/** Build a full default-percentages record from config. */
function defaultPercentages(): Record<BudgetDimension, number> {
  return { ...cfg.defaultAllocation } as Record<BudgetDimension, number>;
}

/** Sum all dimension percentages from an allocation. */
function sumPercentages(alloc: TurnBudgetAllocation): number {
  return BUDGET_DIMENSIONS.reduce(
    (sum, d) => sum + alloc.allocations[d].percentage,
    0,
  );
}

// ===========================================================================
// initializeBudgetState
// ===========================================================================

describe('initializeBudgetState', () => {
  const nationIds = ALL_FACTIONS as unknown as FactionId[];
  const state = initializeBudgetState(nationIds);

  it('creates currentAllocations for all supplied nations', () => {
    expect(Object.keys(state.currentAllocations)).toHaveLength(nationIds.length);
  });

  it('creates an empty history array for every nation', () => {
    for (const id of nationIds) {
      expect(state.history[id]).toEqual([]);
    }
  });

  it('each allocation has all 8 dimensions', () => {
    for (const id of nationIds) {
      const alloc = state.currentAllocations[id];
      for (const dim of BUDGET_DIMENSIONS) {
        expect(alloc.allocations[dim]).toBeDefined();
      }
    }
  });

  it('default percentages sum to exactly 100', () => {
    for (const id of nationIds) {
      const total = sumPercentages(state.currentAllocations[id]);
      expect(total).toBe(100);
    }
  });

  it('each default allocation has treasury 0', () => {
    for (const id of nationIds) {
      expect(state.currentAllocations[id].treasuryAvailable).toBe(0);
    }
  });

  it('military defaults to config value', () => {
    const alloc = state.currentAllocations[FactionId.US];
    expect(alloc.allocations.military.percentage).toBe(cfg.defaultAllocation.military);
  });

  it('works with a single nation', () => {
    const single = initializeBudgetState([FactionId.China]);
    expect(Object.keys(single.currentAllocations)).toHaveLength(1);
    expect(single.history[FactionId.China]).toEqual([]);
  });

  it('works with an empty array', () => {
    const empty = initializeBudgetState([]);
    expect(Object.keys(empty.currentAllocations)).toHaveLength(0);
  });
});

// ===========================================================================
// createAllocation
// ===========================================================================

describe('createAllocation', () => {
  it('creates a valid allocation with all dimensions', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, defaultPercentages());
    for (const dim of BUDGET_DIMENSIONS) {
      expect(alloc.allocations[dim]).toBeDefined();
      expect(alloc.allocations[dim].percentage).toBeGreaterThanOrEqual(0);
    }
  });

  it('percentages sum to 100 with default input', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, defaultPercentages());
    expect(sumPercentages(alloc)).toBe(100);
  });

  it('assigns correct absolute amounts based on treasury', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, defaultPercentages());
    // military = 20% of 1000 = 200
    expect(alloc.allocations.military.absoluteAmount).toBe(200);
  });

  it('routes unallocated remainder to strategicReserves', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, { military: 50 });
    // Only military specified (50%), rest goes to strategicReserves
    expect(alloc.allocations.strategicReserves.percentage).toBe(50);
    expect(sumPercentages(alloc)).toBeCloseTo(100);
  });

  it('handles partial input — missing dimensions default to 0 then reserves absorb', () => {
    const alloc = createAllocation(FactionId.China, turn(2), 500, {
      military: 30,
      diplomacy: 20,
    });
    expect(alloc.allocations.military.percentage).toBe(30);
    expect(alloc.allocations.diplomacy.percentage).toBe(20);
    expect(alloc.allocations.strategicReserves.percentage).toBe(50);
  });

  it('clamps negative percentages to 0', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, { military: -10 });
    expect(alloc.allocations.military.percentage).toBe(0);
  });

  it('clamps values above 100', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, { military: 150 });
    // Should be clamped and adjusted
    expect(alloc.allocations.military.percentage).toBeLessThanOrEqual(100);
  });

  it('sets nationCode correctly', () => {
    const alloc = createAllocation(FactionId.Russia, turn(3), 100, {});
    expect(alloc.nationCode).toBe(FactionId.Russia);
  });

  it('sets turn correctly', () => {
    const alloc = createAllocation(FactionId.EU, turn(5), 100, {});
    expect(alloc.turn).toBe(5);
  });

  it('sets treasuryAvailable correctly', () => {
    const alloc = createAllocation(FactionId.Japan, turn(1), 2500, {});
    expect(alloc.treasuryAvailable).toBe(2500);
  });

  it('aiRecommendation defaults to null', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, {});
    expect(alloc.aiRecommendation).toBeNull();
  });

  it('computes effectMultiplier for each dimension', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, defaultPercentages());
    for (const dim of BUDGET_DIMENSIONS) {
      expect(alloc.allocations[dim].effectMultiplier).toBeGreaterThanOrEqual(0);
    }
  });

  it('absolute amounts sum to treasury when total is 100%', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 5000, defaultPercentages());
    const totalAbs = BUDGET_DIMENSIONS.reduce(
      (sum, d) => sum + alloc.allocations[d].absoluteAmount,
      0,
    );
    expect(totalAbs).toBeCloseTo(5000);
  });

  it('absolute amounts are 0 when treasury is 0', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 0, defaultPercentages());
    for (const dim of BUDGET_DIMENSIONS) {
      expect(alloc.allocations[dim].absoluteAmount).toBe(0);
    }
  });
});

// ===========================================================================
// validateAllocation
// ===========================================================================

describe('validateAllocation', () => {
  it('accepts a valid complete allocation', () => {
    const result = validateAllocation(defaultPercentages());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.remaining).toBe(0);
  });

  it('reports remaining percentage when total < 100', () => {
    const partial = { ...defaultPercentages() };
    partial.military = 0;
    partial.strategicReserves = 0;
    const result = validateAllocation(partial);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('reports error when total > 100', () => {
    const over = { ...defaultPercentages() };
    over.military = 80; // push total well above 100
    const result = validateAllocation(over);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds'))).toBe(true);
  });

  it('reports missing dimensions', () => {
    const missing = { military: 50 } as Record<string, number>;
    const result = validateAllocation(missing);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing dimension'))).toBe(true);
  });

  it('reports all missing dimensions individually', () => {
    const empty = {} as Record<string, number>;
    const result = validateAllocation(empty);
    // All 8 dimensions should be missing
    const missingErrors = result.errors.filter((e) => e.includes('Missing dimension'));
    expect(missingErrors).toHaveLength(8);
  });

  it('reports negative values', () => {
    const neg = { ...defaultPercentages(), military: -5 };
    const result = validateAllocation(neg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Negative'))).toBe(true);
  });

  it('remaining is 0 when total equals max', () => {
    const result = validateAllocation(defaultPercentages());
    expect(result.remaining).toBe(0);
  });

  it('remaining is 0 when total exceeds max (clamped)', () => {
    const over = { ...defaultPercentages() };
    over.military = 90;
    const result = validateAllocation(over);
    expect(result.remaining).toBe(0);
  });

  it('detects both missing and negative errors simultaneously', () => {
    const bad = { military: -10 } as Record<string, number>;
    const result = validateAllocation(bad);
    const hasMissing = result.errors.some((e) => e.includes('Missing'));
    const hasNegative = result.errors.some((e) => e.includes('Negative'));
    expect(hasMissing).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

// ===========================================================================
// getInvestmentLevel
// ===========================================================================

describe('getInvestmentLevel', () => {
  it('maps 0 to "none"', () => {
    expect(getInvestmentLevel(0)).toBe('none');
  });

  it('maps negative to "none"', () => {
    expect(getInvestmentLevel(-5)).toBe('none');
  });

  it('maps 5 to "minimal"', () => {
    expect(getInvestmentLevel(5)).toBe('minimal');
  });

  it('maps 10 to "minimal"', () => {
    expect(getInvestmentLevel(10)).toBe('minimal');
  });

  it('maps 25 to "standard"', () => {
    expect(getInvestmentLevel(25)).toBe('standard');
  });

  it('maps 20 to "standard"', () => {
    expect(getInvestmentLevel(20)).toBe('standard');
  });

  it('maps 50 to "priority"', () => {
    expect(getInvestmentLevel(50)).toBe('priority');
  });

  it('maps 40 to "priority"', () => {
    expect(getInvestmentLevel(40)).toBe('priority');
  });

  it('maps 75 to "maximum"', () => {
    expect(getInvestmentLevel(75)).toBe('maximum');
  });

  it('maps 100 to "maximum"', () => {
    expect(getInvestmentLevel(100)).toBe('maximum');
  });

  it('maps 63 to "maximum"', () => {
    // (50+75)/2 = 62.5, so 63 > threshold → maximum
    expect(getInvestmentLevel(63)).toBe('maximum');
  });

  it('maps 37 to "standard" or "priority"', () => {
    // (25+50)/2 = 37.5, so 37 < threshold → standard
    expect(getInvestmentLevel(37)).toBe('standard');
  });
});

// ===========================================================================
// computeEffectMultiplier
// ===========================================================================

describe('computeEffectMultiplier', () => {
  it('returns 0 for 0% allocation', () => {
    expect(computeEffectMultiplier(0, 'military')).toBe(0);
  });

  it('returns positive value for positive allocation', () => {
    expect(computeEffectMultiplier(25, 'military')).toBeGreaterThan(0);
  });

  it('returns max multiplier at 100%', () => {
    const result = computeEffectMultiplier(100, 'military');
    expect(result).toBe(cfg.effectMultiplierScale.max * cfg.dimensions.military.effectBase);
  });

  it('scales differently per dimension effectBase', () => {
    const milMult = computeEffectMultiplier(50, 'military');
    const eduMult = computeEffectMultiplier(50, 'education');
    // military effectBase=1.0, education=0.8, so mil > edu
    expect(milMult).toBeGreaterThan(eduMult);
  });

  it('social programs have lower multiplier than military at same %', () => {
    const milMult = computeEffectMultiplier(30, 'military');
    const socMult = computeEffectMultiplier(30, 'socialPrograms');
    expect(milMult).toBeGreaterThan(socMult);
  });

  it('strategic reserves have the lowest effectBase', () => {
    const resMult = computeEffectMultiplier(50, 'strategicReserves');
    for (const dim of BUDGET_DIMENSIONS) {
      if (dim !== 'strategicReserves') {
        const other = computeEffectMultiplier(50, dim);
        expect(other).toBeGreaterThanOrEqual(resMult);
      }
    }
  });

  it('higher percentage yields higher multiplier for same dimension', () => {
    const low = computeEffectMultiplier(10, 'technology');
    const high = computeEffectMultiplier(80, 'technology');
    expect(high).toBeGreaterThan(low);
  });

  it('clamps negative percentage to 0', () => {
    expect(computeEffectMultiplier(-10, 'military')).toBe(0);
  });

  it('clamps percentage above 100', () => {
    const at100 = computeEffectMultiplier(100, 'diplomacy');
    const at150 = computeEffectMultiplier(150, 'diplomacy');
    expect(at150).toBe(at100);
  });
});

// ===========================================================================
// applyBudgetToTreasury
// ===========================================================================

describe('applyBudgetToTreasury', () => {
  it('deducts total spending from treasury', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 1000, defaultPercentages());
    const result = applyBudgetToTreasury(alloc, 1000);
    expect(result.newTreasury).toBe(0);
    expect(result.spent).toBe(1000);
  });

  it('does not go below zero', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 2000, defaultPercentages());
    // Treasury only has 500 but allocation was built against 2000
    const result = applyBudgetToTreasury(alloc, 500);
    expect(result.newTreasury).toBe(0);
    expect(result.spent).toBe(500);
  });

  it('leaves treasury unchanged when allocation is 0', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 0, defaultPercentages());
    const result = applyBudgetToTreasury(alloc, 1000);
    expect(result.newTreasury).toBe(1000);
    expect(result.spent).toBe(0);
  });

  it('spent + newTreasury equals original treasury', () => {
    const alloc = createAllocation(FactionId.US, turn(1), 800, defaultPercentages());
    const result = applyBudgetToTreasury(alloc, 1500);
    expect(result.newTreasury + result.spent).toBeCloseTo(1500);
  });

  it('handles very large treasury values', () => {
    const alloc = createAllocation(FactionId.China, turn(1), 1_000_000, defaultPercentages());
    const result = applyBudgetToTreasury(alloc, 1_000_000);
    expect(result.spent).toBeCloseTo(1_000_000);
    expect(result.newTreasury).toBeCloseTo(0);
  });
});

// ===========================================================================
// processEndOfTurnBudget
// ===========================================================================

describe('processEndOfTurnBudget', () => {
  it('appends allocations to history', () => {
    const nationIds = [FactionId.US, FactionId.China] as FactionId[];
    const state = initializeBudgetState(nationIds);
    const nationStates = {
      [FactionId.US]: { treasury: 1000 },
      [FactionId.China]: { treasury: 2000 },
    } as Record<FactionId, { treasury: number }>;

    const updated = processEndOfTurnBudget(state, nationStates, turn(1));
    expect(updated.history[FactionId.US]).toHaveLength(1);
    expect(updated.history[FactionId.China]).toHaveLength(1);
  });

  it('preserves existing history on subsequent turns', () => {
    const nationIds = [FactionId.US] as FactionId[];
    let state = initializeBudgetState(nationIds);
    const ns = { [FactionId.US]: { treasury: 1000 } } as Record<FactionId, { treasury: number }>;

    state = processEndOfTurnBudget(state, ns, turn(1));
    state = processEndOfTurnBudget(state, ns, turn(2));
    expect(state.history[FactionId.US]).toHaveLength(2);
  });

  it('updates currentAllocations with new treasury-based amounts', () => {
    const nationIds = [FactionId.Japan] as FactionId[];
    const state = initializeBudgetState(nationIds);
    const ns = { [FactionId.Japan]: { treasury: 5000 } } as Record<FactionId, { treasury: number }>;

    const updated = processEndOfTurnBudget(state, ns, turn(1));
    const japanAlloc = updated.currentAllocations[FactionId.Japan];
    expect(japanAlloc.treasuryAvailable).toBe(5000);
  });

  it('creates default allocation for nations not in current state', () => {
    const state: BudgetState = {
      currentAllocations: {} as Record<FactionId, TurnBudgetAllocation>,
      history: {} as Record<FactionId, TurnBudgetAllocation[]>,
    };
    const ns = { [FactionId.Iran]: { treasury: 300 } } as Record<FactionId, { treasury: number }>;

    const updated = processEndOfTurnBudget(state, ns, turn(1));
    expect(updated.currentAllocations[FactionId.Iran]).toBeDefined();
    expect(updated.history[FactionId.Iran]).toHaveLength(1);
  });

  it('does not mutate the original state', () => {
    const nationIds = [FactionId.US] as FactionId[];
    const state = initializeBudgetState(nationIds);
    const ns = { [FactionId.US]: { treasury: 1000 } } as Record<FactionId, { treasury: number }>;

    const updated = processEndOfTurnBudget(state, ns, turn(1));
    expect(state.history[FactionId.US]).toHaveLength(0);
    expect(updated.history[FactionId.US]).toHaveLength(1);
  });

  it('history entries match the turn number', () => {
    const nationIds = [FactionId.EU] as FactionId[];
    let state = initializeBudgetState(nationIds);
    const ns = { [FactionId.EU]: { treasury: 800 } } as Record<FactionId, { treasury: number }>;

    state = processEndOfTurnBudget(state, ns, turn(3));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const euEntry = state.history[FactionId.EU]![0]!;
    expect(euEntry.turn).toBe(3);
  });

  it('handles empty nationStates gracefully', () => {
    const state = initializeBudgetState([FactionId.US]);
    const updated = processEndOfTurnBudget(state, {} as Record<FactionId, { treasury: number }>, turn(1));
    // US wasn't in nationStates so no new history entry was appended
    expect(updated.history[FactionId.US]).toEqual([]);
  });
});
