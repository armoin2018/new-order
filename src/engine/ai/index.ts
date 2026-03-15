/**
 * AI module barrel — re-exports all AI adapter types, providers, and engines.
 */

// ── Core adapter types & utilities ──
export {
  type AIProvider,
  type MessageRole,
  type AIMessage,
  type AIRequest,
  type AIUsage,
  type AICost,
  type AIResponse,
  type AIChunk,
  type ModelInfo,
  type AIProviderConfig,
  type AIErrorCode,
  type AIAdapter,
  type CostRecord,
  AIError,
  sleep,
  withRetry,
  withTimeout,
  RateLimiter,
  calculateCost,
  buildMessages,
  registerAdapter,
  createAdapter,
  getRegisteredProviders,
  CostTracker,
  costTracker,
} from './ai-adapter';

// ── Provider adapters (import for side-effect registration) ──
export { OpenAIAdapter } from './providers/openai-adapter';
export { GeminiAdapter } from './providers/gemini-adapter';
export { ClaudeAdapter } from './providers/claude-adapter';
export { OpenRouterAdapter } from './providers/openrouter-adapter';
export { OllamaAdapter } from './providers/ollama-adapter';

// ── Suggestion Engine ──
export {
  type AISuggestion,
  type AISuggestionCategory,
  type SuggestionImpact,
  type SuggestionResult,
  type SuggestionContext,
  AISuggestionEngine,
  buildSuggestionPrompt,
  parseSuggestions,
} from './ai-suggestion-engine';

// ── Diplomacy Engine ──
export {
  type DiplomacyPersonality,
  type DiplomacyEmotions,
  type DiplomacyRelationship,
  type NegotiationMessage,
  type ExtractedAction,
  type NegotiationResponse,
  type NegotiationSession,
  AIDiplomacyEngine,
  buildDiplomacySystemPrompt,
  extractAction,
} from './ai-diplomacy-engine';

// ── Deep AI Strategy Engine ──
export {
  type DynamicsAssessment,
  type ThreatOpportunity,
  type DeepRoundAnalysis,
  type DeepAIStrategyConfig,
  DeepAIStrategyEngine,
} from './deep-ai-strategy';
