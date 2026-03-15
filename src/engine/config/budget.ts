/**
 * New Order — Turn Budget & Investment Allocation Configuration
 *
 * Defines investment level thresholds, dimension metadata, default
 * allocations, and effect multiplier scaling for the budget subsystem.
 *
 * @see FR-3901 — Budget Dimensions
 * @see FR-3902 — Investment Level Presets
 * @see FR-3903 — AI Budget Recommendations
 * @see FR-3904 — Effect Multiplier Scaling
 * @see NFR-204 — All game formulas configurable via constants
 */

export const budgetConfig = {
  investmentLevels: {
    none: 0,
    minimal: 10,
    standard: 25,
    priority: 50,
    maximum: 75,
  },
  maxTotalAllocation: 100,
  dimensions: {
    military: { label: 'Military', icon: '⚔️', effectBase: 1.0 },
    diplomacy: { label: 'Diplomacy', icon: '🤝', effectBase: 1.0 },
    technology: { label: 'Technology', icon: '🔬', effectBase: 1.0 },
    intelligence: { label: 'Intelligence', icon: '🕵️', effectBase: 1.0 },
    education: { label: 'Education', icon: '🎓', effectBase: 0.8 },
    infrastructure: { label: 'Infrastructure', icon: '🏗️', effectBase: 0.9 },
    socialPrograms: { label: 'Social Programs', icon: '🏥', effectBase: 0.7 },
    strategicReserves: { label: 'Strategic Reserves', icon: '🏦', effectBase: 0.5 },
  },
  defaultAllocation: {
    military: 20, diplomacy: 15, technology: 15, intelligence: 10,
    education: 10, infrastructure: 10, socialPrograms: 10, strategicReserves: 10,
  },
  effectMultiplierScale: { zero: 0, low: 0.5, medium: 1.0, high: 1.5, max: 2.0 },
  budgetIncomeRate: 0.03,
} as const;
