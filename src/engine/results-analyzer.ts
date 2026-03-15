/**
 * CNFL-3903 — Results Aggregation & Analysis Engine
 *
 * Processes completed scenario execution results into meaningful analysis:
 * executive summaries, per-nation scorecards, event timelines,
 * statistical analysis, and comparison metrics across runs.
 */

import type { HeadlessRunResult } from './headless-runner';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExecutiveSummary {
  /** Who won (or game end reason). */
  winner: string | null;
  /** Total turns simulated. */
  turnsPlayed: number;
  /** Overall assessment. */
  outcome: string;
  /** Key turning points in the simulation. */
  turningPoints: TurningPoint[];
  /** Top 3 most impactful events. */
  topEvents: string[];
}

export interface TurningPoint {
  turn: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  affectedFactions: string[];
}

export interface NationScorecard {
  factionId: string;
  /** Starting and ending values. */
  startGdp: number;
  endGdp: number;
  gdpGrowthPct: number;
  startStability: number;
  endStability: number;
  stabilityDelta: number;
  startMilitary: number;
  endMilitary: number;
  /** Trajectory: 'rising', 'declining', 'stable'. */
  gdpTrajectory: Trajectory;
  stabilityTrajectory: Trajectory;
  militaryTrajectory: Trajectory;
  /** Average tension with other factions. */
  avgTension: number;
  /** Peak tension (highest recorded). */
  peakTension: number;
  /** Number of headlines mentioning this faction. */
  headlineCount: number;
  /** Overall grade A-F. */
  grade: string;
}

export type Trajectory = 'rising' | 'declining' | 'stable';

export interface EventTimeline {
  turn: number;
  category: 'diplomatic' | 'military' | 'economic' | 'crisis' | 'victory' | 'other';
  description: string;
  severity: string;
}

export interface StatisticalSummary {
  /** Correlation between stability and GDP across all factions. */
  stabilityGdpCorrelation: number;
  /** Average tension trend (increasing/decreasing/flat). */
  tensionTrend: Trajectory;
  /** Most volatile faction (highest std dev of stability). */
  mostVolatileFaction: string;
  /** Most stable faction. */
  mostStableFaction: string;
  /** Average turns to game end (if applicable). */
  avgTurnsToEnd: number | null;
}

export interface ComparisonMetrics {
  /** Number of runs being compared. */
  runCount: number;
  /** Winners per run. */
  winners: Array<{ runIndex: number; winner: string | null; seed: number | null }>;
  /** Win rate per faction across runs. */
  winRates: Record<string, number>;
  /** Average turns to completion. */
  avgTurns: number;
  /** GDP variance across runs by faction. */
  gdpVariance: Record<string, number>;
  /** Consistency score (0-1): how similar outcomes were across runs. */
  consistencyScore: number;
}

export interface AnalysisResult {
  executiveSummary: ExecutiveSummary;
  nationScorecards: NationScorecard[];
  eventTimeline: EventTimeline[];
  statisticalSummary: StatisticalSummary;
}

// ─── Analyzer ───────────────────────────────────────────────────────────────

export class ResultsAnalyzer {

  /**
   * Analyze a single completed run.
   */
  static analyze(result: HeadlessRunResult): AnalysisResult {
    return {
      executiveSummary: ResultsAnalyzer.buildExecutiveSummary(result),
      nationScorecards: ResultsAnalyzer.buildScorecards(result),
      eventTimeline: ResultsAnalyzer.buildTimeline(result),
      statisticalSummary: ResultsAnalyzer.buildStatistics(result),
    };
  }

  /**
   * Compare multiple runs (e.g., different seeds or AI providers).
   */
  static compare(results: HeadlessRunResult[]): ComparisonMetrics {
    if (results.length === 0) {
      return { runCount: 0, winners: [], winRates: {}, avgTurns: 0, gdpVariance: {}, consistencyScore: 0 };
    }

    const winners = results.map((r, i) => ({
      runIndex: i,
      winner: extractWinner(r.gameOverReason),
      seed: r.seed,
    }));

    const winCounts: Record<string, number> = {};
    for (const w of winners) {
      if (w.winner) {
        winCounts[w.winner] = (winCounts[w.winner] ?? 0) + 1;
      }
    }

    const winRates: Record<string, number> = {};
    for (const [faction, count] of Object.entries(winCounts)) {
      winRates[faction] = count / results.length;
    }

    const avgTurns = results.reduce((sum, r) => sum + r.turnsSimulated, 0) / results.length;

    // GDP variance per faction
    const gdpByFaction: Record<string, number[]> = {};
    for (const r of results) {
      const lastStat = r.turnStats[r.turnStats.length - 1];
      if (!lastStat) continue;
      for (const [fid, gdp] of Object.entries(lastStat.gdpByFaction)) {
        (gdpByFaction[fid] ??= []).push(gdp);
      }
    }

    const gdpVariance: Record<string, number> = {};
    for (const [fid, values] of Object.entries(gdpByFaction)) {
      gdpVariance[fid] = variance(values);
    }

    // Consistency: how many runs produced the same winner
    const topWinner = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];
    const consistencyScore = topWinner ? topWinner[1] / results.length : 0;

    return {
      runCount: results.length,
      winners,
      winRates,
      avgTurns: Math.round(avgTurns * 10) / 10,
      gdpVariance,
      consistencyScore,
    };
  }

  // ── Executive Summary ───────────────────────────────────────────────────

  private static buildExecutiveSummary(result: HeadlessRunResult): ExecutiveSummary {
    const winner = extractWinner(result.gameOverReason);
    const turningPoints = ResultsAnalyzer.findTurningPoints(result);
    const topEvents = ResultsAnalyzer.findTopEvents(result);

    const outcome = result.gameOverReason
      ? result.gameOverReason
      : `Simulation ran for ${result.turnsSimulated} turns without a decisive outcome.`;

    return {
      winner,
      turnsPlayed: result.turnsSimulated,
      outcome,
      turningPoints,
      topEvents,
    };
  }

  private static findTurningPoints(result: HeadlessRunResult): TurningPoint[] {
    const points: TurningPoint[] = [];
    const stats = result.turnStats;

    for (let i = 1; i < stats.length; i++) {
      const prev = stats[i - 1]!;
      const curr = stats[i]!;

      // Tension spike
      if (curr.maxTension - prev.maxTension > 15) {
        points.push({
          turn: curr.turn,
          description: `Major tension spike (${prev.maxTension.toFixed(0)} → ${curr.maxTension.toFixed(0)})`,
          impact: 'negative',
          affectedFactions: Object.keys(curr.gdpByFaction),
        });
      }

      // Stability crash for any faction
      for (const fid of Object.keys(curr.stabilityByFaction)) {
        const prevS = prev.stabilityByFaction[fid] ?? 50;
        const currS = curr.stabilityByFaction[fid] ?? 50;
        if (prevS - currS > 10) {
          points.push({
            turn: curr.turn,
            description: `${fid} stability collapsed (${prevS.toFixed(0)} → ${currS.toFixed(0)})`,
            impact: 'negative',
            affectedFactions: [fid],
          });
        }
      }
    }

    // Limit to top 5 most significant
    return points.slice(0, 5);
  }

  private static findTopEvents(result: HeadlessRunResult): string[] {
    const events: string[] = [];
    for (const snap of result.eventLog) {
      for (const h of snap.headlines) {
        if (h.severity === 'critical' || h.severity === 'high') {
          events.push(`Turn ${snap.turn}: ${h.text}`);
        }
      }
    }
    return events.slice(0, 5);
  }

  // ── Nation Scorecards ─────────────────────────────────────────────────

  private static buildScorecards(result: HeadlessRunResult): NationScorecard[] {
    const stats = result.turnStats;
    if (stats.length === 0) return [];

    const first = stats[0]!;
    const last = stats[stats.length - 1]!;
    const factions = Object.keys(first.gdpByFaction);
    const scorecards: NationScorecard[] = [];

    for (const fid of factions) {
      const startGdp = first.gdpByFaction[fid] ?? 0;
      const endGdp = last.gdpByFaction[fid] ?? 0;
      const startStab = first.stabilityByFaction[fid] ?? 50;
      const endStab = last.stabilityByFaction[fid] ?? 50;
      const startMil = first.militaryByFaction[fid] ?? 50;
      const endMil = last.militaryByFaction[fid] ?? 50;

      // GDP trajectory
      const gdpValues = stats.map((s) => s.gdpByFaction[fid] ?? 0);
      const stabValues = stats.map((s) => s.stabilityByFaction[fid] ?? 50);
      const milValues = stats.map((s) => s.militaryByFaction[fid] ?? 50);

      // Count headlines
      let headlineCount = 0;
      for (const snap of result.eventLog) {
        headlineCount += snap.headlines.filter((h) => h.text.includes(fid)).length;
      }

      // Average and peak tension
      let totalTension = 0;
      let peakTension = 0;
      for (const s of stats) {
        totalTension += s.maxTension;
        if (s.maxTension > peakTension) peakTension = s.maxTension;
      }

      const gdpGrowthPct = startGdp > 0 ? ((endGdp - startGdp) / startGdp) * 100 : 0;

      // Grade based on composite score
      const composite = (
        (endStab / 100) * 25 +
        (endMil / 100) * 20 +
        Math.min(gdpGrowthPct / 10, 25) +
        Math.max(0, (100 - peakTension) / 100) * 15 +
        15
      );
      const grade = composite >= 80 ? 'A' : composite >= 65 ? 'B' : composite >= 50 ? 'C' : composite >= 35 ? 'D' : 'F';

      scorecards.push({
        factionId: fid,
        startGdp,
        endGdp,
        gdpGrowthPct: Math.round(gdpGrowthPct * 10) / 10,
        startStability: startStab,
        endStability: endStab,
        stabilityDelta: Math.round((endStab - startStab) * 10) / 10,
        startMilitary: startMil,
        endMilitary: endMil,
        gdpTrajectory: trend(gdpValues),
        stabilityTrajectory: trend(stabValues),
        militaryTrajectory: trend(milValues),
        avgTension: stats.length > 0 ? Math.round(totalTension / stats.length) : 0,
        peakTension,
        headlineCount,
        grade,
      });
    }

    return scorecards;
  }

  // ── Event Timeline ────────────────────────────────────────────────────

  private static buildTimeline(result: HeadlessRunResult): EventTimeline[] {
    const timeline: EventTimeline[] = [];

    for (const snap of result.eventLog) {
      for (const h of snap.headlines) {
        timeline.push({
          turn: snap.turn,
          category: categorizeEvent(h.text),
          description: h.text,
          severity: h.severity,
        });
      }
      for (const change of snap.stateChanges) {
        timeline.push({
          turn: snap.turn,
          category: 'crisis',
          description: change,
          severity: 'high',
        });
      }
    }

    return timeline;
  }

  // ── Statistical Summary ───────────────────────────────────────────────

  private static buildStatistics(result: HeadlessRunResult): StatisticalSummary {
    const stats = result.turnStats;
    const factions = stats.length > 0 ? Object.keys(stats[0]!.gdpByFaction) : [];

    // Stability-GDP correlation
    const allStab: number[] = [];
    const allGdp: number[] = [];
    for (const s of stats) {
      for (const fid of factions) {
        allStab.push(s.stabilityByFaction[fid] ?? 50);
        allGdp.push(s.gdpByFaction[fid] ?? 0);
      }
    }
    const stabGdpCorr = correlation(allStab, allGdp);

    // Tension trend
    const tensions = stats.map((s) => s.maxTension);
    const tensionTrend = trend(tensions);

    // Most volatile / stable faction
    let mostVolatile = factions[0] ?? 'N/A';
    let mostStable = factions[0] ?? 'N/A';
    let maxVar = 0;
    let minVar = Infinity;

    for (const fid of factions) {
      const v = variance(stats.map((s) => s.stabilityByFaction[fid] ?? 50));
      if (v > maxVar) { maxVar = v; mostVolatile = fid; }
      if (v < minVar) { minVar = v; mostStable = fid; }
    }

    return {
      stabilityGdpCorrelation: Math.round(stabGdpCorr * 1000) / 1000,
      tensionTrend,
      mostVolatileFaction: mostVolatile,
      mostStableFaction: mostStable,
      avgTurnsToEnd: result.gameOverReason ? result.turnsSimulated : null,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractWinner(reason: string | null): string | null {
  if (!reason) return null;
  const match = reason.match(/^(.+?) achieves/);
  return match ? match[1] ?? null : null;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const xd = xs[i]! - mx;
    const yd = ys[i]! - my;
    num += xd * yd;
    dx += xd * xd;
    dy += yd * yd;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function trend(values: number[]): Trajectory {
  if (values.length < 2) return 'stable';
  const first = mean(values.slice(0, Math.ceil(values.length / 3)));
  const last = mean(values.slice(Math.floor(values.length * 2 / 3)));
  const change = last - first;
  const threshold = Math.abs(first) * 0.05 || 1;
  if (change > threshold) return 'rising';
  if (change < -threshold) return 'declining';
  return 'stable';
}

function categorizeEvent(text: string): EventTimeline['category'] {
  const lower = text.toLowerCase();
  if (lower.includes('tension') || lower.includes('summit') || lower.includes('diplomat') || lower.includes('alliance')) return 'diplomatic';
  if (lower.includes('military') || lower.includes('deploy') || lower.includes('strike') || lower.includes('forces')) return 'military';
  if (lower.includes('inflation') || lower.includes('gdp') || lower.includes('econom') || lower.includes('trade')) return 'economic';
  if (lower.includes('crisis') || lower.includes('collapse') || lower.includes('critical')) return 'crisis';
  if (lower.includes('victory') || lower.includes('achieves') || lower.includes('hegemony')) return 'victory';
  return 'other';
}
