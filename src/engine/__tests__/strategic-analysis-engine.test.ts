import { describe, it, expect, beforeEach } from 'vitest';
import type { FactionId, TurnNumber, StrategicGrade } from '@/data/types';
import { StrategicGrade as StrategicGradeEnum } from '@/data/types';
import {
  StrategicAnalysisEngine,
  type TurnViabilitySnapshot,
  type InflectionPoint,
  type RoadNotTakenProjection,
} from '@/engine/strategic-analysis-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  turn: number,
  scores: Record<string, number>,
): TurnViabilitySnapshot {
  return { turn: turn as TurnNumber, scores } as const;
}

function makeInflectionPoint(
  overrides: Partial<InflectionPoint> & { turn: number; victoryConditionId: string },
): InflectionPoint {
  return {
    previousScore: 50,
    newScore: 70,
    delta: 20,
    direction: 'up' as const,
    ...overrides,
    turn: overrides.turn as TurnNumber,
  };
}

// ---------------------------------------------------------------------------
// Engine instance
// ---------------------------------------------------------------------------

let engine: StrategicAnalysisEngine;

beforeEach(() => {
  engine = new StrategicAnalysisEngine({
    postGameAnalysis: GAME_CONFIG.postGameAnalysis,
    advisory: GAME_CONFIG.advisory,
  });
});

// ---------------------------------------------------------------------------
// 1. buildViabilityTimeline
// ---------------------------------------------------------------------------

describe('buildViabilityTimeline', () => {
  it('returns empty timeline when turnScores is empty', () => {
    const result = engine.buildViabilityTimeline({
      factionId: 'US' as FactionId,
      turnScores: [],
    });

    expect(result.factionId).toBe('US');
    expect(result.timeline).toEqual([]);
    expect(result.victoryConditionIds).toEqual([]);
    expect(result.totalTurns).toBe(0);
    expect(result.reason).toContain('0 turns');
  });

  it('builds timeline for a single turn with one condition', () => {
    const snap = makeSnapshot(1, { economic: 75 });
    const result = engine.buildViabilityTimeline({
      factionId: 'China' as FactionId,
      turnScores: [snap],
    });

    expect(result.factionId).toBe('China');
    expect(result.timeline).toHaveLength(1);
    expect(result.victoryConditionIds).toEqual(['economic']);
    expect(result.totalTurns).toBe(1);
  });

  it('builds timeline for multiple turns with consistent conditions', () => {
    const snaps = [
      makeSnapshot(1, { economic: 50, military: 40 }),
      makeSnapshot(2, { economic: 55, military: 38 }),
      makeSnapshot(3, { economic: 60, military: 35 }),
    ];
    const result = engine.buildViabilityTimeline({
      factionId: 'Russia' as FactionId,
      turnScores: snaps,
    });

    expect(result.totalTurns).toBe(3);
    expect(result.victoryConditionIds).toEqual(['economic', 'military']);
    expect(result.timeline).toEqual(snaps);
  });

  it('collects all unique victory condition IDs sorted alphabetically', () => {
    const snaps = [
      makeSnapshot(1, { zulu: 10, alpha: 20 }),
      makeSnapshot(2, { bravo: 30, alpha: 25 }),
      makeSnapshot(3, { charlie: 40, zulu: 50 }),
    ];
    const result = engine.buildViabilityTimeline({
      factionId: 'EU' as FactionId,
      turnScores: snaps,
    });

    expect(result.victoryConditionIds).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'zulu',
    ]);
  });

  it('preserves the original timeline snapshots by reference', () => {
    const snaps = [makeSnapshot(1, { eco: 60 })];
    const result = engine.buildViabilityTimeline({
      factionId: 'Japan' as FactionId,
      turnScores: snaps,
    });

    expect(result.timeline[0]).toBe(snaps[0]);
  });

  it('includes faction ID in reason string', () => {
    const result = engine.buildViabilityTimeline({
      factionId: 'Iran' as FactionId,
      turnScores: [makeSnapshot(1, { domination: 80 })],
    });

    expect(result.reason).toContain('Iran');
  });

  it('handles duplicate condition IDs across turns correctly', () => {
    const snaps = [
      makeSnapshot(1, { economic: 50, diplomatic: 40 }),
      makeSnapshot(2, { economic: 55, diplomatic: 45 }),
    ];
    const result = engine.buildViabilityTimeline({
      factionId: 'US' as FactionId,
      turnScores: snaps,
    });

    expect(result.victoryConditionIds).toEqual(['diplomatic', 'economic']);
  });
});

// ---------------------------------------------------------------------------
// 2. detectInflectionPoints
// ---------------------------------------------------------------------------

describe('detectInflectionPoints', () => {
  it('returns no inflection points for an empty timeline', () => {
    const result = engine.detectInflectionPoints({ timeline: [] });

    expect(result.inflectionPoints).toEqual([]);
    expect(result.totalDetected).toBe(0);
  });

  it('returns no inflection points for a single-turn timeline', () => {
    const result = engine.detectInflectionPoints({
      timeline: [makeSnapshot(1, { eco: 50 })],
    });

    expect(result.inflectionPoints).toEqual([]);
    expect(result.totalDetected).toBe(0);
  });

  it('returns no inflection points when deltas are below threshold', () => {
    const timeline = [
      makeSnapshot(1, { eco: 50 }),
      makeSnapshot(2, { eco: 55 }),
      makeSnapshot(3, { eco: 60 }),
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(0);
  });

  it('detects an upward inflection point when delta equals threshold', () => {
    const timeline = [
      makeSnapshot(1, { eco: 50 }),
      makeSnapshot(2, { eco: 65 }), // delta = 15 = threshold
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(1);
    expect(result.inflectionPoints[0]).toEqual(
      expect.objectContaining({
        turn: 2 as TurnNumber,
        victoryConditionId: 'eco',
        previousScore: 50,
        newScore: 65,
        delta: 15,
        direction: 'up',
      }),
    );
  });

  it('detects a downward inflection point', () => {
    const timeline = [
      makeSnapshot(1, { mil: 70 }),
      makeSnapshot(2, { mil: 50 }), // delta = -20
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(1);
    expect(result.inflectionPoints[0]).toEqual(
      expect.objectContaining({
        direction: 'down',
        delta: 20,
        previousScore: 70,
        newScore: 50,
      }),
    );
  });

  it('detects multiple inflection points across different conditions', () => {
    const timeline = [
      makeSnapshot(1, { eco: 30, mil: 80 }),
      makeSnapshot(2, { eco: 50, mil: 60 }), // eco +20 up, mil -20 down
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(2);
    const directions = result.inflectionPoints.map((ip) => ip.direction);
    expect(directions).toContain('up');
    expect(directions).toContain('down');
  });

  it('detects inflection points across non-consecutive turns', () => {
    const timeline = [
      makeSnapshot(1, { eco: 30 }),
      makeSnapshot(2, { eco: 35 }), // +5, no
      makeSnapshot(3, { eco: 55 }), // +20, yes
      makeSnapshot(4, { eco: 58 }), // +3, no
      makeSnapshot(5, { eco: 40 }), // -18, yes
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(2);
    expect(result.inflectionPoints[0]!.turn).toBe(3 as TurnNumber);
    expect(result.inflectionPoints[1]!.turn).toBe(5 as TurnNumber);
  });

  it('uses custom threshold when provided', () => {
    const timeline = [
      makeSnapshot(1, { eco: 50 }),
      makeSnapshot(2, { eco: 60 }), // delta = 10
    ];

    const withDefault = engine.detectInflectionPoints({ timeline });
    expect(withDefault.totalDetected).toBe(0); // 10 < 15

    const withCustom = engine.detectInflectionPoints({
      timeline,
      threshold: 10,
    });
    expect(withCustom.totalDetected).toBe(1);
  });

  it('uses default threshold from config when no override given', () => {
    const expectedThreshold =
      GAME_CONFIG.postGameAnalysis.inflectionPointThreshold; // 15
    const timeline = [
      makeSnapshot(1, { eco: 50 }),
      makeSnapshot(2, { eco: 50 + expectedThreshold }),
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(1);
    expect(result.reason).toContain(String(expectedThreshold));
  });

  it('treats missing scores in one turn as 0', () => {
    const timeline = [
      makeSnapshot(1, { eco: 0 }),
      makeSnapshot(2, { eco: 0, newCondition: 20 }), // newCondition: 0→20 = +20
    ];
    const result = engine.detectInflectionPoints({ timeline });

    expect(result.totalDetected).toBe(1);
    expect(result.inflectionPoints[0]!.victoryConditionId).toBe('newCondition');
    expect(result.inflectionPoints[0]!.previousScore).toBe(0);
    expect(result.inflectionPoints[0]!.newScore).toBe(20);
  });

  it('includes threshold value in the reason string', () => {
    const result = engine.detectInflectionPoints({
      timeline: [],
      threshold: 42,
    });

    expect(result.reason).toContain('42');
  });
});

// ---------------------------------------------------------------------------
// 3. computeRoadNotTaken
// ---------------------------------------------------------------------------

describe('computeRoadNotTaken', () => {
  const baselineTimeline: readonly TurnViabilitySnapshot[] = [
    makeSnapshot(1, { eco: 50, mil: 60 }),
    makeSnapshot(2, { eco: 55, mil: 58 }),
    makeSnapshot(3, { eco: 40, mil: 70 }),
  ] as const;

  it('computes a single projection with deltas applied', () => {
    const ip = makeInflectionPoint({
      turn: 2,
      victoryConditionId: 'eco',
    });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 10, mil: -5 }],
    });

    expect(result.projections).toHaveLength(1);
    const proj = result.projections[0]!;
    expect(proj.inflectionTurn).toBe(2 as TurnNumber);
    expect(proj.originalScores).toEqual({ eco: 55, mil: 58 });
    expect(proj.projectedScores.eco).toBe(65); // 55 + 10
    expect(proj.projectedScores.mil).toBe(53); // 58 - 5
  });

  it('identifies the best alternative path by highest projected score', () => {
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 5, mil: 20 }],
    });

    const proj = result.projections[0]!;
    expect(proj.bestAlternativePath).toBe('mil'); // 60+20=80 > 50+5=55
    expect(proj.bestAlternativeScore).toBe(80);
  });

  it('clamps projected scores to maximum 100', () => {
    const timeline = [makeSnapshot(1, { eco: 95 })];
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: timeline,
      alternativeDeltas: [{ eco: 20 }],
    });

    expect(result.projections[0]!.projectedScores.eco).toBe(100);
  });

  it('clamps projected scores to minimum 0', () => {
    const timeline = [makeSnapshot(1, { eco: 5 })];
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: timeline,
      alternativeDeltas: [{ eco: -20 }],
    });

    expect(result.projections[0]!.projectedScores.eco).toBe(0);
  });

  it('skips inflection points whose turn is missing from the baseline', () => {
    const ip = makeInflectionPoint({ turn: 99, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 10 }],
    });

    expect(result.projections).toHaveLength(0);
  });

  it('returns empty projections when inflectionPoints is empty', () => {
    const result = engine.computeRoadNotTaken({
      inflectionPoints: [],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 10 }],
    });

    expect(result.projections).toEqual([]);
  });

  it('returns empty projections when alternativeDeltas is empty', () => {
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [],
    });

    expect(result.projections).toEqual([]);
  });

  it('processes multiple projections', () => {
    const ips = [
      makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' }),
      makeInflectionPoint({ turn: 3, victoryConditionId: 'mil' }),
    ];

    const result = engine.computeRoadNotTaken({
      inflectionPoints: ips,
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 5, mil: 5 }, { eco: -10, mil: 10 }],
    });

    expect(result.projections).toHaveLength(2);
    expect(result.projections[0]!.inflectionTurn).toBe(1 as TurnNumber);
    expect(result.projections[1]!.inflectionTurn).toBe(3 as TurnNumber);
  });

  it('respects roadNotTakenMaxProjections config limit', () => {
    const maxProjections =
      GAME_CONFIG.postGameAnalysis.roadNotTakenMaxProjections; // 10

    // Create more inflection points than the max
    const timeline: TurnViabilitySnapshot[] = [];
    const ips: InflectionPoint[] = [];
    const deltas: Record<string, number>[] = [];
    for (let t = 1; t <= maxProjections + 5; t++) {
      timeline.push(makeSnapshot(t, { eco: 50 }));
      ips.push(makeInflectionPoint({ turn: t, victoryConditionId: 'eco' }));
      deltas.push({ eco: 5 });
    }

    const result = engine.computeRoadNotTaken({
      inflectionPoints: ips,
      baselineTimeline: timeline,
      alternativeDeltas: deltas,
    });

    expect(result.projections.length).toBeLessThanOrEqual(maxProjections);
  });

  it('applies zero delta when condition key is missing from deltas', () => {
    const timeline = [makeSnapshot(1, { eco: 50, mil: 60 })];
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: timeline,
      alternativeDeltas: [{ eco: 10 }], // no 'mil' key
    });

    const proj = result.projections[0]!;
    expect(proj.projectedScores.mil).toBe(60); // unchanged
    expect(proj.projectedScores.eco).toBe(60); // 50 + 10
  });

  it('includes projection count in reason string', () => {
    const ip = makeInflectionPoint({ turn: 1, victoryConditionId: 'eco' });

    const result = engine.computeRoadNotTaken({
      inflectionPoints: [ip],
      baselineTimeline: [...baselineTimeline],
      alternativeDeltas: [{ eco: 5 }],
    });

    expect(result.reason).toContain('1');
  });
});

// ---------------------------------------------------------------------------
// 4. computeStrategicGrade
// ---------------------------------------------------------------------------

describe('computeStrategicGrade', () => {
  it('awards victory bonus (+10) to the adjusted score', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [80, 80, 80],
      inflectionPointCount: 2,
      finalOutcome: 'victory',
    });

    expect(result.averageScore).toBe(80);
    expect(result.adjustedScore).toBe(90); // 80 + 10
    expect(result.grade).toBe(StrategicGradeEnum.S);
  });

  it('applies loss penalty (-10) to the adjusted score', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [40, 40, 40],
      inflectionPointCount: 1,
      finalOutcome: 'loss',
    });

    expect(result.averageScore).toBe(40);
    expect(result.adjustedScore).toBe(30); // 40 - 10
    expect(result.grade).toBe(StrategicGradeEnum.D);
  });

  it('applies no adjustment for timeout', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [60, 60, 60],
      inflectionPointCount: 3,
      finalOutcome: 'timeout',
    });

    expect(result.averageScore).toBe(60);
    expect(result.adjustedScore).toBe(60);
    expect(result.grade).toBe(StrategicGradeEnum.B);
  });

  it('returns averageScore 0 and grade F for empty compositeScores', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.averageScore).toBe(0);
    expect(result.adjustedScore).toBe(0);
    expect(result.grade).toBe(StrategicGradeEnum.F);
  });

  it('clamps adjusted score to minimum 0 when loss penalty underflows', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [5, 5, 5],
      inflectionPointCount: 0,
      finalOutcome: 'loss',
    });

    expect(result.averageScore).toBe(5);
    expect(result.adjustedScore).toBe(0); // clamped: 5 - 10 = -5 → 0
    expect(result.grade).toBe(StrategicGradeEnum.F);
  });

  it('clamps adjusted score to maximum 100 when victory bonus overflows', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [95, 95, 95],
      inflectionPointCount: 5,
      finalOutcome: 'victory',
    });

    expect(result.averageScore).toBe(95);
    expect(result.adjustedScore).toBe(100); // clamped: 95 + 10 = 105 → 100
    expect(result.grade).toBe(StrategicGradeEnum.S);
  });

  // Grade threshold edge cases
  it('assigns grade S at exactly 90', () => {
    // Need adjusted = 90. With victory bonus: average = 80
    const result = engine.computeStrategicGrade({
      compositeScores: [80],
      inflectionPointCount: 0,
      finalOutcome: 'victory',
    });

    expect(result.adjustedScore).toBe(90);
    expect(result.grade).toBe(StrategicGradeEnum.S);
  });

  it('assigns grade A at exactly 75', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [75],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.adjustedScore).toBe(75);
    expect(result.grade).toBe(StrategicGradeEnum.A);
  });

  it('assigns grade A at 89.9 (just below S)', () => {
    // avg = 79.9, victory: 89.9
    const result = engine.computeStrategicGrade({
      compositeScores: [79.9],
      inflectionPointCount: 0,
      finalOutcome: 'victory',
    });

    expect(result.adjustedScore).toBeCloseTo(89.9);
    expect(result.grade).toBe(StrategicGradeEnum.A);
  });

  it('assigns grade B at exactly 60', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [60],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.adjustedScore).toBe(60);
    expect(result.grade).toBe(StrategicGradeEnum.B);
  });

  it('assigns grade C at exactly 45', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [45],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.adjustedScore).toBe(45);
    expect(result.grade).toBe(StrategicGradeEnum.C);
  });

  it('assigns grade D at exactly 30', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [30],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.adjustedScore).toBe(30);
    expect(result.grade).toBe(StrategicGradeEnum.D);
  });

  it('assigns grade F below 30', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [29.9],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.adjustedScore).toBeCloseTo(29.9);
    expect(result.grade).toBe(StrategicGradeEnum.F);
  });

  it('includes outcome and inflection count in reason string', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [50, 60],
      inflectionPointCount: 7,
      finalOutcome: 'victory',
    });

    expect(result.reason).toContain('victory');
    expect(result.reason).toContain('7');
  });

  it('computes correct average with varied scores', () => {
    const result = engine.computeStrategicGrade({
      compositeScores: [100, 50, 0],
      inflectionPointCount: 0,
      finalOutcome: 'timeout',
    });

    expect(result.averageScore).toBe(50);
    expect(result.adjustedScore).toBe(50);
    expect(result.grade).toBe(StrategicGradeEnum.C);
  });
});

// ---------------------------------------------------------------------------
// 5. generateReportSummary
// ---------------------------------------------------------------------------

describe('generateReportSummary', () => {
  it('generates a summary for a normal game', () => {
    const timeline: readonly TurnViabilitySnapshot[] = [
      makeSnapshot(1, { eco: 50, mil: 40 }),
      makeSnapshot(2, { eco: 60, mil: 55 }),
      makeSnapshot(3, { eco: 70, mil: 65 }),
    ] as const;

    const inflectionPoints: readonly InflectionPoint[] = [
      makeInflectionPoint({ turn: 2, victoryConditionId: 'eco' }),
    ] as const;

    const roadNotTaken: readonly RoadNotTakenProjection[] = [
      {
        inflectionTurn: 2 as TurnNumber,
        originalScores: { eco: 60, mil: 55 },
        projectedScores: { eco: 70, mil: 50 },
        bestAlternativePath: 'eco',
        bestAlternativeScore: 70,
      },
    ] as const;

    const result = engine.generateReportSummary({
      factionId: 'US' as FactionId,
      timeline: [...timeline],
      inflectionPoints: [...inflectionPoints],
      grade: StrategicGradeEnum.A as StrategicGrade,
      roadNotTaken: [...roadNotTaken],
    });

    expect(result.factionId).toBe('US');
    expect(result.totalTurns).toBe(3);
    expect(result.totalInflectionPoints).toBe(1);
    expect(result.grade).toBe(StrategicGradeEnum.A);
    expect(result.topVictoryPath).toBe('eco'); // 70 > 65
    expect(result.topFinalScore).toBe(70);
    expect(result.alternativePathCount).toBe(1);
    expect(result.summary).toContain('US');
    expect(result.summary).toContain('3 turns');
    expect(result.summary).toContain('eco');
  });

  it('returns defaults when timeline is empty', () => {
    const result = engine.generateReportSummary({
      factionId: 'China' as FactionId,
      timeline: [],
      inflectionPoints: [],
      grade: StrategicGradeEnum.F as StrategicGrade,
      roadNotTaken: [],
    });

    expect(result.totalTurns).toBe(0);
    expect(result.topVictoryPath).toBe('none');
    expect(result.topFinalScore).toBe(0);
    expect(result.alternativePathCount).toBe(0);
  });

  it('returns empty alternative path count when roadNotTaken is empty', () => {
    const timeline = [makeSnapshot(1, { eco: 60 })];

    const result = engine.generateReportSummary({
      factionId: 'Russia' as FactionId,
      timeline,
      inflectionPoints: [],
      grade: StrategicGradeEnum.B as StrategicGrade,
      roadNotTaken: [],
    });

    expect(result.alternativePathCount).toBe(0);
  });

  it('picks the correct top victory path from the last turn', () => {
    const timeline = [
      makeSnapshot(1, { eco: 90, mil: 10 }),
      makeSnapshot(2, { eco: 20, mil: 80 }), // last turn: mil is highest
    ];

    const result = engine.generateReportSummary({
      factionId: 'Japan' as FactionId,
      timeline,
      inflectionPoints: [],
      grade: StrategicGradeEnum.A as StrategicGrade,
      roadNotTaken: [],
    });

    expect(result.topVictoryPath).toBe('mil');
    expect(result.topFinalScore).toBe(80);
  });

  it('includes grade in the summary narrative', () => {
    const timeline = [makeSnapshot(1, { eco: 50 })];

    const result = engine.generateReportSummary({
      factionId: 'EU' as FactionId,
      timeline,
      inflectionPoints: [],
      grade: StrategicGradeEnum.S as StrategicGrade,
      roadNotTaken: [],
    });

    expect(result.summary).toContain('S');
  });

  it('counts multiple inflection points correctly', () => {
    const timeline = [
      makeSnapshot(1, { eco: 30 }),
      makeSnapshot(2, { eco: 60 }),
      makeSnapshot(3, { eco: 40 }),
    ];

    const ips = [
      makeInflectionPoint({ turn: 2, victoryConditionId: 'eco' }),
      makeInflectionPoint({ turn: 3, victoryConditionId: 'eco', direction: 'down' }),
    ];

    const result = engine.generateReportSummary({
      factionId: 'DPRK' as FactionId,
      timeline,
      inflectionPoints: ips,
      grade: StrategicGradeEnum.C as StrategicGrade,
      roadNotTaken: [],
    });

    expect(result.totalInflectionPoints).toBe(2);
  });

  it('counts multiple road-not-taken projections', () => {
    const timeline = [makeSnapshot(1, { eco: 50, mil: 60 })];

    const roadNotTaken: RoadNotTakenProjection[] = [
      {
        inflectionTurn: 1 as TurnNumber,
        originalScores: { eco: 50 },
        projectedScores: { eco: 70 },
        bestAlternativePath: 'eco',
        bestAlternativeScore: 70,
      },
      {
        inflectionTurn: 1 as TurnNumber,
        originalScores: { mil: 60 },
        projectedScores: { mil: 80 },
        bestAlternativePath: 'mil',
        bestAlternativeScore: 80,
      },
    ];

    const result = engine.generateReportSummary({
      factionId: 'Syria' as FactionId,
      timeline,
      inflectionPoints: [],
      grade: StrategicGradeEnum.D as StrategicGrade,
      roadNotTaken,
    });

    expect(result.alternativePathCount).toBe(2);
  });

  it('handles a single condition with score 0 on the last turn', () => {
    const timeline = [makeSnapshot(1, { eco: 0 })];

    const result = engine.generateReportSummary({
      factionId: 'Iran' as FactionId,
      timeline,
      inflectionPoints: [],
      grade: StrategicGradeEnum.F as StrategicGrade,
      roadNotTaken: [],
    });

    // topFinalScore stays 0 and topVictoryPath stays 'none' because
    // the loop condition is `score > topFinalScore` (strict gt), so 0 doesn't beat initial 0.
    expect(result.topFinalScore).toBe(0);
    expect(result.topVictoryPath).toBe('none');
  });
});
