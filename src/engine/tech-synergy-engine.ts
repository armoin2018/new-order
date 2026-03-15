/**
 * Technology Synergy Engine — CNFL-3301
 *
 * Implements the technology effect combination (synergy) system for the
 * simulation.  Discovers emergent synergy bonuses when a nation researches
 * complementary technologies, computes passive knowledge-transfer spillovers
 * across tech domains, aggregates all active technology effects, and
 * provides portfolio-level analysis with a composite strength score.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module tech-synergy-engine
 * @see FR-2500 — Technology Effect Combination (Synergy System)
 * @see CNFL-3301
 */

import type { FactionId, TechnologyModel, TechDomainKey } from '@/data/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum domain-expertise discount (40 %). */
const MAX_DOMAIN_DISCOUNT = 0.4;

/** Discount per existing tech in the same domain (5 %). */
const PER_TECH_DOMAIN_DISCOUNT = 0.05;

/** Base knowledge-transfer rate when a tech has secondary domains. */
const BASE_TRANSFER_RATE = 0.15;

/** Transfer-rate scaling per point of espionage value (0–100). */
const ESPIONAGE_TRANSFER_SCALE = 0.005;

/** Tech-level baseline above which research speed bonuses apply. */
const TECH_LEVEL_SPEED_BASELINE = 50;

/** Research speed bonus per tech-level point above the baseline (1 %). */
const TECH_LEVEL_SPEED_BONUS = 0.01;

/** Maximum possible tier value for coverage scoring. */
const MAX_TIER = 5;

/** All recognised technology domains. */
const ALL_DOMAINS: readonly TechDomainKey[] = [
  'ai',
  'semiconductors',
  'space',
  'cyber',
  'biotech',
  'quantum',
] as const;

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * A discovered synergy between two researched technologies.
 *
 * Synergies are activated when a nation has completed research on *both*
 * the source and partner technologies.
 */
export interface TechSynergyBonus {
  /** Technology that declares the combination bonus. */
  readonly sourceTechId: string;
  /** Technology that completes the synergy pair. */
  readonly partnerTechId: string;
  /** Human-readable synergy name derived from both techs. */
  readonly bonusName: string;
  /** Description of the synergy effect. */
  readonly bonusDescription: string;
  /** Flat effect deltas keyed by metric name. */
  readonly effects: Record<string, number>;
}

/**
 * Result of a knowledge-transfer (spillover) computation from one tech
 * domain to another.
 */
export interface KnowledgeTransferResult {
  /** Origin domain producing the spillover. */
  readonly sourceDomain: string;
  /** Destination domain receiving passive benefit. */
  readonly targetDomain: string;
  /** Fractional transfer rate (0–1). */
  readonly transferRate: number;
  /** Effective domain-level boost delivered to the target domain. */
  readonly effectiveBoost: number;
}

/**
 * Comprehensive analysis of a nation's entire technology portfolio,
 * including synergy activations, knowledge transfers, aggregate effect
 * totals, and a composite strength rating.
 */
export interface TechPortfolioAnalysis {
  /** Faction that owns the portfolio. */
  readonly factionId: FactionId;
  /** Total count of researched technologies. */
  readonly totalResearchedCount: number;
  /** All currently active synergy bonuses. */
  readonly activeSynergies: TechSynergyBonus[];
  /** All computed domain-to-domain knowledge transfers. */
  readonly knowledgeTransfers: KnowledgeTransferResult[];
  /** Merged effect totals from direct effects and synergy bonuses. */
  readonly aggregateEffects: Record<string, number>;
  /** Composite portfolio strength score (0–100). */
  readonly portfolioStrength: number;
}

/**
 * An active research project tracking per-turn investment toward a
 * specific technology.
 */
export interface ResearchProject {
  /** Technology being researched. */
  readonly techId: string;
  /** Turns remaining until research completes. */
  readonly turnsRemaining: number;
  /** Budget allocated per turn. */
  readonly investmentPerTurn: number;
  /** Cumulative investment to date. */
  readonly totalInvested: number;
}

/**
 * Outcome of advancing an active research project by one turn.
 */
export interface ResearchResult {
  /** Whether the research completed this turn. */
  readonly completed: boolean;
  /** Technology being researched. */
  readonly techId: string;
  /** Turns remaining after this advance (0 if completed). */
  readonly turnsRemaining: number;
  /** Any synergies newly activated upon completion. */
  readonly newSynergies: TechSynergyBonus[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that discovers technology synergies, computes knowledge-
 * transfer spillovers, aggregates technology effects, and evaluates
 * research portfolio strength.
 *
 * Every method is a **pure function**: no internal state is mutated.
 *
 * @see FR-2500 — Technology Effect Combination
 * @see CNFL-3301
 */
export class TechSynergyEngine {
  // ── Synergy Discovery ─────────────────────────────────────────────────

  /**
   * Discover all active synergy bonuses for the given set of researched
   * technologies.
   *
   * Iterates each researched tech's `combinationBonuses` and checks whether
   * the required partner technology has also been researched.  When both
   * sides are present the synergy is considered *active* and its effects
   * are derived from the declared `bonusMultiplier` applied to the
   * intersection of both techs' domain boosts.
   *
   * @param researchedTechIds IDs of all technologies the nation has completed
   * @param techCatalog       Complete technology catalog keyed by techId
   * @returns Array of all activated {@link TechSynergyBonus} entries
   */
  discoverSynergies(
    researchedTechIds: string[],
    techCatalog: Map<string, TechnologyModel>,
  ): TechSynergyBonus[] {
    const researchedSet = new Set(researchedTechIds);
    const synergies: TechSynergyBonus[] = [];
    // Track already-emitted pairs to avoid duplicates (A→B and B→A).
    const seen = new Set<string>();

    for (const techId of researchedTechIds) {
      const tech = techCatalog.get(techId);
      if (!tech?.combinationBonuses) {
        continue;
      }

      for (const combo of tech.combinationBonuses) {
        if (!researchedSet.has(combo.partnerTechId)) {
          continue;
        }

        const pairKey = [techId, combo.partnerTechId].sort().join('::');
        if (seen.has(pairKey)) {
          continue;
        }
        seen.add(pairKey);

        const partnerTech = techCatalog.get(combo.partnerTechId);
        const effects = this.deriveSynergyEffects(
          tech,
          partnerTech,
          combo.bonusMultiplier ?? 1.0,
        );

        synergies.push({
          sourceTechId: techId,
          partnerTechId: combo.partnerTechId,
          bonusName: `${tech.name} + ${partnerTech?.name ?? combo.partnerTechId}`,
          bonusDescription: combo.bonusDescription,
          effects,
        });
      }
    }

    return synergies;
  }

  // ── Knowledge Transfer ────────────────────────────────────────────────

  /**
   * Compute domain-to-domain knowledge-transfer spillovers for a set of
   * researched technologies.
   *
   * Each technology can spill knowledge from its primary `domain` into its
   * `secondaryDomains`.  The transfer rate is a base value augmented by the
   * tech's `espionageValue` (higher-value techs propagate more knowledge).
   * The `effectiveBoost` is the transfer rate multiplied by the tier of the
   * originating technology, representing stronger spillover from more
   * advanced research.
   *
   * @param researchedTechs Array of fully resolved TechnologyModel objects
   * @returns Array of {@link KnowledgeTransferResult} entries
   */
  computeKnowledgeTransfer(
    researchedTechs: TechnologyModel[],
  ): KnowledgeTransferResult[] {
    const results: KnowledgeTransferResult[] = [];

    for (const tech of researchedTechs) {
      const secondaryDomains = tech.secondaryDomains ?? [];
      if (secondaryDomains.length === 0) {
        continue;
      }

      const espionageValue = tech.knowledgeTransfer?.espionageValue ?? 0;
      const transferRate = Math.min(
        BASE_TRANSFER_RATE + espionageValue * ESPIONAGE_TRANSFER_SCALE,
        1.0,
      );
      const tier = tech.tier ?? 1;

      for (const targetDomain of secondaryDomains) {
        if (targetDomain === tech.domain) {
          continue;
        }

        const effectiveBoost = transferRate * tier;

        results.push({
          sourceDomain: tech.domain,
          targetDomain,
          transferRate,
          effectiveBoost,
        });
      }
    }

    return this.consolidateTransfers(results);
  }

  // ── Aggregate Effects ─────────────────────────────────────────────────

  /**
   * Combine all direct technology effects with active synergy bonus effects
   * into a single aggregate effects map.
   *
   * The following effect keys are extracted from each technology:
   * - Domain boosts (prefixed `domain:<domainKey>`)
   * - Military modifiers (`military:attack`, `military:defense`)
   * - Economic modifiers (`economic:gdpGrowth`, `economic:tradeEfficiency`,
   *   `economic:revenueMultiplier`)
   * - Social modifiers (`social:stability`, `social:softPower`,
   *   `social:education`)
   *
   * Synergy effects are then added on top.
   *
   * @param researchedTechs Resolved technology models
   * @param synergies       Active synergy bonuses
   * @returns Flat map of metric key → cumulative numeric value
   */
  aggregateEffects(
    researchedTechs: TechnologyModel[],
    synergies: TechSynergyBonus[],
  ): Record<string, number> {
    const effects: Record<string, number> = {};

    // ── Direct tech effects ──────────────────────────────────────────────
    for (const tech of researchedTechs) {
      if (!tech.effects) {
        continue;
      }

      // Domain boosts
      if (tech.effects.domainBoosts) {
        for (const [domain, value] of Object.entries(tech.effects.domainBoosts)) {
          if (value !== undefined) {
            const key = `domain:${domain}`;
            effects[key] = (effects[key] ?? 0) + value;
          }
        }
      }

      // Military modifiers
      if (tech.effects.militaryModifiers) {
        const mil = tech.effects.militaryModifiers;
        if (mil.attackBonus !== undefined) {
          effects['military:attack'] =
            (effects['military:attack'] ?? 0) + mil.attackBonus;
        }
        if (mil.defenseBonus !== undefined) {
          effects['military:defense'] =
            (effects['military:defense'] ?? 0) + mil.defenseBonus;
        }
      }

      // Economic modifiers
      if (tech.effects.economicModifiers) {
        const econ = tech.effects.economicModifiers;
        if (econ.gdpGrowthBonus !== undefined) {
          effects['economic:gdpGrowth'] =
            (effects['economic:gdpGrowth'] ?? 0) + econ.gdpGrowthBonus;
        }
        if (econ.tradeEfficiencyBonus !== undefined) {
          effects['economic:tradeEfficiency'] =
            (effects['economic:tradeEfficiency'] ?? 0) +
            econ.tradeEfficiencyBonus;
        }
        if (econ.revenueMultiplier !== undefined) {
          effects['economic:revenueMultiplier'] =
            (effects['economic:revenueMultiplier'] ?? 0) +
            econ.revenueMultiplier;
        }
      }

      // Social modifiers
      if (tech.effects.socialModifiers) {
        const soc = tech.effects.socialModifiers;
        if (soc.stabilityBonus !== undefined) {
          effects['social:stability'] =
            (effects['social:stability'] ?? 0) + soc.stabilityBonus;
        }
        if (soc.softPowerBonus !== undefined) {
          effects['social:softPower'] =
            (effects['social:softPower'] ?? 0) + soc.softPowerBonus;
        }
        if (soc.educationBonus !== undefined) {
          effects['social:education'] =
            (effects['social:education'] ?? 0) + soc.educationBonus;
        }
      }
    }

    // ── Synergy effects ──────────────────────────────────────────────────
    for (const synergy of synergies) {
      for (const [key, value] of Object.entries(synergy.effects)) {
        effects[key] = (effects[key] ?? 0) + value;
      }
    }

    return effects;
  }

  // ── Portfolio Analysis ────────────────────────────────────────────────

  /**
   * Perform a full portfolio analysis for a faction, combining synergy
   * discovery, knowledge-transfer computation, effect aggregation, and a
   * composite portfolio-strength score.
   *
   * **Portfolio strength** (0–100) is a weighted composite of:
   * - **Tier coverage** (40 %): fraction of max-tier points achieved
   *   across all researched techs.
   * - **Domain breadth** (35 %): fraction of all six tech domains
   *   represented in the portfolio.
   * - **Synergy density** (25 %): ratio of active synergies to total
   *   possible combination bonus slots, capped at 1.0.
   *
   * @param factionId        Faction whose portfolio is analysed
   * @param researchedTechIds IDs of technologies the faction has completed
   * @param techCatalog       Complete technology catalog keyed by techId
   * @returns Full {@link TechPortfolioAnalysis}
   */
  analyzePortfolio(
    factionId: FactionId,
    researchedTechIds: string[],
    techCatalog: Map<string, TechnologyModel>,
  ): TechPortfolioAnalysis {
    // Resolve models for all researched techs.
    const researchedTechs: TechnologyModel[] = [];
    for (const id of researchedTechIds) {
      const tech = techCatalog.get(id);
      if (tech) {
        researchedTechs.push(tech);
      }
    }

    const activeSynergies = this.discoverSynergies(
      researchedTechIds,
      techCatalog,
    );
    const knowledgeTransfers =
      this.computeKnowledgeTransfer(researchedTechs);
    const aggregateEffects = this.aggregateEffects(
      researchedTechs,
      activeSynergies,
    );

    const portfolioStrength = this.computePortfolioStrength(
      researchedTechs,
      activeSynergies,
    );

    return {
      factionId,
      totalResearchedCount: researchedTechs.length,
      activeSynergies,
      knowledgeTransfers,
      aggregateEffects,
      portfolioStrength,
    };
  }

  // ── Research Advancement ──────────────────────────────────────────────

  /**
   * Advance a research project by one turn and determine whether it
   * completes.
   *
   * The effective turns consumed per game turn are scaled by the nation's
   * current `techLevel`:
   *
   * ```
   * speedMultiplier = 1 + max(0, techLevel − 50) × 0.01
   * effectiveTurns  = 1 × speedMultiplier
   * newRemaining    = turnsRemaining − effectiveTurns
   * ```
   *
   * The `budgetAvailable` is consumed up to the project's
   * `investmentPerTurn`.  If insufficient budget is available the
   * project stalls (no progress).
   *
   * @param project         Current research project state
   * @param budgetAvailable Available treasury this turn for research
   * @param techLevel       Nation's aggregate technology level (0–100)
   * @returns Updated {@link ResearchResult}
   */
  advanceResearch(
    project: ResearchProject,
    budgetAvailable: number,
    techLevel: number,
  ): ResearchResult {
    // If budget is insufficient, the project stalls this turn.
    if (budgetAvailable < project.investmentPerTurn) {
      return {
        completed: false,
        techId: project.techId,
        turnsRemaining: project.turnsRemaining,
        newSynergies: [],
      };
    }

    const speedMultiplier =
      1 + Math.max(0, techLevel - TECH_LEVEL_SPEED_BASELINE) * TECH_LEVEL_SPEED_BONUS;

    const effectiveTurns = 1 * speedMultiplier;
    const newRemaining = Math.max(0, project.turnsRemaining - effectiveTurns);
    const completed = newRemaining <= 0;

    return {
      completed,
      techId: project.techId,
      turnsRemaining: Math.ceil(newRemaining),
      newSynergies: [],
    };
  }

  // ── Prerequisite Checking ─────────────────────────────────────────────

  /**
   * Check whether a technology's prerequisites are satisfied by the
   * nation's current set of completed research.
   *
   * @param techId            Technology to check
   * @param researchedTechIds IDs of already-completed technologies
   * @param techCatalog       Complete technology catalog keyed by techId
   * @returns Object with a boolean `canResearch` flag and an array of
   *          any `missingPrereqs` techIds
   */
  canResearch(
    techId: string,
    researchedTechIds: string[],
    techCatalog: Map<string, TechnologyModel>,
  ): { canResearch: boolean; missingPrereqs: string[] } {
    const tech = techCatalog.get(techId);
    if (!tech) {
      return { canResearch: false, missingPrereqs: [techId] };
    }

    // Already researched — nothing to do.
    if (researchedTechIds.includes(techId)) {
      return { canResearch: false, missingPrereqs: [] };
    }

    const missingPrereqs: string[] = [];
    const researchedSet = new Set(researchedTechIds);

    if (tech.prerequisites) {
      for (const prereq of tech.prerequisites) {
        if (!researchedSet.has(prereq.techId)) {
          missingPrereqs.push(prereq.techId);
        }
      }
    }

    return {
      canResearch: missingPrereqs.length === 0,
      missingPrereqs,
    };
  }

  // ── Research Cost ─────────────────────────────────────────────────────

  /**
   * Compute the effective research cost for a technology, applying a
   * domain-expertise discount based on how many technologies the nation
   * has already completed in the same domain.
   *
   * Discount formula:
   * ```
   * discount = min(existingDomainTechs × 0.05, 0.40)
   * effectiveCost = baseCost × (1 − discount)
   * ```
   *
   * @param tech               Technology whose cost is being computed
   * @param existingDomainTechs Number of already-completed techs in the
   *                            same primary domain
   * @returns Effective research cost (always ≥ 1)
   */
  computeResearchCost(
    tech: TechnologyModel,
    existingDomainTechs: number,
  ): number {
    const discount = Math.min(
      existingDomainTechs * PER_TECH_DOMAIN_DISCOUNT,
      MAX_DOMAIN_DISCOUNT,
    );
    const effectiveCost = tech.researchCost * (1 - discount);
    return Math.max(1, Math.round(effectiveCost * 100) / 100);
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Derive flat synergy-effect deltas from two technologies and a bonus
   * multiplier.
   *
   * The synergy effect for each metric key is computed as the *smaller*
   * of the two techs' values for that metric, scaled by
   * `(bonusMultiplier − 1)`.  This means the synergy provides an
   * *additional* bonus proportional to the weaker contributor, rewarding
   * balanced investment.
   *
   * @param source    Technology declaring the combination bonus
   * @param partner   Technology completing the pair (may be undefined)
   * @param multiplier Bonus multiplier from the combination definition
   * @returns Flat effects map
   */
  private deriveSynergyEffects(
    source: TechnologyModel,
    partner: TechnologyModel | undefined,
    multiplier: number,
  ): Record<string, number> {
    const effects: Record<string, number> = {};
    const scale = multiplier - 1;

    if (scale <= 0 || !partner) {
      return effects;
    }

    const sourceEffects = this.flattenEffects(source);
    const partnerEffects = this.flattenEffects(partner);

    // Collect all keys present in either tech.
    const allKeys = new Set([
      ...Object.keys(sourceEffects),
      ...Object.keys(partnerEffects),
    ]);

    for (const key of allKeys) {
      const sv = sourceEffects[key] ?? 0;
      const pv = partnerEffects[key] ?? 0;
      // Only produce a synergy when both techs contribute to the metric.
      if (sv !== 0 && pv !== 0) {
        effects[key] = Math.min(Math.abs(sv), Math.abs(pv)) * scale;
      }
    }

    return effects;
  }

  /**
   * Flatten a technology's `effects` block into a single
   * `Record<string, number>` with namespaced keys.
   *
   * @param tech Technology model to flatten
   * @returns Flat effects map
   */
  private flattenEffects(tech: TechnologyModel): Record<string, number> {
    const flat: Record<string, number> = {};
    if (!tech.effects) {
      return flat;
    }

    if (tech.effects.domainBoosts) {
      for (const [domain, value] of Object.entries(tech.effects.domainBoosts)) {
        if (value !== undefined) {
          flat[`domain:${domain}`] = value;
        }
      }
    }

    if (tech.effects.militaryModifiers) {
      const mil = tech.effects.militaryModifiers;
      if (mil.attackBonus !== undefined) {
        flat['military:attack'] = mil.attackBonus;
      }
      if (mil.defenseBonus !== undefined) {
        flat['military:defense'] = mil.defenseBonus;
      }
    }

    if (tech.effects.economicModifiers) {
      const econ = tech.effects.economicModifiers;
      if (econ.gdpGrowthBonus !== undefined) {
        flat['economic:gdpGrowth'] = econ.gdpGrowthBonus;
      }
      if (econ.tradeEfficiencyBonus !== undefined) {
        flat['economic:tradeEfficiency'] = econ.tradeEfficiencyBonus;
      }
      if (econ.revenueMultiplier !== undefined) {
        flat['economic:revenueMultiplier'] = econ.revenueMultiplier;
      }
    }

    if (tech.effects.socialModifiers) {
      const soc = tech.effects.socialModifiers;
      if (soc.stabilityBonus !== undefined) {
        flat['social:stability'] = soc.stabilityBonus;
      }
      if (soc.softPowerBonus !== undefined) {
        flat['social:softPower'] = soc.softPowerBonus;
      }
      if (soc.educationBonus !== undefined) {
        flat['social:education'] = soc.educationBonus;
      }
    }

    return flat;
  }

  /**
   * Consolidate multiple knowledge-transfer results that share the same
   * source→target domain pair by summing their effective boosts and
   * averaging their transfer rates.
   *
   * @param results Raw transfer results (may contain duplicate pairs)
   * @returns Deduplicated and consolidated results
   */
  private consolidateTransfers(
    results: KnowledgeTransferResult[],
  ): KnowledgeTransferResult[] {
    const map = new Map<
      string,
      { sourceDomain: string; targetDomain: string; rates: number[]; boosts: number[] }
    >();

    for (const r of results) {
      const key = `${r.sourceDomain}->${r.targetDomain}`;
      const entry = map.get(key);
      if (entry) {
        entry.rates.push(r.transferRate);
        entry.boosts.push(r.effectiveBoost);
      } else {
        map.set(key, {
          sourceDomain: r.sourceDomain,
          targetDomain: r.targetDomain,
          rates: [r.transferRate],
          boosts: [r.effectiveBoost],
        });
      }
    }

    const consolidated: KnowledgeTransferResult[] = [];
    for (const entry of map.values()) {
      const avgRate =
        entry.rates.reduce((sum, v) => sum + v, 0) / entry.rates.length;
      const totalBoost = entry.boosts.reduce((sum, v) => sum + v, 0);
      consolidated.push({
        sourceDomain: entry.sourceDomain,
        targetDomain: entry.targetDomain,
        transferRate: Math.round(avgRate * 1000) / 1000,
        effectiveBoost: Math.round(totalBoost * 1000) / 1000,
      });
    }

    return consolidated;
  }

  /**
   * Compute a composite portfolio-strength score (0–100).
   *
   * Components:
   * - **Tier coverage** (40 % weight): sum of each tech's tier divided by
   *   `(count × MAX_TIER)`.  Rewards investment in higher-tier techs.
   * - **Domain breadth** (35 % weight): number of distinct domains
   *   represented divided by total domain count (6).
   * - **Synergy density** (25 % weight): ratio of active synergies to
   *   total combination-bonus slots across all researched techs, capped
   *   at 1.0.
   *
   * @param researchedTechs Resolved technology models
   * @param synergies       Active synergy bonuses
   * @returns Score in the range [0, 100]
   */
  private computePortfolioStrength(
    researchedTechs: TechnologyModel[],
    synergies: TechSynergyBonus[],
  ): number {
    if (researchedTechs.length === 0) {
      return 0;
    }

    // ── Tier coverage (40 %) ─────────────────────────────────────────────
    const tierSum = researchedTechs.reduce(
      (sum, t) => sum + (t.tier ?? 1),
      0,
    );
    const maxTierPoints = researchedTechs.length * MAX_TIER;
    const tierCoverage = tierSum / maxTierPoints;

    // ── Domain breadth (35 %) ────────────────────────────────────────────
    const domains = new Set<string>();
    for (const tech of researchedTechs) {
      domains.add(tech.domain);
      if (tech.secondaryDomains) {
        for (const sd of tech.secondaryDomains) {
          domains.add(sd);
        }
      }
    }
    const domainBreadth = domains.size / ALL_DOMAINS.length;

    // ── Synergy density (25 %) ───────────────────────────────────────────
    let totalSlots = 0;
    for (const tech of researchedTechs) {
      totalSlots += tech.combinationBonuses?.length ?? 0;
    }
    const synergyDensity =
      totalSlots > 0
        ? Math.min(synergies.length / totalSlots, 1.0)
        : 0;

    // ── Weighted composite ───────────────────────────────────────────────
    const raw =
      tierCoverage * 40 +
      domainBreadth * 35 +
      synergyDensity * 25;

    return Math.min(100, Math.round(raw * 100) / 100);
  }
}
