/**
 * Model Loader Tests — CNFL-2902
 *
 * Unit tests for the model loader engine module.
 * Tests validation, loading, caching, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateModel,
  loadModel,
  loadModels,
  listModels,
  clearModelCache,
  clearCollectionCache,
  getCacheStats,
} from '@/engine/model-loader';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VALID_MBTI = {
  schemaVersion: '1.0.0',
  typeCode: 'INTJ',
  typeName: 'The Architect',
  cognitiveStack: ['Ni', 'Te', 'Fi', 'Se'],
  strengthDomains: ['strategic planning', 'systems thinking'],
  blindSpots: ['emotional sensitivity'],
  stressPattern: 'grip',
  decisionSpeed: 35,
  adaptability: 40,
  leadershipStyle: 'visionary',
  diplomaticApproach: 'pragmatic',
  conflictResponse: 'collaborate',
};

const VALID_POLITICAL = {
  schemaVersion: '1.0.0',
  systemId: 'liberal-democracy',
  systemName: 'Liberal Democracy',
  description: 'Representative democratic system with civil liberties.',
  decisionSpeedModifier: -20,
  stabilityBaseline: 12,
  civilLibertyIndex: 90,
  pressFreedomIndex: 85,
  corruptionBaseline: 25,
  successionRisk: 10,
  reformCapacity: 80,
};

const VALID_EQUIPMENT = {
  schemaVersion: '1.0.0',
  equipmentId: 'f-35a-lightning',
  name: 'F-35A Lightning II',
  category: 'air',
  description: 'Fifth-generation stealth multirole fighter.',
  purchaseCost: 80,
  maintenanceCostPerTurn: 8,
  attackPower: 78,
  defensePower: 60,
  buildTime: 6,
};

// ---------------------------------------------------------------------------
// validateModel
// ---------------------------------------------------------------------------

describe('validateModel', () => {
  it('validates a correct MBTI model', () => {
    const result = validateModel('mbti', VALID_MBTI);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates a correct political system model', () => {
    const result = validateModel('political-system', VALID_POLITICAL);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates a correct military equipment model', () => {
    const result = validateModel('military-equipment', VALID_EQUIPMENT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid MBTI typeCode', () => {
    const invalid = { ...VALID_MBTI, typeCode: 'ZZZZ' };
    const result = validateModel('mbti', invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects MBTI with decisionSpeed out of range', () => {
    const invalid = { ...VALID_MBTI, decisionSpeed: 999 };
    const result = validateModel('mbti', invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects MBTI with wrong number of cognitive functions', () => {
    const invalid = { ...VALID_MBTI, cognitiveStack: ['Ni', 'Te'] };
    const result = validateModel('mbti', invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects political system with civilLibertyIndex > 100', () => {
    const invalid = { ...VALID_POLITICAL, civilLibertyIndex: 150 };
    const result = validateModel('political-system', invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects equipment with invalid category', () => {
    const invalid = { ...VALID_EQUIPMENT, category: 'spaceship' };
    const result = validateModel('military-equipment', invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects equipment with zero purchaseCost', () => {
    const invalid = { ...VALID_EQUIPMENT, purchaseCost: 0 };
    const result = validateModel('military-equipment', invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects null data', () => {
    const result = validateModel('mbti', null);
    expect(result.valid).toBe(false);
  });

  it('rejects empty object', () => {
    const result = validateModel('mbti', {});
    expect(result.valid).toBe(false);
  });

  it('rejects MBTI with additional properties', () => {
    const invalid = { ...VALID_MBTI, extraField: 'not allowed' };
    const result = validateModel('mbti', invalid);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadModel (with mocked fetch)
// ---------------------------------------------------------------------------

describe('loadModel', () => {
  beforeEach(() => {
    clearModelCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and validates a valid MBTI model via fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_MBTI), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await loadModel('mbti', 'intj.json');
    expect(result.success).toBe(true);
    expect(result.data?.typeCode).toBe('INTJ');
    expect(result.source).toBe('/models/leaders/mbti/intj.json');
  });

  it('returns error for HTTP 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    const result = await loadModel('mbti', 'missing.json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });

  it('returns error for invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const result = await loadModel('mbti', 'bad.json');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when validation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ schemaVersion: '1.0.0', typeCode: 'XXXX' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await loadModel('mbti', 'invalid.json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('returns cached result on subsequent calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(VALID_MBTI), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await loadModel('mbti', 'intj.json');
    await loadModel('mbti', 'intj.json');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('respects custom basePath', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_MBTI), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await loadModel('mbti', 'intj.json', { basePath: '/custom/path' });
    expect(fetchSpy).toHaveBeenCalledWith('/custom/path/leaders/mbti/intj.json');
  });

  it('handles network errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await loadModel('mbti', 'intj.json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });
});

// ---------------------------------------------------------------------------
// loadModels (with mocked fetch)
// ---------------------------------------------------------------------------

describe('loadModels', () => {
  beforeEach(() => {
    clearModelCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads all models from a collection via manifest', async () => {
    const manifest = { files: ['intj.json', 'enfp.json'] };
    const intjModel = { ...VALID_MBTI, typeCode: 'INTJ' };
    const enfpModel = { ...VALID_MBTI, typeCode: 'ENFP', typeName: 'The Campaigner' };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(intjModel), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(enfpModel), { status: 200 }),
      );

    const { models, errors } = await loadModels('mbti');
    expect(models).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('returns error when manifest is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    const { models, errors } = await loadModels('mbti');
    expect(models).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.file).toBe('_manifest.json');
  });

  it('collects errors for individual failed models', async () => {
    const manifest = { files: ['good.json', 'bad.json'] };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_MBTI), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      );

    const { models, errors } = await loadModels('mbti');
    expect(models).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.file).toBe('bad.json');
  });
});

// ---------------------------------------------------------------------------
// listModels
// ---------------------------------------------------------------------------

describe('listModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns file list from manifest', async () => {
    const manifest = { files: ['intj.json', 'enfp.json', 'istp.json'] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(manifest), { status: 200 }),
    );

    const files = await listModels('mbti');
    expect(files).toEqual(['intj.json', 'enfp.json', 'istp.json']);
  });

  it('returns empty array when manifest not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const files = await listModels('mbti');
    expect(files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

describe('Cache management', () => {
  beforeEach(() => {
    clearModelCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clearModelCache empties all caches', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(VALID_MBTI), { status: 200 }),
    );

    await loadModel('mbti', 'intj.json');
    expect(getCacheStats().modelsCached).toBe(1);

    clearModelCache();
    expect(getCacheStats().modelsCached).toBe(0);
    expect(getCacheStats().collectionsCached).toBe(0);
  });

  it('clearCollectionCache only clears specific collection', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_MBTI), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_POLITICAL), { status: 200 }),
      );

    await loadModel('mbti', 'intj.json');
    await loadModel('political-system', 'liberal-democracy.json');
    expect(getCacheStats().modelsCached).toBe(2);

    clearCollectionCache('mbti');
    expect(getCacheStats().modelsCached).toBe(1);
  });

  it('getCacheStats returns accurate counts', () => {
    const stats = getCacheStats();
    expect(stats.collectionsCached).toBe(0);
    expect(stats.modelsCached).toBe(0);
    expect(stats.collections).toEqual({});
  });
});
