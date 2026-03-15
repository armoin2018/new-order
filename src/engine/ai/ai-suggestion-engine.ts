/**
 * CNFL-3606 — AI Suggestion Engine
 *
 * Uses the unified AI adapter layer to generate strategic suggestions for the
 * player based on the current game state, nation stats, threats, diplomatic
 * relationships, psychological profiles, and recent events.
 *
 * Features:
 * - Contextual prompt construction from live game state
 * - Structured JSON suggestion format
 * - Caching / dedup of identical contexts within a turn
 * - Rate-limited requests via the adapter layer
 *
 * @module engine/ai/ai-suggestion-engine
 */

import type { FactionId } from '../../data/types';
import {
  type AIAdapter,
  type AIRequest,
  type AIResponse,
  type AIProviderConfig,
  createAdapter,
} from './ai-adapter';

// ─── Public Types ───────────────────────────────────────────────────────────

/** A single strategic suggestion returned by the AI. */
export interface AISuggestion {
  readonly id: string;
  readonly category: AISuggestionCategory;
  readonly title: string;
  readonly description: string;
  readonly reasoning: string;
  readonly confidence: number;            // 0–100
  readonly riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  readonly estimatedImpact: SuggestionImpact;
  readonly targetFaction?: FactionId;
  readonly prerequisites: string[];
  readonly timeHorizon: 'immediate' | 'short-term' | 'long-term';
}

export type AISuggestionCategory =
  | 'military'
  | 'diplomatic'
  | 'economic'
  | 'technology'
  | 'intelligence'
  | 'domestic'
  | 'crisis';

export interface SuggestionImpact {
  stability?: number;
  treasury?: number;
  diplomaticInfluence?: number;
  militaryReadiness?: number;
  popularity?: number;
}

/** The full result set from a suggestion request. */
export interface SuggestionResult {
  readonly suggestions: readonly AISuggestion[];
  readonly context: string;
  readonly model: string;
  readonly provider: string;
  readonly latencyMs: number;
  readonly cached: boolean;
}

/**
 * Minimal game-state snapshot passed to the suggestion engine.
 * The caller extracts the relevant slice from the full GameState
 * so this module stays decoupled from the store.
 */
export interface SuggestionContext {
  readonly factionId: FactionId;
  readonly turn: number;
  readonly nationState: {
    stability: number;
    treasury: number;
    gdp: number;
    inflation: number;
    militaryReadiness: number;
    nuclearThreshold: number;
    diplomaticInfluence: number;
    popularity: number;
    allianceCredibility: number;
    techLevel: number;
  };
  readonly leaderProfile?: {
    name: string;
    decisionStyle: string;
    stressResponse: string;
    riskTolerance: number;
    primaryGoal?: string;
    redLines?: string[];
  };
  readonly emotionalState?: {
    stress: number;
    confidence: number;
    anger: number;
    fear: number;
    resolve: number;
  };
  readonly tensions: Record<string, number>;
  readonly recentEvents: string[];
  readonly existingAgreements: string[];
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strategic advisor in a geopolitical simulation game called "New Order".
You analyse the current situation and provide actionable strategic suggestions.

Rules:
- Always return valid JSON matching the schema.
- Provide 3–5 ranked suggestions.
- Each suggestion must include confidence (0–100) and risk level.
- Consider the leader's personality, stress level, and national priorities.
- Balance short-term survival with long-term strategic advantage.
- Flag any suggestion that crosses a declared red-line.

JSON schema for your response:
{
  "suggestions": [
    {
      "id": "string (unique slug)",
      "category": "military|diplomatic|economic|technology|intelligence|domestic|crisis",
      "title": "short title",
      "description": "what to do",
      "reasoning": "why this is recommended",
      "confidence": 0-100,
      "riskLevel": "low|medium|high|extreme",
      "estimatedImpact": { "stability?": number, "treasury?": number, "diplomaticInfluence?": number, "militaryReadiness?": number, "popularity?": number },
      "targetFaction": "optional faction id",
      "prerequisites": ["string"],
      "timeHorizon": "immediate|short-term|long-term"
    }
  ]
}`;

export function buildSuggestionPrompt(ctx: SuggestionContext): string {
  const lines: string[] = [];
  lines.push(`## Situation Report — Turn ${ctx.turn}`);
  lines.push(`**Faction:** ${ctx.factionId.toUpperCase()}`);
  lines.push('');

  // Nation stats
  const ns = ctx.nationState;
  lines.push('### National Indicators');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Stability | ${ns.stability}/100 |`);
  lines.push(`| Treasury | $${ns.treasury}B |`);
  lines.push(`| GDP | $${ns.gdp}B |`);
  lines.push(`| Inflation | ${ns.inflation}% |`);
  lines.push(`| Military Readiness | ${ns.militaryReadiness}/100 |`);
  lines.push(`| Nuclear Threshold | ${ns.nuclearThreshold}/100 |`);
  lines.push(`| Diplomatic Influence | ${ns.diplomaticInfluence}/100 |`);
  lines.push(`| Popularity | ${ns.popularity}/100 |`);
  lines.push(`| Alliance Credibility | ${ns.allianceCredibility}/100 |`);
  lines.push(`| Tech Level | ${ns.techLevel}/100 |`);
  lines.push('');

  // Leader
  if (ctx.leaderProfile) {
    const lp = ctx.leaderProfile;
    lines.push('### Leader Profile');
    lines.push(`- Name: ${lp.name}`);
    lines.push(`- Decision Style: ${lp.decisionStyle}`);
    lines.push(`- Stress Response: ${lp.stressResponse}`);
    lines.push(`- Risk Tolerance: ${lp.riskTolerance}/100`);
    if (lp.primaryGoal) lines.push(`- Primary Goal: ${lp.primaryGoal}`);
    if (lp.redLines?.length) lines.push(`- Red Lines: ${lp.redLines.join('; ')}`);
    lines.push('');
  }

  // Emotional state
  if (ctx.emotionalState) {
    const es = ctx.emotionalState;
    lines.push('### Emotional State');
    lines.push(`Stress ${es.stress} | Confidence ${es.confidence} | Anger ${es.anger} | Fear ${es.fear} | Resolve ${es.resolve}`);
    lines.push('');
  }

  // Tensions
  const tensionEntries = Object.entries(ctx.tensions);
  if (tensionEntries.length) {
    lines.push('### Bilateral Tensions (−100 allied … +100 hostile)');
    for (const [fid, lvl] of tensionEntries) {
      lines.push(`- ${fid}: ${lvl}`);
    }
    lines.push('');
  }

  // Recent events
  if (ctx.recentEvents.length) {
    lines.push('### Recent Events');
    for (const ev of ctx.recentEvents.slice(0, 10)) {
      lines.push(`- ${ev}`);
    }
    lines.push('');
  }

  // Agreements
  if (ctx.existingAgreements.length) {
    lines.push('### Active Agreements');
    for (const ag of ctx.existingAgreements) {
      lines.push(`- ${ag}`);
    }
    lines.push('');
  }

  lines.push('Please analyse this situation and provide 3–5 strategic suggestions as JSON.');
  return lines.join('\n');
}

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  key: string;
  result: SuggestionResult;
  expiresAt: number;
}

function cacheKey(ctx: SuggestionContext): string {
  return `${ctx.factionId}:${ctx.turn}:${ctx.nationState.stability}:${ctx.nationState.treasury}`;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class AISuggestionEngine {
  private adapter: AIAdapter;
  private cache: CacheEntry[] = [];
  private readonly cacheTtlMs: number;

  constructor(config: AIProviderConfig, opts?: { cacheTtlMs?: number }) {
    this.adapter = createAdapter(config);
    this.cacheTtlMs = opts?.cacheTtlMs ?? 120_000; // 2 min default
  }

  /** Swap adapter at runtime (e.g. user changes provider in settings). */
  setAdapter(config: AIProviderConfig): void {
    this.adapter = createAdapter(config);
    this.clearCache();
  }

  async suggest(ctx: SuggestionContext): Promise<SuggestionResult> {
    // ── Cache lookup ──
    const key = cacheKey(ctx);
    const now = Date.now();
    const cached = this.cache.find((e) => e.key === key && e.expiresAt > now);
    if (cached) return { ...cached.result, cached: true };

    // ── Build & send ──
    const userPrompt = buildSuggestionPrompt(ctx);
    const request: AIRequest = {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
      maxTokens: 2048,
      jsonMode: true,
    };

    const response: AIResponse = await this.adapter.complete(request);
    const suggestions = parseSuggestions(response.content);

    const result: SuggestionResult = {
      suggestions,
      context: userPrompt,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latencyMs,
      cached: false,
    };

    // ── Cache store ──
    this.cache = this.cache.filter((e) => e.expiresAt > now); // prune
    this.cache.push({ key, result, expiresAt: now + this.cacheTtlMs });

    return result;
  }

  clearCache(): void {
    this.cache = [];
  }

  getAdapter(): AIAdapter {
    return this.adapter;
  }
}

// ─── Response Parser ────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<string>([
  'military', 'diplomatic', 'economic', 'technology', 'intelligence', 'domestic', 'crisis',
]);
const VALID_RISKS = new Set<string>(['low', 'medium', 'high', 'extreme']);
const VALID_HORIZONS = new Set<string>(['immediate', 'short-term', 'long-term']);

export function parseSuggestions(raw: string): AISuggestion[] {
  try {
    const json = JSON.parse(raw);
    const arr: unknown[] = Array.isArray(json) ? json : json?.suggestions ?? [];
    return arr
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s, i) => ({
        id: String(s.id ?? `suggestion-${i}`),
        category: (VALID_CATEGORIES.has(String(s.category)) ? String(s.category) : 'domestic') as AISuggestionCategory,
        title: String(s.title ?? 'Untitled'),
        description: String(s.description ?? ''),
        reasoning: String(s.reasoning ?? ''),
        confidence: clamp(Number(s.confidence) || 50, 0, 100),
        riskLevel: (VALID_RISKS.has(String(s.riskLevel)) ? String(s.riskLevel) : 'medium') as AISuggestion['riskLevel'],
        estimatedImpact: parseImpact(s.estimatedImpact),
        targetFaction: typeof s.targetFaction === 'string' ? s.targetFaction as FactionId : undefined,
        prerequisites: Array.isArray(s.prerequisites) ? s.prerequisites.map(String) : [],
        timeHorizon: (VALID_HORIZONS.has(String(s.timeHorizon)) ? String(s.timeHorizon) : 'short-term') as AISuggestion['timeHorizon'],
      }))
      .slice(0, 10); // safety cap
  } catch {
    return [];
  }
}

function parseImpact(raw: unknown): SuggestionImpact {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: SuggestionImpact = {};
  if (typeof r.stability === 'number') out.stability = r.stability;
  if (typeof r.treasury === 'number') out.treasury = r.treasury;
  if (typeof r.diplomaticInfluence === 'number') out.diplomaticInfluence = r.diplomaticInfluence;
  if (typeof r.militaryReadiness === 'number') out.militaryReadiness = r.militaryReadiness;
  if (typeof r.popularity === 'number') out.popularity = r.popularity;
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
