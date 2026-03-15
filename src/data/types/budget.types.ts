/**
 * Turn Budget & Investment Allocation Types — DR-185, FR-3900
 */
import type { FactionId, TurnNumber } from './enums';

/** The 8 budget investment dimensions (FR-3901) */
export type BudgetDimension =
  | 'military' | 'diplomacy' | 'technology' | 'intelligence'
  | 'education' | 'infrastructure' | 'socialPrograms' | 'strategicReserves';

/** All budget dimensions as a constant array */
export const BUDGET_DIMENSIONS: readonly BudgetDimension[] = [
  'military', 'diplomacy', 'technology', 'intelligence',
  'education', 'infrastructure', 'socialPrograms', 'strategicReserves',
] as const;

/** Investment level presets (FR-3902) */
export type InvestmentLevel = 'none' | 'minimal' | 'standard' | 'priority' | 'maximum';

/** Per-dimension allocation entry */
export interface DimensionAllocation {
  percentage: number;
  absoluteAmount: number;
  effectMultiplier: number;
}

/** Complete turn budget allocation for a nation (DR-185) */
export interface TurnBudgetAllocation {
  nationCode: FactionId;
  turn: TurnNumber;
  treasuryAvailable: number;
  allocations: Record<BudgetDimension, DimensionAllocation>;
  aiRecommendation: BudgetRecommendation | null;
}

/** AI budget recommendation (FR-3903) */
export interface BudgetRecommendation {
  allocations: Record<BudgetDimension, number>;
  rationale: Record<BudgetDimension, string>;
  overallStrategy: string;
  generatedAt: string;
}

/** Budget state tracked in game */
export interface BudgetState {
  currentAllocations: Record<FactionId, TurnBudgetAllocation>;
  history: Record<FactionId, TurnBudgetAllocation[]>;
}
