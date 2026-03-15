import { describe, it, expect, beforeEach } from 'vitest';
import { EventLogger } from '@/engine/event-logger';
import type { CreateEventParams, EventFilter } from '@/engine/event-logger';
import { SeededRandom } from '@/engine/rng';
import type { EventLogEntry } from '@/data/types/core.types';
import type {
  EventCategory,
  FactionId,
  TurnNumber,
} from '@/data/types/enums';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Build a minimal valid CreateEventParams for testing. */
function makeParams(overrides: Partial<CreateEventParams> = {}): CreateEventParams {
  return {
    turn: (overrides.turn ?? 1) as TurnNumber,
    category: (overrides.category ?? 'Military') as EventCategory,
    sourceFaction: (overrides.sourceFaction === undefined ? 'us' : overrides.sourceFaction) as FactionId | null,
    targetFactions: overrides.targetFactions ?? (['china'] as FactionId[]),
    description: overrides.description ?? 'Test event',
    actionKey: overrides.actionKey ?? 'TEST_ACTION',
    payload: overrides.payload ?? {},
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('EventLogger', () => {
  let logger: EventLogger;

  beforeEach(() => {
    logger = new EventLogger();
  });

  // ── logEvent ─────────────────────────────────────────

  describe('logEvent', () => {
    it('creates entry with auto-generated id and timestamp', () => {
      const entry = logger.logEvent(makeParams());

      expect(entry.id).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.id.startsWith('evt-')).toBe(true);
      expect(entry.timestamp).toBeDefined();
      // ISO-8601 format check
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    it('appends to log (count increases)', () => {
      expect(logger.count).toBe(0);
      logger.logEvent(makeParams());
      expect(logger.count).toBe(1);
      logger.logEvent(makeParams());
      expect(logger.count).toBe(2);
    });

    it('preserves all provided fields in the entry', () => {
      const params = makeParams({
        turn: 5 as TurnNumber,
        category: 'Economic' as EventCategory,
        sourceFaction: 'russia' as FactionId,
        targetFactions: ['eu', 'us'] as FactionId[],
        description: 'Sanctions imposed',
        actionKey: 'IMPOSE_SANCTIONS',
        payload: { severity: 'high' },
      });
      const entry = logger.logEvent(params);

      expect(entry.turn).toBe(5);
      expect(entry.category).toBe('Economic');
      expect(entry.sourceFaction).toBe('russia');
      expect(entry.targetFactions).toEqual(['eu', 'us']);
      expect(entry.description).toBe('Sanctions imposed');
      expect(entry.actionKey).toBe('IMPOSE_SANCTIONS');
      expect(entry.payload).toEqual({ severity: 'high' });
    });
  });

  // ── logSystemEvent ───────────────────────────────────

  describe('logSystemEvent', () => {
    it('creates correct defaults for system events', () => {
      const entry = logger.logSystemEvent(
        3 as TurnNumber,
        'System event occurred',
        'SYSTEM_TICK',
      );

      expect(entry.sourceFaction).toBeNull();
      expect(entry.targetFactions).toEqual([]);
      expect(entry.category).toBe('Domestic');
      expect(entry.turn).toBe(3);
      expect(entry.description).toBe('System event occurred');
      expect(entry.actionKey).toBe('SYSTEM_TICK');
      expect(entry.payload).toEqual({});
    });

    it('accepts optional payload', () => {
      const entry = logger.logSystemEvent(
        1 as TurnNumber,
        'Weather event',
        'CLIMATE_SHIFT',
        { region: 'pacific' },
      );

      expect(entry.payload).toEqual({ region: 'pacific' });
    });
  });

  // ── getAll ───────────────────────────────────────────

  describe('getAll', () => {
    it('returns all entries', () => {
      logger.logEvent(makeParams({ actionKey: 'A' }));
      logger.logEvent(makeParams({ actionKey: 'B' }));
      logger.logEvent(makeParams({ actionKey: 'C' }));

      const all = logger.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.actionKey)).toEqual(['A', 'B', 'C']);
    });

    it('returns empty array when log is empty', () => {
      expect(logger.getAll()).toEqual([]);
    });
  });

  // ── getByTurn ────────────────────────────────────────

  describe('getByTurn', () => {
    it('filters correctly by turn number', () => {
      logger.logEvent(makeParams({ turn: 1 as TurnNumber, actionKey: 'T1A' }));
      logger.logEvent(makeParams({ turn: 2 as TurnNumber, actionKey: 'T2A' }));
      logger.logEvent(makeParams({ turn: 1 as TurnNumber, actionKey: 'T1B' }));

      const turn1 = logger.getByTurn(1 as TurnNumber);
      expect(turn1).toHaveLength(2);
      expect(turn1.map((e) => e.actionKey)).toEqual(['T1A', 'T1B']);

      const turn2 = logger.getByTurn(2 as TurnNumber);
      expect(turn2).toHaveLength(1);
      expect(turn2[0]!.actionKey).toBe('T2A');
    });

    it('returns empty array for non-existent turn', () => {
      logger.logEvent(makeParams({ turn: 1 as TurnNumber }));
      expect(logger.getByTurn(99 as TurnNumber)).toEqual([]);
    });
  });

  // ── getByFaction ─────────────────────────────────────

  describe('getByFaction', () => {
    it('matches source faction', () => {
      logger.logEvent(makeParams({
        sourceFaction: 'us' as FactionId,
        targetFactions: ['china'] as FactionId[],
      }));
      logger.logEvent(makeParams({
        sourceFaction: 'russia' as FactionId,
        targetFactions: ['china'] as FactionId[],
      }));

      const usEvents = logger.getByFaction('us' as FactionId);
      expect(usEvents).toHaveLength(1);
      expect(usEvents[0]!.sourceFaction).toBe('us');
    });

    it('matches target factions', () => {
      logger.logEvent(makeParams({
        sourceFaction: 'us' as FactionId,
        targetFactions: ['china', 'russia'] as FactionId[],
      }));

      const russiaEvents = logger.getByFaction('russia' as FactionId);
      expect(russiaEvents).toHaveLength(1);

      const chinaEvents = logger.getByFaction('china' as FactionId);
      expect(chinaEvents).toHaveLength(1);
    });

    it('does not duplicate when faction is both source and target', () => {
      logger.logEvent(makeParams({
        sourceFaction: 'us' as FactionId,
        targetFactions: ['us'] as FactionId[],
      }));

      const usEvents = logger.getByFaction('us' as FactionId);
      expect(usEvents).toHaveLength(1);
    });
  });

  // ── getByCategory ────────────────────────────────────

  describe('getByCategory', () => {
    it('filters correctly by category', () => {
      logger.logEvent(makeParams({ category: 'Military' as EventCategory }));
      logger.logEvent(makeParams({ category: 'Economic' as EventCategory }));
      logger.logEvent(makeParams({ category: 'Military' as EventCategory }));

      const military = logger.getByCategory('Military' as EventCategory);
      expect(military).toHaveLength(2);

      const economic = logger.getByCategory('Economic' as EventCategory);
      expect(economic).toHaveLength(1);
    });
  });

  // ── getByActionKey ───────────────────────────────────

  describe('getByActionKey', () => {
    it('filters correctly by action key', () => {
      logger.logEvent(makeParams({ actionKey: 'LAUNCH_STRIKE' }));
      logger.logEvent(makeParams({ actionKey: 'IMPOSE_SANCTIONS' }));
      logger.logEvent(makeParams({ actionKey: 'LAUNCH_STRIKE' }));

      const strikes = logger.getByActionKey('LAUNCH_STRIKE');
      expect(strikes).toHaveLength(2);

      const sanctions = logger.getByActionKey('IMPOSE_SANCTIONS');
      expect(sanctions).toHaveLength(1);
    });
  });

  // ── query (compound filter) ──────────────────────────

  describe('query', () => {
    it('filters with compound filter (turn + category)', () => {
      logger.logEvent(makeParams({
        turn: 1 as TurnNumber,
        category: 'Military' as EventCategory,
      }));
      logger.logEvent(makeParams({
        turn: 1 as TurnNumber,
        category: 'Economic' as EventCategory,
      }));
      logger.logEvent(makeParams({
        turn: 2 as TurnNumber,
        category: 'Military' as EventCategory,
      }));

      const filter: EventFilter = {
        turn: 1 as TurnNumber,
        category: 'Military' as EventCategory,
      };
      const results = logger.query(filter);
      expect(results).toHaveLength(1);
      expect(results[0]!.turn).toBe(1);
      expect(results[0]!.category).toBe('Military');
    });

    it('filters with turnRange', () => {
      logger.logEvent(makeParams({ turn: 1 as TurnNumber }));
      logger.logEvent(makeParams({ turn: 3 as TurnNumber }));
      logger.logEvent(makeParams({ turn: 5 as TurnNumber }));
      logger.logEvent(makeParams({ turn: 7 as TurnNumber }));

      const results = logger.query({
        turnRange: { min: 2 as TurnNumber, max: 5 as TurnNumber },
      });
      expect(results).toHaveLength(2);
      expect(results.map((e) => e.turn)).toEqual([3, 5]);
    });

    it('filters with factionId in compound query', () => {
      logger.logEvent(makeParams({
        turn: 1 as TurnNumber,
        sourceFaction: 'us' as FactionId,
        targetFactions: [] as FactionId[],
      }));
      logger.logEvent(makeParams({
        turn: 1 as TurnNumber,
        sourceFaction: 'china' as FactionId,
        targetFactions: ['us'] as FactionId[],
      }));
      logger.logEvent(makeParams({
        turn: 2 as TurnNumber,
        sourceFaction: 'us' as FactionId,
        targetFactions: [] as FactionId[],
      }));

      const results = logger.query({
        turn: 1 as TurnNumber,
        factionId: 'us' as FactionId,
      });
      // Both turn-1 events involve 'us': first as source, second as target
      expect(results).toHaveLength(2);
    });

    it('returns all entries when filter is empty', () => {
      logger.logEvent(makeParams());
      logger.logEvent(makeParams());
      expect(logger.query({})).toHaveLength(2);
    });
  });

  // ── getSnapshot ──────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns copy (mutations do not affect logger)', () => {
      logger.logEvent(makeParams({ actionKey: 'ORIGINAL' }));
      const snapshot = logger.getSnapshot();

      // Mutate the snapshot
      snapshot.push({
        id: 'evt-fake' as EventLogEntry['id'],
        turn: 99 as TurnNumber,
        category: 'Nuclear' as EventCategory,
        sourceFaction: null,
        targetFactions: [],
        description: 'Fake',
        actionKey: 'FAKE',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      // Logger should be unaffected
      expect(logger.count).toBe(1);
      expect(logger.getAll()[0]!.actionKey).toBe('ORIGINAL');
    });

    it('returns deep copies of entries', () => {
      logger.logEvent(makeParams({ payload: { nested: 'value' } }));
      const snapshot = logger.getSnapshot();

      // Mutate a field on the snapshot entry
      (snapshot[0] as unknown as Record<string, unknown>)['description'] = 'TAMPERED';

      // Logger's original should be unaffected
      expect(logger.getAll()[0]!.description).toBe('Test event');
    });
  });

  // ── restore ──────────────────────────────────────────

  describe('restore', () => {
    it('replaces internal log', () => {
      logger.logEvent(makeParams({ actionKey: 'OLD' }));
      expect(logger.count).toBe(1);

      const imported: EventLogEntry[] = [
        {
          id: 'evt-aaa' as EventLogEntry['id'],
          turn: 10 as TurnNumber,
          category: 'Diplomatic' as EventCategory,
          sourceFaction: 'eu' as FactionId,
          targetFactions: ['us'] as FactionId[],
          description: 'Imported event A',
          actionKey: 'IMPORTED_A',
          payload: {},
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'evt-bbb' as EventLogEntry['id'],
          turn: 11 as TurnNumber,
          category: 'Military' as EventCategory,
          sourceFaction: null,
          targetFactions: [],
          description: 'Imported event B',
          actionKey: 'IMPORTED_B',
          payload: {},
          timestamp: '2026-01-02T00:00:00.000Z',
        },
      ];

      logger.restore(imported);
      expect(logger.count).toBe(2);
      expect(logger.getAll()[0]!.actionKey).toBe('IMPORTED_A');
      expect(logger.getAll()[1]!.actionKey).toBe('IMPORTED_B');
    });

    it('creates deep copies of restored entries', () => {
      const imported: EventLogEntry[] = [
        {
          id: 'evt-ccc' as EventLogEntry['id'],
          turn: 1 as TurnNumber,
          category: 'Domestic' as EventCategory,
          sourceFaction: null,
          targetFactions: [],
          description: 'Restorable',
          actionKey: 'RESTORE_TEST',
          payload: {},
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];

      logger.restore(imported);

      // Mutate the original input
      imported[0]!.description = 'TAMPERED';

      // Logger should be unaffected
      expect(logger.getAll()[0]!.description).toBe('Restorable');
    });
  });

  // ── clear ────────────────────────────────────────────

  describe('clear', () => {
    it('empties the log', () => {
      logger.logEvent(makeParams());
      logger.logEvent(makeParams());
      expect(logger.count).toBe(2);

      logger.clear();
      expect(logger.count).toBe(0);
      expect(logger.getAll()).toEqual([]);
    });
  });

  // ── Deterministic IDs with SeededRandom ──────────────

  describe('deterministic IDs', () => {
    it('produces same IDs when constructed with same seed', () => {
      const logger1 = new EventLogger(new SeededRandom(42));
      const logger2 = new EventLogger(new SeededRandom(42));

      const id1a = logger1.logEvent(makeParams()).id;
      const id1b = logger1.logEvent(makeParams()).id;

      const id2a = logger2.logEvent(makeParams()).id;
      const id2b = logger2.logEvent(makeParams()).id;

      expect(id1a).toBe(id2a);
      expect(id1b).toBe(id2b);
    });

    it('produces IDs in expected hex format with RNG', () => {
      const rngLogger = new EventLogger(new SeededRandom(99));
      const entry = rngLogger.logEvent(makeParams());

      // Format: evt-XXXXXX where X is a hex digit
      expect(entry.id).toMatch(/^evt-[0-9a-f]{6}$/);
    });

    it('produces different IDs with different seeds', () => {
      const logger1 = new EventLogger(new SeededRandom(1));
      const logger2 = new EventLogger(new SeededRandom(2));

      const id1 = logger1.logEvent(makeParams()).id;
      const id2 = logger2.logEvent(makeParams()).id;

      expect(id1).not.toBe(id2);
    });
  });

  // ── count getter ─────────────────────────────────────

  describe('count', () => {
    it('reflects current number of entries', () => {
      expect(logger.count).toBe(0);
      logger.logEvent(makeParams());
      expect(logger.count).toBe(1);
      logger.logEvent(makeParams());
      logger.logEvent(makeParams());
      expect(logger.count).toBe(3);
      logger.clear();
      expect(logger.count).toBe(0);
    });
  });
});
