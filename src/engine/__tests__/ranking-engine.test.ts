import { describe, it, expect } from 'vitest';
import {
  initializeRankingState,
  computeNationScore,
  computeAllRankings,
  computeTrend,
  generateAlerts,
  getLeaderboard,
  getTrendArrow,
  getStrongestWeakestDimension,
} from '@/engine/ranking-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ALL_FACTIONS, FactionId } from '@/data/types';
import type { TurnNumber, NationState } from '@/data/types';
import type {
  RankingScoringDimension,
  CompositeNationScore,
  RankingState,
  RankTrend,
} from '@/data/types/ranking.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cfg = GAME_CONFIG.ranking;

/** Shortcut: typed turn number (branded). */
function turn(n: number): TurnNumber {
  return n as TurnNumber;
}

/** Build a standard NationState for testing. */
function makeNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: FactionId.US,
    stability: 70,
    treasury: 500,
    gdp: 2000,
    inflation: 5,
    militaryReadiness: 80,
    nuclearThreshold: 30,
    diplomaticInfluence: 65,
    popularity: 60,
    allianceCredibility: 75,
    techLevel: 70,
    ...overrides,
  };
}

/** Build a minimal CompositeNationScore stub for history / alert tests. */
function makeScore(
  overrides: Partial<CompositeNationScore>,
): CompositeNationScore {
  const dims: Record<RankingScoringDimension, { rawValue: number; weight: number; weightedScore: number }> = {
    stability: { rawValue: 50, weight: 0.20, weightedScore: 10 },
    economicHealth: { rawValue: 50, weight: 0.20, weightedScore: 10 },
    militaryPower: { rawValue: 50, weight: 0.15, weightedScore: 7.5 },
    diplomaticInfluence: { rawValue: 50, weight: 0.15, weightedScore: 7.5 },
    technologyLevel: { rawValue: 50, weight: 0.15, weightedScore: 7.5 },
    marketPerformance: { rawValue: 50, weight: 0.10, weightedScore: 5 },
    educationDemographics: { rawValue: 50, weight: 0.05, weightedScore: 2.5 },
  };
  return {
    nationCode: FactionId.US,
    turn: turn(1),
    compositeScore: 500,
    dimensionScores: dims,
    rank: 1,
    previousRank: 0,
    trend: 'stable' as RankTrend,
    gapToLeader: 0,
    ...overrides,
  };
}

// ===========================================================================
// initializeRankingState
// ===========================================================================

describe('initializeRankingState', () => {
  const ids = ALL_FACTIONS as unknown as FactionId[];

  it('returns a RankingState with empty currentScores', () => {
    const state = initializeRankingState(ids);
    expect(Object.keys(state.currentScores)).toHaveLength(0);
  });

  it('creates empty history arrays for every nation', () => {
    const state = initializeRankingState(ids);
    for (const id of ids) {
      expect(state.history[id]).toEqual([]);
    }
  });

  it('starts with zero alerts', () => {
    const state = initializeRankingState(ids);
    expect(state.alerts).toEqual([]);
  });

  it('uses default weights when none are provided', () => {
    const state = initializeRankingState(ids);
    expect(state.weights).toEqual(cfg.defaultWeights);
  });

  it('merges custom weights with defaults', () => {
    const state = initializeRankingState(ids, { stability: 0.50 });
    expect(state.weights.stability).toBe(0.50);
    expect(state.weights.economicHealth).toBe(cfg.defaultWeights.economicHealth);
  });

  it('overrides multiple weights at once', () => {
    const state = initializeRankingState(ids, {
      stability: 0.30,
      militaryPower: 0.25,
    });
    expect(state.weights.stability).toBe(0.30);
    expect(state.weights.militaryPower).toBe(0.25);
    expect(state.weights.diplomaticInfluence).toBe(cfg.defaultWeights.diplomaticInfluence);
  });

  it('works with a single nation', () => {
    const state = initializeRankingState([FactionId.US]);
    expect(Object.keys(state.history)).toHaveLength(1);
    expect(state.history[FactionId.US]).toEqual([]);
  });

  it('works with an empty nation list', () => {
    const state = initializeRankingState([]);
    expect(Object.keys(state.history)).toHaveLength(0);
  });
});

// ===========================================================================
// computeNationScore
// ===========================================================================

describe('computeNationScore', () => {
  const weights = { ...cfg.defaultWeights };

  it('returns a compositeScore in the 0–1000 range', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    expect(score.compositeScore).toBeGreaterThanOrEqual(cfg.scoreRange.min);
    expect(score.compositeScore).toBeLessThanOrEqual(cfg.scoreRange.max);
  });

  it('scores a perfect nation near the top of the range', () => {
    const perfect = makeNation({
      stability: 100,
      treasury: 5000,
      gdp: 10000,
      inflation: 0,
      militaryReadiness: 100,
      diplomaticInfluence: 100,
      popularity: 100,
      techLevel: 100,
    });
    const score = computeNationScore(perfect, weights, turn(1));
    expect(score.compositeScore).toBeGreaterThan(900);
  });

  it('scores a collapsed nation near the bottom', () => {
    const collapsed = makeNation({
      stability: 0,
      treasury: 0,
      gdp: 0,
      inflation: 100,
      militaryReadiness: 0,
      diplomaticInfluence: 0,
      popularity: 0,
      techLevel: 0,
    });
    const score = computeNationScore(collapsed, weights, turn(1));
    expect(score.compositeScore).toBeLessThan(50);
  });

  it('populates all 7 dimension scores', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    const dims = Object.keys(score.dimensionScores) as RankingScoringDimension[];
    expect(dims).toHaveLength(7);
    expect(dims).toContain('stability');
    expect(dims).toContain('educationDemographics');
  });

  it('dimension rawValues are in 0-100', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    for (const dim of Object.values(score.dimensionScores)) {
      expect(dim.rawValue).toBeGreaterThanOrEqual(0);
      expect(dim.rawValue).toBeLessThanOrEqual(100);
    }
  });

  it('dimension weights match the weights argument', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    for (const [dim, ds] of Object.entries(score.dimensionScores)) {
      expect(ds.weight).toBe(weights[dim as RankingScoringDimension]);
    }
  });

  it('weightedScore equals rawValue * weight', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    for (const ds of Object.values(score.dimensionScores)) {
      expect(ds.weightedScore).toBeCloseTo(ds.rawValue * ds.weight, 5);
    }
  });

  it('compositeScore equals scaled sum of weightedScores', () => {
    const score = computeNationScore(makeNation(), weights, turn(1));
    const sum = Object.values(score.dimensionScores).reduce(
      (acc, ds) => acc + ds.weightedScore,
      0,
    );
    const expected = Math.round(sum * 10 * 100) / 100;
    expect(score.compositeScore).toBeCloseTo(expected, 1);
  });

  it('assigns the correct nationCode', () => {
    const score = computeNationScore(
      makeNation({ factionId: FactionId.China }),
      weights,
      turn(3),
    );
    expect(score.nationCode).toBe(FactionId.China);
  });

  it('assigns the correct turn', () => {
    const score = computeNationScore(makeNation(), weights, turn(7));
    expect(score.turn).toBe(7);
  });

  it('higher stability yields a higher stability dimension score', () => {
    const low = computeNationScore(makeNation({ stability: 20 }), weights, turn(1));
    const high = computeNationScore(makeNation({ stability: 90 }), weights, turn(1));
    expect(high.dimensionScores.stability.rawValue).toBeGreaterThan(
      low.dimensionScores.stability.rawValue,
    );
  });

  it('higher militaryReadiness yields a higher militaryPower score', () => {
    const low = computeNationScore(makeNation({ militaryReadiness: 10 }), weights, turn(1));
    const high = computeNationScore(makeNation({ militaryReadiness: 95 }), weights, turn(1));
    expect(high.dimensionScores.militaryPower.rawValue).toBeGreaterThan(
      low.dimensionScores.militaryPower.rawValue,
    );
  });

  it('clamps compositeScore to the configured max', () => {
    // Even with extreme values the score should not exceed 1000
    const extreme = makeNation({
      stability: 200 as number,
      treasury: 999999,
      gdp: 999999,
      inflation: -100 as number,
      militaryReadiness: 200 as number,
      diplomaticInfluence: 200 as number,
      popularity: 200 as number,
      techLevel: 200 as number,
    });
    const score = computeNationScore(extreme, weights, turn(1));
    expect(score.compositeScore).toBeLessThanOrEqual(cfg.scoreRange.max);
  });
});

// ===========================================================================
// computeAllRankings
// ===========================================================================

describe('computeAllRankings', () => {
  function makeTwoNations(): Record<FactionId, NationState> {
    return {
      [FactionId.US]: makeNation({ factionId: FactionId.US, stability: 90 }),
      [FactionId.China]: makeNation({ factionId: FactionId.China, stability: 60 }),
    } as Record<FactionId, NationState>;
  }

  it('assigns rank 1 to the highest scorer', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const result = computeAllRankings(makeTwoNations(), state, turn(1));
    expect(result.currentScores[FactionId.US].rank).toBe(1);
  });

  it('assigns rank 2 to the lower scorer', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const result = computeAllRankings(makeTwoNations(), state, turn(1));
    expect(result.currentScores[FactionId.China].rank).toBe(2);
  });

  it('leader has gapToLeader of 0', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const result = computeAllRankings(makeTwoNations(), state, turn(1));
    expect(result.currentScores[FactionId.US].gapToLeader).toBe(0);
  });

  it('non-leader has a positive gapToLeader', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const result = computeAllRankings(makeTwoNations(), state, turn(1));
    expect(result.currentScores[FactionId.China].gapToLeader).toBeGreaterThan(0);
  });

  it('appends scores to history', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const r1 = computeAllRankings(makeTwoNations(), state, turn(1));
    expect(r1.history[FactionId.US]).toHaveLength(1);
    const r2 = computeAllRankings(makeTwoNations(), r1, turn(2));
    expect(r2.history[FactionId.US]).toHaveLength(2);
  });

  it('generates alerts when ranks change', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const r1 = computeAllRankings(makeTwoNations(), state, turn(1));

    // Flip: make China stronger
    const nations2 = {
      [FactionId.US]: makeNation({ factionId: FactionId.US, stability: 30 }),
      [FactionId.China]: makeNation({ factionId: FactionId.China, stability: 95 }),
    } as Record<FactionId, NationState>;
    const r2 = computeAllRankings(nations2, r1, turn(2));

    const rankChangeAlerts = r2.alerts.filter((a) => a.alertType === 'rankChange');
    expect(rankChangeAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves previous alerts when adding new ones', () => {
    const state = initializeRankingState([FactionId.US, FactionId.China]);
    const r1 = computeAllRankings(makeTwoNations(), state, turn(1));

    // Flip rankings twice
    const nations2 = {
      [FactionId.US]: makeNation({ factionId: FactionId.US, stability: 20 }),
      [FactionId.China]: makeNation({ factionId: FactionId.China, stability: 95 }),
    } as Record<FactionId, NationState>;
    const r2 = computeAllRankings(nations2, r1, turn(2));
    const alertsAfterT2 = r2.alerts.length;

    const r3 = computeAllRankings(makeTwoNations(), r2, turn(3));
    expect(r3.alerts.length).toBeGreaterThanOrEqual(alertsAfterT2);
  });

  it('works with a single nation', () => {
    const state = initializeRankingState([FactionId.US]);
    const nations = {
      [FactionId.US]: makeNation(),
    } as Record<FactionId, NationState>;
    const result = computeAllRankings(nations, state, turn(1));
    expect(result.currentScores[FactionId.US].rank).toBe(1);
    expect(result.currentScores[FactionId.US].gapToLeader).toBe(0);
  });
});

// ===========================================================================
// computeTrend
// ===========================================================================

describe('computeTrend', () => {
  it('returns stable for empty history', () => {
    expect(computeTrend([], 3)).toBe('stable');
  });

  it('returns stable for a single entry', () => {
    expect(computeTrend([makeScore({ rank: 3 })], 3)).toBe('stable');
  });

  it('detects an upward trend when rank is consistently improving', () => {
    const history = [
      makeScore({ rank: 6 }),
      makeScore({ rank: 5 }),
      makeScore({ rank: 1 }),
    ];
    const trend = computeTrend(history, 3);
    expect(trend).toBe('up');
  });

  it('detects a downward trend when rank is worsening', () => {
    const history = [
      makeScore({ rank: 1 }),
      makeScore({ rank: 2 }),
      makeScore({ rank: 6 }),
    ];
    const trend = computeTrend(history, 3);
    expect(trend).toBe('down');
  });

  it('returns stable for no net change', () => {
    const history = [
      makeScore({ rank: 3 }),
      makeScore({ rank: 3 }),
      makeScore({ rank: 3 }),
    ];
    expect(computeTrend(history, 3)).toBe('stable');
  });

  it('detects slightly_up for a small improvement', () => {
    const history = [
      makeScore({ rank: 4 }),
      makeScore({ rank: 4 }),
      makeScore({ rank: 3 }),
    ];
    // avg = (4+4+3)/3 ≈ 3.67; current = 3; delta = 0.67 → slightly_up
    expect(computeTrend(history, 3)).toBe('slightly_up');
  });

  it('detects slightly_down for a small decline', () => {
    const history = [
      makeScore({ rank: 3 }),
      makeScore({ rank: 3 }),
      makeScore({ rank: 4 }),
    ];
    // avg = (3+3+4)/3 ≈ 3.33; current = 4; delta = -0.67 → slightly_down
    expect(computeTrend(history, 3)).toBe('slightly_down');
  });

  it('only uses the last N entries per the window', () => {
    const history = [
      makeScore({ rank: 8 }),
      makeScore({ rank: 7 }),
      makeScore({ rank: 6 }),
      makeScore({ rank: 2 }),
      makeScore({ rank: 1 }),
    ];
    // window=3 → last 3: [6,2,1], avg=3, current=1, delta=2 → up
    expect(computeTrend(history, 3)).toBe('up');
  });
});

// ===========================================================================
// generateAlerts
// ===========================================================================

describe('generateAlerts', () => {
  it('returns empty array when previousScores is null', () => {
    const newScores = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    expect(generateAlerts(null, newScores, turn(2))).toEqual([]);
  });

  it('generates a rankChange alert when rank changes by 1', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 2 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(3));
    expect(alerts.some((a) => a.alertType === 'rankChange')).toBe(true);
  });

  it('does not generate a rankChange alert when rank is unchanged', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 2 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 2 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(3));
    expect(alerts.filter((a) => a.alertType === 'rankChange')).toHaveLength(0);
  });

  it('generates an overtake alert when a nation passes a rival', () => {
    const prev = {
      [FactionId.US]: makeScore({ nationCode: FactionId.US, rank: 3 }),
      [FactionId.China]: makeScore({ nationCode: FactionId.China, rank: 2 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ nationCode: FactionId.US, rank: 1 }),
      [FactionId.China]: makeScore({ nationCode: FactionId.China, rank: 3 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(4));
    const overtakes = alerts.filter((a) => a.alertType === 'overtake');
    expect(overtakes.length).toBeGreaterThanOrEqual(1);
    expect(overtakes[0].rivalNationCode).toBe(FactionId.China);
  });

  it('generates a milestone alert when reaching rank 1', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 2 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(5));
    const milestones = alerts.filter((a) => a.alertType === 'milestone');
    expect(milestones.length).toBe(1);
    expect(milestones[0].milestone).toContain('1');
  });

  it('does not generate a milestone alert if already at rank 1', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(5));
    expect(alerts.filter((a) => a.alertType === 'milestone')).toHaveLength(0);
  });

  it('all alerts have dismissed === false', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 3 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(6));
    for (const a of alerts) {
      expect(a.dismissed).toBe(false);
    }
  });

  it('assigns the correct turn to each alert', () => {
    const prev = {
      [FactionId.US]: makeScore({ rank: 3 }),
    } as Record<FactionId, CompositeNationScore>;
    const curr = {
      [FactionId.US]: makeScore({ rank: 1 }),
    } as Record<FactionId, CompositeNationScore>;
    const alerts = generateAlerts(prev, curr, turn(9));
    for (const a of alerts) {
      expect(a.turn).toBe(9);
    }
  });
});

// ===========================================================================
// getLeaderboard
// ===========================================================================

describe('getLeaderboard', () => {
  it('returns scores sorted by rank ascending (best first)', () => {
    const state: RankingState = {
      currentScores: {
        [FactionId.China]: makeScore({ nationCode: FactionId.China, rank: 2, compositeScore: 600 }),
        [FactionId.US]: makeScore({ nationCode: FactionId.US, rank: 1, compositeScore: 800 }),
        [FactionId.Russia]: makeScore({ nationCode: FactionId.Russia, rank: 3, compositeScore: 400 }),
      } as Record<FactionId, CompositeNationScore>,
      history: {} as Record<FactionId, CompositeNationScore[]>,
      alerts: [],
      weights: { ...cfg.defaultWeights },
    };
    const board = getLeaderboard(state);
    expect(board[0].nationCode).toBe(FactionId.US);
    expect(board[1].nationCode).toBe(FactionId.China);
    expect(board[2].nationCode).toBe(FactionId.Russia);
  });

  it('returns empty array for empty state', () => {
    const state: RankingState = {
      currentScores: {} as Record<FactionId, CompositeNationScore>,
      history: {} as Record<FactionId, CompositeNationScore[]>,
      alerts: [],
      weights: { ...cfg.defaultWeights },
    };
    expect(getLeaderboard(state)).toEqual([]);
  });

  it('returns single element for single nation', () => {
    const state: RankingState = {
      currentScores: {
        [FactionId.US]: makeScore({ nationCode: FactionId.US, rank: 1 }),
      } as Record<FactionId, CompositeNationScore>,
      history: {} as Record<FactionId, CompositeNationScore[]>,
      alerts: [],
      weights: { ...cfg.defaultWeights },
    };
    const board = getLeaderboard(state);
    expect(board).toHaveLength(1);
    expect(board[0].rank).toBe(1);
  });
});

// ===========================================================================
// getTrendArrow
// ===========================================================================

describe('getTrendArrow', () => {
  it('returns ↑ for up', () => {
    expect(getTrendArrow('up')).toBe('↑');
  });

  it('returns ↗ for slightly_up', () => {
    expect(getTrendArrow('slightly_up')).toBe('↗');
  });

  it('returns → for stable', () => {
    expect(getTrendArrow('stable')).toBe('→');
  });

  it('returns ↘ for slightly_down', () => {
    expect(getTrendArrow('slightly_down')).toBe('↘');
  });

  it('returns ↓ for down', () => {
    expect(getTrendArrow('down')).toBe('↓');
  });
});

// ===========================================================================
// getStrongestWeakestDimension
// ===========================================================================

describe('getStrongestWeakestDimension', () => {
  it('identifies the dimension with the highest weightedScore as strongest', () => {
    const score = makeScore({});
    // Boost stability weightedScore
    score.dimensionScores.stability = { rawValue: 100, weight: 0.20, weightedScore: 20 };
    score.dimensionScores.educationDemographics = { rawValue: 10, weight: 0.05, weightedScore: 0.5 };
    const { strongest } = getStrongestWeakestDimension(score);
    expect(strongest).toBe('stability');
  });

  it('identifies the dimension with the lowest weightedScore as weakest', () => {
    const score = makeScore({});
    score.dimensionScores.stability = { rawValue: 100, weight: 0.20, weightedScore: 20 };
    score.dimensionScores.educationDemographics = { rawValue: 10, weight: 0.05, weightedScore: 0.5 };
    const { weakest } = getStrongestWeakestDimension(score);
    expect(weakest).toBe('educationDemographics');
  });

  it('handles equal dimensions gracefully', () => {
    const score = makeScore({});
    // Make all dimensions equal
    const dims: RankingScoringDimension[] = [
      'stability', 'economicHealth', 'militaryPower',
      'diplomaticInfluence', 'technologyLevel',
      'marketPerformance', 'educationDemographics',
    ];
    for (const d of dims) {
      score.dimensionScores[d] = { rawValue: 50, weight: 1 / 7, weightedScore: 50 / 7 };
    }
    const result = getStrongestWeakestDimension(score);
    expect(dims).toContain(result.strongest);
    expect(dims).toContain(result.weakest);
  });

  it('returns different strongest and weakest for varied scores', () => {
    const score = makeScore({});
    score.dimensionScores.militaryPower = { rawValue: 95, weight: 0.15, weightedScore: 14.25 };
    score.dimensionScores.educationDemographics = { rawValue: 5, weight: 0.05, weightedScore: 0.25 };
    const { strongest, weakest } = getStrongestWeakestDimension(score);
    expect(strongest).toBe('militaryPower');
    expect(weakest).toBe('educationDemographics');
  });
});
