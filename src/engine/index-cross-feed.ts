/**
 * Index Cross-Engine Feed — CNFL-4203
 *
 * Computes per-faction gameplay modifiers derived from market index
 * performance, feeding them into force structure, economic, stability,
 * and research subsystems.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/index-cross-feed
 * @see FR-3400  — Market Indexes as Gameplay Inputs
 * @see CNFL-4203 — Index Cross-Engine Feeds
 */

import type { FactionId } from '@/data/types';
import type {
  RuntimeMarketState,
  IndexRuntimeState,
  MarketTrend,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value to the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Modifiers derived from a single index's performance.
 *
 * Positive values boost the target subsystem; negative values penalise.
 */
export interface IndexFeedModifier {
  /** Index that produced this modifier. */
  readonly indexId: string;
  /** Current index value. */
  readonly currentValue: number;
  /** Percentage change over the most recent turn. */
  readonly latestChangePercent: number;
  /** Trend direction over the configured window. */
  readonly trend: MarketTrend;
  /** Computed modifier value (positive = boost, negative = penalty). */
  readonly modifier: number;
}

/**
 * Complete set of cross-engine modifiers for a single faction per turn.
 *
 * @see CNFL-4203
 */
export interface FactionCrossFeeds {
  readonly factionId: FactionId;
  /** Defense index → military readiness modifier (±0–5 points). */
  readonly militaryReadinessModifier: IndexFeedModifier | null;
  /** Energy index → economic resource security modifier (±0–3 points). */
  readonly economicResourceModifier: IndexFeedModifier | null;
  /** Tech index → research speed modifier (0.9–1.1 multiplier). */
  readonly researchSpeedModifier: IndexFeedModifier | null;
  /** Composite index → stability modifier (±0–4 points). */
  readonly stabilityModifier: IndexFeedModifier | null;
  /** Net stability delta from all index feeds. */
  readonly netStabilityDelta: number;
  /** Net readiness delta from defense index. */
  readonly netReadinessDelta: number;
  /** Research speed multiplier from tech index. */
  readonly researchSpeedMultiplier: number;
}

/**
 * Configuration for the cross-feed engine.
 *
 * @see CNFL-4203
 */
export interface CrossFeedConfig {
  /** Maximum military readiness modifier (positive or negative). */
  readonly maxReadinessModifier: number;
  /** Maximum economic resource modifier. */
  readonly maxEconomicModifier: number;
  /** Maximum stability modifier from composite index. */
  readonly maxStabilityModifier: number;
  /** Maximum research speed deviation from 1.0. */
  readonly maxResearchSpeedDeviation: number;
  /** Index IDs to use for each feed. */
  readonly indexMapping: {
    readonly defense: string;
    readonly energy: string;
    readonly technology: string;
    readonly composite: string;
  };
  /** Mapping from exchange ID to faction ID. */
  readonly exchangeToFaction: Readonly<Record<string, FactionId>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default cross-feed configuration. */
const DEFAULT_CONFIG: CrossFeedConfig = {
  maxReadinessModifier: 5,
  maxEconomicModifier: 3,
  maxStabilityModifier: 4,
  maxResearchSpeedDeviation: 0.1,
  indexMapping: {
    defense: 'global-defense',
    energy: 'global-energy',
    technology: 'global-technology',
    composite: 'global-composite',
  },
  exchangeToFaction: {
    nyse: 'us' as FactionId,
    sse: 'china' as FactionId,
    moex: 'russia' as FactionId,
    tse: 'japan' as FactionId,
    tedpix: 'iran' as FactionId,
    pse: 'dprk' as FactionId,
    euronext: 'eu' as FactionId,
    dse: 'syria' as FactionId,
  },
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless engine that computes per-faction gameplay modifiers from
 * market index performance.
 *
 * ## Feed Logic
 *
 * 1. **Defense Index → Military Readiness**: Rising defense index boosts
 *    readiness; falling index penalises it. Scaled to ±5 points.
 *
 * 2. **Energy Index → Economic Resource Security**: Rising energy index
 *    improves resource security; falling penalises. Scaled to ±3 points.
 *
 * 3. **Technology Index → Research Speed**: Rising tech index accelerates
 *    research; falling slows it. Multiplier range: 0.9–1.1.
 *
 * 4. **Composite Index → Stability**: Rising composite boosts stability;
 *    falling erodes it. Scaled to ±4 points.
 *
 * @see CNFL-4203
 */
export class IndexCrossFeed {
  private readonly config: CrossFeedConfig;

  constructor(config?: Partial<CrossFeedConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Per-Faction Feed Computation ──────────────────────────────────────

  /**
   * Compute cross-engine feed modifiers for a single faction.
   *
   * Uses global indexes for feeds that affect all factions equally, plus
   * faction-specific exchange performance for weighted local effects.
   *
   * @param factionId         Faction to compute feeds for.
   * @param marketState       Current runtime market state.
   * @param factionExchangeId Exchange ID belonging to this faction.
   * @returns Complete set of cross-engine modifiers.
   *
   * @see CNFL-4203
   */
  computeFactionFeeds(
    factionId: FactionId,
    marketState: RuntimeMarketState,
    _factionExchangeId: string,
  ): FactionCrossFeeds {
    const defenseModifier = this.computeIndexFeedModifier(
      this.config.indexMapping.defense,
      marketState.indexStates,
      this.config.maxReadinessModifier,
    );

    const energyModifier = this.computeIndexFeedModifier(
      this.config.indexMapping.energy,
      marketState.indexStates,
      this.config.maxEconomicModifier,
    );

    const techModifier = this.computeIndexFeedModifier(
      this.config.indexMapping.technology,
      marketState.indexStates,
      this.config.maxResearchSpeedDeviation * 100, // scale for later /100
    );

    const compositeModifier = this.computeIndexFeedModifier(
      this.config.indexMapping.composite,
      marketState.indexStates,
      this.config.maxStabilityModifier,
    );

    // Research speed is a multiplier around 1.0
    const researchSpeedMultiplier = techModifier
      ? clamp(
          1.0 + (techModifier.modifier / 100) * this.config.maxResearchSpeedDeviation,
          1.0 - this.config.maxResearchSpeedDeviation,
          1.0 + this.config.maxResearchSpeedDeviation,
        )
      : 1.0;

    return {
      factionId,
      militaryReadinessModifier: defenseModifier,
      economicResourceModifier: energyModifier,
      researchSpeedModifier: techModifier,
      stabilityModifier: compositeModifier,
      netStabilityDelta: compositeModifier?.modifier ?? 0,
      netReadinessDelta: defenseModifier?.modifier ?? 0,
      researchSpeedMultiplier,
    };
  }

  // ── Batch Computation ─────────────────────────────────────────────────

  /**
   * Compute cross-engine feeds for all factions in a single pass.
   *
   * @param marketState       Current runtime market state.
   * @returns Map of faction ID → cross-feed modifiers.
   *
   * @see CNFL-4203
   */
  computeAllFactionFeeds(
    marketState: RuntimeMarketState,
  ): ReadonlyMap<FactionId, FactionCrossFeeds> {
    const result = new Map<FactionId, FactionCrossFeeds>();

    for (const [exchangeId, factionId] of Object.entries(
      this.config.exchangeToFaction,
    )) {
      const feeds = this.computeFactionFeeds(
        factionId,
        marketState,
        exchangeId,
      );
      result.set(factionId, feeds);
    }

    return result;
  }

  // ── Modifier Application ──────────────────────────────────────────────

  /**
   * Apply cross-feed modifiers to a faction's stability value.
   *
   * @param currentStability Current stability (0–100).
   * @param feeds            Faction cross-feeds.
   * @returns Updated stability value, clamped to 0–100.
   */
  applyStabilityModifier(
    currentStability: number,
    feeds: FactionCrossFeeds,
  ): number {
    return clamp(currentStability + feeds.netStabilityDelta, 0, 100);
  }

  /**
   * Apply cross-feed modifiers to a faction's military readiness.
   *
   * @param currentReadiness Current readiness (0–100).
   * @param feeds            Faction cross-feeds.
   * @returns Updated readiness value, clamped to 0–100.
   */
  applyReadinessModifier(
    currentReadiness: number,
    feeds: FactionCrossFeeds,
  ): number {
    return clamp(currentReadiness + feeds.netReadinessDelta, 0, 100);
  }

  /**
   * Apply cross-feed research speed multiplier to a base speed.
   *
   * @param baseSpeed Base research speed multiplier.
   * @param feeds     Faction cross-feeds.
   * @returns Adjusted research speed multiplier.
   */
  applyResearchSpeedModifier(
    baseSpeed: number,
    feeds: FactionCrossFeeds,
  ): number {
    return baseSpeed * feeds.researchSpeedMultiplier;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Compute a single index feed modifier from the index's recent
   * performance (latest change percentage).
   *
   * The modifier is linearly scaled: a 10% index change maps to the
   * maximum modifier. Changes smaller than 0.5% produce no modifier.
   *
   * @param indexId    ID of the index to evaluate.
   * @param states     All index runtime states.
   * @param maxModifier Maximum absolute modifier value.
   * @returns Feed modifier, or null if the index is not found.
   */
  private computeIndexFeedModifier(
    indexId: string,
    states: Readonly<Record<string, IndexRuntimeState>>,
    maxModifier: number,
  ): IndexFeedModifier | null {
    const state = states[indexId];
    if (!state || state.history.length === 0) return null;

    const latestEntry = state.history[state.history.length - 1];
    if (!latestEntry) return null;

    const changePercent = latestEntry.changePercent;

    // Dead zone: changes under 0.5% produce no modifier
    if (Math.abs(changePercent) < 0.5) {
      return {
        indexId,
        currentValue: state.currentValue,
        latestChangePercent: changePercent,
        trend: state.trendDirection,
        modifier: 0,
      };
    }

    // Linear scale: 10% change → maxModifier
    const FULL_SCALE_PERCENT = 10;
    const scaledModifier =
      (changePercent / FULL_SCALE_PERCENT) * maxModifier;
    const clampedModifier = clamp(scaledModifier, -maxModifier, maxModifier);

    return {
      indexId,
      currentValue: state.currentValue,
      latestChangePercent: changePercent,
      trend: state.trendDirection,
      modifier: Math.round(clampedModifier * 100) / 100,
    };
  }
}
