/**
 * CNFL-3601 — OpenAI Adapter (GPT-4, GPT-4o, GPT-4o-mini, GPT-4-turbo)
 *
 * Implements AIAdapter for the OpenAI Chat Completions API.
 * Uses fetch-based calls (no SDK dependency) for portability.
 *
 * @module engine/ai/providers/openai-adapter
 */

import {
  type AIAdapter,
  type AIRequest,
  type AIResponse,
  type AIChunk,
  type AIProviderConfig,
  type ModelInfo,
  type AIUsage,
  AIError,
  RateLimiter,
  buildMessages,
  calculateCost,
  withRetry,
  withTimeout,
  costTracker,
  registerAdapter,
} from '../ai-adapter';

// ─── Model Catalog ──────────────────────────────────────────────────────────

const OPENAI_MODELS: ModelInfo[] = [
  { modelId: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', contextWindow: 128_000, maxOutputTokens: 16_384, inputPricePer1kTokens: 0.0025, outputPricePer1kTokens: 0.01, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', contextWindow: 128_000, maxOutputTokens: 16_384, inputPricePer1kTokens: 0.00015, outputPricePer1kTokens: 0.0006, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gpt-4-turbo', provider: 'openai', displayName: 'GPT-4 Turbo', contextWindow: 128_000, maxOutputTokens: 4096, inputPricePer1kTokens: 0.01, outputPricePer1kTokens: 0.03, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gpt-4', provider: 'openai', displayName: 'GPT-4', contextWindow: 8_192, maxOutputTokens: 8_192, inputPricePer1kTokens: 0.03, outputPricePer1kTokens: 0.06, supportsStreaming: true, supportsJsonMode: false, supportsEmbeddings: false, supportsFunctionCalling: true },
];

function findModel(modelId: string): ModelInfo {
  return OPENAI_MODELS.find((m) => m.modelId === modelId) ?? OPENAI_MODELS[0]!;
}

// ─── Error Mapping ──────────────────────────────────────────────────────────

function mapOpenAIError(status: number, body: string): AIError {
  if (status === 401) return new AIError('Invalid OpenAI API key', 'auth_error', 'openai', 401);
  if (status === 429) return new AIError('OpenAI rate limit exceeded', 'rate_limit', 'openai', 429, true, 10_000);
  if (status === 400 && body.includes('context_length')) return new AIError('Context length exceeded', 'context_length_exceeded', 'openai', 400);
  if (status === 400) return new AIError(`OpenAI bad request: ${body}`, 'invalid_request', 'openai', 400);
  if (status === 404) return new AIError('Model not found', 'model_not_found', 'openai', 404);
  if (status >= 500) return new AIError(`OpenAI server error (${status})`, 'server_error', 'openai', status, true);
  return new AIError(`OpenAI error (${status}): ${body}`, 'unknown', 'openai', status);
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class OpenAIAdapter implements AIAdapter {
  readonly provider = 'openai' as const;
  private readonly config: AIProviderConfig;
  private readonly model: ModelInfo;
  private readonly limiter: RateLimiter;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: AIProviderConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.model = findModel(config.model);
    this.limiter = new RateLimiter(config.rateLimit ?? 60);
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.openai.com/v1';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.customHeaders,
    };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    return withRetry(() => this.doComplete(request), {
      maxRetries: this.config.maxRetries ?? 3,
      provider: 'openai',
    });
  }

  private async doComplete(request: AIRequest): Promise<AIResponse> {
    await this.limiter.acquire();
    const messages = buildMessages(request);
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.model.maxOutputTokens,
    };
    if (request.jsonMode && this.model.supportsJsonMode) {
      body.response_format = { type: 'json_object' };
    }
    if (request.stopSequences?.length) {
      body.stop = request.stopSequences;
    }

    const start = performance.now();
    const resp = await withTimeout(
      this.fetchFn(`${this.baseUrl}/chat/completions`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) }),
      this.config.timeoutMs ?? 30_000,
      'openai',
    );

    if (!resp.ok) {
      const text = await resp.text();
      throw mapOpenAIError(resp.status, text);
    }

    const json = await resp.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const latencyMs = Math.round(performance.now() - start);
    const usage: AIUsage = {
      promptTokens: json.usage.prompt_tokens,
      completionTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    };
    const cost = calculateCost(usage, this.model);
    costTracker.record('openai', this.config.model, cost);

    const finishMap: Record<string, AIResponse['finishReason']> = {
      stop: 'stop', length: 'length', content_filter: 'content_filter',
    };

    return {
      content: json.choices[0]?.message.content ?? '',
      usage,
      cost,
      model: this.config.model,
      provider: 'openai',
      finishReason: finishMap[json.choices[0]?.finish_reason ?? ''] ?? 'unknown',
      latencyMs,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    await this.limiter.acquire();
    const messages = buildMessages(request);
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.model.maxOutputTokens,
      stream: true,
    };

    const resp = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw mapOpenAIError(resp.status, text);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const chunk = JSON.parse(data) as { choices: Array<{ delta: { content?: string }; finish_reason?: string }> };
          const content = chunk.choices[0]?.delta.content ?? '';
          const isDone = chunk.choices[0]?.finish_reason === 'stop';
          yield { content, done: isDone };
        } catch { /* skip malformed chunks */ }
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    await this.limiter.acquire();
    const resp = await withTimeout(
      this.fetchFn(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      }),
      this.config.timeoutMs ?? 30_000,
      'openai',
    );
    if (!resp.ok) throw mapOpenAIError(resp.status, await resp.text());
    const json = await resp.json() as { data: Array<{ embedding: number[] }> };
    return json.data[0]?.embedding ?? [];
  }

  getModelInfo(): ModelInfo { return this.model; }

  async listModels(): Promise<ModelInfo[]> { return OPENAI_MODELS; }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    try {
      await this.doComplete({ userPrompt: 'Say "ok"', maxTokens: 5, temperature: 0 });
      return { ok: true, message: 'Connected to OpenAI', latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Unknown error', latencyMs: Math.round(performance.now() - start) };
    }
  }
}

// Auto-register
registerAdapter('openai', (config) => new OpenAIAdapter(config));
