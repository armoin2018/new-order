import { describe, it, expect, beforeEach } from 'vitest';
import { MarketReactionEngine } from '@/engine/market-reactions';
import { GAME_CONFIG } from '@/engine/config';

import type {
  MarketTriggerMatch,
  TriggerCooldownState,
} from '@/engine/market-reactions';
import type { Headline, TurnHeadlines } from '@/data/types';
import type { HeadlinePerspective, TurnNumber, EventId } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Build a single mock Headline for a given perspective. */
function makeMockHeadline(
  perspective: HeadlinePerspective,
  text: string,
  subtext?: string,
): Headline {
  return {
    perspective,
    text,
    subtext,
    relatedEventIds: ['evt-001' as EventId],
  };
}

/** Build a TurnHeadlines with defaults that can be selectively overridden. */
function makeMockTurnHeadlines(
  turn: number,
  texts?: {
    western?: string;
    state?: string;
    intel?: string;
    subtexts?: { western?: string; state?: string; intel?: string };
  },
): TurnHeadlines {
  return {
    turn: turn as TurnNumber,
    headlines: {
      ['WesternPress' as HeadlinePerspective]: makeMockHeadline(
        'WesternPress' as HeadlinePerspective,
        texts?.western ?? 'Western headline with no triggers',
        texts?.subtexts?.western,
      ),
      ['StatePropaganda' as HeadlinePerspective]: makeMockHeadline(
        'StatePropaganda' as HeadlinePerspective,
        texts?.state ?? 'State propaganda with no triggers',
        texts?.subtexts?.state,
      ),
      ['Intelligence' as HeadlinePerspective]: makeMockHeadline(
        'Intelligence' as HeadlinePerspective,
        texts?.intel ?? 'Intel briefing with no triggers',
        texts?.subtexts?.intel,
      ),
    } as Record<HeadlinePerspective, Headline>,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('MarketReactionEngine', () => {
  let engine: MarketReactionEngine;

  beforeEach(() => {
    engine = new MarketReactionEngine(GAME_CONFIG.marketReactions);
  });

  // ── scanHeadlines ────────────────────────────────────

  describe('scanHeadlines', () => {
    it('detects "Strait of Hormuz" keyword in WesternPress text', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Crisis at the Strait of Hormuz escalates',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.triggerKey).toBe('hormuz');
    });

    it('detects "Nuclear Threshold" keyword in StatePropaganda text', () => {
      const headlines = makeMockTurnHeadlines(1, {
        state: 'Nation crosses Nuclear Threshold amid tensions',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.triggerKey).toBe('nuclear');
    });

    it('detects "Rare Earth Ban" keyword in Intelligence text', () => {
      const headlines = makeMockTurnHeadlines(1, {
        intel: 'Classified: Rare Earth Ban imminent per satellite imagery',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.triggerKey).toBe('rareEarth');
    });

    it('detection is case-insensitive', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Tensions near the strait of hormuz continue',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.triggerKey).toBe('hormuz');
    });

    it('detects keyword in subtext when not in main text', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Oil prices surge dramatically',
        subtexts: { western: 'Linked to Strait of Hormuz closure' },
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.triggerKey).toBe('hormuz');
      expect(matches[0]!.matchedText).toBe(
        'Linked to Strait of Hormuz closure',
      );
    });

    it('returns empty array when no keywords present', () => {
      const headlines = makeMockTurnHeadlines(1);
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toEqual([]);
    });

    it('deduplicates: same keyword in multiple perspectives fires only once', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Strait of Hormuz blockade reported',
        state: 'Strait of Hormuz passage remains open says ministry',
        intel: 'Strait of Hormuz naval activity detected',
      });
      const matches = engine.scanHeadlines(headlines);

      const hormuzMatches = matches.filter((m) => m.triggerKey === 'hormuz');
      expect(hormuzMatches).toHaveLength(1);
    });

    it('multiple different keywords can match in same turn', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Strait of Hormuz under blockade',
        state: 'Nuclear Threshold breached by adversary',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(2);
      const keys = matches.map((m) => m.triggerKey);
      expect(keys).toContain('hormuz');
      expect(keys).toContain('nuclear');
    });

    it('all three triggers can match simultaneously', () => {
      const headlines = makeMockTurnHeadlines(1, {
        western: 'Strait of Hormuz blockade escalates',
        state: 'Nuclear Threshold warning issued',
        intel: 'Rare Earth Ban confirmed by sources',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(3);
      const keys = matches.map((m) => m.triggerKey);
      expect(keys).toContain('hormuz');
      expect(keys).toContain('nuclear');
      expect(keys).toContain('rareEarth');
    });

    it('match includes correct triggerKey, keyword, inflationDelta, matchedPerspective', () => {
      const headlines = makeMockTurnHeadlines(1, {
        state: 'Nuclear Threshold breached in latest report',
      });
      const matches = engine.scanHeadlines(headlines);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        triggerKey: 'nuclear',
        keyword: 'Nuclear Threshold',
        inflationDelta: 8,
        matchedPerspective: 'StatePropaganda',
      });
      expect(matches[0]!.matchedText).toContain('Nuclear Threshold');
    });
  });

  // ── applyMarketReactions ─────────────────────────────

  describe('applyMarketReactions', () => {
    it('single trigger adds correct inflation delta', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'hormuz',
          keyword: 'Strait of Hormuz',
          inflationDelta: 5,
          matchedPerspective: 'WesternPress' as HeadlinePerspective,
          matchedText: 'Crisis at the Strait of Hormuz',
        },
      ];
      const result = engine.applyMarketReactions(matches, 10);

      expect(result.totalInflationDelta).toBe(5);
      expect(result.cappedDelta).toBe(5);
      expect(result.newGlobalInflation).toBe(15);
    });

    it('multiple triggers sum their deltas', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'hormuz',
          keyword: 'Strait of Hormuz',
          inflationDelta: 5,
          matchedPerspective: 'WesternPress' as HeadlinePerspective,
          matchedText: 'Strait of Hormuz blocked',
        },
        {
          triggerKey: 'rareEarth',
          keyword: 'Rare Earth Ban',
          inflationDelta: 4,
          matchedPerspective: 'Intelligence' as HeadlinePerspective,
          matchedText: 'Rare Earth Ban enacted',
        },
      ];
      const result = engine.applyMarketReactions(matches, 20);

      expect(result.totalInflationDelta).toBe(9);
      expect(result.cappedDelta).toBe(9);
      expect(result.newGlobalInflation).toBe(29);
    });

    it('total delta capped at maxInflationDeltaPerTurn (15)', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'hormuz',
          keyword: 'Strait of Hormuz',
          inflationDelta: 5,
          matchedPerspective: 'WesternPress' as HeadlinePerspective,
          matchedText: 'Strait of Hormuz',
        },
        {
          triggerKey: 'nuclear',
          keyword: 'Nuclear Threshold',
          inflationDelta: 8,
          matchedPerspective: 'StatePropaganda' as HeadlinePerspective,
          matchedText: 'Nuclear Threshold',
        },
        {
          triggerKey: 'rareEarth',
          keyword: 'Rare Earth Ban',
          inflationDelta: 4,
          matchedPerspective: 'Intelligence' as HeadlinePerspective,
          matchedText: 'Rare Earth Ban',
        },
      ];
      // 5 + 8 + 4 = 17, should be capped to 15
      const result = engine.applyMarketReactions(matches, 10);

      expect(result.totalInflationDelta).toBe(17);
      expect(result.cappedDelta).toBe(15);
    });

    it('new global inflation = current + capped delta', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'nuclear',
          keyword: 'Nuclear Threshold',
          inflationDelta: 8,
          matchedPerspective: 'StatePropaganda' as HeadlinePerspective,
          matchedText: 'Nuclear Threshold',
        },
      ];
      const result = engine.applyMarketReactions(matches, 30);

      expect(result.newGlobalInflation).toBe(38);
    });

    it('global inflation clamped at 100 maximum', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'nuclear',
          keyword: 'Nuclear Threshold',
          inflationDelta: 8,
          matchedPerspective: 'StatePropaganda' as HeadlinePerspective,
          matchedText: 'Nuclear Threshold',
        },
      ];
      const result = engine.applyMarketReactions(matches, 96);

      expect(result.newGlobalInflation).toBe(100);
    });

    it('global inflation stays at 0 minimum (no negative)', () => {
      const matches: MarketTriggerMatch[] = [];
      const result = engine.applyMarketReactions(matches, -5);

      expect(result.newGlobalInflation).toBe(0);
    });

    it('empty matches array returns unchanged inflation', () => {
      const result = engine.applyMarketReactions([], 42);

      expect(result.totalInflationDelta).toBe(0);
      expect(result.cappedDelta).toBe(0);
      expect(result.newGlobalInflation).toBe(42);
      expect(result.triggersApplied).toEqual([]);
    });

    it('all three triggers fire: 5+8+4=17, capped to 15', () => {
      const matches: MarketTriggerMatch[] = [
        {
          triggerKey: 'hormuz',
          keyword: 'Strait of Hormuz',
          inflationDelta: 5,
          matchedPerspective: 'WesternPress' as HeadlinePerspective,
          matchedText: 'Strait of Hormuz',
        },
        {
          triggerKey: 'nuclear',
          keyword: 'Nuclear Threshold',
          inflationDelta: 8,
          matchedPerspective: 'StatePropaganda' as HeadlinePerspective,
          matchedText: 'Nuclear Threshold',
        },
        {
          triggerKey: 'rareEarth',
          keyword: 'Rare Earth Ban',
          inflationDelta: 4,
          matchedPerspective: 'Intelligence' as HeadlinePerspective,
          matchedText: 'Rare Earth Ban',
        },
      ];
      const result = engine.applyMarketReactions(matches, 50);

      expect(result.totalInflationDelta).toBe(17);
      expect(result.cappedDelta).toBe(15);
      expect(result.newGlobalInflation).toBe(65);
      expect(result.triggersApplied).toHaveLength(3);
    });
  });

  // ── isOnCooldown ─────────────────────────────────────

  describe('isOnCooldown', () => {
    it('returns false when trigger not in cooldown state', () => {
      const cooldowns: TriggerCooldownState = {};
      const result = engine.isOnCooldown('hormuz', cooldowns, 5 as TurnNumber);

      expect(result).toBe(false);
    });

    it('returns true when trigger fired 1 turn ago (within cooldown of 2)', () => {
      const cooldowns: TriggerCooldownState = {
        hormuz: 4 as TurnNumber,
      };
      const result = engine.isOnCooldown('hormuz', cooldowns, 5 as TurnNumber);

      expect(result).toBe(true);
    });

    it('returns true when trigger fired on current turn (0 turns ago)', () => {
      const cooldowns: TriggerCooldownState = {
        nuclear: 5 as TurnNumber,
      };
      const result = engine.isOnCooldown(
        'nuclear',
        cooldowns,
        5 as TurnNumber,
      );

      expect(result).toBe(true);
    });

    it('returns false when trigger fired 3 turns ago (past cooldown of 2)', () => {
      const cooldowns: TriggerCooldownState = {
        hormuz: 2 as TurnNumber,
      };
      const result = engine.isOnCooldown('hormuz', cooldowns, 5 as TurnNumber);

      expect(result).toBe(false);
    });

    it('returns true when exactly at cooldown boundary (2 turns ago)', () => {
      const cooldowns: TriggerCooldownState = {
        rareEarth: 3 as TurnNumber,
      };
      // 5 - 3 = 2, which equals triggerCooldownTurns (2) → on cooldown
      const result = engine.isOnCooldown(
        'rareEarth',
        cooldowns,
        5 as TurnNumber,
      );

      expect(result).toBe(true);
    });
  });

  // ── updateCooldowns ──────────────────────────────────

  describe('updateCooldowns', () => {
    it('records fired triggers at current turn', () => {
      const cooldowns: TriggerCooldownState = {};
      const updated = engine.updateCooldowns(
        ['hormuz', 'nuclear'],
        5 as TurnNumber,
        cooldowns,
      );

      expect(updated['hormuz']).toBe(5);
      expect(updated['nuclear']).toBe(5);
    });

    it('prunes expired cooldowns beyond triggerCooldownTurns', () => {
      const cooldowns: TriggerCooldownState = {
        hormuz: 1 as TurnNumber, // 5 - 1 = 4 turns ago → expired
      };
      const updated = engine.updateCooldowns([], 5 as TurnNumber, cooldowns);

      expect(updated['hormuz']).toBeUndefined();
    });

    it('preserves non-expired cooldowns', () => {
      const cooldowns: TriggerCooldownState = {
        hormuz: 4 as TurnNumber, // 5 - 4 = 1 turn ago → still active
      };
      const updated = engine.updateCooldowns([], 5 as TurnNumber, cooldowns);

      expect(updated['hormuz']).toBe(4);
    });

    it('returns new object (pure function)', () => {
      const cooldowns: TriggerCooldownState = {
        hormuz: 4 as TurnNumber,
      };
      const updated = engine.updateCooldowns(
        ['nuclear'],
        5 as TurnNumber,
        cooldowns,
      );

      expect(updated).not.toBe(cooldowns);
      // Original should be untouched
      expect(cooldowns['nuclear']).toBeUndefined();
    });
  });

  // ── processTurn ──────────────────────────────────────

  describe('processTurn', () => {
    it('full pipeline: scan → filter → apply → update cooldowns', () => {
      const headlines = makeMockTurnHeadlines(3, {
        western: 'Strait of Hormuz blockade begins',
        state: 'Nuclear Threshold warning from high command',
      });
      const cooldowns: TriggerCooldownState = {};
      const turnResult = engine.processTurn(headlines, 10, cooldowns);

      expect(turnResult.scanMatches).toHaveLength(2);
      expect(turnResult.filteredMatches).toHaveLength(2);
      expect(turnResult.result.newGlobalInflation).toBe(23); // 10 + 5 + 8
      expect(turnResult.updatedCooldowns['hormuz']).toBe(3);
      expect(turnResult.updatedCooldowns['nuclear']).toBe(3);
    });

    it('triggers on cooldown are filtered out', () => {
      const headlines = makeMockTurnHeadlines(5, {
        western: 'Strait of Hormuz crisis continues',
        state: 'Nuclear Threshold imminent',
      });
      // hormuz fired on turn 4 → still on cooldown at turn 5
      const cooldowns: TriggerCooldownState = {
        hormuz: 4 as TurnNumber,
      };
      const turnResult = engine.processTurn(headlines, 10, cooldowns);

      expect(turnResult.scanMatches).toHaveLength(2);
      expect(turnResult.filteredMatches).toHaveLength(1);
      expect(turnResult.filteredMatches[0]!.triggerKey).toBe('nuclear');
      expect(turnResult.result.newGlobalInflation).toBe(18); // 10 + 8
    });

    it('new cooldowns reflect fired triggers', () => {
      const headlines = makeMockTurnHeadlines(7, {
        intel: 'Rare Earth Ban confirmed by analysts',
      });
      const cooldowns: TriggerCooldownState = {};
      const turnResult = engine.processTurn(headlines, 20, cooldowns);

      expect(turnResult.updatedCooldowns['rareEarth']).toBe(7);
    });

    it('no matches returns unchanged inflation', () => {
      const headlines = makeMockTurnHeadlines(4);
      const cooldowns: TriggerCooldownState = {};
      const turnResult = engine.processTurn(headlines, 25, cooldowns);

      expect(turnResult.scanMatches).toHaveLength(0);
      expect(turnResult.filteredMatches).toHaveLength(0);
      expect(turnResult.result.newGlobalInflation).toBe(25);
    });

    it('result contains both scanMatches and filteredMatches for debugging', () => {
      const headlines = makeMockTurnHeadlines(6, {
        western: 'Strait of Hormuz disrupted again',
        intel: 'Rare Earth Ban enforced',
      });
      // hormuz on cooldown, rareEarth is not
      const cooldowns: TriggerCooldownState = {
        hormuz: 5 as TurnNumber,
      };
      const turnResult = engine.processTurn(headlines, 30, cooldowns);

      // scanMatches should include both
      expect(turnResult.scanMatches).toHaveLength(2);
      // filteredMatches only the one not on cooldown
      expect(turnResult.filteredMatches).toHaveLength(1);
      expect(turnResult.filteredMatches[0]!.triggerKey).toBe('rareEarth');
      // Verify the result reflects only filtered matches
      expect(turnResult.result.triggersApplied).toHaveLength(1);
      expect(turnResult.result.newGlobalInflation).toBe(34); // 30 + 4
    });
  });
});
