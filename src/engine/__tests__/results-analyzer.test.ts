/**
 * Tests for CNFL-3903 — Results Analyzer
 */
import { describe, it, expect } from 'vitest';
import { ResultsAnalyzer } from '../results-analyzer';
import type {
  ComparisonMetrics,
} from '../results-analyzer';
import type { HeadlessRunResult, TurnSnapshot, TurnStatEntry } from '../headless-runner';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStatEntry(turn: number, overrides: Partial<TurnStatEntry> = {}): TurnStatEntry {
  return {
    turn,
    gdpByFaction: { US: 20000 + turn * 100, China: 15000 + turn * 50 },
    militaryByFaction: { US: 70, China: 65 },
    stabilityByFaction: { US: 60, China: 55 },
    maxTension: 50 + turn,
    headlineCount: 2,
    ...overrides,
  };
}

function makeSnapshot(turn: number, overrides: Partial<TurnSnapshot> = {}): TurnSnapshot {
  return {
    turn,
    timestamp: Date.now(),
    nationStates: {} as never,
    relationshipMatrix: {} as never,
    headlines: [
      { text: `US economic growth in turn ${turn}`, severity: 'low', factions: ['US'] },
    ] as never,
    aiActions: [`US acted turn ${turn}`],
    stateChanges: [],
    ...overrides,
  };
}

function makeRunResult(overrides: Partial<HeadlessRunResult> = {}): HeadlessRunResult {
  const turns = 10;
  return {
    status: 'completed',
    finalState: { gameOver: true, gameEndReason: 'US achieves economic hegemony' } as never,
    eventLog: Array.from({ length: turns }, (_, i) => makeSnapshot(i + 1)),
    turnStats: Array.from({ length: turns }, (_, i) => makeStatEntry(i + 1)),
    turnsSimulated: turns,
    gameOverReason: 'US achieves economic hegemony',
    elapsedMs: 500,
    seed: 42,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ResultsAnalyzer', () => {
  // ── analyze() ──────────────────────────────────────────────────────────

  describe('analyze', () => {
    it('should return all four analysis components', () => {
      const result = ResultsAnalyzer.analyze(makeRunResult());
      expect(result.executiveSummary).toBeDefined();
      expect(result.nationScorecards).toBeDefined();
      expect(result.eventTimeline).toBeDefined();
      expect(result.statisticalSummary).toBeDefined();
    });
  });

  // ── Executive Summary ──────────────────────────────────────────────────

  describe('executiveSummary', () => {
    it('should extract winner from gameOverReason', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(analysis.executiveSummary.winner).toBe('US');
    });

    it('should return null winner when no gameOverReason', () => {
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ gameOverReason: null }),
      );
      expect(analysis.executiveSummary.winner).toBeNull();
    });

    it('should return null winner for non-matching reason format', () => {
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ gameOverReason: 'Maximum turns reached' }),
      );
      expect(analysis.executiveSummary.winner).toBeNull();
    });

    it('should record turnsPlayed', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(analysis.executiveSummary.turnsPlayed).toBe(10);
    });

    it('should provide outcome string', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(analysis.executiveSummary.outcome).toBe('US achieves economic hegemony');
    });

    it('should provide fallback outcome when no gameOverReason', () => {
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ gameOverReason: null }),
      );
      expect(analysis.executiveSummary.outcome).toContain('10 turns');
    });

    it('should find turning points from tension spikes', () => {
      const stats = Array.from({ length: 10 }, (_, i) =>
        makeStatEntry(i + 1, { maxTension: i === 4 ? 80 : 50 }),
      );
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ turnStats: stats }));
      const spikes = analysis.executiveSummary.turningPoints.filter(
        (tp) => tp.description.includes('tension spike'),
      );
      expect(spikes.length).toBeGreaterThan(0);
    });

    it('should find turning points from stability crashes', () => {
      const stats = Array.from({ length: 10 }, (_, i) =>
        makeStatEntry(i + 1, {
          stabilityByFaction: { US: i === 4 ? 25 : 60, China: 55 },
        }),
      );
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ turnStats: stats }));
      const crashes = analysis.executiveSummary.turningPoints.filter(
        (tp) => tp.description.includes('stability collapsed'),
      );
      expect(crashes.length).toBeGreaterThan(0);
    });

    it('should limit turning points to 5', () => {
      // Many stability crashes
      const stats = Array.from({ length: 20 }, (_, i) =>
        makeStatEntry(i + 1, {
          stabilityByFaction: { US: 60 - i * 3, China: 55 - i * 3, Russia: 50 - i * 3 },
        }),
      );
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ turnStats: stats, turnsSimulated: 20 }),
      );
      expect(analysis.executiveSummary.turningPoints.length).toBeLessThanOrEqual(5);
    });

    it('should extract top events from critical/high headlines', () => {
      const eventLog = Array.from({ length: 5 }, (_, i) =>
        makeSnapshot(i + 1, {
          headlines: [
            { text: `Critical event ${i}`, severity: 'critical', factions: ['US'] },
          ] as never,
        }),
      );
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      expect(analysis.executiveSummary.topEvents.length).toBeGreaterThan(0);
      expect(analysis.executiveSummary.topEvents.length).toBeLessThanOrEqual(5);
    });
  });

  // ── Nation Scorecards ──────────────────────────────────────────────────

  describe('nationScorecards', () => {
    it('should generate scorecard per faction', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(analysis.nationScorecards.length).toBe(2); // US and China
    });

    it('should compute GDP growth percentage', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      const us = analysis.nationScorecards.find((s) => s.factionId === 'US')!;
      expect(us.startGdp).toBe(20100); // turn 1: 20000 + 100
      expect(us.endGdp).toBe(21000); // turn 10: 20000 + 1000
      expect(us.gdpGrowthPct).toBeGreaterThan(0);
    });

    it('should compute stability delta', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      const us = analysis.nationScorecards.find((s) => s.factionId === 'US')!;
      expect(typeof us.stabilityDelta).toBe('number');
    });

    it('should assign trajectories', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      const us = analysis.nationScorecards.find((s) => s.factionId === 'US')!;
      expect(['rising', 'declining', 'stable']).toContain(us.gdpTrajectory);
      expect(['rising', 'declining', 'stable']).toContain(us.stabilityTrajectory);
      expect(['rising', 'declining', 'stable']).toContain(us.militaryTrajectory);
    });

    it('should calculate peak tension', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      const us = analysis.nationScorecards.find((s) => s.factionId === 'US')!;
      expect(us.peakTension).toBe(60); // 50 + 10 (turn 10)
    });

    it('should assign grade A-F', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      for (const card of analysis.nationScorecards) {
        expect(['A', 'B', 'C', 'D', 'F']).toContain(card.grade);
      }
    });

    it('should return empty array when no turn stats', () => {
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ turnStats: [] }),
      );
      expect(analysis.nationScorecards).toEqual([]);
    });

    it('should count headlines mentioning faction', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'US increases military', severity: 'low', factions: ['US'] },
            { text: 'China GDP grows', severity: 'low', factions: ['China'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ eventLog, turnsSimulated: 1, turnStats: [makeStatEntry(1)] }),
      );
      const us = analysis.nationScorecards.find((s) => s.factionId === 'US');
      expect(us!.headlineCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Event Timeline ─────────────────────────────────────────────────────

  describe('eventTimeline', () => {
    it('should build timeline from headlines and state changes', () => {
      const eventLog = [
        makeSnapshot(1, {
          stateChanges: ['State change 1'],
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ eventLog }),
      );
      expect(analysis.eventTimeline.length).toBeGreaterThan(0);
    });

    it('should categorize diplomatic events', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'Major diplomatic summit held', severity: 'high', factions: ['US'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const diplo = analysis.eventTimeline.filter((e) => e.category === 'diplomatic');
      expect(diplo.length).toBeGreaterThan(0);
    });

    it('should categorize military events', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'Military forces deployed', severity: 'high', factions: ['US'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const mil = analysis.eventTimeline.filter((e) => e.category === 'military');
      expect(mil.length).toBeGreaterThan(0);
    });

    it('should categorize economic events', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'GDP growth surges', severity: 'low', factions: ['US'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const econ = analysis.eventTimeline.filter((e) => e.category === 'economic');
      expect(econ.length).toBeGreaterThan(0);
    });

    it('should categorize crisis events', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'Critical crisis emerges', severity: 'critical', factions: ['US'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const crisis = analysis.eventTimeline.filter((e) => e.category === 'crisis');
      expect(crisis.length).toBeGreaterThan(0);
    });

    it('should categorize victory events', () => {
      const eventLog = [
        makeSnapshot(1, {
          headlines: [
            { text: 'US achieves hegemony', severity: 'high', factions: ['US'] },
          ] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const victory = analysis.eventTimeline.filter((e) => e.category === 'victory');
      expect(victory.length).toBeGreaterThan(0);
    });

    it('should mark state changes as crisis category', () => {
      const eventLog = [
        makeSnapshot(1, {
          stateChanges: ['Regime change in Syria'],
          headlines: [] as never,
        }),
      ];
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ eventLog }));
      const crisisChanges = analysis.eventTimeline.filter(
        (e) => e.category === 'crisis' && e.description.includes('Regime change'),
      );
      expect(crisisChanges.length).toBe(1);
    });
  });

  // ── Statistical Summary ────────────────────────────────────────────────

  describe('statisticalSummary', () => {
    it('should compute stability-GDP correlation', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(typeof analysis.statisticalSummary.stabilityGdpCorrelation).toBe('number');
      expect(analysis.statisticalSummary.stabilityGdpCorrelation).toBeGreaterThanOrEqual(-1);
      expect(analysis.statisticalSummary.stabilityGdpCorrelation).toBeLessThanOrEqual(1);
    });

    it('should determine tension trend', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(['rising', 'declining', 'stable']).toContain(
        analysis.statisticalSummary.tensionTrend,
      );
    });

    it('should identify most volatile faction', () => {
      const stats = Array.from({ length: 10 }, (_, i) =>
        makeStatEntry(i + 1, {
          stabilityByFaction: { US: 30 + (i % 2 === 0 ? 20 : -20), China: 55 },
        }),
      );
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ turnStats: stats }));
      expect(analysis.statisticalSummary.mostVolatileFaction).toBe('US');
    });

    it('should identify most stable faction', () => {
      const stats = Array.from({ length: 10 }, (_, i) =>
        makeStatEntry(i + 1, {
          stabilityByFaction: { US: 30 + (i % 2 === 0 ? 20 : -20), China: 55 },
        }),
      );
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ turnStats: stats }));
      expect(analysis.statisticalSummary.mostStableFaction).toBe('China');
    });

    it('should return avgTurnsToEnd when game ended', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult());
      expect(analysis.statisticalSummary.avgTurnsToEnd).toBe(10);
    });

    it('should return null avgTurnsToEnd when no game over', () => {
      const analysis = ResultsAnalyzer.analyze(
        makeRunResult({ gameOverReason: null }),
      );
      expect(analysis.statisticalSummary.avgTurnsToEnd).toBeNull();
    });

    it('should handle empty turn stats gracefully', () => {
      const analysis = ResultsAnalyzer.analyze(makeRunResult({ turnStats: [] }));
      expect(analysis.statisticalSummary.stabilityGdpCorrelation).toBe(0);
    });
  });

  // ── compare() ──────────────────────────────────────────────────────────

  describe('compare', () => {
    it('should handle empty array', () => {
      const result = ResultsAnalyzer.compare([]);
      expect(result.runCount).toBe(0);
      expect(result.winners).toEqual([]);
      expect(result.winRates).toEqual({});
      expect(result.consistencyScore).toBe(0);
    });

    it('should compare multiple runs', () => {
      const runs = [
        makeRunResult({ gameOverReason: 'US achieves hegemony', seed: 1 }),
        makeRunResult({ gameOverReason: 'US achieves hegemony', seed: 2 }),
        makeRunResult({ gameOverReason: 'China achieves hegemony', seed: 3 }),
      ];
      const result: ComparisonMetrics = ResultsAnalyzer.compare(runs);
      expect(result.runCount).toBe(3);
      expect(result.winners).toHaveLength(3);
    });

    it('should compute win rates', () => {
      const runs = [
        makeRunResult({ gameOverReason: 'US achieves hegemony', seed: 1 }),
        makeRunResult({ gameOverReason: 'US achieves hegemony', seed: 2 }),
        makeRunResult({ gameOverReason: 'China achieves hegemony', seed: 3 }),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(result.winRates['US']).toBeCloseTo(2 / 3, 2);
      expect(result.winRates['China']).toBeCloseTo(1 / 3, 2);
    });

    it('should compute average turns', () => {
      const runs = [
        makeRunResult({ turnsSimulated: 10 }),
        makeRunResult({ turnsSimulated: 20 }),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(result.avgTurns).toBe(15);
    });

    it('should compute GDP variance per faction', () => {
      const runs = [
        makeRunResult(),
        makeRunResult(),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(typeof result.gdpVariance['US']).toBe('number');
    });

    it('should compute consistency score (all same winner)', () => {
      const runs = [
        makeRunResult({ gameOverReason: 'US achieves hegemony' }),
        makeRunResult({ gameOverReason: 'US achieves hegemony' }),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(result.consistencyScore).toBe(1);
    });

    it('should compute low consistency (all different)', () => {
      const runs = [
        makeRunResult({ gameOverReason: 'US achieves hegemony' }),
        makeRunResult({ gameOverReason: 'China achieves hegemony' }),
        makeRunResult({ gameOverReason: 'Russia achieves hegemony' }),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(result.consistencyScore).toBeCloseTo(1 / 3, 2);
    });

    it('should record seed per winner', () => {
      const runs = [
        makeRunResult({ gameOverReason: 'US achieves hegemony', seed: 42 }),
        makeRunResult({ gameOverReason: null, seed: null }),
      ];
      const result = ResultsAnalyzer.compare(runs);
      expect(result.winners[0]!.seed).toBe(42);
      expect(result.winners[1]!.seed).toBeNull();
    });
  });
});
