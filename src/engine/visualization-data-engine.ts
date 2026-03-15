/**
 * Visualization Data Engine
 *
 * Prepares structured data for visualization dashboards: proxy network
 * graphs, tech race rankings, resource security maps, sanctions impact
 * timelines, and narrative battle replays. All public methods are pure
 * functions — no mutations, no side effects. Every numeric result is
 * clamped to its valid range.
 *
 * @module visualization-data-engine
 * @see CNFL-2804 — Visualization dashboard data preparation
 */

import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Configuration Type Alias
// ─────────────────────────────────────────────────────────

/**
 * Configuration subset governing visualization data preparation.
 * Alias for the `visualization` branch of {@link GAME_CONFIG}.
 *
 * @see CNFL-2804
 */
export type VisualizationConfig = typeof GAME_CONFIG.visualization;

// ─────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────

/**
 * Clamp a numeric value to an inclusive [min, max] range.
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────

/**
 * A single node in the proxy network graph input.
 *
 * @see CNFL-2804
 */
export interface ProxyNodeInput {
  /** Unique identifier for this proxy node. */
  readonly id: string;
  /** Faction that controls or sponsors this node. */
  readonly factionId: FactionId;
  /** Human-readable label for display. */
  readonly label: string;
  /** Node strength score (0–100). */
  readonly strength: number;
}

/**
 * A single edge in the proxy network graph input.
 *
 * @see CNFL-2804
 */
export interface ProxyEdgeInput {
  /** Source node identifier. */
  readonly source: string;
  /** Target node identifier. */
  readonly target: string;
  /** Edge weight (0–100). */
  readonly weight: number;
  /** Type of relationship the edge represents. */
  readonly type: 'funding' | 'arms' | 'intelligence';
}

/**
 * Input for building the tech race dashboard.
 *
 * @see CNFL-2804
 */
export interface TechScoreInput {
  /** Faction being scored. */
  readonly factionId: FactionId;
  /** Aggregate tech index (0–100). */
  readonly techIndex: number;
  /** Per-domain scores (0–100 each). */
  readonly domains: Record<string, number>;
  /** Turn at which the score was recorded. */
  readonly turn: TurnNumber;
}

/**
 * Input for building the resource security map.
 *
 * @see CNFL-2804
 */
export interface ResourceSecurityInput {
  /** Faction whose resource security is assessed. */
  readonly factionId: FactionId;
  /** Type of resource (e.g. "oil", "rare-earth"). */
  readonly resourceType: string;
  /** Current supply level (0–100). */
  readonly supplyLevel: number;
  /** Current demand level (0–100). */
  readonly demandLevel: number;
  /** Turn at which the data was recorded. */
  readonly turn: TurnNumber;
}

/**
 * A single data point in the sanctions impact timeline.
 *
 * @see CNFL-2804
 */
export interface SanctionsDataPoint {
  /** Turn at which the sanctions data was recorded. */
  readonly turn: TurnNumber;
  /** Faction targeted by the sanctions. */
  readonly targetFaction: FactionId;
  /** GDP impact of sanctions (percentage points). */
  readonly gdpImpact: number;
  /** Trade impact of sanctions (percentage points). */
  readonly tradeImpact: number;
  /** Legitimacy impact of sanctions. */
  readonly legitimacyImpact: number;
}

/**
 * Input for a single narrative battle event.
 *
 * @see CNFL-2804
 */
export interface NarrativeEventInput {
  /** Turn during which the narrative battle occurred. */
  readonly turn: TurnNumber;
  /** Faction that initiated the narrative attack. */
  readonly attacker: FactionId;
  /** Faction that was the target of the narrative attack. */
  readonly defender: FactionId;
  /** Type of narrative campaign. */
  readonly narrativeType: string;
  /** Legitimacy delta caused by the battle. */
  readonly legitimacyDelta: number;
  /** Success score of the narrative battle (0–100). */
  readonly successScore: number;
}

/**
 * Input for computing the visualization summary.
 *
 * @see CNFL-2804
 */
export interface VisualizationSummaryInput {
  /** Total number of proxy nodes in the network graph. */
  readonly proxyNodeCount: number;
  /** Faction currently leading the tech race. */
  readonly techLeader: FactionId;
  /** Number of resources at critical supply levels. */
  readonly criticalResourceCount: number;
  /** Factions currently subject to sanctions. */
  readonly sanctionedFactions: readonly FactionId[];
  /** Total number of narrative battles recorded. */
  readonly narrativeBattleCount: number;
}

// ─────────────────────────────────────────────────────────
// Output Interfaces
// ─────────────────────────────────────────────────────────

/**
 * A single node in the proxy network graph output.
 *
 * @see CNFL-2804
 */
export interface ProxyNodeOutput {
  /** Unique identifier for this proxy node. */
  readonly id: string;
  /** Faction that controls or sponsors this node. */
  readonly factionId: FactionId;
  /** Human-readable label for display. */
  readonly label: string;
  /** Node strength score (0–100). */
  readonly strength: number;
  /** Normalized strength relative to the strongest node (0–1). */
  readonly normalized: number;
}

/**
 * A single edge in the proxy network graph output.
 *
 * @see CNFL-2804
 */
export interface ProxyEdgeOutput {
  /** Source node identifier. */
  readonly source: string;
  /** Target node identifier. */
  readonly target: string;
  /** Edge weight (0–100). */
  readonly weight: number;
  /** Type of relationship the edge represents. */
  readonly type: 'funding' | 'arms' | 'intelligence';
  /** Normalized weight relative to the heaviest edge (0–1). */
  readonly normalized: number;
}

/**
 * Result of building the proxy network graph visualization data.
 *
 * @see CNFL-2804
 */
export interface ProxyNetworkGraphResult {
  /** Output nodes, capped at proxyGraphMaxNodes (strongest first). */
  readonly nodes: readonly ProxyNodeOutput[];
  /** Output edges connecting the retained nodes. */
  readonly edges: readonly ProxyEdgeOutput[];
  /** Total number of nodes after capping. */
  readonly totalNodes: number;
  /** Total number of edges after filtering to retained nodes. */
  readonly totalEdges: number;
  /** Human-readable explanation of the graph composition. */
  readonly reason: string;
}

/**
 * A single faction ranking in the tech race dashboard.
 *
 * @see CNFL-2804
 */
export interface TechRanking {
  /** Faction being ranked. */
  readonly factionId: FactionId;
  /** Aggregate tech index (0–100). */
  readonly techIndex: number;
  /** 1-based rank (1 = leader). */
  readonly rank: number;
  /** Per-domain scores (0–100 each). */
  readonly domains: Record<string, number>;
}

/**
 * Result of building the tech race dashboard.
 *
 * @see CNFL-2804
 */
export interface TechRaceDashboardResult {
  /** Factions ranked by tech index (descending). */
  readonly rankings: readonly TechRanking[];
  /** Faction leading the tech race. */
  readonly leader: FactionId;
  /** Leader's tech index. */
  readonly leaderScore: number;
  /** Gap between leader and runner-up (0 if fewer than 2 factions). */
  readonly gap: number;
  /** Human-readable explanation of the tech race state. */
  readonly reason: string;
}

/**
 * A single entry in the resource security map.
 *
 * @see CNFL-2804
 */
export interface ResourceSecurityEntry {
  /** Faction whose resource security is assessed. */
  readonly factionId: FactionId;
  /** Type of resource. */
  readonly resourceType: string;
  /** Current supply level (0–100). */
  readonly supplyLevel: number;
  /** Current demand level (0–100). */
  readonly demandLevel: number;
  /** Supply-to-demand security ratio, clamped 0–200. */
  readonly securityRatio: number;
  /** True if supply is below the critical threshold. */
  readonly isCritical: boolean;
}

/**
 * Result of building the resource security map.
 *
 * @see CNFL-2804
 */
export interface ResourceSecurityMapResult {
  /** All resource security entries. */
  readonly entries: readonly ResourceSecurityEntry[];
  /** Count of entries flagged as critical. */
  readonly criticalCount: number;
  /** Human-readable explanation of the resource security state. */
  readonly reason: string;
}

/**
 * Result of building the sanctions impact timeline.
 *
 * @see CNFL-2804
 */
export interface SanctionsTimelineResult {
  /** Timeline data points, capped at sanctionsTimelineMaxPoints. */
  readonly timeline: readonly SanctionsDataPoint[];
  /** Total number of data points after capping. */
  readonly totalPoints: number;
  /** Turn with the worst (lowest) GDP impact, or null if empty. */
  readonly peakGdpImpactTurn: TurnNumber | null;
  /** Human-readable explanation of the sanctions timeline. */
  readonly reason: string;
}

/**
 * A single entry in the narrative battle replay.
 *
 * @see CNFL-2804
 */
export interface NarrativeReplayEntry {
  /** Turn during which the narrative battle occurred. */
  readonly turn: TurnNumber;
  /** Faction that initiated the narrative attack. */
  readonly attacker: FactionId;
  /** Faction that was the target of the narrative attack. */
  readonly defender: FactionId;
  /** Type of narrative campaign. */
  readonly narrativeType: string;
  /** Legitimacy delta caused by the battle. */
  readonly legitimacyDelta: number;
  /** Success score of the narrative battle (0–100). */
  readonly successScore: number;
}

/**
 * Result of building the narrative battle replay.
 *
 * @see CNFL-2804
 */
export interface NarrativeBattleReplayResult {
  /** Replay entries, capped at narrativeReplayMaxEntries. */
  readonly entries: readonly NarrativeReplayEntry[];
  /** Total number of battles after capping. */
  readonly totalBattles: number;
  /** Faction with the most narrative attacks, or null if empty. */
  readonly topAttacker: FactionId | null;
  /** Faction most frequently targeted by narrative attacks, or null if empty. */
  readonly topDefender: FactionId | null;
  /** Human-readable explanation of the replay data. */
  readonly reason: string;
}

/**
 * Result of computing the visualization summary.
 *
 * @see CNFL-2804
 */
export interface VisualizationSummaryResult {
  /** Total number of proxy nodes. */
  readonly totalProxyNodes: number;
  /** Faction leading the tech race. */
  readonly techLeader: FactionId;
  /** Number of critical resource entries. */
  readonly criticalResources: number;
  /** Number of sanctioned factions. */
  readonly sanctionedFactionCount: number;
  /** Total number of narrative battles. */
  readonly narrativeBattles: number;
  /** Human-readable summary of all visualization data. */
  readonly summary: string;
}

// ─────────────────────────────────────────────────────────
// Engine Class
// ─────────────────────────────────────────────────────────

/**
 * Pure-function engine for preparing structured visualization data.
 *
 * Builds proxy network graphs, tech race dashboards, resource security
 * maps, sanctions impact timelines, and narrative battle replays for
 * in-game and post-game dashboards. All public methods return new result
 * objects — no mutations, no side effects.
 *
 * @see CNFL-2804 — Visualization dashboard data preparation
 */
export class VisualizationDataEngine {
  /** Visualization configuration values used by all calculations. */
  private readonly config: VisualizationConfig;

  /**
   * Create a new VisualizationDataEngine.
   *
   * @param config - Visualization configuration values. Defaults to
   *   `GAME_CONFIG.visualization`.
   * @see CNFL-2804
   */
  constructor(config: VisualizationConfig = GAME_CONFIG.visualization) {
    this.config = config;
  }

  // ───────────────────────────────────────────────────────
  // Method 1: Proxy Network Graph
  // ───────────────────────────────────────────────────────

  /**
   * Build structured data for the proxy network graph visualization.
   *
   * Caps nodes at {@link VisualizationConfig.proxyGraphMaxNodes} (strongest
   * first), normalizes strength and weight values, and filters edges to only
   * include retained node IDs.
   *
   * @param input - Proxy network nodes and edges.
   * @returns Graph data ready for rendering.
   * @see CNFL-2804
   */
  buildProxyNetworkGraph(input: {
    readonly nodes: readonly ProxyNodeInput[];
    readonly edges: readonly ProxyEdgeInput[];
  }): ProxyNetworkGraphResult {
    const maxNodes = this.config.proxyGraphMaxNodes;

    // Sort by strength descending, cap at maxNodes
    const sorted = [...input.nodes].sort((a, b) => b.strength - a.strength);
    const capped = sorted.slice(0, maxNodes);

    const maxStrength = capped.length > 0
      ? Math.max(...capped.map((n) => n.strength))
      : 1;

    const nodes: ProxyNodeOutput[] = capped.map((n) => ({
      id: n.id,
      factionId: n.factionId,
      label: n.label,
      strength: n.strength,
      normalized: clamp(n.strength / maxStrength, 0, 1),
    }));

    // Build a set of retained node IDs for edge filtering
    const retainedIds = new Set(nodes.map((n) => n.id));

    // Filter edges to only those connecting retained nodes
    const filteredEdges = input.edges.filter(
      (e) => retainedIds.has(e.source) && retainedIds.has(e.target),
    );

    const maxWeight = filteredEdges.length > 0
      ? Math.max(...filteredEdges.map((e) => e.weight))
      : 1;

    const edges: ProxyEdgeOutput[] = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      type: e.type,
      normalized: clamp(e.weight / maxWeight, 0, 1),
    }));

    const reason =
      `Proxy network graph built with ${nodes.length} nodes ` +
      `(capped from ${input.nodes.length}) and ${edges.length} edges. ` +
      `Max node strength: ${maxStrength}.`;

    return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length, reason };
  }

  // ───────────────────────────────────────────────────────
  // Method 2: Tech Race Dashboard
  // ───────────────────────────────────────────────────────

  /**
   * Build structured data for the tech race dashboard.
   *
   * Sorts factions by tech index descending and computes the gap between
   * the leader and runner-up.
   *
   * @param input - Faction tech scores.
   * @returns Dashboard data ready for rendering.
   * @see CNFL-2804
   */
  buildTechRaceDashboard(input: {
    readonly factionScores: readonly TechScoreInput[];
  }): TechRaceDashboardResult {
    const sorted = [...input.factionScores].sort(
      (a, b) => b.techIndex - a.techIndex,
    );

    const rankings: TechRanking[] = sorted.map((s, i) => ({
      factionId: s.factionId,
      techIndex: s.techIndex,
      rank: i + 1,
      domains: { ...s.domains },
    }));

    const leader = sorted[0];
    const runnerUp = sorted[1];

    const leaderFaction = leader?.factionId as FactionId;
    const leaderScore = leader?.techIndex ?? 0;
    const gap = leader && runnerUp ? leader.techIndex - runnerUp.techIndex : 0;

    const reason =
      `Tech race dashboard: ${rankings.length} factions ranked. ` +
      `Leader: ${String(leaderFaction)} with index ${leaderScore}. ` +
      `Gap to runner-up: ${gap}.`;

    return { rankings, leader: leaderFaction, leaderScore, gap, reason };
  }

  // ───────────────────────────────────────────────────────
  // Method 3: Resource Security Map
  // ───────────────────────────────────────────────────────

  /**
   * Build structured data for the resource security map overlay.
   *
   * Computes a supply-to-demand security ratio for each resource and flags
   * entries with supply below {@link VisualizationConfig.resourceCriticalThreshold}
   * as critical.
   *
   * @param input - Resource supply and demand data.
   * @returns Map overlay data ready for rendering.
   * @see CNFL-2804
   */
  buildResourceSecurityMap(input: {
    readonly resources: readonly ResourceSecurityInput[];
  }): ResourceSecurityMapResult {
    const threshold = this.config.resourceCriticalThreshold;

    const entries: ResourceSecurityEntry[] = input.resources.map((r) => {
      const securityRatio = clamp(
        (r.supplyLevel / Math.max(r.demandLevel, 1)) * 100,
        0,
        200,
      );
      const isCritical = r.supplyLevel < threshold;

      return {
        factionId: r.factionId,
        resourceType: r.resourceType,
        supplyLevel: r.supplyLevel,
        demandLevel: r.demandLevel,
        securityRatio,
        isCritical,
      };
    });

    const criticalCount = entries.filter((e) => e.isCritical).length;

    const reason =
      `Resource security map: ${entries.length} entries assessed, ` +
      `${criticalCount} critical (supply < ${threshold}).`;

    return { entries, criticalCount, reason };
  }

  // ───────────────────────────────────────────────────────
  // Method 4: Sanctions Timeline
  // ───────────────────────────────────────────────────────

  /**
   * Build structured data for the sanctions impact timeline visualizer.
   *
   * Caps data points at {@link VisualizationConfig.sanctionsTimelineMaxPoints}
   * (most recent) and identifies the turn with the worst GDP impact.
   *
   * @param input - Sanctions data points.
   * @returns Timeline data ready for rendering.
   * @see CNFL-2804
   */
  buildSanctionsTimeline(input: {
    readonly dataPoints: readonly SanctionsDataPoint[];
  }): SanctionsTimelineResult {
    const maxPoints = this.config.sanctionsTimelineMaxPoints;

    // Sort by turn ascending to determine recency, then take the most recent
    const sorted = [...input.dataPoints].sort(
      (a, b) => (a.turn as number) - (b.turn as number),
    );
    const timeline = sorted.slice(-maxPoints);

    // Find the turn with the worst (most negative) GDP impact
    let peakGdpImpactTurn: TurnNumber | null = null;
    let worstGdp = Infinity;

    for (const dp of timeline) {
      if (dp.gdpImpact < worstGdp) {
        worstGdp = dp.gdpImpact;
        peakGdpImpactTurn = dp.turn;
      }
    }

    const reason =
      `Sanctions timeline: ${timeline.length} data points ` +
      `(capped from ${input.dataPoints.length}, max ${maxPoints}). ` +
      (peakGdpImpactTurn !== null
        ? `Worst GDP impact on turn ${peakGdpImpactTurn as number}.`
        : 'No data points.');

    return { timeline, totalPoints: timeline.length, peakGdpImpactTurn, reason };
  }

  // ───────────────────────────────────────────────────────
  // Method 5: Narrative Battle Replay
  // ───────────────────────────────────────────────────────

  /**
   * Build structured data for the post-game narrative battle replay.
   *
   * Caps entries at {@link VisualizationConfig.narrativeReplayMaxEntries}
   * and identifies the top attacker (most attacks) and top defender (most
   * targeted).
   *
   * @param input - Narrative battle events.
   * @returns Replay data ready for rendering.
   * @see CNFL-2804
   */
  buildNarrativeBattleReplay(input: {
    readonly events: readonly NarrativeEventInput[];
  }): NarrativeBattleReplayResult {
    const maxEntries = this.config.narrativeReplayMaxEntries;

    const capped = input.events.slice(0, maxEntries);

    const entries: NarrativeReplayEntry[] = capped.map((e) => ({
      turn: e.turn,
      attacker: e.attacker,
      defender: e.defender,
      narrativeType: e.narrativeType,
      legitimacyDelta: e.legitimacyDelta,
      successScore: e.successScore,
    }));

    // Count attacks per faction
    const attackCounts = new Map<FactionId, number>();
    const defenseCounts = new Map<FactionId, number>();

    for (const e of entries) {
      attackCounts.set(e.attacker, (attackCounts.get(e.attacker) ?? 0) + 1);
      defenseCounts.set(e.defender, (defenseCounts.get(e.defender) ?? 0) + 1);
    }

    let topAttacker: FactionId | null = null;
    let topAttackerCount = 0;
    for (const [faction, count] of attackCounts) {
      if (count > topAttackerCount) {
        topAttackerCount = count;
        topAttacker = faction;
      }
    }

    let topDefender: FactionId | null = null;
    let topDefenderCount = 0;
    for (const [faction, count] of defenseCounts) {
      if (count > topDefenderCount) {
        topDefenderCount = count;
        topDefender = faction;
      }
    }

    const reason =
      `Narrative battle replay: ${entries.length} entries ` +
      `(capped from ${input.events.length}, max ${maxEntries}). ` +
      (topAttacker !== null
        ? `Top attacker: ${String(topAttacker)} (${topAttackerCount}). `
        : '') +
      (topDefender !== null
        ? `Top defender: ${String(topDefender)} (${topDefenderCount}).`
        : '');

    return {
      entries,
      totalBattles: entries.length,
      topAttacker,
      topDefender,
      reason,
    };
  }

  // ───────────────────────────────────────────────────────
  // Method 6: Visualization Summary
  // ───────────────────────────────────────────────────────

  /**
   * Compute a human-readable summary of all visualization dashboard data.
   *
   * @param input - Aggregate counts from each dashboard subsystem.
   * @returns Summary result with a narrative description.
   * @see CNFL-2804
   */
  computeVisualizationSummary(
    input: VisualizationSummaryInput,
  ): VisualizationSummaryResult {
    const summary =
      `Visualization summary: ` +
      `${input.proxyNodeCount} proxy nodes tracked, ` +
      `tech race led by ${String(input.techLeader)}, ` +
      `${input.criticalResourceCount} critical resource entries, ` +
      `${input.sanctionedFactions.length} factions under sanctions, ` +
      `${input.narrativeBattleCount} narrative battles recorded.`;

    return {
      totalProxyNodes: input.proxyNodeCount,
      techLeader: input.techLeader,
      criticalResources: input.criticalResourceCount,
      sanctionedFactionCount: input.sanctionedFactions.length,
      narrativeBattles: input.narrativeBattleCount,
      summary,
    };
  }
}
