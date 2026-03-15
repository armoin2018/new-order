import { describe, it, expect, beforeEach } from 'vitest';
import { HeadlineGenerator } from '@/engine/headline-generator';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';
import type { EventLogEntry, TurnHeadlines, HeadlineArchive } from '@/data/types/core.types';
import type {
  EventCategory,
  EventId,
  FactionId,
  HeadlinePerspective,
  TurnNumber,
} from '@/data/types/enums';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Build a minimal valid EventLogEntry for testing. */
function makeMockEvent(overrides: Partial<EventLogEntry> = {}): EventLogEntry {
  return {
    id: (overrides.id ?? 'evt-test-001') as EventId,
    turn: (overrides.turn ?? 1) as TurnNumber,
    category: (overrides.category ?? 'Military') as EventCategory,
    sourceFaction: (overrides.sourceFaction === undefined
      ? 'us'
      : overrides.sourceFaction) as FactionId | null,
    targetFactions: overrides.targetFactions ?? (['china'] as FactionId[]),
    description: overrides.description ?? 'Test event occurred',
    actionKey: overrides.actionKey ?? 'TEST_ACTION',
    payload: overrides.payload ?? {},
    timestamp: overrides.timestamp ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('HeadlineGenerator', () => {
  let generator: HeadlineGenerator;
  let rng: SeededRandom;

  beforeEach(() => {
    rng = new SeededRandom(12345);
    generator = new HeadlineGenerator(GAME_CONFIG.headlines, rng);
  });

  // ── generateTurnHeadlines ────────────────────────────

  describe('generateTurnHeadlines', () => {
    it('returns TurnHeadlines with correct turn number', () => {
      const turn = 5 as TurnNumber;
      const events = [makeMockEvent({ turn })];
      const result = generator.generateTurnHeadlines(turn, events);

      expect(result.turn).toBe(5);
    });

    it('produces exactly 3 headlines (one per perspective)', () => {
      const events = [makeMockEvent()];
      const result = generator.generateTurnHeadlines(1 as TurnNumber, events);
      const perspectives = Object.keys(result.headlines);

      expect(perspectives).toHaveLength(3);
      expect(perspectives).toContain('WesternPress');
      expect(perspectives).toContain('StatePropaganda');
      expect(perspectives).toContain('Intelligence');
    });

    it('generates WesternPress headline for diplomatic event', () => {
      const events = [makeMockEvent({ category: 'Diplomatic' as EventCategory })];
      const result = generator.generateTurnHeadlines(1 as TurnNumber, events);
      const wp = result.headlines['WesternPress' as HeadlinePerspective];

      expect(wp).toBeDefined();
      expect(wp.perspective).toBe('WesternPress');
      expect(wp.text.length).toBeGreaterThan(0);
    });

    it('generates StatePropaganda headline for domestic event', () => {
      const events = [makeMockEvent({ category: 'Domestic' as EventCategory })];
      const result = generator.generateTurnHeadlines(1 as TurnNumber, events);
      const sp = result.headlines['StatePropaganda' as HeadlinePerspective];

      expect(sp).toBeDefined();
      expect(sp.perspective).toBe('StatePropaganda');
      expect(sp.text.length).toBeGreaterThan(0);
    });

    it('generates Intelligence headline for intelligence event', () => {
      const events = [makeMockEvent({ category: 'Intelligence' as EventCategory })];
      const result = generator.generateTurnHeadlines(1 as TurnNumber, events);
      const intel = result.headlines['Intelligence' as HeadlinePerspective];

      expect(intel).toBeDefined();
      expect(intel.perspective).toBe('Intelligence');
      expect(intel.text.length).toBeGreaterThan(0);
    });

    it('when events array is empty, returns quiet-turn placeholders', () => {
      const result = generator.generateTurnHeadlines(1 as TurnNumber, []);
      const wp = result.headlines['WesternPress' as HeadlinePerspective];
      const sp = result.headlines['StatePropaganda' as HeadlinePerspective];
      const intel = result.headlines['Intelligence' as HeadlinePerspective];

      expect(wp.text).toMatch(/No Significant Developments/i);
      expect(sp.text).toMatch(/Peace and Stability/i);
      expect(intel.text).toMatch(/SITREP/i);
      expect(wp.relatedEventIds).toHaveLength(0);
      expect(sp.relatedEventIds).toHaveLength(0);
      expect(intel.relatedEventIds).toHaveLength(0);
    });

    it('with single event, all perspectives frame the same event', () => {
      const event = makeMockEvent({ id: 'evt-single' as EventId });
      const result = generator.generateTurnHeadlines(1 as TurnNumber, [event]);

      const wp = result.headlines['WesternPress' as HeadlinePerspective];
      const sp = result.headlines['StatePropaganda' as HeadlinePerspective];
      const intel = result.headlines['Intelligence' as HeadlinePerspective];

      expect(wp.relatedEventIds).toContain('evt-single');
      expect(sp.relatedEventIds).toContain('evt-single');
      expect(intel.relatedEventIds).toContain('evt-single');
    });

    it('multiple events — each perspective may pick different top event', () => {
      const diplomatic = makeMockEvent({
        id: 'evt-diplo' as EventId,
        category: 'Diplomatic' as EventCategory,
        description: 'Summit negotiations begin',
      });
      const domestic = makeMockEvent({
        id: 'evt-domestic' as EventId,
        category: 'Domestic' as EventCategory,
        description: 'Protests erupt in capital',
      });
      const intelligence = makeMockEvent({
        id: 'evt-intel' as EventId,
        category: 'Intelligence' as EventCategory,
        description: 'Covert signals intercepted',
      });

      const result = generator.generateTurnHeadlines(
        1 as TurnNumber,
        [diplomatic, domestic, intelligence],
      );

      // WesternPress should prefer diplomatic (weight 0.35)
      const wp = result.headlines['WesternPress' as HeadlinePerspective];
      expect(wp.relatedEventIds).toContain('evt-diplo');

      // Intelligence should prefer intelligence (weight 0.35)
      const intel = result.headlines['Intelligence' as HeadlinePerspective];
      expect(intel.relatedEventIds).toContain('evt-intel');
    });

    it('headlines contain relatedEventIds linking to source events', () => {
      const event = makeMockEvent({ id: 'evt-linked' as EventId });
      const result = generator.generateTurnHeadlines(1 as TurnNumber, [event]);

      for (const perspective of ['WesternPress', 'StatePropaganda', 'Intelligence'] as HeadlinePerspective[]) {
        const headline = result.headlines[perspective];
        expect(headline.relatedEventIds).toContain('evt-linked');
      }
    });
  });

  // ── scoreEventForPerspective ─────────────────────────

  describe('scoreEventForPerspective', () => {
    it('Diplomatic event scores highest for WesternPress (weight 0.35)', () => {
      const event = makeMockEvent({ category: 'Diplomatic' as EventCategory });

      // Reset RNG for each call to get comparable results
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);

      const wpScore = gen1.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);
      const spScore = gen2.scoreEventForPerspective(event, 'StatePropaganda' as HeadlinePerspective);

      expect(wpScore).toBeGreaterThan(spScore);
    });

    it('Military event scores high for StatePropaganda (weight 0.30)', () => {
      const event = makeMockEvent({ category: 'Military' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);

      const spScore = gen1.scoreEventForPerspective(event, 'StatePropaganda' as HeadlinePerspective);
      const wpScore = gen2.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);

      // StatePropaganda: 0.30 * 1.4 = 0.42; WesternPress: 0.25 * 1.2 = 0.30
      expect(spScore).toBeGreaterThan(wpScore);
    });

    it('Intelligence event scores highest for Intelligence perspective (weight 0.35)', () => {
      const event = makeMockEvent({ category: 'Intelligence' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);

      const intelScore = gen1.scoreEventForPerspective(event, 'Intelligence' as HeadlinePerspective);
      const wpScore = gen2.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);

      // Intelligence: 0.35 * 0.8 = 0.28; WesternPress: 0.05 * 1.2 = 0.06
      expect(intelScore).toBeGreaterThan(wpScore);
    });

    it('Domestic event scores highest for StatePropaganda (weight 0.40)', () => {
      const event = makeMockEvent({ category: 'Domestic' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const rng3 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);
      const gen3 = new HeadlineGenerator(GAME_CONFIG.headlines, rng3);

      const spScore = gen1.scoreEventForPerspective(event, 'StatePropaganda' as HeadlinePerspective);
      const wpScore = gen2.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);
      const intelScore = gen3.scoreEventForPerspective(event, 'Intelligence' as HeadlinePerspective);

      expect(spScore).toBeGreaterThan(wpScore);
      expect(spScore).toBeGreaterThan(intelScore);
    });

    it('Economic event scores high for WesternPress (weight 0.30)', () => {
      const event = makeMockEvent({ category: 'Economic' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);

      const wpScore = gen1.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);
      const spScore = gen2.scoreEventForPerspective(event, 'StatePropaganda' as HeadlinePerspective);

      // WesternPress: 0.30 * 1.2 = 0.36; StatePropaganda: 0.10 * 1.4 = 0.14
      expect(wpScore).toBeGreaterThan(spScore);
    });

    it('score includes drama multiplier (WesternPress: 1.2)', () => {
      const event = makeMockEvent({ category: 'Diplomatic' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const score = gen1.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);

      // Base weight 0.35 * drama 1.2 = 0.42 ± variance
      expect(score).toBeGreaterThan(0.35);
    });

    it('score is deterministic with same RNG seed', () => {
      const event = makeMockEvent({ category: 'Military' as EventCategory });

      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      const gen1 = new HeadlineGenerator(GAME_CONFIG.headlines, rng1);
      const gen2 = new HeadlineGenerator(GAME_CONFIG.headlines, rng2);

      const score1 = gen1.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);
      const score2 = gen2.scoreEventForPerspective(event, 'WesternPress' as HeadlinePerspective);

      expect(score1).toBeCloseTo(score2, 10);
    });

    it('score is always a positive number for known categories', () => {
      const categories: EventCategory[] = [
        'Diplomatic', 'Military', 'Economic', 'Intelligence',
        'Domestic', 'Nuclear', 'Information', 'Climate',
        'Technology', 'Proxy',
      ] as EventCategory[];

      const perspectives: HeadlinePerspective[] = [
        'WesternPress', 'StatePropaganda', 'Intelligence',
      ] as HeadlinePerspective[];

      for (const cat of categories) {
        for (const persp of perspectives) {
          const freshRng = new SeededRandom(12345);
          const gen = new HeadlineGenerator(GAME_CONFIG.headlines, freshRng);
          const event = makeMockEvent({ category: cat });
          const score = gen.scoreEventForPerspective(event, persp);

          expect(score).toBeGreaterThan(0);
        }
      }
    });
  });

  // ── frameHeadline ────────────────────────────────────

  describe('frameHeadline', () => {
    it('WesternPress headline text starts with known Western prefix', () => {
      const event = makeMockEvent();
      const headline = generator.frameHeadline(event, 'WesternPress' as HeadlinePerspective);

      const westernPrefixes = [
        'International Community Alarmed as',
        'World Leaders Condemn',
        'Breaking: Western Allies Respond to',
        'Democracy Under Threat:',
        'Human Rights Groups Decry',
        'Global Markets Reel After',
        'NATO Allies Reassess Following',
        'UN Security Council Debates',
      ];
      const startsWithKnown = westernPrefixes.some((p) => headline.text.startsWith(p));
      expect(startsWithKnown).toBe(true);
    });

    it('StatePropaganda headline includes known State prefix', () => {
      const event = makeMockEvent();
      const headline = generator.frameHeadline(event, 'StatePropaganda' as HeadlinePerspective);

      const statePrefixes = [
        'Glorious Defense Forces Prevail:',
        'Motherland Triumphs as',
        'Supreme Leadership Ensures',
        "People's Victory:",
        'National Sovereignty Defended Against',
        'Heroic Armed Forces Achieve',
        'Patriotic Citizens Rally Behind',
        'Enemies of the State Defeated:',
      ];
      const startsWithKnown = statePrefixes.some((p) => headline.text.startsWith(p));
      expect(startsWithKnown).toBe(true);
    });

    it('Intelligence headline includes known Intelligence prefix', () => {
      const event = makeMockEvent();
      const headline = generator.frameHeadline(event, 'Intelligence' as HeadlinePerspective);

      const intelPattern = /SIGINT|CLASSIFIED|INTEL|HUMINT|GEOINT|THREAT|SITUATION|ELINT/;
      expect(headline.text).toMatch(intelPattern);
    });

    it('headline includes event description in text', () => {
      const event = makeMockEvent({ description: 'Major trade deal signed' });
      const headline = generator.frameHeadline(event, 'WesternPress' as HeadlinePerspective);

      expect(headline.text).toContain('Major trade deal signed');
    });

    it('headline includes subtext', () => {
      const event = makeMockEvent();
      const headline = generator.frameHeadline(event, 'WesternPress' as HeadlinePerspective);

      expect(headline.subtext).toBeDefined();
      expect(typeof headline.subtext).toBe('string');
      expect(headline.subtext!.length).toBeGreaterThan(0);
    });

    it('headline relatedEventIds contains the source event id', () => {
      const event = makeMockEvent({ id: 'evt-frame-001' as EventId });
      const headline = generator.frameHeadline(event, 'Intelligence' as HeadlinePerspective);

      expect(headline.relatedEventIds).toContain('evt-frame-001');
    });

    it('headline perspective matches the requested perspective', () => {
      const event = makeMockEvent();

      for (const perspective of ['WesternPress', 'StatePropaganda', 'Intelligence'] as HeadlinePerspective[]) {
        // fresh generator to avoid RNG drift
        const freshRng = new SeededRandom(12345);
        const gen = new HeadlineGenerator(GAME_CONFIG.headlines, freshRng);
        const headline = gen.frameHeadline(event, perspective);

        expect(headline.perspective).toBe(perspective);
      }
    });
  });

  // ── appendToArchive ──────────────────────────────────

  describe('appendToArchive', () => {
    function makeTurnHeadlines(turn: number): TurnHeadlines {
      const events = [makeMockEvent({ turn: turn as TurnNumber })];
      const freshRng = new SeededRandom(12345);
      const gen = new HeadlineGenerator(GAME_CONFIG.headlines, freshRng);
      return gen.generateTurnHeadlines(turn as TurnNumber, events);
    }

    it('appends to empty archive', () => {
      const archive: HeadlineArchive = [];
      const turnHeadlines = makeTurnHeadlines(1);
      const result = generator.appendToArchive(archive, turnHeadlines);

      expect(result).toHaveLength(1);
      expect(result[0]!.turn).toBe(1);
    });

    it('appends to existing archive preserving previous entries', () => {
      const archive: HeadlineArchive = [makeTurnHeadlines(1)];
      const turnHeadlines = makeTurnHeadlines(2);
      const result = generator.appendToArchive(archive, turnHeadlines);

      expect(result).toHaveLength(2);
      expect(result[0]!.turn).toBe(1);
      expect(result[1]!.turn).toBe(2);
    });

    it('returns new array (immutable — original unchanged)', () => {
      const archive: HeadlineArchive = [makeTurnHeadlines(1)];
      const turnHeadlines = makeTurnHeadlines(2);
      const result = generator.appendToArchive(archive, turnHeadlines);

      expect(result).not.toBe(archive);
      expect(archive).toHaveLength(1);
      expect(result).toHaveLength(2);
    });

    it('multiple appends build sequential archive', () => {
      let archive: HeadlineArchive = [];

      for (let t = 1; t <= 5; t++) {
        const turnHeadlines = makeTurnHeadlines(t);
        archive = generator.appendToArchive(archive, turnHeadlines);
      }

      expect(archive).toHaveLength(5);
      archive.forEach((entry, idx) => {
        expect(entry.turn).toBe(idx + 1);
      });
    });
  });
});
