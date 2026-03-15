/**
 * Technology Problem Solver — CNFL-3303
 *
 * Uses available technology to solve in-game crises and challenges in the
 * "New Order" geopolitical simulation.  Given a crisis (pandemic, cyber-attack,
 * economic downturn, etc.) the solver identifies which researched technologies
 * can contribute a solution, ranks the options by effectiveness, and suggests
 * future research that would improve the nation's readiness.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module tech-problem-solver
 * @see FR-2802 — Technology-Based Crisis Resolution
 * @see CNFL-3303
 */

import type { FactionId, NationState } from '@/data/types';
import type { TechnologyModel, TechDomainKey } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range `[min, max]`.
 *
 * @param value - The raw value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of research suggestions returned. */
const MAX_SUGGESTIONS = 5;

/** Base cost coefficient applied to every solution. */
const BASE_COST_COEFFICIENT = 10;

/** Bonus effectiveness percentage when a tech's primary domain matches. */
const DOMAIN_MATCH_BONUS = 10;

/** Maximum tier value used for normalisation. */
const MAX_TIER = 5;

/** Impact-level weights used when sorting research suggestions. */
const IMPACT_WEIGHTS: Readonly<Record<string, number>> = {
  'paradigm-shift': 4,
  'breakthrough': 3,
  'significant': 2,
  'incremental': 1,
};

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Categories of problems tech can solve. */
export type ProblemCategory =
  | 'pandemic'
  | 'cyber-attack'
  | 'economic-crisis'
  | 'military-threat'
  | 'energy-crisis'
  | 'food-crisis'
  | 'environmental'
  | 'intelligence-failure'
  | 'social-unrest'
  | 'infrastructure-failure';

/** A problem presented to the tech solver. */
export interface TechProblem {
  readonly problemId: string;
  readonly category: ProblemCategory;
  /** Severity of the problem (0-100). */
  readonly severity: number;
  readonly description: string;
  readonly affectedFactionId: FactionId;
  /** Tech domains most relevant to solving this problem. */
  readonly relevantDomains: readonly TechDomainKey[];
  /** Minimum tech level required for any solution. */
  readonly minimumTechLevel: number;
}

/** A proposed technology-based solution. */
export interface TechSolution {
  readonly problemId: string;
  readonly solutionId: string;
  readonly description: string;
  /** Technologies used in this solution. */
  readonly requiredTechIds: readonly string[];
  /** Effectiveness percentage (0-100). */
  readonly effectiveness: number;
  /** Implementation time in turns. */
  readonly implementationTurns: number;
  /** Treasury cost to implement. */
  readonly cost: number;
  /** Side effects (positive or negative). */
  readonly sideEffects: readonly {
    readonly effect: string;
    readonly magnitude: number;
  }[];
}

/** Result of evaluating all available solutions for a problem. */
export interface ProblemSolvingResult {
  readonly problemId: string;
  readonly factionId: FactionId;
  /** Whether any solution exists. */
  readonly hasSolution: boolean;
  /** Best available solution (highest effectiveness). */
  readonly bestSolution: TechSolution | null;
  /** All available solutions ranked by effectiveness. */
  readonly availableSolutions: readonly TechSolution[];
  /** Technologies the nation would need to develop for better solutions. */
  readonly suggestedResearch: readonly string[];
  /** Overall tech readiness for this problem type (0-100). */
  readonly techReadiness: number;
}

// ---------------------------------------------------------------------------
// Static domain mapping
// ---------------------------------------------------------------------------

/**
 * Canonical mapping from each problem category to the tech domains that are
 * most relevant for resolving it.
 */
const PROBLEM_DOMAIN_MAP: Readonly<Record<ProblemCategory, readonly TechDomainKey[]>> = {
  'pandemic':                ['biotech'],
  'cyber-attack':            ['cyber'],
  'economic-crisis':         ['ai'],
  'military-threat':         ['ai', 'cyber', 'space', 'quantum', 'semiconductors'],
  'energy-crisis':           ['space'],
  'food-crisis':             ['biotech'],
  'environmental':           ['biotech', 'ai'],
  'intelligence-failure':    ['cyber', 'ai'],
  'social-unrest':           ['ai'],
  'infrastructure-failure':  ['semiconductors', 'cyber'],
};

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Technology Problem Solver engine.
 *
 * Evaluates whether a nation's completed research can address a given crisis,
 * generates ranked solutions, computes readiness scores, and recommends
 * future research to close capability gaps.
 */
export class TechProblemSolver {
  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Solve a given problem by evaluating the nation's completed technologies.
   *
   * 1. Maps the problem category to the required tech domains.
   * 2. Filters the tech catalogue down to completed technologies in
   *    relevant domains.
   * 3. Generates solutions from matching tech combinations.
   * 4. Ranks solutions by effectiveness (descending).
   * 5. Identifies missing techs that would improve the outcome.
   * 6. Computes an overall tech-readiness score.
   *
   * @param problem         - The crisis to solve.
   * @param completedTechIds - IDs of technologies the nation has researched.
   * @param techCatalog      - Full catalogue of all available technologies.
   * @param nation           - Current nation state snapshot.
   * @returns A {@link ProblemSolvingResult} with ranked solutions and advice.
   */
  solveProblem(
    problem: TechProblem,
    completedTechIds: readonly string[],
    techCatalog: readonly TechnologyModel[],
    nation: NationState,
  ): ProblemSolvingResult {
    const completedSet = new Set(completedTechIds);

    // Resolved relevant domains — union of problem's own list and static map.
    const mappedDomains = PROBLEM_DOMAIN_MAP[problem.category] ?? [];
    const relevantDomains = new Set<TechDomainKey>([
      ...problem.relevantDomains,
      ...mappedDomains,
    ]);

    // Completed techs whose primary or secondary domain intersects.
    const availableTechs = techCatalog.filter(
      (t) =>
        completedSet.has(t.techId) &&
        this.techMatchesDomains(t, relevantDomains),
    );

    // Generate & rank solutions.
    const solutions = this.generateSolutions(problem, availableTechs, nation)
      .slice()
      .sort((a, b) => b.effectiveness - a.effectiveness);

    const bestSolution = solutions.length > 0 ? solutions[0] : null;

    // Suggested research for uncompleted techs.
    const suggestedResearch = this.suggestResearch(
      problem,
      completedTechIds,
      techCatalog,
    );

    // Overall readiness.
    const techReadiness = this.evaluateTechReadiness(
      problem.category,
      completedTechIds,
      techCatalog,
    );

    return {
      problemId: problem.problemId,
      factionId: nation.factionId,
      hasSolution: solutions.length > 0,
      bestSolution,
      availableSolutions: solutions,
      suggestedResearch,
      techReadiness,
    };
  }

  /**
   * Generate concrete solutions from available technologies.
   *
   * Each relevant technology contributes an individual (partial) solution.
   * When multiple techs are available they are also combined into a
   * composite solution whose effectiveness exceeds any single technology.
   *
   * @param problem       - The crisis to address.
   * @param availableTechs - Technologies the nation has already completed
   *                         that are relevant to this problem.
   * @param nation         - Current nation state snapshot.
   * @returns An array of {@link TechSolution} objects (unsorted).
   */
  generateSolutions(
    problem: TechProblem,
    availableTechs: readonly TechnologyModel[],
    nation: NationState,
  ): readonly TechSolution[] {
    if (availableTechs.length === 0) {
      return [];
    }

    const solutions: TechSolution[] = [];

    // --- Individual solutions (one tech each) ---
    for (const tech of availableTechs) {
      const effectiveness = this.computeSolutionEffectiveness(
        [tech],
        problem,
        nation.techLevel,
      );

      const implementationTurns = Math.max(1, Math.ceil(problem.severity / 25));
      const cost =
        BASE_COST_COEFFICIENT *
        (tech.tier ?? 1) *
        (problem.severity / 100) *
        implementationTurns;

      const sideEffects = this.deriveSideEffects(tech, problem);

      solutions.push({
        problemId: problem.problemId,
        solutionId: `${problem.problemId}-${tech.techId}`,
        description: `Deploy ${tech.name} to address ${problem.category}.`,
        requiredTechIds: [tech.techId],
        effectiveness,
        implementationTurns,
        cost: Math.round(cost * 100) / 100,
        sideEffects,
      });
    }

    // --- Composite solution (all available techs combined) ---
    if (availableTechs.length > 1) {
      const compositeEffectiveness = this.computeSolutionEffectiveness(
        availableTechs,
        problem,
        nation.techLevel,
      );

      const avgTier =
        availableTechs.reduce((s, t) => s + (t.tier ?? 1), 0) /
        availableTechs.length;

      const implementationTurns = Math.max(
        1,
        Math.ceil(problem.severity / 20),
      );

      const cost =
        BASE_COST_COEFFICIENT *
        avgTier *
        (problem.severity / 100) *
        implementationTurns *
        0.8; // synergy discount

      const techNames = availableTechs.map((t) => t.name).join(', ');
      const allIds = availableTechs.map((t) => t.techId);

      solutions.push({
        problemId: problem.problemId,
        solutionId: `${problem.problemId}-composite`,
        description: `Integrated solution combining ${techNames} to address ${problem.category}.`,
        requiredTechIds: allIds,
        effectiveness: compositeEffectiveness,
        implementationTurns,
        cost: Math.round(cost * 100) / 100,
        sideEffects: [
          {
            effect: 'Cross-domain synergy bonus',
            magnitude: availableTechs.length * 2,
          },
        ],
      });
    }

    return solutions;
  }

  /**
   * Evaluate overall tech readiness for a given problem category.
   *
   * Readiness = (completed relevant techs / total relevant techs) × 100,
   * where "relevant" means the tech's primary or secondary domain intersects
   * the domains mapped to the category.
   *
   * @param category        - The problem category to evaluate.
   * @param completedTechIds - IDs of completed technologies.
   * @param techCatalog      - Full technology catalogue.
   * @returns A readiness score clamped to 0-100.
   */
  evaluateTechReadiness(
    category: ProblemCategory,
    completedTechIds: readonly string[],
    techCatalog: readonly TechnologyModel[],
  ): number {
    const domains = new Set<TechDomainKey>(
      PROBLEM_DOMAIN_MAP[category] ?? [],
    );

    const relevantTechs = techCatalog.filter((t) =>
      this.techMatchesDomains(t, domains),
    );

    if (relevantTechs.length === 0) {
      return 0;
    }

    const completedSet = new Set(completedTechIds);
    const completedRelevant = relevantTechs.filter((t) =>
      completedSet.has(t.techId),
    ).length;

    return clamp(
      Math.round((completedRelevant / relevantTechs.length) * 100),
      0,
      100,
    );
  }

  /**
   * Return the static mapping of problem categories to tech domains.
   *
   * This is the canonical reference used throughout the solver to determine
   * which technology domains are most applicable to each crisis type.
   *
   * @returns An immutable record keyed by {@link ProblemCategory}.
   */
  getProblemDomainMapping(): Readonly<Record<ProblemCategory, readonly TechDomainKey[]>> {
    return PROBLEM_DOMAIN_MAP;
  }

  /**
   * Compute solution effectiveness for a set of technologies applied to a
   * problem.
   *
   * Factors:
   * - **Base**: proportional to tech count relative to {@link MAX_TIER}.
   * - **Tier bonus**: average tier of provided techs (higher = better).
   * - **Domain match bonus**: extra points when a tech's primary domain is
   *   among the problem's relevant domains.
   * - **Nation tech-level multiplier**: scales result by the nation's
   *   aggregate tech level.
   * - **Severity penalty**: very severe problems are harder to fully solve.
   *
   * @param techs           - Technologies applied to the solution.
   * @param problem         - The target problem.
   * @param nationTechLevel - Nation's aggregate tech level (0-100).
   * @returns Effectiveness percentage clamped to 0-100.
   */
  computeSolutionEffectiveness(
    techs: readonly TechnologyModel[],
    problem: TechProblem,
    nationTechLevel: number,
  ): number {
    if (techs.length === 0) {
      return 0;
    }

    const relevantDomains = new Set<TechDomainKey>(problem.relevantDomains);

    // Base: each tech contributes proportionally, diminishing after MAX_TIER techs.
    const baseFraction = Math.min(techs.length / MAX_TIER, 1);
    const base = baseFraction * 50; // up to 50 points from count alone

    // Tier bonus: average tier scaled to 0-20.
    const avgTier =
      techs.reduce((sum, t) => sum + (t.tier ?? 1), 0) / techs.length;
    const tierBonus = (avgTier / MAX_TIER) * 20;

    // Domain match bonus.
    const matchingCount = techs.filter((t) =>
      relevantDomains.has(t.domain),
    ).length;
    const domainBonus = Math.min(
      (matchingCount / techs.length) * DOMAIN_MATCH_BONUS,
      DOMAIN_MATCH_BONUS,
    );

    // Nation tech-level multiplier (0.5 – 1.5).
    const techMultiplier = 0.5 + (nationTechLevel / 100);

    // Severity penalty: higher severity reduces ceiling.
    const severityFactor = 1 - (problem.severity / 200); // 0.5 – 1.0

    const raw = (base + tierBonus + domainBonus) * techMultiplier * severityFactor;

    return clamp(Math.round(raw), 0, 100);
  }

  /**
   * Suggest future research that would improve the nation's ability to
   * handle the given problem.
   *
   * Identifies technologies in the relevant domains that are **not** yet
   * completed, sorts by impact level (paradigm-shift first), and returns
   * the top {@link MAX_SUGGESTIONS} tech IDs.
   *
   * @param problem         - The crisis driving the suggestion.
   * @param completedTechIds - IDs of already-completed technologies.
   * @param techCatalog      - Full technology catalogue.
   * @returns Up to {@link MAX_SUGGESTIONS} tech IDs ordered by potential impact.
   */
  suggestResearch(
    problem: TechProblem,
    completedTechIds: readonly string[],
    techCatalog: readonly TechnologyModel[],
  ): readonly string[] {
    const completedSet = new Set(completedTechIds);
    const domains = new Set<TechDomainKey>([
      ...problem.relevantDomains,
      ...(PROBLEM_DOMAIN_MAP[problem.category] ?? []),
    ]);

    const candidates = techCatalog
      .filter(
        (t) =>
          !completedSet.has(t.techId) &&
          this.techMatchesDomains(t, domains),
      )
      .sort(
        (a, b) =>
          (IMPACT_WEIGHTS[b.impactLevel] ?? 0) -
          (IMPACT_WEIGHTS[a.impactLevel] ?? 0),
      );

    return candidates.slice(0, MAX_SUGGESTIONS).map((t) => t.techId);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Check whether a technology's primary or secondary domains intersect
   * with a given domain set.
   *
   * @param tech    - The technology to test.
   * @param domains - Set of domains to match against.
   * @returns `true` if any domain overlaps.
   */
  private techMatchesDomains(
    tech: TechnologyModel,
    domains: Set<TechDomainKey>,
  ): boolean {
    if (domains.has(tech.domain)) {
      return true;
    }
    if (tech.secondaryDomains) {
      return tech.secondaryDomains.some((d) => domains.has(d));
    }
    return false;
  }

  /**
   * Derive plausible side effects for a single-tech solution.
   *
   * Positive effects come from economic/social modifiers on the technology;
   * negative effects are inferred when the tech carries military modifiers
   * applied to a non-military problem.
   *
   * @param tech    - Technology being deployed.
   * @param problem - The problem context.
   * @returns Readonly array of side effects.
   */
  private deriveSideEffects(
    tech: TechnologyModel,
    problem: TechProblem,
  ): readonly { readonly effect: string; readonly magnitude: number }[] {
    const effects: { effect: string; magnitude: number }[] = [];

    if (tech.effects?.economicModifiers?.gdpGrowthBonus) {
      effects.push({
        effect: 'GDP growth stimulus',
        magnitude: tech.effects.economicModifiers.gdpGrowthBonus,
      });
    }

    if (tech.effects?.socialModifiers?.stabilityBonus) {
      effects.push({
        effect: 'Stability improvement',
        magnitude: tech.effects.socialModifiers.stabilityBonus,
      });
    }

    // Military tech repurposed for civilian crisis may cause tension.
    if (
      tech.effects?.militaryModifiers &&
      problem.category !== 'military-threat'
    ) {
      effects.push({
        effect: 'Civil-military tension',
        magnitude: -3,
      });
    }

    return effects;
  }
}
