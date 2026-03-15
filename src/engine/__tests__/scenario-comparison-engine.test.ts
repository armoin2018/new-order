/**
 * Tests for ScenarioComparisonEngine — CNFL-4403
 *
 * @see src/engine/scenario-comparison-engine.ts
 */

import { describe, it, expect } from 'vitest';
import { ScenarioComparisonEngine } from '../scenario-comparison-engine';
import type {
  ScenarioSummary,
  TrajectoryComparison,
  ComparisonDivergencePoint,
  MarketComparisonResult,
  ComparisonReport,
  PairwiseDelta,
} from '../scenario-comparison-engine';
import type { ScenarioHistoryArchive, TurnRecord, TurnMetricsSnapshot } from '../scenario-history-recorder';
import type { FactionId } from '@/data/types';
import type { ScenarioScore, DimensionScore, MarketEventLogEntry } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDimensionScores(overrides?: Partial<Record<string, number>>): readonly DimensionScore[] {
  const defaults: Record<string, number> = {
    stability: 70,
    economic: 65,
    military: 60,
    diplomatic: 55,
    technology: 50,
    market: 45,
    strategic: 40,
    ...overrides,
  };

  const weights: Record<string, number> = {
    stability: 0.15,
    economic: 0.20,
    military: 0.10,
    diplomatic: 0.15,
    technology: 0.15,
    market: 0.10,
    strategic: 0.15,
  };

  return Object.entries(defaults).map(([dim, raw]) => ({
    dimension: dim as DimensionScore['dimension'],
    rawScore: raw,
    letterGrade: raw >= 95 ? 'S' : raw >= 80 ? 'A' : raw >= 65 ? 'B' : raw >= 50 ? 'C' : raw >= 35 ? 'D' : 'F',
    weight: weights[dim] ?? 0.1,
    weightedScore: raw * (weights[dim] ?? 0.1),
    keyEvents: [],
  }));
}

function makeSnapshot(
  factionId: FactionId,
  overrides?: Partial<TurnMetricsSnapshot>,
): TurnMetricsSnapshot {
  return {
    factionId,
    stability: 70,
    gdp: 500,
    treasury: 100,
    militaryReadiness: 60,
    diplomaticInfluence: 50,
    civilUnrest: 10,
    techLevel: 30,
    ...overrides,
  };
}

function makeTurnRecord(
  turn: number,
  playerFaction: FactionId,
  snapshotOverrides?: Partial<TurnMetricsSnapshot>,
  marketOverrides?: Partial<TurnRecord['marketData']>,
): TurnRecord {
  return {
    turn,
    timestamp: `2026-03-${String(turn).padStart(2, '0')}T00:00:00.000Z`,
    nationSnapshots: [makeSnapshot(playerFaction, snapshotOverrides)],
    actions: [],
    events: turn === 3
      ? [{ eventId: `evt-${turn}`, turn, eventType: 'crisis', description: 'Oil shock event', affectedFactions: [playerFaction] }]
      : [],
    marketData: {
      tickerCount: 10,
      exchangeComposites: { 'nyse': 1000 + turn * 10, 'sse': 500 + turn * 5 },
      indexValues: { 'global-defense': 100 + turn * 2, 'global-energy': 80 + turn },
      marketEvents: [] as readonly MarketEventLogEntry[],
      ...marketOverrides,
    },
  };
}

function makeArchive(
  scenarioId: string,
  playerFaction: FactionId,
  turnsPlayed: number,
  totalScore: number,
  dimOverrides?: Partial<Record<string, number>>,
  snapshotOverridesPerTurn?: Record<number, Partial<TurnMetricsSnapshot>>,
): ScenarioHistoryArchive {
  const dimensions = makeDimensionScores(dimOverrides);
  const score: ScenarioScore = {
    totalScore,
    dimensions,
  };

  const turnHistory: TurnRecord[] = [];
  for (let t = 1; t <= turnsPlayed; t++) {
    turnHistory.push(
      makeTurnRecord(t, playerFaction, snapshotOverridesPerTurn?.[t]),
    );
  }

  return {
    scenarioId,
    runId: `run-${scenarioId}`,
    playerFaction,
    turnsPlayed,
    startedAt: '2026-03-01T00:00:00.000Z',
    completedAt: '2026-03-15T00:00:00.000Z',
    victoryCondition: 'Economic Victory',
    turnHistory,
    finalScores: score,
    metadata: {
      gameVersion: '1.0.0',
      scenarioName: `Scenario ${scenarioId}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioComparisonEngine', () => {
  // ─── Constructor ────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('creates with default config', () => {
      const engine = new ScenarioComparisonEngine();
      expect(engine).toBeDefined();
    });

    it('accepts partial config overrides', () => {
      const engine = new ScenarioComparisonEngine({ divergenceThreshold: 0.3 });
      expect(engine).toBeDefined();
    });
  });

  // ─── compareScenarios ──────────────────────────────────────────────────
  describe('compareScenarios', () => {
    it('throws for fewer than 2 archives', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 10, 700);
      expect(() => engine.compareScenarios([a1])).toThrow(RangeError);
    });

    it('throws for more than 5 archives', () => {
      const engine = new ScenarioComparisonEngine();
      const archives = Array.from({ length: 6 }, (_, i) =>
        makeArchive(`s${i}`, 'us' as FactionId, 10, 500 + i * 50),
      );
      expect(() => engine.compareScenarios(archives)).toThrow(RangeError);
    });

    it('returns summaries sorted by total score descending', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('low', 'us' as FactionId, 10, 400);
      const a2 = makeArchive('high', 'us' as FactionId, 10, 800);
      const a3 = makeArchive('mid', 'us' as FactionId, 10, 600);

      const result = engine.compareScenarios([a1, a2, a3]);

      expect(result).toHaveLength(3);
      expect(result[0]!.scenarioId).toBe('high');
      expect(result[1]!.scenarioId).toBe('mid');
      expect(result[2]!.scenarioId).toBe('low');
    });

    it('populates dimension scores and grades', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 10, 700, { stability: 90, economic: 30 });
      const a2 = makeArchive('s2', 'china' as FactionId, 10, 500);

      const result = engine.compareScenarios([a1, a2]);
      const s1 = result.find((s) => s.scenarioId === 's1')!;

      expect(s1.dimensionScores.stability).toBe(90);
      expect(s1.dimensionScores.economic).toBe(30);
      expect(s1.dimensionGrades.stability).toBe('A');
      expect(s1.dimensionGrades.economic).toBe('F');
    });

    it('assigns overall grade from total score', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 10, 960); // 96/100 → S
      const a2 = makeArchive('s2', 'us' as FactionId, 10, 300); // 30/100 → F

      const result = engine.compareScenarios([a1, a2]);

      expect(result[0]!.overallGrade).toBe('S');
      expect(result[1]!.overallGrade).toBe('F');
    });

    it('includes victory condition', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 10, 700);
      const a2 = makeArchive('s2', 'us' as FactionId, 10, 500);

      const result = engine.compareScenarios([a1, a2]);
      expect(result[0]!.victoryCondition).toBe('Economic Victory');
    });

    it('handles archive without final scores gracefully', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 10, 700);
      const a2: ScenarioHistoryArchive = {
        ...makeArchive('s2', 'us' as FactionId, 10, 0),
        finalScores: undefined,
      };

      const result = engine.compareScenarios([a1, a2]);
      const noScore = result.find((s) => s.scenarioId === 's2')!;

      expect(noScore.totalScore).toBe(0);
      expect(noScore.overallGrade).toBe('F');
      expect(noScore.dimensionScores.stability).toBe(0);
    });

    it('supports 5 scenarios (max)', () => {
      const engine = new ScenarioComparisonEngine();
      const archives = Array.from({ length: 5 }, (_, i) =>
        makeArchive(`s${i}`, 'us' as FactionId, 5, 200 + i * 150),
      );

      const result = engine.compareScenarios(archives);
      expect(result).toHaveLength(5);
      expect(result[0]!.totalScore).toBeGreaterThan(result[4]!.totalScore);
    });
  });

  // ─── compareTrajectories ───────────────────────────────────────────────
  describe('compareTrajectories', () => {
    it('throws for fewer than 2 archives', () => {
      const engine = new ScenarioComparisonEngine();
      expect(() => engine.compareTrajectories([makeArchive('s1', 'us' as FactionId, 5, 500)])).toThrow(RangeError);
    });

    it('returns one trajectory per metric for default metrics', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.compareTrajectories([a1, a2]);

      // Default: 7 nation metrics
      expect(result).toHaveLength(7);
      expect(result.map((t) => t.metric)).toContain('stability');
      expect(result.map((t) => t.metric)).toContain('gdp');
    });

    it('uses custom metrics list when provided', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.compareTrajectories([a1, a2], ['stability', 'gdp']);

      expect(result).toHaveLength(2);
    });

    it('includes per-scenario trajectory points aligned by turn', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 3, 500, undefined, {
        1: { stability: 70 } as Partial<TurnMetricsSnapshot>,
        2: { stability: 75 } as Partial<TurnMetricsSnapshot>,
        3: { stability: 80 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 3, 400, undefined, {
        1: { stability: 60 } as Partial<TurnMetricsSnapshot>,
        2: { stability: 55 } as Partial<TurnMetricsSnapshot>,
        3: { stability: 50 } as Partial<TurnMetricsSnapshot>,
      });

      const result = engine.compareTrajectories([a1, a2]);
      const stabilityTraj = result.find((t) => t.metric === 'stability')!;

      expect(stabilityTraj.scenarios).toHaveLength(2);

      const s1Points = stabilityTraj.scenarios.find((s) => s.scenarioId === 's1')!.points;
      expect(s1Points).toHaveLength(3);
      expect(s1Points[0]!.value).toBe(70);
      expect(s1Points[2]!.value).toBe(80);

      const s2Points = stabilityTraj.scenarios.find((s) => s.scenarioId === 's2')!.points;
      expect(s2Points[0]!.value).toBe(60);
      expect(s2Points[2]!.value).toBe(50);
    });

    it('handles archives with different turn counts', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('short', 'us' as FactionId, 3, 500);
      const a2 = makeArchive('long', 'us' as FactionId, 10, 700);

      const result = engine.compareTrajectories([a1, a2]);
      const stab = result.find((t) => t.metric === 'stability')!;

      const shortPoints = stab.scenarios.find((s) => s.scenarioId === 'short')!.points;
      const longPoints = stab.scenarios.find((s) => s.scenarioId === 'long')!.points;

      expect(shortPoints).toHaveLength(3);
      expect(longPoints).toHaveLength(10);
    });
  });

  // ─── findDivergencePoints ─────────────────────────────────────────────
  describe('findDivergencePoints', () => {
    it('throws for fewer than 2 archives', () => {
      const engine = new ScenarioComparisonEngine();
      expect(() => engine.findDivergencePoints([makeArchive('s1', 'us' as FactionId, 5, 500)])).toThrow(RangeError);
    });

    it('returns empty array when scenarios have identical metrics', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.findDivergencePoints([a1, a2]);

      // Same default snapshots → no divergence
      expect(result).toHaveLength(0);
    });

    it('detects divergence when metrics differ significantly', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('stable', 'us' as FactionId, 3, 500, undefined, {
        1: { stability: 80 } as Partial<TurnMetricsSnapshot>,
        2: { stability: 80 } as Partial<TurnMetricsSnapshot>,
        3: { stability: 80 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('unstable', 'us' as FactionId, 3, 400, undefined, {
        1: { stability: 80 } as Partial<TurnMetricsSnapshot>,
        2: { stability: 80 } as Partial<TurnMetricsSnapshot>,
        3: { stability: 30 } as Partial<TurnMetricsSnapshot>, // 62.5% divergence
      });

      const result = engine.findDivergencePoints([a1, a2]);

      const stabilityDiv = result.filter((d) => d.metric === 'stability');
      expect(stabilityDiv.length).toBeGreaterThan(0);
      expect(stabilityDiv[0]!.turn).toBe(3);
      expect(stabilityDiv[0]!.maxSpreadPercent).toBeGreaterThan(20);
    });

    it('respects custom threshold', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 3, 500, undefined, {
        2: { stability: 70 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 3, 400, undefined, {
        2: { stability: 60 } as Partial<TurnMetricsSnapshot>,
      });

      // With low threshold (5%), should detect
      const low = engine.findDivergencePoints([a1, a2], 0.05);
      const stabilityLow = low.filter((d) => d.metric === 'stability');
      expect(stabilityLow.length).toBeGreaterThan(0);

      // With very high threshold (99%), should not detect
      const high = engine.findDivergencePoints([a1, a2], 0.99);
      expect(high).toHaveLength(0);
    });

    it('includes likely cause from events', () => {
      const engine = new ScenarioComparisonEngine();
      // Turn 3 has an event ("Oil shock event") and a large divergence
      const a1 = makeArchive('s1', 'us' as FactionId, 3, 500, undefined, {
        3: { stability: 90 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 3, 400, undefined, {
        3: { stability: 30 } as Partial<TurnMetricsSnapshot>,
      });

      const result = engine.findDivergencePoints([a1, a2]);
      const turn3 = result.filter((d) => d.turn === 3 && d.metric === 'stability');

      expect(turn3.length).toBeGreaterThan(0);
      expect(turn3[0]!.likelyCause).toBe('Oil shock event');
    });

    it('includes values per scenario', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 1, 500, undefined, {
        1: { stability: 90 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 1, 400, undefined, {
        1: { stability: 20 } as Partial<TurnMetricsSnapshot>,
      });

      const result = engine.findDivergencePoints([a1, a2]);
      const stabDiv = result.find((d) => d.metric === 'stability')!;

      expect(stabDiv.values['s1']).toBe(90);
      expect(stabDiv.values['s2']).toBe(20);
    });

    it('detects divergence across 3+ scenarios', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 2, 500, undefined, {
        2: { gdp: 1000 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 2, 400, undefined, {
        2: { gdp: 500 } as Partial<TurnMetricsSnapshot>,
      });
      const a3 = makeArchive('s3', 'us' as FactionId, 2, 300, undefined, {
        2: { gdp: 200 } as Partial<TurnMetricsSnapshot>,
      });

      const result = engine.findDivergencePoints([a1, a2, a3]);
      const gdpDiv = result.filter((d) => d.metric === 'gdp');
      expect(gdpDiv.length).toBeGreaterThan(0);
    });

    it('sorts divergence points by turn', () => {
      const engine = new ScenarioComparisonEngine({ divergenceThreshold: 0.05 });
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500, undefined, {
        2: { stability: 90 } as Partial<TurnMetricsSnapshot>,
        4: { stability: 95 } as Partial<TurnMetricsSnapshot>,
      });
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 400, undefined, {
        2: { stability: 40 } as Partial<TurnMetricsSnapshot>,
        4: { stability: 30 } as Partial<TurnMetricsSnapshot>,
      });

      const result = engine.findDivergencePoints([a1, a2]);
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.turn).toBeGreaterThanOrEqual(result[i - 1]!.turn);
      }
    });
  });

  // ─── compareMarketPerformance ──────────────────────────────────────────
  describe('compareMarketPerformance', () => {
    it('throws for fewer than 2 archives', () => {
      const engine = new ScenarioComparisonEngine();
      expect(() => engine.compareMarketPerformance([makeArchive('s1', 'us' as FactionId, 5, 500)])).toThrow(RangeError);
    });

    it('returns market data for each scenario', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.compareMarketPerformance([a1, a2]);

      expect(result.scenarios).toHaveLength(2);
      expect(result.scenarios[0]!.scenarioId).toBe('s1');
    });

    it('computes exchange composite start/end values', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.compareMarketPerformance([a1, a2]);
      const s1Market = result.scenarios.find((s) => s.scenarioId === 's1')!;

      // NYSE: turn 1 = 1010, turn 5 = 1050
      expect(s1Market.exchangeComposites['nyse']).toBeDefined();
      expect(s1Market.exchangeComposites['nyse']!.startValue).toBe(1010);
      expect(s1Market.exchangeComposites['nyse']!.endValue).toBe(1050);
    });

    it('computes index performance change percentages', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      const result = engine.compareMarketPerformance([a1, a2]);
      const s1Market = result.scenarios.find((s) => s.scenarioId === 's1')!;

      // global-defense: turn 1 = 102, turn 5 = 110
      expect(s1Market.indexPerformance['global-defense']).toBeDefined();
      expect(s1Market.indexPerformance['global-defense']!.changePercent).toBeGreaterThan(0);
    });

    it('identifies best and worst market scenarios', () => {
      const engine = new ScenarioComparisonEngine();
      // s1: normal market
      const a1 = makeArchive('normal', 'us' as FactionId, 5, 500);
      // s2: better market (higher index growth)
      const betterHistory: TurnRecord[] = [];
      for (let t = 1; t <= 5; t++) {
        betterHistory.push(makeTurnRecord(t, 'us' as FactionId, undefined, {
          tickerCount: 10,
          exchangeComposites: { 'nyse': 1000 + t * 100 },
          indexValues: { 'global-defense': 100 + t * 50, 'global-energy': 80 + t * 40 },
          marketEvents: [],
        }));
      }
      const a2: ScenarioHistoryArchive = {
        ...makeArchive('bull', 'us' as FactionId, 5, 700),
        turnHistory: betterHistory,
      };

      const result = engine.compareMarketPerformance([a1, a2]);
      expect(result.bestMarketScenario).toBe('bull');
      expect(result.worstMarketScenario).toBe('normal');
    });

    it('counts total market events', () => {
      const engine = new ScenarioComparisonEngine();
      const events: MarketEventLogEntry[] = [
        { turn: 1, eventType: 'crash', affectedExchangeId: 'nyse', affectedSector: 'tech', severityMultiplier: 0.8, description: 'Test', resolvedOnTurn: null },
      ];
      const history: TurnRecord[] = [
        makeTurnRecord(1, 'us' as FactionId, undefined, { tickerCount: 10, exchangeComposites: { 'nyse': 1000 }, indexValues: {}, marketEvents: events }),
        makeTurnRecord(2, 'us' as FactionId, undefined, { tickerCount: 10, exchangeComposites: { 'nyse': 1010 }, indexValues: {}, marketEvents: events }),
      ];
      const a1: ScenarioHistoryArchive = {
        ...makeArchive('s1', 'us' as FactionId, 2, 500),
        turnHistory: history,
      };
      const a2 = makeArchive('s2', 'us' as FactionId, 2, 400);

      const result = engine.compareMarketPerformance([a1, a2]);
      const s1 = result.scenarios.find((s) => s.scenarioId === 's1')!;
      expect(s1.totalMarketEvents).toBe(2);
    });

    it('handles empty turn history', () => {
      const engine = new ScenarioComparisonEngine();
      const a1: ScenarioHistoryArchive = {
        ...makeArchive('empty', 'us' as FactionId, 0, 0),
        turnHistory: [],
      };
      const a2 = makeArchive('s2', 'us' as FactionId, 3, 400);

      const result = engine.compareMarketPerformance([a1, a2]);
      const empty = result.scenarios.find((s) => s.scenarioId === 'empty')!;
      expect(Object.keys(empty.exchangeComposites)).toHaveLength(0);
      expect(empty.totalMarketEvents).toBe(0);
    });
  });

  // ─── generateComparisonReport ──────────────────────────────────────────
  describe('generateComparisonReport', () => {
    it('throws for fewer than 2 archives', () => {
      const engine = new ScenarioComparisonEngine();
      expect(() => engine.generateComparisonReport([makeArchive('s1', 'us' as FactionId, 5, 500)])).toThrow(RangeError);
    });

    it('produces a complete report with all sections', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 700);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 500);

      const report = engine.generateComparisonReport([a1, a2]);

      expect(report.generatedAt).toBeTruthy();
      expect(report.scenarioCount).toBe(2);
      expect(report.summaries).toHaveLength(2);
      expect(report.rankings).toHaveLength(2);
      expect(report.trajectories.length).toBeGreaterThan(0);
      expect(report.marketComparison).toBeDefined();
      expect(report.divergencePoints).toBeDefined();
      expect(report.pairwiseDeltas).toBeDefined();
    });

    it('ranks scenarios by score descending', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('low', 'us' as FactionId, 5, 300);
      const a2 = makeArchive('high', 'us' as FactionId, 5, 900);

      const report = engine.generateComparisonReport([a1, a2]);

      expect(report.rankings[0]!.rank).toBe(1);
      expect(report.rankings[0]!.scenarioId).toBe('high');
      expect(report.rankings[1]!.rank).toBe(2);
      expect(report.rankings[1]!.scenarioId).toBe('low');
    });

    it('identifies best and worst overall', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('best', 'us' as FactionId, 5, 900);
      const a2 = makeArchive('worst', 'us' as FactionId, 5, 200);
      const a3 = makeArchive('mid', 'us' as FactionId, 5, 500);

      const report = engine.generateComparisonReport([a1, a2, a3]);

      expect(report.bestOverall).toBe('best');
      expect(report.worstOverall).toBe('worst');
    });

    it('computes pairwise deltas for all pairs', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 800);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);
      const a3 = makeArchive('s3', 'us' as FactionId, 5, 400);

      const report = engine.generateComparisonReport([a1, a2, a3]);

      // 3 scenarios → 3 pairs: (s1,s2), (s1,s3), (s2,s3)
      expect(report.pairwiseDeltas).toHaveLength(3);
    });

    it('pairwise deltas include strongest/weakest dimensions', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 800, { stability: 95, market: 20 });
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 500, { stability: 30, market: 90 });

      const report = engine.generateComparisonReport([a1, a2]);
      const delta = report.pairwiseDeltas[0]!;

      expect(delta.scenarioAId).toBeDefined();
      expect(delta.scenarioBId).toBeDefined();
      expect(delta.strongestDimension).toBeDefined();
      expect(delta.weakestDimension).toBeDefined();
      expect(typeof delta.scoreDelta).toBe('number');
    });

    it('includes market comparison in report', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 700);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 500);

      const report = engine.generateComparisonReport([a1, a2]);

      expect(report.marketComparison.scenarios).toHaveLength(2);
      expect(report.marketComparison.bestMarketScenario).toBeTruthy();
      expect(report.marketComparison.worstMarketScenario).toBeTruthy();
    });

    it('handles 5 scenarios in a single report', () => {
      const engine = new ScenarioComparisonEngine();
      const archives = Array.from({ length: 5 }, (_, i) =>
        makeArchive(`s${i}`, 'us' as FactionId, 5, 200 + i * 150),
      );

      const report = engine.generateComparisonReport(archives);

      expect(report.scenarioCount).toBe(5);
      expect(report.summaries).toHaveLength(5);
      // C(5,2) = 10 pairwise deltas
      expect(report.pairwiseDeltas).toHaveLength(10);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles different player factions across scenarios', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 700);
      const a2 = makeArchive('s2', 'china' as FactionId, 5, 500);

      const result = engine.compareScenarios([a1, a2]);
      expect(result[0]!.playerFaction).toBe('us');
      expect(result[1]!.playerFaction).toBe('china');
    });

    it('handles archives with no market data in turns', () => {
      const engine = new ScenarioComparisonEngine();
      const emptyMarket: TurnRecord['marketData'] = {
        tickerCount: 0,
        exchangeComposites: {},
        indexValues: {},
        marketEvents: [],
      };
      const history: TurnRecord[] = [
        makeTurnRecord(1, 'us' as FactionId, undefined, emptyMarket),
        makeTurnRecord(2, 'us' as FactionId, undefined, emptyMarket),
      ];
      const a1: ScenarioHistoryArchive = {
        ...makeArchive('no-market', 'us' as FactionId, 2, 400),
        turnHistory: history,
      };
      const a2 = makeArchive('s2', 'us' as FactionId, 3, 500);

      const result = engine.compareMarketPerformance([a1, a2]);
      const noMarket = result.scenarios.find((s) => s.scenarioId === 'no-market')!;
      expect(Object.keys(noMarket.indexPerformance)).toHaveLength(0);
    });

    it('exactly 2 scenarios works (minimum)', () => {
      const engine = new ScenarioComparisonEngine();
      const a1 = makeArchive('s1', 'us' as FactionId, 5, 500);
      const a2 = makeArchive('s2', 'us' as FactionId, 5, 600);

      expect(() => engine.compareScenarios([a1, a2])).not.toThrow();
      expect(() => engine.compareTrajectories([a1, a2])).not.toThrow();
      expect(() => engine.findDivergencePoints([a1, a2])).not.toThrow();
      expect(() => engine.compareMarketPerformance([a1, a2])).not.toThrow();
      expect(() => engine.generateComparisonReport([a1, a2])).not.toThrow();
    });
  });
});
