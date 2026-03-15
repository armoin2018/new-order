import { describe, it, expect } from 'vitest';
import { ScenarioHistoryRecorder } from '@/engine/scenario-history-recorder';
import type {
  TurnMetricsSnapshot,
  GameAction,
  GameEvent,
  TurnRecord,
  ScenarioHistoryArchive,
} from '@/engine/scenario-history-recorder';
import type { ScenarioScore, DimensionScore } from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<TurnMetricsSnapshot> = {}): TurnMetricsSnapshot {
  return {
    factionId: 'us',
    stability: 70,
    gdp: 2000,
    treasury: 500,
    militaryReadiness: 80,
    diplomaticInfluence: 65,
    civilUnrest: 10,
    techLevel: 60,
    ...overrides,
  };
}

function makeAction(overrides: Partial<GameAction> = {}): GameAction {
  return {
    actionId: 'act-001',
    factionId: 'us',
    actionType: 'research',
    description: 'Started quantum research',
    ...overrides,
  };
}

function makeGameEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    eventId: 'evt-001',
    turn: 1,
    eventType: 'military-conflict',
    description: 'Border skirmish between US and China',
    affectedFactions: ['us', 'china'],
    severity: 0.5,
    ...overrides,
  };
}

function makeMarketData(): TurnRecord['marketData'] {
  return {
    tickerCount: 55,
    exchangeComposites: { nyse: 42100, sse: 3250 },
    indexValues: { 'global-defense': 105, 'global-energy': 98 },
    marketEvents: [],
  };
}

function makeScore(): ScenarioScore {
  const dims: DimensionScore[] = [
    { dimension: 'stability', rawScore: 70, letterGrade: 'B', weight: 0.15, weightedScore: 10.5, keyEvents: [] },
    { dimension: 'economic', rawScore: 65, letterGrade: 'B', weight: 0.20, weightedScore: 13, keyEvents: [] },
    { dimension: 'military', rawScore: 75, letterGrade: 'B', weight: 0.10, weightedScore: 7.5, keyEvents: [] },
    { dimension: 'diplomatic', rawScore: 60, letterGrade: 'C', weight: 0.15, weightedScore: 9, keyEvents: [] },
    { dimension: 'technology', rawScore: 55, letterGrade: 'C', weight: 0.15, weightedScore: 8.25, keyEvents: [] },
    { dimension: 'market', rawScore: 50, letterGrade: 'C', weight: 0.10, weightedScore: 5, keyEvents: [] },
    { dimension: 'strategic', rawScore: 68, letterGrade: 'B', weight: 0.15, weightedScore: 10.2, keyEvents: [] },
  ];
  return {
    totalScore: 634.5,
    dimensions: dims,
  };
}

function makeArchive(overrides: Partial<ScenarioHistoryArchive> = {}): ScenarioHistoryArchive {
  return {
    scenarioId: 'scenario-01',
    runId: 'run-20250101120000',
    playerFaction: 'us',
    turnsPlayed: 0,
    startedAt: '2025-01-01T12:00:00.000Z',
    turnHistory: [],
    metadata: {
      gameVersion: '1.0.0',
      scenarioName: 'Cold War Redux',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioHistoryRecorder', () => {
  const recorder = new ScenarioHistoryRecorder();

  // ── initializeArchive ────────────────────────────────────────────────

  describe('initializeArchive', () => {
    it('creates empty archive with metadata', () => {
      const archive = recorder.initializeArchive('scn-01', 'us', 'Cold War Redux', '1.0.0');
      expect(archive.scenarioId).toBe('scn-01');
      expect(archive.playerFaction).toBe('us');
      expect(archive.turnsPlayed).toBe(0);
      expect(archive.turnHistory).toHaveLength(0);
      expect(archive.metadata.scenarioName).toBe('Cold War Redux');
      expect(archive.metadata.gameVersion).toBe('1.0.0');
    });

    it('generates unique runId starting with run-', () => {
      const archive = recorder.initializeArchive('scn-01', 'us', 'Test', '1.0.0');
      expect(archive.runId).toMatch(/^run-/);
      expect(archive.runId.length).toBeGreaterThan(4);
    });

    it('sets startedAt timestamp', () => {
      const archive = recorder.initializeArchive('scn-01', 'us', 'Test', '1.0.0');
      expect(archive.startedAt).toBeDefined();
      // Should be a valid ISO string
      expect(() => new Date(archive.startedAt)).not.toThrow();
    });
  });

  // ── recordTurn ───────────────────────────────────────────────────────

  describe('recordTurn', () => {
    it('appends to history', () => {
      const archive = makeArchive();
      const updated = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [makeAction()], [makeGameEvent()], makeMarketData(),
      );
      expect(updated.turnHistory).toHaveLength(1);
      expect(updated.turnHistory[0].turn).toBe(1);
    });

    it('preserves existing history', () => {
      const archive = makeArchive();
      const after1 = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [], [], makeMarketData(),
      );
      const after2 = recorder.recordTurn(
        after1, 2, [makeSnapshot()], [], [], makeMarketData(),
      );
      const after3 = recorder.recordTurn(
        after2, 3, [makeSnapshot()], [], [], makeMarketData(),
      );
      expect(after3.turnHistory).toHaveLength(3);
      expect(after3.turnHistory[0].turn).toBe(1);
      expect(after3.turnHistory[2].turn).toBe(3);
    });

    it('sets turnsPlayed to current turn', () => {
      const archive = makeArchive();
      const updated = recorder.recordTurn(
        archive, 5, [makeSnapshot()], [], [], makeMarketData(),
      );
      expect(updated.turnsPlayed).toBe(5);
    });

    it('does not mutate original archive', () => {
      const archive = makeArchive();
      recorder.recordTurn(archive, 1, [makeSnapshot()], [], [], makeMarketData());
      expect(archive.turnHistory).toHaveLength(0);
      expect(archive.turnsPlayed).toBe(0);
    });
  });

  // ── finalizeArchive ──────────────────────────────────────────────────

  describe('finalizeArchive', () => {
    it('sets completedAt and scores', () => {
      const archive = makeArchive({ turnsPlayed: 60 });
      const scores = makeScore();
      const finalized = recorder.finalizeArchive(archive, scores, 'Diplomatic Victory');
      expect(finalized.completedAt).toBeDefined();
      expect(finalized.finalScores).toBe(scores);
      expect(finalized.victoryCondition).toBe('Diplomatic Victory');
    });

    it('does not mutate original archive', () => {
      const archive = makeArchive();
      recorder.finalizeArchive(archive, makeScore(), 'Win');
      expect(archive.completedAt).toBeUndefined();
      expect(archive.finalScores).toBeUndefined();
    });
  });

  // ── getTurnSnapshot ──────────────────────────────────────────────────

  describe('getTurnSnapshot', () => {
    it('returns correct turn', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(archive, 1, [makeSnapshot()], [], [], makeMarketData());
      archive = recorder.recordTurn(archive, 2, [makeSnapshot({ stability: 50 })], [], [], makeMarketData());
      archive = recorder.recordTurn(archive, 3, [makeSnapshot({ stability: 30 })], [], [], makeMarketData());

      const snap = recorder.getTurnSnapshot(archive, 2);
      expect(snap).toBeDefined();
      expect(snap!.turn).toBe(2);
      expect(snap!.nationSnapshots[0].stability).toBe(50);
    });

    it('returns undefined for missing turn', () => {
      const archive = makeArchive();
      const snap = recorder.getTurnSnapshot(archive, 99);
      expect(snap).toBeUndefined();
    });
  });

  // ── getEventTimeline ─────────────────────────────────────────────────

  describe('getEventTimeline', () => {
    it('flattens all events from all turns', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [],
        [makeGameEvent({ eventId: 'e1', turn: 1 }), makeGameEvent({ eventId: 'e2', turn: 1 })],
        makeMarketData(),
      );
      archive = recorder.recordTurn(
        archive, 2, [makeSnapshot()], [],
        [makeGameEvent({ eventId: 'e3', turn: 2 }), makeGameEvent({ eventId: 'e4', turn: 2 })],
        makeMarketData(),
      );

      const timeline = recorder.getEventTimeline(archive);
      expect(timeline).toHaveLength(4);
    });

    it('sorts events by turn', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(
        archive, 2, [makeSnapshot()], [],
        [makeGameEvent({ eventId: 'e2', turn: 2 })],
        makeMarketData(),
      );
      archive = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [],
        [makeGameEvent({ eventId: 'e1', turn: 1 })],
        makeMarketData(),
      );

      const timeline = recorder.getEventTimeline(archive);
      expect(timeline[0].turn).toBeLessThanOrEqual(timeline[1].turn);
    });
  });

  // ── getMarketTimeline ────────────────────────────────────────────────

  describe('getMarketTimeline', () => {
    it('extracts market data per turn', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(archive, 1, [makeSnapshot()], [], [], makeMarketData());
      archive = recorder.recordTurn(archive, 2, [makeSnapshot()], [], [], makeMarketData());

      const timeline = recorder.getMarketTimeline(archive);
      expect(timeline).toHaveLength(2);
      expect(timeline[0].turn).toBe(1);
      expect(timeline[0].exchangeComposites).toBeDefined();
    });
  });

  // ── exportJSON ───────────────────────────────────────────────────────

  describe('exportJSON', () => {
    it('returns valid JSON string', () => {
      const archive = makeArchive();
      const json = recorder.exportJSON(archive);
      const parsed = JSON.parse(json);
      expect(parsed.scenarioId).toBe('scenario-01');
    });
  });

  // ── exportCSV ────────────────────────────────────────────────────────

  describe('exportCSV', () => {
    it('includes header row', () => {
      const archive = makeArchive();
      const csv = recorder.exportCSV(archive);
      expect(csv).toMatch(/^turn,factionId,metric,value/);
    });

    it('includes nation metric rows', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [], [], makeMarketData(),
      );
      const csv = recorder.exportCSV(archive);
      expect(csv).toContain('stability');
      expect(csv).toContain('gdp');
      expect(csv).toContain('treasury');
    });

    it('includes market data rows', () => {
      let archive = makeArchive();
      archive = recorder.recordTurn(
        archive, 1, [makeSnapshot()], [], [], makeMarketData(),
      );
      const csv = recorder.exportCSV(archive);
      expect(csv).toContain('exchange_composite_nyse');
      expect(csv).toContain('index_global-defense');
    });
  });

  // ── exportHTML ───────────────────────────────────────────────────────

  describe('exportHTML', () => {
    it('contains scenario metadata', () => {
      const archive = makeArchive({
        metadata: { gameVersion: '1.0.0', scenarioName: 'Test Scenario' },
      });
      const html = recorder.exportHTML(archive);
      expect(html).toContain('Test Scenario');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('includes player faction', () => {
      const archive = makeArchive({ playerFaction: 'us' });
      const html = recorder.exportHTML(archive);
      expect(html).toContain('us');
    });
  });

  // ── generateExportManifest ───────────────────────────────────────────

  describe('generateExportManifest', () => {
    it('creates manifest with correct format', () => {
      const archive = makeArchive();
      const manifest = recorder.generateExportManifest(archive, 'json', 1024);
      expect(manifest.format).toBe('json');
      expect(manifest.fileSizeBytes).toBe(1024);
      expect(manifest.scenarioId).toBe('scenario-01');
      expect(manifest.includesHistory).toBe(true);
      expect(manifest.includesMarketData).toBe(true);
      expect(manifest.exportId).toMatch(/^export-json-/);
    });

    it('detects scores presence', () => {
      const archiveWithScores = makeArchive({ finalScores: makeScore() });
      const archiveWithout = makeArchive();

      const m1 = recorder.generateExportManifest(archiveWithScores, 'json', 500);
      const m2 = recorder.generateExportManifest(archiveWithout, 'json', 500);

      expect(m1.includesScores).toBe(true);
      expect(m2.includesScores).toBe(false);
    });
  });

  // ── compareScenarios ─────────────────────────────────────────────────

  describe('compareScenarios', () => {
    it('returns comparison data for both scenarios', () => {
      const archiveA = makeArchive({ scenarioId: 'scn-a' });
      const archiveB = makeArchive({ scenarioId: 'scn-b' });

      const result = recorder.compareScenarios(archiveA, archiveB);
      expect(result.scenarioA.scenarioId).toBe('scn-a');
      expect(result.scenarioB.scenarioId).toBe('scn-b');
    });
  });

  // ── findDivergencePoints ─────────────────────────────────────────────

  describe('findDivergencePoints', () => {
    it('detects divergence above threshold', () => {
      let archiveA = makeArchive({ scenarioId: 'scn-a', playerFaction: 'us' });
      archiveA = recorder.recordTurn(
        archiveA, 1,
        [makeSnapshot({ factionId: 'us', stability: 90, gdp: 2000 })],
        [], [], makeMarketData(),
      );

      let archiveB = makeArchive({ scenarioId: 'scn-b', playerFaction: 'us' });
      archiveB = recorder.recordTurn(
        archiveB, 1,
        [makeSnapshot({ factionId: 'us', stability: 30, gdp: 2000 })],
        [], [], makeMarketData(),
      );

      const divergences = recorder.findDivergencePoints(archiveA, archiveB, 0.2);
      // stability: |90-30|/90 = 0.667 > 0.2
      const stabilityDivs = divergences.filter((d) => d.metric === 'stability');
      expect(stabilityDivs.length).toBeGreaterThan(0);
    });

    it('returns empty for identical archives', () => {
      let archiveA = makeArchive({ playerFaction: 'us' });
      archiveA = recorder.recordTurn(
        archiveA, 1,
        [makeSnapshot({ factionId: 'us' })],
        [], [], makeMarketData(),
      );

      let archiveB = makeArchive({ playerFaction: 'us' });
      archiveB = recorder.recordTurn(
        archiveB, 1,
        [makeSnapshot({ factionId: 'us' })],
        [], [], makeMarketData(),
      );

      const divergences = recorder.findDivergencePoints(archiveA, archiveB, 0.2);
      expect(divergences).toHaveLength(0);
    });
  });
});
