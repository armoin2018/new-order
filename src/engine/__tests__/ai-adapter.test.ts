/**
 * CNFL-3600 — AIAdapter interface, factory, retry, rate-limiter, cost tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIError,
  RateLimiter,
  CostTracker,
  calculateCost,
  buildMessages,
  registerAdapter,
  createAdapter,
  getRegisteredProviders,
  withRetry,
  withTimeout,
  sleep,
  type AIAdapter,
  type AIProviderConfig,
  type AIRequest,
  type AIResponse,
  type AIUsage,
  type AIChunk,
  type ModelInfo,
  type AIProvider,
} from '../ai/ai-adapter';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkModelInfo(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    modelId: 'test-model',
    provider: 'openai',
    displayName: 'Test Model',
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    inputPricePer1kTokens: 0.01,
    outputPricePer1kTokens: 0.03,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsEmbeddings: false,
    supportsFunctionCalling: true,
    ...overrides,
  };
}

function mkUsage(overrides: Partial<AIUsage> = {}): AIUsage {
  return { promptTokens: 100, completionTokens: 50, totalTokens: 150, ...overrides };
}

// ─── AIError ────────────────────────────────────────────────────────────────

describe('AIError', () => {
  it('carries code, provider, retryable flag', () => {
    const err = new AIError('boom', 'rate_limit', 'openai', 429, true, 5000);
    expect(err.message).toBe('boom');
    expect(err.code).toBe('rate_limit');
    expect(err.provider).toBe('openai');
    expect(err.statusCode).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(5000);
    expect(err.name).toBe('AIError');
  });

  it('defaults retryable to false', () => {
    const err = new AIError('nope', 'auth_error', 'claude');
    expect(err.retryable).toBe(false);
  });
});

// ─── buildMessages ──────────────────────────────────────────────────────────

describe('buildMessages', () => {
  it('converts system+user prompts to messages', () => {
    const msgs = buildMessages({ systemPrompt: 'You are helpful.', userPrompt: 'Hello' });
    expect(msgs).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('omits system message when no systemPrompt', () => {
    const msgs = buildMessages({ userPrompt: 'Hi' });
    expect(msgs).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('returns messages array when provided', () => {
    const custom = [
      { role: 'user' as const, content: 'A' },
      { role: 'assistant' as const, content: 'B' },
    ];
    const msgs = buildMessages({ userPrompt: 'ignored', messages: custom });
    expect(msgs).toBe(custom);
  });
});

// ─── calculateCost ──────────────────────────────────────────────────────────

describe('calculateCost', () => {
  it('computes input, output, and total cost', () => {
    const usage = mkUsage({ promptTokens: 1000, completionTokens: 500 });
    const model = mkModelInfo({ inputPricePer1kTokens: 0.01, outputPricePer1kTokens: 0.03 });
    const cost = calculateCost(usage, model);
    expect(cost.inputCost).toBeCloseTo(0.01, 5);
    expect(cost.outputCost).toBeCloseTo(0.015, 5);
    expect(cost.totalCost).toBeCloseTo(0.025, 5);
    expect(cost.currency).toBe('USD');
  });

  it('returns zero for zero tokens', () => {
    const cost = calculateCost(mkUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }), mkModelInfo());
    expect(cost.totalCost).toBe(0);
  });
});

// ─── CostTracker ────────────────────────────────────────────────────────────

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => { tracker = new CostTracker(); });

  it('starts at zero', () => {
    expect(tracker.getTotal()).toBe(0);
    expect(tracker.getRecords()).toHaveLength(0);
  });

  it('records and totals costs', () => {
    tracker.record('openai', 'gpt-4o', { inputCost: 0.01, outputCost: 0.03, totalCost: 0.04, currency: 'USD' });
    tracker.record('claude', 'claude-sonnet-4-20250514', { inputCost: 0.005, outputCost: 0.015, totalCost: 0.02, currency: 'USD' });
    expect(tracker.getTotal()).toBeCloseTo(0.06, 5);
    expect(tracker.getRecords()).toHaveLength(2);
  });

  it('filters by provider', () => {
    tracker.record('openai', 'gpt-4o', { inputCost: 0, outputCost: 0, totalCost: 0.04, currency: 'USD' });
    tracker.record('claude', 'claude-sonnet-4-20250514', { inputCost: 0, outputCost: 0, totalCost: 0.02, currency: 'USD' });
    expect(tracker.getByProvider('openai')).toBeCloseTo(0.04, 5);
    expect(tracker.getByProvider('claude')).toBeCloseTo(0.02, 5);
  });

  it('getSessionCost filters by time', () => {
    tracker.record('openai', 'gpt-4o', { inputCost: 0, outputCost: 0, totalCost: 0.01, currency: 'USD' });
    const now = Date.now();
    tracker.record('openai', 'gpt-4o', { inputCost: 0, outputCost: 0, totalCost: 0.05, currency: 'USD' });
    expect(tracker.getSessionCost(now - 1)).toBeGreaterThanOrEqual(0.05);
  });

  it('clears all records', () => {
    tracker.record('openai', 'gpt-4o', { inputCost: 0, outputCost: 0, totalCost: 0.01, currency: 'USD' });
    tracker.clear();
    expect(tracker.getTotal()).toBe(0);
  });
});

// ─── RateLimiter ────────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  it('allows requests within limit', async () => {
    const limiter = new RateLimiter(60);
    await limiter.acquire(); // should not throw
  });

  it('no-ops when maxPerMinute is 0', async () => {
    const limiter = new RateLimiter(0);
    await limiter.acquire(); // should not throw
  });
});

// ─── withRetry ──────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3, provider: 'openai' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new AIError('rate limited', 'rate_limit', 'openai', 429, true))
      .mockResolvedValue('recovered');
    const result = await withRetry(fn, { maxRetries: 2, provider: 'openai' });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new AIError('bad key', 'auth_error', 'openai', 401, false));
    await expect(withRetry(fn, { maxRetries: 3, provider: 'openai' })).rejects.toThrow('bad key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new AIError('fail', 'server_error', 'openai', 500, true));
    await expect(withRetry(fn, { maxRetries: 1, provider: 'openai' })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });
});

// ─── withTimeout ────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves if promise completes in time', async () => {
    const result = await withTimeout(Promise.resolve('fast'), 1000, 'openai');
    expect(result).toBe('fast');
  });

  it('rejects with AIError on timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 10, 'openai')).rejects.toThrow('timed out');
  });
});

// ─── sleep ──────────────────────────────────────────────────────────────────

describe('sleep', () => {
  it('resolves after delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

// ─── Adapter Factory ────────────────────────────────────────────────────────

describe('Adapter Factory', () => {
  it('registerAdapter + createAdapter round-trips', () => {
    const mockAdapter: AIAdapter = {
      provider: 'ollama',
      complete: vi.fn(),
      stream: vi.fn() as unknown as AIAdapter['stream'],
      embed: vi.fn(),
      getModelInfo: vi.fn().mockReturnValue(mkModelInfo({ provider: 'ollama' })),
      listModels: vi.fn(),
      testConnection: vi.fn(),
    };
    registerAdapter('ollama', () => mockAdapter);
    const adapter = createAdapter({ provider: 'ollama', model: 'llama3' });
    expect(adapter.provider).toBe('ollama');
  });

  it('throws for unregistered provider', () => {
    expect(() => createAdapter({ provider: 'gemini', model: 'x' })).toThrow();
  });

  it('getRegisteredProviders includes registered providers', () => {
    registerAdapter('openai', () => null as unknown as AIAdapter);
    expect(getRegisteredProviders()).toContain('openai');
  });
});
