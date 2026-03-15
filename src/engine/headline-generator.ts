/**
 * New Order: Three-Perspective Headline Generator
 *
 * Generates biased news headlines from three distinct media perspectives
 * (Western Press, State Propaganda, Intelligence) based on actual game
 * events each turn. Each perspective applies category-weighted scoring
 * and perspective-specific framing templates to produce immersive,
 * narratively diverse headlines.
 *
 * Headlines are stored in the HeadlineArchive for replay, UI display,
 * and market-reaction triggers.
 *
 * @see FR-201 — Three-perspective headline generation
 * @see DR-107 — Headline Archive
 *
 * @module engine/headline-generator
 */

import type {
  EventLogEntry,
  Headline,
  TurnHeadlines,
  HeadlineArchive,
} from '@/data/types/core.types';
import type {
  EventCategory,
  EventId,
  HeadlinePerspective,
  TurnNumber,
} from '@/data/types/enums';
import { GAME_CONFIG } from './config';
import { SeededRandom } from './rng';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Configuration shape for headline generation, extracted from
 * {@link GAME_CONFIG.headlines}.
 *
 * @see FR-201
 */
export type HeadlineGeneratorConfig = typeof GAME_CONFIG.headlines;

/**
 * Internal weight key used to look up category weights in the
 * perspective bias configuration.
 */
type WeightKey =
  | 'diplomaticWeight'
  | 'militaryWeight'
  | 'economicWeight'
  | 'intelligenceWeight'
  | 'domesticWeight';

// ─────────────────────────────────────────────────────────
// Constants — Framing Templates
// ─────────────────────────────────────────────────────────

/** @see FR-201 */
const WESTERN_PRESS_PREFIXES: readonly string[] = [
  'International Community Alarmed as',
  'World Leaders Condemn',
  'Breaking: Western Allies Respond to',
  'Democracy Under Threat:',
  'Human Rights Groups Decry',
  'Global Markets Reel After',
  'NATO Allies Reassess Following',
  'UN Security Council Debates',
];

/** @see FR-201 */
const STATE_PROPAGANDA_PREFIXES: readonly string[] = [
  'Glorious Defense Forces Prevail:',
  'Motherland Triumphs as',
  'Supreme Leadership Ensures',
  'People\'s Victory:',
  'National Sovereignty Defended Against',
  'Heroic Armed Forces Achieve',
  'Patriotic Citizens Rally Behind',
  'Enemies of the State Defeated:',
];

/** @see FR-201 */
const INTELLIGENCE_PREFIXES: readonly string[] = [
  'SIGINT INTERCEPT:',
  'CLASSIFIED — Eyes Only:',
  'INTEL ASSESSMENT:',
  'HUMINT REPORT:',
  'GEOINT Analysis Confirms:',
  'THREAT BRIEFING:',
  'SITUATION REPORT:',
  'ELINT Monitoring Detected:',
];

/** @see FR-201 */
const WESTERN_PRESS_SUBTEXTS: readonly string[] = [
  'Analysts warn of escalating regional tensions.',
  'Economic sanctions under consideration by coalition partners.',
  'Diplomatic back-channels reportedly active behind the scenes.',
  'Civilian impact draws widespread international criticism.',
];

/** @see FR-201 */
const STATE_PROPAGANDA_SUBTEXTS: readonly string[] = [
  'The people stand united behind our glorious leadership.',
  'Foreign provocations will not weaken national resolve.',
  'State media celebrates historic achievement for the motherland.',
  'Enemies of the people have been dealt a decisive blow.',
];

/** @see FR-201 */
const INTELLIGENCE_SUBTEXTS: readonly string[] = [
  'Confidence level: MODERATE. Multiple SIGINT sources corroborate.',
  'Assessment based on satellite imagery and open-source intelligence.',
  'Cross-referenced with HUMINT assets in theater. Reliability: B-2.',
  'Pattern-of-life analysis indicates shift in adversary posture.',
];

/** Ordered perspectives for iteration. @see FR-201 */
const ALL_PERSPECTIVES: readonly HeadlinePerspective[] = [
  'WesternPress' as HeadlinePerspective,
  'StatePropaganda' as HeadlinePerspective,
  'Intelligence' as HeadlinePerspective,
];

// ─────────────────────────────────────────────────────────
// Category → WeightKey Mapping
// ─────────────────────────────────────────────────────────

/**
 * Maps each {@link EventCategory} to its corresponding weight key in the
 * perspective bias config.
 *
 * - Military / Nuclear → militaryWeight
 * - Diplomatic → diplomaticWeight
 * - Economic / Climate / Technology → economicWeight
 * - Intelligence → intelligenceWeight
 * - Domestic / Information / Proxy → domesticWeight
 *
 * @see FR-201
 */
const CATEGORY_WEIGHT_MAP: Record<EventCategory, WeightKey> = {
  Military: 'militaryWeight',
  Nuclear: 'militaryWeight',
  Diplomatic: 'diplomaticWeight',
  Economic: 'economicWeight',
  Climate: 'economicWeight',
  Technology: 'economicWeight',
  Intelligence: 'intelligenceWeight',
  Domestic: 'domesticWeight',
  Information: 'domesticWeight',
  Proxy: 'domesticWeight',
} as Record<EventCategory, WeightKey>;

// ─────────────────────────────────────────────────────────
// HeadlineGenerator
// ─────────────────────────────────────────────────────────

/**
 * Generates turn-by-turn news headlines from three media perspectives,
 * each applying its own category-weighting bias and narrative framing.
 *
 * ### Usage
 * ```ts
 * const gen = new HeadlineGenerator(GAME_CONFIG.headlines, rng);
 * const turnNews = gen.generateTurnHeadlines(turn, events);
 * archive = gen.appendToArchive(archive, turnNews);
 * ```
 *
 * @see FR-201 — Three-perspective headline generation
 * @see DR-107 — Headline Archive
 */
export class HeadlineGenerator {
  /** Headline configuration (weights, thresholds, tone). */
  private readonly config: HeadlineGeneratorConfig;

  /** Seeded PRNG for deterministic template selection and score variance. */
  private readonly rng: SeededRandom;

  // ── Constructor ────────────────────────────────────────

  /**
   * Create a new headline generator.
   *
   * @param config - Headline configuration from {@link GAME_CONFIG.headlines}.
   * @param rng - Seeded PRNG for deterministic randomness.
   *
   * @see FR-201
   */
  constructor(config: HeadlineGeneratorConfig, rng: SeededRandom) {
    this.config = config;
    this.rng = rng;
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Generate one headline per perspective for the given turn's events.
   *
   * If the number of events is below {@link HeadlineGeneratorConfig.minEventsForHeadlines},
   * all three perspectives receive a "no significant events" placeholder.
   *
   * @param turn - The current turn number.
   * @param events - All events logged during this turn.
   * @returns A {@link TurnHeadlines} with one headline per perspective.
   *
   * @see FR-201
   * @see DR-107
   */
  generateTurnHeadlines(
    turn: TurnNumber,
    events: EventLogEntry[],
  ): TurnHeadlines {
    if (events.length < this.config.minEventsForHeadlines) {
      return this.buildQuietTurnHeadlines(turn);
    }

    const headlines = {} as Record<HeadlinePerspective, Headline>;

    for (const perspective of ALL_PERSPECTIVES) {
      const topEvent = this.selectTopEvent(events, perspective);
      headlines[perspective] = this.frameHeadline(topEvent, perspective);
    }

    return { turn, headlines };
  }

  /**
   * Score an event's relevance for a given perspective based on the
   * perspective's category weight bias, plus a small RNG variance to
   * break ties deterministically.
   *
   * @param event - The event to score.
   * @param perspective - The perspective whose bias weights to apply.
   * @returns A numeric relevance score (higher = more relevant).
   *
   * @see FR-201
   */
  scoreEventForPerspective(
    event: EventLogEntry,
    perspective: HeadlinePerspective,
  ): number {
    const baseWeight = this.getCategoryWeight(event.category, perspective);
    const dramaBoost = this.getDramaMultiplier(perspective);

    // Small RNG variance (±0.05) to break ties deterministically
    const variance = (this.rng.nextFloat(0, 1) - 0.5) * 0.1;

    return baseWeight * dramaBoost + variance;
  }

  /**
   * Frame an event into a perspective-specific headline with narrative
   * bias, subtext, and event linkage.
   *
   * @param event - The source event to frame.
   * @param perspective - The framing perspective.
   * @returns A fully-formed {@link Headline}.
   *
   * @see FR-201
   * @see DR-107
   */
  frameHeadline(
    event: EventLogEntry,
    perspective: HeadlinePerspective,
  ): Headline {
    const prefix = this.pickPrefix(perspective);
    const subtext = this.pickSubtext(perspective);

    const text = `${prefix} ${event.description}`;

    return {
      perspective,
      text,
      subtext,
      relatedEventIds: [event.id],
    };
  }

  /**
   * Append a turn's headlines to an existing archive. Pure function —
   * returns a new array without mutating the original.
   *
   * @param archive - The existing headline archive.
   * @param turnHeadlines - The new turn's headlines to append.
   * @returns A new {@link HeadlineArchive} with the entry appended.
   *
   * @see DR-107
   */
  appendToArchive(
    archive: HeadlineArchive,
    turnHeadlines: TurnHeadlines,
  ): HeadlineArchive {
    return [...archive, turnHeadlines];
  }

  // ── Private helpers ────────────────────────────────────

  /**
   * Look up the category weight for a given event category and perspective.
   *
   * Maps {@link EventCategory} → weight key via {@link CATEGORY_WEIGHT_MAP},
   * then reads the value from the perspective's bias config.
   *
   * @param category - The event category to look up.
   * @param perspective - The perspective whose weights to query.
   * @returns The numeric weight (0–1) for this category/perspective pair.
   *
   * @see FR-201
   */
  private getCategoryWeight(
    category: EventCategory,
    perspective: HeadlinePerspective,
  ): number {
    const weightKey = CATEGORY_WEIGHT_MAP[category] ?? 'domesticWeight';
    const biasConfig = this.getPerspectiveBias(perspective);

    return biasConfig[weightKey] ?? 0;
  }

  /**
   * Retrieve the bias weight table for a given perspective.
   *
   * @param perspective - The perspective to look up.
   * @returns The perspective's weight configuration.
   */
  private getPerspectiveBias(
    perspective: HeadlinePerspective,
  ): Record<WeightKey, number> {
    const biasMap: Record<HeadlinePerspective, Record<WeightKey, number>> = {
      WesternPress: this.config.perspectiveBias.westernPress as Record<WeightKey, number>,
      StatePropaganda: this.config.perspectiveBias.statePropaganda as Record<WeightKey, number>,
      Intelligence: this.config.perspectiveBias.intelligence as Record<WeightKey, number>,
    };

    return biasMap[perspective] ?? this.config.perspectiveBias.westernPress as Record<WeightKey, number>;
  }

  /**
   * Get the drama-boost multiplier for a perspective's tone.
   *
   * @param perspective - The perspective.
   * @returns The tone multiplier (>1 amplifies, <1 dampens).
   */
  private getDramaMultiplier(perspective: HeadlinePerspective): number {
    const toneMap: Record<HeadlinePerspective, number> = {
      WesternPress: this.config.toneMultipliers.westernPressDramaBoost,
      StatePropaganda: this.config.toneMultipliers.statePropagandaDramaBoost,
      Intelligence: this.config.toneMultipliers.intelligenceDramaBoost,
    };

    return toneMap[perspective] ?? 1.0;
  }

  /**
   * Select the highest-scoring event for a perspective by scoring all
   * events and returning the top result.
   *
   * @param events - Candidate events (must be non-empty).
   * @param perspective - The perspective to score against.
   * @returns The most relevant event for this perspective.
   */
  private selectTopEvent(
    events: EventLogEntry[],
    perspective: HeadlinePerspective,
  ): EventLogEntry {
    let bestEvent: EventLogEntry = events[0]!;
    let bestScore = -Infinity;

    for (const event of events) {
      const score = this.scoreEventForPerspective(event, perspective);
      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    return bestEvent;
  }

  /**
   * Pick a random framing prefix for the given perspective.
   *
   * @param perspective - The perspective.
   * @returns A perspective-appropriate headline prefix string.
   */
  private pickPrefix(perspective: HeadlinePerspective): string {
    const prefixMap: Record<HeadlinePerspective, readonly string[]> = {
      WesternPress: WESTERN_PRESS_PREFIXES,
      StatePropaganda: STATE_PROPAGANDA_PREFIXES,
      Intelligence: INTELLIGENCE_PREFIXES,
    };

    const templates = prefixMap[perspective] ?? WESTERN_PRESS_PREFIXES;
    return this.rng.pick(templates);
  }

  /**
   * Pick a random subtext blurb for the given perspective.
   *
   * @param perspective - The perspective.
   * @returns A perspective-appropriate subtext string.
   */
  private pickSubtext(perspective: HeadlinePerspective): string {
    const subtextMap: Record<HeadlinePerspective, readonly string[]> = {
      WesternPress: WESTERN_PRESS_SUBTEXTS,
      StatePropaganda: STATE_PROPAGANDA_SUBTEXTS,
      Intelligence: INTELLIGENCE_SUBTEXTS,
    };

    const templates = subtextMap[perspective] ?? WESTERN_PRESS_SUBTEXTS;
    return this.rng.pick(templates);
  }

  /**
   * Build a placeholder {@link TurnHeadlines} for turns with too few events.
   *
   * @param turn - The turn number.
   * @returns A TurnHeadlines where every perspective reports "no significant events."
   */
  private buildQuietTurnHeadlines(turn: TurnNumber): TurnHeadlines {
    const quietHeadlines = {} as Record<HeadlinePerspective, Headline>;

    const quietTexts: Record<HeadlinePerspective, string> = {
      WesternPress: 'No Significant Developments Reported by International Press',
      StatePropaganda: 'Peace and Stability Reign Under Wise Leadership',
      Intelligence: 'SITREP: No actionable intelligence detected this cycle',
    };

    const quietSubtexts: Record<HeadlinePerspective, string> = {
      WesternPress: 'A rare quiet turn on the world stage.',
      StatePropaganda: 'The people prosper under continued guidance.',
      Intelligence: 'All monitored channels within baseline parameters.',
    };

    for (const perspective of ALL_PERSPECTIVES) {
      quietHeadlines[perspective] = {
        perspective,
        text: quietTexts[perspective] ?? 'No significant events this turn.',
        subtext: quietSubtexts[perspective] ?? 'Quiet turn.',
        relatedEventIds: [] as EventId[],
      };
    }

    return { turn, headlines: quietHeadlines };
  }
}
