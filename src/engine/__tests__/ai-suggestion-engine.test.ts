/**
 * AI Suggestion Engine tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AISuggestionEngine,
  buildSuggestionPrompt,
  parseSuggestions,
  type SuggestionContext,
} from '../ai/ai-suggestion-engine';
import { registerAdapter, costTracker, type AIProviderConfig } from '../ai/ai-adapter';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const BASE_CONTEXT: SuggestionContext = {
  factionId: 'us',
  turn: 5,
  nationState: {
    stability: 72, treasury: 850, gdp: 22_000, inflation: 3.2,
    militaryReadiness: 85, nuclearThreshold: 90, diplomaticInfluence: 78,
    popularity: 60, allianceCredibility: 65, techLevel: 88,
  },
  leaderProfile: {
    name: 'Test Leader', decisionStyle: 'Transactional', stressResponse: 'Deflect',
    riskTolerance: 70, primaryGoal: 'Economic dominance', redLines: ['Nuclear first strike'],
  },
  emotionalState: { stress: 40, confidence: 65, anger: 20, fear: 15, resolve: 70 },
  tensions: { china: 45, russia: 60, dprk: 80 },
  recentEvents: ['Trade tariffs imposed on China', 'Military exercises near DPRK border'],
  existingAgreements: ['NAP with EU', 'TradeDeal with Japan'],
};

const VALID_JSON_RESPONSE = JSON.stringify({
  suggestions: [
    {
      id: 'diplo-china-detente', category: 'diplomatic', title: 'Pursue China Détente',
      description: 'Open back-channel talks', reasoning: 'Tensions rising',
      confidence: 75, riskLevel: 'medium',
      estimatedImpact: { stability: 5, diplomaticInfluence: 10 },
      targetFaction: 'china', prerequisites: [], timeHorizon: 'short-term',
    },
    {
      id: 'mil-readiness-boost', category: 'military', title: 'Boost Readiness',
      description: 'Increase naval patrols', reasoning: 'DPRK tension',
      confidence: 80, riskLevel: 'low',
      estimatedImpact: { militaryReadiness: 10, treasury: -20 },
      prerequisites: ['Adequate budget'], timeHorizon: 'immediate',
    },
    {
      id: 'econ-tech-invest', category: 'technology', title: 'Tech Investment',
      description: 'Fund AI research', reasoning: 'Maintain edge',
      confidence: 65, riskLevel: 'low',
      estimatedImpact: { treasury: -50 },
      prerequisites: [], timeHorizon: 'long-term',
    },
  ],
});

// ─── Mock adapter ───────────────────────────────────────────────────────────

function registerMockAdapter(responseContent: string): void {
  registerAdapter('openai', () => ({
    provider: 'openai' as const,
    complete: vi.fn().mockResolvedValue({
      content: responseContent,
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      cost: { inputCost: 0.001, outputCost: 0.002, totalCost: 0.003, currency: 'USD' },
      model: 'gpt-4o',
      provider: 'openai',
      finishReason: 'stop' as const,
      latencyMs: 500,
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getModelInfo: vi.fn(),
    listModels: vi.fn(),
    testConnection: vi.fn(),
  }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildSuggestionPrompt', () => {
  it('includes faction and turn', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('US');
    expect(prompt).toContain('Turn 5');
  });

  it('includes all nation indicators', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('Stability');
    expect(prompt).toContain('72');
    expect(prompt).toContain('Treasury');
    expect(prompt).toContain('850');
    expect(prompt).toContain('Military Readiness');
  });

  it('includes leader profile', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('Test Leader');
    expect(prompt).toContain('Transactional');
    expect(prompt).toContain('Nuclear first strike');
  });

  it('includes emotional state', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('Stress 40');
    expect(prompt).toContain('Confidence 65');
  });

  it('includes tensions', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('china: 45');
    expect(prompt).toContain('dprk: 80');
  });

  it('includes recent events', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('Trade tariffs');
    expect(prompt).toContain('Military exercises');
  });

  it('includes existing agreements', () => {
    const prompt = buildSuggestionPrompt(BASE_CONTEXT);
    expect(prompt).toContain('NAP with EU');
    expect(prompt).toContain('TradeDeal with Japan');
  });

  it('handles missing optional fields', () => {
    const minimal: SuggestionContext = {
      factionId: 'china', turn: 1,
      nationState: { stability: 50, treasury: 100, gdp: 5000, inflation: 2, militaryReadiness: 50, nuclearThreshold: 50, diplomaticInfluence: 50, popularity: 50, allianceCredibility: 50, techLevel: 50 },
      tensions: {}, recentEvents: [], existingAgreements: [],
    };
    const prompt = buildSuggestionPrompt(minimal);
    expect(prompt).toContain('CHINA');
    expect(prompt).not.toContain('Leader Profile');
    expect(prompt).not.toContain('Emotional State');
  });
});

describe('parseSuggestions', () => {
  it('parses valid JSON array in { suggestions: [] } wrapper', () => {
    const sug = parseSuggestions(VALID_JSON_RESPONSE);
    expect(sug).toHaveLength(3);
    expect(sug[0]!.id).toBe('diplo-china-detente');
    expect(sug[0]!.category).toBe('diplomatic');
    expect(sug[0]!.confidence).toBe(75);
    expect(sug[0]!.riskLevel).toBe('medium');
    expect(sug[0]!.targetFaction).toBe('china');
  });

  it('parses raw array', () => {
    const raw = JSON.stringify([{ id: 'a', category: 'military', title: 'T', description: 'D', confidence: 90 }]);
    const sug = parseSuggestions(raw);
    expect(sug).toHaveLength(1);
    expect(sug[0]!.id).toBe('a');
  });

  it('clamps confidence to 0–100', () => {
    const raw = JSON.stringify({ suggestions: [{ confidence: 999 }] });
    const sug = parseSuggestions(raw);
    expect(sug[0]!.confidence).toBe(100);
  });

  it('defaults invalid category to domestic', () => {
    const raw = JSON.stringify({ suggestions: [{ category: 'space_warfare' }] });
    const sug = parseSuggestions(raw);
    expect(sug[0]!.category).toBe('domestic');
  });

  it('returns empty array for garbage input', () => {
    expect(parseSuggestions('not json at all')).toEqual([]);
  });

  it('caps at 10 suggestions', () => {
    const arr = Array.from({ length: 20 }, (_, i) => ({ id: `s-${i}` }));
    const sug = parseSuggestions(JSON.stringify({ suggestions: arr }));
    expect(sug.length).toBeLessThanOrEqual(10);
  });
});

describe('AISuggestionEngine', () => {
  const cfg: AIProviderConfig = { provider: 'openai', apiKey: 'test', model: 'gpt-4o' };

  beforeEach(() => {
    costTracker.clear();
    registerMockAdapter(VALID_JSON_RESPONSE);
  });

  it('suggest() returns parsed suggestions', async () => {
    const engine = new AISuggestionEngine(cfg);
    const result = await engine.suggest(BASE_CONTEXT);
    expect(result.suggestions).toHaveLength(3);
    expect(result.cached).toBe(false);
    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toBe('openai');
    expect(result.latencyMs).toBe(500);
  });

  it('caches identical contexts within TTL', async () => {
    const engine = new AISuggestionEngine(cfg);
    const r1 = await engine.suggest(BASE_CONTEXT);
    const r2 = await engine.suggest(BASE_CONTEXT);
    expect(r1.cached).toBe(false);
    expect(r2.cached).toBe(true);
  });

  it('clearCache() forces fresh request', async () => {
    const engine = new AISuggestionEngine(cfg);
    await engine.suggest(BASE_CONTEXT);
    engine.clearCache();
    const r2 = await engine.suggest(BASE_CONTEXT);
    expect(r2.cached).toBe(false);
  });

  it('setAdapter() swaps provider and clears cache', async () => {
    const engine = new AISuggestionEngine(cfg);
    await engine.suggest(BASE_CONTEXT);
    engine.setAdapter({ provider: 'openai', apiKey: 'new', model: 'gpt-4o-mini' });
    const r = await engine.suggest(BASE_CONTEXT);
    expect(r.cached).toBe(false);
  });
});
