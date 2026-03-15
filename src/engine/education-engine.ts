/**
 * Education Investment Engine — CNFL-3401, FR-2600
 *
 * Manages per-nation education investment portfolios, computes delayed
 * effects on technology research speed, economic growth, civil stability,
 * military effectiveness, and aggregates tech-domain bonuses from the
 * education catalog.
 *
 * All methods are pure functions — no internal mutation.
 *
 * @module education-engine
 * @see FR-2600 — Education Investment & Population Effects
 * @see FR-2900 — Education Type Model (DR-157)
 */

import type { FactionId, EducationType } from '@/data/types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Per-nation, per-education-type investment record. */
export interface EducationInvestment {
  /** The education program this investment targets. */
  readonly educationId: string;
  /** Annual budget allocated to this program (billions USD equivalent). */
  readonly annualBudget: number;
  /** Number of turns this investment has been active. */
  readonly turnsActive: number;
  /**
   * Current effect multiplier (0–1).
   * Starts at 0.1 on first investment, linearly ramps to 1.0
   * over `implementationTurns` from the education model.
   */
  readonly effectMultiplier: number;
}

/** Per-nation education portfolio. */
export interface EducationPortfolio {
  /** Faction owning this portfolio. */
  readonly factionId: FactionId;
  /** Active investments across education programs. */
  readonly investments: readonly EducationInvestment[];
  /** Sum of all investment annual budgets. */
  readonly totalBudget: number;
  /** National literacy rate (0–100). */
  readonly literacyRate: number;
}

/** Computed education effects for a single nation in a given turn. */
export interface EducationEffect {
  /** Bonus to technology research speed (additive percentage points). */
  readonly techResearchSpeedBonus: number;
  /** Bonus to economic growth rate (additive percentage points). */
  readonly economicGrowthBonus: number;
  /** Bonus to national stability (additive points). */
  readonly stabilityBonus: number;
  /** Bonus to military training / readiness (additive points). */
  readonly militaryTrainingBonus: number;
  /** Per-domain tech research speed boosts. */
  readonly techDomainBoosts: Record<string, number>;
  /** Aggregate innovation capacity score. */
  readonly innovationCapacity: number;
}

/** Request to change budget allocation for a single education program. */
export interface InvestmentChange {
  /** Target education program. */
  readonly educationId: string;
  /** New annual budget to allocate (billions USD equivalent). */
  readonly newBudget: number;
}

/** Outcome of an investment allocation change. */
export interface InvestmentResult {
  /** Whether the change was applied successfully. */
  readonly success: boolean;
  /** Total portfolio budget after the change (or unchanged on failure). */
  readonly newTotalBudget: number;
  /** Validation / affordability errors, if any. */
  readonly errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum effect multiplier when an investment is first created. */
const INITIAL_EFFECT_MULTIPLIER = 0.1;

/** Hard cap on literacy rate. */
const MAX_LITERACY_RATE = 99;

/**
 * Base literacy contribution weight per billion USD of education spending
 * relative to population (millions). Tuned so that a nation spending ~5 B
 * with 100 M population reaches ~60 literacy from education alone.
 */
const LITERACY_BUDGET_WEIGHT = 1.2;

/**
 * Scaling factor for workforce-quality → economic-growth conversion.
 * Each point of weighted workforce quality contributes this fraction
 * of a percentage point to the growth bonus.
 */
const WORKFORCE_TO_GROWTH_FACTOR = 0.05;

/**
 * Scaling factor for innovation-rate → research-speed conversion.
 * Each point of weighted innovation rate contributes this fraction
 * of a percentage point to the research speed bonus.
 */
const INNOVATION_TO_RESEARCH_FACTOR = 0.1;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless education engine that computes investment effects,
 * manages budget allocation, and advances investment maturity.
 *
 * @see FR-2600 — Education Investment & Population Effects
 * @see FR-2900 — Education Type (DR-157)
 */
export class EducationEngine {
  // ── Effect Computation ──────────────────────────────────────────────────

  /**
   * Aggregate all education effects for a nation's portfolio.
   *
   * Iterates every active investment, looks up its education type in the
   * catalog, and applies the current `effectMultiplier` to the type's
   * declared effects.
   *
   * @param portfolio        The nation's education portfolio
   * @param educationCatalog Map of educationId → EducationType definitions
   * @returns Aggregated education effects
   */
  computeEffects(
    portfolio: EducationPortfolio,
    educationCatalog: Map<string, EducationType>,
  ): EducationEffect {
    let techResearchSpeedBonus = 0;
    let economicGrowthBonus = 0;
    let stabilityBonus = 0;
    let militaryTrainingBonus = 0;
    let innovationCapacity = 0;
    const techDomainBoosts: Record<string, number> = {};

    for (const investment of portfolio.investments) {
      const eduType = educationCatalog.get(investment.educationId);
      if (!eduType) {
        continue;
      }

      const multiplier = investment.effectMultiplier;
      const effects = eduType.effects;
      if (!effects) {
        continue;
      }

      // Stability bonus from this program
      const stabilityMod = effects.stabilityModifier ?? 0;
      stabilityBonus += stabilityMod * multiplier;

      // Military readiness / training bonus
      const militaryMod = effects.militaryReadinessModifier ?? 0;
      militaryTrainingBonus += militaryMod * multiplier;

      // Innovation rate feeds into both innovation capacity and research speed
      const innovationMod = effects.innovationRate ?? 0;
      innovationCapacity += innovationMod * multiplier;
      techResearchSpeedBonus += innovationMod * multiplier * INNOVATION_TO_RESEARCH_FACTOR;

      // Workforce quality feeds into economic growth
      const workforceMod = effects.workforceQuality ?? 0;
      economicGrowthBonus += workforceMod * multiplier * WORKFORCE_TO_GROWTH_FACTOR;

      // Per-domain technology boosts
      if (effects.technologyDomainBoosts) {
        for (const [domain, boost] of Object.entries(effects.technologyDomainBoosts)) {
          if (boost !== undefined) {
            const current = techDomainBoosts[domain] ?? 0;
            techDomainBoosts[domain] = current + boost * multiplier;
          }
        }
      }
    }

    return {
      techResearchSpeedBonus,
      economicGrowthBonus,
      stabilityBonus,
      militaryTrainingBonus,
      techDomainBoosts,
      innovationCapacity,
    };
  }

  // ── Investment Management ───────────────────────────────────────────────

  /**
   * Attempt to change a nation's budget allocation for a single education
   * program. Validates that the nation's treasury can cover the delta and
   * that the requested education type exists.
   *
   * If the education program is not yet in the portfolio, a new
   * {@link EducationInvestment} is created with `turnsActive = 0` and an
   * initial `effectMultiplier` of {@link INITIAL_EFFECT_MULTIPLIER}.
   *
   * @param portfolio     Current education portfolio (immutable)
   * @param change        Requested allocation change
   * @param treasuryBudget Available treasury budget for education spending
   * @param educationType The education type definition for validation
   * @returns Result indicating success, new total, and any errors
   */
  investInEducation(
    portfolio: EducationPortfolio,
    change: InvestmentChange,
    treasuryBudget: number,
    educationType: EducationType,
  ): InvestmentResult {
    const errors: string[] = [];

    // Validate budget is non-negative
    if (change.newBudget < 0) {
      errors.push(`Budget cannot be negative: ${change.newBudget}`);
      return { success: false, newTotalBudget: portfolio.totalBudget, errors };
    }

    // Validate education type matches the requested ID
    if (educationType.educationId !== change.educationId) {
      errors.push(
        `Education type mismatch: expected '${change.educationId}', got '${educationType.educationId}'`,
      );
      return { success: false, newTotalBudget: portfolio.totalBudget, errors };
    }

    // Find current investment for this education ID (if any)
    const existingIndex = portfolio.investments.findIndex(
      (inv) => inv.educationId === change.educationId,
    );
    const existingBudget =
      existingIndex >= 0
        ? portfolio.investments[existingIndex]!.annualBudget
        : 0;

    // Calculate delta cost: positive means we need more from treasury
    const budgetDelta = change.newBudget - existingBudget;

    // Check affordability — only need treasury headroom for increases
    if (budgetDelta > 0 && budgetDelta > treasuryBudget) {
      errors.push(
        `Insufficient treasury: need ${budgetDelta.toFixed(2)} but only ${treasuryBudget.toFixed(2)} available`,
      );
      return { success: false, newTotalBudget: portfolio.totalBudget, errors };
    }

    // Compute new total
    const newTotalBudget = portfolio.totalBudget - existingBudget + change.newBudget;

    return { success: true, newTotalBudget, errors };
  }

  // ── Turn Advancement ────────────────────────────────────────────────────

  /**
   * Advance all investments in a portfolio by one turn.
   *
   * For each investment:
   * - Increments `turnsActive` by 1.
   * - Recalculates `effectMultiplier` using the sigmoid-like ramp from
   *   {@link computeEffectMultiplier}.
   *
   * Investments with a budget of 0 are pruned from the portfolio.
   *
   * @param portfolio        Current education portfolio (immutable)
   * @param educationCatalog Map of educationId → EducationType definitions
   * @returns A new portfolio with updated turn counters and multipliers
   */
  advanceTurn(
    portfolio: EducationPortfolio,
    educationCatalog: Map<string, EducationType>,
  ): EducationPortfolio {
    const advancedInvestments: EducationInvestment[] = [];

    for (const investment of portfolio.investments) {
      // Prune zero-budget investments
      if (investment.annualBudget <= 0) {
        continue;
      }

      const eduType = educationCatalog.get(investment.educationId);
      const implementationTurns = eduType?.implementationTurns ?? 6;

      const newTurnsActive = investment.turnsActive + 1;
      const newMultiplier = this.computeEffectMultiplier(
        newTurnsActive,
        implementationTurns,
      );

      advancedInvestments.push({
        educationId: investment.educationId,
        annualBudget: investment.annualBudget,
        turnsActive: newTurnsActive,
        effectMultiplier: newMultiplier,
      });
    }

    const newTotalBudget = advancedInvestments.reduce(
      (sum, inv) => sum + inv.annualBudget,
      0,
    );

    return {
      factionId: portfolio.factionId,
      investments: advancedInvestments,
      totalBudget: newTotalBudget,
      literacyRate: portfolio.literacyRate,
    };
  }

  // ── Effect Multiplier ───────────────────────────────────────────────────

  /**
   * Compute the effect multiplier for an education investment based on how
   * many turns it has been active relative to the implementation horizon.
   *
   * The ramp is linear from {@link INITIAL_EFFECT_MULTIPLIER} (0.1) at
   * turn 0 to 1.0 at `implementationTurns`, clamped to [0.1, 1.0].
   *
   * ```
   * multiplier(t) = 0.1 + 0.9 × min(t / implementationTurns, 1)
   * ```
   *
   * @param turnsActive        Number of turns the investment has been active
   * @param implementationTurns Turns required for the program to reach full effect
   * @returns Effect multiplier in the range [0.1, 1.0]
   */
  computeEffectMultiplier(
    turnsActive: number,
    implementationTurns: number,
  ): number {
    if (implementationTurns <= 0) {
      return 1.0;
    }
    const progress = Math.min(turnsActive / implementationTurns, 1.0);
    const multiplier =
      INITIAL_EFFECT_MULTIPLIER +
      (1.0 - INITIAL_EFFECT_MULTIPLIER) * progress;
    return Math.min(Math.max(multiplier, INITIAL_EFFECT_MULTIPLIER), 1.0);
  }

  // ── Literacy Rate ───────────────────────────────────────────────────────

  /**
   * Compute an overall national literacy rate (0–100) from the education
   * portfolio and base population.
   *
   * The formula is a weighted sum of education budgets (scaled by their
   * effect multiplier) relative to the national population, capped at
   * {@link MAX_LITERACY_RATE} (99).
   *
   * ```
   * literacy = min(99, Σ (budget_i × multiplier_i × WEIGHT) / populationMillions)
   * ```
   *
   * A larger population requires proportionally more education spending to
   * achieve the same literacy rate.
   *
   * @param portfolio      The nation's education portfolio
   * @param basePopulation National population in millions
   * @returns Literacy rate clamped to [0, 99]
   */
  computeLiteracyRate(
    portfolio: EducationPortfolio,
    basePopulation: number,
  ): number {
    if (basePopulation <= 0) {
      return 0;
    }

    let weightedBudget = 0;
    for (const investment of portfolio.investments) {
      weightedBudget += investment.annualBudget * investment.effectMultiplier;
    }

    const rawLiteracy =
      (weightedBudget * LITERACY_BUDGET_WEIGHT) / basePopulation;

    return Math.min(Math.max(rawLiteracy, 0), MAX_LITERACY_RATE);
  }

  // ── Tech Domain Boosts ──────────────────────────────────────────────────

  /**
   * Aggregate technology domain boosts from all active education investments.
   *
   * Each education type declares per-domain boosts in its
   * `effects.technologyDomainBoosts` field. These are multiplied by the
   * investment's current `effectMultiplier` and summed across all
   * investments.
   *
   * @param portfolio        The nation's education portfolio
   * @param educationCatalog Map of educationId → EducationType definitions
   * @returns Aggregate boost per tech domain (e.g. `{ ai: 15.2, cyber: 8.1 }`)
   */
  getTechDomainBoosts(
    portfolio: EducationPortfolio,
    educationCatalog: Map<string, EducationType>,
  ): Record<string, number> {
    const boosts: Record<string, number> = {};

    for (const investment of portfolio.investments) {
      const eduType = educationCatalog.get(investment.educationId);
      if (!eduType?.effects?.technologyDomainBoosts) {
        continue;
      }

      const multiplier = investment.effectMultiplier;

      for (const [domain, boost] of Object.entries(
        eduType.effects.technologyDomainBoosts,
      )) {
        if (boost !== undefined) {
          const current = boosts[domain] ?? 0;
          boosts[domain] = current + boost * multiplier;
        }
      }
    }

    return boosts;
  }

  // ── Portfolio Helpers ───────────────────────────────────────────────────

  /**
   * Create a fresh, empty education portfolio for a faction.
   *
   * @param factionId The faction to create the portfolio for
   * @returns An empty portfolio with zero budget and zero literacy
   */
  createEmptyPortfolio(factionId: FactionId): EducationPortfolio {
    return {
      factionId,
      investments: [],
      totalBudget: 0,
      literacyRate: 0,
    };
  }

  /**
   * Apply an {@link InvestmentChange} to a portfolio, returning a new
   * portfolio with the updated investment.
   *
   * This is a pure helper that assumes validation has already passed via
   * {@link investInEducation}. It either updates an existing investment's
   * budget or creates a new one.
   *
   * @param portfolio Current education portfolio (immutable)
   * @param change    The validated change to apply
   * @returns A new portfolio with the change applied
   */
  applyInvestmentChange(
    portfolio: EducationPortfolio,
    change: InvestmentChange,
  ): EducationPortfolio {
    const existingIndex = portfolio.investments.findIndex(
      (inv) => inv.educationId === change.educationId,
    );

    let newInvestments: EducationInvestment[];

    if (existingIndex >= 0) {
      // Update existing investment's budget
      newInvestments = portfolio.investments.map((inv, idx) => {
        if (idx === existingIndex) {
          return {
            educationId: inv.educationId,
            annualBudget: change.newBudget,
            turnsActive: inv.turnsActive,
            effectMultiplier: inv.effectMultiplier,
          };
        }
        return inv;
      });
    } else {
      // Create new investment entry
      const newInvestment: EducationInvestment = {
        educationId: change.educationId,
        annualBudget: change.newBudget,
        turnsActive: 0,
        effectMultiplier: INITIAL_EFFECT_MULTIPLIER,
      };
      newInvestments = [...portfolio.investments, newInvestment];
    }

    // Filter out zero-budget entries
    newInvestments = newInvestments.filter((inv) => inv.annualBudget > 0);

    const newTotalBudget = newInvestments.reduce(
      (sum, inv) => sum + inv.annualBudget,
      0,
    );

    return {
      factionId: portfolio.factionId,
      investments: newInvestments,
      totalBudget: newTotalBudget,
      literacyRate: portfolio.literacyRate,
    };
  }
}
