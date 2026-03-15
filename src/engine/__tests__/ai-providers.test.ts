/**
 * Provider adapter unit tests.
 *
 * Each provider adapter is tested with a mock `fetchFn` injected via the
 * constructor, so no real HTTP calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type AIProviderConfig,
  type AIResponse,
  AIError,
  registerAdapter,
  createAdapter,
  costTracker,
} from '../ai/ai-adapter';

/* Dynamic imports trigger side-effect registrations. */
import { OpenAIAdapter } from '../ai/providers/openai-adapter';
import { GeminiAdapter } from '../ai/providers/gemini-adapter';
import { ClaudeAdapter } from '../ai/providers/claude-adapter';
import { OpenRouterAdapter } from '../ai/providers/openrouter-adapter';
import { OllamaAdapter } from '../ai/providers/ollama-adapter';

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Build a Response-like object suitable for mock fetch. */
function mockResponse(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    body: null,
  } as unknown as Response;
}

/** Build an SSE stream body for OpenAI / OpenRouter / Gemini style SSE. */
function sseStreamBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

function streamResponse(chunks: string[], status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
    body: sseStreamBody(chunks),
  } as unknown as Response;
}

/** Collect all chunks from an async iterable. */
async function collectStream(iter: AsyncIterable<{ content: string; done: boolean }>): Promise<string> {
  let out = '';
  for await (const c of iter) out += c.content;
  return out;
}

// ─── OpenAI Adapter ─────────────────────────────────────────────────────────

describe('OpenAIAdapter', () => {
  const cfg: AIProviderConfig = { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' };

  beforeEach(() => costTracker.clear());

  it('complete() returns normalised AIResponse', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: 'Hello world' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );
    const adapter = new OpenAIAdapter(cfg, mockFetch);
    const res = await adapter.complete({ userPrompt: 'Hi' });
    expect(res.content).toBe('Hello world');
    expect(res.provider).toBe('openai');
    expect(res.finishReason).toBe('stop');
    expect(res.usage.totalTokens).toBe(15);
    expect(res.cost.totalCost).toBeGreaterThan(0);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('complete() maps 401 to auth_error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockResponse('Unauthorized', 401));
    const adapter = new OpenAIAdapter(cfg, mockFetch);
    await expect(adapter.complete({ userPrompt: 'Hi' })).rejects.toThrow(AIError);
    try { await adapter.complete({ userPrompt: 'Hi' }); } catch (e) {
      expect((e as AIError).code).toBe('auth_error');
    }
  });

  it('stream() yields chunks and terminates', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const adapter = new OpenAIAdapter(cfg, mockFetch);
    const text = await collectStream(adapter.stream({ userPrompt: 'Hi' }));
    expect(text).toBe('Hello');
  });

  it('getModelInfo() returns gpt-4o info', () => {
    const adapter = new OpenAIAdapter(cfg);
    const info = adapter.getModelInfo();
    expect(info.modelId).toBe('gpt-4o');
    expect(info.contextWindow).toBe(128_000);
  });

  it('listModels() returns model catalog', async () => {
    const adapter = new OpenAIAdapter(cfg);
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThanOrEqual(4);
    expect(models.some((m) => m.modelId === 'gpt-4o')).toBe(true);
  });

  it('testConnection() returns ok on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    const adapter = new OpenAIAdapter(cfg, mockFetch);
    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Gemini Adapter ─────────────────────────────────────────────────────────

describe('GeminiAdapter', () => {
  const cfg: AIProviderConfig = { provider: 'gemini', apiKey: 'key-test', model: 'gemini-2.0-flash' };

  beforeEach(() => costTracker.clear());

  it('complete() returns normalised response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        candidates: [{ content: { parts: [{ text: 'From Gemini' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4, totalTokenCount: 12 },
      }),
    );
    const adapter = new GeminiAdapter(cfg, mockFetch);
    const res = await adapter.complete({ userPrompt: 'Hi' });
    expect(res.content).toBe('From Gemini');
    expect(res.provider).toBe('gemini');
    expect(res.usage.totalTokens).toBe(12);
  });

  it('complete() maps 403 to auth_error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockResponse('Forbidden', 403));
    const adapter = new GeminiAdapter(cfg, mockFetch);
    await expect(adapter.complete({ userPrompt: 'Hi' })).rejects.toThrow(AIError);
    try { await adapter.complete({ userPrompt: 'Hi' }); } catch (e) {
      expect((e as AIError).code).toBe('auth_error');
    }
  });

  it('getModelInfo() returns flash model', () => {
    const adapter = new GeminiAdapter(cfg);
    expect(adapter.getModelInfo().modelId).toBe('gemini-2.0-flash');
  });
});

// ─── Claude Adapter ─────────────────────────────────────────────────────────

describe('ClaudeAdapter', () => {
  const cfg: AIProviderConfig = { provider: 'claude', apiKey: 'sk-ant-test', model: 'claude-sonnet-4-20250514' };

  beforeEach(() => costTracker.clear());

  it('complete() returns normalised response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        content: [{ type: 'text', text: 'From Claude' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-sonnet-4-20250514',
      }),
    );
    const adapter = new ClaudeAdapter(cfg, mockFetch);
    const res = await adapter.complete({ userPrompt: 'Hi' });
    expect(res.content).toBe('From Claude');
    expect(res.provider).toBe('claude');
    expect(res.finishReason).toBe('stop');
    expect(res.usage.promptTokens).toBe(10);
  });

  it('complete() maps 429 to rate_limit (retryable)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockResponse('Rate limited', 429));
    const adapter = new ClaudeAdapter({ ...cfg, maxRetries: 0 }, mockFetch);
    try { await adapter.complete({ userPrompt: 'Hi' }); } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).code).toBe('rate_limit');
      expect((e as AIError).retryable).toBe(true);
    }
  });

  it('embed() throws — Claude has no embedding API', async () => {
    const adapter = new ClaudeAdapter(cfg);
    await expect(adapter.embed('hello')).rejects.toThrow(AIError);
  });

  it('getModelInfo() returns sonnet 4', () => {
    const adapter = new ClaudeAdapter(cfg);
    expect(adapter.getModelInfo().displayName).toContain('Sonnet');
  });
});

// ─── OpenRouter Adapter ─────────────────────────────────────────────────────

describe('OpenRouterAdapter', () => {
  const cfg: AIProviderConfig = { provider: 'openrouter', apiKey: 'or-test', model: 'openai/gpt-4o' };

  beforeEach(() => costTracker.clear());

  it('complete() includes OpenRouter-specific headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: 'routed' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: 'openai/gpt-4o',
      }),
    );
    const adapter = new OpenRouterAdapter(cfg, mockFetch);
    await adapter.complete({ userPrompt: 'test' });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['HTTP-Referer']).toBe('https://new-order-game.app');
    expect(headers['X-Title']).toBe('New Order: Global Simulation');
    expect(headers['Authorization']).toBe('Bearer or-test');
  });

  it('complete() normalises response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: 'routed response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: 'openai/gpt-4o',
      }),
    );
    const adapter = new OpenRouterAdapter(cfg, mockFetch);
    const res = await adapter.complete({ userPrompt: 'test' });
    expect(res.content).toBe('routed response');
    expect(res.provider).toBe('openrouter');
  });

  it('embed() throws — OpenRouter does not support embeddings', async () => {
    const adapter = new OpenRouterAdapter(cfg);
    await expect(adapter.embed('hello')).rejects.toThrow(AIError);
  });

  it('listModels() falls back to defaults on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network fail'));
    const adapter = new OpenRouterAdapter(cfg, mockFetch);
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThanOrEqual(4);
  });

  it('getModelInfo() returns correct model', () => {
    const adapter = new OpenRouterAdapter(cfg);
    expect(adapter.getModelInfo().modelId).toBe('openai/gpt-4o');
  });
});

// ─── Ollama Adapter ─────────────────────────────────────────────────────────

describe('OllamaAdapter', () => {
  const cfg: AIProviderConfig = { provider: 'ollama', model: 'llama3.1' };

  it('complete() with zero cost', async () => {
    // Ollama complete() now uses stream-collect internally (stream: true + collect chunks).
    // Mock must return an NDJSON streaming body.
    const encoder = new TextEncoder();
    const ndjsonBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Local "},"done":false}\n'));
        controller.enqueue(encoder.encode('{"message":{"content":"response"},"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":5}\n'));
        controller.close();
      },
    });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/x-ndjson' }),
      body: ndjsonBody,
    } as unknown as Response);
    const adapter = new OllamaAdapter(cfg, mockFetch);
    const res = await adapter.complete({ userPrompt: 'Hello' });
    expect(res.content).toBe('Local response');
    expect(res.provider).toBe('ollama');
    expect(res.cost.totalCost).toBe(0);
    expect(res.usage.promptTokens).toBe(10);
    expect(res.usage.completionTokens).toBe(5);
  });

  it('complete() throws connection_error when server unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const adapter = new OllamaAdapter(cfg, mockFetch);
    try {
      await adapter.complete({ userPrompt: 'Hi' });
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).code).toBe('connection_error');
    }
  });

  it('stream() yields NDJSON chunks', async () => {
    const body = sseStreamBody([
      '{"message":{"content":"He"},"done":false}\n',
      '{"message":{"content":"llo"},"done":false}\n',
      '{"message":{"content":""},"done":true}\n',
    ]);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'application/x-ndjson' }),
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
      body,
    } as unknown as Response);

    const adapter = new OllamaAdapter(cfg, mockFetch);
    const text = await collectStream(adapter.stream({ userPrompt: 'Hi' }));
    expect(text).toBe('Hello');
  });

  it('embed() calls /api/embed endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({ embeddings: [[0.1, 0.2, 0.3]] }),
    );
    const adapter = new OllamaAdapter(cfg, mockFetch);
    const vec = await adapter.embed('test');
    expect(vec).toEqual([0.1, 0.2, 0.3]);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/embed');
  });

  it('testConnection() detects running server', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({ models: [{ name: 'llama3.1' }] }),
    );
    const adapter = new OllamaAdapter(cfg, mockFetch);
    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toContain('1 models');
  });

  it('testConnection() reports unreachable server', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const adapter = new OllamaAdapter(cfg, mockFetch);
    const result = await adapter.testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Cannot connect');
  });

  it('listModels() falls back to defaults on error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));
    const adapter = new OllamaAdapter(cfg, mockFetch);
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThanOrEqual(4);
    expect(models.some((m) => m.modelId === 'llama3.1')).toBe(true);
  });

  it('getModelInfo() returns llama3.1', () => {
    const adapter = new OllamaAdapter(cfg);
    expect(adapter.getModelInfo().modelId).toBe('llama3.1');
    expect(adapter.getModelInfo().inputPricePer1kTokens).toBe(0);
  });
});

// ─── Factory Registration (side-effect imports) ─────────────────────────────

describe('Adapter Factory integration', () => {
  it('all 5 providers are registered after imports', () => {
    /* The imports above trigger registerAdapter() calls. */
    for (const p of ['openai', 'gemini', 'claude', 'openrouter', 'ollama'] as const) {
      expect(() => createAdapter({ provider: p, model: 'test', apiKey: 'k' })).not.toThrow();
    }
  });
});
