/**
 * Population Dynamics Engine — CNFL-3500
 *
 * Handles per-turn population growth, workforce contribution, dependency
 * ratios, urbanization effects, migration flows, and population-driven
 * stability impacts for every faction in the simulation.
 *
 * All methods are **pure functions** — no internal mutation, no side effects.
 *
 * @module engine/population-engine
 * @see CNFL-3500 — Population Dynamics Engine
 * @see DR-159 — Population Demographics Model
 */

import type { FactionId, PopulationDemographics } from '@/data/types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Runtime population state tracked per nation each turn. */
export interface PopulationState {
  /** Which faction this population state belongs to. */
  readonly factionId: FactionId;
  /** Current total population in millions. */
  readonly currentPopulationMillions: number;
  /** Annual growth rate as a percentage (e.g. 0.5 = 0.5%). */
  readonly growthRatePercent: number;
  /** Age cohort distribution — percentages that should sum to ~100. */
  readonly ageDistribution: {
    /** Percentage aged 0–14. */
    readonly youth: number;
    /** Percentage aged 15–64. */
    readonly working: number;
    /** Percentage aged 65+. */
    readonly elderly: number;
  };
  /** Percentage of population living in urban areas (0–100). */
  readonly urbanizationRate: number;
  /** Net migration flow in millions (positive = net immigration). */
  readonly migrationFlowNet: number;
}

/** Result of a single turn's population computation. */
export interface PopulationTurnResult {
  /** Population at the start of the turn (millions). */
  readonly previousPopulation: number;
  /** Population at the end of the turn (millions). */
  readonly newPopulation: number;
  /** Absolute change in population (millions). */
  readonly growthDelta: number;
  /** Workforce contribution to GDP as a normalised factor (0–1+). */
  readonly economicImpact: number;
  /** Population-derived stability modifier (can be negative). */
  readonly stabilityImpact: number;
  /** Dependency ratio: (youth + elderly) / working. */
  readonly dependencyRatio: number;
}

/** A discrete migration event between two factions. */
export interface MigrationEvent {
  /** Faction people are migrating from. */
  readonly sourceFaction: FactionId;
  /** Faction people are migrating to. */
  readonly targetFaction: FactionId;
  /** Number of people migrating (in millions). */
  readonly amount: number;
  /** Human-readable cause of migration. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Urbanization percentage above which unrest risk increases. */
const URBANIZATION_UNREST_THRESHOLD = 70;

/** Maximum GDP bonus from urbanization (at 100%). */
const URBANIZATION_GDP_MAX_BONUS = 0.15;

/** Unrest modifier per percentage point of urbanization above the threshold. */
const URBANIZATION_UNREST_PER_POINT = 0.003;

/** Youth percentage threshold above which a "youth bulge" drives unrest. */
const YOUTH_BULGE_THRESHOLD = 35;

/** Unrest modifier per youth-percentage point above the bulge threshold. */
const YOUTH_BULGE_UNREST_PER_POINT = 0.5;

/** Dependency ratio above which economic drag is applied. */
const HIGH_DEPENDENCY_THRESHOLD = 0.7;

/** Stability penalty per unit of dependency ratio above threshold. */
const DEPENDENCY_STABILITY_PENALTY_RATE = 5;

/** Base stability modifier from population equilibrium. */
const BASE_STABILITY_MODIFIER = 0;

/** Maximum absolute stability impact from population factors. */
const MAX_STABILITY_IMPACT = 25;

/** Growth rate below which population decline penalties apply. */
const DECLINE_GROWTH_THRESHOLD = 0;

/** Stability penalty per negative growth-rate percentage point. */
const DECLINE_STABILITY_PENALTY_PER_POINT = 2;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless population dynamics engine that computes demographic changes,
 * workforce contributions, migration effects, and stability impacts.
 *
 * Every public method is a pure function — takes inputs, returns outputs,
 * mutates nothing.
 *
 * @see CNFL-3500 — Population Dynamics Engine
 */
export class PopulationEngine {
  // ── Core Turn Advancement ─────────────────────────────────────────────

  /**
   * Advance population state by one turn.
   *
   * Growth formula:
   *   `newPop = currentPop × (1 + growthRate / 100) + netMigration`
   *
   * The growth rate is modulated by the demographics' social stability
   * baseline — negative baselines suppress growth, positive ones amplify it.
   * Conflict (low socialStabilityBaseline) reduces growth.
   *
   * @param state        Current population state for the faction
   * @param demographics Static demographic profile for the nation
   * @returns            Turn result with new population, deltas, and impacts
   */
  advancePopulation(
    state: PopulationState,
    demographics: PopulationDemographics,
  ): PopulationTurnResult {
    const previousPopulation = state.currentPopulationMillions;

    // Modulate growth rate by social stability baseline (-50 to +50 → -0.5 to +0.5)
    const stabilityBaseline =
      demographics.gameplayModifiers?.socialStabilityBaseline ?? 0;
    const stabilityGrowthModifier = stabilityBaseline / 100;

    // Effective growth rate, clamped to prevent extreme swings
    const effectiveGrowthRate = Math.max(
      -5,
      Math.min(10, state.growthRatePercent + stabilityGrowthModifier),
    );

    // Core growth formula
    const naturalGrowth = previousPopulation * (effectiveGrowthRate / 100);
    const newPopulation = Math.max(
      0.001,
      previousPopulation + naturalGrowth + state.migrationFlowNet,
    );

    const growthDelta = newPopulation - previousPopulation;
    const economicImpact = this.computeWorkforceContribution(state);
    const dependencyRatio = this.computeDependencyRatio(state);
    const stabilityImpact = this.computeStabilityImpact(state, demographics);

    return {
      previousPopulation,
      newPopulation,
      growthDelta,
      economicImpact,
      stabilityImpact,
      dependencyRatio,
    };
  }

  // ── Workforce ─────────────────────────────────────────────────────────

  /**
   * Compute workforce contribution to GDP.
   *
   * The working-age percentage is the base, boosted by urbanization
   * (urban workers are more economically productive). Returns a
   * normalised factor where 1.0 represents the theoretical maximum of
   * a fully working-age, fully urbanised population.
   *
   * Formula:
   *   `(workingAge / 100) × (1 + urbanizationBonus)`
   *
   * @param state Current population state
   * @returns     Normalised workforce factor (typically 0.4–0.8)
   */
  computeWorkforceContribution(state: PopulationState): number {
    const workingAgeRatio = state.ageDistribution.working / 100;
    const urbanizationBonus =
      (state.urbanizationRate / 100) * URBANIZATION_GDP_MAX_BONUS;

    return workingAgeRatio * (1 + urbanizationBonus);
  }

  // ── Dependency ────────────────────────────────────────────────────────

  /**
   * Compute the dependency ratio: proportion of non-working population
   * (youth + elderly) to the working-age population.
   *
   * Higher values indicate more economic dependents per worker, which
   * drags on GDP growth and increases social spending pressure.
   *
   * Formula:
   *   `(youth + elderly) / working`
   *
   * @param state Current population state
   * @returns     Dependency ratio (typically 0.3–1.5; lower is better)
   */
  computeDependencyRatio(state: PopulationState): number {
    const { youth, working, elderly } = state.ageDistribution;

    // Guard against division by zero — if no working-age pop, ratio is maximal
    if (working <= 0) {
      return 10;
    }

    return (youth + elderly) / working;
  }

  // ── Urbanization ──────────────────────────────────────────────────────

  /**
   * Compute the dual-edged effects of urbanization.
   *
   * **Economic bonus**: Higher urbanization → more productive workforce,
   * scaling linearly up to {@link URBANIZATION_GDP_MAX_BONUS} at 100%.
   *
   * **Unrest modifier**: Urbanization above {@link URBANIZATION_UNREST_THRESHOLD}%
   * increases civil unrest risk. Dense urban populations are harder to
   * control and more prone to protest movements.
   *
   * @param state Current population state
   * @returns     Economic bonus (0–0.15) and unrest modifier (0+)
   */
  computeUrbanizationEffect(state: PopulationState): {
    economicBonus: number;
    unrestModifier: number;
  } {
    // Economic bonus scales linearly with urbanization
    const economicBonus =
      (state.urbanizationRate / 100) * URBANIZATION_GDP_MAX_BONUS;

    // Unrest risk kicks in above the threshold
    let unrestModifier = 0;
    if (state.urbanizationRate > URBANIZATION_UNREST_THRESHOLD) {
      const excessUrbanization =
        state.urbanizationRate - URBANIZATION_UNREST_THRESHOLD;
      unrestModifier = excessUrbanization * URBANIZATION_UNREST_PER_POINT;
    }

    return { economicBonus, unrestModifier };
  }

  // ── Migration ─────────────────────────────────────────────────────────

  /**
   * Apply a set of migration events to a population state.
   *
   * For each event where this faction is the **source**, population decreases.
   * For each event where this faction is the **target**, population increases.
   * The net migration flow is updated accordingly, and age distribution is
   * mildly shifted (migrants tend to be working-age).
   *
   * @param state  Current population state
   * @param events Migration events to process
   * @returns      Updated population state (new object — immutable)
   */
  applyMigration(
    state: PopulationState,
    events: MigrationEvent[],
  ): PopulationState {
    let netFlow = 0;

    for (const event of events) {
      if (event.targetFaction === state.factionId) {
        netFlow += event.amount;
      }
      if (event.sourceFaction === state.factionId) {
        netFlow -= event.amount;
      }
    }

    // No migration affecting this faction — return unchanged
    if (netFlow === 0) {
      return state;
    }

    const newPopulation = Math.max(
      0.001,
      state.currentPopulationMillions + netFlow,
    );

    // Migrants are predominantly working-age. Shift age distribution slightly.
    // For every 1% of population that migrates, working-age shifts by 0.5%.
    const migrationPercentOfPop =
      Math.abs(netFlow) / state.currentPopulationMillions;
    const ageShift = Math.min(migrationPercentOfPop * 0.5, 2); // cap at 2pp

    const sign = netFlow > 0 ? 1 : -1;

    // Compute shifted age distribution, ensuring values remain valid
    const rawYouth = state.ageDistribution.youth - sign * ageShift * 0.3;
    const rawElderly = state.ageDistribution.elderly - sign * ageShift * 0.7;
    const rawWorking = state.ageDistribution.working + sign * ageShift;

    // Normalise to ensure they still sum to ~100
    const total = rawYouth + rawWorking + rawElderly;
    const normFactor = total > 0 ? 100 / total : 1;

    return {
      factionId: state.factionId,
      currentPopulationMillions: newPopulation,
      growthRatePercent: state.growthRatePercent,
      ageDistribution: {
        youth: Math.max(0, rawYouth * normFactor),
        working: Math.max(0, rawWorking * normFactor),
        elderly: Math.max(0, rawElderly * normFactor),
      },
      urbanizationRate: state.urbanizationRate,
      migrationFlowNet: state.migrationFlowNet + netFlow,
    };
  }

  // ── Stability ─────────────────────────────────────────────────────────

  /**
   * Compute the net stability impact from population dynamics.
   *
   * Factors:
   * - **Youth bulge**: youth > 35% → unrest pressure
   * - **High dependency**: dependency ratio > 0.7 → economic drag → instability
   * - **Population decline**: negative growth → societal anxiety
   * - **Social baseline**: from demographics gameplayModifiers
   * - **Urbanization unrest**: high urbanization → harder to control
   *
   * @param state        Current population state
   * @param demographics Static demographic profile
   * @returns            Stability modifier (negative = destabilising)
   */
  computeStabilityImpact(
    state: PopulationState,
    demographics: PopulationDemographics,
  ): number {
    let impact = BASE_STABILITY_MODIFIER;

    // Social stability baseline from demographics (-50 to +50)
    const baselineModifier =
      demographics.gameplayModifiers?.socialStabilityBaseline ?? 0;
    impact += baselineModifier * 0.2; // Scale down: -10 to +10

    // Youth bulge penalty
    if (state.ageDistribution.youth > YOUTH_BULGE_THRESHOLD) {
      const excessYouth =
        state.ageDistribution.youth - YOUTH_BULGE_THRESHOLD;
      impact -= excessYouth * YOUTH_BULGE_UNREST_PER_POINT;
    }

    // High dependency ratio penalty
    const dependencyRatio = this.computeDependencyRatio(state);
    if (dependencyRatio > HIGH_DEPENDENCY_THRESHOLD) {
      const excessDependency = dependencyRatio - HIGH_DEPENDENCY_THRESHOLD;
      impact -= excessDependency * DEPENDENCY_STABILITY_PENALTY_RATE;
    }

    // Population decline penalty
    if (state.growthRatePercent < DECLINE_GROWTH_THRESHOLD) {
      const declineAmount = Math.abs(state.growthRatePercent);
      impact -= declineAmount * DECLINE_STABILITY_PENALTY_PER_POINT;
    }

    // Urbanization unrest contribution
    const { unrestModifier } = this.computeUrbanizationEffect(state);
    impact -= unrestModifier * 10; // Scale up for stability units

    // Inequality amplifier — high Gini coefficient worsens all negatives
    const gini = demographics.socialIndicators?.giniCoefficient ?? 0.35;
    if (impact < 0 && gini > 0.4) {
      const inequalityAmplifier = 1 + (gini - 0.4) * 2; // e.g. 0.5 gini → 1.2×
      impact *= inequalityAmplifier;
    }

    // Clamp to prevent extreme swings
    return Math.max(-MAX_STABILITY_IMPACT, Math.min(MAX_STABILITY_IMPACT, impact));
  }
}
