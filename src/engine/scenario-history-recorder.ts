/**
 * Scenario History Recorder — FR-3600, CNFL-4401, CNFL-4402
 *
 * Records per-turn game state snapshots, player/AI actions, events, and
 * market data into an immutable scenario history archive. Supports JSON,
 * CSV, and self-contained HTML export formats, generates export manifests,
 * and provides cross-scenario comparison with divergence-point detection.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/scenario-history-recorder
 * @see FR-3600  — Scenario History Recording
 * @see CNFL-4401 — Turn-by-Turn History Archive
 * @see CNFL-4402 — Scenario Export & Comparison
 */

import type { FactionId } from '@/data/types';
import type {
  ScenarioScore,
  ScenarioExportManifest,
  MarketEventLogEntry,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a numeric value to the inclusive range [min, max].
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Escapes a string value for safe CSV output.
 *
 * @param val - The string to escape.
 * @returns The escaped string, quoted if necessary.
 */
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Escapes a string for safe HTML output.
 *
 * @param val - The string to escape.
 * @returns The HTML-escaped string.
 */
function htmlEscape(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default divergence threshold (20%). */
const DEFAULT_DIVERGENCE_THRESHOLD = 0.2;

/** Metrics extracted from nation snapshots for CSV/comparison. */
const NATION_METRICS: readonly string[] = [
  'stability',
  'gdp',
  'treasury',
  'militaryReadiness',
  'diplomaticInfluence',
  'civilUnrest',
  'techLevel',
] as const;

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * A single action taken by a player or AI in a turn.
 *
 * @see CNFL-4401
 */
export interface GameAction {
  readonly actionId: string;
  readonly factionId: FactionId;
  readonly actionType: string;
  readonly description: string;
  readonly parameters?: Record<string, unknown>;
}

/**
 * A game event that occurred during a turn.
 *
 * @see CNFL-4401
 */
export interface GameEvent {
  readonly eventId: string;
  readonly turn: number;
  readonly eventType: string;
  readonly description: string;
  readonly affectedFactions: readonly FactionId[];
  readonly severity?: number;
}

/**
 * Snapshot of key nation metrics for a single turn (space-efficient).
 *
 * @see CNFL-4401
 */
export interface TurnMetricsSnapshot {
  readonly factionId: FactionId;
  readonly stability: number;
  readonly gdp: number;
  readonly treasury: number;
  readonly militaryReadiness: number;
  readonly diplomaticInfluence: number;
  readonly civilUnrest: number;
  readonly techLevel: number;
}

/**
 * Complete record of a single turn.
 *
 * @see CNFL-4401
 */
export interface TurnRecord {
  readonly turn: number;
  readonly timestamp: string;
  readonly nationSnapshots: readonly TurnMetricsSnapshot[];
  readonly actions: readonly GameAction[];
  readonly events: readonly GameEvent[];
  readonly marketData: {
    readonly tickerCount: number;
    readonly exchangeComposites: Record<string, number>;
    readonly indexValues: Record<string, number>;
    readonly marketEvents: readonly MarketEventLogEntry[];
  };
}

/**
 * Complete scenario history archive.
 *
 * @see DR-178 — Scenario History Archive
 */
export interface ScenarioHistoryArchive {
  readonly scenarioId: string;
  readonly runId: string;
  readonly playerFaction: FactionId;
  readonly turnsPlayed: number;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly victoryCondition?: string;
  readonly turnHistory: readonly TurnRecord[];
  readonly finalScores?: ScenarioScore;
  readonly metadata: {
    readonly gameVersion: string;
    readonly scenarioName: string;
    readonly difficulty?: string;
  };
}

/**
 * Time-series row for CSV export.
 *
 * @see CNFL-4402
 */
export interface TimeSeriesRow {
  readonly turn: number;
  readonly factionId: FactionId;
  readonly metric: string;
  readonly value: number;
}

/**
 * Scenario comparison data for cross-scenario analysis.
 *
 * @see CNFL-4402
 */
export interface ScenarioComparisonData {
  readonly scenarioId: string;
  readonly playerFaction: FactionId;
  readonly totalScore: number;
  readonly turnsPlayed: number;
  readonly dimensions: Record<string, number>;
  readonly keyMetricTrajectories: Record<string, readonly number[]>;
}

/**
 * A divergence point between two scenarios at a specific turn.
 *
 * @see CNFL-4402
 */
export interface DivergencePoint {
  readonly turn: number;
  readonly metric: string;
  readonly scenarioAValue: number;
  readonly scenarioBValue: number;
  readonly divergencePercent: number;
  readonly likelyCause: string;
}

/**
 * Market timeline entry for a single turn.
 *
 * @see CNFL-4402
 */
export interface MarketTimelineEntry {
  readonly turn: number;
  readonly exchangeComposites: Record<string, number>;
  readonly indexValues: Record<string, number>;
}

/**
 * Cross-scenario comparison result.
 *
 * @see CNFL-4402
 */
export interface ScenarioComparisonResult {
  readonly scenarioA: ScenarioComparisonData;
  readonly scenarioB: ScenarioComparisonData;
  readonly divergencePoints: readonly DivergencePoint[];
}

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Scenario History Recorder
 *
 * Records turn-by-turn game state into an immutable archive, supports
 * multi-format export (JSON, CSV, HTML), generates export manifests,
 * and provides cross-scenario comparison with divergence detection.
 *
 * All methods are pure functions that do not mutate input state.
 *
 * @see FR-3600  — Scenario History Recording
 * @see CNFL-4401 — Turn-by-Turn History Archive
 * @see CNFL-4402 — Scenario Export & Comparison
 */
export class ScenarioHistoryRecorder {
  // -----------------------------------------------------------------------
  // Method 1 — recordTurn
  // -----------------------------------------------------------------------

  /**
   * Records a single turn's data by appending a new {@link TurnRecord} to
   * the archive's turn history. Returns a new archive (immutable append).
   *
   * @param archive         - The existing scenario history archive.
   * @param turn            - The turn number being recorded.
   * @param nationSnapshots - Metrics snapshots for every faction this turn.
   * @param actions         - All actions taken during this turn.
   * @param events          - All events that occurred this turn.
   * @param marketData      - Market state for this turn.
   * @returns A new {@link ScenarioHistoryArchive} with the turn appended.
   *
   * @see CNFL-4401
   */
  recordTurn(
    archive: ScenarioHistoryArchive,
    turn: number,
    nationSnapshots: readonly TurnMetricsSnapshot[],
    actions: readonly GameAction[],
    events: readonly GameEvent[],
    marketData: TurnRecord['marketData'],
  ): ScenarioHistoryArchive {
    const record: TurnRecord = {
      turn,
      timestamp: new Date().toISOString(),
      nationSnapshots: [...nationSnapshots],
      actions: [...actions],
      events: [...events],
      marketData,
    };

    return {
      ...archive,
      turnsPlayed: turn,
      turnHistory: [...archive.turnHistory, record],
    };
  }

  // -----------------------------------------------------------------------
  // Method 2 — initializeArchive
  // -----------------------------------------------------------------------

  /**
   * Creates an empty {@link ScenarioHistoryArchive} with metadata.
   * Generates a unique `runId` from the current timestamp.
   *
   * @param scenarioId   - The scenario identifier.
   * @param playerFaction - The player's faction identifier.
   * @param scenarioName - Human-readable scenario name.
   * @param gameVersion  - The game version string.
   * @returns A new empty archive ready for turn recording.
   *
   * @see CNFL-4401
   */
  initializeArchive(
    scenarioId: string,
    playerFaction: FactionId,
    scenarioName: string,
    gameVersion: string,
  ): ScenarioHistoryArchive {
    const now = new Date().toISOString();
    const runId = `run-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;

    return {
      scenarioId,
      runId,
      playerFaction,
      turnsPlayed: 0,
      startedAt: now,
      turnHistory: [],
      metadata: {
        gameVersion,
        scenarioName,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Method 3 — finalizeArchive
  // -----------------------------------------------------------------------

  /**
   * Finalises a scenario archive by setting the completion timestamp,
   * final scores, and victory condition. The returned archive is
   * conceptually immutable.
   *
   * @param archive          - The archive to finalise.
   * @param scores           - The final scenario scores.
   * @param victoryCondition - Description of the victory/defeat condition met.
   * @returns A new finalised {@link ScenarioHistoryArchive}.
   *
   * @see CNFL-4401
   */
  finalizeArchive(
    archive: ScenarioHistoryArchive,
    scores: ScenarioScore,
    victoryCondition: string,
  ): ScenarioHistoryArchive {
    return {
      ...archive,
      completedAt: new Date().toISOString(),
      finalScores: scores,
      victoryCondition,
    };
  }

  // -----------------------------------------------------------------------
  // Method 4 — getTurnSnapshot
  // -----------------------------------------------------------------------

  /**
   * Retrieves the {@link TurnRecord} for a specific turn number.
   *
   * @param archive - The scenario history archive.
   * @param turn    - The turn number to look up.
   * @returns The matching {@link TurnRecord}, or `undefined` if not found.
   *
   * @see CNFL-4401
   */
  getTurnSnapshot(
    archive: ScenarioHistoryArchive,
    turn: number,
  ): TurnRecord | undefined {
    return archive.turnHistory.find((record) => record.turn === turn);
  }

  // -----------------------------------------------------------------------
  // Method 5 — getEventTimeline
  // -----------------------------------------------------------------------

  /**
   * Flattens all events from all turns into a single chronological list.
   *
   * @param archive - The scenario history archive.
   * @returns All game events sorted by turn.
   *
   * @see CNFL-4401
   */
  getEventTimeline(
    archive: ScenarioHistoryArchive,
  ): readonly GameEvent[] {
    const events: GameEvent[] = [];

    for (const record of archive.turnHistory) {
      for (const event of record.events) {
        events.push(event);
      }
    }

    return events.sort((a, b) => a.turn - b.turn);
  }

  // -----------------------------------------------------------------------
  // Method 6 — getMarketTimeline
  // -----------------------------------------------------------------------

  /**
   * Extracts market data from each turn into a time-series array of
   * exchange composites and index values.
   *
   * @param archive - The scenario history archive.
   * @returns Array of {@link MarketTimelineEntry} entries, one per turn.
   *
   * @see CNFL-4402
   */
  getMarketTimeline(
    archive: ScenarioHistoryArchive,
  ): readonly MarketTimelineEntry[] {
    return archive.turnHistory.map((record) => ({
      turn: record.turn,
      exchangeComposites: { ...record.marketData.exchangeComposites },
      indexValues: { ...record.marketData.indexValues },
    }));
  }

  // -----------------------------------------------------------------------
  // Method 7 — exportJSON
  // -----------------------------------------------------------------------

  /**
   * Serialises the complete scenario archive to a formatted JSON string.
   *
   * @param archive - The scenario history archive to export.
   * @returns A formatted JSON string representation.
   *
   * @see CNFL-4402
   */
  exportJSON(archive: ScenarioHistoryArchive): string {
    return JSON.stringify(archive, null, 2);
  }

  // -----------------------------------------------------------------------
  // Method 8 — exportCSV
  // -----------------------------------------------------------------------

  /**
   * Generates a CSV export of the archive with columns:
   * `turn, factionId, metric, value`.
   *
   * Extracts all nation metrics as time-series rows and includes market
   * data (exchange composites and index values) as additional rows.
   *
   * @param archive - The scenario history archive to export.
   * @returns A CSV string with header row and data rows.
   *
   * @see CNFL-4402
   */
  exportCSV(archive: ScenarioHistoryArchive): string {
    const rows: TimeSeriesRow[] = [];

    /* Extract nation metrics */
    for (const record of archive.turnHistory) {
      for (const snapshot of record.nationSnapshots) {
        for (const metric of NATION_METRICS) {
          const value = snapshot[metric as keyof TurnMetricsSnapshot];
          if (typeof value === 'number') {
            rows.push({
              turn: record.turn,
              factionId: snapshot.factionId,
              metric,
              value,
            });
          }
        }
      }

      /* Extract market data as rows */
      for (const [exchangeId, compositeValue] of Object.entries(
        record.marketData.exchangeComposites,
      )) {
        rows.push({
          turn: record.turn,
          factionId: archive.playerFaction,
          metric: `exchange_composite_${exchangeId}`,
          value: compositeValue,
        });
      }

      for (const [indexId, indexValue] of Object.entries(
        record.marketData.indexValues,
      )) {
        rows.push({
          turn: record.turn,
          factionId: archive.playerFaction,
          metric: `index_${indexId}`,
          value: indexValue,
        });
      }
    }

    /* Build CSV string */
    const header = 'turn,factionId,metric,value';
    const dataLines = rows.map(
      (r) =>
        `${r.turn},${csvEscape(r.factionId)},${csvEscape(r.metric)},${r.value}`,
    );

    return [header, ...dataLines].join('\n');
  }

  // -----------------------------------------------------------------------
  // Method 9 — exportHTML
  // -----------------------------------------------------------------------

  /**
   * Generates a self-contained HTML report of the scenario archive.
   *
   * Includes:
   * - Summary header with scenario metadata
   * - Dimension scores table (if final scores available)
   * - Turn-by-turn metrics table for the player faction
   * - Inline CSS styling (no external dependencies)
   * - Chart data placeholder in a `<script>` tag
   *
   * @param archive - The scenario history archive to export.
   * @returns A complete, self-contained HTML string.
   *
   * @see CNFL-4402
   */
  exportHTML(archive: ScenarioHistoryArchive): string {
    const title = htmlEscape(archive.metadata.scenarioName);
    const playerFaction = htmlEscape(archive.playerFaction);

    /* Build dimension scores table rows */
    let dimensionRows = '';
    if (archive.finalScores) {
      for (const dim of archive.finalScores.dimensions) {
        dimensionRows += `
        <tr>
          <td>${htmlEscape(dim.dimension)}</td>
          <td>${dim.rawScore.toFixed(1)}</td>
          <td>${htmlEscape(dim.letterGrade)}</td>
          <td>${dim.weight.toFixed(2)}</td>
          <td>${dim.weightedScore.toFixed(2)}</td>
        </tr>`;
      }
    }

    /* Build turn metrics table rows (player faction only) */
    let turnRows = '';
    for (const record of archive.turnHistory) {
      const playerSnapshot = record.nationSnapshots.find(
        (s) => s.factionId === archive.playerFaction,
      );
      if (playerSnapshot) {
        turnRows += `
        <tr>
          <td>${record.turn}</td>
          <td>${playerSnapshot.stability.toFixed(1)}</td>
          <td>${playerSnapshot.gdp.toFixed(0)}</td>
          <td>${playerSnapshot.treasury.toFixed(0)}</td>
          <td>${playerSnapshot.militaryReadiness.toFixed(1)}</td>
          <td>${playerSnapshot.diplomaticInfluence.toFixed(1)}</td>
          <td>${playerSnapshot.civilUnrest.toFixed(1)}</td>
          <td>${playerSnapshot.techLevel.toFixed(1)}</td>
        </tr>`;
      }
    }

    /* Prepare chart data JSON for embedded script */
    const chartData = archive.turnHistory.map((r) => {
      const ps = r.nationSnapshots.find(
        (s) => s.factionId === archive.playerFaction,
      );
      return {
        turn: r.turn,
        stability: ps?.stability ?? 0,
        gdp: ps?.gdp ?? 0,
        treasury: ps?.treasury ?? 0,
        militaryReadiness: ps?.militaryReadiness ?? 0,
        diplomaticInfluence: ps?.diplomaticInfluence ?? 0,
        civilUnrest: ps?.civilUnrest ?? 0,
        techLevel: ps?.techLevel ?? 0,
      };
    });

    const totalScore = archive.finalScores?.totalScore ?? 0;
    const victoryCondition = archive.victoryCondition
      ? htmlEscape(archive.victoryCondition)
      : 'N/A';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scenario Report — ${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #0a0a0a; color: #e0e0e0; }
  h1, h2 { color: #00d4ff; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }
  th, td { border: 1px solid #333; padding: 0.5rem 0.75rem; text-align: right; }
  th { background: #1a1a2e; color: #00d4ff; text-align: center; }
  td:first-child { text-align: left; }
  tr:nth-child(even) { background: #111; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0 2rem; }
  .summary-card { background: #1a1a2e; padding: 1rem; border-radius: 8px; border: 1px solid #333; }
  .summary-card .label { font-size: 0.85rem; color: #888; }
  .summary-card .value { font-size: 1.5rem; font-weight: bold; color: #00d4ff; }
  .grade-S { color: #ffd700; } .grade-A { color: #00ff88; } .grade-B { color: #00d4ff; }
  .grade-C { color: #ffaa00; } .grade-D { color: #ff6600; } .grade-F { color: #ff3333; }
</style>
</head>
<body>
<h1>Scenario Report: ${title}</h1>

<div class="summary">
  <div class="summary-card"><div class="label">Faction</div><div class="value">${playerFaction}</div></div>
  <div class="summary-card"><div class="label">Turns Played</div><div class="value">${archive.turnsPlayed}</div></div>
  <div class="summary-card"><div class="label">Total Score</div><div class="value">${totalScore.toFixed(0)} / 1000</div></div>
  <div class="summary-card"><div class="label">Victory Condition</div><div class="value">${victoryCondition}</div></div>
  <div class="summary-card"><div class="label">Game Version</div><div class="value">${htmlEscape(archive.metadata.gameVersion)}</div></div>
  <div class="summary-card"><div class="label">Started</div><div class="value">${htmlEscape(archive.startedAt)}</div></div>
</div>

${archive.finalScores ? `
<h2>Dimension Scores</h2>
<table>
  <thead><tr><th>Dimension</th><th>Raw Score</th><th>Grade</th><th>Weight</th><th>Weighted</th></tr></thead>
  <tbody>${dimensionRows}
  </tbody>
</table>
` : ''}

<h2>Turn-by-Turn Metrics (${playerFaction})</h2>
<table>
  <thead><tr><th>Turn</th><th>Stability</th><th>GDP</th><th>Treasury</th><th>Military</th><th>Diplomacy</th><th>Unrest</th><th>Tech</th></tr></thead>
  <tbody>${turnRows}
  </tbody>
</table>

<script>
// Chart data placeholder — integrate with a charting library as needed
const chartData = ${JSON.stringify(chartData, null, 2)};
</script>
</body>
</html>`;
  }

  // -----------------------------------------------------------------------
  // Method 10 — generateExportManifest
  // -----------------------------------------------------------------------

  /**
   * Creates a {@link ScenarioExportManifest} with export metadata.
   *
   * @param archive       - The archive being exported.
   * @param format        - The export format ('json', 'csv', or 'html').
   * @param fileSizeBytes - Size of the exported file in bytes.
   * @returns A new {@link ScenarioExportManifest}.
   *
   * @see CNFL-4402
   */
  generateExportManifest(
    archive: ScenarioHistoryArchive,
    format: 'json' | 'html' | 'csv',
    fileSizeBytes: number,
  ): ScenarioExportManifest {
    const now = new Date().toISOString();
    const exportId = `export-${format}-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;

    return {
      exportId,
      format,
      exportedAt: now,
      scenarioId: archive.scenarioId,
      includesHistory: true,
      includesMarketData: true,
      includesScores: archive.finalScores !== undefined,
      fileSizeBytes,
    };
  }

  // -----------------------------------------------------------------------
  // Method 11 — compareScenarios
  // -----------------------------------------------------------------------

  /**
   * Compares two scenario archives side by side. Extracts comparison data
   * from each archive, overlays key metric trajectories, and identifies
   * divergence points where metrics differ by more than 20%.
   *
   * @param archiveA - The first scenario archive.
   * @param archiveB - The second scenario archive.
   * @returns A {@link ScenarioComparisonResult} with both data sets and divergences.
   *
   * @see CNFL-4402
   */
  compareScenarios(
    archiveA: ScenarioHistoryArchive,
    archiveB: ScenarioHistoryArchive,
  ): ScenarioComparisonResult {
    const dataA = this.extractComparisonData(archiveA);
    const dataB = this.extractComparisonData(archiveB);

    const divergencePoints = this.findDivergencePoints(
      archiveA,
      archiveB,
      DEFAULT_DIVERGENCE_THRESHOLD,
    );

    return {
      scenarioA: dataA,
      scenarioB: dataB,
      divergencePoints,
    };
  }

  // -----------------------------------------------------------------------
  // Method 12 — findDivergencePoints
  // -----------------------------------------------------------------------

  /**
   * Finds turns where corresponding metrics between two archives diverge
   * by more than the given threshold. For each divergence, identifies
   * a likely cause from events occurring at that turn.
   *
   * @param archiveA  - The first scenario archive.
   * @param archiveB  - The second scenario archive.
   * @param threshold - Fractional threshold for divergence detection (default 0.2 = 20%).
   * @returns Array of {@link DivergencePoint} entries sorted by turn.
   *
   * @see CNFL-4402
   */
  findDivergencePoints(
    archiveA: ScenarioHistoryArchive,
    archiveB: ScenarioHistoryArchive,
    threshold: number = DEFAULT_DIVERGENCE_THRESHOLD,
  ): readonly DivergencePoint[] {
    const divergences: DivergencePoint[] = [];

    /* Build lookup maps by turn for both archives */
    const mapA = new Map<number, TurnRecord>();
    for (const record of archiveA.turnHistory) {
      mapA.set(record.turn, record);
    }

    const mapB = new Map<number, TurnRecord>();
    for (const record of archiveB.turnHistory) {
      mapB.set(record.turn, record);
    }

    /* Find overlapping turns */
    const allTurns = new Set<number>([...mapA.keys(), ...mapB.keys()]);
    const sortedTurns = [...allTurns].sort((a, b) => a - b);

    for (const turn of sortedTurns) {
      const recordA = mapA.get(turn);
      const recordB = mapB.get(turn);

      if (!recordA || !recordB) continue;

      /* Compare player faction snapshots */
      const snapA = recordA.nationSnapshots.find(
        (s) => s.factionId === archiveA.playerFaction,
      );
      const snapB = recordB.nationSnapshots.find(
        (s) => s.factionId === archiveB.playerFaction,
      );

      if (!snapA || !snapB) continue;

      for (const metric of NATION_METRICS) {
        const valA = snapA[metric as keyof TurnMetricsSnapshot] as number;
        const valB = snapB[metric as keyof TurnMetricsSnapshot] as number;

        if (typeof valA !== 'number' || typeof valB !== 'number') continue;

        /* Compute relative divergence */
        const baseline = Math.max(Math.abs(valA), Math.abs(valB), 1);
        const diff = Math.abs(valA - valB);
        const divergencePercent = diff / baseline;

        if (divergencePercent > threshold) {
          /* Identify likely cause from events at this turn */
          const allEvents = [
            ...recordA.events,
            ...recordB.events,
          ];
          const likelyCause =
            allEvents.length > 0
              ? allEvents[0]!.description
              : 'No specific event identified';

          divergences.push({
            turn,
            metric,
            scenarioAValue: valA,
            scenarioBValue: valB,
            divergencePercent: clamp(
              Math.round(divergencePercent * 1000) / 10,
              0,
              1000,
            ),
            likelyCause,
          });
        }
      }
    }

    return divergences.sort((a, b) => a.turn - b.turn);
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Extracts comparison data from a single archive for cross-scenario
   * analysis.
   */
  private extractComparisonData(
    archive: ScenarioHistoryArchive,
  ): ScenarioComparisonData {
    /* Dimension scores from final results */
    const dimensions: Record<string, number> = {};
    if (archive.finalScores) {
      for (const dim of archive.finalScores.dimensions) {
        dimensions[dim.dimension] = dim.rawScore;
      }
    }

    /* Build key metric trajectories for the player faction */
    const trajectories: Record<string, number[]> = {};
    for (const metric of NATION_METRICS) {
      trajectories[metric] = [];
    }

    for (const record of archive.turnHistory) {
      const snapshot = record.nationSnapshots.find(
        (s) => s.factionId === archive.playerFaction,
      );
      if (snapshot) {
        for (const metric of NATION_METRICS) {
          const val = snapshot[metric as keyof TurnMetricsSnapshot];
          if (typeof val === 'number') {
            trajectories[metric]!.push(val);
          }
        }
      }
    }

    return {
      scenarioId: archive.scenarioId,
      playerFaction: archive.playerFaction,
      totalScore: archive.finalScores?.totalScore ?? 0,
      turnsPlayed: archive.turnsPlayed,
      dimensions,
      keyMetricTrajectories: trajectories,
    };
  }
}
