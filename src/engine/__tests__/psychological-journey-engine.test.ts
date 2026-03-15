import { describe, it, expect, beforeEach } from 'vitest';
import type {
  LeaderId,
  TurnNumber,
  EmotionalStateSnapshot,
  LeaderPsychology,
  PersonalityDriftLog,
} from '@/data/types';
import {
  PsychologicalJourneyEngine,
  type GrudgeTimelineInput,
  type EmotionalTimelineEntry,
  type PersonalityRadarResult,
  type GrudgeTimelineResult,
  type PsychologicalTurningPoint,
} from '@/engine/psychological-journey-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEADER_A = 'leader-a' as LeaderId;
const LEADER_B = 'leader-b' as LeaderId;

function makeSnapshot(
  turn: number,
  overrides: Partial<Omit<EmotionalStateSnapshot, 'turn'>> = {},
): EmotionalStateSnapshot {
  return {
    turn: turn as TurnNumber,
    stress: 50,
    confidence: 50,
    anger: 50,
    fear: 50,
    resolve: 50,
    ...overrides,
  } as EmotionalStateSnapshot;
}

function makeGrudge(
  overrides: Partial<GrudgeTimelineInput> & { turnCreated: number },
): GrudgeTimelineInput {
  return {
    offender: LEADER_B,
    offenseType: 'betrayal',
    severity: 5,
    resolved: false,
    influencedDecisionCount: 1,
    ...overrides,
    turnCreated: overrides.turnCreated as TurnNumber,
  };
}

function makeProfile(
  overrides: Partial<Record<string, number>> = {},
): LeaderPsychology {
  const base: Record<string, number> = {};
  for (const dim of GAME_CONFIG.postGameAnalysis.radarDimensions) {
    base[dim] = 50;
  }
  return { ...base, ...overrides } as unknown as LeaderPsychology;
}

function makeDriftLog(
  events: Array<{ trigger: string; turn: number; dimension: string; delta: number }>,
  overrides: Partial<PersonalityDriftLog> = {},
): PersonalityDriftLog {
  return {
    driftEvents: events.map((e) => ({
      trigger: e.trigger,
      turn: e.turn as TurnNumber,
      dimension: e.dimension,
      delta: e.delta,
    })),
    currentDriftMagnitude: overrides.currentDriftMagnitude ?? 0,
    stressInoculationTurn: overrides.stressInoculationTurn ?? null,
  } as PersonalityDriftLog;
}

function makeTimelineEntry(
  turn: number,
  overrides: Partial<Omit<EmotionalTimelineEntry, 'turn'>> = {},
): EmotionalTimelineEntry {
  return {
    turn: turn as TurnNumber,
    stress: 50,
    confidence: 50,
    anger: 50,
    fear: 50,
    resolve: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Engine instance
// ---------------------------------------------------------------------------

let engine: PsychologicalJourneyEngine;

beforeEach(() => {
  engine = new PsychologicalJourneyEngine(GAME_CONFIG.postGameAnalysis);
});

// ---------------------------------------------------------------------------
// 1. buildEmotionalTimeline
// ---------------------------------------------------------------------------

describe('buildEmotionalTimeline', () => {
  it('returns empty timeline when snapshots is empty', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [],
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.timeline).toHaveLength(0);
    expect(result.peakStressTurn).toBeNull();
    expect(result.peakAngerTurn).toBeNull();
    expect(result.totalTurns).toBe(0);
    expect(result.reason).toContain('No emotional snapshots');
  });

  it('handles a single snapshot correctly', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [makeSnapshot(1, { stress: 70, anger: 30 })],
    });

    expect(result.timeline).toHaveLength(1);
    expect(result.totalTurns).toBe(1);
    expect(result.peakStressTurn).toBe(1 as TurnNumber);
    expect(result.peakAngerTurn).toBe(1 as TurnNumber);
    expect(result.timeline[0]!.stress).toBe(70);
    expect(result.timeline[0]!.anger).toBe(30);
  });

  it('sorts snapshots by turn in ascending order', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [
        makeSnapshot(3, { stress: 20 }),
        makeSnapshot(1, { stress: 80 }),
        makeSnapshot(2, { stress: 60 }),
      ],
    });

    expect(result.timeline.map((e) => e.turn as number)).toEqual([1, 2, 3]);
  });

  it('identifies peak stress turn across multiple snapshots', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [
        makeSnapshot(1, { stress: 30 }),
        makeSnapshot(2, { stress: 90 }),
        makeSnapshot(3, { stress: 60 }),
      ],
    });

    expect(result.peakStressTurn).toBe(2 as TurnNumber);
  });

  it('identifies peak anger turn across multiple snapshots', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [
        makeSnapshot(1, { anger: 10 }),
        makeSnapshot(2, { anger: 45 }),
        makeSnapshot(3, { anger: 95 }),
      ],
    });

    expect(result.peakAngerTurn).toBe(3 as TurnNumber);
  });

  it('clamps values that exceed 100 down to 100', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [makeSnapshot(1, { stress: 150, confidence: 200 })],
    });

    expect(result.timeline[0]!.stress).toBe(100);
    expect(result.timeline[0]!.confidence).toBe(100);
  });

  it('clamps values below 0 up to 0', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [makeSnapshot(1, { fear: -20, resolve: -5 })],
    });

    expect(result.timeline[0]!.fear).toBe(0);
    expect(result.timeline[0]!.resolve).toBe(0);
  });

  it('produces a reason string with peak turn information', () => {
    const result = engine.buildEmotionalTimeline({
      leaderId: LEADER_A,
      snapshots: [
        makeSnapshot(1, { stress: 40, anger: 20 }),
        makeSnapshot(2, { stress: 80, anger: 60 }),
      ],
    });

    expect(result.reason).toContain('2 turn(s)');
    expect(result.reason).toContain('Peak stress');
    expect(result.reason).toContain('peak anger');
  });
});

// ---------------------------------------------------------------------------
// 2. computePersonalityRadar
// ---------------------------------------------------------------------------

describe('computePersonalityRadar', () => {
  it('returns zero drift when original and current profiles are identical', () => {
    const profile = makeProfile();
    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: profile,
      currentProfile: profile,
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.totalDriftMagnitude).toBe(0);
    expect(result.dimensions.every((d) => d.delta === 0)).toBe(true);
  });

  it('computes correct delta for a single dimension drift', () => {
    const original = makeProfile({ riskTolerance: 40 });
    const current = makeProfile({ riskTolerance: 70 });

    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: original,
      currentProfile: current,
    });

    const rtDim = result.dimensions.find((d) => d.name === 'riskTolerance');
    expect(rtDim).toBeDefined();
    expect(rtDim!.original).toBe(40);
    expect(rtDim!.current).toBe(70);
    expect(rtDim!.delta).toBe(30);
  });

  it('reports the most drifted dimension correctly', () => {
    const original = makeProfile({ riskTolerance: 50, paranoia: 50 });
    const current = makeProfile({ riskTolerance: 55, paranoia: 90 });

    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: original,
      currentProfile: current,
    });

    expect(result.mostDriftedDimension).toBe('paranoia');
  });

  it('sums absolute deltas for totalDriftMagnitude', () => {
    const original = makeProfile({ riskTolerance: 50, paranoia: 50 });
    const current = makeProfile({ riskTolerance: 60, paranoia: 30 });

    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: original,
      currentProfile: current,
    });

    // riskTolerance: |+10| = 10, paranoia: |-20| = 20, rest: 0
    expect(result.totalDriftMagnitude).toBe(30);
  });

  it('handles negative deltas (current < original)', () => {
    const original = makeProfile({ patience: 80 });
    const current = makeProfile({ patience: 30 });

    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: original,
      currentProfile: current,
    });

    const pDim = result.dimensions.find((d) => d.name === 'patience');
    expect(pDim!.delta).toBe(-50);
  });

  it('includes all configured radar dimensions', () => {
    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: makeProfile(),
      currentProfile: makeProfile(),
    });

    const dimNames = result.dimensions.map((d) => d.name);
    for (const expected of GAME_CONFIG.postGameAnalysis.radarDimensions) {
      expect(dimNames).toContain(expected);
    }
  });

  it('includes drift info in reason string', () => {
    const result = engine.computePersonalityRadar({
      leaderId: LEADER_A,
      originalProfile: makeProfile({ vengefulIndex: 20 }),
      currentProfile: makeProfile({ vengefulIndex: 80 }),
    });

    expect(result.reason).toContain('dimension(s)');
    expect(result.reason).toContain('Most drifted');
  });
});

// ---------------------------------------------------------------------------
// 3. buildGrudgeTimeline
// ---------------------------------------------------------------------------

describe('buildGrudgeTimeline', () => {
  it('returns empty result when grudges is empty', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [],
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.entries).toHaveLength(0);
    expect(result.totalGrudges).toBe(0);
    expect(result.unresolvedCount).toBe(0);
    expect(result.mostInfluentialGrudge).toBeNull();
    expect(result.reason).toContain('No grudges');
  });

  it('returns a single grudge correctly', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [makeGrudge({ turnCreated: 5, severity: 8 })],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.totalGrudges).toBe(1);
    expect(result.entries[0]!.severity).toBe(8);
    expect(result.entries[0]!.turnCreated).toBe(5 as TurnNumber);
  });

  it('sorts grudges by turnCreated ascending', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [
        makeGrudge({ turnCreated: 10 }),
        makeGrudge({ turnCreated: 2 }),
        makeGrudge({ turnCreated: 7 }),
      ],
    });

    const turns = result.entries.map((e) => e.turnCreated as number);
    expect(turns).toEqual([2, 7, 10]);
  });

  it('caps entries at grudgeTimelineMaxEntries (20)', () => {
    const grudges = Array.from({ length: 25 }, (_, i) =>
      makeGrudge({ turnCreated: i + 1 }),
    );

    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges,
    });

    expect(result.entries).toHaveLength(GAME_CONFIG.postGameAnalysis.grudgeTimelineMaxEntries);
    expect(result.totalGrudges).toBe(25);
  });

  it('identifies the most influential grudge', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [
        makeGrudge({ turnCreated: 1, influencedDecisionCount: 3 }),
        makeGrudge({ turnCreated: 2, influencedDecisionCount: 10 }),
        makeGrudge({ turnCreated: 3, influencedDecisionCount: 5 }),
      ],
    });

    expect(result.mostInfluentialGrudge).not.toBeNull();
    expect(result.mostInfluentialGrudge!.influencedDecisionCount).toBe(10);
  });

  it('counts all unresolved grudges (including those beyond the cap)', () => {
    const grudges = Array.from({ length: 25 }, (_, i) =>
      makeGrudge({ turnCreated: i + 1, resolved: false }),
    );

    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges,
    });

    expect(result.unresolvedCount).toBe(25);
  });

  it('reports zero unresolved when all grudges are resolved', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [
        makeGrudge({ turnCreated: 1, resolved: true }),
        makeGrudge({ turnCreated: 2, resolved: true }),
      ],
    });

    expect(result.unresolvedCount).toBe(0);
  });

  it('reports all unresolved when none are resolved', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [
        makeGrudge({ turnCreated: 1, resolved: false }),
        makeGrudge({ turnCreated: 2, resolved: false }),
        makeGrudge({ turnCreated: 3, resolved: false }),
      ],
    });

    expect(result.unresolvedCount).toBe(3);
  });

  it('includes grudge summary in reason string', () => {
    const result = engine.buildGrudgeTimeline({
      leaderId: LEADER_A,
      grudges: [makeGrudge({ turnCreated: 1 })],
    });

    expect(result.reason).toContain('1 of 1 total grudge(s)');
  });
});

// ---------------------------------------------------------------------------
// 4. detectPsychologicalTurningPoints
// ---------------------------------------------------------------------------

describe('detectPsychologicalTurningPoints', () => {
  it('returns no turning points for an empty timeline', () => {
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [],
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.turningPoints).toHaveLength(0);
    expect(result.totalDetected).toBe(0);
    expect(result.reason).toContain('No psychological turning points');
  });

  it('returns no turning points when values stay below threshold', () => {
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 30 }),
        makeTimelineEntry(2, { stress: 50 }),
        makeTimelineEntry(3, { stress: 60 }),
      ],
    });

    expect(result.turningPoints).toHaveLength(0);
  });

  it('returns no turning points when delta is below minDelta even if threshold exceeded', () => {
    // newValue >= 80 but delta < 20
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 70 }),
        makeTimelineEntry(2, { stress: 85 }),
      ],
    });

    expect(result.turningPoints).toHaveLength(0);
  });

  it('detects a turning point when threshold and minDelta are both met', () => {
    // stress jumps from 50 -> 85 (newValue=85 >= 80, delta=35 >= 20)
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 50 }),
        makeTimelineEntry(2, { stress: 85 }),
      ],
    });

    expect(result.turningPoints).toHaveLength(1);
    expect(result.turningPoints[0]!.dimension).toBe('stress');
    expect(result.turningPoints[0]!.previousValue).toBe(50);
    expect(result.turningPoints[0]!.newValue).toBe(85);
    expect(result.turningPoints[0]!.delta).toBe(35);
    expect(result.turningPoints[0]!.turn).toBe(2 as TurnNumber);
  });

  it('generates a narrative string for detected turning points', () => {
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { anger: 55 }),
        makeTimelineEntry(2, { anger: 90 }),
      ],
    });

    expect(result.turningPoints[0]!.narrative).toContain('anger');
    expect(result.turningPoints[0]!.narrative).toContain('Turn 2');
  });

  it('allows threshold override via optional parameter', () => {
    // With default threshold=80, stress 65->70 wouldn't qualify.
    // With threshold=60, newValue=70 >= 60 is met, but delta=5 < 20.
    // So use a bigger jump: 40->70 delta=30 >= 20, newValue=70 >= 60.
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 40 }),
        makeTimelineEntry(2, { stress: 70 }),
      ],
      threshold: 60,
    });

    expect(result.turningPoints).toHaveLength(1);
    expect(result.turningPoints[0]!.newValue).toBe(70);
  });

  it('does not detect turning point when threshold override makes it stricter', () => {
    // stress 60->85, delta=25. Default threshold=80 would fire. Override to 90 => no fire.
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 60 }),
        makeTimelineEntry(2, { stress: 85 }),
      ],
      threshold: 90,
    });

    expect(result.turningPoints).toHaveLength(0);
  });

  it('detects turning points across multiple dimensions in the same turn pair', () => {
    // Both stress and anger cross threshold with sufficient delta
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 50, anger: 55 }),
        makeTimelineEntry(2, { stress: 85, anger: 90 }),
      ],
    });

    const dims = result.turningPoints.map((tp) => tp.dimension);
    expect(dims).toContain('stress');
    expect(dims).toContain('anger');
    expect(result.totalDetected).toBe(2);
  });

  it('detects turning points across multiple consecutive turn pairs', () => {
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 50 }),
        makeTimelineEntry(2, { stress: 85 }),
        makeTimelineEntry(3, { fear: 55 }),
        makeTimelineEntry(4, { fear: 90 }),
      ],
    });

    expect(result.turningPoints.length).toBeGreaterThanOrEqual(1);
    const stressTP = result.turningPoints.find((tp) => tp.dimension === 'stress');
    expect(stressTP).toBeDefined();
  });

  it('includes count in reason string when turning points are found', () => {
    const result = engine.detectPsychologicalTurningPoints({
      leaderId: LEADER_A,
      emotionalTimeline: [
        makeTimelineEntry(1, { stress: 50 }),
        makeTimelineEntry(2, { stress: 85 }),
      ],
    });

    expect(result.reason).toContain('1 psychological turning point(s)');
  });
});

// ---------------------------------------------------------------------------
// 5. computeDriftSummary
// ---------------------------------------------------------------------------

describe('computeDriftSummary', () => {
  it('returns empty summary when drift log has no events', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog([]),
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.totalEvents).toBe(0);
    expect(result.netDriftByDimension).toEqual({});
    expect(result.mostImpactfulEvent).toBeNull();
    expect(result.stressInoculationTurn).toBeNull();
  });

  it('processes a single drift event correctly', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [{ trigger: 'betrayal', turn: 5, dimension: 'paranoia', delta: 10 }],
        { currentDriftMagnitude: 10 },
      ),
    });

    expect(result.totalEvents).toBe(1);
    expect(result.netDriftByDimension).toEqual({ paranoia: 10 });
    expect(result.driftMagnitude).toBe(10);
    expect(result.mostImpactfulEvent).not.toBeNull();
    expect(result.mostImpactfulEvent!.trigger).toBe('betrayal');
    expect(result.mostImpactfulEvent!.turn).toBe(5 as TurnNumber);
  });

  it('aggregates net drift across multiple events in the same dimension', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [
          { trigger: 'war', turn: 1, dimension: 'paranoia', delta: 15 },
          { trigger: 'alliance', turn: 3, dimension: 'paranoia', delta: -5 },
          { trigger: 'betrayal', turn: 5, dimension: 'paranoia', delta: 10 },
        ],
        { currentDriftMagnitude: 20 },
      ),
    });

    expect(result.netDriftByDimension['paranoia']).toBe(20); // 15 - 5 + 10
  });

  it('aggregates drift across multiple dimensions', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [
          { trigger: 'war', turn: 1, dimension: 'paranoia', delta: 10 },
          { trigger: 'trade', turn: 2, dimension: 'pragmatism', delta: -8 },
        ],
        { currentDriftMagnitude: 18 },
      ),
    });

    expect(result.netDriftByDimension['paranoia']).toBe(10);
    expect(result.netDriftByDimension['pragmatism']).toBe(-8);
    expect(result.totalEvents).toBe(2);
  });

  it('identifies the most impactful event by absolute delta', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [
          { trigger: 'minor-slight', turn: 1, dimension: 'paranoia', delta: 3 },
          { trigger: 'nuclear-crisis', turn: 4, dimension: 'riskTolerance', delta: -25 },
          { trigger: 'trade-deal', turn: 6, dimension: 'pragmatism', delta: 10 },
        ],
        { currentDriftMagnitude: 38 },
      ),
    });

    expect(result.mostImpactfulEvent!.trigger).toBe('nuclear-crisis');
    expect(result.mostImpactfulEvent!.delta).toBe(-25);
  });

  it('reports stressInoculationTurn when present', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [{ trigger: 'crisis', turn: 3, dimension: 'paranoia', delta: 5 }],
        { currentDriftMagnitude: 5, stressInoculationTurn: 8 as TurnNumber },
      ),
    });

    expect(result.stressInoculationTurn).toBe(8 as TurnNumber);
  });

  it('reports null stressInoculationTurn when not present', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog([], { stressInoculationTurn: null }),
    });

    expect(result.stressInoculationTurn).toBeNull();
  });

  it('includes event count and magnitude in reason string', () => {
    const result = engine.computeDriftSummary({
      leaderId: LEADER_A,
      driftLog: makeDriftLog(
        [{ trigger: 'war', turn: 1, dimension: 'paranoia', delta: 10 }],
        { currentDriftMagnitude: 10 },
      ),
    });

    expect(result.reason).toContain('1 event(s)');
    expect(result.reason).toContain('drift magnitude: 10');
  });
});

// ---------------------------------------------------------------------------
// 6. generateJourneySummary
// ---------------------------------------------------------------------------

describe('generateJourneySummary', () => {
  function makeRadar(
    overrides: Partial<PersonalityRadarResult> = {},
  ): PersonalityRadarResult {
    return {
      leaderId: LEADER_A,
      dimensions: [],
      totalDriftMagnitude: 0,
      mostDriftedDimension: 'paranoia',
      reason: '',
      ...overrides,
    };
  }

  function makeGrudgeResult(
    overrides: Partial<GrudgeTimelineResult> = {},
  ): GrudgeTimelineResult {
    return {
      leaderId: LEADER_A,
      entries: [],
      totalGrudges: 0,
      unresolvedCount: 0,
      mostInfluentialGrudge: null,
      reason: '',
      ...overrides,
    };
  }

  function makeTurningPoint(
    turn: number,
    overrides: Partial<PsychologicalTurningPoint> = {},
  ): PsychologicalTurningPoint {
    return {
      turn: turn as TurnNumber,
      dimension: 'stress',
      previousValue: 50,
      newValue: 85,
      delta: 35,
      narrative: `Turn ${turn}: stress surged.`,
      ...overrides,
    };
  }

  it('generates a full summary with all data populated', () => {
    const timeline = [makeTimelineEntry(1), makeTimelineEntry(2), makeTimelineEntry(3)];
    const radar = makeRadar({ totalDriftMagnitude: 25, mostDriftedDimension: 'paranoia' });
    const grudgeTimeline = makeGrudgeResult({
      totalGrudges: 3,
      unresolvedCount: 1,
      mostInfluentialGrudge: {
        offender: LEADER_B,
        offenseType: 'betrayal',
        severity: 8,
        turnCreated: 2 as TurnNumber,
        resolved: false,
        influencedDecisionCount: 5,
      },
    });
    const turningPoints = [makeTurningPoint(2)];

    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: timeline,
      radar,
      grudgeTimeline,
      turningPoints,
    });

    expect(result.leaderId).toBe(LEADER_A);
    expect(result.totalTurns).toBe(3);
    expect(result.turningPointCount).toBe(1);
    expect(result.grudgeCount).toBe(3);
    expect(result.driftMagnitude).toBe(25);
    expect(result.mostDriftedDimension).toBe('paranoia');
    expect(result.narrativeSummary).toContain('3 turn(s)');
    expect(result.narrativeSummary).toContain('1 psychological turning point(s)');
    expect(result.narrativeSummary).toContain('3 grudge(s)');
    expect(result.narrativeSummary).toContain('paranoia');
  });

  it('describes zero grudges in narrative', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult(),
      turningPoints: [],
    });

    expect(result.grudgeCount).toBe(0);
    expect(result.narrativeSummary).toContain('no grudges');
  });

  it('describes no turning points in narrative', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult(),
      turningPoints: [],
    });

    expect(result.turningPointCount).toBe(0);
    expect(result.narrativeSummary).toContain('0 psychological turning point(s)');
  });

  it('describes zero drift as remarkably stable', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar({ totalDriftMagnitude: 0 }),
      grudgeTimeline: makeGrudgeResult(),
      turningPoints: [],
    });

    expect(result.driftMagnitude).toBe(0);
    expect(result.narrativeSummary).toContain('remarkably stable');
  });

  it('includes most influential grudge in narrative when present', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult({
        totalGrudges: 1,
        unresolvedCount: 1,
        mostInfluentialGrudge: {
          offender: LEADER_B,
          offenseType: 'sanctions',
          severity: 7,
          turnCreated: 3 as TurnNumber,
          resolved: false,
          influencedDecisionCount: 4,
        },
      }),
      turningPoints: [],
    });

    expect(result.narrativeSummary).toContain('sanctions');
    expect(result.narrativeSummary).toContain('4 decision(s)');
  });

  it('mentions first turning point details when turning points exist', () => {
    const tp = makeTurningPoint(5, { dimension: 'anger', delta: 30 });

    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1), makeTimelineEntry(5)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult(),
      turningPoints: [tp],
    });

    expect(result.narrativeSummary).toContain('turn 5');
    expect(result.narrativeSummary).toContain('anger');
  });

  it('handles all resolved grudges narrative', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult({
        totalGrudges: 2,
        unresolvedCount: 0,
      }),
      turningPoints: [],
    });

    expect(result.narrativeSummary).toContain('all of which were resolved');
  });

  it('handles partially unresolved grudges narrative', () => {
    const result = engine.generateJourneySummary({
      leaderId: LEADER_A,
      emotionalTimeline: [makeTimelineEntry(1)],
      radar: makeRadar(),
      grudgeTimeline: makeGrudgeResult({
        totalGrudges: 5,
        unresolvedCount: 3,
      }),
      turningPoints: [],
    });

    expect(result.narrativeSummary).toContain('3 of which remain unresolved');
  });
});
