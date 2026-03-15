/**
 * Leader Elections & Leadership Transitions Engine — FR-4501 – FR-4506
 *
 * Pure, stateless functions that drive election simulation, outcome processing,
 * non-democratic transitions, and transition-effect application.
 *
 * All formulas are parameterised via `@/engine/config/election`.
 *
 * @see FR-4501 — Election cycle initialisation
 * @see FR-4502 — Election simulation formula
 * @see FR-4503 — Election outcome processing
 * @see FR-4504 — Non-democratic leadership transitions
 * @see FR-4505 — Transition effect application
 * @see FR-4506 — Transition advancement (turn tick)
 */

import type { FactionId, LeaderId, TurnNumber } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';
import type {
  PoliticalSystemType,
  ElectionState,
  ElectionResult,
  ElectionFormulaBreakdown,
  LeadershipTransitionType,
  LeadershipTransitionRecord,
  TransitionEffect,
} from '@/data/types/election.types';
import { electionConfig } from '@/engine/config/election';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a number between `min` and `max` (inclusive). */
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

// ── FR-4501 — Initialisation ────────────────────────────────────────────────

/**
 * Create the initial `ElectionState` for a nation.
 *
 * If the political system is non-democratic the cycle length is forced to 0
 * and election turns are set to `Infinity`.
 *
 * @param nationId       Faction / nation code.
 * @param politicalSystem Political system type for this nation.
 * @param cycleMonths    Optional override for election cycle length.
 * @returns A fresh `ElectionState`.
 *
 * @see FR-4501
 */
export function initializeElectionState(
  nationId: FactionId,
  politicalSystem: PoliticalSystemType,
  cycleMonths?: number,
): ElectionState {
  const democratic = isDemocratic(politicalSystem);
  const resolvedCycle =
    cycleMonths ??
    (electionConfig.defaultCycles[nationId] as number | undefined) ??
    0;
  const effectiveCycle = democratic ? resolvedCycle : 0;

  const nextElection = effectiveCycle > 0
    ? (effectiveCycle as unknown as TurnNumber)
    : (Infinity as unknown as TurnNumber);

  const announcement = effectiveCycle > 0
    ? (Math.max(1, effectiveCycle - electionConfig.announcementLeadMonths) as unknown as TurnNumber)
    : (Infinity as unknown as TurnNumber);

  return {
    nationCode: nationId,
    politicalSystem,
    electionCycleMonths: effectiveCycle,
    lastElectionTurn: 0 as unknown as TurnNumber,
    nextElectionTurn: nextElection,
    announcementTurn: announcement,
    incumbentPopularity: 50,
    challengerStrength: 30,
    electionResult: null,
    transitionTurnsRemaining: 0,
  };
}

// ── FR-4501 — System classification ─────────────────────────────────────────

/**
 * Returns `true` if the political system holds regular elections.
 *
 * @see FR-4501
 */
export function isDemocratic(system: PoliticalSystemType): boolean {
  return (electionConfig.democraticSystems as readonly string[]).includes(system);
}

// ── FR-4502 — Election timing checks ────────────────────────────────────────

/**
 * Determine whether an election is due on `currentTurn`.
 *
 * @see FR-4502
 */
export function isElectionDue(state: ElectionState, currentTurn: TurnNumber): boolean {
  if (state.electionCycleMonths <= 0) return false;
  return (currentTurn as unknown as number) >= (state.nextElectionTurn as unknown as number);
}

/**
 * Determine whether the election campaign has been publicly announced.
 *
 * @see FR-4502
 */
export function isElectionAnnounced(state: ElectionState, currentTurn: TurnNumber): boolean {
  if (state.electionCycleMonths <= 0) return false;
  return (currentTurn as unknown as number) >= (state.announcementTurn as unknown as number);
}

// ── FR-4502 — Election simulation ───────────────────────────────────────────

/**
 * Simulate an election, producing a detailed `ElectionResult`.
 *
 * The formula is:
 * ```
 * incumbentScore = popularity × w_pop
 *                + econPerf × w_econ
 *                + (100 − stability) × w_unrest   (w < 0 → penalty)
 *                + warWeariness × w_war            (w < 0 → penalty)
 *                + powerBase × w_power
 *                + challengerStrength × w_chal     (w < 0 → penalty)
 *                + random(−range/2, +range/2)
 * ```
 *
 * @param state        Current election state for the nation.
 * @param nationState  Subset of nation metrics required by the formula.
 * @param warWeariness War-weariness index (0–100).
 * @param powerBase    Incumbent's power-base strength (0–100).
 * @param rng          Deterministic RNG with a `next()` returning [0, 1).
 * @returns The `ElectionResult` with a full formula breakdown.
 *
 * @see FR-4502
 */
export function simulateElection(
  state: ElectionState,
  nationState: Pick<NationState, 'popularity' | 'stability' | 'gdp'>,
  warWeariness: number,
  powerBase: number,
  rng: { next(): number },
): ElectionResult {
  const w = electionConfig.electionFormula.weights;
  const range = electionConfig.electionFormula.randomRange;

  // Economic performance proxy: GDP normalised to 0–100 scale (capped).
  const econPerf = clamp(nationState.gdp / 100, 0, 100);
  // Unrest is the inverse of stability.
  const unrest = 100 - nationState.stability;

  const popularityContrib = nationState.popularity * w.popularity;
  const econContrib = econPerf * w.econPerf;
  const unrestContrib = unrest * w.unrest; // w.unrest is negative
  const warContrib = warWeariness * w.warWeariness; // negative weight
  const powerContrib = powerBase * w.powerBase;
  const chalContrib = state.challengerStrength * w.challengerStrength; // negative weight
  const randomDelta = (rng.next() - 0.5) * range;

  const total =
    popularityContrib +
    econContrib +
    unrestContrib +
    warContrib +
    powerContrib +
    chalContrib +
    randomDelta;

  const breakdown: ElectionFormulaBreakdown = {
    popularity: popularityContrib,
    econPerf: econContrib,
    unrest: unrestContrib,
    warWeariness: warContrib,
    powerBase: powerContrib,
    challengerStrength: chalContrib,
    randomDelta,
    total,
  };

  const thresholds = electionConfig.outcomeThresholds;
  let outcome: ElectionResult['outcome'];
  if (total >= thresholds.contestedMax) {
    outcome = 'incumbent_wins';
  } else if (total <= thresholds.contestedMin) {
    outcome = 'challenger_wins';
  } else {
    outcome = 'contested';
  }

  const result: ElectionResult = { formulaBreakdown: breakdown, outcome };
  if (outcome === 'challenger_wins') {
    result.newLeaderId = `challenger-${state.nationCode}` as unknown as LeaderId;
  }
  return result;
}

// ── FR-4503 — Outcome processing ────────────────────────────────────────────

/**
 * Process an election result: update the election state and, if the challenger
 * wins, produce a `LeadershipTransitionRecord`.
 *
 * @param state  Current `ElectionState` (pre-election).
 * @param result The `ElectionResult` from `simulateElection`.
 * @returns Updated state and an optional transition record.
 *
 * @see FR-4503
 */
export function processElectionOutcome(
  state: ElectionState,
  result: ElectionResult,
): { updatedState: ElectionState; transition: LeadershipTransitionRecord | null } {
  const currentTurn = state.nextElectionTurn;
  const cycle = state.electionCycleMonths;

  const nextElection = cycle > 0
    ? ((currentTurn as unknown as number) + cycle) as unknown as TurnNumber
    : (Infinity as unknown as TurnNumber);

  const nextAnnouncement = cycle > 0
    ? (Math.max(
        (currentTurn as unknown as number) + 1,
        (nextElection as unknown as number) - electionConfig.announcementLeadMonths,
      ) as unknown as TurnNumber)
    : (Infinity as unknown as TurnNumber);

  const effects = electionConfig.transitionEffects['election']!;

  const updatedState: ElectionState = {
    ...state,
    lastElectionTurn: currentTurn,
    nextElectionTurn: nextElection,
    announcementTurn: nextAnnouncement,
    electionResult: result,
    transitionTurnsRemaining:
      result.outcome === 'challenger_wins' ? effects.duration : 0,
  };

  let transition: LeadershipTransitionRecord | null = null;
  if (result.outcome === 'challenger_wins') {
    transition = {
      nationCode: state.nationCode,
      transitionType: 'election',
      previousLeaderId: `incumbent-${state.nationCode}` as unknown as LeaderId,
      newLeaderId: result.newLeaderId!,
      turn: currentTurn,
      stabilityImpact: effects.stabilityImpact,
      economicImpact: effects.economicImpact,
      affectedAlliances: [],
      transitionDuration: effects.duration,
      effects: [
        { dimension: 'stability', impact: effects.stabilityImpact },
        { dimension: 'gdp', impact: effects.economicImpact },
      ],
    };
  }

  return { updatedState, transition };
}

// ── FR-4504 — Non-democratic transitions ────────────────────────────────────

/**
 * Generate a `LeadershipTransitionRecord` for non-democratic transitions
 * (coups, revolutions, assassinations, health crises).
 *
 * @param nationCode Nation experiencing the transition.
 * @param type       Type of non-democratic transition.
 * @param turn       Turn on which the transition occurs.
 * @param rng        Deterministic RNG with a `next()` returning [0, 1).
 * @returns A fully-populated transition record.
 *
 * @see FR-4504
 */
export function processNonDemocraticTransition(
  nationCode: FactionId,
  type: LeadershipTransitionType,
  turn: TurnNumber,
  rng: { next(): number },
): LeadershipTransitionRecord {
  const preset = electionConfig.transitionEffects[type] ??
    electionConfig.transitionEffects['coup']!;

  // Add ±20 % variance to stability impact using the deterministic RNG.
  const variance = 1 + (rng.next() - 0.5) * 0.4;
  const stabilityImpact = Math.round(preset.stabilityImpact * variance);
  const economicImpact = Math.round(preset.economicImpact * variance);

  const effects: TransitionEffect[] = [
    { dimension: 'stability', impact: stabilityImpact },
    { dimension: 'gdp', impact: economicImpact },
    { dimension: 'diplomaticInfluence', impact: Math.round(stabilityImpact * 0.5) },
  ];

  return {
    nationCode,
    transitionType: type,
    previousLeaderId: `leader-${nationCode}` as unknown as LeaderId,
    newLeaderId: `new-leader-${nationCode}-${turn as unknown as number}` as unknown as LeaderId,
    turn,
    stabilityImpact,
    economicImpact,
    affectedAlliances: [],
    transitionDuration: preset.duration,
    effects,
  };
}

// ── FR-4505 — Apply transition effects to NationState ───────────────────────

/**
 * Apply the immediate effects of a leadership transition to a `NationState`.
 *
 * Stability and GDP are clamped to valid ranges after modification.
 *
 * @param nationState The current nation state (immutable — a new copy is returned).
 * @param transition  The transition record whose effects should be applied.
 * @returns A new `NationState` with effects applied.
 *
 * @see FR-4505
 */
export function applyTransitionEffects(
  nationState: NationState,
  transition: LeadershipTransitionRecord,
): NationState {
  const updated = { ...nationState };

  for (const effect of transition.effects) {
    switch (effect.dimension) {
      case 'stability':
        updated.stability = clamp(updated.stability + effect.impact, 0, 100);
        break;
      case 'gdp':
        updated.gdp = Math.max(0, updated.gdp + effect.impact);
        break;
      case 'diplomaticInfluence':
        updated.diplomaticInfluence = clamp(
          updated.diplomaticInfluence + effect.impact,
          0,
          100,
        );
        break;
      case 'popularity':
        updated.popularity = clamp(updated.popularity + effect.impact, 0, 100);
        break;
      case 'militaryReadiness':
        updated.militaryReadiness = clamp(
          updated.militaryReadiness + effect.impact,
          0,
          100,
        );
        break;
      case 'techLevel':
        updated.techLevel = clamp(updated.techLevel + effect.impact, 0, 100);
        break;
      default:
        // Unknown dimensions are silently ignored to avoid runtime errors.
        break;
    }
  }

  return updated;
}

// ── FR-4506 — Advance transition countdown ──────────────────────────────────

/**
 * Decrement `transitionTurnsRemaining` by one turn, flooring at 0.
 *
 * Call this once per turn tick for every nation with an active transition.
 *
 * @param state Current election state.
 * @returns Updated election state with decremented counter.
 *
 * @see FR-4506
 */
export function advanceTransition(state: ElectionState): ElectionState {
  if (state.transitionTurnsRemaining <= 0) return state;
  return {
    ...state,
    transitionTurnsRemaining: state.transitionTurnsRemaining - 1,
  };
}
