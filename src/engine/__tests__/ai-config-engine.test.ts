import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDefaultAIConfig,
  validateAIConfig,
  sanitizeConfigForExport,
  mergeImportedConfig,
  parseOllamaModelsResponse,
  buildOllamaTagsUrl,
  createConnectionTestResult,
} from '@/engine/ai-config-engine';
import { aiConfigConfig } from '@/engine/config/ai-config';
import type {
  PersistedAIConfig,
  SanitizedAIConfig,
  AIProviderId,
} from '@/data/types/ai-config.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a full valid PersistedAIConfig for testing. */
function makeConfig(overrides: Partial<PersistedAIConfig> = {}): PersistedAIConfig {
  return {
    provider: 'openai',
    model: 'gpt-4o',
    baseUrl: '',
    apiKey: 'sk-test-key-12345',
    temperature: 0.7,
    maxTokens: 2048,
    budgetPerTurn: 0.10,
    budgetPerSession: 5.00,
    perDimensionPromptPaths: {},
    ollamaDetectedModels: [],
    lastConnectionTest: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createDefaultAIConfig
// ---------------------------------------------------------------------------

describe('createDefaultAIConfig', () => {
  it('returns an object with the correct provider default', () => {
    const cfg = createDefaultAIConfig();
    expect(cfg.provider).toBe(aiConfigConfig.defaults.provider);
  });

  it('returns the correct default model', () => {
    expect(createDefaultAIConfig().model).toBe('gpt-4o');
  });

  it('has an empty apiKey', () => {
    expect(createDefaultAIConfig().apiKey).toBe('');
  });

  it('has an empty baseUrl', () => {
    expect(createDefaultAIConfig().baseUrl).toBe('');
  });

  it('has default temperature of 0.7', () => {
    expect(createDefaultAIConfig().temperature).toBe(0.7);
  });

  it('has default maxTokens of 2048', () => {
    expect(createDefaultAIConfig().maxTokens).toBe(2048);
  });

  it('has correct budgetPerTurn', () => {
    expect(createDefaultAIConfig().budgetPerTurn).toBe(0.10);
  });

  it('has correct budgetPerSession', () => {
    expect(createDefaultAIConfig().budgetPerSession).toBe(5.00);
  });

  it('starts with empty perDimensionPromptPaths', () => {
    expect(createDefaultAIConfig().perDimensionPromptPaths).toEqual({});
  });

  it('starts with empty ollamaDetectedModels', () => {
    expect(createDefaultAIConfig().ollamaDetectedModels).toEqual([]);
  });

  it('starts with null lastConnectionTest', () => {
    expect(createDefaultAIConfig().lastConnectionTest).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateAIConfig
// ---------------------------------------------------------------------------

describe('validateAIConfig', () => {
  it('accepts a fully valid config', () => {
    const result = validateAIConfig(makeConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing provider', () => {
    const result = validateAIConfig({ model: 'gpt-4o' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('provider is required');
  });

  it('rejects invalid provider string', () => {
    const result = validateAIConfig({ provider: 'deepseek' as AIProviderId, model: 'x' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('provider must be one of'))).toBe(true);
  });

  it('rejects missing model', () => {
    const result = validateAIConfig({ provider: 'openai' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('model is required');
  });

  it('rejects empty model string', () => {
    const result = validateAIConfig({ provider: 'openai', model: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('model is required');
  });

  it('rejects temperature below 0', () => {
    const result = validateAIConfig(makeConfig({ temperature: -0.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('temperature'))).toBe(true);
  });

  it('rejects temperature above 2', () => {
    const result = validateAIConfig(makeConfig({ temperature: 2.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('temperature'))).toBe(true);
  });

  it('accepts temperature at boundary 0', () => {
    const result = validateAIConfig(makeConfig({ temperature: 0 }));
    expect(result.valid).toBe(true);
  });

  it('accepts temperature at boundary 2', () => {
    const result = validateAIConfig(makeConfig({ temperature: 2 }));
    expect(result.valid).toBe(true);
  });

  it('rejects maxTokens of 0', () => {
    const result = validateAIConfig(makeConfig({ maxTokens: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maxTokens'))).toBe(true);
  });

  it('rejects negative maxTokens', () => {
    const result = validateAIConfig(makeConfig({ maxTokens: -10 }));
    expect(result.valid).toBe(false);
  });

  it('rejects negative budgetPerTurn', () => {
    const result = validateAIConfig(makeConfig({ budgetPerTurn: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('budgetPerTurn'))).toBe(true);
  });

  it('rejects negative budgetPerSession', () => {
    const result = validateAIConfig(makeConfig({ budgetPerSession: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('budgetPerSession'))).toBe(true);
  });

  it('requires apiKey for openai provider', () => {
    const result = validateAIConfig({ provider: 'openai', model: 'gpt-4o', apiKey: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('apiKey is required'))).toBe(true);
  });

  it('requires apiKey for gemini provider', () => {
    const result = validateAIConfig({ provider: 'gemini', model: 'gemini-2.0-flash', apiKey: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('apiKey is required'))).toBe(true);
  });

  it('requires apiKey for claude provider', () => {
    const result = validateAIConfig({ provider: 'claude', model: 'claude-sonnet-4-20250514', apiKey: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('apiKey is required'))).toBe(true);
  });

  it('requires apiKey for openrouter provider', () => {
    const result = validateAIConfig({ provider: 'openrouter', model: 'openai/gpt-4o', apiKey: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('apiKey is required'))).toBe(true);
  });

  it('does NOT require apiKey for ollama provider', () => {
    const result = validateAIConfig({ provider: 'ollama', model: 'llama3.2', apiKey: '' });
    expect(result.valid).toBe(true);
  });

  it('can report multiple errors at once', () => {
    const result = validateAIConfig({ temperature: -1, maxTokens: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // provider, model, temperature, maxTokens
  });
});

// ---------------------------------------------------------------------------
// sanitizeConfigForExport
// ---------------------------------------------------------------------------

describe('sanitizeConfigForExport', () => {
  it('redacts the API key', () => {
    const sanitized = sanitizeConfigForExport(makeConfig());
    expect(sanitized.apiKey).toBe('[REDACTED]');
  });

  it('preserves the provider', () => {
    const sanitized = sanitizeConfigForExport(makeConfig({ provider: 'claude' }));
    expect(sanitized.provider).toBe('claude');
  });

  it('preserves the model', () => {
    const sanitized = sanitizeConfigForExport(makeConfig({ model: 'custom-model' }));
    expect(sanitized.model).toBe('custom-model');
  });

  it('preserves temperature', () => {
    const sanitized = sanitizeConfigForExport(makeConfig({ temperature: 1.2 }));
    expect(sanitized.temperature).toBe(1.2);
  });

  it('preserves maxTokens', () => {
    const sanitized = sanitizeConfigForExport(makeConfig({ maxTokens: 4096 }));
    expect(sanitized.maxTokens).toBe(4096);
  });

  it('preserves budgetPerTurn and budgetPerSession', () => {
    const sanitized = sanitizeConfigForExport(makeConfig({ budgetPerTurn: 0.5, budgetPerSession: 10 }));
    expect(sanitized.budgetPerTurn).toBe(0.5);
    expect(sanitized.budgetPerSession).toBe(10);
  });

  it('preserves ollamaDetectedModels', () => {
    const models = [{ name: 'llama3.2', size: 1000, modifiedAt: '2025-01-01', digest: 'abc' }];
    const sanitized = sanitizeConfigForExport(makeConfig({ ollamaDetectedModels: models }));
    expect(sanitized.ollamaDetectedModels).toEqual(models);
  });

  it('preserves lastConnectionTest', () => {
    const test = {
      provider: 'openai' as const,
      timestamp: '2025-01-01T00:00:00Z',
      latencyMs: 150,
      status: 'pass' as const,
      modelAvailable: true,
    };
    const sanitized = sanitizeConfigForExport(makeConfig({ lastConnectionTest: test }));
    expect(sanitized.lastConnectionTest).toEqual(test);
  });
});

// ---------------------------------------------------------------------------
// mergeImportedConfig
// ---------------------------------------------------------------------------

describe('mergeImportedConfig', () => {
  it('preserves the current API key', () => {
    const current = makeConfig({ apiKey: 'my-secret-key' });
    const imported: SanitizedAIConfig = {
      ...sanitizeConfigForExport(makeConfig({ provider: 'gemini', model: 'gemini-2.0-flash' })),
    };
    const merged = mergeImportedConfig(current, imported);
    expect(merged.apiKey).toBe('my-secret-key');
  });

  it('adopts the imported provider', () => {
    const current = makeConfig();
    const imported = sanitizeConfigForExport(makeConfig({ provider: 'claude' }));
    const merged = mergeImportedConfig(current, imported);
    expect(merged.provider).toBe('claude');
  });

  it('adopts the imported model', () => {
    const current = makeConfig();
    const imported = sanitizeConfigForExport(makeConfig({ model: 'claude-sonnet-4-20250514' }));
    const merged = mergeImportedConfig(current, imported);
    expect(merged.model).toBe('claude-sonnet-4-20250514');
  });

  it('adopts imported temperature', () => {
    const current = makeConfig({ temperature: 0.7 });
    const imported = sanitizeConfigForExport(makeConfig({ temperature: 1.5 }));
    const merged = mergeImportedConfig(current, imported);
    expect(merged.temperature).toBe(1.5);
  });

  it('adopts imported maxTokens', () => {
    const current = makeConfig({ maxTokens: 2048 });
    const imported = sanitizeConfigForExport(makeConfig({ maxTokens: 8192 }));
    const merged = mergeImportedConfig(current, imported);
    expect(merged.maxTokens).toBe(8192);
  });

  it('adopts imported budget values', () => {
    const current = makeConfig();
    const imported = sanitizeConfigForExport(makeConfig({ budgetPerTurn: 0.25, budgetPerSession: 10 }));
    const merged = mergeImportedConfig(current, imported);
    expect(merged.budgetPerTurn).toBe(0.25);
    expect(merged.budgetPerSession).toBe(10);
  });

  it('adopts imported perDimensionPromptPaths', () => {
    const current = makeConfig();
    const imported = sanitizeConfigForExport(
      makeConfig({ perDimensionPromptPaths: { military: '/prompts/mil.md' } }),
    );
    const merged = mergeImportedConfig(current, imported);
    expect(merged.perDimensionPromptPaths).toEqual({ military: '/prompts/mil.md' });
  });
});

// ---------------------------------------------------------------------------
// parseOllamaModelsResponse
// ---------------------------------------------------------------------------

describe('parseOllamaModelsResponse', () => {
  it('parses a valid Ollama /api/tags response', () => {
    const response = {
      models: [
        { name: 'llama3.2', size: 4_000_000_000, modified_at: '2025-03-01T12:00:00Z', digest: 'sha256:abc123' },
        { name: 'mistral', size: 7_000_000_000, modified_at: '2025-02-15T08:00:00Z', digest: 'sha256:def456' },
      ],
    };
    const result = parseOllamaModelsResponse(response);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'llama3.2',
      size: 4_000_000_000,
      modifiedAt: '2025-03-01T12:00:00Z',
      digest: 'sha256:abc123',
    });
    expect(result[1]).toEqual({
      name: 'mistral',
      size: 7_000_000_000,
      modifiedAt: '2025-02-15T08:00:00Z',
      digest: 'sha256:def456',
    });
  });

  it('returns empty array for null input', () => {
    expect(parseOllamaModelsResponse(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseOllamaModelsResponse(undefined)).toEqual([]);
  });

  it('returns empty array for a non-object input', () => {
    expect(parseOllamaModelsResponse('not-json')).toEqual([]);
    expect(parseOllamaModelsResponse(42)).toEqual([]);
    expect(parseOllamaModelsResponse(true)).toEqual([]);
  });

  it('returns empty array when models key is missing', () => {
    expect(parseOllamaModelsResponse({ other: [] })).toEqual([]);
  });

  it('returns empty array when models is not an array', () => {
    expect(parseOllamaModelsResponse({ models: 'not-array' })).toEqual([]);
  });

  it('returns empty array when models is an empty array', () => {
    expect(parseOllamaModelsResponse({ models: [] })).toEqual([]);
  });

  it('skips entries with missing required fields', () => {
    const response = {
      models: [
        { name: 'valid', size: 100, modified_at: '2025-01-01', digest: 'abc' },
        { name: 'missing-size', modified_at: '2025-01-01', digest: 'abc' },
        { size: 100, modified_at: '2025-01-01', digest: 'abc' },
        { name: 'missing-digest', size: 100, modified_at: '2025-01-01' },
      ],
    };
    const result = parseOllamaModelsResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid');
  });

  it('skips null entries in the models array', () => {
    const response = { models: [null, { name: 'ok', size: 1, modified_at: 'x', digest: 'y' }] };
    const result = parseOllamaModelsResponse(response);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildOllamaTagsUrl
// ---------------------------------------------------------------------------

describe('buildOllamaTagsUrl', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore original window
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      // @ts-expect-error — restoring undefined for non-browser test envs
      delete globalThis.window;
    }
  });

  it('uses proxy path in browser environment', () => {
    // Simulate browser
    globalThis.window = { document: {} } as Window & typeof globalThis;
    const url = buildOllamaTagsUrl();
    expect(url).toBe('/ollama-proxy/api/tags');
  });

  it('uses proxy path in browser even if custom baseUrl is provided', () => {
    globalThis.window = { document: {} } as Window & typeof globalThis;
    const url = buildOllamaTagsUrl('http://custom:9999');
    expect(url).toBe('/ollama-proxy/api/tags');
  });

  it('uses direct URL with default base when not in browser', () => {
    // @ts-expect-error — simulating non-browser
    delete globalThis.window;
    const url = buildOllamaTagsUrl();
    expect(url).toBe('http://localhost:11434/api/tags');
  });

  it('uses custom baseUrl when not in browser', () => {
    // @ts-expect-error — simulating non-browser
    delete globalThis.window;
    const url = buildOllamaTagsUrl('http://myhost:5555');
    expect(url).toBe('http://myhost:5555/api/tags');
  });

  it('strips trailing slashes from custom baseUrl', () => {
    // @ts-expect-error — simulating non-browser
    delete globalThis.window;
    const url = buildOllamaTagsUrl('http://myhost:5555///');
    expect(url).toBe('http://myhost:5555/api/tags');
  });
});

// ---------------------------------------------------------------------------
// createConnectionTestResult
// ---------------------------------------------------------------------------

describe('createConnectionTestResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a passing result', () => {
    const result = createConnectionTestResult('openai', 120, true);
    expect(result.status).toBe('pass');
    expect(result.modelAvailable).toBe(true);
    expect(result.provider).toBe('openai');
    expect(result.latencyMs).toBe(120);
  });

  it('creates a failing result', () => {
    const result = createConnectionTestResult('gemini', 5000, false, 'timeout');
    expect(result.status).toBe('fail');
    expect(result.modelAvailable).toBe(false);
    expect(result.error).toBe('timeout');
  });

  it('includes a valid ISO timestamp', () => {
    const result = createConnectionTestResult('claude', 200, true);
    expect(result.timestamp).toBe('2025-06-15T10:30:00.000Z');
  });

  it('does not include error property when none provided', () => {
    const result = createConnectionTestResult('ollama', 50, true);
    expect(result).not.toHaveProperty('error');
  });

  it('includes error property when provided', () => {
    const result = createConnectionTestResult('openrouter', 300, false, 'API key invalid');
    expect(result.error).toBe('API key invalid');
  });

  it('works for every provider type', () => {
    const providers: AIProviderId[] = ['openai', 'gemini', 'claude', 'openrouter', 'ollama'];
    for (const p of providers) {
      const result = createConnectionTestResult(p, 100, true);
      expect(result.provider).toBe(p);
      expect(result.status).toBe('pass');
    }
  });
});
