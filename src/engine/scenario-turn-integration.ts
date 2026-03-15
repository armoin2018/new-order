/**
 * Scenario Turn Integration — CNFL-4404
 *
 * Integrates {@link ScenarioHistoryRecorder} and {@link ScenarioScoringEngine}
 * into the game turn pipeline. Provides:
 *
 * 1. **Archive lifecycle** — initialise, record each turn, finalise on game end.
 * 2. **Automatic metrics extraction** — gathers {@link GameMetrics} from nation
 *    state, market data, and turn history.
 * 3. **Score computation** — triggers composite scoring on game completion.
 * 4. **Export readiness** — produces a finalised archive ready for JSON/CSV/HTML export.
 *
 * All public methods are **pure functions** — no internal mutation, no side effects.
 * The caller (Zustand store or turn pipeline) is responsible for persisting
 * the returned archive back to state.
 *
 * @module engine/scenario-turn-integration
 * @see FR-3600  — Scenario Completion Scoring & History
 * @see CNFL-4404 — Scoring/History Turn Integration
 */

import type { FactionId } from '@/data/types';
import type { GameState } from '@/data/types/gamestate.types';
import type {
  ScenarioScore,
  MarketEventLogEntry,
} from '@/data/types/model.types';
import { ScenarioHistoryRecorder } from './scenario-history-recorder';
import { ScenarioScoringEngine } from './scenario-scoring-engine';
import type { GameMetrics, ScoringWeights } from './scenario-scoring-engine';
import type {
  ScenarioHistoryArchive,
  TurnMetricsSnapshot,
  TurnRecord,
  GameAction,
  GameEvent,
} from './scenario-history-recorder';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current game version string embedded in archives. */
const GAME_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * Input bundle for recording a single turn's data.
 *
 * @see CNFL-4404
 */
export interface RecordTurnInput {
  /** The current scenario archive (immutable — a new one is returned). */
  readonly archive: ScenarioHistoryArchive;
  /** The current game state (after all phase handlers have run). */
  readonly gameState: GameState;
  /** The turn number being recorded. */
  readonly turn: number;
  /** Actions taken by all factions this turn. */
  readonly actions: readonly GameAction[];
  /** Events that occurred this turn. */
  readonly events: readonly GameEvent[];
}

/**
 * Output from recording a single turn.
 *
 * @see CNFL-4404
 */
export interface RecordTurnResult {
  /** The updated archive with the turn appended. */
  readonly archive: ScenarioHistoryArchive;
}

/**
 * Input bundle for completing a scenario.
 *
 * @see CNFL-4404
 */
export interface CompleteScenarioInput {
  /** The current scenario archive. */
  readonly archive: ScenarioHistoryArchive;
  /** The final game state. */
  readonly gameState: GameState;
  /** The reason the game ended (victory condition or loss). */
  readonly endReason: string;
  /** Optional scoring weight overrides. */
  readonly weights?: ScoringWeights;
}

/**
 * Output from completing a scenario.
 *
 * @see CNFL-4404
 */
export interface CompleteScenarioResult {
  /** Finalised archive with scores and completion metadata. */
  readonly archive: ScenarioHistoryArchive;
  /** The computed composite scenario score. */
  readonly score: ScenarioScore;
  /** Per-dimension raw scores for quick access. */
  readonly dimensionScores: Readonly<Record<string, number>>;
}

/**
 * Configuration for the scenario turn integration.
 *
 * @see CNFL-4404
 */
export interface ScenarioIntegrationConfig {
  /** Game version string for archive metadata. */
  readonly gameVersion: string;
  /** Optional scoring weight overrides (applied when completing scenarios). */
  readonly scoringWeights?: ScoringWeights;
}

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ScenarioIntegrationConfig = {
  gameVersion: GAME_VERSION,
};

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Scenario Turn Integration
 *
 * Bridges the {@link ScenarioHistoryRecorder} and {@link ScenarioScoringEngine}
 * into the game turn pipeline. Call {@link initialiseArchive} at game start,
 * {@link recordTurn} at the end of each turn, and {@link completeScenario}
 * when the game ends.
 *
 * @see FR-3600  — Scenario Completion Scoring & History
 * @see CNFL-4404 — Scoring/History Turn Integration
 */
export class ScenarioTurnIntegration {
  private readonly recorder: ScenarioHistoryRecorder;
  private readonly scorer: ScenarioScoringEngine;
  private readonly config: ScenarioIntegrationConfig;

  constructor(config?: Partial<ScenarioIntegrationConfig>) {
    this.recorder = new ScenarioHistoryRecorder();
    this.scorer = new ScenarioScoringEngine();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Method 1 — initialiseArchive
  // -----------------------------------------------------------------------

  /**
   * Creates a new empty scenario archive ready for turn recording.
   * Call this when a new game is started.
   *
   * @param scenarioId    - The scenario identifier (from scenarioMeta.id).
   * @param playerFaction - The player's chosen faction.
   * @param scenarioName  - Human-readable scenario name.
   * @returns A new empty {@link ScenarioHistoryArchive}.
   *
   * @see CNFL-4404
   */
  initialiseArchive(
    scenarioId: string,
    playerFaction: FactionId,
    scenarioName: string,
  ): ScenarioHistoryArchive {
    return this.recorder.initializeArchive(
      scenarioId,
      playerFaction,
      scenarioName,
      this.config.gameVersion,
    );
  }

  // -----------------------------------------------------------------------
  // Method 2 — recordTurn
  // -----------------------------------------------------------------------

  /**
   * Records a single turn's data into the archive. Call this at the end of
   * each turn phase pipeline (after Phase 6 / END_OF_TURN_EVENTS).
   *
   * Extracts nation metric snapshots from the game state and market data
   * from the runtime market state. Returns an updated archive (immutable).
   *
   * **Performance target**: < 5 ms overhead per turn (NFR-704).
   *
   * @param input - The {@link RecordTurnInput} bundle.
   * @returns A {@link RecordTurnResult} with the updated archive.
   *
   * @see CNFL-4404
   */
  recordTurn(input: RecordTurnInput): RecordTurnResult {
    const { archive, gameState, turn, actions, events } = input;

    // Extract nation snapshots for all factions
    const nationSnapshots = this.extractNationSnapshots(gameState);

    // Extract market data
    const marketData = this.extractMarketData(gameState);

    // Delegate to recorder (pure — returns new archive)
    const updatedArchive = this.recorder.recordTurn(
      archive,
      turn,
      nationSnapshots,
      actions,
      events,
      marketData,
    );

    return { archive: updatedArchive };
  }

  // -----------------------------------------------------------------------
  // Method 3 — completeScenario
  // -----------------------------------------------------------------------

  /**
   * Completes a scenario by computing the composite score and finalising
   * the archive. Call this when any game-end condition is met (victory,
   * defeat, or max turns reached).
   *
   * Steps:
   * 1. Extract {@link GameMetrics} from the final game state and archive.
   * 2. Compute the composite score via {@link ScenarioScoringEngine}.
   * 3. Finalise the archive with scores and victory condition.
   *
   * @param input - The {@link CompleteScenarioInput} bundle.
   * @returns A {@link CompleteScenarioResult} with the finalised archive and score.
   *
   * @see CNFL-4404
   */
  completeScenario(input: CompleteScenarioInput): CompleteScenarioResult {
    const { archive, gameState, endReason, weights } = input;

    // Extract metrics from the full game state and archive history
    const metrics = this.extractGameMetrics(gameState, archive);

    // Compute composite score
    const score = this.scorer.computeCompositeScore(
      metrics,
      weights ?? this.config.scoringWeights,
    );

    // Finalise the archive
    const finalisedArchive = this.recorder.finalizeArchive(
      archive,
      score,
      endReason,
    );

    // Build per-dimension quick-access map
    const dimensionScores: Record<string, number> = {};
    for (const dim of score.dimensions) {
      dimensionScores[dim.dimension] = dim.rawScore;
    }

    return {
      archive: finalisedArchive,
      score,
      dimensionScores,
    };
  }

  // -----------------------------------------------------------------------
  // Method 4 — extractGameMetrics
  // -----------------------------------------------------------------------

  /**
   * Extracts {@link GameMetrics} from the final game state and archive.
   * Used internally by {@link completeScenario} and also exposed for
   * testing and external score computation.
   *
   * @param gameState - The final game state.
   * @param archive   - The scenario archive with turn history.
   * @returns A complete {@link GameMetrics} object.
   *
   * @see CNFL-4404
   */
  extractGameMetrics(
    gameState: GameState,
    archive: ScenarioHistoryArchive,
  ): GameMetrics {
    const factionId = archive.playerFaction;
    const nation = gameState.nationStates[factionId];
    const turnsPlayed = archive.turnsPlayed;

    // ── Stability metrics ─────────────────────────────────────────────
    const stabilityValues = this.getPlayerMetricTimeSeries(archive, 'stability');
    const averageStability = stabilityValues.length > 0
      ? stabilityValues.reduce((s, v) => s + v, 0) / stabilityValues.length
      : nation?.stability ?? 50;
    const lowestStability = stabilityValues.length > 0
      ? Math.min(...stabilityValues)
      : nation?.stability ?? 50;
    const stabilityTrend = stabilityValues.length >= 2
      ? (stabilityValues[stabilityValues.length - 1]! - stabilityValues[0]!) / stabilityValues.length
      : 0;

    // ── Economic metrics ──────────────────────────────────────────────
    const gdpTimeSeries = this.getPlayerMetricTimeSeries(archive, 'gdp');
    const startGdp = gdpTimeSeries.length > 0 ? gdpTimeSeries[0]! : nation?.gdp ?? 1000;
    const endGdp = gdpTimeSeries.length > 0 ? gdpTimeSeries[gdpTimeSeries.length - 1]! : nation?.gdp ?? 1000;
    const gdpGrowthPercent = startGdp !== 0
      ? ((endGdp - startGdp) / Math.abs(startGdp)) * 100
      : 0;

    const finalTreasury = nation?.treasury ?? 0;
    const averageInflation = nation?.inflation ?? 5;

    // ── Market composite growth ───────────────────────────────────────
    const marketCompositeGrowthPercent = this.computeMarketCompositeGrowth(archive);

    // ── Military metrics ──────────────────────────────────────────────
    const readinessValues = this.getPlayerMetricTimeSeries(archive, 'militaryReadiness');
    const averageReadiness = readinessValues.length > 0
      ? readinessValues.reduce((s, v) => s + v, 0) / readinessValues.length
      : nation?.militaryReadiness ?? 50;

    // Territory and force preservation - estimated from military readiness
    // NationState does not track these directly; approximate from readiness
    const territoryControlPercent = averageReadiness * 0.8;
    const forcePreservationPercent = Math.min(100, averageReadiness * 1.1);

    // ── Diplomatic metrics ────────────────────────────────────────────
    const allianceCount = this.countAlliances(gameState, factionId);
    const internationalLegitimacy = gameState.internationalLegitimacy?.[factionId]?.legitimacy ?? 50;
    const diplomaticInfluence = nation?.diplomaticInfluence ?? 50;

    // ── Technology metrics ────────────────────────────────────────────
    const techLevelValues = this.getPlayerMetricTimeSeries(archive, 'techLevel');
    const maxDomainLevel = techLevelValues.length > 0
      ? Math.max(...techLevelValues)
      : nation?.techLevel ?? 0;
    const techsResearched = this.countTechsResearched(gameState);
    const techModulesGenerated = this.countTechModules(gameState, factionId);

    // ── Market-specific metrics ───────────────────────────────────────
    const compositeIndexGrowthPercent = this.computeIndexGrowth(archive, 'global-composite');
    const customIndexPerformanceAvg = this.computeCustomIndexAvgPerf(archive);
    const marketCrashEvents = this.countMarketCrashEvents(archive);

    // ── Strategic metrics ─────────────────────────────────────────────
    const strategicGrade = gameState.strategicConsistency?.consistencyScore ?? 50;
    const victoryPathAdherence = gameState.strategicConsistency?.consistencyScore ?? 50;

    return {
      factionId,
      turnsPlayed,
      averageStability,
      lowestStability,
      stabilityTrend,
      gdpGrowthPercent,
      finalTreasury,
      averageInflation,
      marketCompositeGrowthPercent,
      territoryControlPercent,
      forcePreservationPercent,
      averageReadiness,
      allianceCount,
      internationalLegitimacy,
      diplomaticInfluence,
      maxDomainLevel,
      techsResearched,
      techModulesGenerated,
      compositeIndexGrowthPercent,
      customIndexPerformanceAvg,
      marketCrashEvents,
      strategicGrade,
      victoryPathAdherence,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Extracts nation metric snapshots for all factions from game state.
   */
  private extractNationSnapshots(
    gameState: GameState,
  ): readonly TurnMetricsSnapshot[] {
    const snapshots: TurnMetricsSnapshot[] = [];

    for (const [factionId, nation] of Object.entries(gameState.nationStates)) {
      if (!nation) continue;
      snapshots.push({
        factionId: factionId as FactionId,
        stability: nation.stability ?? 0,
        gdp: nation.gdp ?? 0,
        treasury: nation.treasury ?? 0,
        militaryReadiness: nation.militaryReadiness ?? 0,
        diplomaticInfluence: nation.diplomaticInfluence ?? 0,
        civilUnrest: gameState.civilUnrestComponents?.[factionId as FactionId]?.civilUnrest ?? 0,
        techLevel: nation.techLevel ?? 0,
      });
    }

    return snapshots;
  }

  /**
   * Extracts market data from the game state's runtime market state.
   */
  private extractMarketData(
    gameState: GameState,
  ): TurnRecord['marketData'] {
    const ms = gameState.marketState;

    if (!ms) {
      return {
        tickerCount: 0,
        exchangeComposites: {},
        indexValues: {},
        marketEvents: [],
      };
    }

    // Count tickers
    const tickerCount = Object.keys(ms.tickerStates).length;

    // Exchange composites — compute from ticker states
    const exchangeComposites: Record<string, number> = {};
    for (const exchange of ms.exchanges) {
      // Simple average of all ticker prices in the exchange's nation
      const tickers = ms.tickerSets.find(
        (ts) => ts.exchangeId === exchange.exchangeId,
      );
      if (tickers) {
        let sum = 0;
        let count = 0;
        for (const ticker of tickers.tickers) {
            const state = ms.tickerStates[ticker.tickerId];
            if (state) {
              sum += state.currentPrice;
              count++;
            }
        }
        exchangeComposites[exchange.exchangeId] = count > 0 ? sum / count : 0;
      }
    }

    // Index values
    const indexValues: Record<string, number> = {};
    if (ms.indexStates) {
      for (const [indexId, state] of Object.entries(ms.indexStates)) {
        if (state) {
          indexValues[indexId] = state.currentValue;
        }
      }
    }

    // Market events from the log
    const marketEvents: readonly MarketEventLogEntry[] =
      ms.marketEventLog ?? [];

    return {
      tickerCount,
      exchangeComposites,
      indexValues,
      marketEvents,
    };
  }

  /**
   * Extracts a time series of a single metric for the player faction.
   */
  private getPlayerMetricTimeSeries(
    archive: ScenarioHistoryArchive,
    metric: string,
  ): number[] {
    const values: number[] = [];

    for (const record of archive.turnHistory) {
      const snap = record.nationSnapshots.find(
        (s) => s.factionId === archive.playerFaction,
      );
      if (snap) {
        const val = snap[metric as keyof TurnMetricsSnapshot];
        if (typeof val === 'number') {
          values.push(val);
        }
      }
    }

    return values;
  }

  /**
   * Computes overall market composite growth from first to last turn.
   */
  private computeMarketCompositeGrowth(
    archive: ScenarioHistoryArchive,
  ): number {
    const turns = archive.turnHistory;
    if (turns.length < 2) return 0;

    const first = turns[0]!;
    const last = turns[turns.length - 1]!;

    const firstVals = Object.values(first.marketData.exchangeComposites);
    const lastVals = Object.values(last.marketData.exchangeComposites);

    if (firstVals.length === 0) return 0;

    const firstAvg = firstVals.reduce((s, v) => s + v, 0) / firstVals.length;
    const lastAvg = lastVals.reduce((s, v) => s + v, 0) / Math.max(lastVals.length, 1);

    return firstAvg !== 0
      ? ((lastAvg - firstAvg) / Math.abs(firstAvg)) * 100
      : 0;
  }

  /**
   * Counts alliances for a faction from the relationship matrix.
   */
  private countAlliances(
    gameState: GameState,
    factionId: FactionId,
  ): number {
    const row = gameState.relationshipMatrix[factionId];
    if (!row) return 0;

    let count = 0;
    for (const val of Object.values(row)) {
      // Alliance threshold: relationship > 70
      if (typeof val === 'number' && val > 70) {
        count++;
      }
    }
    return count;
  }

  /**
   * Counts total technologies researched from technology indices.
   */
  private countTechsResearched(gameState: GameState): number {
    const indices = gameState.technologyIndices;
    if (!indices) return 0;

    let count = 0;
    for (const factionTech of Object.values(indices)) {
      if (factionTech && typeof factionTech === 'object') {
        for (const val of Object.values(factionTech)) {
          if (typeof val === 'number' && val > 0) {
            count++;
          }
        }
      }
    }
    return count;
  }

  /**
   * Counts tech modules generated for a specific faction.
   */
  private countTechModules(
    gameState: GameState,
    factionId: FactionId,
  ): number {
    const registry = gameState.techModuleRegistry;
    if (!registry?.modules) return 0;

    let count = 0;
    for (const mod of Object.values(registry.modules)) {
      if (mod && mod.generatedBy === factionId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Computes growth of a specific market index from first to last turn.
   */
  private computeIndexGrowth(
    archive: ScenarioHistoryArchive,
    indexId: string,
  ): number {
    const turns = archive.turnHistory;
    if (turns.length < 2) return 0;

    const firstVal = turns[0]!.marketData.indexValues[indexId];
    const lastVal = turns[turns.length - 1]!.marketData.indexValues[indexId];

    if (firstVal === undefined || lastVal === undefined || firstVal === 0) return 0;

    return ((lastVal - firstVal) / Math.abs(firstVal)) * 100;
  }

  /**
   * Computes average performance across all custom indexes.
   */
  private computeCustomIndexAvgPerf(
    archive: ScenarioHistoryArchive,
  ): number {
    const turns = archive.turnHistory;
    if (turns.length < 2) return 50;

    const first = turns[0]!;
    const last = turns[turns.length - 1]!;

    // Custom indexes are those not starting with "global-"
    const customIndexIds = Object.keys(first.marketData.indexValues)
      .filter((id) => !id.startsWith('global-'));

    if (customIndexIds.length === 0) return 50;

    let totalGrowth = 0;
    for (const id of customIndexIds) {
      const startVal = first.marketData.indexValues[id] ?? 0;
      const endVal = last.marketData.indexValues[id] ?? 0;
      if (startVal !== 0) {
        totalGrowth += ((endVal - startVal) / Math.abs(startVal)) * 100;
      }
    }

    // Map growth percentage to a 0-100 performance score
    const avgGrowth = totalGrowth / customIndexIds.length;
    // +50% growth = 100, 0% = 50, -50% = 0
    return Math.max(0, Math.min(100, 50 + avgGrowth));
  }

  /**
   * Counts market crash events from the archive's market data.
   */
  private countMarketCrashEvents(
    archive: ScenarioHistoryArchive,
  ): number {
    let count = 0;
    for (const record of archive.turnHistory) {
      for (const event of record.marketData.marketEvents) {
        if (event.eventType === 'crash' || event.eventType === 'contagion') {
          count++;
        }
      }
    }
    return count;
  }
}
