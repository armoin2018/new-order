/**
 * CNFL-3605 — Ollama Adapter (local model connector)
 *
 * Implements AIAdapter for local Ollama instances. Zero API-key requirement,
 * auto-detects a running server at localhost:11434, and gracefully handles
 * offline scenarios.
 *
 * @module engine/ai/providers/ollama-adapter
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
  buildMessages,
  registerAdapter,
} from '../ai-adapter';

// ─── Default Models ─────────────────────────────────────────────────────────

const DEFAULT_MODELS: ModelInfo[] = [
  { modelId: 'llama3.1', provider: 'ollama', displayName: 'Llama 3.1 8B', contextWindow: 131_072, maxOutputTokens: 4096, inputPricePer1kTokens: 0, outputPricePer1kTokens: 0, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: false },
  { modelId: 'mistral', provider: 'ollama', displayName: 'Mistral 7B', contextWindow: 32_768, maxOutputTokens: 4096, inputPricePer1kTokens: 0, outputPricePer1kTokens: 0, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: false },
  { modelId: 'codellama', provider: 'ollama', displayName: 'Code Llama 7B', contextWindow: 16_384, maxOutputTokens: 4096, inputPricePer1kTokens: 0, outputPricePer1kTokens: 0, supportsStreaming: true, supportsJsonMode: false, supportsEmbeddings: false, supportsFunctionCalling: false },
  { modelId: 'nomic-embed-text', provider: 'ollama', displayName: 'Nomic Embed Text', contextWindow: 8192, maxOutputTokens: 0, inputPricePer1kTokens: 0, outputPricePer1kTokens: 0, supportsStreaming: false, supportsJsonMode: false, supportsEmbeddings: true, supportsFunctionCalling: false },
];

function findModel(modelId: string): ModelInfo {
  return DEFAULT_MODELS.find((m) => m.modelId === modelId) ?? {
    modelId,
    provider: 'ollama',
    displayName: modelId,
    contextWindow: 32_768,
    maxOutputTokens: 4096,
    inputPricePer1kTokens: 0,
    outputPricePer1kTokens: 0,
    supportsStreaming: true,
    supportsJsonMode: false,
    supportsEmbeddings: false,
    supportsFunctionCalling: false,
  };
}

// ─── Error Mapping ──────────────────────────────────────────────────────────

function mapError(status: number, body: string): AIError {
  if (status === 404) return new AIError(`Ollama model not found: ${body.slice(0, 100)}`, 'model_not_found', 'ollama', 404);
  if (status >= 500) return new AIError(`Ollama server error (${status})`, 'server_error', 'ollama', status, true);
  return new AIError(`Ollama error (${status}): ${body.slice(0, 200)}`, 'unknown', 'ollama', status);
}

function connectionError(): AIError {
  return new AIError(
    'Cannot connect to Ollama. Ensure Ollama is running (ollama serve).',
    'connection_error',
    'ollama',
    undefined,
    true,
  );
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class OllamaAdapter implements AIAdapter {
  readonly provider = 'ollama' as const;
  private readonly config: AIProviderConfig;
  private readonly model: ModelInfo;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: AIProviderConfig, fetchFn?: typeof globalThis.fetch) {
    this.config = config;
    this.model = findModel(config.model);
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  private get baseUrl(): string {
    if (this.config.baseUrl) return this.config.baseUrl;
    // In browser, use Vite proxy to avoid CORS issues with local Ollama
    if (typeof window !== 'undefined') return '/ollama-proxy';
    return 'http://localhost:11434';
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const messages = buildMessages(request);
    // Use stream: true internally (stream-collect pattern) so the connection
    // stays alive while Ollama generates tokens. With stream: false, Ollama
    // buffers the entire response and local models can easily exceed timeout.
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? this.model.maxOutputTokens,
      },
    };
    if (request.jsonMode) body.format = 'json';
    if (request.stopSequences?.length) body.options = { ...body.options as object, stop: request.stopSequences };

    const start = performance.now();
    // Connection timeout: how long to wait for Ollama to start responding.
    // Once streaming begins, no timeout — let the model finish generating.
    const connectTimeoutMs = this.config.timeoutMs ?? 120_000;
    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), connectTimeoutMs);
      resp = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AIError(`Ollama request timed out after ${connectTimeoutMs}ms`, 'timeout', 'ollama', undefined, true);
      }
      throw connectionError();
    }

    if (!resp.ok) throw mapError(resp.status, await resp.text());

    // Stream-collect: read all chunks and assemble into a single response.
    // This keeps the connection alive as long as Ollama is producing tokens.
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const contentParts: string[] = [];
    let promptTokens = 0;
    let evalTokens = 0;
    let doneReason = 'stop';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as {
            message?: { content: string };
            done: boolean;
            done_reason?: string;
            prompt_eval_count?: number;
            eval_count?: number;
          };
          if (chunk.message?.content) contentParts.push(chunk.message.content);
          if (chunk.done) {
            promptTokens = chunk.prompt_eval_count ?? 0;
            evalTokens = chunk.eval_count ?? 0;
            doneReason = chunk.done_reason ?? 'stop';
          }
        } catch { /* skip malformed line */ }
      }
    }

    const latencyMs = Math.round(performance.now() - start);
    const usage: AIUsage = {
      promptTokens,
      completionTokens: evalTokens,
      totalTokens: promptTokens + evalTokens,
    };

    return {
      content: contentParts.join(''),
      usage,
      cost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
      model: this.config.model,
      provider: 'ollama',
      finishReason: doneReason === 'stop' ? 'stop' : doneReason === 'length' ? 'length' : 'stop',
      latencyMs,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    const messages = buildMessages(request);
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? this.model.maxOutputTokens,
      },
    };
    if (request.jsonMode) body.format = 'json';

    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);
      resp = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AIError('Ollama stream request timed out', 'timeout', 'ollama', undefined, true);
      }
      throw connectionError();
    }

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
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as { message?: { content: string }; done: boolean };
          yield { content: chunk.message?.content ?? '', done: chunk.done };
          if (chunk.done) return;
        } catch { /* skip */ }
      }
    }
  }

  async embed(text: string): Promise<number[]> {
    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 60_000);
      resp = await this.fetchFn(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AIError('Ollama embed request timed out', 'timeout', 'ollama', undefined, true);
      }
      throw connectionError();
    }

    if (!resp.ok) throw mapError(resp.status, await resp.text());
    const json = await resp.json() as { embeddings: number[][] };
    return json.embeddings?.[0] ?? [];
  }

  getModelInfo(): ModelInfo { return this.model; }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const resp = await this.fetchFn(`${this.baseUrl}/api/tags`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) return DEFAULT_MODELS;
      const json = await resp.json() as { models: Array<{ name: string; details?: { parameter_size?: string } }> };
      return json.models.map((m) => ({
        modelId: m.name,
        provider: 'ollama' as const,
        displayName: m.name,
        contextWindow: 32_768,
        maxOutputTokens: 4096,
        inputPricePer1kTokens: 0,
        outputPricePer1kTokens: 0,
        supportsStreaming: true,
        supportsJsonMode: false,
        supportsEmbeddings: m.name.includes('embed'),
        supportsFunctionCalling: false,
      }));
    } catch {
      return DEFAULT_MODELS;
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    try {
      const resp = await this.fetchFn(`${this.baseUrl}/api/tags`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.ok) {
        const json = await resp.json() as { models: unknown[] };
        return { ok: true, message: `Ollama running with ${json.models?.length ?? 0} models`, latencyMs: Math.round(performance.now() - start) };
      }
      return { ok: false, message: `Ollama responded with ${resp.status}`, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return { ok: false, message: 'Cannot connect to Ollama. Ensure Ollama is running (ollama serve).', latencyMs: Math.round(performance.now() - start) };
    }
  }
}

registerAdapter('ollama', (config) => new OllamaAdapter(config));
