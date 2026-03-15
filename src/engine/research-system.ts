/**
 * Research System Engine — R&D Investment & Technology Research
 *
 * Manages national R&D budgets, processes active research projects each
 * turn, detects technology completions, and surfaces newly-available
 * technologies whose prerequisites are now satisfied.
 *
 * Designed to integrate with {@link TechSynergyEngine} for synergy bonuses
 * that accelerate or enhance research outcomes.
 *
 * All public methods are **pure functions** — no mutation, no side effects,
 * no internal mutable state.
 *
 * @module research-system
 * @see CNFL-3302 — R&D Investment & Research System
 * @see FR-2801 — National R&D Budget & Research Pipeline
 */

import type { FactionId, NationState } from '@/data/types';
import type { TechnologyModel, TechDomainKey } from '@/data/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fraction of invested funds refunded when research is cancelled. */
const CANCEL_REFUND_RATE = 0.5;

/** Maximum efficiency multiplier returned by {@link computeResearchEfficiency}. */
const MAX_EFFICIENCY = 2.0;

/** Minimum efficiency multiplier returned by {@link computeResearchEfficiency}. */
const MIN_EFFICIENCY = 0.5;

/** Weight of techLevel in the efficiency calculation. */
const TECH_LEVEL_WEIGHT = 0.3;

/** Weight of stability in the efficiency calculation. */
const STABILITY_WEIGHT = 0.2;

/** Weight of GDP proxy in the efficiency calculation. */
const GDP_WEIGHT = 0.5;

/** Tier multipliers: tier 1 → 1×, tier 2 → 1.5×, tier 3 → 2×. */
const TIER_MULTIPLIER = (tier: number): number => 1 + (tier - 1) * 0.5;

/** Secondary domain boost ratio relative to primary. */
const SECONDARY_DOMAIN_RATIO = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value, guaranteed to be within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * National R&D budget allocation for a single turn.
 *
 * Describes total spending and how it is distributed across technology
 * domains and, optionally, specific projects.
 */
export interface RnDAllocation {
  /** Faction this allocation belongs to. */
  readonly factionId: FactionId;
  /** Total R&D budget this turn (drawn from the treasury). */
  readonly totalBudget: number;
  /** Per-domain allocation weights (must sum to 1.0). */
  readonly domainWeights: Readonly<Partial<Record<TechDomainKey, number>>>;
  /** Specific project allocations that override domain-level distribution. */
  readonly projectAllocations?: readonly {
    readonly techId: string;
    readonly budget: number;
  }[];
}

/**
 * Active research project state.
 *
 * Tracks per-project progress toward completion of a single technology.
 */
export interface ActiveResearch {
  /** Technology being researched. */
  readonly techId: string;
  /** Faction conducting the research. */
  readonly factionId: FactionId;
  /** Investment accumulated so far. */
  readonly investedSoFar: number;
  /** Total cost required to complete the research. */
  readonly totalCost: number;
  /** Number of turns spent researching. */
  readonly turnsSpent: number;
  /** Estimated turns remaining at current funding. */
  readonly estimatedTurnsRemaining: number;
  /** Research speed multiplier from synergies, education, etc. */
  readonly speedMultiplier: number;
}

/**
 * Result of processing one turn of R&D for a single faction.
 */
export interface ResearchTurnResult {
  /** Faction whose research was processed. */
  readonly factionId: FactionId;
  /** Updated active research projects after the turn. */
  readonly activeProjects: readonly ActiveResearch[];
  /** Technology IDs completed this turn. */
  readonly completedTechs: readonly string[];
  /** Technology IDs that became available for research this turn. */
  readonly newlyAvailable: readonly string[];
  /** Total R&D expenditure this turn. */
  readonly totalExpenditure: number;
  /** Budget remaining (returned to treasury). */
  readonly budgetRemaining: number;
  /** Events generated during the turn (human-readable). */
  readonly events: readonly string[];
}

/**
 * A nation's complete R&D state.
 *
 * This is the persistent state object that is updated each turn by the
 * research pipeline.
 */
export interface NationRnDState {
  /** Faction this state belongs to. */
  readonly factionId: FactionId;
  /** Technology IDs already fully researched. */
  readonly completedTechIds: readonly string[];
  /** Currently active research projects. */
  readonly activeResearch: readonly ActiveResearch[];
  /** Per-domain research level accumulated from completed techs. */
  readonly domainLevels: Readonly<Partial<Record<TechDomainKey, number>>>;
  /** Total R&D investment historically. */
  readonly totalInvestment: number;
}

/**
 * Parameters required to start a new research project.
 */
export interface StartResearchParams {
  /** Faction starting the research. */
  readonly factionId: FactionId;
  /** Technology to research. */
  readonly techId: string;
  /** Initial budget allocation for the project. */
  readonly allocation: number;
  /** Current R&D state for the faction. */
  readonly currentState: NationRnDState;
  /** Complete technology catalog. */
  readonly techCatalog: readonly TechnologyModel[];
  /** Current nation state (used for cost adjustments). */
  readonly nationState: NationState;
}

/**
 * Result of attempting to start a new research project.
 */
export interface StartResearchResult {
  /** Whether the research was successfully started. */
  readonly success: boolean;
  /** Validation errors (empty when successful). */
  readonly errors: readonly string[];
  /** The newly created project, if successful. */
  readonly project?: ActiveResearch;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine managing the national R&D pipeline.
 *
 * Processes per-turn research investment, discovers completed technologies,
 * validates new research starts, and computes domain-level analytics.
 *
 * Every method is a **pure function**: no internal state is mutated.
 *
 * @see CNFL-3302 — R&D Investment & Research System
 * @see FR-2801 — National R&D Budget & Research Pipeline
 */
export class ResearchSystem {
  // ── Turn Processing ───────────────────────────────────────────────────

  /**
   * Process one turn of R&D for a faction.
   *
   * 1. Distribute the turn's budget to active projects based on domain
   *    weights and optional per-project overrides.
   * 2. Advance each project: `investedSoFar += turnFunding × speedMultiplier`.
   * 3. Check completions: `investedSoFar ≥ totalCost` **and**
   *    `turnsSpent ≥ minDuration` (from catalog `researchDurationTurns`).
   * 4. On completion: flag tech as done, recompute domain levels, and scan
   *    for newly-available technologies.
   * 5. Return the updated project list, completions, and remaining budget.
   *
   * @param state      Current R&D state for the faction.
   * @param allocation Budget allocation for this turn.
   * @param techCatalog Complete technology catalog.
   * @param nation     Current nation state (for speed multiplier).
   * @returns Turn result with updated projects, completions, and budget.
   */
  processTurn(
    state: NationRnDState,
    allocation: RnDAllocation,
    techCatalog: readonly TechnologyModel[],
    nation: NationState,
  ): ResearchTurnResult {
    const catalogMap = this.buildCatalogMap(techCatalog);
    const events: string[] = [];
    const completedThisTurn: string[] = [];
    let totalExpenditure = 0;

    // Build a map of per-project explicit allocations.
    const explicitAllocations = new Map<string, number>();
    let explicitTotal = 0;
    if (allocation.projectAllocations) {
      for (const pa of allocation.projectAllocations) {
        explicitAllocations.set(pa.techId, pa.budget);
        explicitTotal += pa.budget;
      }
    }

    // Budget remaining for domain-weighted distribution.
    const domainPool = Math.max(0, allocation.totalBudget - explicitTotal);

    // Compute per-project turn funding.
    const projectFunding = new Map<string, number>();
    for (const project of state.activeResearch) {
      const explicit = explicitAllocations.get(project.techId);
      if (explicit !== undefined) {
        projectFunding.set(project.techId, explicit);
      } else {
        // Determine the tech's domain to look up domain weight.
        const tech = catalogMap.get(project.techId);
        const domain = tech?.domain ?? 'ai';
        const weight = allocation.domainWeights[domain] ?? 0;
        projectFunding.set(project.techId, domainPool * weight);
      }
    }

    // Compute base speed multiplier for this nation.
    const baseSpeed = this.computeSpeedMultiplier(nation);

    // Advance each project.
    const updatedProjects: ActiveResearch[] = [];
    let newCompletedIds = [...state.completedTechIds];

    for (const project of state.activeResearch) {
      const funding = projectFunding.get(project.techId) ?? 0;
      totalExpenditure += funding;

      const effectiveInvestment = funding * project.speedMultiplier;
      const newInvested = project.investedSoFar + effectiveInvestment;
      const newTurns = project.turnsSpent + 1;

      // Look up minimum duration from catalog.
      const tech = catalogMap.get(project.techId);
      const minDuration = tech?.researchDurationTurns ?? 1;

      // Check completion.
      if (newInvested >= project.totalCost && newTurns >= minDuration) {
        completedThisTurn.push(project.techId);
        newCompletedIds = [...newCompletedIds, project.techId];
        events.push(
          `Research completed: ${tech?.name ?? project.techId}`,
        );
      } else {
        // Estimate remaining turns.
        const remaining = project.totalCost - newInvested;
        const perTurnRate = effectiveInvestment > 0 ? effectiveInvestment : 1;
        const estTurns = Math.max(
          Math.ceil(remaining / perTurnRate),
          minDuration - newTurns,
        );

        updatedProjects.push({
          ...project,
          investedSoFar: newInvested,
          turnsSpent: newTurns,
          estimatedTurnsRemaining: Math.max(0, estTurns),
          speedMultiplier: baseSpeed,
        });
      }
    }

    // Recompute domain levels with newly completed techs.
    const updatedDomainLevels = this.computeDomainLevels(
      newCompletedIds,
      techCatalog,
    );

    // Determine newly available technologies.
    const previouslyAvailable = new Set([
      ...state.completedTechIds,
      ...state.activeResearch.map((p) => p.techId),
    ]);
    const nowAvailableAll = this.getAvailableTechInternal(
      newCompletedIds,
      updatedProjects.map((p) => p.techId),
      updatedDomainLevels,
      techCatalog,
    );
    const newlyAvailable = nowAvailableAll
      .map((t) => t.techId)
      .filter((id) => !previouslyAvailable.has(id));

    if (newlyAvailable.length > 0) {
      events.push(
        `New technologies available: ${newlyAvailable.join(', ')}`,
      );
    }

    const budgetRemaining = Math.max(
      0,
      allocation.totalBudget - totalExpenditure,
    );

    return {
      factionId: state.factionId,
      activeProjects: updatedProjects,
      completedTechs: completedThisTurn,
      newlyAvailable,
      totalExpenditure,
      budgetRemaining,
      events,
    };
  }

  // ── Start Research ────────────────────────────────────────────────────

  /**
   * Attempt to start a new research project.
   *
   * Validates that:
   * - The technology exists in the catalog.
   * - All prerequisite technologies have been researched.
   * - Domain-level requirements are satisfied.
   * - The technology is not already researched.
   * - The technology is not currently being researched.
   *
   * On success, returns a new {@link ActiveResearch} entry with an initial
   * cost computed from the catalog's `researchCost`, adjusted by the
   * nation's `techLevel`.
   *
   * @param params Parameters for the new research project.
   * @returns Result indicating success/failure, with errors or the new project.
   */
  startResearch(params: StartResearchParams): StartResearchResult {
    const {
      factionId,
      techId,
      allocation,
      currentState,
      techCatalog,
      nationState,
    } = params;

    const errors: string[] = [];
    const catalogMap = this.buildCatalogMap(techCatalog);
    const tech = catalogMap.get(techId);

    // 1. Technology must exist.
    if (!tech) {
      errors.push(`Technology '${techId}' not found in catalog.`);
      return { success: false, errors };
    }

    // 2. Must not already be researched.
    if (currentState.completedTechIds.includes(techId)) {
      errors.push(`Technology '${techId}' has already been researched.`);
    }

    // 3. Must not already be in progress.
    if (currentState.activeResearch.some((p) => p.techId === techId)) {
      errors.push(`Technology '${techId}' is already being researched.`);
    }

    // 4. Check prerequisites.
    if (tech.prerequisites) {
      for (const prereq of tech.prerequisites) {
        if (!currentState.completedTechIds.includes(prereq.techId)) {
          errors.push(
            `Missing prerequisite: '${prereq.techId}' must be completed first.`,
          );
        }
      }
    }

    // 5. Check domain-level requirements.
    if (tech.domainLevelRequirement) {
      for (const [domain, requiredLevel] of Object.entries(
        tech.domainLevelRequirement,
      )) {
        const currentLevel =
          currentState.domainLevels[domain as TechDomainKey] ?? 0;
        if (requiredLevel !== undefined && currentLevel < requiredLevel) {
          errors.push(
            `Domain '${domain}' level ${currentLevel} is below required ${requiredLevel}.`,
          );
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Compute adjusted cost: base cost scaled inversely by techLevel.
    // Higher techLevel → lower effective cost (5 % discount per 10 points).
    const techLevelDiscount = clamp(nationState.techLevel / 200, 0, 0.5);
    const adjustedCost = tech.researchCost * (1 - techLevelDiscount);

    const speedMultiplier = this.computeSpeedMultiplier(nationState);

    // Estimate initial turns remaining.
    const perTurnRate =
      allocation * speedMultiplier > 0 ? allocation * speedMultiplier : 1;
    const estTurns = Math.max(
      Math.ceil(adjustedCost / perTurnRate),
      tech.researchDurationTurns,
    );

    const project: ActiveResearch = {
      techId,
      factionId,
      investedSoFar: 0,
      totalCost: adjustedCost,
      turnsSpent: 0,
      estimatedTurnsRemaining: estTurns,
      speedMultiplier,
    };

    return { success: true, errors: [], project };
  }

  // ── Cancel Research ───────────────────────────────────────────────────

  /**
   * Cancel an active research project and refund a portion of the
   * investment.
   *
   * The refund is 50 % of the total amount invested so far. The project is
   * removed from the active research list.
   *
   * @param state  Current R&D state for the faction.
   * @param techId Technology ID of the project to cancel.
   * @returns Updated state (without the project) and the refund amount.
   */
  cancelResearch(
    state: NationRnDState,
    techId: string,
  ): { state: NationRnDState; refund: number } {
    const project = state.activeResearch.find((p) => p.techId === techId);
    const refund = project ? project.investedSoFar * CANCEL_REFUND_RATE : 0;

    const updatedResearch = state.activeResearch.filter(
      (p) => p.techId !== techId,
    );

    return {
      state: {
        ...state,
        activeResearch: updatedResearch,
      },
      refund,
    };
  }

  // ── Available Technologies ────────────────────────────────────────────

  /**
   * Determine which technologies are currently available for a faction to
   * begin researching.
   *
   * A technology is available when:
   * - It has **not** already been completed.
   * - It is **not** currently being researched.
   * - All prerequisite technologies have been completed.
   * - All domain-level requirements are met.
   *
   * @param state      Current R&D state for the faction.
   * @param techCatalog Complete technology catalog.
   * @returns Technologies that can be started this turn.
   */
  getAvailableTech(
    state: NationRnDState,
    techCatalog: readonly TechnologyModel[],
  ): readonly TechnologyModel[] {
    return this.getAvailableTechInternal(
      state.completedTechIds,
      state.activeResearch.map((p) => p.techId),
      state.domainLevels,
      techCatalog,
    );
  }

  // ── Domain Levels ─────────────────────────────────────────────────────

  /**
   * Compute per-domain research levels from a set of completed technologies.
   *
   * Each completed technology contributes to its **primary domain** at full
   * value and to each **secondary domain** at 50 % of the value. The tier
   * of the technology acts as a multiplier:
   *
   * - Tier 1 → 1.0×
   * - Tier 2 → 1.5×
   * - Tier 3 → 2.0×
   *
   * Domain boosts declared in a technology's `effects.domainBoosts` are
   * added on top as flat bonuses.
   *
   * @param completedTechIds IDs of all completed technologies.
   * @param techCatalog      Complete technology catalog.
   * @returns Per-domain accumulated research levels.
   */
  computeDomainLevels(
    completedTechIds: readonly string[],
    techCatalog: readonly TechnologyModel[],
  ): Readonly<Partial<Record<TechDomainKey, number>>> {
    const catalogMap = this.buildCatalogMap(techCatalog);
    const levels: Partial<Record<TechDomainKey, number>> = {};

    for (const techId of completedTechIds) {
      const tech = catalogMap.get(techId);
      if (!tech) continue;

      const tier = tech.tier ?? 1;
      const multiplier = TIER_MULTIPLIER(tier);

      // Primary domain: full contribution.
      const primaryBoost = 1 * multiplier;
      levels[tech.domain] = (levels[tech.domain] ?? 0) + primaryBoost;

      // Secondary domains: 50 % contribution.
      if (tech.secondaryDomains) {
        for (const secDomain of tech.secondaryDomains) {
          const secBoost = SECONDARY_DOMAIN_RATIO * multiplier;
          levels[secDomain] = (levels[secDomain] ?? 0) + secBoost;
        }
      }

      // Flat domain boosts from effects.
      if (tech.effects?.domainBoosts) {
        for (const [domain, boost] of Object.entries(
          tech.effects.domainBoosts,
        )) {
          if (boost !== undefined) {
            levels[domain as TechDomainKey] =
              (levels[domain as TechDomainKey] ?? 0) + boost;
          }
        }
      }
    }

    return levels;
  }

  // ── Completion Estimation ─────────────────────────────────────────────

  /**
   * Estimate the number of turns remaining for a project at a given
   * per-turn budget.
   *
   * Accounts for the project's current speed multiplier. Returns `Infinity`
   * if the effective per-turn rate is zero or negative.
   *
   * @param project    The active research project.
   * @param turnBudget Per-turn budget allocated to this project.
   * @returns Estimated turns remaining (≥ 0), or `Infinity`.
   */
  estimateCompletion(project: ActiveResearch, turnBudget: number): number {
    const effectiveRate = turnBudget * project.speedMultiplier;
    if (effectiveRate <= 0) return Infinity;

    const remaining = Math.max(0, project.totalCost - project.investedSoFar);
    return Math.ceil(remaining / effectiveRate);
  }

  // ── Research Efficiency ───────────────────────────────────────────────

  /**
   * Compute the overall research efficiency multiplier for a nation.
   *
   * The multiplier is derived from three weighted components:
   *
   * | Component   | Weight | Normalisation           |
   * |-------------|--------|-------------------------|
   * | `techLevel` |  30 %  | `techLevel / 100`       |
   * | `stability` |  20 %  | `stability / 100`       |
   * | GDP proxy   |  50 %  | `gdp / 10 000` (capped) |
   *
   * The raw weighted sum is scaled to the range [0.5, 2.0].
   *
   * @param nation Current nation state.
   * @returns Efficiency multiplier in [0.5, 2.0].
   */
  computeResearchEfficiency(nation: NationState): number {
    const techComponent = clamp(nation.techLevel / 100, 0, 1);
    const stabilityComponent = clamp(nation.stability / 100, 0, 1);
    const gdpComponent = clamp(nation.gdp / 10_000, 0, 1);

    const raw =
      techComponent * TECH_LEVEL_WEIGHT +
      stabilityComponent * STABILITY_WEIGHT +
      gdpComponent * GDP_WEIGHT;

    // Map [0, 1] → [MIN_EFFICIENCY, MAX_EFFICIENCY].
    return clamp(
      MIN_EFFICIENCY + raw * (MAX_EFFICIENCY - MIN_EFFICIENCY),
      MIN_EFFICIENCY,
      MAX_EFFICIENCY,
    );
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Build an ID-keyed lookup map from the flat technology catalog array.
   *
   * @param techCatalog Complete technology catalog.
   * @returns Map keyed by `techId`.
   */
  private buildCatalogMap(
    techCatalog: readonly TechnologyModel[],
  ): Map<string, TechnologyModel> {
    const map = new Map<string, TechnologyModel>();
    for (const tech of techCatalog) {
      map.set(tech.techId, tech);
    }
    return map;
  }

  /**
   * Compute the base research speed multiplier for a nation.
   *
   * Formula: `1.0 + (techLevel / 100) × 0.3 + educationBonus`
   *
   * The education bonus is a placeholder (currently 0) awaiting
   * integration with the {@link EducationEngine}.
   *
   * @param nation Current nation state.
   * @returns Speed multiplier (≥ 1.0).
   */
  private computeSpeedMultiplier(nation: NationState): number {
    const techBonus = (nation.techLevel / 100) * 0.3;
    const educationBonus = 0; // TODO: integrate EducationEngine
    return 1.0 + techBonus + educationBonus;
  }

  /**
   * Internal implementation of available-tech filtering.
   *
   * Separated from the public method so it can be called with ad-hoc
   * completed/active lists during turn processing.
   *
   * @param completedIds   IDs of completed technologies.
   * @param activeIds      IDs of technologies currently being researched.
   * @param domainLevels   Current per-domain levels.
   * @param techCatalog    Complete technology catalog.
   * @returns Technologies that satisfy all availability criteria.
   */
  private getAvailableTechInternal(
    completedIds: readonly string[],
    activeIds: readonly string[],
    domainLevels: Readonly<Partial<Record<TechDomainKey, number>>>,
    techCatalog: readonly TechnologyModel[],
  ): readonly TechnologyModel[] {
    const completedSet = new Set(completedIds);
    const activeSet = new Set(activeIds);

    return techCatalog.filter((tech) => {
      // Already completed.
      if (completedSet.has(tech.techId)) return false;

      // Already being researched.
      if (activeSet.has(tech.techId)) return false;

      // Check prerequisites.
      if (tech.prerequisites) {
        for (const prereq of tech.prerequisites) {
          if (!completedSet.has(prereq.techId)) return false;
        }
      }

      // Check domain-level requirements.
      if (tech.domainLevelRequirement) {
        for (const [domain, requiredLevel] of Object.entries(
          tech.domainLevelRequirement,
        )) {
          const current = domainLevels[domain as TechDomainKey] ?? 0;
          if (requiredLevel !== undefined && current < requiredLevel) {
            return false;
          }
        }
      }

      return true;
    });
  }
}
