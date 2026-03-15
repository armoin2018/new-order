import { describe, it, expect } from 'vitest';
import { ScenarioScoringEngine } from '@/engine/scenario-scoring-engine';
import type {
  GameMetrics,
  ScoringWeights,
  HistoricalScore,
} from '@/engine/scenario-scoring-engine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMetrics(overrides: Partial<GameMetrics> = {}): GameMetrics {
  return {
    factionId: 'us',
    turnsPlayed: 60,
    // Stability
    averageStability: 70,
    lowestStability: 40,
    stabilityTrend: 5,
    // Economic
    gdpGrowthPercent: 15,
    finalTreasury: 300,
    averageInflation: 5,
    marketCompositeGrowthPercent: 20,
    // Military
    territoryControlPercent: 60,
    forcePreservationPercent: 85,
    averageReadiness: 70,
    // Diplomatic
    allianceCount: 4,
    internationalLegitimacy: 75,
    diplomaticInfluence: 65,
    // Technology
    maxDomainLevel: 60,
    techsResearched: 8,
    techModulesGenerated: 5,
    // Market
    compositeIndexGrowthPercent: 15,
    customIndexPerformanceAvg: 10,
    marketCrashEvents: 1,
    // Strategic
    strategicGrade: 70,
    victoryPathAdherence: 65,
    ...overrides,
  };
}

function makePerfectMetrics(): GameMetrics {
  return makeMetrics({
    averageStability: 100,
    lowestStability: 95,
    stabilityTrend: 10,
    gdpGrowthPercent: 50,
    finalTreasury: 10000,
    averageInflation: 2,
    marketCompositeGrowthPercent: 100,
    territoryControlPercent: 100,
    forcePreservationPercent: 100,
    averageReadiness: 100,
    allianceCount: 7,
    internationalLegitimacy: 100,
    diplomaticInfluence: 100,
    maxDomainLevel: 100,
    techsResearched: 20,
    techModulesGenerated: 10,
    compositeIndexGrowthPercent: 100,
    customIndexPerformanceAvg: 100,
    marketCrashEvents: 0,
    strategicGrade: 100,
    victoryPathAdherence: 100,
  });
}

function makeTerribleMetrics(): GameMetrics {
  return makeMetrics({
    averageStability: 5,
    lowestStability: 0,
    stabilityTrend: -10,
    gdpGrowthPercent: -50,
    finalTreasury: 0,
    averageInflation: 50,
    marketCompositeGrowthPercent: -50,
    territoryControlPercent: 0,
    forcePreservationPercent: 0,
    averageReadiness: 0,
    allianceCount: 0,
    internationalLegitimacy: 0,
    diplomaticInfluence: 0,
    maxDomainLevel: 0,
    techsResearched: 0,
    techModulesGenerated: 0,
    compositeIndexGrowthPercent: -50,
    customIndexPerformanceAvg: 0,
    marketCrashEvents: 5,
    strategicGrade: 0,
    victoryPathAdherence: 0,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioScoringEngine', () => {
  const engine = new ScenarioScoringEngine();

  // ── computeCompositeScore ────────────────────────────────────────────

  describe('computeCompositeScore', () => {
    it('returns score in 0–1000 range', () => {
      const score = engine.computeCompositeScore(makeMetrics());
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(1000);
    });

    it('includes all 7 dimensions', () => {
      const score = engine.computeCompositeScore(makeMetrics());
      expect(score.dimensions).toHaveLength(7);
      const dimensionNames = score.dimensions.map((d) => d.dimension);
      expect(dimensionNames).toContain('stability');
      expect(dimensionNames).toContain('economic');
      expect(dimensionNames).toContain('military');
      expect(dimensionNames).toContain('diplomatic');
      expect(dimensionNames).toContain('technology');
      expect(dimensionNames).toContain('market');
      expect(dimensionNames).toContain('strategic');
    });

    it('scores > 800 with perfect metrics', () => {
      const score = engine.computeCompositeScore(makePerfectMetrics());
      expect(score.totalScore).toBeGreaterThan(800);
    });

    it('scores < 200 with terrible metrics', () => {
      const score = engine.computeCompositeScore(makeTerribleMetrics());
      expect(score.totalScore).toBeLessThan(200);
    });

    it('has non-zero weighted scores per dimension for balanced input', () => {
      const score = engine.computeCompositeScore(makeMetrics());
      for (const dim of score.dimensions) {
        expect(dim.weightedScore).toBeGreaterThan(0);
      }
    });
  });

  // ── computeDimensionScore ────────────────────────────────────────────

  describe('computeDimensionScore', () => {
    it('stability uses weighted formula', () => {
      const score = engine.computeDimensionScore('stability', makeMetrics());
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('economic includes market composite', () => {
      const lowMarket = engine.computeDimensionScore(
        'economic',
        makeMetrics({ marketCompositeGrowthPercent: -50 }),
      );
      const highMarket = engine.computeDimensionScore(
        'economic',
        makeMetrics({ marketCompositeGrowthPercent: 80 }),
      );
      expect(highMarket).toBeGreaterThan(lowMarket);
    });

    it('military uses territory and readiness', () => {
      const lowMil = engine.computeDimensionScore(
        'military',
        makeMetrics({ territoryControlPercent: 10, averageReadiness: 10 }),
      );
      const highMil = engine.computeDimensionScore(
        'military',
        makeMetrics({ territoryControlPercent: 95, averageReadiness: 95 }),
      );
      expect(highMil).toBeGreaterThan(lowMil);
    });

    it('technology rewards more techs researched', () => {
      const fewTechs = engine.computeDimensionScore(
        'technology',
        makeMetrics({ techsResearched: 2, techModulesGenerated: 1, maxDomainLevel: 20 }),
      );
      const manyTechs = engine.computeDimensionScore(
        'technology',
        makeMetrics({ techsResearched: 20, techModulesGenerated: 10, maxDomainLevel: 100 }),
      );
      expect(manyTechs).toBeGreaterThan(fewTechs);
    });

    it('market penalises crash events', () => {
      const noCrash = engine.computeDimensionScore(
        'market',
        makeMetrics({ marketCrashEvents: 0 }),
      );
      const manyCrash = engine.computeDimensionScore(
        'market',
        makeMetrics({ marketCrashEvents: 5 }),
      );
      expect(noCrash).toBeGreaterThan(manyCrash);
    });
  });

  // ── assignLetterGrade ────────────────────────────────────────────────

  describe('assignLetterGrade', () => {
    it('returns S for score >= 95', () => {
      expect(engine.assignLetterGrade(95)).toBe('S');
      expect(engine.assignLetterGrade(100)).toBe('S');
    });

    it('returns A for score 80–94', () => {
      expect(engine.assignLetterGrade(80)).toBe('A');
      expect(engine.assignLetterGrade(94)).toBe('A');
    });

    it('returns B for score 65–79', () => {
      expect(engine.assignLetterGrade(65)).toBe('B');
      expect(engine.assignLetterGrade(79)).toBe('B');
    });

    it('returns C for score 50–64', () => {
      expect(engine.assignLetterGrade(50)).toBe('C');
      expect(engine.assignLetterGrade(64)).toBe('C');
    });

    it('returns D for score 35–49', () => {
      expect(engine.assignLetterGrade(35)).toBe('D');
      expect(engine.assignLetterGrade(49)).toBe('D');
    });

    it('returns F for score < 35', () => {
      expect(engine.assignLetterGrade(34)).toBe('F');
      expect(engine.assignLetterGrade(0)).toBe('F');
    });
  });

  // ── computePercentile ───────────────────────────────────────────────

  describe('computePercentile', () => {
    it('returns 100 when no history', () => {
      const percentile = engine.computePercentile(500, []);
      expect(percentile).toBe(100);
    });

    it('returns 100 when higher than all history', () => {
      const history: HistoricalScore[] = [
        { scenarioId: 's1', factionId: 'us', totalScore: 200, turnsPlayed: 60, date: '2025-01-01' },
        { scenarioId: 's2', factionId: 'china', totalScore: 300, turnsPlayed: 60, date: '2025-01-02' },
      ];
      const percentile = engine.computePercentile(900, history);
      expect(percentile).toBe(100);
    });

    it('returns 0 when lower than all history', () => {
      const history: HistoricalScore[] = [
        { scenarioId: 's1', factionId: 'us', totalScore: 500, turnsPlayed: 60, date: '2025-01-01' },
        { scenarioId: 's2', factionId: 'china', totalScore: 600, turnsPlayed: 60, date: '2025-01-02' },
      ];
      const percentile = engine.computePercentile(100, history);
      expect(percentile).toBe(0);
    });

    it('computes meaningful percentile for middle score', () => {
      const history: HistoricalScore[] = [
        { scenarioId: 's1', factionId: 'us', totalScore: 200, turnsPlayed: 60, date: '2025-01-01' },
        { scenarioId: 's2', factionId: 'china', totalScore: 400, turnsPlayed: 60, date: '2025-01-02' },
        { scenarioId: 's3', factionId: 'japan', totalScore: 600, turnsPlayed: 60, date: '2025-01-03' },
        { scenarioId: 's4', factionId: 'eu', totalScore: 800, turnsPlayed: 60, date: '2025-01-04' },
      ];
      const percentile = engine.computePercentile(500, history);
      expect(percentile).toBeGreaterThan(25);
      expect(percentile).toBeLessThan(75);
    });
  });

  // ── compareToAI ──────────────────────────────────────────────────────

  describe('compareToAI', () => {
    it('ranks factions by score descending', () => {
      const player = makeMetrics({ factionId: 'us' });
      const ai1 = makePerfectMetrics();
      const ai2 = makeTerribleMetrics();

      const results = engine.compareToAI(player, [
        { ...ai1, factionId: 'china' },
        { ...ai2, factionId: 'russia' },
      ]);

      expect(results).toHaveLength(3);
      // Results should be sorted descending by totalScore
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].totalScore).toBeGreaterThanOrEqual(results[i].totalScore);
      }
      // Rank should be sequential
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
      expect(results[2].rank).toBe(3);
    });

    it('includes player faction in results', () => {
      const player = makeMetrics({ factionId: 'us' });
      const results = engine.compareToAI(player, []);
      expect(results).toHaveLength(1);
      expect(results[0].factionId).toBe('us');
    });
  });

  // ── getScoreBreakdown ────────────────────────────────────────────────

  describe('getScoreBreakdown', () => {
    it('identifies strongest and weakest dimensions', () => {
      const score = engine.computeCompositeScore(makeMetrics());
      const breakdown = engine.getScoreBreakdown(score);

      expect(breakdown.strongest.rawScore).toBeGreaterThanOrEqual(breakdown.weakest.rawScore);
      expect(breakdown.dimensions).toHaveLength(7);
      expect(breakdown.totalScore).toBe(score.totalScore);
    });

    it('assigns overall grade', () => {
      const score = engine.computeCompositeScore(makeMetrics());
      const breakdown = engine.getScoreBreakdown(score);
      expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(breakdown.overallGrade);
    });
  });
});
