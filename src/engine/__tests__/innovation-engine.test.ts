/**
 * Future Innovations & Discovery System Engine — Test Suite
 *
 * 52 Vitest tests covering all 14 pure functions in innovation-engine.ts.
 *
 * @see FR-5101 — 70+ future innovation categories
 * @see FR-5104 — Innovation dependency chains
 * @see FR-5105 — Web crawling aggregation
 * @see FR-5106 — Innovation discovery events
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  initializeInnovationState,
  initializeResearchState,
  canResearch,
  advanceResearch,
  applyResearchDecay,
  rollForDiscovery,
  processDiscovery,
  buildDependencyGraph,
  validateDependencyChain,
  getInnovationsByCategory,
  getInnovationsByTier,
  computeDiscoveryProbability,
  adjustProbabilityFromRealWorld,
  getResearchSummary,
} from '@/engine/innovation-engine';
import type {
  InnovationModel,
  InnovationResearchState,
  InnovationCategory,
  InnovationTier,
} from '@/data/types/innovation.types';
import { innovationConfig } from '@/engine/config/innovation';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildTestInnovation(overrides: Partial<InnovationModel> = {}): InnovationModel {
  return {
    innovationId: 'test-innov-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Innovation',
    description: 'A test innovation for unit testing.',
    category: 'quantum' as InnovationCategory,
    tier: 1 as InnovationTier,
    dependencies: [],
    researchCost: 100,
    researchDuration: 4,
    discoveryProbability: 10,
    impactWeights: { military: 20, economy: 30 },
    multiOrderImpacts: [
      { order: 1 as const, dimension: 'military', description: 'Direct advantage', magnitude: 20 },
      { order: 2 as const, dimension: 'economy', description: 'Tech exports', magnitude: 15 },
    ],
    realWorldProgress: 50,
    prerequisites: {},
    ...overrides,
  };
}

function buildTestResearch(overrides: Partial<InnovationResearchState> = {}): InnovationResearchState {
  return {
    innovationId: 'test-innov',
    nationId: 'us',
    researchProgress: 0,
    fundingLevel: 100,
    turnsInvested: 0,
    discovered: false,
    discoveredAtTurn: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeInnovationState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeInnovationState', () => {
  it('builds state from innovation array', () => {
    const inno1 = buildTestInnovation({ innovationId: 'q-internet' });
    const inno2 = buildTestInnovation({ innovationId: 'mars-colony' });
    const state = initializeInnovationState([inno1, inno2]);
    expect(state.innovations['q-internet']).toBeDefined();
    expect(state.innovations['mars-colony']).toBeDefined();
  });

  it('starts with empty research and discovery log', () => {
    const state = initializeInnovationState([buildTestInnovation()]);
    expect(state.nationResearch).toEqual({});
    expect(state.discoveryLog).toEqual([]);
  });

  it('handles empty array', () => {
    const state = initializeInnovationState([]);
    expect(Object.keys(state.innovations)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — initializeResearchState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeResearchState', () => {
  it('creates a zeroed-out research state', () => {
    const rs = initializeResearchState('q-internet', 'us');
    expect(rs.innovationId).toBe('q-internet');
    expect(rs.nationId).toBe('us');
    expect(rs.researchProgress).toBe(0);
    expect(rs.discovered).toBe(false);
  });

  it('sets discoveredAtTurn to null', () => {
    const rs = initializeResearchState('x', 'eu');
    expect(rs.discoveredAtTurn).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — canResearch
// ═══════════════════════════════════════════════════════════════════════════

describe('canResearch', () => {
  it('returns true when no dependencies', () => {
    const innov = buildTestInnovation({ dependencies: [] });
    expect(canResearch(innov, {})).toBe(true);
  });

  it('returns false when dependency not discovered', () => {
    const innov = buildTestInnovation({ dependencies: ['dep-1'] });
    const research = { 'dep-1': buildTestResearch({ innovationId: 'dep-1', discovered: false }) };
    expect(canResearch(innov, research)).toBe(false);
  });

  it('returns true when dependency discovered', () => {
    const innov = buildTestInnovation({ dependencies: ['dep-1'] });
    const research = { 'dep-1': buildTestResearch({ innovationId: 'dep-1', discovered: true }) };
    expect(canResearch(innov, research)).toBe(true);
  });

  it('returns false when at max simultaneous research', () => {
    const innov = buildTestInnovation({ dependencies: [] });
    const research: Record<string, InnovationResearchState> = {};
    for (let i = 0; i < innovationConfig.research.maxSimultaneousResearch; i++) {
      research[`active-${i}`] = buildTestResearch({
        innovationId: `active-${i}`,
        researchProgress: 50,
        discovered: false,
      });
    }
    expect(canResearch(innov, research, innovationConfig.research.maxSimultaneousResearch)).toBe(false);
  });

  it('returns true when below max simultaneous', () => {
    const innov = buildTestInnovation({ dependencies: [] });
    expect(canResearch(innov, {}, 5)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — advanceResearch
// ═══════════════════════════════════════════════════════════════════════════

describe('advanceResearch', () => {
  it('increases progress based on funding', () => {
    const rs = buildTestResearch({ researchProgress: 0, fundingLevel: 100 });
    const result = advanceResearch(rs, 100);
    expect(result.researchProgress).toBeGreaterThan(0);
  });

  it('does not exceed 100', () => {
    const rs = buildTestResearch({ researchProgress: 98, fundingLevel: 100 });
    const result = advanceResearch(rs, 100);
    expect(result.researchProgress).toBeLessThanOrEqual(100);
  });

  it('increments turnsInvested', () => {
    const rs = buildTestResearch({ turnsInvested: 5 });
    const result = advanceResearch(rs, 100);
    expect(result.turnsInvested).toBe(6);
  });

  it('returns new object', () => {
    const rs = buildTestResearch();
    const result = advanceResearch(rs, 50);
    expect(result).not.toBe(rs);
  });

  it('scales progress with funding level', () => {
    const full = advanceResearch(buildTestResearch(), 100);
    const half = advanceResearch(buildTestResearch(), 50);
    expect(full.researchProgress).toBeGreaterThan(half.researchProgress);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — applyResearchDecay
// ═══════════════════════════════════════════════════════════════════════════

describe('applyResearchDecay', () => {
  it('decreases progress', () => {
    const rs = buildTestResearch({ researchProgress: 50 });
    const result = applyResearchDecay(rs);
    expect(result.researchProgress).toBeLessThan(50);
  });

  it('does not go below 0', () => {
    const rs = buildTestResearch({ researchProgress: 0.1 });
    const result = applyResearchDecay(rs);
    expect(result.researchProgress).toBeGreaterThanOrEqual(0);
  });

  it('returns new object', () => {
    const rs = buildTestResearch({ researchProgress: 50 });
    const result = applyResearchDecay(rs);
    expect(result).not.toBe(rs);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — rollForDiscovery
// ═══════════════════════════════════════════════════════════════════════════

describe('rollForDiscovery', () => {
  it('discovers when roll is below threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const rs = buildTestResearch({ researchProgress: 100 });
    const innov = buildTestInnovation({ discoveryProbability: 50 });
    const result = rollForDiscovery(rs, innov);
    expect(result.discovered).toBe(true);
  });

  it('does not discover when roll is above threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const rs = buildTestResearch({ researchProgress: 100 });
    const innov = buildTestInnovation({ discoveryProbability: 5 });
    const result = rollForDiscovery(rs, innov);
    expect(result.discovered).toBe(false);
  });

  it('returns roll and threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const rs = buildTestResearch({ researchProgress: 50 });
    const innov = buildTestInnovation({ discoveryProbability: 10 });
    const result = rollForDiscovery(rs, innov);
    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('threshold');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — processDiscovery
// ═══════════════════════════════════════════════════════════════════════════

describe('processDiscovery', () => {
  it('marks research as discovered', () => {
    const rs = buildTestResearch({ researchProgress: 100 });
    const innov = buildTestInnovation({ name: 'Quantum Internet' });
    const result = processDiscovery(rs, innov, 10, 'us');
    expect(result.research.discovered).toBe(true);
    expect(result.research.discoveredAtTurn).toBe(10);
  });

  it('generates event with headline', () => {
    const rs = buildTestResearch();
    const innov = buildTestInnovation({ name: 'Quantum Internet' });
    const result = processDiscovery(rs, innov, 5, 'eu');
    expect(result.event.headline).toBeTruthy();
    expect(result.event.nationId).toBe('eu');
    expect(result.event.turn).toBe(5);
  });

  it('includes innovation ID in event', () => {
    const innov = buildTestInnovation({ innovationId: 'q-net' });
    const rs = buildTestResearch({ innovationId: 'q-net' });
    const result = processDiscovery(rs, innov, 1, 'us');
    expect(result.event.innovationId).toBe('q-net');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildDependencyGraph
// ═══════════════════════════════════════════════════════════════════════════

describe('buildDependencyGraph', () => {
  it('builds graph with correct parent-child relationships', () => {
    const parent = buildTestInnovation({ innovationId: 'parent', dependencies: [] });
    const child = buildTestInnovation({ innovationId: 'child', dependencies: ['parent'] });
    const graph = buildDependencyGraph([parent, child], {});
    const parentNode = graph.find(n => n.innovationId === 'parent');
    const childNode = graph.find(n => n.innovationId === 'child');
    expect(parentNode!.children).toContain('child');
    expect(childNode!.parents).toContain('parent');
  });

  it('marks discovered innovations', () => {
    const innov = buildTestInnovation({ innovationId: 'disc' });
    const research = { disc: buildTestResearch({ innovationId: 'disc', discovered: true }) };
    const graph = buildDependencyGraph([innov], research);
    expect(graph[0].status).toBe('discovered');
  });

  it('marks locked innovations with unmet deps', () => {
    const innov = buildTestInnovation({ innovationId: 'locked', dependencies: ['missing'] });
    const graph = buildDependencyGraph([innov], {});
    expect(graph[0].status).toBe('locked');
  });

  it('handles empty array', () => {
    const graph = buildDependencyGraph([], {});
    expect(graph).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — validateDependencyChain
// ═══════════════════════════════════════════════════════════════════════════

describe('validateDependencyChain', () => {
  it('passes for valid chains', () => {
    const a = buildTestInnovation({ innovationId: 'a', dependencies: [] });
    const b = buildTestInnovation({ innovationId: 'b', dependencies: ['a'] });
    const result = validateDependencyChain([a, b]);
    expect(result.valid).toBe(true);
    expect(result.circularDeps).toHaveLength(0);
  });

  it('detects circular dependencies', () => {
    const a = buildTestInnovation({ innovationId: 'a', dependencies: ['b'] });
    const b = buildTestInnovation({ innovationId: 'b', dependencies: ['a'] });
    const result = validateDependencyChain([a, b]);
    expect(result.valid).toBe(false);
    expect(result.circularDeps.length).toBeGreaterThan(0);
  });

  it('passes for empty array', () => {
    const result = validateDependencyChain([]);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getInnovationsByCategory
// ═══════════════════════════════════════════════════════════════════════════

describe('getInnovationsByCategory', () => {
  it('filters by category', () => {
    const innovations: Record<string, InnovationModel> = {
      q: buildTestInnovation({ innovationId: 'q', category: 'quantum' }),
      s: buildTestInnovation({ innovationId: 's', category: 'space' }),
    };
    const result = getInnovationsByCategory(innovations, 'quantum');
    expect(result).toHaveLength(1);
    expect(result[0].innovationId).toBe('q');
  });

  it('returns empty for no matches', () => {
    const innovations: Record<string, InnovationModel> = {
      q: buildTestInnovation({ category: 'quantum' }),
    };
    expect(getInnovationsByCategory(innovations, 'biotech')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — getInnovationsByTier
// ═══════════════════════════════════════════════════════════════════════════

describe('getInnovationsByTier', () => {
  it('filters by tier', () => {
    const innovations: Record<string, InnovationModel> = {
      t1: buildTestInnovation({ innovationId: 't1', tier: 1 }),
      t3: buildTestInnovation({ innovationId: 't3', tier: 3 }),
    };
    const result = getInnovationsByTier(innovations, 1);
    expect(result).toHaveLength(1);
    expect(result[0].innovationId).toBe('t1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — computeDiscoveryProbability
// ═══════════════════════════════════════════════════════════════════════════

describe('computeDiscoveryProbability', () => {
  it('scales with funding', () => {
    const high = computeDiscoveryProbability(10, 100, 100, 50);
    const low = computeDiscoveryProbability(10, 100, 20, 50);
    expect(high).toBeGreaterThan(low);
  });

  it('caps at max chance', () => {
    const prob = computeDiscoveryProbability(100, 100, 100, 100);
    expect(prob).toBeLessThanOrEqual(innovationConfig.discovery.maxChancePerTurn);
  });

  it('returns at least base when funded', () => {
    const prob = computeDiscoveryProbability(5, 50, 50, 0);
    expect(prob).toBeGreaterThan(0);
  });

  it('considers real-world progress', () => {
    const withRW = computeDiscoveryProbability(10, 80, 100, 80);
    const withoutRW = computeDiscoveryProbability(10, 80, 100, 0);
    expect(withRW).not.toBe(withoutRW);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13 — adjustProbabilityFromRealWorld
// ═══════════════════════════════════════════════════════════════════════════

describe('adjustProbabilityFromRealWorld', () => {
  it('updates realWorldProgress', () => {
    const innov = buildTestInnovation({ realWorldProgress: 30 });
    const result = adjustProbabilityFromRealWorld(innov, 70);
    expect(result.realWorldProgress).toBe(70);
  });

  it('returns new object', () => {
    const innov = buildTestInnovation();
    const result = adjustProbabilityFromRealWorld(innov, 50);
    expect(result).not.toBe(innov);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14 — getResearchSummary
// ═══════════════════════════════════════════════════════════════════════════

describe('getResearchSummary', () => {
  it('counts correctly', () => {
    const research: Record<string, InnovationResearchState> = {
      a: buildTestResearch({ researchProgress: 50, discovered: false }),
      b: buildTestResearch({ researchProgress: 100, discovered: true }),
      c: buildTestResearch({ researchProgress: 0, discovered: false }),
    };
    const summary = getResearchSummary(research);
    expect(summary.total).toBe(3);
    expect(summary.discovered).toBe(1);
    expect(summary.inProgress).toBe(1);
  });

  it('handles empty research', () => {
    const summary = getResearchSummary({});
    expect(summary.total).toBe(0);
    expect(summary.discovered).toBe(0);
    expect(summary.inProgress).toBe(0);
  });
});
