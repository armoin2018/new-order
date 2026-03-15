/**
 * Regime Transition Engine — CNFL-3104, FR-2204
 *
 * Detects conditions that trigger political regime change (revolution, coup,
 * reform, external intervention, succession crisis), evaluates transition
 * probability based on a nation's current state and political system profile,
 * executes transitions by computing updated nation state with disruption
 * effects, and calculates reform pressure.
 *
 * All methods are pure functions — no side effects, no state mutation,
 * no DOM access, no RNG dependency. Numeric outputs are clamped to
 * sensible ranges.
 *
 * @module regime-transition-engine
 * @see CNFL-3104 — Regime Change Mechanics
 * @see FR-2204  — Regime Transition Execution
 */

import type { FactionId, NationState } from '@/data/types';
import type { PoliticalSystemProfile } from '@/data/types/model.types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The raw value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value, guaranteed to be within [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────────────────
// Exported Types
// ─────────────────────────────────────────────────────────

/** How a regime change occurs. */
export type TransitionType =
  | 'revolution'
  | 'coup'
  | 'reform'
  | 'external'
  | 'succession-crisis';

/**
 * Conditions that could trigger regime change evaluation.
 *
 * Captures the full situational context needed to assess whether a
 * nation's political system is at risk of involuntary or voluntary
 * transition.
 *
 * @see FR-2204
 */
export interface RegimeChangeConditions {
  /** Faction under evaluation. */
  readonly factionId: FactionId;

  /** Current nation state snapshot. */
  readonly nation: NationState;

  /** Active political system profile for the nation. */
  readonly currentSystem: PoliticalSystemProfile;

  /** Foreign military occupation percentage (0–100). */
  readonly foreignOccupation: number;

  /** Number of consecutive turns with stability below 20. */
  readonly turnsInCrisis: number;

  /** Whether a succession event has been triggered. */
  readonly successionTriggered: boolean;

  /** Popular demand for reform level (0–100). */
  readonly reformDemand: number;

  /** Military loyalty to current regime (0–100). */
  readonly militaryLoyalty: number;
}

/**
 * Evaluation result for regime change probability.
 *
 * Summarises the assessed risk, the most likely transition type, and
 * descriptive risk factors that contributed to the score.
 *
 * @see FR-2204
 */
export interface RegimeChangeEvaluation {
  /** Faction evaluated. */
  readonly factionId: FactionId;

  /** Overall transition probability (0–1). */
  readonly transitionProbability: number;

  /** The transition type with the highest individual probability. */
  readonly mostLikelyType: TransitionType;

  /** Human-readable risk factors that contributed to the score. */
  readonly riskFactors: readonly string[];

  /** Whether transition is considered imminent (probability > 0.7). */
  readonly isImminent: boolean;
}

/**
 * Options for executing a regime transition.
 *
 * @see FR-2204
 */
export interface TransitionParams {
  /** Faction undergoing transition. */
  readonly factionId: FactionId;

  /** How the transition occurs. */
  readonly transitionType: TransitionType;

  /** The political system being replaced. */
  readonly currentSystem: PoliticalSystemProfile;

  /** Identifier of the target political system (e.g. 'liberal-democracy'). */
  readonly targetSystemId: string;

  /** Nation state at the moment of transition. */
  readonly currentNation: NationState;
}

/**
 * Result of executing a regime transition.
 *
 * Contains the updated nation state, disruption metrics, and narrative
 * event strings for the game log.
 *
 * @see FR-2204
 */
export interface TransitionResult {
  /** Faction that transitioned. */
  readonly factionId: FactionId;

  /** Political system identifier that was replaced. */
  readonly previousSystemId: string;

  /** Political system identifier that is now active. */
  readonly newSystemId: string;

  /** How the transition occurred. */
  readonly transitionType: TransitionType;

  /** Nation state after transition effects have been applied. */
  readonly updatedNation: NationState;

  /** Number of turns of post-transition instability. */
  readonly chaosDuration: number;

  /** Stability points lost as a direct penalty. */
  readonly stabilityPenalty: number;

  /** Treasury cost in billions (USD equivalent). */
  readonly treasuryCost: number;

  /** Military readiness points lost. */
  readonly militaryReadinessLoss: number;

  /** Diplomatic influence points lost (negative = gained). */
  readonly diplomaticInfluenceLoss: number;

  /** Descriptive event strings for the game log / headline system. */
  readonly events: readonly string[];
}

/**
 * Maps a transition type from a given political system to plausible
 * target systems with associated chaos duration.
 *
 * @see FR-2204
 */
export interface TransitionPathway {
  /** Source political system identifier. */
  readonly fromSystemId: string;

  /** Transition mechanism. */
  readonly transitionType: TransitionType;

  /** Political system identifiers the transition could lead to. */
  readonly possibleTargets: readonly string[];

  /** Default number of turns of post-transition chaos. */
  readonly baseChaosDuration: number;
}

// ─────────────────────────────────────────────────────────
// Transition Map
// ─────────────────────────────────────────────────────────

/**
 * Static lookup of plausible transition pathways keyed by source system.
 *
 * Each entry describes one (fromSystem, transitionType) → targets mapping.
 * Used by {@link RegimeTransitionEngine.getTransitionPathways} and
 * {@link RegimeTransitionEngine.executeTransition}.
 */
const TRANSITION_MAP: readonly TransitionPathway[] = [
  // ── liberal-democracy ──────────────────────────────────
  { fromSystemId: 'liberal-democracy', transitionType: 'coup',       possibleTargets: ['authoritarian-republic'], baseChaosDuration: 4 },
  { fromSystemId: 'liberal-democracy', transitionType: 'reform',     possibleTargets: ['hybrid-regime'],          baseChaosDuration: 2 },
  { fromSystemId: 'liberal-democracy', transitionType: 'coup',       possibleTargets: ['military-junta'],         baseChaosDuration: 5 },

  // ── authoritarian-republic ─────────────────────────────
  { fromSystemId: 'authoritarian-republic', transitionType: 'revolution', possibleTargets: ['liberal-democracy'], baseChaosDuration: 6 },
  { fromSystemId: 'authoritarian-republic', transitionType: 'reform',     possibleTargets: ['liberal-democracy'], baseChaosDuration: 3 },
  { fromSystemId: 'authoritarian-republic', transitionType: 'coup',       possibleTargets: ['military-junta'],    baseChaosDuration: 3 },
  { fromSystemId: 'authoritarian-republic', transitionType: 'reform',     possibleTargets: ['one-party-state'],   baseChaosDuration: 2 },

  // ── communist-state ────────────────────────────────────
  { fromSystemId: 'communist-state', transitionType: 'revolution', possibleTargets: ['authoritarian-republic'], baseChaosDuration: 5 },
  { fromSystemId: 'communist-state', transitionType: 'reform',     possibleTargets: ['hybrid-regime'],          baseChaosDuration: 4 },

  // ── theocracy ──────────────────────────────────────────
  { fromSystemId: 'theocracy', transitionType: 'revolution', possibleTargets: ['hybrid-regime'],          baseChaosDuration: 5 },
  { fromSystemId: 'theocracy', transitionType: 'coup',       possibleTargets: ['authoritarian-republic'], baseChaosDuration: 4 },

  // ── military-junta ─────────────────────────────────────
  { fromSystemId: 'military-junta', transitionType: 'reform',     possibleTargets: ['authoritarian-republic'], baseChaosDuration: 3 },
  { fromSystemId: 'military-junta', transitionType: 'revolution', possibleTargets: ['liberal-democracy'],      baseChaosDuration: 7 },

  // ── one-party-state ────────────────────────────────────
  { fromSystemId: 'one-party-state', transitionType: 'reform',     possibleTargets: ['authoritarian-republic'], baseChaosDuration: 3 },
  { fromSystemId: 'one-party-state', transitionType: 'revolution', possibleTargets: ['liberal-democracy'],      baseChaosDuration: 8 },
  { fromSystemId: 'one-party-state', transitionType: 'reform',     possibleTargets: ['hybrid-regime'],          baseChaosDuration: 2 },

  // ── parliamentary-democracy (mirrors liberal-democracy) ─
  { fromSystemId: 'parliamentary-democracy', transitionType: 'coup',   possibleTargets: ['authoritarian-republic'], baseChaosDuration: 4 },
  { fromSystemId: 'parliamentary-democracy', transitionType: 'reform', possibleTargets: ['hybrid-regime'],          baseChaosDuration: 2 },
  { fromSystemId: 'parliamentary-democracy', transitionType: 'coup',   possibleTargets: ['military-junta'],         baseChaosDuration: 5 },

  // ── hybrid-regime ──────────────────────────────────────
  { fromSystemId: 'hybrid-regime', transitionType: 'coup',       possibleTargets: ['authoritarian-republic'], baseChaosDuration: 2 },
  { fromSystemId: 'hybrid-regime', transitionType: 'reform',     possibleTargets: ['liberal-democracy'],      baseChaosDuration: 4 },
  { fromSystemId: 'hybrid-regime', transitionType: 'coup',       possibleTargets: ['military-junta'],         baseChaosDuration: 3 },
  { fromSystemId: 'hybrid-regime', transitionType: 'revolution', possibleTargets: ['theocracy'],              baseChaosDuration: 5 },
];

// ─────────────────────────────────────────────────────────
// Constants — transition-type cost profiles
// ─────────────────────────────────────────────────────────

/** @internal Cost profile for a single transition type. */
interface TransitionCostProfile {
  readonly stabilityPenalty: number;
  readonly treasuryCostPct: number;
  readonly militaryReadinessLoss: number;
  readonly diplomaticInfluenceLoss: number;
  readonly baseChaosMin: number;
  readonly baseChaosMax: number;
}

/** Cost profiles keyed by transition type. */
const TRANSITION_COSTS: Record<TransitionType, TransitionCostProfile> = {
  revolution: {
    stabilityPenalty: 30,
    treasuryCostPct: 0.15,
    militaryReadinessLoss: 25,
    diplomaticInfluenceLoss: 20,
    baseChaosMin: 5,
    baseChaosMax: 8,
  },
  coup: {
    stabilityPenalty: 20,
    treasuryCostPct: 0.05,
    militaryReadinessLoss: 15,
    diplomaticInfluenceLoss: 15,
    baseChaosMin: 3,
    baseChaosMax: 5,
  },
  reform: {
    stabilityPenalty: 5,
    treasuryCostPct: 0.02,
    militaryReadinessLoss: 3,
    diplomaticInfluenceLoss: -5, // positive diplomatic outcome
    baseChaosMin: 1,
    baseChaosMax: 3,
  },
  external: {
    stabilityPenalty: 40,
    treasuryCostPct: 0.25,
    militaryReadinessLoss: 35,
    diplomaticInfluenceLoss: 30,
    baseChaosMin: 7,
    baseChaosMax: 10,
  },
  'succession-crisis': {
    stabilityPenalty: 15,
    treasuryCostPct: 0.03,
    militaryReadinessLoss: 10,
    diplomaticInfluenceLoss: 10,
    baseChaosMin: 2,
    baseChaosMax: 4,
  },
};

// ─────────────────────────────────────────────────────────
// Weight constants for probability computation
// ─────────────────────────────────────────────────────────

/** Weight of inverse-stability factor in probability computation. */
const W_STABILITY = 0.35;

/** Weight of crisis-turns factor in probability computation. */
const W_CRISIS_TURNS = 0.20;

/** Weight of military-disloyalty factor in probability computation. */
const W_MILITARY = 0.20;

/** Weight of occupation factor in probability computation. */
const W_OCCUPATION = 0.15;

/** Weight of reform-demand factor in probability computation. */
const W_REFORM = 0.10;

/** Crisis turns cap for normalisation. */
const CRISIS_TURNS_CAP = 10;

/** Low-stability amplifier threshold for chaos computation. */
const LOW_STABILITY_CHAOS_THRESHOLD = 25;

/** Extra chaos turns added when stability is critically low. */
const LOW_STABILITY_CHAOS_BONUS = 2;

// ─────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────

/**
 * Stateless engine that evaluates and executes political regime transitions.
 *
 * Every method is a pure function — no internal state, no side effects,
 * no dependency on global singletons or RNG.
 *
 * @see CNFL-3104 — Regime Change Mechanics
 * @see FR-2204  — Regime Transition Execution
 */
export class RegimeTransitionEngine {
  // ─────────────────────────────────────────────────────
  // evaluateRegimeChangeRisk
  // ─────────────────────────────────────────────────────

  /**
   * Evaluate the probability and most likely type of regime change for a
   * nation based on its current conditions.
   *
   * Individual trigger rules:
   * - **Revolution**: stability < 15 AND turnsInCrisis ≥ 3 AND militaryLoyalty < 40
   * - **Coup**: stability < 25 AND militaryLoyalty < 30
   * - **Reform**: reformDemand > 70 AND currentSystem.reformCapacity > 50
   * - **External**: foreignOccupation > 60
   * - **Succession crisis**: successionTriggered AND successionRisk > 50
   *
   * The overall transition probability is a weighted composite of inverse
   * stability, crisis duration, military disloyalty, occupation, and reform
   * demand. The most likely type is whichever individual trigger scores
   * highest.
   *
   * @param conditions - Full situational snapshot for the nation.
   * @returns Evaluation containing probability, most likely type, risk
   *          factors, and imminence flag.
   */
  evaluateRegimeChangeRisk(
    conditions: RegimeChangeConditions,
  ): RegimeChangeEvaluation {
    const { nation, currentSystem, foreignOccupation, turnsInCrisis, successionTriggered, reformDemand, militaryLoyalty } = conditions;
    const stability = nation.stability;

    // ── per-type probability & risk factor accumulation ──
    const typeScores: Record<TransitionType, number> = {
      revolution: 0,
      coup: 0,
      reform: 0,
      external: 0,
      'succession-crisis': 0,
    };
    const riskFactors: string[] = [];

    // Revolution
    if (stability < 15 && turnsInCrisis >= 3 && militaryLoyalty < 40) {
      const score =
        ((15 - stability) / 15) * 0.4 +
        (Math.min(turnsInCrisis, CRISIS_TURNS_CAP) / CRISIS_TURNS_CAP) * 0.35 +
        ((40 - militaryLoyalty) / 40) * 0.25;
      typeScores.revolution = clamp(score, 0, 1);
      riskFactors.push(`Stability critically low (${stability})`);
      riskFactors.push(`${turnsInCrisis} consecutive turns in crisis`);
      riskFactors.push(`Military loyalty dangerously low (${militaryLoyalty})`);
    }

    // Coup
    if (stability < 25 && militaryLoyalty < 30) {
      const score =
        ((25 - stability) / 25) * 0.5 +
        ((30 - militaryLoyalty) / 30) * 0.5;
      typeScores.coup = clamp(score, 0, 1);
      riskFactors.push(`Military loyalty insufficient to prevent coup (${militaryLoyalty})`);
      if (stability < 15) {
        riskFactors.push('Regime stability below coup-critical threshold');
      }
    }

    // Reform
    if (reformDemand > 70 && currentSystem.reformCapacity > 50) {
      const score =
        ((reformDemand - 70) / 30) * 0.6 +
        ((currentSystem.reformCapacity - 50) / 50) * 0.4;
      typeScores.reform = clamp(score, 0, 1);
      riskFactors.push(`Strong popular demand for reform (${reformDemand})`);
      riskFactors.push(`System reform capacity allows peaceful transition (${currentSystem.reformCapacity})`);
    }

    // External
    if (foreignOccupation > 60) {
      const score = (foreignOccupation - 60) / 40;
      typeScores.external = clamp(score, 0, 1);
      riskFactors.push(`Foreign military occupation at ${foreignOccupation}%`);
    }

    // Succession crisis
    if (successionTriggered && currentSystem.successionRisk > 50) {
      const score = (currentSystem.successionRisk - 50) / 50;
      typeScores['succession-crisis'] = clamp(score, 0, 1);
      riskFactors.push('Succession event triggered');
      riskFactors.push(`Succession risk elevated (${currentSystem.successionRisk})`);
    }

    // ── determine most likely type ──────────────────────
    let mostLikelyType: TransitionType = 'reform';
    let highestScore = -1;
    for (const [type, score] of Object.entries(typeScores) as [TransitionType, number][]) {
      if (score > highestScore) {
        highestScore = score;
        mostLikelyType = type;
      }
    }

    // ── composite probability from weighted factors ─────
    const stabilityFactor = (100 - stability) / 100;
    const crisisFactor = Math.min(turnsInCrisis, CRISIS_TURNS_CAP) / CRISIS_TURNS_CAP;
    const militaryFactor = (100 - militaryLoyalty) / 100;
    const occupationFactor = foreignOccupation / 100;
    const reformFactor = reformDemand / 100;

    const compositeRaw =
      W_STABILITY * stabilityFactor +
      W_CRISIS_TURNS * crisisFactor +
      W_MILITARY * militaryFactor +
      W_OCCUPATION * occupationFactor +
      W_REFORM * reformFactor;

    const transitionProbability = clamp(compositeRaw, 0, 1);

    return {
      factionId: conditions.factionId,
      transitionProbability,
      mostLikelyType,
      riskFactors,
      isImminent: transitionProbability > 0.7,
    };
  }

  // ─────────────────────────────────────────────────────
  // getTransitionPathways
  // ─────────────────────────────────────────────────────

  /**
   * Retrieve all plausible transition pathways from a given political
   * system.
   *
   * Returns an empty array for unrecognised system identifiers.
   *
   * @param fromSystemId - Political system identifier (e.g. 'theocracy').
   * @returns Immutable array of matching {@link TransitionPathway} entries.
   */
  getTransitionPathways(fromSystemId: string): readonly TransitionPathway[] {
    return TRANSITION_MAP.filter((p) => p.fromSystemId === fromSystemId);
  }

  // ─────────────────────────────────────────────────────
  // executeTransition
  // ─────────────────────────────────────────────────────

  /**
   * Execute a regime transition, returning the updated nation state and
   * disruption metrics.
   *
   * Cost profiles by transition type:
   * | Type               | Stability | Treasury  | Mil-Ready | Diplo-Inf | Chaos    |
   * |--------------------|-----------|-----------|-----------|-----------|----------|
   * | revolution         | −30       | 15% GDP   | −25       | −20       | 5–8 t   |
   * | coup               | −20       | 5% GDP    | −15       | −15       | 3–5 t   |
   * | reform             | −5        | 2% GDP    | −3        | **+5**    | 1–3 t   |
   * | external           | −40       | 25% GDP   | −35       | −30       | 7–10 t  |
   * | succession-crisis  | −15       | 3% GDP    | −10       | −10       | 2–4 t   |
   *
   * Values in the returned {@link NationState} are clamped to valid ranges.
   *
   * @param params - Transition execution parameters.
   * @returns Transition result with updated nation and event log.
   */
  executeTransition(params: TransitionParams): TransitionResult {
    const { factionId, transitionType, currentSystem, targetSystemId, currentNation } = params;
    const cost = TRANSITION_COSTS[transitionType];

    // ── chaos duration from pathway or fallback ─────────
    const pathway = TRANSITION_MAP.find(
      (p) =>
        p.fromSystemId === currentSystem.systemId &&
        p.transitionType === transitionType &&
        p.possibleTargets.includes(targetSystemId),
    );
    const chaosDuration = pathway
      ? this.computeTransitionChaos(transitionType, currentNation.stability)
      : this.computeTransitionChaos(transitionType, currentNation.stability);

    // ── compute raw penalties ───────────────────────────
    const stabilityPenalty = cost.stabilityPenalty;
    const treasuryCost = currentNation.gdp * cost.treasuryCostPct;
    const militaryReadinessLoss = cost.militaryReadinessLoss;
    const diplomaticInfluenceLoss = cost.diplomaticInfluenceLoss;

    // ── build updated nation state ──────────────────────
    const updatedNation: NationState = {
      ...currentNation,
      stability: clamp(currentNation.stability - stabilityPenalty, 0, 100),
      treasury: clamp(currentNation.treasury - treasuryCost, 0, Number.MAX_SAFE_INTEGER),
      militaryReadiness: clamp(currentNation.militaryReadiness - militaryReadinessLoss, 0, 100),
      diplomaticInfluence: clamp(
        currentNation.diplomaticInfluence - diplomaticInfluenceLoss,
        0,
        100,
      ),
    };

    // ── generate narrative events ───────────────────────
    const events = this.buildTransitionEvents(
      transitionType,
      currentSystem.systemName,
      targetSystemId,
      factionId,
      stabilityPenalty,
      chaosDuration,
    );

    return {
      factionId,
      previousSystemId: currentSystem.systemId,
      newSystemId: targetSystemId,
      transitionType,
      updatedNation,
      chaosDuration,
      stabilityPenalty,
      treasuryCost,
      militaryReadinessLoss,
      diplomaticInfluenceLoss,
      events,
    };
  }

  // ─────────────────────────────────────────────────────
  // computeTransitionChaos
  // ─────────────────────────────────────────────────────

  /**
   * Compute the number of turns of post-transition chaos.
   *
   * Uses the midpoint of the transition type's chaos range as a base,
   * then adds extra turns when current stability was already critically
   * low (below {@link LOW_STABILITY_CHAOS_THRESHOLD}).
   *
   * @param transitionType   - How the transition occurs.
   * @param currentStability - Nation stability at the moment of transition (0–100).
   * @returns Number of turns of instability (≥ 1).
   */
  computeTransitionChaos(
    transitionType: TransitionType,
    currentStability: number,
  ): number {
    const cost = TRANSITION_COSTS[transitionType];
    const baseChaos = Math.round((cost.baseChaosMin + cost.baseChaosMax) / 2);

    const lowStabilityBonus =
      currentStability < LOW_STABILITY_CHAOS_THRESHOLD
        ? LOW_STABILITY_CHAOS_BONUS
        : 0;

    return clamp(baseChaos + lowStabilityBonus, 1, cost.baseChaosMax + LOW_STABILITY_CHAOS_BONUS);
  }

  // ─────────────────────────────────────────────────────
  // getReformPressure
  // ─────────────────────────────────────────────────────

  /**
   * Compute the popular reform pressure on a nation's political system.
   *
   * Factors:
   * - Inverse of civil liberty index (low civil liberty → high pressure).
   * - Low popularity increases pressure; high popularity reduces it.
   * - High inflation increases pressure.
   * - Low reform capacity increases frustration.
   *
   * @param nation - Current nation state.
   * @param system - Active political system profile.
   * @returns Reform pressure score (0–100).
   */
  getReformPressure(
    nation: NationState,
    system: PoliticalSystemProfile,
  ): number {
    // Inverse civil liberty: 0 liberty → 100 pressure component
    const civilLibertyPressure = 100 - system.civilLibertyIndex;

    // Popularity modifier: high popularity (> 70) reduces pressure, low (< 30) increases it
    let popularityModifier = 0;
    if (nation.popularity > 70) {
      popularityModifier = -((nation.popularity - 70) / 30) * 25; // up to −25
    } else if (nation.popularity < 30) {
      popularityModifier = ((30 - nation.popularity) / 30) * 25; // up to +25
    }

    // Inflation pressure: linear 0–100 scaled to 0–20
    const inflationPressure = clamp(nation.inflation, 0, 100) * 0.2;

    // Reform capacity frustration: low capacity → more frustration
    const reformFrustration = (100 - system.reformCapacity) * 0.3;

    const raw =
      civilLibertyPressure * 0.35 +
      reformFrustration +
      inflationPressure +
      popularityModifier;

    return clamp(Math.round(raw), 0, 100);
  }

  // ─────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────

  /**
   * Build descriptive event strings for the game log.
   *
   * @param type           - Transition type.
   * @param systemName     - Human-readable name of the outgoing system.
   * @param targetId       - Identifier of the incoming system.
   * @param factionId      - Faction undergoing transition.
   * @param stabilityLoss  - Stability points lost.
   * @param chaosTurns     - Duration of post-transition instability.
   * @returns Immutable array of event strings.
   */
  private buildTransitionEvents(
    type: TransitionType,
    systemName: string,
    targetId: string,
    factionId: FactionId,
    stabilityLoss: number,
    chaosTurns: number,
  ): readonly string[] {
    const events: string[] = [];

    switch (type) {
      case 'revolution':
        events.push(`Revolution overthrows ${systemName} in ${factionId}`);
        events.push(`Popular uprising installs new ${targetId} government`);
        events.push(`${factionId} enters ${chaosTurns} turns of revolutionary chaos`);
        break;
      case 'coup':
        events.push(`Military coup topples ${systemName} in ${factionId}`);
        events.push(`Armed forces seize control, transitioning to ${targetId}`);
        events.push(`Stability drops by ${stabilityLoss} points as order is contested`);
        break;
      case 'reform':
        events.push(`Peaceful reform transforms ${systemName} in ${factionId}`);
        events.push(`Gradual institutional changes move ${factionId} toward ${targetId}`);
        events.push(`International community cautiously welcomes reform`);
        break;
      case 'external':
        events.push(`Foreign intervention forces regime change in ${factionId}`);
        events.push(`Occupation authorities impose transition from ${systemName} to ${targetId}`);
        events.push(`${factionId} faces ${chaosTurns} turns of occupation-driven instability`);
        break;
      case 'succession-crisis':
        events.push(`Succession crisis destabilises ${systemName} in ${factionId}`);
        events.push(`Power vacuum leads to transition toward ${targetId}`);
        events.push(`Rival factions contest leadership for ${chaosTurns} turns`);
        break;
    }

    return events;
  }
}
