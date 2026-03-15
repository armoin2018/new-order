/**
 * Dynamic Rankings & Composite Scoring Configuration — FR-4700
 *
 * Default weights, score ranges, trend thresholds, and alert debouncing
 * for the ranking engine.
 *
 * @see FR-4702 — Configurable dimension weights
 * @see FR-4703 — Trend detection window & thresholds
 */

export const rankingConfig = {
  defaultWeights: {
    stability: 0.20,
    economicHealth: 0.20,
    militaryPower: 0.15,
    diplomaticInfluence: 0.15,
    technologyLevel: 0.15,
    marketPerformance: 0.10,
    educationDemographics: 0.05,
  },
  scoreRange: { min: 0, max: 1000 },
  trendWindow: 3,
  trendThresholds: {
    up: 2,
    slightlyUp: 0.5,
    slightlyDown: -0.5,
    down: -2,
  },
  alertDebounce: {
    minRankChangeForAlert: 1,
    milestoneRanks: [1],
  },
} as const;
