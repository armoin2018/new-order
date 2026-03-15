/**
 * Enhanced AI Configuration Types — DR-187, FR-4100
 *
 * Defines the shape of persisted AI provider configuration,
 * connection-test results, Ollama model discovery, and
 * sanitized export payloads.
 */

/** Supported AI provider identifiers */
export type AIProviderId = 'openai' | 'gemini' | 'claude' | 'openrouter' | 'ollama';

/** Detected Ollama model info (FR-4101) */
export interface OllamaModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
  digest: string;
}

/** Connection test result (FR-4104) */
export interface ConnectionTestResult {
  provider: AIProviderId;
  timestamp: string;
  latencyMs: number;
  status: 'pass' | 'fail';
  modelAvailable: boolean;
  capabilities?: {
    contextWindow?: number;
    supportsStreaming?: boolean;
    supportsVision?: boolean;
  };
  error?: string;
}

/** Persisted AI configuration (DR-187) */
export interface PersistedAIConfig {
  provider: AIProviderId;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  budgetPerTurn: number;
  budgetPerSession: number;
  perDimensionPromptPaths: Record<string, string>;
  ollamaDetectedModels: OllamaModelInfo[];
  lastConnectionTest: ConnectionTestResult | null;
}

/** Sanitized config for export (API keys redacted) (FR-4103) */
export interface SanitizedAIConfig extends Omit<PersistedAIConfig, 'apiKey'> {
  apiKey: '[REDACTED]';
}

/** AI config state for the engine */
export interface AIConfigState {
  config: PersistedAIConfig;
  isDirty: boolean;
  lastSaved: string | null;
}
