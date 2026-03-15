/**
 * Enhanced AI Configuration Engine — DR-187, FR-4100 – FR-4104
 *
 * Pure-function module for creating, validating, sanitizing, and
 * merging AI provider configuration.  No side-effects, no I/O —
 * storage is handled by a separate persistence layer.
 */

import type {
  AIProviderId,
  PersistedAIConfig,
  SanitizedAIConfig,
  OllamaModelInfo,
  ConnectionTestResult,
} from '@/data/types/ai-config.types';
import { aiConfigConfig } from '@/engine/config/ai-config';

// ── Helpers ─────────────────────────────────────────────────────────────────

const VALID_PROVIDERS: readonly AIProviderId[] = [
  'openai', 'gemini', 'claude', 'openrouter', 'ollama',
] as const;

function isAIProviderId(value: unknown): value is AIProviderId {
  return typeof value === 'string' && (VALID_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Detect whether we are running inside a browser environment.
 * Used by `buildOllamaTagsUrl` to decide between proxy and direct URL.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a default `PersistedAIConfig` seeded from `aiConfigConfig.defaults`.
 */
export function createDefaultAIConfig(): PersistedAIConfig {
  const d = aiConfigConfig.defaults;
  return {
    provider: d.provider,
    model: d.model,
    baseUrl: d.baseUrl,
    apiKey: '',
    temperature: d.temperature,
    maxTokens: d.maxTokens,
    budgetPerTurn: d.budgetPerTurn,
    budgetPerSession: d.budgetPerSession,
    perDimensionPromptPaths: {},
    ollamaDetectedModels: [],
    lastConnectionTest: null,
  };
}

/**
 * Validate a (possibly partial) AI config and return a list of errors.
 */
export function validateAIConfig(
  config: Partial<PersistedAIConfig>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // provider
  if (config.provider === undefined) {
    errors.push('provider is required');
  } else if (!isAIProviderId(config.provider)) {
    errors.push(`provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }

  // model
  if (config.model === undefined || config.model === '') {
    errors.push('model is required');
  } else if (typeof config.model !== 'string') {
    errors.push('model must be a string');
  }

  // temperature
  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      errors.push('temperature must be a number between 0 and 2');
    }
  }

  // maxTokens
  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== 'number' || config.maxTokens < 1) {
      errors.push('maxTokens must be a positive number');
    }
  }

  // budgetPerTurn
  if (config.budgetPerTurn !== undefined) {
    if (typeof config.budgetPerTurn !== 'number' || config.budgetPerTurn < 0) {
      errors.push('budgetPerTurn must be a non-negative number');
    }
  }

  // budgetPerSession
  if (config.budgetPerSession !== undefined) {
    if (typeof config.budgetPerSession !== 'number' || config.budgetPerSession < 0) {
      errors.push('budgetPerSession must be a non-negative number');
    }
  }

  // apiKey — required for non-ollama when provider is set
  if (
    config.provider !== undefined &&
    isAIProviderId(config.provider) &&
    config.provider !== 'ollama'
  ) {
    const providerMeta = aiConfigConfig.providers[config.provider];
    if (providerMeta.requiresApiKey && (!config.apiKey || config.apiKey.trim() === '')) {
      errors.push(`apiKey is required for provider "${config.provider}"`);
    }
  }

  // baseUrl — must be a string if provided
  if (config.baseUrl !== undefined && typeof config.baseUrl !== 'string') {
    errors.push('baseUrl must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Redact the API key for safe export / display.
 */
export function sanitizeConfigForExport(config: PersistedAIConfig): SanitizedAIConfig {
  return {
    ...config,
    apiKey: '[REDACTED]' as const,
  };
}

/**
 * Merge an imported (sanitized) config into the current config,
 * preserving the current API key (since imported configs have it redacted).
 */
export function mergeImportedConfig(
  current: PersistedAIConfig,
  imported: SanitizedAIConfig,
): PersistedAIConfig {
  return {
    ...current,
    ...imported,
    // Always keep the current API key — imported config has '[REDACTED]'
    apiKey: current.apiKey,
  };
}

/**
 * Safely parse an Ollama `/api/tags` JSON response into `OllamaModelInfo[]`.
 *
 * Expected shape: `{ models: [{ name, size, modified_at, digest, … }] }`
 */
export function parseOllamaModelsResponse(responseJson: unknown): OllamaModelInfo[] {
  if (responseJson === null || responseJson === undefined || typeof responseJson !== 'object') {
    return [];
  }

  const obj = responseJson as Record<string, unknown>;
  if (!Array.isArray(obj['models'])) {
    return [];
  }

  const models: OllamaModelInfo[] = [];
  for (const entry of obj['models']) {
    if (entry === null || typeof entry !== 'object') continue;

    const e = entry as Record<string, unknown>;
    const name = typeof e['name'] === 'string' ? e['name'] : undefined;
    const size = typeof e['size'] === 'number' ? e['size'] : undefined;
    const modifiedAt = typeof e['modified_at'] === 'string' ? e['modified_at'] : undefined;
    const digest = typeof e['digest'] === 'string' ? e['digest'] : undefined;

    if (name !== undefined && size !== undefined && modifiedAt !== undefined && digest !== undefined) {
      models.push({ name, size, modifiedAt, digest });
    }
  }

  return models;
}

/**
 * Build the URL for the Ollama `/api/tags` endpoint.
 *
 * In a browser context CORS prevents direct access to the local Ollama
 * server, so we route through the Vite dev-server proxy at `/ollama-proxy`.
 * Outside the browser (tests, SSR) we hit the Ollama server directly.
 */
export function buildOllamaTagsUrl(baseUrl?: string): string {
  const cfg = aiConfigConfig.ollamaDefaults;

  if (isBrowser()) {
    // Use the Vite dev-server proxy path
    return `${cfg.proxyPath}${cfg.tagsEndpoint}`;
  }

  // Direct access (server-side / tests)
  const base = (baseUrl ?? cfg.baseUrl).replace(/\/+$/, '');
  return `${base}${cfg.tagsEndpoint}`;
}

/**
 * Create a `ConnectionTestResult` from raw test data.
 */
export function createConnectionTestResult(
  provider: AIProviderId,
  latencyMs: number,
  success: boolean,
  error?: string,
): ConnectionTestResult {
  return {
    provider,
    timestamp: new Date().toISOString(),
    latencyMs,
    status: success ? 'pass' : 'fail',
    modelAvailable: success,
    ...(error !== undefined ? { error } : {}),
  };
}
