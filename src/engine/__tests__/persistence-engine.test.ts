/**
 * Simulation Persistence Engine — Test Suite
 *
 * 55+ tests covering all 10 pure functions:
 *  - generateSimulationId
 *  - createSimulationMetadata
 *  - buildSaveManifest
 *  - buildRunningContext
 *  - shouldAutoSave
 *  - updateMetadataForSave
 *  - filterSimulations
 *  - sortSimulations
 *  - validateSaveIntegrity
 *  - formatContextMarkdown
 *
 * @see FR-4200 – FR-4205, DR-188, DR-189
 */

import { describe, it, expect } from 'vitest';
import type {
  SimulationId,
  SimulationMetadata,
  SimulationSaveManifest,
  AutoSaveConfig,
  RunningContextDocument,
} from '@/data/types/persistence.types';
import {
  generateSimulationId,
  createSimulationMetadata,
  buildSaveManifest,
  buildRunningContext,
  shouldAutoSave,
  updateMetadataForSave,
  filterSimulations,
  sortSimulations,
  validateSaveIntegrity,
  formatContextMarkdown,
} from '@/engine/persistence-engine';
import type { GameStateSummary, SimulationFilterQuery } from '@/engine/persistence-engine';
import { persistenceConfig } from '@/engine/config/persistence';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a SimulationMetadata for testing. */
function makeMeta(overrides: Partial<SimulationMetadata> = {}): SimulationMetadata {
  return {
    id: 'sim_1700000000000_aabbccdd' as SimulationId,
    name: 'Test Simulation',
    scenarioName: 'Cold War Redux',
    dateCreated: '2026-01-15T10:00:00.000Z',
    lastPlayed: '2026-01-15T12:00:00.000Z',
    currentTurn: 5,
    totalTurns: 60,
    playerFaction: 'us',
    status: 'active',
    compositeScore: 72,
    ...overrides,
  };
}

/** Build a minimal GameStateSummary. */
function makeGameState(overrides: Partial<GameStateSummary> = {}): GameStateSummary {
  return {
    currentTurn: 10,
    playerFaction: 'us',
    compositeScore: 65,
    stability: 70,
    treasury: 500,
    militaryReadiness: 80,
    diplomaticInfluence: 60,
    ...overrides,
  };
}

/** Default auto-save config for tests. */
const defaultAutoSave: AutoSaveConfig = {
  enabled: true,
  intervalTurns: 3,
  maxAutoSaves: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// 1 — generateSimulationId
// ═══════════════════════════════════════════════════════════════════════════

describe('generateSimulationId', () => {
  it('returns a string starting with "sim_"', () => {
    const id = generateSimulationId();
    expect(id).toMatch(/^sim_/);
  });

  it('contains a timestamp segment', () => {
    const id = generateSimulationId();
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    const ts = Number(parts[1]);
    expect(ts).toBeGreaterThan(0);
  });

  it('contains an 8-character hex suffix', () => {
    const id = generateSimulationId();
    const hex = id.split('_')[2];
    expect(hex).toMatch(/^[0-9a-f]{8}$/);
  });

  it('generates unique IDs across multiple calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateSimulationId()));
    expect(ids.size).toBe(50);
  });

  it('returns a branded SimulationId type (string at runtime)', () => {
    const id = generateSimulationId();
    expect(typeof id).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createSimulationMetadata
// ═══════════════════════════════════════════════════════════════════════════

describe('createSimulationMetadata', () => {
  it('creates metadata with all required fields', () => {
    const meta = createSimulationMetadata({
      name: 'My Game',
      scenarioName: 'Default',
      totalTurns: 50,
      playerFaction: 'china',
    });
    expect(meta.name).toBe('My Game');
    expect(meta.scenarioName).toBe('Default');
    expect(meta.totalTurns).toBe(50);
    expect(meta.playerFaction).toBe('china');
  });

  it('starts at turn 0 with score 0', () => {
    const meta = createSimulationMetadata({
      name: 'Fresh',
      scenarioName: 'S1',
      totalTurns: 30,
      playerFaction: 'us',
    });
    expect(meta.currentTurn).toBe(0);
    expect(meta.compositeScore).toBe(0);
  });

  it('sets status to "active" for a new simulation', () => {
    const meta = createSimulationMetadata({
      name: 'New',
      scenarioName: 'S1',
      totalTurns: 30,
      playerFaction: 'us',
    });
    expect(meta.status).toBe('active');
  });

  it('sets status to "forked" when parentSimulationId is provided', () => {
    const parentId = 'sim_123_abcdef00' as SimulationId;
    const meta = createSimulationMetadata({
      name: 'Fork',
      scenarioName: 'S1',
      totalTurns: 30,
      playerFaction: 'eu',
      parentSimulationId: parentId,
    });
    expect(meta.status).toBe('forked');
    expect(meta.parentSimulationId).toBe(parentId);
  });

  it('generates a unique id', () => {
    const meta = createSimulationMetadata({
      name: 'A',
      scenarioName: 'S',
      totalTurns: 10,
      playerFaction: 'us',
    });
    expect(meta.id).toMatch(/^sim_/);
  });

  it('sets dateCreated and lastPlayed to the same ISO timestamp', () => {
    const meta = createSimulationMetadata({
      name: 'Time Test',
      scenarioName: 'S1',
      totalTurns: 10,
      playerFaction: 'us',
    });
    expect(meta.dateCreated).toBe(meta.lastPlayed);
    // Should be a valid ISO string
    expect(new Date(meta.dateCreated).toISOString()).toBe(meta.dateCreated);
  });

  it('does not include parentSimulationId when not provided', () => {
    const meta = createSimulationMetadata({
      name: 'No Parent',
      scenarioName: 'S',
      totalTurns: 10,
      playerFaction: 'us',
    });
    expect(meta.parentSimulationId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — buildSaveManifest
// ═══════════════════════════════════════════════════════════════════════════

describe('buildSaveManifest', () => {
  it('includes the metadata in the manifest', () => {
    const meta = makeMeta();
    const manifest = buildSaveManifest(meta);
    expect(manifest.metadata).toBe(meta);
  });

  it('lists all files from the config', () => {
    const manifest = buildSaveManifest(makeMeta());
    const expected = Object.values(persistenceConfig.fileNames);
    expect(manifest.files).toEqual(expected);
  });

  it('includes gameState.json in the file list', () => {
    const manifest = buildSaveManifest(makeMeta());
    expect(manifest.files).toContain('gameState.json');
  });

  it('includes currentContext.md in the file list', () => {
    const manifest = buildSaveManifest(makeMeta());
    expect(manifest.files).toContain('currentContext.md');
  });

  it('includes manifest.json in the file list', () => {
    const manifest = buildSaveManifest(makeMeta());
    expect(manifest.files).toContain('manifest.json');
  });

  it('respects a custom config with different file names', () => {
    const customConfig = {
      ...persistenceConfig,
      fileNames: {
        gameState: 'state.json',
        turnHistory: 'turns.json',
        marketData: 'markets.json',
        aiDecisionLog: 'ai.json',
        budgetHistory: 'budget.json',
        currencyRecords: 'currency.json',
        contextDocument: 'context.md',
        manifest: 'meta.json',
      },
    } as const;
    const manifest = buildSaveManifest(makeMeta(), customConfig);
    expect(manifest.files).toContain('state.json');
    expect(manifest.files).not.toContain('gameState.json');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — buildRunningContext
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRunningContext', () => {
  it('populates all five sections', () => {
    const ctx = buildRunningContext(makeGameState(), ['Event A'], 'Analysis text');
    expect(ctx.sections.executiveSummary).toBeTruthy();
    expect(ctx.sections.recentEvents).toBeTruthy();
    expect(ctx.sections.keyMetrics).toBeTruthy();
    expect(ctx.sections.aiAnalysis).toBeTruthy();
    expect(ctx.sections.recommendations).toBeTruthy();
  });

  it('includes turn number in executive summary', () => {
    const ctx = buildRunningContext(makeGameState({ currentTurn: 7 }), [], '');
    expect(ctx.sections.executiveSummary).toContain('Turn 7');
  });

  it('includes player faction in executive summary', () => {
    const ctx = buildRunningContext(makeGameState({ playerFaction: 'china' }), [], '');
    expect(ctx.sections.executiveSummary).toContain('china');
  });

  it('formats recent events as bullet list', () => {
    const ctx = buildRunningContext(makeGameState(), ['War declared', 'Treaty signed'], '');
    expect(ctx.sections.recentEvents).toContain('- War declared');
    expect(ctx.sections.recentEvents).toContain('- Treaty signed');
  });

  it('shows placeholder when no recent events', () => {
    const ctx = buildRunningContext(makeGameState(), [], '');
    expect(ctx.sections.recentEvents).toContain('No recent events');
  });

  it('includes key metrics as a markdown table', () => {
    const ctx = buildRunningContext(makeGameState({ stability: 55 }), [], '');
    expect(ctx.sections.keyMetrics).toContain('| Stability | 55 |');
  });

  it('passes AI analysis through to the section', () => {
    const ctx = buildRunningContext(makeGameState(), [], 'Detailed analysis here');
    expect(ctx.sections.aiAnalysis).toBe('Detailed analysis here');
  });

  it('shows placeholder when AI analysis is empty', () => {
    const ctx = buildRunningContext(makeGameState(), [], '');
    expect(ctx.sections.aiAnalysis).toContain('No AI analysis');
  });

  it('sets lastUpdatedTurn to the current turn', () => {
    const ctx = buildRunningContext(makeGameState({ currentTurn: 12 }), [], '');
    expect(ctx.lastUpdatedTurn).toBe(12);
  });

  it('sets generatedAt to a valid ISO timestamp', () => {
    const ctx = buildRunningContext(makeGameState(), [], '');
    expect(new Date(ctx.generatedAt).toISOString()).toBe(ctx.generatedAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — shouldAutoSave
// ═══════════════════════════════════════════════════════════════════════════

describe('shouldAutoSave', () => {
  it('returns false on turn 0', () => {
    expect(shouldAutoSave(0, defaultAutoSave)).toBe(false);
  });

  it('returns false on turn 1 (not divisible by 3)', () => {
    expect(shouldAutoSave(1, defaultAutoSave)).toBe(false);
  });

  it('returns false on turn 2', () => {
    expect(shouldAutoSave(2, defaultAutoSave)).toBe(false);
  });

  it('returns true on turn 3', () => {
    expect(shouldAutoSave(3, defaultAutoSave)).toBe(true);
  });

  it('returns false on turn 4', () => {
    expect(shouldAutoSave(4, defaultAutoSave)).toBe(false);
  });

  it('returns true on turn 6', () => {
    expect(shouldAutoSave(6, defaultAutoSave)).toBe(true);
  });

  it('returns true on turn 9', () => {
    expect(shouldAutoSave(9, defaultAutoSave)).toBe(true);
  });

  it('returns false when auto-save is disabled', () => {
    expect(shouldAutoSave(3, { ...defaultAutoSave, enabled: false })).toBe(false);
  });

  it('returns false for negative turn numbers', () => {
    expect(shouldAutoSave(-1, defaultAutoSave)).toBe(false);
  });

  it('returns false when intervalTurns is 0', () => {
    expect(shouldAutoSave(5, { ...defaultAutoSave, intervalTurns: 0 })).toBe(false);
  });

  it('returns true every turn when intervalTurns is 1', () => {
    const config: AutoSaveConfig = { ...defaultAutoSave, intervalTurns: 1 };
    expect(shouldAutoSave(1, config)).toBe(true);
    expect(shouldAutoSave(2, config)).toBe(true);
    expect(shouldAutoSave(99, config)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — updateMetadataForSave
// ═══════════════════════════════════════════════════════════════════════════

describe('updateMetadataForSave', () => {
  it('updates currentTurn', () => {
    const updated = updateMetadataForSave(makeMeta(), 20, 85);
    expect(updated.currentTurn).toBe(20);
  });

  it('updates compositeScore', () => {
    const updated = updateMetadataForSave(makeMeta(), 10, 99);
    expect(updated.compositeScore).toBe(99);
  });

  it('updates lastPlayed to a new ISO timestamp', () => {
    const original = makeMeta();
    const updated = updateMetadataForSave(original, 10, 50);
    expect(updated.lastPlayed).not.toBe(original.lastPlayed);
    expect(new Date(updated.lastPlayed).toISOString()).toBe(updated.lastPlayed);
  });

  it('does not mutate the original metadata', () => {
    const original = makeMeta();
    const originalTurn = original.currentTurn;
    updateMetadataForSave(original, 20, 85);
    expect(original.currentTurn).toBe(originalTurn);
  });

  it('preserves all other metadata fields', () => {
    const original = makeMeta({ name: 'Keep Me', playerFaction: 'eu' });
    const updated = updateMetadataForSave(original, 15, 60);
    expect(updated.name).toBe('Keep Me');
    expect(updated.playerFaction).toBe('eu');
    expect(updated.id).toBe(original.id);
    expect(updated.scenarioName).toBe(original.scenarioName);
    expect(updated.dateCreated).toBe(original.dateCreated);
    expect(updated.status).toBe(original.status);
    expect(updated.totalTurns).toBe(original.totalTurns);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — filterSimulations
// ═══════════════════════════════════════════════════════════════════════════

describe('filterSimulations', () => {
  const sims: SimulationMetadata[] = [
    makeMeta({ name: 'Alpha Strike', playerFaction: 'us', status: 'active' }),
    makeMeta({ name: 'Beta Wave', playerFaction: 'china', status: 'completed' }),
    makeMeta({ name: 'Gamma Ray', playerFaction: 'us', status: 'paused' }),
    makeMeta({ name: 'Delta Force', playerFaction: 'russia', status: 'active' }),
    makeMeta({ name: 'alpha lowercase', playerFaction: 'eu', status: 'forked' }),
  ];

  it('returns all simulations when no query is provided', () => {
    expect(filterSimulations(sims)).toEqual(sims);
  });

  it('returns all simulations when query is undefined', () => {
    expect(filterSimulations(sims, undefined)).toEqual(sims);
  });

  it('filters by name (case-insensitive)', () => {
    const result = filterSimulations(sims, { name: 'alpha' });
    expect(result).toHaveLength(2);
  });

  it('filters by exact faction', () => {
    const result = filterSimulations(sims, { faction: 'us' });
    expect(result).toHaveLength(2);
  });

  it('filters by exact status', () => {
    const result = filterSimulations(sims, { status: 'active' });
    expect(result).toHaveLength(2);
  });

  it('combines name and faction filters', () => {
    const result = filterSimulations(sims, { name: 'alpha', faction: 'us' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Strike');
  });

  it('combines name and status filters', () => {
    const result = filterSimulations(sims, { name: 'alpha', status: 'forked' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('alpha lowercase');
  });

  it('combines all three filters', () => {
    const result = filterSimulations(sims, { name: 'delta', faction: 'russia', status: 'active' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Delta Force');
  });

  it('returns empty array when no simulations match', () => {
    const result = filterSimulations(sims, { name: 'nonexistent' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when filtering an empty list', () => {
    expect(filterSimulations([], { name: 'any' })).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const copy = [...sims];
    filterSimulations(sims, { faction: 'us' });
    expect(sims).toEqual(copy);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — sortSimulations
// ═══════════════════════════════════════════════════════════════════════════

describe('sortSimulations', () => {
  const sims: SimulationMetadata[] = [
    makeMeta({ name: 'Charlie', compositeScore: 50, currentTurn: 10, dateCreated: '2026-03-01T00:00:00.000Z' }),
    makeMeta({ name: 'Alpha', compositeScore: 90, currentTurn: 5, dateCreated: '2026-01-01T00:00:00.000Z' }),
    makeMeta({ name: 'Bravo', compositeScore: 70, currentTurn: 20, dateCreated: '2026-02-01T00:00:00.000Z' }),
  ];

  it('sorts by name ascending', () => {
    const sorted = sortSimulations(sims, 'name', 'asc');
    expect(sorted[0].name).toBe('Alpha');
    expect(sorted[1].name).toBe('Bravo');
    expect(sorted[2].name).toBe('Charlie');
  });

  it('sorts by name descending', () => {
    const sorted = sortSimulations(sims, 'name', 'desc');
    expect(sorted[0].name).toBe('Charlie');
    expect(sorted[2].name).toBe('Alpha');
  });

  it('sorts by compositeScore ascending', () => {
    const sorted = sortSimulations(sims, 'compositeScore', 'asc');
    expect(sorted[0].compositeScore).toBe(50);
    expect(sorted[2].compositeScore).toBe(90);
  });

  it('sorts by compositeScore descending', () => {
    const sorted = sortSimulations(sims, 'compositeScore', 'desc');
    expect(sorted[0].compositeScore).toBe(90);
    expect(sorted[2].compositeScore).toBe(50);
  });

  it('sorts by currentTurn ascending', () => {
    const sorted = sortSimulations(sims, 'currentTurn', 'asc');
    expect(sorted[0].currentTurn).toBe(5);
    expect(sorted[2].currentTurn).toBe(20);
  });

  it('sorts by dateCreated ascending', () => {
    const sorted = sortSimulations(sims, 'dateCreated', 'asc');
    expect(sorted[0].dateCreated).toBe('2026-01-01T00:00:00.000Z');
    expect(sorted[2].dateCreated).toBe('2026-03-01T00:00:00.000Z');
  });

  it('sorts by dateCreated descending', () => {
    const sorted = sortSimulations(sims, 'dateCreated', 'desc');
    expect(sorted[0].dateCreated).toBe('2026-03-01T00:00:00.000Z');
  });

  it('defaults to ascending when direction is not specified', () => {
    const sorted = sortSimulations(sims, 'name');
    expect(sorted[0].name).toBe('Alpha');
  });

  it('does not mutate the original array', () => {
    const copy = [...sims];
    sortSimulations(sims, 'name', 'asc');
    expect(sims).toEqual(copy);
  });

  it('handles empty array', () => {
    expect(sortSimulations([], 'name', 'asc')).toEqual([]);
  });

  it('handles single-element array', () => {
    const single = [makeMeta({ name: 'Only' })];
    const sorted = sortSimulations(single, 'name', 'asc');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe('Only');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — validateSaveIntegrity
// ═══════════════════════════════════════════════════════════════════════════

describe('validateSaveIntegrity', () => {
  /** Build a valid manifest from defaults. */
  function makeValidManifest(): SimulationSaveManifest {
    return buildSaveManifest(makeMeta());
  }

  it('passes for a complete, valid manifest', () => {
    const result = validateSaveIntegrity(makeValidManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when metadata id is empty', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ id: '' as SimulationId }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('id')]));
  });

  it('fails when metadata name is empty', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ name: '' }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('name')]));
  });

  it('fails when currentTurn is negative', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ currentTurn: -1 }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('currentTurn')]));
  });

  it('fails when totalTurns is 0', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ totalTurns: 0 }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('totalTurns')]));
  });

  it('fails when totalTurns is negative', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ totalTurns: -5 }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
  });

  it('fails when files array is empty', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta(),
      files: [],
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('no files')]));
  });

  it('fails when a required file is missing', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta(),
      files: ['gameState.json', 'turnHistory.json'], // incomplete
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing required file'))).toBe(true);
  });

  it('reports all missing files individually', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta(),
      files: ['gameState.json'],
    };
    const result = validateSaveIntegrity(manifest);
    // Should report at least the 7 missing files
    const missingErrors = result.errors.filter((e) => e.includes('Missing required file'));
    expect(missingErrors.length).toBeGreaterThanOrEqual(7);
  });

  it('accumulates multiple errors', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ name: '', totalTurns: 0 }),
      files: [],
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('passes when currentTurn is 0 (initial save)', () => {
    const manifest: SimulationSaveManifest = {
      metadata: makeMeta({ currentTurn: 0 }),
      files: Object.values(persistenceConfig.fileNames),
    };
    const result = validateSaveIntegrity(manifest);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — formatContextMarkdown
// ═══════════════════════════════════════════════════════════════════════════

describe('formatContextMarkdown', () => {
  const sampleContext: RunningContextDocument = {
    sections: {
      executiveSummary: 'Turn 5 overview',
      recentEvents: '- Event 1\n- Event 2',
      keyMetrics: '| Metric | Value |\n|--------|-------|\n| Score | 72 |',
      aiAnalysis: 'AI recommends diplomacy.',
      recommendations: 'Focus on alliances.',
    },
    lastUpdatedTurn: 5,
    generatedAt: '2026-01-15T12:00:00.000Z',
  };

  it('starts with a level-1 heading containing the turn number', () => {
    const md = formatContextMarkdown(sampleContext);
    expect(md).toMatch(/^# Simulation Context — Turn 5/);
  });

  it('includes the generatedAt timestamp', () => {
    const md = formatContextMarkdown(sampleContext);
    expect(md).toContain('2026-01-15T12:00:00.000Z');
  });

  it('includes all five section headings', () => {
    const md = formatContextMarkdown(sampleContext);
    expect(md).toContain('## Executive Summary');
    expect(md).toContain('## Recent Events');
    expect(md).toContain('## Key Metrics');
    expect(md).toContain('## AI Analysis');
    expect(md).toContain('## Recommendations');
  });

  it('includes section content', () => {
    const md = formatContextMarkdown(sampleContext);
    expect(md).toContain('Turn 5 overview');
    expect(md).toContain('- Event 1');
    expect(md).toContain('AI recommends diplomacy.');
    expect(md).toContain('Focus on alliances.');
  });

  it('orders sections correctly (executive summary first, recommendations last)', () => {
    const md = formatContextMarkdown(sampleContext);
    const execIdx = md.indexOf('## Executive Summary');
    const recIdx = md.indexOf('## Recommendations');
    expect(execIdx).toBeLessThan(recIdx);
  });

  it('ends with a trailing newline', () => {
    const md = formatContextMarkdown(sampleContext);
    expect(md.endsWith('\n')).toBe(true);
  });
});
