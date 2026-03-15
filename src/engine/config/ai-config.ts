/**
 * Enhanced AI Configuration Constants — DR-187, FR-4100
 *
 * Defaults, provider metadata, and Ollama proxy/endpoint settings
 * consumed by the AI config engine.
 *
 * @see FR-4100 — Provider selection & model configuration
 * @see FR-4101 — Ollama local model discovery
 * @see FR-4104 — Connection testing
 */

export const aiConfigConfig = {
  defaults: {
    provider: 'openai' as const,
    model: 'gpt-4o',
    baseUrl: '',
    temperature: 0.7,
    maxTokens: 2048,
    budgetPerTurn: 0.10,
    budgetPerSession: 5.00,
  },
  ollamaDefaults: {
    baseUrl: 'http://localhost:11434',
    proxyPath: '/ollama-proxy',
    tagsEndpoint: '/api/tags',
    timeoutMs: 3000,
  },
  providers: {
    openai: { label: 'OpenAI', requiresApiKey: true, defaultModel: 'gpt-4o' },
    gemini: { label: 'Google Gemini', requiresApiKey: true, defaultModel: 'gemini-2.0-flash' },
    claude: { label: 'Anthropic Claude', requiresApiKey: true, defaultModel: 'claude-sonnet-4-20250514' },
    openrouter: { label: 'OpenRouter', requiresApiKey: true, defaultModel: 'openai/gpt-4o' },
    ollama: { label: 'Ollama (Local)', requiresApiKey: false, defaultModel: 'llama3.2' },
  },
} as const;
