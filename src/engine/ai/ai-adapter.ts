/**
 * CNFL-3600 — Unified AI Adapter Interface
 *
 * Defines the AIAdapter contract, request/response types,
 * AIAdapterFactory, and cross-provider retry/timeout/error logic.
 *
 * @module engine/ai/ai-adapter
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

/** Supported AI providers. */
export type AIProvider = 'openai' | 'gemini' | 'claude' | 'openrouter' | 'ollama';

/** Roles in a multi-turn conversation. */
export type MessageRole = 'system' | 'user' | 'assistant';

/** A single message in a conversation. */
export interface AIMessage {
  role: MessageRole;
  content: string;
}

/** Configuration for an AI request. */
export interface AIRequest {
  /** System prompt providing overall context/persona. */
  systemPrompt?: string;
  /** User-facing prompt or message. */
  userPrompt: string;
  /** Full conversation history (overrides system/userPrompt if set). */
  messages?: AIMessage[];
  /** Sampling temperature (0–2). Lower = more deterministic. */
  temperature?: number;
  /** Max tokens in the response. */
  maxTokens?: number;
  /** When true, instructs the model to return valid JSON. */
  jsonMode?: boolean;
  /** Optional stop sequences. */
  stopSequences?: string[];
}

/** Token usage counts for a single request. */
export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Cost breakdown for a single request. */
export interface AICost {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/** A complete AI response. */
export interface AIResponse {
  content: string;
  usage: AIUsage;
  cost: AICost;
  model: string;
  provider: AIProvider;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'unknown';
  latencyMs: number;
}

/** A streamed chunk of an AI response. */
export interface AIChunk {
  content: string;
  done: boolean;
  usage?: AIUsage;
}

/** Describes a model's capabilities and pricing. */
export interface ModelInfo {
  modelId: string;
  provider: AIProvider;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePer1kTokens: number;
  outputPricePer1kTokens: number;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  supportsEmbeddings: boolean;
  supportsFunctionCalling: boolean;
}

/** Provider-level configuration. */
export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  /** Requests per minute. 0 = no limit. */
  rateLimit?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** Max retries on transient failures. */
  maxRetries?: number;
  /** Custom headers (e.g. OpenRouter referrer). */
  customHeaders?: Record<string, string>;
}

// ─── Error Types ────────────────────────────────────────────────────────────

/** Normalized AI error categories. */
export type AIErrorCode =
  | 'auth_error'
  | 'rate_limit'
  | 'context_length_exceeded'
  | 'content_filter'
  | 'timeout'
  | 'connection_error'
  | 'invalid_request'
  | 'model_not_found'
  | 'server_error'
  | 'unknown';

/** Normalized error thrown by adapters. */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly provider: AIProvider,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ─── Adapter Interface ──────────────────────────────────────────────────────

/**
 * Unified adapter interface every AI provider must implement.
 * All providers normalise their native API into this shape.
 */
export interface AIAdapter {
  /** Provider identifier. */
  readonly provider: AIProvider;

  /** Send a single completion request. */
  complete(request: AIRequest): Promise<AIResponse>;

  /** Stream a completion response chunk-by-chunk. */
  stream(request: AIRequest): AsyncIterable<AIChunk>;

  /** Generate an embedding vector for the given text. */
  embed(text: string): Promise<number[]>;

  /** Return metadata about the currently configured model. */
  getModelInfo(): ModelInfo;

  /** List all models available from this provider. */
  listModels(): Promise<ModelInfo[]>;

  /** Test the connection / API key validity. */
  testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }>;
}

// ─── Retry / Timeout Helpers ────────────────────────────────────────────────

/** Default retry config. */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const BASE_RETRY_DELAY_MS = 500;

/**
 * Sleep for a given duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with exponential back-off retries on transient errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; provider: AIProvider },
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof AIError && !err.retryable) throw err;
      if (attempt === maxRetries) throw err;
      const delay = err instanceof AIError && err.retryAfterMs
        ? err.retryAfterMs
        : BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw lastError; // unreachable but satisfies TS
}

/**
 * Race a promise against a timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  provider: AIProvider,
): Promise<T> {
  const ms = timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AIError(`Request timed out after ${ms}ms`, 'timeout', provider, undefined, true)),
      ms,
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

/**
 * Simple token-bucket rate limiter.
 * Adapters call `acquire()` before each request.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxPerMinute: number,
  ) {
    this.tokens = maxPerMinute;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    if (this.maxPerMinute <= 0) return;
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    const waitMs = 60_000 / this.maxPerMinute;
    await sleep(waitMs);
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / (60_000 / this.maxPerMinute));
    if (newTokens > 0) {
      this.tokens = Math.min(this.maxPerMinute, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}

// ─── Cost Calculator ────────────────────────────────────────────────────────

/**
 * Compute cost from usage and model pricing.
 */
export function calculateCost(usage: AIUsage, model: ModelInfo): AICost {
  const inputCost = (usage.promptTokens / 1000) * model.inputPricePer1kTokens;
  const outputCost = (usage.completionTokens / 1000) * model.outputPricePer1kTokens;
  return {
    inputCost: Math.round(inputCost * 1_000_000) / 1_000_000,
    outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
    totalCost: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
    currency: 'USD',
  };
}

// ─── Message Builder ────────────────────────────────────────────────────────

/**
 * Convert an AIRequest into an array of messages.
 */
export function buildMessages(request: AIRequest): AIMessage[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages;
  }
  const msgs: AIMessage[] = [];
  if (request.systemPrompt) {
    msgs.push({ role: 'system', content: request.systemPrompt });
  }
  msgs.push({ role: 'user', content: request.userPrompt });
  return msgs;
}

// ─── Adapter Factory ────────────────────────────────────────────────────────

/** Registry of adapter constructors keyed by provider. */
const adapterRegistry = new Map<AIProvider, (config: AIProviderConfig) => AIAdapter>();

/**
 * Register an adapter constructor for a given provider.
 * Called by each provider module at import time.
 */
export function registerAdapter(
  provider: AIProvider,
  factory: (config: AIProviderConfig) => AIAdapter,
): void {
  adapterRegistry.set(provider, factory);
}

/**
 * Factory: create an adapter for the given config.
 */
export function createAdapter(config: AIProviderConfig): AIAdapter {
  const factory = adapterRegistry.get(config.provider);
  if (!factory) {
    throw new AIError(
      `No adapter registered for provider "${config.provider}"`,
      'invalid_request',
      config.provider,
    );
  }
  return factory(config);
}

/**
 * Get all registered provider names.
 */
export function getRegisteredProviders(): AIProvider[] {
  return Array.from(adapterRegistry.keys());
}

// ─── Cost Tracker ───────────────────────────────────────────────────────────

/** Tracks cumulative API spend. */
export interface CostRecord {
  provider: AIProvider;
  model: string;
  cost: AICost;
  timestamp: number;
}

/** In-memory cost tracker singleton. */
export class CostTracker {
  private records: CostRecord[] = [];

  record(provider: AIProvider, model: string, cost: AICost): void {
    this.records.push({ provider, model, cost, timestamp: Date.now() });
  }

  getTotal(): number {
    return this.records.reduce((sum, r) => sum + r.cost.totalCost, 0);
  }

  getByProvider(provider: AIProvider): number {
    return this.records
      .filter((r) => r.provider === provider)
      .reduce((sum, r) => sum + r.cost.totalCost, 0);
  }

  getRecords(): readonly CostRecord[] {
    return this.records;
  }

  getSessionCost(sinceMs: number): number {
    return this.records
      .filter((r) => r.timestamp >= sinceMs)
      .reduce((sum, r) => sum + r.cost.totalCost, 0);
  }

  clear(): void {
    this.records = [];
  }
}

/** Global cost tracker instance. */
export const costTracker = new CostTracker();
