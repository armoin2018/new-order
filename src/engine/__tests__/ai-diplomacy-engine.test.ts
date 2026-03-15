/**
 * AI Diplomacy Engine tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIDiplomacyEngine,
  buildDiplomacySystemPrompt,
  extractAction,
  type DiplomacyPersonality,
  type DiplomacyEmotions,
  type DiplomacyRelationship,
  type ExtractedAction,
} from '../ai/ai-diplomacy-engine';
import { registerAdapter, costTracker, type AIProviderConfig } from '../ai/ai-adapter';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const PERSONALITY: DiplomacyPersonality = {
  leaderName: 'Xi Jinping',
  factionId: 'china',
  decisionStyle: 'Analytical',
  stressResponse: 'Consolidate',
  riskTolerance: 45,
  paranoia: 60,
  narcissism: 40,
  pragmatism: 75,
  patience: 70,
  vengefulIndex: 50,
  primaryGoal: 'National rejuvenation',
  ideologicalCore: 'Socialism with Chinese characteristics',
  redLines: ['Taiwan independence', 'Regime change'],
};

const EMOTIONS: DiplomacyEmotions = {
  stress: 40, confidence: 70, anger: 20, fear: 15, resolve: 75,
};

const RELATIONSHIP: DiplomacyRelationship = {
  tensionLevel: 45, trust: 20, chemistry: -5, grudgeCount: 2,
  activeAgreements: ['TradeDeal'],
};

// ─── Mock adapter ───────────────────────────────────────────────────────────

function registerMockDiploAdapter(responseText: string): void {
  registerAdapter('openai', () => ({
    provider: 'openai' as const,
    complete: vi.fn().mockResolvedValue({
      content: responseText,
      usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 },
      cost: { inputCost: 0.002, outputCost: 0.003, totalCost: 0.005, currency: 'USD' },
      model: 'gpt-4o',
      provider: 'openai',
      finishReason: 'stop' as const,
      latencyMs: 800,
    }),
    stream: vi.fn(),
    embed: vi.fn(),
    getModelInfo: vi.fn(),
    listModels: vi.fn(),
    testConnection: vi.fn(),
  }));
}

const SAMPLE_RESPONSE = `I appreciate your interest in dialogue. However, the matter of technology transfers requires careful consideration. We cannot rush into such arrangements without proper safeguards.

\`\`\`json
{"action":{"type":"counter","agreementType":"TradeDeal","conditions":["Include IP protections","5-year review clause"],"tone":"neutral"}}
\`\`\``;

const CFG: AIProviderConfig = { provider: 'openai', apiKey: 'test', model: 'gpt-4o' };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildDiplomacySystemPrompt', () => {
  it('includes leader name and faction', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('Xi Jinping');
    expect(prompt).toContain('CHINA');
    expect(prompt).toContain('US');
  });

  it('includes personality traits', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('Analytical');
    expect(prompt).toContain('Consolidate');
    expect(prompt).toContain('Risk Tolerance: 45');
    expect(prompt).toContain('Pragmatism: 75');
  });

  it('includes red lines', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('Taiwan independence');
    expect(prompt).toContain('Regime change');
  });

  it('includes emotional state', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('Stress: 40');
    expect(prompt).toContain('Confidence: 70');
  });

  it('flags high stress', () => {
    const highStress: DiplomacyEmotions = { ...EMOTIONS, stress: 80 };
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, highStress, RELATIONSHIP, 'us');
    expect(prompt).toContain('extreme stress');
  });

  it('flags high anger', () => {
    const angry: DiplomacyEmotions = { ...EMOTIONS, anger: 70 };
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, angry, RELATIONSHIP, 'us');
    expect(prompt).toContain('angry');
  });

  it('flags high confidence', () => {
    const confident: DiplomacyEmotions = { ...EMOTIONS, confidence: 90 };
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, confident, RELATIONSHIP, 'us');
    expect(prompt).toContain('position of strength');
  });

  it('includes relationship context', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('Tension: 45');
    expect(prompt).toContain('Trust: 20');
    expect(prompt).toContain('Grudges: 2');
    expect(prompt).toContain('TradeDeal');
  });

  it('includes action JSON schema instruction', () => {
    const prompt = buildDiplomacySystemPrompt(PERSONALITY, EMOTIONS, RELATIONSHIP, 'us');
    expect(prompt).toContain('"type"');
    expect(prompt).toContain('propose|accept|reject|counter|threaten|stall|walkaway');
  });
});

describe('extractAction', () => {
  it('extracts action from JSON code block', () => {
    const action = extractAction(SAMPLE_RESPONSE);
    expect(action.type).toBe('counter');
    expect(action.agreementType).toBe('TradeDeal');
    expect(action.conditions).toEqual(['Include IP protections', '5-year review clause']);
    expect(action.tone).toBe('neutral');
  });

  it('handles inline JSON without code fence', () => {
    const text = 'I reject this proposal. {"action":{"type":"reject","tone":"cold"}}';
    const action = extractAction(text);
    expect(action.type).toBe('reject');
    expect(action.tone).toBe('cold');
  });

  it('falls back to heuristic on invalid JSON', () => {
    const action = extractAction('I refuse this deal entirely. Never will we agree.');
    expect(action.type).toBe('reject');
  });

  it('infers accept from keywords', () => {
    const action = extractAction('We agree to this deal. Let us proceed.');
    expect(action.type).toBe('accept');
  });

  it('infers threaten from keywords', () => {
    const action = extractAction('There will be consequences if you continue.');
    expect(action.type).toBe('threaten');
  });

  it('infers propose from keywords', () => {
    const action = extractAction('We would like to offer you a trade partnership.');
    expect(action.type).toBe('propose');
  });

  it('infers walkaway from keywords', () => {
    const action = extractAction('This negotiation is over. I will leave now.');
    expect(action.type).toBe('walkaway');
  });

  it('defaults to stall for ambiguous text', () => {
    const action = extractAction('Hmm, let me think about this for a while.');
    expect(action.type).toBe('stall');
  });

  it('infers tone from text', () => {
    expect(extractAction('This is wonderful news, my friend!').tone).toBe('friendly');
    expect(extractAction('You will regret this. We will destroy your economy.').tone).toBe('threatening');
    expect(extractAction('I am disappointed by this unfortunate development.').tone).toBe('cold');
  });
});

describe('AIDiplomacyEngine', () => {
  beforeEach(() => {
    costTracker.clear();
    registerMockDiploAdapter(SAMPLE_RESPONSE);
  });

  it('startSession() creates active session', () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    expect(session.active).toBe(true);
    expect(session.playerFaction).toBe('us');
    expect(session.counterpartFaction).toBe('china');
    expect(session.messages).toHaveLength(0);
  });

  it('negotiate() exchanges messages', async () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    const resp = await engine.negotiate(session.sessionId, 'Let us discuss a trade deal.', EMOTIONS);

    expect(resp.message.role).toBe('leader');
    expect(resp.message.text).toContain('technology transfers');
    expect(resp.extractedAction.type).toBe('counter');
    expect(resp.model).toBe('gpt-4o');
    expect(resp.latencyMs).toBe(800);

    // Session should now have 2 messages (player + leader)
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]!.role).toBe('player');
    expect(session.messages[1]!.role).toBe('leader');
  });

  it('negotiate() strips JSON from displayed message', async () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    const resp = await engine.negotiate(session.sessionId, 'Hello', EMOTIONS);
    expect(resp.message.text).not.toContain('```json');
    expect(resp.message.text).not.toContain('"action"');
  });

  it('negotiate() throws for unknown session', async () => {
    const engine = new AIDiplomacyEngine(CFG);
    await expect(engine.negotiate('bogus', 'Hi', EMOTIONS)).rejects.toThrow('not found');
  });

  it('negotiate() throws for inactive session', async () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    engine.endSession(session.sessionId);
    await expect(engine.negotiate(session.sessionId, 'Hi', EMOTIONS)).rejects.toThrow('no longer active');
  });

  it('walkaway action auto-closes session', async () => {
    registerMockDiploAdapter('This negotiation is over. I walk away.\n```json\n{"action":{"type":"walkaway","tone":"hostile"}}\n```');
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    await engine.negotiate(session.sessionId, 'Accept our terms!', EMOTIONS);
    expect(session.active).toBe(false);
  });

  it('endSession() marks session inactive', () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'russia', PERSONALITY, RELATIONSHIP, 3);
    engine.endSession(session.sessionId);
    expect(session.active).toBe(false);
  });

  it('getActiveSessions() returns only active', () => {
    const engine = new AIDiplomacyEngine(CFG);
    engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    const s2 = engine.startSession('us', 'russia', PERSONALITY, RELATIONSHIP, 5);
    engine.endSession(s2.sessionId);
    expect(engine.getActiveSessions()).toHaveLength(1);
  });

  it('getSession() retrieves by ID', () => {
    const engine = new AIDiplomacyEngine(CFG);
    const session = engine.startSession('us', 'china', PERSONALITY, RELATIONSHIP, 5);
    expect(engine.getSession(session.sessionId)).toBe(session);
    expect(engine.getSession('nonexistent')).toBeUndefined();
  });
});
