/**
 * Leader Elections & Leadership Transitions Configuration — FR-4501 – FR-4506
 *
 * Default election cycles, formula weights, outcome thresholds,
 * transition effects, and democratic system classification.
 *
 * All game formulas are tunable here without code changes.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4501 — Default election cycle lengths per nation
 * @see FR-4502 — Election simulation formula weights
 * @see FR-4503 — Outcome threshold boundaries
 * @see FR-4504 — Non-democratic transition effect presets
 * @see FR-4505 — Transition effect application parameters
 */

import type { PoliticalSystemType } from '@/data/types/election.types';

export const electionConfig = {
  /**
   * Default election cycle lengths in months, keyed by nation code.
   * 0 = no elections (authoritarian / non-democratic).
   * @see FR-4501
   */
  defaultCycles: {
    us: 48,
    eu: 60,
    japan: 48,
    turkey: 48,
    iran: 0,
    china: 0,
    russia: 0,
    northkorea: 0,
  } as Readonly<Record<string, number>>,

  /**
   * Weights for the election simulation formula.
   *
   * incumbentScore = popularity × w_pop
   *                + econPerf × w_econ
   *                + unrest × w_unrest          (negative weight)
   *                + warWeariness × w_war       (negative weight)
   *                + powerBase × w_power
   *                + challengerStrength × w_chal (negative weight)
   *                + random(−range/2, +range/2)
   *
   * @see FR-4502
   */
  electionFormula: {
    weights: {
      popularity: 0.3,
      econPerf: 0.2,
      unrest: -0.15,
      warWeariness: -0.1,
      powerBase: 0.15,
      challengerStrength: -0.1,
    },
    randomRange: 10,
  },

  /**
   * Thresholds that classify the election outcome.
   *
   * - total < contestedMin  → challenger_wins
   * - total > contestedMax  → incumbent_wins
   * - otherwise             → contested
   *
   * @see FR-4503
   */
  outcomeThresholds: {
    contestedMin: 48,
    contestedMax: 52,
    incumbentWin: 50,
  },

  /**
   * Preset transition effects by transition type.
   * Each entry defines an immediate stability impact and transition duration in turns.
   *
   * @see FR-4504, FR-4505
   */
  transitionEffects: {
    election: { stabilityImpact: -5, economicImpact: -2, duration: 2 },
    coup: { stabilityImpact: -25, economicImpact: -15, duration: 6 },
    revolution: { stabilityImpact: -40, economicImpact: -30, duration: 12 },
    assassination: { stabilityImpact: -30, economicImpact: -10, duration: 4 },
    health: { stabilityImpact: -10, economicImpact: -5, duration: 3 },
  } as Readonly<Record<string, { stabilityImpact: number; economicImpact: number; duration: number }>>,

  /**
   * Political systems that hold regular elections.
   * Used by `isDemocratic()` to determine election eligibility.
   *
   * @see FR-4501
   */
  democraticSystems: [
    'liberal_democracy',
    'federal_republic',
    'parliamentary_democracy',
    'illiberal_democracy',
  ] as readonly PoliticalSystemType[],

  /**
   * Months before election turn at which the campaign is publicly announced.
   * Expressed as a fraction of the election cycle.
   */
  announcementLeadMonths: 6,
} as const;
