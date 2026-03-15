/**
 * Web State Gathering Engine — Test Suite
 *
 * 55+ tests covering all 11 pure functions:
 *  - initializeWebGatheringState
 *  - createGatheringQuery
 *  - createEnrichmentModel
 *  - validateEnrichmentModel
 *  - computeAggregateConfidence
 *  - filterEnrichmentModels
 *  - sortEnrichmentModels
 *  - buildApplicationPreview
 *  - processApplicationResult
 *  - buildGatheringPrompt
 *  - getStaleModels
 *
 * @see FR-4300 – FR-4304, DR-190
 */

import { describe, it, expect } from 'vitest';
import type {
  GatheringDimension,
  DataPoint,
  EnrichmentModel,
  GatheringQuery,
} from '@/data/types/web-gathering.types';
import { GATHERING_DIMENSIONS } from '@/data/types/web-gathering.types';
import {
  initializeWebGatheringState,
  createGatheringQuery,
  createEnrichmentModel,
  validateEnrichmentModel,
  computeAggregateConfidence,
  filterEnrichmentModels,
  sortEnrichmentModels,
  buildApplicationPreview,
  processApplicationResult,
  buildGatheringPrompt,
  getStaleModels,
} from '@/engine/web-gathering-engine';
import { webGatheringConfig } from '@/engine/config/web-gathering';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeDataPoint(overrides: Partial<DataPoint> = {}): DataPoint {
  return {
    key: 'gdp_growth',
    value: 3.2,
    unit: '%',
    source: 'https://worldbank.org',
    confidence: 0.85,
    ...overrides,
  };
}

function makeModel(overrides: Partial<EnrichmentModel> = {}): EnrichmentModel {
  return {
    id: 'enr_1700000000000_aabbccdd',
    dimension: 'economic',
    description: 'Q1 2026 Economic Snapshot',
    sourceUrls: ['https://worldbank.org', 'https://imf.org'],
    gatheringTimestamp: '2026-01-15T10:00:00.000Z',
    dataPoints: [makeDataPoint()],
    confidenceScore: 0.85,
    structuredPayload: {},
    appliedToScenarios: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeWebGatheringState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeWebGatheringState', () => {
  it('returns state with enabled = false by default', () => {
    const state = initializeWebGatheringState();
    expect(state.enabled).toBe(false);
  });

  it('includes all 5 gathering dimensions', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim]).toBeDefined();
    }
  });

  it('enables every dimension by default', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].enabled).toBe(true);
    }
  });

  it('sets lastGathered to null for every dimension', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].lastGathered).toBeNull();
    }
  });

  it('populates queryConfig with correct dimension', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].queryConfig.dimension).toBe(dim);
    }
  });

  it('uses config defaultMaxResults for each query', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].queryConfig.maxResults).toBe(
        webGatheringConfig.defaultMaxResults,
      );
    }
  });

  it('starts with empty enrichmentModels array', () => {
    const state = initializeWebGatheringState();
    expect(state.enrichmentModels).toEqual([]);
  });

  it('starts with empty activeGatherings array', () => {
    const state = initializeWebGatheringState();
    expect(state.activeGatherings).toEqual([]);
  });

  it('starts with lastFullGatheringTimestamp as null', () => {
    const state = initializeWebGatheringState();
    expect(state.lastFullGatheringTimestamp).toBeNull();
  });

  it('populates search terms from config for each dimension', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].queryConfig.searchTerms.length).toBeGreaterThan(0);
    }
  });

  it('populates data sources from config for each dimension', () => {
    const state = initializeWebGatheringState();
    for (const dim of GATHERING_DIMENSIONS) {
      expect(state.dimensions[dim].queryConfig.dataSources.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createGatheringQuery
// ═══════════════════════════════════════════════════════════════════════════

describe('createGatheringQuery', () => {
  it('builds query with correct dimension', () => {
    const q = createGatheringQuery('military');
    expect(q.dimension).toBe('military');
  });

  it('uses default search terms from config', () => {
    const q = createGatheringQuery('economic');
    expect(q.searchTerms).toEqual(
      expect.arrayContaining(webGatheringConfig.dimensions.economic.defaultSearchTerms),
    );
  });

  it('uses default data sources from config', () => {
    const q = createGatheringQuery('political');
    expect(q.dataSources.length).toBe(
      webGatheringConfig.dimensions.political.defaultDataSources.length,
    );
  });

  it('uses default maxResults from config', () => {
    const q = createGatheringQuery('technology');
    expect(q.maxResults).toBe(webGatheringConfig.defaultMaxResults);
  });

  it('applies searchTerms override', () => {
    const q = createGatheringQuery('diplomatic', { searchTerms: ['NATO expansion'] });
    expect(q.searchTerms).toEqual(['NATO expansion']);
  });

  it('applies maxResults override', () => {
    const q = createGatheringQuery('economic', { maxResults: 25 });
    expect(q.maxResults).toBe(25);
  });

  it('applies dataSources override', () => {
    const custom = [{ name: 'Custom', url: 'https://custom.com', description: 'Test', enabled: true }];
    const q = createGatheringQuery('military', { dataSources: custom });
    expect(q.dataSources).toEqual(custom);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — createEnrichmentModel
// ═══════════════════════════════════════════════════════════════════════════

describe('createEnrichmentModel', () => {
  it('generates id with enr_ prefix', () => {
    const model = createEnrichmentModel('economic', 'Test', [makeDataPoint()], ['https://x.com']);
    expect(model.id).toMatch(/^enr_\d+_[0-9a-f]{8}$/);
  });

  it('sets the correct dimension', () => {
    const model = createEnrichmentModel('military', 'Arms', [makeDataPoint()], ['https://x.com']);
    expect(model.dimension).toBe('military');
  });

  it('sets the description', () => {
    const model = createEnrichmentModel('economic', 'GDP Snapshot', [makeDataPoint()], []);
    expect(model.description).toBe('GDP Snapshot');
  });

  it('copies source URLs', () => {
    const urls = ['https://a.com', 'https://b.com'];
    const model = createEnrichmentModel('economic', 'Test', [makeDataPoint()], urls);
    expect(model.sourceUrls).toEqual(urls);
  });

  it('sets gatheringTimestamp as ISO string', () => {
    const model = createEnrichmentModel('economic', 'Test', [makeDataPoint()], []);
    expect(model.gatheringTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('copies data points', () => {
    const dp = [makeDataPoint(), makeDataPoint({ key: 'inflation' })];
    const model = createEnrichmentModel('economic', 'Test', dp, []);
    expect(model.dataPoints).toHaveLength(2);
  });

  it('computes aggregate confidence from data points', () => {
    const dp = [makeDataPoint({ confidence: 0.8 }), makeDataPoint({ confidence: 0.6 })];
    const model = createEnrichmentModel('economic', 'Test', dp, []);
    expect(model.confidenceScore).toBeGreaterThan(0);
    expect(model.confidenceScore).toBeLessThanOrEqual(1);
  });

  it('starts with empty appliedToScenarios', () => {
    const model = createEnrichmentModel('economic', 'Test', [makeDataPoint()], []);
    expect(model.appliedToScenarios).toEqual([]);
  });

  it('starts with empty structuredPayload', () => {
    const model = createEnrichmentModel('economic', 'Test', [makeDataPoint()], []);
    expect(model.structuredPayload).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — validateEnrichmentModel
// ═══════════════════════════════════════════════════════════════════════════

describe('validateEnrichmentModel', () => {
  it('returns valid for a well-formed model', () => {
    const result = validateEnrichmentModel(makeModel());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects model with empty id', () => {
    const result = validateEnrichmentModel(makeModel({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Model id is required');
  });

  it('rejects model with invalid dimension', () => {
    const result = validateEnrichmentModel(makeModel({ dimension: 'invalid' as GatheringDimension }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid or missing dimension');
  });

  it('rejects model with empty description', () => {
    const result = validateEnrichmentModel(makeModel({ description: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Description is required');
  });

  it('rejects model with empty timestamp', () => {
    const result = validateEnrichmentModel(makeModel({ gatheringTimestamp: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Gathering timestamp is required');
  });

  it('rejects model with no source URLs', () => {
    const result = validateEnrichmentModel(makeModel({ sourceUrls: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one source URL is required');
  });

  it('rejects model with no data points', () => {
    const result = validateEnrichmentModel(makeModel({ dataPoints: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one data point is required');
  });

  it('rejects model with confidence above 1', () => {
    const result = validateEnrichmentModel(makeModel({ confidenceScore: 1.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Confidence score must be a number between 0 and 1');
  });

  it('rejects model with negative confidence', () => {
    const result = validateEnrichmentModel(makeModel({ confidenceScore: -0.1 }));
    expect(result.valid).toBe(false);
  });

  it('reports data point with invalid confidence', () => {
    const result = validateEnrichmentModel(
      makeModel({ dataPoints: [makeDataPoint({ confidence: 2.0 })] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid confidence'))).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const result = validateEnrichmentModel(
      makeModel({ id: '', description: '', sourceUrls: [] }),
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — computeAggregateConfidence
// ═══════════════════════════════════════════════════════════════════════════

describe('computeAggregateConfidence', () => {
  it('returns 0 for empty array', () => {
    expect(computeAggregateConfidence([])).toBe(0);
  });

  it('returns the confidence itself for a single data point', () => {
    const result = computeAggregateConfidence([makeDataPoint({ confidence: 0.7 })]);
    expect(result).toBeCloseTo(0.7, 5);
  });

  it('weights higher confidence points more', () => {
    const low = makeDataPoint({ confidence: 0.2 });
    const high = makeDataPoint({ confidence: 0.9 });
    const result = computeAggregateConfidence([low, high]);
    // Weighted avg should be closer to 0.9 than 0.2
    expect(result).toBeGreaterThan(0.5);
  });

  it('returns value between 0 and 1 for mixed points', () => {
    const points = [
      makeDataPoint({ confidence: 0.3 }),
      makeDataPoint({ confidence: 0.6 }),
      makeDataPoint({ confidence: 0.9 }),
    ];
    const result = computeAggregateConfidence(points);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 0 when all confidences are 0', () => {
    const points = [
      makeDataPoint({ confidence: 0 }),
      makeDataPoint({ confidence: 0 }),
    ];
    expect(computeAggregateConfidence(points)).toBe(0);
  });

  it('returns 1 when all confidences are 1', () => {
    const points = [
      makeDataPoint({ confidence: 1 }),
      makeDataPoint({ confidence: 1 }),
    ];
    expect(computeAggregateConfidence(points)).toBeCloseTo(1, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — filterEnrichmentModels
// ═══════════════════════════════════════════════════════════════════════════

describe('filterEnrichmentModels', () => {
  const models: EnrichmentModel[] = [
    makeModel({ id: '1', dimension: 'economic', confidenceScore: 0.9 }),
    makeModel({ id: '2', dimension: 'military', confidenceScore: 0.5 }),
    makeModel({ id: '3', dimension: 'economic', confidenceScore: 0.3 }),
    makeModel({ id: '4', dimension: 'political', confidenceScore: 0.8 }),
  ];

  it('returns all models when no filters applied', () => {
    expect(filterEnrichmentModels(models)).toHaveLength(4);
  });

  it('filters by dimension', () => {
    const result = filterEnrichmentModels(models, 'economic');
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.dimension === 'economic')).toBe(true);
  });

  it('filters by minimum confidence', () => {
    const result = filterEnrichmentModels(models, undefined, 0.6);
    expect(result).toHaveLength(2);
    expect(result.every((m) => m.confidenceScore >= 0.6)).toBe(true);
  });

  it('combines dimension and confidence filters', () => {
    const result = filterEnrichmentModels(models, 'economic', 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no models match', () => {
    expect(filterEnrichmentModels(models, 'diplomatic')).toHaveLength(0);
  });

  it('handles empty input array', () => {
    expect(filterEnrichmentModels([])).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — sortEnrichmentModels
// ═══════════════════════════════════════════════════════════════════════════

describe('sortEnrichmentModels', () => {
  const models: EnrichmentModel[] = [
    makeModel({
      id: 'a',
      description: 'Bravo',
      dimension: 'military',
      confidenceScore: 0.5,
      gatheringTimestamp: '2026-02-01T00:00:00.000Z',
    }),
    makeModel({
      id: 'b',
      description: 'Alpha',
      dimension: 'economic',
      confidenceScore: 0.9,
      gatheringTimestamp: '2026-01-01T00:00:00.000Z',
    }),
    makeModel({
      id: 'c',
      description: 'Charlie',
      dimension: 'political',
      confidenceScore: 0.7,
      gatheringTimestamp: '2026-03-01T00:00:00.000Z',
    }),
  ];

  it('sorts by date ascending', () => {
    const result = sortEnrichmentModels(models, 'date', 'asc');
    expect(result[0].id).toBe('b');
    expect(result[2].id).toBe('c');
  });

  it('sorts by date descending', () => {
    const result = sortEnrichmentModels(models, 'date', 'desc');
    expect(result[0].id).toBe('c');
    expect(result[2].id).toBe('b');
  });

  it('sorts by confidence ascending', () => {
    const result = sortEnrichmentModels(models, 'confidence', 'asc');
    expect(result[0].confidenceScore).toBe(0.5);
    expect(result[2].confidenceScore).toBe(0.9);
  });

  it('sorts by confidence descending', () => {
    const result = sortEnrichmentModels(models, 'confidence', 'desc');
    expect(result[0].confidenceScore).toBe(0.9);
  });

  it('sorts by dimension ascending', () => {
    const result = sortEnrichmentModels(models, 'dimension', 'asc');
    expect(result[0].dimension).toBe('economic');
    expect(result[2].dimension).toBe('political');
  });

  it('sorts by dimension descending', () => {
    const result = sortEnrichmentModels(models, 'dimension', 'desc');
    expect(result[0].dimension).toBe('political');
  });

  it('sorts by description ascending', () => {
    const result = sortEnrichmentModels(models, 'description', 'asc');
    expect(result[0].description).toBe('Alpha');
    expect(result[2].description).toBe('Charlie');
  });

  it('sorts by description descending', () => {
    const result = sortEnrichmentModels(models, 'description', 'desc');
    expect(result[0].description).toBe('Charlie');
  });

  it('does not mutate the original array', () => {
    const original = [...models];
    sortEnrichmentModels(models, 'confidence', 'asc');
    expect(models.map((m) => m.id)).toEqual(original.map((m) => m.id));
  });

  it('handles empty array', () => {
    expect(sortEnrichmentModels([], 'date', 'asc')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildApplicationPreview
// ═══════════════════════════════════════════════════════════════════════════

describe('buildApplicationPreview', () => {
  const model = makeModel({
    dataPoints: [
      makeDataPoint({ key: 'gdp_growth' }),
      makeDataPoint({ key: 'inflation' }),
    ],
    confidenceScore: 0.75,
  });

  it('returns correct mode', () => {
    const preview = buildApplicationPreview(model, 'initialConditions');
    expect(preview.mode).toBe('initialConditions');
  });

  it('returns enrichment model id', () => {
    const preview = buildApplicationPreview(model, 'midGameEvent');
    expect(preview.enrichmentModelId).toBe(model.id);
  });

  it('returns dimension from model', () => {
    const preview = buildApplicationPreview(model, 'scenarioPreset');
    expect(preview.dimension).toBe('economic');
  });

  it('lists all data point keys as affected fields', () => {
    const preview = buildApplicationPreview(model, 'initialConditions');
    expect(preview.fieldsAffected).toEqual(['gdp_growth', 'inflation']);
  });

  it('generates summary including data point count', () => {
    const preview = buildApplicationPreview(model, 'initialConditions');
    expect(preview.summary).toContain('2 data point(s)');
  });

  it('generates summary including mode label for initialConditions', () => {
    const preview = buildApplicationPreview(model, 'initialConditions');
    expect(preview.summary).toContain('initial conditions');
  });

  it('generates summary including mode label for midGameEvent', () => {
    const preview = buildApplicationPreview(model, 'midGameEvent');
    expect(preview.summary).toContain('mid-game event');
  });

  it('generates summary including mode label for scenarioPreset', () => {
    const preview = buildApplicationPreview(model, 'scenarioPreset');
    expect(preview.summary).toContain('scenario preset');
  });

  it('includes confidence percentage in summary', () => {
    const preview = buildApplicationPreview(model, 'initialConditions');
    expect(preview.summary).toContain('75.0000%');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — processApplicationResult
// ═══════════════════════════════════════════════════════════════════════════

describe('processApplicationResult', () => {
  it('adds scenario to appliedToScenarios', () => {
    const updated = processApplicationResult(makeModel(), 'scenario_1', ['gdp_growth']);
    expect(updated.appliedToScenarios).toContain('scenario_1');
  });

  it('preserves existing applied scenarios', () => {
    const model = makeModel({ appliedToScenarios: ['existing_1'] });
    const updated = processApplicationResult(model, 'scenario_2', ['gdp_growth']);
    expect(updated.appliedToScenarios).toEqual(['existing_1', 'scenario_2']);
  });

  it('does not mutate the original model', () => {
    const model = makeModel();
    processApplicationResult(model, 'scenario_1', ['gdp_growth']);
    expect(model.appliedToScenarios).toEqual([]);
  });

  it('preserves all other model fields', () => {
    const model = makeModel();
    const updated = processApplicationResult(model, 'scenario_1', ['gdp_growth']);
    expect(updated.id).toBe(model.id);
    expect(updated.dimension).toBe(model.dimension);
    expect(updated.description).toBe(model.description);
    expect(updated.confidenceScore).toBe(model.confidenceScore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — buildGatheringPrompt
// ═══════════════════════════════════════════════════════════════════════════

describe('buildGatheringPrompt', () => {
  it('includes dimension label', () => {
    const query = createGatheringQuery('economic');
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain('Economic');
  });

  it('includes dimension description', () => {
    const query = createGatheringQuery('military');
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain(webGatheringConfig.dimensions.military.description);
  });

  it('includes all search terms', () => {
    const query = createGatheringQuery('political');
    const prompt = buildGatheringPrompt(query);
    for (const term of query.searchTerms) {
      expect(prompt).toContain(term);
    }
  });

  it('includes enabled data sources', () => {
    const query = createGatheringQuery('technology');
    const prompt = buildGatheringPrompt(query);
    for (const ds of query.dataSources.filter((d) => d.enabled)) {
      expect(prompt).toContain(ds.name);
    }
  });

  it('includes maxResults in prompt', () => {
    const query = createGatheringQuery('diplomatic', { maxResults: 15 });
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain('15');
  });

  it('mentions JSON response format', () => {
    const query = createGatheringQuery('economic');
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain('JSON');
  });

  it('mentions confidence in expected output', () => {
    const query = createGatheringQuery('economic');
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain('confidence');
  });

  it('excludes disabled data sources from listing', () => {
    const disabledSource = {
      name: 'DisabledSource',
      url: 'https://disabled.com',
      description: 'Should not appear',
      enabled: false,
    };
    const enabledSource = {
      name: 'EnabledSource',
      url: 'https://enabled.com',
      description: 'Should appear',
      enabled: true,
    };
    const query = createGatheringQuery('economic', {
      dataSources: [disabledSource, enabledSource],
    });
    const prompt = buildGatheringPrompt(query);
    expect(prompt).toContain('EnabledSource');
    expect(prompt).not.toContain('DisabledSource');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — getStaleModels
// ═══════════════════════════════════════════════════════════════════════════

describe('getStaleModels', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');

  it('returns models older than maxAgeDays', () => {
    const old = makeModel({ gatheringTimestamp: '2026-01-01T00:00:00.000Z' });
    const result = getStaleModels([old], 30, now);
    expect(result).toHaveLength(1);
  });

  it('excludes models newer than maxAgeDays', () => {
    const recent = makeModel({ gatheringTimestamp: '2026-02-28T00:00:00.000Z' });
    const result = getStaleModels([recent], 30, now);
    expect(result).toHaveLength(0);
  });

  it('handles mixed old and new models', () => {
    const old = makeModel({ id: 'old', gatheringTimestamp: '2025-12-01T00:00:00.000Z' });
    const recent = makeModel({ id: 'new', gatheringTimestamp: '2026-02-28T00:00:00.000Z' });
    const result = getStaleModels([old, recent], 30, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('old');
  });

  it('returns empty for empty input', () => {
    expect(getStaleModels([], 30, now)).toHaveLength(0);
  });

  it('returns all models when maxAgeDays is 0', () => {
    const models = [
      makeModel({ gatheringTimestamp: '2026-02-28T23:59:59.999Z' }),
    ];
    const result = getStaleModels(models, 0, now);
    expect(result).toHaveLength(1);
  });

  it('boundary: model exactly at cutoff is not stale', () => {
    // 30 days before now
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const model = makeModel({ gatheringTimestamp: cutoff.toISOString() });
    const result = getStaleModels([model], 30, now);
    expect(result).toHaveLength(0);
  });
});
