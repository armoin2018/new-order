/**
 * CNFL-3604 — OpenRouter Adapter (multi-model routing)
 *
 * Implements AIAdapter for the OpenRouter API, which provides access to 100+
 * models through a single API endpoint with automatic fallback routing.
 *
 * @module engine/ai/providers/openrouter-adapter
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

// ─── Default Models ─────────────────────────────────────────────────────────

const DEFAULT_MODELS: ModelInfo[] = [
  { modelId: 'openai/gpt-4o', provider: 'openrouter', displayName: 'GPT-4o (via OR)', contextWindow: 128_000, maxOutputTokens: 16_384, inputPricePer1kTokens: 0.0025, outputPricePer1kTokens: 0.01, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'anthropic/claude-sonnet-4-20250514', provider: 'openrouter', displayName: 'Claude Sonnet 4 (via OR)', contextWindow: 200_000, maxOutputTokens: 8192, inputPricePer1kTokens: 0.003, outputPricePer1kTokens: 0.015, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'google/gemini-2.0-flash', provider: 'openrouter', displayName: 'Gemini 2.0 Flash (via OR)', contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1kTokens: 0.0001, outputPricePer1kTokens: 0.0004, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'meta-llama/llama-3.1-70b-instruct', provider: 'openrouter', displayName: 'Llama 3.1 70B (via OR)', contextWindow: 131_072, maxOutputTokens: 4096, inputPricePer1kTokens: 0.00035, outputPricePer1kTokens: 0.0004, supportsStreaming: true, supportsJsonMode: false, supportsEmbeddings: false, supportsFunctionCalling: false },
];

function findModel(modelId: string): ModelInfo {
  return DEFAULT_MODELS.find((m) => m.modelId === modelId) ?? {
    modelId,
    provider: 'openrouter',
    displayName: modelId,
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    inputPricePer1kTokens: 0.001,
    outputPricePer1kTokens: 0.002,
    supportsStreaming: true,
    supportsJsonMode: false,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
  };
}

// ─── Error Mapping ──────────────────────────────────────────────────────────

function mapError(status: number, body: string): AIError {
  if (status === 401) return new AIError('Invalid OpenRouter API key', 'auth_error', 'openrouter', 401);
  if (status === 402) return new AIError('Insufficient OpenRouter credits', 'auth_error', 'openrouter', 402);
  if (status === 429) return new AIError('OpenRouter rate limit exceeded', 'rate_limit', 'openrouter', 429, true, 10_000);
  if (status === 400) return new AIError(`OpenRouter bad request: ${body.slice(0, 200)}`, 'invalid_request', 'openrouter', 400);
  if (status >= 500) return new AIError(`OpenRouter server error (${status})`, 'server_error', 'openrouter', status, true);
  return new AIError(`OpenRouter error (${status}): ${body.slice(0, 200)}`, 'unknown', 'openrouter', status);
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class OpenRouterAdapter implements AIAdapter {
  readonly provider = 'openrouter' as const;
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
    return this.config.baseUrl ?? 'https://openrouter.ai/api/v1';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      'HTTP-Referer': 'https://new-order-game.app',
      'X-Title': 'New Order: Global Simulation',
      ...this.config.customHeaders,
    };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    return withRetry(() => this.doComplete(request), {
      maxRetries: this.config.maxRetries ?? 3,
      provider: 'openrouter',
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
    if (request.stopSequences?.length) {
      body.stop = request.stopSequences;
    }

    const start = performance.now();
    const resp = await withTimeout(
      this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      }),
      this.config.timeoutMs ?? 60_000,
      'openrouter',
    );

    if (!resp.ok) throw mapError(resp.status, await resp.text());

    const json = await resp.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const latencyMs = Math.round(performance.now() - start);
    const usage: AIUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    };
    const cost = calculateCost(usage, this.model);
    costTracker.record('openrouter', this.config.model, cost);

    return {
      content: json.choices[0]?.message.content ?? '',
      usage,
      cost,
      model: json.model ?? this.config.model,
      provider: 'openrouter',
      finishReason: json.choices[0]?.finish_reason === 'stop' ? 'stop' : json.choices[0]?.finish_reason === 'length' ? 'length' : 'unknown',
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

    if (!resp.ok) throw mapError(resp.status, await resp.text());

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
        if (data === '[DONE]') { yield { content: '', done: true }; return; }
        try {
          const chunk = JSON.parse(data) as { choices: Array<{ delta: { content?: string }; finish_reason?: string }> };
          yield { content: chunk.choices[0]?.delta.content ?? '', done: chunk.choices[0]?.finish_reason === 'stop' };
        } catch { /* skip */ }
      }
    }
  }

  async embed(_text: string): Promise<number[]> {
    throw new AIError('OpenRouter does not support embeddings directly', 'invalid_request', 'openrouter');
  }

  getModelInfo(): ModelInfo { return this.model; }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const resp = await this.fetchFn(`${this.baseUrl}/models`, { headers: this.headers() });
      if (!resp.ok) return DEFAULT_MODELS;
      const json = await resp.json() as { data: Array<{ id: string; name: string; context_length: number; pricing: { prompt: string; completion: string } }> };
      return json.data.slice(0, 50).map((m) => ({
        modelId: m.id,
        provider: 'openrouter' as const,
        displayName: m.name,
        contextWindow: m.context_length ?? 128_000,
        maxOutputTokens: 4096,
        inputPricePer1kTokens: parseFloat(m.pricing?.prompt ?? '0') * 1000,
        outputPricePer1kTokens: parseFloat(m.pricing?.completion ?? '0') * 1000,
        supportsStreaming: true,
        supportsJsonMode: false,
        supportsEmbeddings: false,
        supportsFunctionCalling: false,
      }));
    } catch {
      return DEFAULT_MODELS;
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    try {
      await this.doComplete({ userPrompt: 'Say "ok"', maxTokens: 5, temperature: 0 });
      return { ok: true, message: 'Connected to OpenRouter', latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Unknown error', latencyMs: Math.round(performance.now() - start) };
    }
  }
}

registerAdapter('openrouter', (config) => new OpenRouterAdapter(config));
