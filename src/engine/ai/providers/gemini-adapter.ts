/**
 * CNFL-3602 — Google Gemini Adapter
 *
 * Implements AIAdapter for Google Gemini API (gemini-2.0-flash, gemini-2.0-pro,
 * gemini-1.5-pro). Uses fetch-based calls for portability.
 *
 * @module engine/ai/providers/gemini-adapter
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

const GEMINI_MODELS: ModelInfo[] = [
  { modelId: 'gemini-2.0-flash', provider: 'gemini', displayName: 'Gemini 2.0 Flash', contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1kTokens: 0.0001, outputPricePer1kTokens: 0.0004, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gemini-2.0-pro', provider: 'gemini', displayName: 'Gemini 2.0 Pro', contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1kTokens: 0.00125, outputPricePer1kTokens: 0.005, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gemini-1.5-pro', provider: 'gemini', displayName: 'Gemini 1.5 Pro', contextWindow: 2_097_152, maxOutputTokens: 8192, inputPricePer1kTokens: 0.00125, outputPricePer1kTokens: 0.005, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
];

function findModel(modelId: string): ModelInfo {
  return GEMINI_MODELS.find((m) => m.modelId === modelId) ?? GEMINI_MODELS[0]!;
}

// ─── Error Mapping ──────────────────────────────────────────────────────────

function mapGeminiError(status: number, body: string): AIError {
  if (status === 400 && body.includes('API_KEY')) return new AIError('Invalid Gemini API key', 'auth_error', 'gemini', 400);
  if (status === 403) return new AIError('Gemini API key unauthorized', 'auth_error', 'gemini', 403);
  if (status === 429) return new AIError('Gemini quota exceeded', 'rate_limit', 'gemini', 429, true, 15_000);
  if (status === 400 && body.includes('SAFETY')) return new AIError('Content blocked by Gemini safety filters', 'content_filter', 'gemini', 400);
  if (status === 400) return new AIError(`Gemini bad request: ${body.slice(0, 200)}`, 'invalid_request', 'gemini', 400);
  if (status === 404) return new AIError('Gemini model not found', 'model_not_found', 'gemini', 404);
  if (status >= 500) return new AIError(`Gemini server error (${status})`, 'server_error', 'gemini', status, true);
  return new AIError(`Gemini error (${status}): ${body.slice(0, 200)}`, 'unknown', 'gemini', status);
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class GeminiAdapter implements AIAdapter {
  readonly provider = 'gemini' as const;
  private readonly config: AIProviderConfig;
  private readonly model: ModelInfo;
  private readonly limiter: RateLimiter;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: AIProviderConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.model = findModel(config.model);
    this.limiter = new RateLimiter(config.rateLimit ?? 30);
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  private endpoint(action: string): string {
    return `${this.baseUrl}/models/${this.config.model}:${action}?key=${this.config.apiKey}`;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    return withRetry(() => this.doComplete(request), {
      maxRetries: this.config.maxRetries ?? 3,
      provider: 'gemini',
    });
  }

  private async doComplete(request: AIRequest): Promise<AIResponse> {
    await this.limiter.acquire();
    const messages = buildMessages(request);

    // Gemini uses "contents" with role mapping: system → systemInstruction
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.model.maxOutputTokens,
      },
    };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    }
    if (request.jsonMode) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }
    if (request.stopSequences?.length) {
      (body.generationConfig as Record<string, unknown>).stopSequences = request.stopSequences;
    }

    const start = performance.now();
    const resp = await withTimeout(
      this.fetchFn(this.endpoint('generateContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.config.customHeaders },
        body: JSON.stringify(body),
      }),
      this.config.timeoutMs ?? 60_000,
      'gemini',
    );

    if (!resp.ok) throw mapGeminiError(resp.status, await resp.text());

    const json = await resp.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> }; finishReason: string }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };

    const latencyMs = Math.round(performance.now() - start);
    const usage: AIUsage = {
      promptTokens: json.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: json.usageMetadata?.totalTokenCount ?? 0,
    };
    const cost = calculateCost(usage, this.model);
    costTracker.record('gemini', this.config.model, cost);

    const content = json.candidates?.[0]?.content.parts.map((p) => p.text).join('') ?? '';
    const finishMap: Record<string, AIResponse['finishReason']> = {
      STOP: 'stop', MAX_TOKENS: 'length', SAFETY: 'content_filter',
    };

    return {
      content,
      usage,
      cost,
      model: this.config.model,
      provider: 'gemini',
      finishReason: finishMap[json.candidates?.[0]?.finishReason ?? ''] ?? 'unknown',
      latencyMs,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    await this.limiter.acquire();
    const messages = buildMessages(request);
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.model.maxOutputTokens,
      },
    };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    }

    const resp = await this.fetchFn(this.endpoint('streamGenerateContent') + '&alt=sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.customHeaders },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw mapGeminiError(resp.status, await resp.text());

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
        try {
          const chunk = JSON.parse(data) as { candidates?: Array<{ content: { parts: Array<{ text: string }> }; finishReason?: string }> };
          const text = chunk.candidates?.[0]?.content.parts.map((p) => p.text).join('') ?? '';
          const isDone = chunk.candidates?.[0]?.finishReason === 'STOP';
          yield { content: text, done: isDone };
        } catch { /* skip */ }
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    await this.limiter.acquire();
    const resp = await withTimeout(
      this.fetchFn(this.endpoint('embedContent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      }),
      this.config.timeoutMs ?? 30_000,
      'gemini',
    );
    if (!resp.ok) throw mapGeminiError(resp.status, await resp.text());
    const json = await resp.json() as { embedding: { values: number[] } };
    return json.embedding?.values ?? [];
  }

  getModelInfo(): ModelInfo { return this.model; }
  async listModels(): Promise<ModelInfo[]> { return GEMINI_MODELS; }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    try {
      await this.doComplete({ userPrompt: 'Say "ok"', maxTokens: 5, temperature: 0 });
      return { ok: true, message: 'Connected to Gemini', latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Unknown error', latencyMs: Math.round(performance.now() - start) };
    }
  }
}

registerAdapter('gemini', (config) => new GeminiAdapter(config));
