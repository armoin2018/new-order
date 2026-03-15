/**
 * Religion Dynamics Engine — CNFL-3501
 *
 * Computes inter-religious tension, per-turn stability effects, policy
 * constraints imposed by dominant faiths, and stochastic religious events
 * (revivals, secularization, persecution) for every faction in the simulation.
 *
 * All methods are **pure functions** — no internal mutation, no side effects.
 * Stochastic event generation uses a deterministic seed-based RNG.
 *
 * @module engine/religion-dynamics
 * @see CNFL-3501 — Religion Dynamics Engine
 * @see DR-161 — Religion Profile Model
 */

import type {
  FactionId,
  ReligionProfile,
  PoliticalInfluenceLevel,
  TensionLevelReligion,
} from '@/data/types';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/** Runtime religion composition state tracked per nation each turn. */
export interface ReligionState {
  /** Which faction this religion state belongs to. */
  readonly factionId: FactionId;
  /** Breakdown of religious adherence within the nation. */
  readonly compositions: ReadonlyArray<{
    /** Identifier matching a ReligionProfile religionId. */
    readonly religionId: string;
    /** Percentage of population (0–100). All entries should sum to ~100. */
    readonly percentage: number;
  }>;
  /** The religionId of the dominant religion, or null if no clear majority. */
  readonly dominantReligionId: string | null;
  /** Aggregate religious tension level (0–100). */
  readonly religiousTensionLevel: number;
}

/** Result of a single turn's religion dynamics computation. */
export interface ReligionTurnResult {
  /** Faction this result applies to. */
  readonly factionId: FactionId;
  /** Change in tension level this turn (positive = rising). */
  readonly tensionDelta: number;
  /** Net stability modifier from religious dynamics this turn. */
  readonly stabilityImpact: number;
  /** Policy restrictions imposed by religious dynamics this turn. */
  readonly policyConstraints: readonly string[];
}

/** A stochastic religious event triggered during a turn. */
export interface ReligiousEvent {
  /** Category of the event. */
  readonly type:
    | 'conversion'
    | 'persecution'
    | 'revival'
    | 'secularization'
    | 'interfaith';
  /** Human-readable description of the event. */
  readonly description: string;
  /** Stability modifier caused by this event. */
  readonly stabilityEffect: number;
  /** Factions affected by this event. */
  readonly affectedFactions: readonly FactionId[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Numeric mapping for inter-religious tension levels from profile data. */
const TENSION_LEVEL_VALUES: Record<TensionLevelReligion, number> = {
  harmonious: 0,
  tolerant: 10,
  wary: 30,
  hostile: 60,
  violent: 90,
};

/** Numeric mapping for political influence levels. */
const POLITICAL_INFLUENCE_VALUES: Record<PoliticalInfluenceLevel, number> = {
  none: 0,
  minimal: 10,
  moderate: 30,
  significant: 60,
  dominant: 80,
  theocratic: 100,
};

/** Tension level above which stability penalties are applied. */
const TENSION_STABILITY_THRESHOLD = 40;

/** Stability penalty per tension point above the threshold. */
const TENSION_STABILITY_PENALTY_RATE = 0.15;

/** Maximum absolute stability impact from religion. */
const MAX_RELIGION_STABILITY_IMPACT = 20;

/** Tension level above which persecution events become possible. */
const PERSECUTION_TENSION_THRESHOLD = 70;

/** Tension level above which revival events become possible. */
const REVIVAL_TENSION_THRESHOLD = 80;

/** Stability level below which revival events become possible. */
const REVIVAL_STABILITY_THRESHOLD = 40;

/** Tension change per turn from natural decay (towards equilibrium). */
const TENSION_NATURAL_DECAY = 2;

/** Minimum percentage to be considered the dominant religion. */
const DOMINANCE_THRESHOLD = 40;

/** Low stability amplifier — instability magnifies religious tensions. */
const LOW_STABILITY_AMPLIFIER_THRESHOLD = 50;

/** Base event probability (0–1). Multiplied by tension and instability. */
const BASE_EVENT_PROBABILITY = 0.15;

// ---------------------------------------------------------------------------
// Deterministic RNG Helper
// ---------------------------------------------------------------------------

/**
 * Simple deterministic pseudo-random number generator using the
 * mulberry32 algorithm. Produces a value in [0, 1) from a seed.
 *
 * This is a lightweight inline version for use in pure functions
 * that need a single seeded roll without constructing a SeededRandom.
 *
 * @param seed Integer seed value
 * @returns    Object with `next()` that returns sequential deterministic values
 */
function createDeterministicRng(seed: number): { next: () => number } {
  let state = seed | 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless religion dynamics engine that computes inter-religious tensions,
 * stability impacts, policy constraints, and stochastic religious events.
 *
 * Every public method is a pure function — takes inputs, returns outputs,
 * mutates nothing.
 *
 * @see CNFL-3501 — Religion Dynamics Engine
 */
export class ReligionDynamicsEngine {
  // ── Tension Calculation ───────────────────────────────────────────────

  /**
   * Calculate the aggregate religious tension level for a nation based
   * on its religious composition and the inter-religious tension data
   * from the religion catalog.
   *
   * The algorithm:
   * 1. For each pair of religions present in the nation, look up the
   *    `interReligiousTensions` from both profiles.
   * 2. Weight the tension by the geometric mean of both religions'
   *    population percentages (larger co-present groups = more tension).
   * 3. Sum all pairwise tensions and normalise to 0–100.
   *
   * A nation with a single overwhelming majority (>90%) has minimal tension.
   * Diverse nations with historically hostile faiths have high tension.
   *
   * @param state          Current religion composition
   * @param religionCatalog Map of religionId → ReligionProfile
   * @returns              Tension level clamped to 0–100
   */
  computeTensionLevel(
    state: ReligionState,
    religionCatalog: Map<string, ReligionProfile>,
  ): number {
    const compositions = state.compositions.filter((c) => c.percentage > 0.5);

    // Single or no religion → minimal tension
    if (compositions.length <= 1) {
      return 0;
    }

    let totalWeightedTension = 0;
    let pairCount = 0;

    // Iterate over all unique pairs
    for (let i = 0; i < compositions.length; i++) {
      for (let j = i + 1; j < compositions.length; j++) {
        const compA = compositions[i];
        const compB = compositions[j];

        const profileA = religionCatalog.get(compA.religionId);
        const profileB = religionCatalog.get(compB.religionId);

        // Get bilateral tension — take the maximum of A→B and B→A
        const tensionAtoB = this.getInterReligiousTension(
          profileA ?? this.createNullProfile(compA.religionId),
          profileB ?? this.createNullProfile(compB.religionId),
        );

        // Weight by geometric mean of population shares
        const weight = Math.sqrt(
          (compA.percentage / 100) * (compB.percentage / 100),
        );

        totalWeightedTension += tensionAtoB * weight;
        pairCount++;
      }
    }

    if (pairCount === 0) {
      return 0;
    }

    // Normalise: average pairwise tension, scaled to 0–100
    const averageTension = totalWeightedTension / pairCount;

    return Math.min(100, Math.max(0, Math.round(averageTension)));
  }

  // ── Turn Advancement ──────────────────────────────────────────────────

  /**
   * Advance religion dynamics by one turn.
   *
   * Computes tension changes, stability impacts, and policy constraints.
   * Tension naturally decays towards a baseline but can spike from
   * instability amplification.
   *
   * @param state          Current religion state
   * @param religionCatalog Map of religionId → ReligionProfile
   * @param stability      Current national stability (0–100)
   * @returns              Turn result with tension delta and impacts
   */
  advanceTurn(
    state: ReligionState,
    religionCatalog: Map<string, ReligionProfile>,
    stability: number,
  ): ReligionTurnResult {
    // Compute the "natural" tension level from composition
    const equilibriumTension = this.computeTensionLevel(state, religionCatalog);

    // Low stability amplifies tension — instability stokes religious conflict
    const stabilityAmplifier =
      stability < LOW_STABILITY_AMPLIFIER_THRESHOLD
        ? 1 + (LOW_STABILITY_AMPLIFIER_THRESHOLD - stability) / 100
        : 1;

    const amplifiedEquilibrium = Math.min(
      100,
      equilibriumTension * stabilityAmplifier,
    );

    // Tension moves towards the amplified equilibrium, with natural decay/growth
    let tensionDelta: number;
    if (state.religiousTensionLevel < amplifiedEquilibrium) {
      // Tension rising towards equilibrium
      tensionDelta = Math.min(
        amplifiedEquilibrium - state.religiousTensionLevel,
        TENSION_NATURAL_DECAY * 2, // tension rises faster than it falls
      );
    } else {
      // Tension decaying towards equilibrium
      tensionDelta = -Math.min(
        state.religiousTensionLevel - amplifiedEquilibrium,
        TENSION_NATURAL_DECAY,
      );
    }

    const stabilityImpact = this.computeStabilityImpact(state, religionCatalog);

    const dominantProfile = state.dominantReligionId
      ? religionCatalog.get(state.dominantReligionId) ?? null
      : null;
    const policyConstraints = this.computePolicyConstraints(
      state,
      dominantProfile,
    );

    return {
      factionId: state.factionId,
      tensionDelta,
      stabilityImpact,
      policyConstraints,
    };
  }

  // ── Stability Impact ──────────────────────────────────────────────────

  /**
   * Compute religion's net effect on national stability.
   *
   * Factors:
   * - **High tension**: tension above threshold → direct stability penalty
   * - **Dominant religion stability modifier**: from gameplayModifiers
   * - **Charity modifier**: dominant religion's charityModifier → soft bonus
   * - **Social cohesion**: dominant religion's socialCohesionModifier
   *
   * @param state          Current religion state
   * @param religionCatalog Map of religionId → ReligionProfile
   * @returns              Stability modifier (negative = destabilising)
   */
  computeStabilityImpact(
    state: ReligionState,
    religionCatalog: Map<string, ReligionProfile>,
  ): number {
    let impact = 0;

    // Tension-based penalty
    if (state.religiousTensionLevel > TENSION_STABILITY_THRESHOLD) {
      const excessTension =
        state.religiousTensionLevel - TENSION_STABILITY_THRESHOLD;
      impact -= excessTension * TENSION_STABILITY_PENALTY_RATE;
    }

    // Dominant religion bonuses/penalties
    if (state.dominantReligionId) {
      const dominantProfile = religionCatalog.get(state.dominantReligionId);
      if (dominantProfile) {
        // Social cohesion modifier — applies when a religion is dominant
        impact += dominantProfile.socialCohesionModifier * 0.1;

        // Gameplay stability modifier
        const stabilityMod =
          dominantProfile.gameplayModifiers?.stabilityModifier ?? 0;
        impact += stabilityMod * 0.3;

        // Charity contributes to soft stability
        const charityMod =
          dominantProfile.gameplayModifiers?.charityModifier ?? 0;
        impact += charityMod * 0.05;
      }
    }

    // Religious diversity without high tension is slightly stabilising
    // (multicultural resilience)
    const significantReligions = state.compositions.filter(
      (c) => c.percentage >= 10,
    );
    if (
      significantReligions.length >= 3 &&
      state.religiousTensionLevel < TENSION_STABILITY_THRESHOLD
    ) {
      impact += 1; // Small diversity bonus
    }

    return Math.max(
      -MAX_RELIGION_STABILITY_IMPACT,
      Math.min(MAX_RELIGION_STABILITY_IMPACT, impact),
    );
  }

  // ── Policy Constraints ────────────────────────────────────────────────

  /**
   * Determine policy restrictions imposed by the dominant religion.
   *
   * Religions with "dominant" or "theocratic" political influence impose
   * constraints on secular reforms, education policy, and social liberalisation.
   *
   * @param state           Current religion state
   * @param dominantProfile Profile of the dominant religion (or null)
   * @returns               Array of policy constraint descriptions
   */
  computePolicyConstraints(
    state: ReligionState,
    dominantProfile: ReligionProfile | null,
  ): string[] {
    const constraints: string[] = [];

    if (!dominantProfile) {
      return constraints;
    }

    const influenceLevel = dominantProfile.politicalInfluence;
    const influenceValue = POLITICAL_INFLUENCE_VALUES[influenceLevel];

    // Only "significant", "dominant", or "theocratic" religions impose constraints
    if (influenceValue < POLITICAL_INFLUENCE_VALUES.significant) {
      return constraints;
    }

    // Reform resistance constraints
    const reformResistance =
      dominantProfile.gameplayModifiers?.reformResistance ?? 0;
    if (reformResistance > 50) {
      constraints.push(
        'Secular reform legislation faces strong religious opposition',
      );
    }
    if (reformResistance > 70) {
      constraints.push(
        'Progressive social policies require additional political capital',
      );
    }

    // Education attitude constraints
    const educationAttitude =
      dominantProfile.gameplayModifiers?.educationAttitude ?? 'neutral';
    if (educationAttitude === 'selective') {
      constraints.push(
        'Secular curriculum reforms face religious scrutiny — STEM programs may be delayed',
      );
    }
    if (educationAttitude === 'restrictive') {
      constraints.push(
        'Religious authorities restrict secular education — education reforms heavily penalised',
      );
    }

    // Science attitude constraints
    const scienceAttitude =
      dominantProfile.gameplayModifiers?.scienceAttitude ?? 'neutral';
    if (scienceAttitude === 'selective') {
      constraints.push(
        'Certain research domains (biotech, AI ethics) face religious scrutiny',
      );
    }
    if (scienceAttitude === 'anti-science') {
      constraints.push(
        'Scientific research programs face strong religious opposition — research costs increased',
      );
    }

    // Theocracy potential constraints
    const theocracyPotential =
      dominantProfile.gameplayModifiers?.theocracyPotential ?? 0;
    if (theocracyPotential > 60) {
      constraints.push(
        'Religious establishment demands influence over governance decisions',
      );
    }
    if (theocracyPotential > 80) {
      constraints.push(
        'Separation of church and state under threat — secular policies risk backlash',
      );
    }

    // Dominant/theocratic influence level constraints
    if (
      influenceLevel === 'dominant' ||
      influenceLevel === 'theocratic'
    ) {
      constraints.push(
        'Major policy decisions require tacit approval from religious leadership',
      );
    }
    if (influenceLevel === 'theocratic') {
      constraints.push(
        'Theocratic governance structure restricts all secular policy options',
      );
    }

    // High tension adds additional constraints
    if (state.religiousTensionLevel > PERSECUTION_TENSION_THRESHOLD) {
      constraints.push(
        'Inter-religious tension restricts minority rights legislation',
      );
    }

    return constraints;
  }

  // ── Inter-Religious Tension ───────────────────────────────────────────

  /**
   * Compute the bilateral tension between two specific religions.
   *
   * Looks up the `interReligiousTensions` array from both profiles and
   * returns the **maximum** tension found (asymmetric tensions are possible).
   * If no relationship data exists, returns a low default (wary).
   *
   * @param religionA First religion profile
   * @param religionB Second religion profile
   * @returns         Numeric tension value (0–100)
   */
  getInterReligiousTension(
    religionA: ReligionProfile,
    religionB: ReligionProfile,
  ): number {
    let maxTension = TENSION_LEVEL_VALUES.tolerant; // default if no data

    // Check A's view of B
    const aViewOfB = religionA.interReligiousTensions?.find(
      (t) => t.targetReligionId === religionB.religionId,
    );
    if (aViewOfB) {
      maxTension = Math.max(
        maxTension,
        TENSION_LEVEL_VALUES[aViewOfB.tensionLevel],
      );
    }

    // Check B's view of A
    const bViewOfA = religionB.interReligiousTensions?.find(
      (t) => t.targetReligionId === religionA.religionId,
    );
    if (bViewOfA) {
      maxTension = Math.max(
        maxTension,
        TENSION_LEVEL_VALUES[bViewOfA.tensionLevel],
      );
    }

    return maxTension;
  }

  // ── Stochastic Events ─────────────────────────────────────────────────

  /**
   * Check for and generate stochastic religious events this turn.
   *
   * Uses a deterministic RNG seeded from the provided `randomSeed` to
   * ensure reproducibility. Events are generated based on the current
   * tension level, stability, and religion profile characteristics.
   *
   * Possible events:
   * - **Revival**: High tension + low stability → religious revival movement
   * - **Persecution**: Very high tension → minority persecution
   * - **Secularization**: High education + stable → secular shift
   * - **Conversion**: Moderate tension + demographic trends → conversion wave
   * - **Interfaith**: Low tension + high stability → interfaith dialogue
   *
   * @param state          Current religion state
   * @param religionCatalog Map of religionId → ReligionProfile
   * @param stability      Current national stability (0–100)
   * @param randomSeed     Deterministic seed for event rolls
   * @returns              Array of generated events (may be empty)
   */
  checkForReligiousEvents(
    state: ReligionState,
    religionCatalog: Map<string, ReligionProfile>,
    stability: number,
    randomSeed: number,
  ): ReligiousEvent[] {
    const events: ReligiousEvent[] = [];
    const rng = createDeterministicRng(randomSeed);
    const factionId = state.factionId;
    const tension = state.religiousTensionLevel;

    // ── Revival Event ─────────────────────────────────────────────────
    // High tension + low stability → religious revival as coping mechanism
    if (
      tension > REVIVAL_TENSION_THRESHOLD &&
      stability < REVIVAL_STABILITY_THRESHOLD
    ) {
      const revivalProbability =
        BASE_EVENT_PROBABILITY *
        ((tension - REVIVAL_TENSION_THRESHOLD) / 20) *
        ((REVIVAL_STABILITY_THRESHOLD - stability) / 40);

      if (rng.next() < revivalProbability) {
        const dominantName = state.dominantReligionId
          ? religionCatalog.get(state.dominantReligionId)?.name ?? 'dominant faith'
          : 'dominant faith';

        events.push({
          type: 'revival',
          description: `A religious revival movement sweeps the nation as ${dominantName} adherents intensify worship amid instability.`,
          stabilityEffect: -3,
          affectedFactions: [factionId],
        });
      }
    }

    // ── Persecution Event ─────────────────────────────────────────────
    // Very high tension → dominant group persecutes minorities
    if (tension > PERSECUTION_TENSION_THRESHOLD) {
      const persecutionProbability =
        BASE_EVENT_PROBABILITY *
        ((tension - PERSECUTION_TENSION_THRESHOLD) / 30);

      if (rng.next() < persecutionProbability) {
        // Find the largest minority religion
        const sorted = [...state.compositions].sort(
          (a, b) => b.percentage - a.percentage,
        );
        const minorityReligion =
          sorted.length > 1
            ? religionCatalog.get(sorted[1].religionId)?.name ??
              'religious minorities'
            : 'religious minorities';

        events.push({
          type: 'persecution',
          description: `State-sanctioned or mob persecution targets ${minorityReligion}, drawing international condemnation.`,
          stabilityEffect: -5,
          affectedFactions: [factionId],
        });
      }
    }

    // ── Secularization Event ──────────────────────────────────────────
    // Stable + educated society → secular drift
    if (stability > 60 && tension < 30) {
      // Higher probability if dominant religion has low reform resistance
      let secularProbability = BASE_EVENT_PROBABILITY * 0.5;

      if (state.dominantReligionId) {
        const dominantProfile = religionCatalog.get(state.dominantReligionId);
        const reformResistance =
          dominantProfile?.gameplayModifiers?.reformResistance ?? 50;
        // Low reform resistance increases secularization chance
        secularProbability *= (100 - reformResistance) / 100;
      }

      if (rng.next() < secularProbability) {
        events.push({
          type: 'secularization',
          description:
            'A growing secular movement gains political traction, pushing for separation of religion and state.',
          stabilityEffect: 1,
          affectedFactions: [factionId],
        });
      }
    }

    // ── Conversion Event ──────────────────────────────────────────────
    // Moderate tension + rapidly growing religion → conversion wave
    if (tension >= 20 && tension <= 60) {
      const growingReligions = state.compositions.filter((c) => {
        const profile = religionCatalog.get(c.religionId);
        return (
          profile?.demographicTrend === 'growing' ||
          profile?.demographicTrend === 'rapid-growth'
        );
      });

      if (growingReligions.length > 0) {
        const conversionProbability = BASE_EVENT_PROBABILITY * 0.4;

        if (rng.next() < conversionProbability) {
          const growingName =
            religionCatalog.get(growingReligions[0].religionId)?.name ??
            'a growing faith';

          events.push({
            type: 'conversion',
            description: `A wave of conversions to ${growingName} reshapes the nation's religious landscape.`,
            stabilityEffect: -2,
            affectedFactions: [factionId],
          });
        }
      }
    }

    // ── Interfaith Dialogue Event ─────────────────────────────────────
    // Low tension + reasonable stability → positive interfaith initiative
    if (tension < 25 && stability > 50) {
      const interfaithProbability = BASE_EVENT_PROBABILITY * 0.3;

      if (rng.next() < interfaithProbability) {
        const significantReligions = state.compositions.filter(
          (c) => c.percentage >= 5,
        );

        if (significantReligions.length >= 2) {
          const names = significantReligions
            .slice(0, 3)
            .map(
              (c) =>
                religionCatalog.get(c.religionId)?.name ?? c.religionId,
            )
            .join(', ');

          events.push({
            type: 'interfaith',
            description: `An interfaith dialogue initiative between ${names} improves social cohesion and international reputation.`,
            stabilityEffect: 2,
            affectedFactions: [factionId],
          });
        }
      }
    }

    return events;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Create a minimal null-object religion profile for unknown religions.
   *
   * Used when a composition references a religionId not present in the
   * catalog, so tension calculations can proceed with safe defaults.
   *
   * @param religionId The unknown religion identifier
   * @returns          A minimal ReligionProfile with neutral values
   */
  private createNullProfile(religionId: string): ReligionProfile {
    return {
      schemaVersion: '1.0.0',
      religionId,
      name: religionId,
      description: 'Unknown religion profile — using neutral defaults.',
      adherentsGlobalPercent: 0,
      socialCohesionModifier: 0,
      politicalInfluence: 'none',
    };
  }
}
