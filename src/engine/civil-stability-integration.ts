/**
 * Civil Stability Integration Engine — CNFL-3503, FR-3001
 *
 * Integrates population demographics, religion dynamics, and economic
 * conditions into a unified civil stability pipeline.  Produces composite
 * stability modifiers per faction per turn that feed into the civil unrest
 * engine.
 *
 * Every method is a **pure function** — no shared mutable state.
 *
 * @module civil-stability-integration
 * @see CNFL-3503 — Civil Stability Integration
 * @see FR-3001  — Composite Stability Modifiers
 */

import type { FactionId, NationState } from '@/data/types';
import type {
  PopulationDemographics,
  ReligionProfile,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Clamp a numeric value to the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Population-derived stability factors. */
export interface PopulationStabilityFactors {
  readonly factionId: FactionId;
  /** Youth bulge pressure (high youth % + high unemployment → instability). */
  readonly youthBulgePressure: number; // 0-100
  /** Urbanization stress (rapid urbanization → unrest). */
  readonly urbanizationStress: number; // 0-100
  /** Dependency ratio burden (high elderly % strains economy). */
  readonly dependencyBurden: number; // 0-100
  /** Ethnic tension level from composition diversity. */
  readonly ethnicTension: number; // 0-100
  /** Net population stability modifier. */
  readonly netModifier: number; // -30 to +20
}

/** Religion-derived stability factors. */
export interface ReligionStabilityFactors {
  readonly factionId: FactionId;
  /** Inter-religious tension aggregate. */
  readonly interReligiousTension: number; // 0-100
  /** Religious reform resistance. */
  readonly reformResistance: number; // 0-100
  /** Religious social cohesion contribution. */
  readonly socialCohesion: number; // 0-100
  /** Theocratic pressure (desire to impose religious law). */
  readonly theocraticPressure: number; // 0-100
  /** Net religion stability modifier. */
  readonly netModifier: number; // -25 to +15
}

/** Economic-derived stability factors. */
export interface EconomicStabilityFactors {
  readonly factionId: FactionId;
  /** Inflation stress (high inflation → instability). */
  readonly inflationStress: number; // 0-100
  /** Inequality pressure (high Gini → unrest). */
  readonly inequalityPressure: number; // 0-100
  /** Treasury health (low treasury → instability). */
  readonly treasuryHealth: number; // 0-100
  /** Employment health. */
  readonly employmentHealth: number; // 0-100
  /** Net economic stability modifier. */
  readonly netModifier: number; // -30 to +20
}

/** Composite stability assessment combining all factors. */
export interface CompositeStabilityAssessment {
  readonly factionId: FactionId;
  readonly populationFactors: PopulationStabilityFactors;
  readonly religionFactors: ReligionStabilityFactors;
  readonly economicFactors: EconomicStabilityFactors;
  /** Combined modifier from all three domains. */
  readonly compositeModifier: number; // -50 to +30
  /** Weighted stability contribution breakdown. */
  readonly weights: {
    readonly population: number;
    readonly religion: number;
    readonly economic: number;
  };
  /** Most critical risk factor (highest negative contribution). */
  readonly criticalRisk: string | null;
  /** Risk level classification. */
  readonly riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  /** Narrative summary. */
  readonly summary: string;
}

/** Input for a stability turn computation. */
export interface StabilityTurnInput {
  readonly factionId: FactionId;
  readonly nation: NationState;
  readonly population: PopulationDemographics;
  readonly religions: readonly ReligionProfile[];
  /** Share of each religion in this nation (religionId → percent 0-100). */
  readonly religiousComposition: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default domain weights for composite scoring. */
const WEIGHTS = {
  population: 0.35,
  religion: 0.25,
  economic: 0.40,
} as const;

// ---------------------------------------------------------------------------
// Tension-level numeric mapping
// ---------------------------------------------------------------------------

const TENSION_LEVEL_SCORES: Record<string, number> = {
  harmonious: 0,
  tolerant: 15,
  wary: 40,
  hostile: 70,
  violent: 100,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that combines population, religion, and economic factors
 * into a unified stability assessment per faction per turn.
 *
 * @see CNFL-3503
 * @see FR-3001
 */
export class CivilStabilityIntegration {
  // ── Composite ─────────────────────────────────────────────────────────

  /**
   * Compute a full composite stability assessment for a single faction.
   *
   * Weights: population 35 %, religion 25 %, economic 40 %.
   *
   * @param input All demographic, religious, and economic inputs for the turn.
   * @returns Complete composite assessment with narrative summary.
   *
   * @see FR-3001
   */
  computeCompositeAssessment(
    input: StabilityTurnInput,
  ): CompositeStabilityAssessment {
    const populationFactors = this.computePopulationStabilityFactors(
      input.factionId,
      input.population,
      input.nation,
    );
    const religionFactors = this.computeReligionStabilityFactors(
      input.factionId,
      input.religions,
      input.religiousComposition,
    );
    const economicFactors = this.computeEconomicStabilityFactors(
      input.factionId,
      input.nation,
      input.population,
    );

    // Weighted composite modifier
    const rawComposite =
      populationFactors.netModifier * WEIGHTS.population +
      religionFactors.netModifier * WEIGHTS.religion +
      economicFactors.netModifier * WEIGHTS.economic;

    const compositeModifier = clamp(
      Math.round(rawComposite * 100) / 100,
      -50,
      30,
    );

    // Identify the most critical (most negative contribution) domain
    const contributions: { label: string; value: number }[] = [
      {
        label: 'population',
        value: populationFactors.netModifier * WEIGHTS.population,
      },
      {
        label: 'religion',
        value: religionFactors.netModifier * WEIGHTS.religion,
      },
      {
        label: 'economic',
        value: economicFactors.netModifier * WEIGHTS.economic,
      },
    ];

    const worstContribution = contributions.reduce(
      (worst, c) => (c.value < worst.value ? c : worst),
      contributions[0]!,
    );
    const criticalRisk =
      worstContribution.value < 0 ? worstContribution.label : null;

    const riskLevel = this.classifyRiskLevel(compositeModifier);

    const summary = this.generateSummary(
      input.factionId,
      compositeModifier,
      riskLevel,
      criticalRisk,
      populationFactors,
      religionFactors,
      economicFactors,
    );

    return {
      factionId: input.factionId,
      populationFactors,
      religionFactors,
      economicFactors,
      compositeModifier,
      weights: {
        population: WEIGHTS.population,
        religion: WEIGHTS.religion,
        economic: WEIGHTS.economic,
      },
      criticalRisk,
      riskLevel,
      summary,
    };
  }

  // ── Population Factors ────────────────────────────────────────────────

  /**
   * Compute population-derived stability factors.
   *
   * - **Youth bulge**: youth % > 30 AND unemployment > 15 → high pressure.
   * - **Urbanization stress**: urbanization > 70 adds stress, > 85 is high.
   * - **Dependency burden**: elderly % > 20 → increasing burden.
   * - **Ethnic tension**: from ethnic composition diversity, weighted by
   *   social cohesion (more groups of similar size = more tension).
   * - **Net modifier**: combines all factors.
   *
   * @param factionId  Faction identifier.
   * @param population Demographics data for the nation.
   * @param nation     Current nation state.
   * @returns Population stability factors.
   */
  computePopulationStabilityFactors(
    factionId: FactionId,
    population: PopulationDemographics,
    nation: NationState,
  ): PopulationStabilityFactors {
    const youthPercent = population.ageDistribution?.youth ?? 25;
    const elderlyPercent = population.ageDistribution?.elderly ?? 10;
    const unemployment =
      population.socialIndicators?.unemploymentRatePercent ?? 8;
    const urbanization = population.urbanizationPercent;
    const workforceQuality =
      population.gameplayModifiers?.workforceQuality ?? 50;

    // --- Youth bulge pressure ---
    let youthBulgePressure = 0;
    if (youthPercent > 30 && unemployment > 15) {
      // Both thresholds exceeded — strong pressure
      const youthExcess = youthPercent - 30;
      const unemploymentExcess = unemployment - 15;
      youthBulgePressure = clamp(
        (youthExcess * 1.5 + unemploymentExcess * 2.0),
        0,
        100,
      );
    } else if (youthPercent > 30) {
      // Only youth bulge — moderate pressure
      youthBulgePressure = clamp((youthPercent - 30) * 1.2, 0, 50);
    } else if (unemployment > 15) {
      // Only unemployment — mild pressure
      youthBulgePressure = clamp((unemployment - 15) * 1.5, 0, 40);
    }

    // --- Urbanization stress ---
    let urbanizationStress = 0;
    if (urbanization > 85) {
      urbanizationStress = clamp(50 + (urbanization - 85) * 3.3, 0, 100);
    } else if (urbanization > 70) {
      urbanizationStress = clamp((urbanization - 70) * 3.3, 0, 50);
    }

    // --- Dependency burden (elderly strain) ---
    let dependencyBurden = 0;
    if (elderlyPercent > 20) {
      dependencyBurden = clamp((elderlyPercent - 20) * 4.0, 0, 100);
    } else if (elderlyPercent > 15) {
      dependencyBurden = clamp((elderlyPercent - 15) * 2.0, 0, 20);
    }

    // --- Ethnic tension (diversity-based) ---
    const ethnicTension = this.computeEthnicTension(population);

    // --- Net modifier ---
    // Negative drivers: youth bulge, urbanization stress, dependency, ethnic tension
    // Positive driver: workforce quality above average
    const negativePressure =
      youthBulgePressure * 0.30 +
      urbanizationStress * 0.20 +
      dependencyBurden * 0.15 +
      ethnicTension * 0.35;

    const positiveContribution = clamp(
      ((workforceQuality - 50) / 50) * 20,
      0,
      20,
    );

    const netModifier = clamp(
      Math.round((positiveContribution - negativePressure * 0.5) * 100) / 100,
      -30,
      20,
    );

    return {
      factionId,
      youthBulgePressure: Math.round(youthBulgePressure * 100) / 100,
      urbanizationStress: Math.round(urbanizationStress * 100) / 100,
      dependencyBurden: Math.round(dependencyBurden * 100) / 100,
      ethnicTension: Math.round(ethnicTension * 100) / 100,
      netModifier,
    };
  }

  // ── Religion Factors ──────────────────────────────────────────────────

  /**
   * Compute religion-derived stability factors.
   *
   * - **Inter-religious tension**: weighted pairwise tension from profiles.
   * - **Reform resistance**: average `reformResistance` from gameplay mods.
   * - **Social cohesion**: weighted average `socialCohesionModifier`.
   * - **Theocratic pressure**: weighted average `theocracyPotential`.
   * - **Net modifier**: high cohesion is positive; high tension / theocratic
   *   pressure is negative.
   *
   * @param factionId   Faction identifier.
   * @param religions   All religion profiles present in the nation.
   * @param composition Map of religionId → percent share (0-100).
   * @returns Religion stability factors.
   */
  computeReligionStabilityFactors(
    factionId: FactionId,
    religions: readonly ReligionProfile[],
    composition: Readonly<Record<string, number>>,
  ): ReligionStabilityFactors {
    if (religions.length === 0) {
      return {
        factionId,
        interReligiousTension: 0,
        reformResistance: 0,
        socialCohesion: 50,
        theocraticPressure: 0,
        netModifier: 0,
      };
    }

    // --- Inter-religious tension (weighted pairwise) ---
    const interReligiousTension = this.computeInterReligiousTension(
      religions,
      composition,
    );

    // --- Reform resistance (weighted average) ---
    let reformResistanceSum = 0;
    let weightSum = 0;
    for (const religion of religions) {
      const share = composition[religion.religionId] ?? 0;
      const resistance =
        religion.gameplayModifiers?.reformResistance ?? 50;
      reformResistanceSum += resistance * share;
      weightSum += share;
    }
    const reformResistance = clamp(
      weightSum > 0 ? reformResistanceSum / weightSum : 50,
      0,
      100,
    );

    // --- Social cohesion (weighted average of socialCohesionModifier) ---
    let cohesionSum = 0;
    let cohesionWeightSum = 0;
    for (const religion of religions) {
      const share = composition[religion.religionId] ?? 0;
      cohesionSum += religion.socialCohesionModifier * share;
      cohesionWeightSum += share;
    }
    const socialCohesion = clamp(
      cohesionWeightSum > 0
        ? 50 + (cohesionSum / cohesionWeightSum) * 10
        : 50,
      0,
      100,
    );

    // --- Theocratic pressure (weighted average of theocracyPotential) ---
    let theocracySum = 0;
    let theocracyWeightSum = 0;
    for (const religion of religions) {
      const share = composition[religion.religionId] ?? 0;
      const potential =
        religion.gameplayModifiers?.theocracyPotential ?? 0;
      theocracySum += potential * share;
      theocracyWeightSum += share;
    }
    const theocraticPressure = clamp(
      theocracyWeightSum > 0 ? theocracySum / theocracyWeightSum : 0,
      0,
      100,
    );

    // --- Net modifier ---
    // Positive: social cohesion above 50 contributes positively
    // Negative: inter-religious tension, theocratic pressure
    const cohesionBonus = clamp(((socialCohesion - 50) / 50) * 15, 0, 15);
    const tensionPenalty = (interReligiousTension / 100) * 15;
    const theocracyPenalty = (theocraticPressure / 100) * 10;

    const netModifier = clamp(
      Math.round((cohesionBonus - tensionPenalty - theocracyPenalty) * 100) / 100,
      -25,
      15,
    );

    return {
      factionId,
      interReligiousTension: Math.round(interReligiousTension * 100) / 100,
      reformResistance: Math.round(reformResistance * 100) / 100,
      socialCohesion: Math.round(socialCohesion * 100) / 100,
      theocraticPressure: Math.round(theocraticPressure * 100) / 100,
      netModifier,
    };
  }

  // ── Economic Factors ──────────────────────────────────────────────────

  /**
   * Compute economic-derived stability factors.
   *
   * - **Inflation stress**: inflation > 10 starts adding stress; > 30 is severe.
   * - **Inequality pressure**: from Gini coefficient (> 0.4 problematic, > 0.6 severe).
   * - **Treasury health**: treasury / GDP ratio (< 0.05 is danger).
   * - **Employment health**: inverse of unemployment rate.
   * - **Net modifier**: good employment + low inflation → positive.
   *
   * @param factionId  Faction identifier.
   * @param nation     Current nation state.
   * @param population Demographics data (for unemployment & Gini).
   * @returns Economic stability factors.
   */
  computeEconomicStabilityFactors(
    factionId: FactionId,
    nation: NationState,
    population: PopulationDemographics,
  ): EconomicStabilityFactors {
    const inflation = nation.inflation;
    const gini = population.socialIndicators?.giniCoefficient ?? 0.35;
    const unemployment =
      population.socialIndicators?.unemploymentRatePercent ?? 8;
    const treasuryGdpRatio =
      nation.gdp > 0 ? nation.treasury / nation.gdp : 0;

    // --- Inflation stress ---
    let inflationStress = 0;
    if (inflation > 30) {
      inflationStress = clamp(50 + (inflation - 30) * 2.5, 0, 100);
    } else if (inflation > 10) {
      inflationStress = clamp((inflation - 10) * 2.5, 0, 50);
    }

    // --- Inequality pressure (Gini-based) ---
    let inequalityPressure = 0;
    if (gini > 0.6) {
      inequalityPressure = clamp(60 + (gini - 0.6) * 200, 0, 100);
    } else if (gini > 0.4) {
      inequalityPressure = clamp((gini - 0.4) * 300, 0, 60);
    }

    // --- Treasury health ---
    // Higher is healthier. A treasury/GDP ratio above 0.10 is comfortable.
    let treasuryHealth: number;
    if (treasuryGdpRatio >= 0.10) {
      treasuryHealth = clamp(60 + (treasuryGdpRatio - 0.10) * 400, 60, 100);
    } else if (treasuryGdpRatio >= 0.05) {
      treasuryHealth = clamp(30 + (treasuryGdpRatio - 0.05) * 600, 30, 60);
    } else {
      // Danger zone
      treasuryHealth = clamp(treasuryGdpRatio * 600, 0, 30);
    }

    // --- Employment health ---
    // 0% unemployment → 100 health; 25%+ → 0 health
    const employmentHealth = clamp(
      100 - unemployment * 4,
      0,
      100,
    );

    // --- Net modifier ---
    // Positive drivers: employment health, treasury health
    // Negative drivers: inflation stress, inequality pressure
    const positiveScore =
      (employmentHealth / 100) * 12 + (treasuryHealth / 100) * 8;
    const negativeScore =
      (inflationStress / 100) * 15 + (inequalityPressure / 100) * 15;

    const netModifier = clamp(
      Math.round((positiveScore - negativeScore) * 100) / 100,
      -30,
      20,
    );

    return {
      factionId,
      inflationStress: Math.round(inflationStress * 100) / 100,
      inequalityPressure: Math.round(inequalityPressure * 100) / 100,
      treasuryHealth: Math.round(treasuryHealth * 100) / 100,
      employmentHealth: Math.round(employmentHealth * 100) / 100,
      netModifier,
    };
  }

  // ── Apply Modifier ────────────────────────────────────────────────────

  /**
   * Apply the composite stability modifier to a nation's stability score.
   *
   * Returns a **new** `NationState` with the adjusted stability, clamped
   * to the 0–100 range.
   *
   * @param nation     Current nation state (not mutated).
   * @param assessment Composite stability assessment.
   * @returns New nation state with updated stability.
   */
  applyStabilityModifier(
    nation: NationState,
    assessment: CompositeStabilityAssessment,
  ): NationState {
    const newStability = clamp(
      nation.stability + assessment.compositeModifier,
      0,
      100,
    );

    return {
      ...nation,
      stability: Math.round(newStability * 100) / 100,
    };
  }

  // ── Risk Classification ───────────────────────────────────────────────

  /**
   * Classify a composite modifier into a risk level.
   *
   * | Modifier          | Level      |
   * |-------------------|------------|
   * | > 5               | low        |
   * | > −5              | moderate   |
   * | > −20             | high       |
   * | ≤ −20             | critical   |
   *
   * @param compositeModifier The composite stability modifier.
   * @returns Risk level classification.
   */
  classifyRiskLevel(
    compositeModifier: number,
  ): 'low' | 'moderate' | 'high' | 'critical' {
    if (compositeModifier > 5) return 'low';
    if (compositeModifier > -5) return 'moderate';
    if (compositeModifier > -20) return 'high';
    return 'critical';
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Compute ethnic tension from ethnic composition diversity.
   *
   * Uses a Herfindahl-style fragmentation index: more groups of similar
   * size produce higher tension, reduced by average social-cohesion scores.
   *
   * @param population Demographics with optional ethnic composition.
   * @returns Ethnic tension score (0-100).
   */
  private computeEthnicTension(
    population: PopulationDemographics,
  ): number {
    const groups = population.ethnicComposition;
    if (!groups || groups.length <= 1) {
      return 0; // Homogeneous — no inter-group tension
    }

    // Herfindahl index: sum of squared shares (lower = more fragmented)
    const totalShare = groups.reduce(
      (sum, g) => sum + g.percentOfPopulation,
      0,
    );
    if (totalShare <= 0) return 0;

    const herfindahl = groups.reduce((sum, g) => {
      const share = g.percentOfPopulation / totalShare;
      return sum + share * share;
    }, 0);

    // Fragmentation = 1 − HHI  (ranges 0..1; higher = more fragmented)
    const fragmentation = 1 - herfindahl;

    // Average social-cohesion across groups (default 50 if absent)
    const avgCohesion =
      groups.reduce((s, g) => s + (g.socialCohesion ?? 50), 0) /
      groups.length;

    // Cohesion dampening: high cohesion reduces tension
    const cohesionDampening = clamp(avgCohesion / 100, 0, 1);

    // Raw tension: fragmentation drives tension, cohesion dampens it
    const rawTension = fragmentation * 100 * (1 - cohesionDampening * 0.6);

    return clamp(Math.round(rawTension * 100) / 100, 0, 100);
  }

  /**
   * Compute inter-religious tension as a weighted pairwise aggregate.
   *
   * For every ordered pair (A, B) of religions present in the nation,
   * looks up the tension level A has towards B, converts to a numeric
   * score, and weights by the product of their population shares.
   *
   * @param religions   Religion profiles.
   * @param composition religionId → percent share.
   * @returns Aggregate inter-religious tension (0-100).
   */
  private computeInterReligiousTension(
    religions: readonly ReligionProfile[],
    composition: Readonly<Record<string, number>>,
  ): number {
    if (religions.length < 2) return 0;

    let tensionWeightedSum = 0;
    let pairWeightSum = 0;

    for (const source of religions) {
      const sourceShare = composition[source.religionId] ?? 0;
      if (sourceShare <= 0 || !source.interReligiousTensions) continue;

      for (const target of religions) {
        if (source.religionId === target.religionId) continue;
        const targetShare = composition[target.religionId] ?? 0;
        if (targetShare <= 0) continue;

        // Find the tension entry for this pair
        const entry = source.interReligiousTensions.find(
          (t) => t.targetReligionId === target.religionId,
        );

        const numericTension = entry
          ? (TENSION_LEVEL_SCORES[entry.tensionLevel] ?? 0)
          : 0;

        const pairWeight = (sourceShare / 100) * (targetShare / 100);
        tensionWeightedSum += numericTension * pairWeight;
        pairWeightSum += pairWeight;
      }
    }

    if (pairWeightSum <= 0) return 0;

    return clamp(
      Math.round((tensionWeightedSum / pairWeightSum) * 100) / 100,
      0,
      100,
    );
  }

  /**
   * Generate a human-readable narrative summary.
   *
   * @param factionId         Faction identifier.
   * @param compositeModifier Overall modifier value.
   * @param riskLevel         Classified risk level.
   * @param criticalRisk      Most negative domain (or null).
   * @param pop               Population factors.
   * @param rel               Religion factors.
   * @param econ              Economic factors.
   * @returns Narrative string.
   */
  private generateSummary(
    factionId: FactionId,
    compositeModifier: number,
    riskLevel: 'low' | 'moderate' | 'high' | 'critical',
    criticalRisk: string | null,
    pop: PopulationStabilityFactors,
    rel: ReligionStabilityFactors,
    econ: EconomicStabilityFactors,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Faction ${factionId}: composite modifier ${compositeModifier >= 0 ? '+' : ''}${compositeModifier.toFixed(2)}, risk level ${riskLevel}.`,
    );

    if (criticalRisk) {
      parts.push(`Primary risk domain: ${criticalRisk}.`);
    }

    // Highlight notable pressures
    if (pop.youthBulgePressure > 50) {
      parts.push(
        `Youth bulge pressure is elevated (${pop.youthBulgePressure.toFixed(1)}).`,
      );
    }
    if (pop.ethnicTension > 40) {
      parts.push(
        `Ethnic tension is notable (${pop.ethnicTension.toFixed(1)}).`,
      );
    }
    if (rel.interReligiousTension > 50) {
      parts.push(
        `Inter-religious tension is high (${rel.interReligiousTension.toFixed(1)}).`,
      );
    }
    if (rel.theocraticPressure > 60) {
      parts.push(
        `Theocratic pressure is significant (${rel.theocraticPressure.toFixed(1)}).`,
      );
    }
    if (econ.inflationStress > 50) {
      parts.push(
        `Inflation stress is severe (${econ.inflationStress.toFixed(1)}).`,
      );
    }
    if (econ.inequalityPressure > 40) {
      parts.push(
        `Inequality pressure is elevated (${econ.inequalityPressure.toFixed(1)}).`,
      );
    }
    if (econ.treasuryHealth < 30) {
      parts.push(
        `Treasury health is critically low (${econ.treasuryHealth.toFixed(1)}).`,
      );
    }

    // Positive highlights
    if (econ.employmentHealth > 80) {
      parts.push('Employment conditions are strong.');
    }
    if (rel.socialCohesion > 70) {
      parts.push('Religious social cohesion is a stabilising factor.');
    }

    return parts.join(' ');
  }
}
