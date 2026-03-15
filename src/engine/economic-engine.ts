/**
 * National Treasury and GDP Engine — CNFL-0503, FR-606
 *
 * Handles per-turn income calculation, treasury replenishment, spending
 * validation, inflation-to-stability effects, and economic snapshot generation
 * for every faction in the simulation.
 *
 * @module economic-engine
 * @see FR-606 — Treasury Replenishment & Income
 * @see FR-603 — Global Inflation Effects
 */

import type { FactionId, NationState } from '@/data/types';
import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Income breakdown for a single turn. */
export interface TurnIncomeBreakdown {
  /** Income derived from GDP. */
  gdpIncome: number;
  /** Income derived from trade balance. */
  tradeBalanceIncome: number;
  /** Income derived from resource exports. */
  resourceExportIncome: number;
  /** Sum of all income streams. */
  totalIncome: number;
}

/** Result of attempting to spend from treasury. */
export interface SpendResult {
  /** Whether the spend was successful. */
  success: boolean;
  /** Treasury value after the spend (or unchanged if failed). */
  remainingTreasury: number;
  /** 0 if successful, positive value indicating shortfall if insufficient. */
  shortfall: number;
}

/** Per-nation economic snapshot for a single turn. */
export interface EconomicSnapshot {
  factionId: FactionId;
  treasury: number;
  gdp: number;
  inflation: number;
  tradeBalance: number;
  resourceExports: number;
  turnIncome: TurnIncomeBreakdown;
}

/** Global economic state tracked across turns. */
export interface GlobalEconomicState {
  /** Aggregate global inflation (0–100). */
  globalInflation: number;
  /** Oil supply disruption level (0–100), driven by Hormuz blockade status. */
  oilSupplyDisruption: number;
  /** Per-faction trade balance values. */
  tradeBalances: Record<FactionId, number>;
  /** Per-faction resource export values. */
  resourceExports: Record<FactionId, number>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless economic engine that computes income, spending, and inflation
 * effects based on the centralised game configuration.
 *
 * @see FR-606 — Treasury Replenishment
 * @see FR-603 — Inflation Effects on Stability
 */
export class EconomicEngine {
  private readonly config: typeof GAME_CONFIG.economy;

  constructor(config: typeof GAME_CONFIG.economy) {
    this.config = config;
  }

  // ── Income & Treasury ───────────────────────────────────────────────────

  /**
   * Calculate the turn-by-turn income breakdown for a nation.
   *
   * @param nation       Current nation state
   * @param tradeBalance Net trade balance for the nation this turn
   * @param resourceExports Resource export value for the nation this turn
   * @returns Detailed income breakdown
   *
   * @see FR-606
   */
  calculateTurnIncome(
    nation: NationState,
    tradeBalance: number,
    resourceExports: number,
  ): TurnIncomeBreakdown {
    const gdpIncome = this.config.treasury.gdpIncomeRate * nation.gdp;
    const tradeBalanceIncome =
      this.config.treasury.tradeBalanceRate * tradeBalance;
    const resourceExportIncome =
      this.config.treasury.resourceExportRate * resourceExports;

    return {
      gdpIncome,
      tradeBalanceIncome,
      resourceExportIncome,
      totalIncome: gdpIncome + tradeBalanceIncome + resourceExportIncome,
    };
  }

  /**
   * Replenish a nation's treasury using the computed turn income.
   *
   * @param nation Current nation state
   * @param income Income breakdown for this turn
   * @returns New treasury value (floored at minimumTreasury)
   *
   * @see FR-606
   */
  replenishTreasury(nation: NationState, income: TurnIncomeBreakdown): number {
    const raw = nation.treasury + income.totalIncome;
    return Math.max(raw, this.config.treasury.minimumTreasury);
  }

  // ── Spending ────────────────────────────────────────────────────────────

  /**
   * Check whether a treasury balance can cover the given cost.
   *
   * @param treasury Current treasury value
   * @param cost     Amount to spend (positive = expenditure)
   */
  canAfford(treasury: number, cost: number): boolean {
    return treasury >= cost;
  }

  /**
   * Attempt to deduct a cost from the treasury.
   *
   * @param treasury Current treasury value
   * @param cost     Amount to spend
   * @returns Result indicating success, remaining treasury, and any shortfall
   */
  spend(treasury: number, cost: number): SpendResult {
    if (this.canAfford(treasury, cost)) {
      return {
        success: true,
        remainingTreasury: treasury - cost,
        shortfall: 0,
      };
    }
    return {
      success: false,
      remainingTreasury: treasury,
      shortfall: cost - treasury,
    };
  }

  // ── Inflation ───────────────────────────────────────────────────────────

  /**
   * Calculate the stability delta caused by combined national + global
   * inflation exceeding the configured penalty threshold.
   *
   * @param nation          Current nation state
   * @param globalInflation Aggregate global inflation value
   * @returns Negative stability delta (0 if below threshold)
   *
   * @see FR-603
   */
  applyInflationToStability(
    nation: NationState,
    globalInflation: number,
  ): number {
    const combinedInflation = nation.inflation + globalInflation;
    const { penaltyThreshold, stabilityPenaltyPerPoint, maxStabilityPenalty } =
      this.config.inflationEffects;

    if (combinedInflation <= penaltyThreshold) {
      return 0;
    }

    const excess = combinedInflation - penaltyThreshold;
    const rawPenalty = excess * stabilityPenaltyPerPoint;

    // Both rawPenalty and maxStabilityPenalty are negative; clamp towards zero.
    return Math.max(rawPenalty, maxStabilityPenalty);
  }

  // ── Snapshots ───────────────────────────────────────────────────────────

  /**
   * Build a convenience snapshot of a nation's economic state.
   *
   * Uses `?? 0` guards for noUncheckedIndexedAccess safety on Record look-ups.
   *
   * @param nation      Current nation state
   * @param globalState Global economic state for the current turn
   */
  createEconomicSnapshot(
    nation: NationState,
    globalState: GlobalEconomicState,
  ): EconomicSnapshot {
    const tradeBalance =
      globalState.tradeBalances[nation.factionId] ?? 0;
    const resourceExports =
      globalState.resourceExports[nation.factionId] ?? 0;

    const turnIncome = this.calculateTurnIncome(
      nation,
      tradeBalance,
      resourceExports,
    );

    return {
      factionId: nation.factionId,
      treasury: nation.treasury,
      gdp: nation.gdp,
      inflation: nation.inflation,
      tradeBalance,
      resourceExports,
      turnIncome,
    };
  }

  // ── Global Inflation ────────────────────────────────────────────────────

  /**
   * Calculate aggregate global inflation from a base value and oil-supply
   * disruption, clamped to 0–100.
   *
   * @param baseInflation       Base global inflation value
   * @param oilSupplyDisruption Oil supply disruption level (0–100)
   * @returns Clamped global inflation value
   *
   * @see FR-603
   */
  calculateGlobalInflation(
    baseInflation: number,
    oilSupplyDisruption: number,
  ): number {
    const raw =
      baseInflation +
      this.config.hormuzOil.inflationCoefficient * oilSupplyDisruption;
    return Math.min(Math.max(raw, 0), 100);
  }
}
