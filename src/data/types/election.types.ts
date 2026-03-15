/**
 * Leader Elections & Leadership Transitions Types — FR-4501 – FR-4506
 *
 * Type definitions for political systems, election cycles, election results,
 * leadership transitions (democratic and non-democratic), and transition effects.
 *
 * @see FR-4501 — Political system classification
 * @see FR-4502 — Election simulation formula
 * @see FR-4503 — Election outcome processing
 * @see FR-4504 — Non-democratic leadership transitions
 * @see FR-4505 — Transition effect application
 * @see FR-4506 — Transition advancement
 */

import type { FactionId, LeaderId, TurnNumber } from './enums';

// ---------------------------------------------------------------------------
// FR-4501 — Political System Classification
// ---------------------------------------------------------------------------

/**
 * Canonical set of political system types used to determine
 * whether elections occur and how leadership transitions work.
 */
export type PoliticalSystemType =
  | 'liberal_democracy'
  | 'federal_republic'
  | 'parliamentary_democracy'
  | 'illiberal_democracy'
  | 'absolute_monarchy'
  | 'theocratic'
  | 'communist_state'
  | 'military_junta';

// ---------------------------------------------------------------------------
// FR-4502 — Election State & Formula Breakdown
// ---------------------------------------------------------------------------

/**
 * Per-nation election cycle state tracked across turns.
 */
export interface ElectionState {
  /** Nation this election state belongs to. */
  readonly nationCode: FactionId;
  /** The political system governing transition rules. */
  politicalSystem: PoliticalSystemType;
  /** Months between elections (0 = no elections). */
  electionCycleMonths: number;
  /** Turn on which the last election occurred (0 as TurnNumber if none). */
  lastElectionTurn: TurnNumber;
  /** Turn on which the next election is scheduled. */
  nextElectionTurn: TurnNumber;
  /** Turn on which the election campaign is publicly announced (before the vote). */
  announcementTurn: TurnNumber;
  /** Current incumbent leader's approval rating snapshot. Range: 0–100. */
  incumbentPopularity: number;
  /** Aggregate opposition strength. Range: 0–100. */
  challengerStrength: number;
  /** Result of the most recent election, if any. */
  electionResult: ElectionResult | null;
  /** Turns remaining in an active leadership transition (0 = no active transition). */
  transitionTurnsRemaining: number;
}

/**
 * Detailed breakdown of an election simulation result.
 * @see FR-4502 — Election simulation formula
 */
export interface ElectionResult {
  /** Individual factor contributions used to compute the final score. */
  formulaBreakdown: ElectionFormulaBreakdown;
  /** Final outcome classification. */
  outcome: 'incumbent_wins' | 'challenger_wins' | 'contested';
  /** If a challenger wins, the new leader's ID. */
  newLeaderId?: LeaderId;
}

/**
 * Factor-by-factor breakdown of the election formula.
 * Each value is the weighted contribution (weight × raw input).
 */
export interface ElectionFormulaBreakdown {
  /** Weighted popularity contribution. */
  popularity: number;
  /** Weighted economic performance contribution. */
  econPerf: number;
  /** Weighted unrest penalty (negative). */
  unrest: number;
  /** Weighted war-weariness penalty (negative). */
  warWeariness: number;
  /** Weighted power-base contribution. */
  powerBase: number;
  /** Weighted challenger-strength penalty (negative). */
  challengerStrength: number;
  /** Random variance component. */
  randomDelta: number;
  /** Sum of all components — the final incumbent score. */
  total: number;
}

// ---------------------------------------------------------------------------
// FR-4504 — Leadership Transition Types
// ---------------------------------------------------------------------------

/**
 * How a leadership change occurs.
 */
export type LeadershipTransitionType =
  | 'election'
  | 'coup'
  | 'revolution'
  | 'assassination'
  | 'health';

// ---------------------------------------------------------------------------
// FR-4505 — Transition Record & Effects
// ---------------------------------------------------------------------------

/**
 * A single dimension-level effect caused by a leadership transition.
 */
export interface TransitionEffect {
  /** Which nation-state dimension is affected (e.g. 'stability', 'gdp'). */
  dimension: string;
  /** Additive impact on the dimension value. */
  impact: number;
}

/**
 * Full record of a leadership transition event.
 */
export interface LeadershipTransitionRecord {
  /** Nation experiencing the transition. */
  nationCode: FactionId;
  /** How the transition occurred. */
  transitionType: LeadershipTransitionType;
  /** Outgoing leader. */
  previousLeaderId: LeaderId;
  /** Incoming leader (may be same for failed transitions). */
  newLeaderId: LeaderId;
  /** Turn on which the transition began. */
  turn: TurnNumber;
  /** Direct stability delta applied immediately. */
  stabilityImpact: number;
  /** Direct economic (GDP) delta applied immediately. */
  economicImpact: number;
  /** Alliance IDs / nation codes whose relationships are perturbed. */
  affectedAlliances: FactionId[];
  /** Number of turns until full normalisation. */
  transitionDuration: number;
  /** Granular per-dimension effects applied over the transition. */
  effects: TransitionEffect[];
}
