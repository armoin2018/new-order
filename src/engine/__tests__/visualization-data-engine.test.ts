import { describe, it, expect, beforeEach } from 'vitest';
import type { FactionId, TurnNumber } from '@/data/types';
import {
  VisualizationDataEngine,
  type ProxyNodeInput,
  type ProxyEdgeInput,
  type TechScoreInput,
  type ResourceSecurityInput,
  type SanctionsDataPoint,
  type NarrativeEventInput,
  type VisualizationSummaryInput,
} from '@/engine/visualization-data-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const faction = (id: string) => id as FactionId;
const turn = (n: number) => n as TurnNumber;

function makeNode(overrides: Partial<ProxyNodeInput> & { id: string }): ProxyNodeInput {
  return {
    factionId: faction('USA'),
    label: `Node ${overrides.id}`,
    strength: 50,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<ProxyEdgeInput> & { source: string; target: string }): ProxyEdgeInput {
  return {
    weight: 50,
    type: 'funding',
    ...overrides,
  };
}

function makeTechScore(overrides: Partial<TechScoreInput> & { factionId: FactionId }): TechScoreInput {
  return {
    techIndex: 50,
    domains: { cyber: 60, space: 40 },
    turn: turn(1),
    ...overrides,
  };
}

function makeResource(overrides: Partial<ResourceSecurityInput> = {}): ResourceSecurityInput {
  return {
    factionId: faction('USA'),
    resourceType: 'oil',
    supplyLevel: 50,
    demandLevel: 50,
    turn: turn(1),
    ...overrides,
  };
}

function makeSanctionsPoint(overrides: Partial<SanctionsDataPoint> = {}): SanctionsDataPoint {
  return {
    turn: turn(1),
    targetFaction: faction('RUS'),
    gdpImpact: -5,
    tradeImpact: -3,
    legitimacyImpact: -2,
    ...overrides,
  };
}

function makeNarrativeEvent(overrides: Partial<NarrativeEventInput> = {}): NarrativeEventInput {
  return {
    turn: turn(1),
    attacker: faction('USA'),
    defender: faction('RUS'),
    narrativeType: 'disinformation',
    legitimacyDelta: -5,
    successScore: 70,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VisualizationDataEngine', () => {
  let engine: VisualizationDataEngine;

  beforeEach(() => {
    engine = new VisualizationDataEngine();
  });

  // =========================================================================
  // CNFL-2804 — buildProxyNetworkGraph
  // =========================================================================

  describe('buildProxyNetworkGraph', () => {
    it('returns empty graph when given no nodes or edges', () => {
      const result = engine.buildProxyNetworkGraph({ nodes: [], edges: [] });
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.totalNodes).toBe(0);
      expect(result.totalEdges).toBe(0);
    });

    it('returns a single node with normalized strength of 1', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [makeNode({ id: 'A', strength: 80 })],
        edges: [],
      });
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].strength).toBe(80);
      expect(result.nodes[0].normalized).toBe(1);
      expect(result.totalNodes).toBe(1);
    });

    it('sorts nodes by strength descending', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [
          makeNode({ id: 'A', strength: 30 }),
          makeNode({ id: 'B', strength: 90 }),
          makeNode({ id: 'C', strength: 60 }),
        ],
        edges: [],
      });
      expect(result.nodes[0].id).toBe('B');
      expect(result.nodes[1].id).toBe('C');
      expect(result.nodes[2].id).toBe('A');
    });

    it('normalizes node strengths relative to the strongest node', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [
          makeNode({ id: 'A', strength: 100 }),
          makeNode({ id: 'B', strength: 50 }),
        ],
        edges: [],
      });
      expect(result.nodes[0].normalized).toBe(1);
      expect(result.nodes[1].normalized).toBeCloseTo(0.5);
    });

    it('caps nodes at proxyGraphMaxNodes (50)', () => {
      const maxNodes = GAME_CONFIG.visualization.proxyGraphMaxNodes; // 50
      const nodes: ProxyNodeInput[] = Array.from({ length: 70 }, (_, i) =>
        makeNode({ id: `N${i}`, strength: 70 - i }),
      );
      const result = engine.buildProxyNetworkGraph({ nodes, edges: [] });
      expect(result.nodes).toHaveLength(maxNodes);
      expect(result.totalNodes).toBe(maxNodes);
    });

    it('retains the strongest nodes when capping', () => {
      const nodes: ProxyNodeInput[] = Array.from({ length: 55 }, (_, i) =>
        makeNode({ id: `N${i}`, strength: 100 - i }),
      );
      const result = engine.buildProxyNetworkGraph({ nodes, edges: [] });
      // The weakest retained node should have strength 51 (index 49 → 100-49=51)
      expect(result.nodes[49].strength).toBe(51);
    });

    it('filters edges to only those connecting retained nodes', () => {
      const nodes: ProxyNodeInput[] = [
        makeNode({ id: 'A', strength: 90 }),
        makeNode({ id: 'B', strength: 80 }),
        makeNode({ id: 'C', strength: 10 }),
      ];
      // Create 55 filler nodes so C gets capped out
      const fillerNodes: ProxyNodeInput[] = Array.from({ length: 50 }, (_, i) =>
        makeNode({ id: `F${i}`, strength: 50 - (i * 0.5) }),
      );
      const allNodes = [...nodes, ...fillerNodes];
      const edges: ProxyEdgeInput[] = [
        makeEdge({ source: 'A', target: 'B', weight: 50 }),
        makeEdge({ source: 'A', target: 'C', weight: 30 }), // C will be capped out
      ];
      const result = engine.buildProxyNetworkGraph({ nodes: allNodes, edges });
      // Only the A→B edge should remain since C was capped
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('A');
      expect(result.edges[0].target).toBe('B');
    });

    it('normalizes edge weights relative to the heaviest edge', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [
          makeNode({ id: 'A', strength: 80 }),
          makeNode({ id: 'B', strength: 70 }),
          makeNode({ id: 'C', strength: 60 }),
        ],
        edges: [
          makeEdge({ source: 'A', target: 'B', weight: 100 }),
          makeEdge({ source: 'B', target: 'C', weight: 25 }),
        ],
      });
      expect(result.edges[0].normalized).toBe(1);
      expect(result.edges[1].normalized).toBeCloseTo(0.25);
    });

    it('preserves edge type in output', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [
          makeNode({ id: 'A', strength: 80 }),
          makeNode({ id: 'B', strength: 70 }),
        ],
        edges: [
          makeEdge({ source: 'A', target: 'B', weight: 50, type: 'intelligence' }),
        ],
      });
      expect(result.edges[0].type).toBe('intelligence');
    });

    it('provides a descriptive reason string', () => {
      const result = engine.buildProxyNetworkGraph({
        nodes: [makeNode({ id: 'A', strength: 50 })],
        edges: [],
      });
      expect(result.reason).toContain('1 nodes');
    });
  });

  // =========================================================================
  // CNFL-2804 — buildTechRaceDashboard
  // =========================================================================

  describe('buildTechRaceDashboard', () => {
    it('handles empty faction scores with gap of 0', () => {
      const result = engine.buildTechRaceDashboard({ factionScores: [] });
      expect(result.rankings).toHaveLength(0);
      expect(result.leaderScore).toBe(0);
      expect(result.gap).toBe(0);
    });

    it('returns a single faction as leader with gap 0', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [makeTechScore({ factionId: faction('CHN'), techIndex: 85 })],
      });
      expect(result.rankings).toHaveLength(1);
      expect(result.leader).toBe('CHN');
      expect(result.leaderScore).toBe(85);
      expect(result.gap).toBe(0);
    });

    it('sorts factions by techIndex descending and assigns 1-based ranks', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [
          makeTechScore({ factionId: faction('USA'), techIndex: 70 }),
          makeTechScore({ factionId: faction('CHN'), techIndex: 90 }),
          makeTechScore({ factionId: faction('RUS'), techIndex: 50 }),
        ],
      });
      expect(result.rankings[0].factionId).toBe('CHN');
      expect(result.rankings[0].rank).toBe(1);
      expect(result.rankings[1].factionId).toBe('USA');
      expect(result.rankings[1].rank).toBe(2);
      expect(result.rankings[2].factionId).toBe('RUS');
      expect(result.rankings[2].rank).toBe(3);
    });

    it('computes gap between leader and runner-up', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [
          makeTechScore({ factionId: faction('USA'), techIndex: 80 }),
          makeTechScore({ factionId: faction('CHN'), techIndex: 60 }),
        ],
      });
      expect(result.gap).toBe(20);
    });

    it('reports gap of 0 when leader and runner-up are tied', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [
          makeTechScore({ factionId: faction('USA'), techIndex: 75 }),
          makeTechScore({ factionId: faction('CHN'), techIndex: 75 }),
        ],
      });
      expect(result.gap).toBe(0);
    });

    it('preserves domain scores in output rankings', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [
          makeTechScore({
            factionId: faction('USA'),
            techIndex: 80,
            domains: { cyber: 90, space: 70 },
          }),
        ],
      });
      expect(result.rankings[0].domains).toEqual({ cyber: 90, space: 70 });
    });

    it('provides a descriptive reason string', () => {
      const result = engine.buildTechRaceDashboard({
        factionScores: [makeTechScore({ factionId: faction('USA'), techIndex: 80 })],
      });
      expect(result.reason).toContain('1 factions ranked');
      expect(result.reason).toContain('USA');
    });
  });

  // =========================================================================
  // CNFL-2804 — buildResourceSecurityMap
  // =========================================================================

  describe('buildResourceSecurityMap', () => {
    it('returns empty entries when no resources are provided', () => {
      const result = engine.buildResourceSecurityMap({ resources: [] });
      expect(result.entries).toHaveLength(0);
      expect(result.criticalCount).toBe(0);
    });

    it('computes securityRatio as (supply / demand) * 100 for normal values', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 50, demandLevel: 50 })],
      });
      expect(result.entries[0].securityRatio).toBeCloseTo(100);
    });

    it('flags supply below resourceCriticalThreshold (20) as critical', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 15, demandLevel: 50 })],
      });
      expect(result.entries[0].isCritical).toBe(true);
    });

    it('does not flag supply at exactly the threshold as critical', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 20, demandLevel: 50 })],
      });
      expect(result.entries[0].isCritical).toBe(false);
    });

    it('does not flag supply above threshold as critical', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 60, demandLevel: 50 })],
      });
      expect(result.entries[0].isCritical).toBe(false);
    });

    it('handles zero demand by treating divisor as 1', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 50, demandLevel: 0 })],
      });
      // (50 / max(0,1)) * 100 = 5000, clamped to 200
      expect(result.entries[0].securityRatio).toBe(200);
    });

    it('handles zero supply with non-zero demand', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 0, demandLevel: 50 })],
      });
      expect(result.entries[0].securityRatio).toBe(0);
      expect(result.entries[0].isCritical).toBe(true);
    });

    it('clamps securityRatio to a maximum of 200', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 100, demandLevel: 10 })],
      });
      // (100 / 10) * 100 = 1000, clamped to 200
      expect(result.entries[0].securityRatio).toBe(200);
    });

    it('counts all critical entries correctly', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [
          makeResource({ supplyLevel: 10, demandLevel: 50 }),
          makeResource({ supplyLevel: 5, demandLevel: 30 }),
          makeResource({ supplyLevel: 60, demandLevel: 40 }),
        ],
      });
      expect(result.criticalCount).toBe(2);
    });

    it('provides a descriptive reason string', () => {
      const result = engine.buildResourceSecurityMap({
        resources: [makeResource({ supplyLevel: 10, demandLevel: 50 })],
      });
      expect(result.reason).toContain('1 entries assessed');
      expect(result.reason).toContain('1 critical');
    });
  });

  // =========================================================================
  // CNFL-2804 — buildSanctionsTimeline
  // =========================================================================

  describe('buildSanctionsTimeline', () => {
    it('returns empty timeline when no data points are provided', () => {
      const result = engine.buildSanctionsTimeline({ dataPoints: [] });
      expect(result.timeline).toHaveLength(0);
      expect(result.totalPoints).toBe(0);
      expect(result.peakGdpImpactTurn).toBeNull();
    });

    it('returns all points when fewer than sanctionsTimelineMaxPoints (60)', () => {
      const points = Array.from({ length: 10 }, (_, i) =>
        makeSanctionsPoint({ turn: turn(i + 1), gdpImpact: -(i + 1) }),
      );
      const result = engine.buildSanctionsTimeline({ dataPoints: points });
      expect(result.timeline).toHaveLength(10);
      expect(result.totalPoints).toBe(10);
    });

    it('sorts timeline by turn ascending', () => {
      const result = engine.buildSanctionsTimeline({
        dataPoints: [
          makeSanctionsPoint({ turn: turn(5), gdpImpact: -2 }),
          makeSanctionsPoint({ turn: turn(1), gdpImpact: -1 }),
          makeSanctionsPoint({ turn: turn(3), gdpImpact: -3 }),
        ],
      });
      expect(result.timeline[0].turn).toBe(1);
      expect(result.timeline[1].turn).toBe(3);
      expect(result.timeline[2].turn).toBe(5);
    });

    it('caps at sanctionsTimelineMaxPoints (60) keeping most recent', () => {
      const maxPoints = GAME_CONFIG.visualization.sanctionsTimelineMaxPoints; // 60
      const points = Array.from({ length: 80 }, (_, i) =>
        makeSanctionsPoint({ turn: turn(i + 1), gdpImpact: -1 }),
      );
      const result = engine.buildSanctionsTimeline({ dataPoints: points });
      expect(result.timeline).toHaveLength(maxPoints);
      expect(result.totalPoints).toBe(maxPoints);
      // Should keep turns 21–80 (most recent 60)
      expect(result.timeline[0].turn).toBe(21);
      expect(result.timeline[result.timeline.length - 1].turn).toBe(80);
    });

    it('identifies the turn with the worst (most negative) GDP impact', () => {
      const result = engine.buildSanctionsTimeline({
        dataPoints: [
          makeSanctionsPoint({ turn: turn(1), gdpImpact: -2 }),
          makeSanctionsPoint({ turn: turn(2), gdpImpact: -10 }),
          makeSanctionsPoint({ turn: turn(3), gdpImpact: -5 }),
        ],
      });
      expect(result.peakGdpImpactTurn).toBe(2);
    });

    it('picks the first turn in iteration order when multiple turns share the worst GDP', () => {
      const result = engine.buildSanctionsTimeline({
        dataPoints: [
          makeSanctionsPoint({ turn: turn(3), gdpImpact: -10 }),
          makeSanctionsPoint({ turn: turn(7), gdpImpact: -10 }),
        ],
      });
      // Sorted ascending: turn 3 comes first, so it should be the peak
      expect(result.peakGdpImpactTurn).toBe(3);
    });

    it('provides a descriptive reason string', () => {
      const result = engine.buildSanctionsTimeline({
        dataPoints: [makeSanctionsPoint({ turn: turn(1), gdpImpact: -5 })],
      });
      expect(result.reason).toContain('1 data points');
      expect(result.reason).toContain('Worst GDP impact on turn 1');
    });
  });

  // =========================================================================
  // CNFL-2804 — buildNarrativeBattleReplay
  // =========================================================================

  describe('buildNarrativeBattleReplay', () => {
    it('returns empty replay when no events are provided', () => {
      const result = engine.buildNarrativeBattleReplay({ events: [] });
      expect(result.entries).toHaveLength(0);
      expect(result.totalBattles).toBe(0);
      expect(result.topAttacker).toBeNull();
      expect(result.topDefender).toBeNull();
    });

    it('returns a single event with correct attacker and defender', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [makeNarrativeEvent({ attacker: faction('USA'), defender: faction('RUS') })],
      });
      expect(result.entries).toHaveLength(1);
      expect(result.totalBattles).toBe(1);
      expect(result.topAttacker).toBe('USA');
      expect(result.topDefender).toBe('RUS');
    });

    it('preserves event fields in output entries', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [
          makeNarrativeEvent({
            turn: turn(5),
            attacker: faction('CHN'),
            defender: faction('USA'),
            narrativeType: 'propaganda',
            legitimacyDelta: -8,
            successScore: 90,
          }),
        ],
      });
      const entry = result.entries[0];
      expect(entry.turn).toBe(5);
      expect(entry.attacker).toBe('CHN');
      expect(entry.defender).toBe('USA');
      expect(entry.narrativeType).toBe('propaganda');
      expect(entry.legitimacyDelta).toBe(-8);
      expect(entry.successScore).toBe(90);
    });

    it('caps at narrativeReplayMaxEntries (100)', () => {
      const maxEntries = GAME_CONFIG.visualization.narrativeReplayMaxEntries; // 100
      const events = Array.from({ length: 120 }, (_, i) =>
        makeNarrativeEvent({ turn: turn(i + 1) }),
      );
      const result = engine.buildNarrativeBattleReplay({ events });
      expect(result.entries).toHaveLength(maxEntries);
      expect(result.totalBattles).toBe(maxEntries);
    });

    it('identifies the top attacker by count', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [
          makeNarrativeEvent({ attacker: faction('USA'), defender: faction('RUS') }),
          makeNarrativeEvent({ attacker: faction('USA'), defender: faction('CHN') }),
          makeNarrativeEvent({ attacker: faction('CHN'), defender: faction('USA') }),
        ],
      });
      expect(result.topAttacker).toBe('USA');
    });

    it('identifies the top defender by count', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [
          makeNarrativeEvent({ attacker: faction('USA'), defender: faction('RUS') }),
          makeNarrativeEvent({ attacker: faction('CHN'), defender: faction('RUS') }),
          makeNarrativeEvent({ attacker: faction('RUS'), defender: faction('USA') }),
        ],
      });
      expect(result.topDefender).toBe('RUS');
    });

    it('handles multiple factions with distinct top attacker and defender', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [
          makeNarrativeEvent({ attacker: faction('CHN'), defender: faction('USA') }),
          makeNarrativeEvent({ attacker: faction('CHN'), defender: faction('USA') }),
          makeNarrativeEvent({ attacker: faction('CHN'), defender: faction('RUS') }),
          makeNarrativeEvent({ attacker: faction('RUS'), defender: faction('USA') }),
        ],
      });
      expect(result.topAttacker).toBe('CHN');
      expect(result.topDefender).toBe('USA');
    });

    it('provides a descriptive reason string', () => {
      const result = engine.buildNarrativeBattleReplay({
        events: [makeNarrativeEvent()],
      });
      expect(result.reason).toContain('1 entries');
    });
  });

  // =========================================================================
  // CNFL-2804 — computeVisualizationSummary
  // =========================================================================

  describe('computeVisualizationSummary', () => {
    it('returns correct counts for a normal summary', () => {
      const input: VisualizationSummaryInput = {
        proxyNodeCount: 25,
        techLeader: faction('USA'),
        criticalResourceCount: 3,
        sanctionedFactions: [faction('RUS'), faction('IRN')],
        narrativeBattleCount: 15,
      };
      const result = engine.computeVisualizationSummary(input);
      expect(result.totalProxyNodes).toBe(25);
      expect(result.techLeader).toBe('USA');
      expect(result.criticalResources).toBe(3);
      expect(result.sanctionedFactionCount).toBe(2);
      expect(result.narrativeBattles).toBe(15);
    });

    it('handles zero counts across all fields', () => {
      const input: VisualizationSummaryInput = {
        proxyNodeCount: 0,
        techLeader: faction('USA'),
        criticalResourceCount: 0,
        sanctionedFactions: [],
        narrativeBattleCount: 0,
      };
      const result = engine.computeVisualizationSummary(input);
      expect(result.totalProxyNodes).toBe(0);
      expect(result.criticalResources).toBe(0);
      expect(result.sanctionedFactionCount).toBe(0);
      expect(result.narrativeBattles).toBe(0);
    });

    it('counts multiple sanctioned factions correctly', () => {
      const input: VisualizationSummaryInput = {
        proxyNodeCount: 10,
        techLeader: faction('CHN'),
        criticalResourceCount: 1,
        sanctionedFactions: [faction('RUS'), faction('IRN'), faction('PRK')],
        narrativeBattleCount: 5,
      };
      const result = engine.computeVisualizationSummary(input);
      expect(result.sanctionedFactionCount).toBe(3);
    });

    it('includes tech leader in the summary string', () => {
      const input: VisualizationSummaryInput = {
        proxyNodeCount: 10,
        techLeader: faction('CHN'),
        criticalResourceCount: 2,
        sanctionedFactions: [faction('RUS')],
        narrativeBattleCount: 7,
      };
      const result = engine.computeVisualizationSummary(input);
      expect(result.summary).toContain('CHN');
    });

    it('includes all numeric counts in the summary string', () => {
      const input: VisualizationSummaryInput = {
        proxyNodeCount: 42,
        techLeader: faction('USA'),
        criticalResourceCount: 5,
        sanctionedFactions: [faction('RUS'), faction('IRN')],
        narrativeBattleCount: 20,
      };
      const result = engine.computeVisualizationSummary(input);
      expect(result.summary).toContain('42');
      expect(result.summary).toContain('5');
      expect(result.summary).toContain('2');
      expect(result.summary).toContain('20');
    });
  });
});
