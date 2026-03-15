/**
 * New Order: Market Reaction Engine
 *
 * Scans turn headlines for trigger keywords (e.g. "Strait of Hormuz",
 * "Nuclear Threshold", "Rare Earth Ban") and applies GlobalInflation
 * penalties to all players when matches are found.
 *
 * Keyword detection is case-insensitive and fires at most once per
 * trigger per turn. A configurable cooldown prevents the same trigger
 * from firing on consecutive turns.
 *
 * @module engine/market-reactions
 * @see CNFL-0602 — Market reaction triggers from headlines
 * @see FR-203  — Market Reaction Events
 */

import type {
  Headline,
  TurnHeadlines,
} from '@/data/types/core.types';
import type {
  HeadlinePerspective,
  TurnNumber,
} from '@/data/types/enums';
import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Configuration shape for market reactions, derived from GAME_CONFIG.
 * @see FR-203
 */
export type MarketReactionsConfig = typeof GAME_CONFIG.marketReactions;

/**
 * A single trigger match produced by scanning a headline.
 * @see FR-203
 */
export interface MarketTriggerMatch {
  /** Key identifying the trigger (e.g. "hormuz", "nuclear"). */
  readonly triggerKey: string;
  /** The keyword string that was detected. */
  readonly keyword: string;
  /** Inflation delta configured for this trigger. */
  readonly inflationDelta: number;
  /** The headline perspective in which the match was found. */
  readonly matchedPerspective: HeadlinePerspective;
  /** The headline text (or subtext) that contained the keyword. */
  readonly matchedText: string;
}

/**
 * Result of applying matched triggers to the global inflation value.
 * @see FR-203
 */
export interface MarketReactionResult {
  /** Raw sum of all matched trigger inflation deltas. */
  readonly totalInflationDelta: number;
  /** Delta after capping at maxInflationDeltaPerTurn. */
  readonly cappedDelta: number;
  /** New global inflation value (clamped 0–100). */
  readonly newGlobalInflation: number;
  /** The trigger matches that were actually applied. */
  readonly triggersApplied: MarketTriggerMatch[];
}

/**
 * Cooldown ledger: maps trigger keys to the turn they last fired.
 * @see FR-203
 */
export type TriggerCooldownState = Record<string, TurnNumber>;

/**
 * Complete result for a single turn's market-reaction processing.
 * @see FR-203
 */
export interface MarketReactionTurnResult {
  /** All trigger matches found in headlines (before cooldown filtering). */
  readonly scanMatches: MarketTriggerMatch[];
  /** Matches that survived cooldown filtering. */
  readonly filteredMatches: MarketTriggerMatch[];
  /** Inflation application result. */
  readonly result: MarketReactionResult;
  /** Updated cooldown state after recording fired triggers. */
  readonly updatedCooldowns: TriggerCooldownState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a numeric value to the inclusive range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Case-insensitive check for whether `keyword` appears in `text`.
 */
function containsKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

// ---------------------------------------------------------------------------
// MarketReactionEngine
// ---------------------------------------------------------------------------

/**
 * Scans headlines for pre-configured trigger keywords and computes
 * the resulting GlobalInflation delta each turn.
 *
 * Stateless — all mutable context (cooldowns, inflation) is passed in
 * and returned rather than stored, making the engine trivially testable
 * and compatible with the turn-engine pipeline.
 *
 * @see FR-203
 */
export class MarketReactionEngine {
  private readonly config: MarketReactionsConfig;

  /**
   * Construct a new MarketReactionEngine.
   *
   * @param config - Market reactions configuration (typically `GAME_CONFIG.marketReactions`).
   * @see FR-203
   */
  constructor(config: MarketReactionsConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Scan all three perspective headlines for trigger keywords.
   *
   * Each trigger fires at most once per turn even if multiple perspectives
   * mention the same keyword. The first matching perspective wins.
   *
   * @param turnHeadlines - The headline set for the current turn.
   * @returns Array of unique trigger matches.
   * @see FR-203
   */
  scanHeadlines(turnHeadlines: TurnHeadlines): MarketTriggerMatch[] {
    const matches: MarketTriggerMatch[] = [];
    const seenTriggerKeys = new Set<string>();

    const triggerEntries = Object.entries(this.config.triggers);

    // Iterate perspectives in a stable order
    const perspectives = Object.keys(
      turnHeadlines.headlines,
    ) as HeadlinePerspective[];

    for (const perspective of perspectives) {
      const headline: Headline | undefined =
        turnHeadlines.headlines[perspective];
      if (!headline) continue;

      for (const [triggerKey, triggerDef] of triggerEntries) {
        if (seenTriggerKeys.has(triggerKey)) continue;

        const def = triggerDef as { keyword: string; inflationDelta: number } | undefined;
        if (!def) continue;

        const keyword = def.keyword ?? '';
        const inflationDelta = def.inflationDelta ?? 0;

        // Check primary text
        const matchedInText = containsKeyword(headline.text, keyword);
        // Check subtext if present
        const matchedInSubtext =
          headline.subtext != null &&
          containsKeyword(headline.subtext, keyword);

        if (matchedInText || matchedInSubtext) {
          const matchedText = matchedInText
            ? headline.text
            : (headline.subtext ?? headline.text);

          matches.push({
            triggerKey,
            keyword,
            inflationDelta,
            matchedPerspective: perspective,
            matchedText,
          });
          seenTriggerKeys.add(triggerKey);
        }
      }
    }

    return matches;
  }

  /**
   * Apply market reaction inflation deltas from matched triggers.
   *
   * The total delta is capped at `maxInflationDeltaPerTurn` and the
   * resulting global inflation is clamped to the 0–100 range.
   *
   * @param matches          - Trigger matches to apply.
   * @param currentGlobalInflation - Current global inflation value (0–100).
   * @returns Detailed result including capped delta and new inflation.
   * @see FR-203
   */
  applyMarketReactions(
    matches: MarketTriggerMatch[],
    currentGlobalInflation: number,
  ): MarketReactionResult {
    const totalInflationDelta = matches.reduce(
      (sum, m) => sum + m.inflationDelta,
      0,
    );

    const cappedDelta = Math.min(
      totalInflationDelta,
      this.config.maxInflationDeltaPerTurn,
    );

    const newGlobalInflation = clamp(
      currentGlobalInflation + cappedDelta,
      0,
      100,
    );

    return {
      totalInflationDelta,
      cappedDelta,
      newGlobalInflation,
      triggersApplied: matches,
    };
  }

  /**
   * Full turn pipeline: scan headlines → filter by cooldowns → apply
   * reactions → update cooldown state.
   *
   * @param turnHeadlines         - Headlines for the current turn.
   * @param currentGlobalInflation - Current global inflation (0–100).
   * @param cooldownState          - Current trigger cooldown ledger.
   * @returns Complete turn result with new inflation and updated cooldowns.
   * @see FR-203
   */
  processTurn(
    turnHeadlines: TurnHeadlines,
    currentGlobalInflation: number,
    cooldownState: TriggerCooldownState,
  ): MarketReactionTurnResult {
    const currentTurn = turnHeadlines.turn;

    // 1. Scan headlines for trigger keywords
    const scanMatches = this.scanHeadlines(turnHeadlines);

    // 2. Filter out matches that are still on cooldown
    const filteredMatches = scanMatches.filter(
      (m) => !this.isOnCooldown(m.triggerKey, cooldownState, currentTurn),
    );

    // 3. Apply inflation deltas from surviving matches
    const result = this.applyMarketReactions(
      filteredMatches,
      currentGlobalInflation,
    );

    // 4. Record fired triggers and prune expired cooldowns
    const firedKeys = filteredMatches.map((m) => m.triggerKey);
    const updatedCooldowns = this.updateCooldowns(
      firedKeys,
      currentTurn,
      cooldownState,
    );

    return {
      scanMatches,
      filteredMatches,
      result,
      updatedCooldowns,
    };
  }

  /**
   * Determine whether a trigger is currently on cooldown.
   *
   * A trigger is on cooldown if it has fired within the last
   * `triggerCooldownTurns` turns (inclusive).
   *
   * @param triggerKey    - The trigger key to check.
   * @param cooldownState - Current cooldown ledger.
   * @param currentTurn   - The turn being processed.
   * @returns `true` if the trigger should be suppressed.
   * @see FR-203
   */
  isOnCooldown(
    triggerKey: string,
    cooldownState: TriggerCooldownState,
    currentTurn: TurnNumber,
  ): boolean {
    const lastFired: TurnNumber | undefined = cooldownState[triggerKey];
    if (lastFired == null) return false;

    const turnsSinceFired =
      (currentTurn as number) - (lastFired as number);

    return turnsSinceFired <= this.config.triggerCooldownTurns;
  }

  /**
   * Record newly-fired triggers and prune expired cooldowns.
   *
   * Pure function — returns a new cooldown state without mutating the input.
   *
   * @param firedTriggers - Trigger keys that fired this turn.
   * @param currentTurn   - The turn being processed.
   * @param cooldownState - Previous cooldown ledger.
   * @returns Updated cooldown state.
   * @see FR-203
   */
  updateCooldowns(
    firedTriggers: string[],
    currentTurn: TurnNumber,
    cooldownState: TriggerCooldownState,
  ): TriggerCooldownState {
    const updated: TriggerCooldownState = {};

    // Carry forward non-expired entries
    for (const [key, lastFired] of Object.entries(cooldownState)) {
      const turn = lastFired as TurnNumber | undefined;
      if (turn == null) continue;

      const age = (currentTurn as number) - (turn as number);
      if (age <= this.config.triggerCooldownTurns) {
        updated[key] = turn;
      }
    }

    // Record newly fired triggers at the current turn
    for (const key of firedTriggers) {
      updated[key] = currentTurn;
    }

    return updated;
  }
}
