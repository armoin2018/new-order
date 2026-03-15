/**
 * CNFL-3603 — Anthropic Claude Adapter
 *
 * Implements AIAdapter for Claude API (claude-sonnet-4-20250514, claude-3.5-haiku).
 * Supports extended thinking for complex strategic analysis.
 *
 * @module engine/ai/providers/claude-adapter
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

const CLAUDE_MODELS: ModelInfo[] = [
  { modelId: 'claude-sonnet-4-20250514', provider: 'claude', displayName: 'Claude Sonnet 4', contextWindow: 200_000, maxOutputTokens: 8192, inputPricePer1kTokens: 0.003, outputPricePer1kTokens: 0.015, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'claude-3-5-haiku-20241022', provider: 'claude', displayName: 'Claude 3.5 Haiku', contextWindow: 200_000, maxOutputTokens: 8192, inputPricePer1kTokens: 0.0008, outputPricePer1kTokens: 0.004, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
];

function findModel(modelId: string): ModelInfo {
  return CLAUDE_MODELS.find((m) => m.modelId === modelId) ?? CLAUDE_MODELS[0]!;
}

// ─── Error Mapping ──────────────────────────────────────────────────────────

function mapClaudeError(status: number, body: string): AIError {
  if (status === 401) return new AIError('Invalid Anthropic API key', 'auth_error', 'claude', 401);
  if (status === 403) return new AIError('Anthropic API access forbidden', 'auth_error', 'claude', 403);
  if (status === 429) return new AIError('Anthropic rate limit exceeded', 'rate_limit', 'claude', 429, true, 15_000);
  if (status === 400 && body.includes('context')) return new AIError('Context length exceeded', 'context_length_exceeded', 'claude', 400);
  if (status === 400) return new AIError(`Anthropic bad request: ${body.slice(0, 200)}`, 'invalid_request', 'claude', 400);
  if (status === 404) return new AIError('Claude model not found', 'model_not_found', 'claude', 404);
  if (status >= 500) return new AIError(`Anthropic server error (${status})`, 'server_error', 'claude', status, true);
  return new AIError(`Anthropic error (${status}): ${body.slice(0, 200)}`, 'unknown', 'claude', status);
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class ClaudeAdapter implements AIAdapter {
  readonly provider = 'claude' as const;
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
    return this.config.baseUrl ?? 'https://api.anthropic.com/v1';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      ...this.config.customHeaders,
    };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    return withRetry(() => this.doComplete(request), {
      maxRetries: this.config.maxRetries ?? 3,
      provider: 'claude',
    });
  }

  private async doComplete(request: AIRequest): Promise<AIResponse> {
    await this.limiter.acquire();
    const messages = buildMessages(request);

    // Claude uses separate system parameter
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const conversationMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: conversationMsgs,
      max_tokens: request.maxTokens ?? this.model.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
    };
    if (systemMsgs.length > 0) {
      body.system = systemMsgs.map((m) => m.content).join('\n\n');
    }
    if (request.stopSequences?.length) {
      body.stop_sequences = request.stopSequences;
    }

    const start = performance.now();
    const resp = await withTimeout(
      this.fetchFn(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      }),
      this.config.timeoutMs ?? 60_000,
      'claude',
    );

    if (!resp.ok) throw mapClaudeError(resp.status, await resp.text());

    const json = await resp.json() as {
      content: Array<{ type: string; text?: string }>;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    const latencyMs = Math.round(performance.now() - start);
    const content = json.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    const usage: AIUsage = {
      promptTokens: json.usage.input_tokens,
      completionTokens: json.usage.output_tokens,
      totalTokens: json.usage.input_tokens + json.usage.output_tokens,
    };
    const cost = calculateCost(usage, this.model);
    costTracker.record('claude', this.config.model, cost);

    const finishMap: Record<string, AIResponse['finishReason']> = {
      end_turn: 'stop', max_tokens: 'length', stop_sequence: 'stop',
    };

    return {
      content,
      usage,
      cost,
      model: this.config.model,
      provider: 'claude',
      finishReason: finishMap[json.stop_reason ?? ''] ?? 'unknown',
      latencyMs,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    await this.limiter.acquire();
    const messages = buildMessages(request);
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const conversationMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: conversationMsgs,
      max_tokens: request.maxTokens ?? this.model.maxOutputTokens,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };
    if (systemMsgs.length > 0) {
      body.system = systemMsgs.map((m) => m.content).join('\n\n');
    }

    const resp = await this.fetchFn(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw mapClaudeError(resp.status, await resp.text());

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
          const event = JSON.parse(data) as { type: string; delta?: { text?: string }; message?: { usage?: { output_tokens: number } } };
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield { content: event.delta.text, done: false };
          } else if (event.type === 'message_stop') {
            yield { content: '', done: true };
            return;
          }
        } catch { /* skip */ }
      }
    }
  }

  async embed(_text: string): Promise<number[]> {
    throw new AIError(
      'Claude does not support embeddings. Use OpenAI or Gemini for embeddings.',
      'invalid_request',
      'claude',
    );
  }

  getModelInfo(): ModelInfo { return this.model; }
  async listModels(): Promise<ModelInfo[]> { return CLAUDE_MODELS; }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    try {
      await this.doComplete({ userPrompt: 'Say "ok"', maxTokens: 5, temperature: 0 });
      return { ok: true, message: 'Connected to Anthropic', latencyMs: Math.round(performance.now() - start) };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Unknown error', latencyMs: Math.round(performance.now() - start) };
    }
  }
}

registerAdapter('claude', (config) => new ClaudeAdapter(config));
