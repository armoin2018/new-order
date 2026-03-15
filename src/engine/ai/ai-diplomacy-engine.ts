/**
 * CNFL-3607 — AI Diplomacy Engine
 *
 * Drives natural-language diplomatic negotiations between the player and
 * AI-controlled factions. Uses leader psychology profiles (MBTI, Big Five
 * analogues, decision style, stress response) to generate personality-consistent
 * responses. Tracks negotiation state and extracts structured actions from the
 * LLM's natural-language replies.
 *
 * @module engine/ai/ai-diplomacy-engine
 */

import type { FactionId } from '../../data/types';
import {
  type AIAdapter,
  type AIRequest,
  type AIResponse,
  type AIMessage,
  type AIProviderConfig,
  createAdapter,
} from './ai-adapter';

// ─── Public Types ───────────────────────────────────────────────────────────

/** Personality snapshot used to construct the negotiation system prompt. */
export interface DiplomacyPersonality {
  readonly leaderName: string;
  readonly factionId: FactionId;
  readonly decisionStyle: string;
  readonly stressResponse: string;
  readonly riskTolerance: number;          // 0–100
  readonly paranoia: number;
  readonly narcissism: number;
  readonly pragmatism: number;
  readonly patience: number;
  readonly vengefulIndex: number;
  readonly primaryGoal?: string;
  readonly ideologicalCore?: string;
  readonly redLines?: string[];
}

/** Current emotional state of the AI leader. */
export interface DiplomacyEmotions {
  readonly stress: number;
  readonly confidence: number;
  readonly anger: number;
  readonly fear: number;
  readonly resolve: number;
}

/** Relationship context between two factions. */
export interface DiplomacyRelationship {
  readonly tensionLevel: number;           // −100 to +100
  readonly trust: number;                  // −100 to +100
  readonly chemistry: number;              // −50  to +50
  readonly grudgeCount: number;
  readonly activeAgreements: string[];
}

/** A single negotiation message (displayed in the diplomacy UI). */
export interface NegotiationMessage {
  readonly role: 'player' | 'leader';
  readonly text: string;
  readonly turn: number;
  readonly timestamp: number;
}

/** Structured action extracted from the AI leader's response. */
export interface ExtractedAction {
  readonly type: 'propose' | 'accept' | 'reject' | 'counter' | 'threaten' | 'stall' | 'walkaway';
  readonly agreementType?: string;         // NAP, TradeDeal, DefensePact, etc.
  readonly conditions?: string[];
  readonly tone: 'friendly' | 'neutral' | 'cold' | 'hostile' | 'threatening';
}

/** Full response from a single negotiation exchange. */
export interface NegotiationResponse {
  readonly message: NegotiationMessage;
  readonly extractedAction: ExtractedAction;
  readonly model: string;
  readonly provider: string;
  readonly latencyMs: number;
}

/** Encapsulates the full state of an ongoing negotiation session. */
export interface NegotiationSession {
  readonly sessionId: string;
  readonly playerFaction: FactionId;
  readonly counterpartFaction: FactionId;
  readonly personality: DiplomacyPersonality;
  readonly relationship: DiplomacyRelationship;
  readonly messages: NegotiationMessage[];
  readonly turn: number;
  active: boolean;
}

// ─── System Prompt Builder ──────────────────────────────────────────────────

export function buildDiplomacySystemPrompt(
  personality: DiplomacyPersonality,
  emotions: DiplomacyEmotions,
  relationship: DiplomacyRelationship,
  playerFaction: FactionId,
): string {
  const lines: string[] = [];
  lines.push(`You are ${personality.leaderName}, the leader of ${personality.factionId.toUpperCase()}.`);
  lines.push(`You are currently in a diplomatic negotiation with ${playerFaction.toUpperCase()}.`);
  lines.push('');
  lines.push('## Your Personality');
  lines.push(`- Decision Style: ${personality.decisionStyle}`);
  lines.push(`- Stress Response: ${personality.stressResponse}`);
  lines.push(`- Risk Tolerance: ${personality.riskTolerance}/100`);
  lines.push(`- Paranoia: ${personality.paranoia}/100`);
  lines.push(`- Narcissism: ${personality.narcissism}/100`);
  lines.push(`- Pragmatism: ${personality.pragmatism}/100`);
  lines.push(`- Patience: ${personality.patience}/100`);
  lines.push(`- Vengeful Index: ${personality.vengefulIndex}/100`);
  if (personality.primaryGoal) lines.push(`- Primary Goal: ${personality.primaryGoal}`);
  if (personality.ideologicalCore) lines.push(`- Ideological Core: ${personality.ideologicalCore}`);
  if (personality.redLines?.length) {
    lines.push(`- Red Lines (NEVER agree to): ${personality.redLines.join('; ')}`);
  }
  lines.push('');

  lines.push('## Your Current Emotional State');
  lines.push(`Stress: ${emotions.stress}/100 | Confidence: ${emotions.confidence}/100 | Anger: ${emotions.anger}/100 | Fear: ${emotions.fear}/100 | Resolve: ${emotions.resolve}/100`);

  // Emotional influence
  if (emotions.stress > 70) lines.push('⚠ You are under extreme stress. You may be less patient and more reactive.');
  if (emotions.anger > 60) lines.push('⚠ You are angry. You tend toward confrontational language.');
  if (emotions.confidence > 80) lines.push('💪 You feel confident. You negotiate from a position of strength.');
  if (emotions.fear > 60) lines.push('⚠ You feel threatened. You may be more cautious or defensive.');
  lines.push('');

  lines.push('## Relationship with ' + playerFaction.toUpperCase());
  lines.push(`- Tension: ${relationship.tensionLevel} (−100=allied … +100=hostile)`);
  lines.push(`- Trust: ${relationship.trust} (−100 … +100)`);
  lines.push(`- Personal Chemistry: ${relationship.chemistry} (−50 … +50)`);
  if (relationship.grudgeCount > 0) lines.push(`- Unresolved Grudges: ${relationship.grudgeCount}`);
  if (relationship.activeAgreements.length) lines.push(`- Active Agreements: ${relationship.activeAgreements.join(', ')}`);
  lines.push('');

  lines.push('## Rules');
  lines.push('1. Stay in character at all times. React as this leader would.');
  lines.push('2. Your responses should reflect your personality traits and emotional state.');
  lines.push('3. If trust is low or grudges are high, be more suspicious.');
  lines.push('4. Never break your red lines regardless of pressure.');
  lines.push('5. After your in-character response, add a JSON block with your intended action:');
  lines.push('```json');
  lines.push('{"action":{"type":"propose|accept|reject|counter|threaten|stall|walkaway","agreementType":"optional","conditions":["optional"],"tone":"friendly|neutral|cold|hostile|threatening"}}');
  lines.push('```');
  lines.push('6. Keep your response concise (2–4 sentences of dialogue + the action JSON).');

  return lines.join('\n');
}

// ─── Action Extractor ───────────────────────────────────────────────────────

const VALID_ACTION_TYPES = new Set(['propose', 'accept', 'reject', 'counter', 'threaten', 'stall', 'walkaway']);
const VALID_TONES = new Set(['friendly', 'neutral', 'cold', 'hostile', 'threatening']);

export function extractAction(text: string): ExtractedAction {
  // Try to find JSON block in the response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const raw = jsonMatch[1] ?? jsonMatch[0];
      const parsed = JSON.parse(raw);
      const action = parsed.action ?? parsed;
      return {
        type: VALID_ACTION_TYPES.has(action.type) ? action.type : inferActionType(text),
        agreementType: typeof action.agreementType === 'string' ? action.agreementType : undefined,
        conditions: Array.isArray(action.conditions) ? action.conditions.map(String) : [],
        tone: VALID_TONES.has(action.tone) ? action.tone : inferTone(text),
      };
    } catch { /* fall through to heuristic */ }
  }

  // Heuristic fallback
  return {
    type: inferActionType(text),
    tone: inferTone(text),
    conditions: [],
  };
}

function inferActionType(text: string): ExtractedAction['type'] {
  const lower = text.toLowerCase();
  if (lower.includes('walk away') || lower.includes('leave') || lower.includes('over')) return 'walkaway';
  if (lower.includes('threaten') || lower.includes('warn') || lower.includes('consequences')) return 'threaten';
  if (lower.includes('reject') || lower.includes('refuse') || lower.includes('never')) return 'reject';
  if (lower.includes('counter') || lower.includes('instead') || lower.includes('alternative')) return 'counter';
  if (lower.includes('accept') || lower.includes('agree') || lower.includes('deal')) return 'accept';
  if (lower.includes('propose') || lower.includes('offer') || lower.includes('suggest')) return 'propose';
  return 'stall';
}

function inferTone(text: string): ExtractedAction['tone'] {
  const lower = text.toLowerCase();
  if (lower.includes('friend') || lower.includes('pleased') || lower.includes('wonderful')) return 'friendly';
  if (lower.includes('threat') || lower.includes('destroy') || lower.includes('regret')) return 'threatening';
  if (lower.includes('hostile') || lower.includes('enemy') || lower.includes('war')) return 'hostile';
  if (lower.includes('cold') || lower.includes('disappoint') || lower.includes('unfortunate')) return 'cold';
  return 'neutral';
}

// ─── Engine ─────────────────────────────────────────────────────────────────

let sessionCounter = 0;

export class AIDiplomacyEngine {
  private adapter: AIAdapter;
  private sessions: Map<string, NegotiationSession> = new Map();

  constructor(config: AIProviderConfig) {
    this.adapter = createAdapter(config);
  }

  /** Swap adapter at runtime. */
  setAdapter(config: AIProviderConfig): void {
    this.adapter = createAdapter(config);
  }

  /** Start a new negotiation session. */
  startSession(
    playerFaction: FactionId,
    counterpartFaction: FactionId,
    personality: DiplomacyPersonality,
    relationship: DiplomacyRelationship,
    turn: number,
  ): NegotiationSession {
    const sessionId = `diplo-${++sessionCounter}-${playerFaction}-${counterpartFaction}`;
    const session: NegotiationSession = {
      sessionId,
      playerFaction,
      counterpartFaction,
      personality,
      relationship,
      messages: [],
      turn,
      active: true,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /** Send a player message and get the AI leader's response. */
  async negotiate(
    sessionId: string,
    playerMessage: string,
    emotions: DiplomacyEmotions,
  ): Promise<NegotiationResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Negotiation session "${sessionId}" not found`);
    if (!session.active) throw new Error(`Negotiation session "${sessionId}" is no longer active`);

    // Record player message
    const playerMsg: NegotiationMessage = {
      role: 'player',
      text: playerMessage,
      turn: session.turn,
      timestamp: Date.now(),
    };
    (session.messages as NegotiationMessage[]).push(playerMsg);

    // Build conversation history for the LLM
    const systemPrompt = buildDiplomacySystemPrompt(
      session.personality,
      emotions,
      session.relationship,
      session.playerFaction,
    );

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
    ];
    // Include last N messages for context
    const recent = session.messages.slice(-10);
    for (const m of recent) {
      messages.push({
        role: m.role === 'player' ? 'user' : 'assistant',
        content: m.text,
      });
    }

    const request: AIRequest = {
      userPrompt: playerMessage,
      messages,
      temperature: 0.8,
      maxTokens: 512,
    };

    const response: AIResponse = await this.adapter.complete(request);
    const extractedAction = extractAction(response.content);

    // Strip the JSON block from the displayed message
    const displayText = response.content
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*"action"[\s\S]*\}/g, '')
      .trim() || response.content;

    const leaderMsg: NegotiationMessage = {
      role: 'leader',
      text: displayText,
      turn: session.turn,
      timestamp: Date.now(),
    };
    (session.messages as NegotiationMessage[]).push(leaderMsg);

    // Auto-close on walkaway
    if (extractedAction.type === 'walkaway') {
      session.active = false;
    }

    return {
      message: leaderMsg,
      extractedAction,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latencyMs,
    };
  }

  /** End a negotiation session. */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.active = false;
  }

  /** Get session by ID. */
  getSession(sessionId: string): NegotiationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Get all active sessions. */
  getActiveSessions(): NegotiationSession[] {
    return [...this.sessions.values()].filter((s) => s.active);
  }

  getAdapter(): AIAdapter {
    return this.adapter;
  }
}
