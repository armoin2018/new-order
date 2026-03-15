/**
 * CNFL-4200 — Deep AI Strategy Engine
 *
 * Multi-stage per-round AI analysis covering all game dynamics.
 * Orchestrates AutonomousPlayer, StrategicAnalysisEngine, UtilityEvaluator,
 * and the AI adapter to produce comprehensive per-turn strategy briefings.
 *
 * Pipeline per round:
 *   Stage 1 — Player Decision Generation (AutonomousPlayer)
 *   Stage 2 — Dynamics Assessment (economic, military, diplomatic, tech, education, market)
 *   Stage 3 — Threat & Opportunity Detection
 *   Stage 4 — Strategic Briefing (AI adapter or internal engine)
 *   Stage 5 — Recommendations for next round
 */

import type { GameState, FactionId } from '@/data/types';
import { ALL_FACTIONS } from '@/data/types';
import { AutonomousPlayer } from './ai-autonomous-player';
import type { FactionDecision, TurnDecisions, AutonomousPlayerConfig } from './ai-autonomous-player';
import { createAdapter } from './ai-adapter';
import type { AIProviderConfig } from './ai-adapter';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DynamicsAssessment {
  /** Economic: GDP trend, inflation status, treasury health */
  economic: {
    gdpTrend: 'growing' | 'stable' | 'declining';
    inflationStatus: 'low' | 'moderate' | 'high' | 'crisis';
    treasuryHealth: 'surplus' | 'adequate' | 'strained' | 'critical';
    summary: string;
  };
  /** Military balance of power */
  military: {
    readinessLevel: 'dominant' | 'strong' | 'adequate' | 'weak' | 'critical';
    threatLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
    nuclearPosture: 'minimal' | 'moderate' | 'elevated' | 'high';
    summary: string;
  };
  /** Diplomatic landscape */
  diplomatic: {
    influenceRank: number;
    topAlly: string | null;
    topRival: string | null;
    tensionHotspots: Array<{ factions: string; level: number }>;
    summary: string;
  };
  /** Technology position */
  technology: {
    overallRank: number;
    leadingDomain: string | null;
    weakestDomain: string | null;
    discoveryRate: number;
    summary: string;
  };
  /** Education & human capital */
  education: {
    literacyTrend: 'improving' | 'stable' | 'declining';
    innovationCapacity: number;
    summary: string;
  };
  /** Market conditions */
  market: {
    sentiment: 'bullish' | 'mixed' | 'bearish';
    volatility: 'low' | 'moderate' | 'high';
    eventCount: number;
    summary: string;
  };
}

export interface ThreatOpportunity {
  type: 'threat' | 'opportunity';
  domain: 'economic' | 'military' | 'diplomatic' | 'technology' | 'market';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedResponse?: string;
}

export interface DeepRoundAnalysis {
  /** Turn number */
  turn: number;
  /** Player AI decisions made this round */
  playerDecisions: FactionDecision;
  /** Decision labels for the snapshot */
  decisionLabels: string[];
  /** Comprehensive dynamics assessment */
  dynamics: DynamicsAssessment;
  /** Detected threats and opportunities */
  threatsAndOpportunities: ThreatOpportunity[];
  /** Natural-language strategic briefing */
  briefing: string;
  /** Recommended next actions */
  recommendations: string[];
  /** Whether AI adapter was used (vs internal engine) */
  usedAI: boolean;
}

export interface DeepAIStrategyConfig {
  /** Difficulty scaling (0.5-2.0) */
  difficulty?: number;
  /** AI provider config (for LLM-powered briefings) */
  aiProvider?: AIProviderConfig | null;
  /** Temperature for AI briefings */
  temperature?: number;
  /** Max tokens for AI briefings */
  maxTokens?: number;
  /** Generate full AI briefing every N turns (expensive), internal on others */
  aiBriefingInterval?: number;
}

// ─── Faction info lookup (lightweight) ──────────────────────────────────────

const FACTION_NAMES: Record<string, string> = {
  us: 'United States', china: 'China', russia: 'Russia',
  japan: 'Japan', iran: 'Iran', dprk: 'North Korea',
  eu: 'European Union', syria: 'Syria',
};

function fname(fid: string): string {
  return FACTION_NAMES[fid] ?? fid;
}

// ─── Deep AI Strategy Engine ────────────────────────────────────────────────

export class DeepAIStrategyEngine {
  private autonomousPlayer: AutonomousPlayer;
  private config: Required<DeepAIStrategyConfig>;
  private turnHistory: DeepRoundAnalysis[] = [];

  constructor(config: DeepAIStrategyConfig = {}) {
    this.config = {
      difficulty: config.difficulty ?? 1,
      aiProvider: config.aiProvider ?? null,
      temperature: config.temperature ?? 0.6,
      maxTokens: config.maxTokens ?? 800,
      aiBriefingInterval: config.aiBriefingInterval ?? 3,
    };

    const apConfig: AutonomousPlayerConfig = {
      strategy: 'rule-based',
      difficulty: this.config.difficulty,
    };
    this.autonomousPlayer = new AutonomousPlayer(apConfig);
  }

  /** Reset between scenarios */
  reset(): void {
    this.turnHistory = [];
  }

  /** Get accumulated history for reports */
  getHistory(): DeepRoundAnalysis[] {
    return [...this.turnHistory];
  }

  /**
   * Execute the full multi-stage analysis pipeline for a single round.
   * Returns player decisions + comprehensive round analysis.
   */
  async analyzeRound(
    state: GameState,
    turnNumber: number,
    marketState: any,
    technologyIndices: Record<string, any> | null,
    previousAnalysis: DeepRoundAnalysis | null,
  ): Promise<DeepRoundAnalysis> {
    // ── Stage 1: Player Decision Generation ──
    const playerDecision = this.autonomousPlayer.decideFaction(
      state, state.playerFaction, turnNumber,
    );
    const decisionLabels = this.extractDecisionLabels(playerDecision, state);

    // ── Stage 2: Dynamics Assessment ──
    const dynamics = this.assessDynamics(state, marketState, technologyIndices, previousAnalysis);

    // ── Stage 3: Threat & Opportunity Detection ──
    const threatsAndOpportunities = this.detectThreatsAndOpportunities(state, dynamics, previousAnalysis);

    // ── Stage 4: Strategic Briefing ──
    let briefing: string;
    let usedAI = false;

    const shouldUseAI = this.config.aiProvider &&
      (turnNumber === 1 || turnNumber % this.config.aiBriefingInterval === 0);

    if (shouldUseAI && this.config.aiProvider) {
      try {
        briefing = await this.generateAIBriefing(
          state, turnNumber, dynamics, threatsAndOpportunities, playerDecision, decisionLabels,
        );
        usedAI = true;
      } catch (err) {
        console.warn(`[DeepAI] AI briefing failed on turn ${turnNumber}, falling back to internal:`, err);
        briefing = this.generateInternalBriefing(
          state, turnNumber, dynamics, threatsAndOpportunities, playerDecision, decisionLabels,
        );
      }
    } else {
      briefing = this.generateInternalBriefing(
        state, turnNumber, dynamics, threatsAndOpportunities, playerDecision, decisionLabels,
      );
    }

    // ── Stage 5: Recommendations ──
    const recommendations = this.generateRecommendations(state, dynamics, threatsAndOpportunities);

    const analysis: DeepRoundAnalysis = {
      turn: turnNumber,
      playerDecisions: playerDecision,
      decisionLabels,
      dynamics,
      threatsAndOpportunities,
      briefing,
      recommendations,
      usedAI,
    };

    this.turnHistory.push(analysis);
    return analysis;
  }

  // ── Stage 1 Helpers ──

  private extractDecisionLabels(decision: FactionDecision, state: GameState): string[] {
    if (decision.selectedActions.length === 0) {
      return [`${fname(state.playerFaction)} maintains current course — no decisive action`];
    }
    // FR-5001: Produce one label per selected action (up to 5)
    const labels: string[] = [];
    for (const action of decision.selectedActions) {
      const target = action.targetFaction ? ` → ${fname(action.targetFaction)}` : '';
      labels.push(`${fname(state.playerFaction)}: ${action.name}${target}`);
    }
    labels.push(`  Reasoning: ${decision.reasoning}`);
    return labels;
  }

  // ── Stage 2: Dynamics Assessment ──

  private assessDynamics(
    state: GameState,
    marketState: any,
    technologyIndices: Record<string, any> | null,
    prev: DeepRoundAnalysis | null,
  ): DynamicsAssessment {
    const pf = state.playerFaction;
    const pn = state.nationStates[pf];
    const prevDynamics = prev?.dynamics ?? null;

    // Economic
    const gdp = (pn as any)?.gdp ?? 0;
    const inflation = (pn as any)?.inflation ?? 0;
    const treasury = (pn as any)?.treasury ?? 0;
    const prevGdp = prevDynamics ? parseFloat(prevDynamics.economic.summary.match(/GDP:\s*\$?([\d,]+)/)?.[1]?.replace(/,/g, '') ?? '0') : gdp;
    const gdpTrend: DynamicsAssessment['economic']['gdpTrend'] =
      gdp > prevGdp * 1.005 ? 'growing' : gdp < prevGdp * 0.995 ? 'declining' : 'stable';
    const inflationStatus: DynamicsAssessment['economic']['inflationStatus'] =
      inflation > 20 ? 'crisis' : inflation > 12 ? 'high' : inflation > 5 ? 'moderate' : 'low';
    const treasuryHealth: DynamicsAssessment['economic']['treasuryHealth'] =
      treasury > 200 ? 'surplus' : treasury > 80 ? 'adequate' : treasury > 30 ? 'strained' : 'critical';

    const economic: DynamicsAssessment['economic'] = {
      gdpTrend, inflationStatus, treasuryHealth,
      summary: `GDP: $${gdp}B (${gdpTrend}), Inflation: ${inflation.toFixed(4)}% (${inflationStatus}), Treasury: $${treasury}B (${treasuryHealth})`,
    };

    // Military
    const milReady = (pn as any)?.militaryReadiness ?? 0;
    const nucThreshold = (pn as any)?.nuclearThreshold ?? 0;
    const readinessLevel: DynamicsAssessment['military']['readinessLevel'] =
      milReady > 85 ? 'dominant' : milReady > 65 ? 'strong' : milReady > 45 ? 'adequate' : milReady > 25 ? 'weak' : 'critical';

    // Threat from strongest rival
    let maxRivalMil = 0;
    for (const fid of ALL_FACTIONS) {
      if (fid === pf) continue;
      const rMil = (state.nationStates[fid] as any)?.militaryReadiness ?? 0;
      if (rMil > maxRivalMil) maxRivalMil = rMil;
    }
    const milGap = milReady - maxRivalMil;
    const threatLevel: DynamicsAssessment['military']['threatLevel'] =
      milGap < -30 ? 'critical' : milGap < -15 ? 'high' : milGap < 0 ? 'elevated' : milGap < 15 ? 'moderate' : 'low';

    const nuclearPosture: DynamicsAssessment['military']['nuclearPosture'] =
      nucThreshold > 75 ? 'high' : nucThreshold > 50 ? 'elevated' : nucThreshold > 25 ? 'moderate' : 'minimal';

    const military: DynamicsAssessment['military'] = {
      readinessLevel, threatLevel, nuclearPosture,
      summary: `Readiness: ${milReady} (${readinessLevel}), Threat: ${threatLevel}, Nuclear: ${nuclearPosture}`,
    };

    // Diplomatic
    const dipInfluence = (pn as any)?.diplomaticInfluence ?? 0;
    const allFactions = ALL_FACTIONS.map((fid) => ({
      fid,
      dip: ((state.nationStates[fid] as any)?.diplomaticInfluence ?? 0) as number,
    })).sort((a, b) => b.dip - a.dip);
    const influenceRank = allFactions.findIndex((f) => f.fid === pf) + 1;

    // Find best ally (lowest tension) and worst rival (highest tension)
    let topAlly: string | null = null;
    let topRival: string | null = null;
    let minTension = Infinity;
    let maxTension = -Infinity;
    const tensionHotspots: DynamicsAssessment['diplomatic']['tensionHotspots'] = [];

    for (const fid of ALL_FACTIONS) {
      if (fid === pf) continue;
      const tension = (state.relationshipMatrix[pf]?.[fid] ?? 50) as number;
      if (tension < minTension) { minTension = tension; topAlly = fid; }
      if (tension > maxTension) { maxTension = tension; topRival = fid; }
    }

    // All hotspots
    const fids = Object.keys(state.relationshipMatrix);
    for (let i = 0; i < fids.length; i++) {
      for (let j = i + 1; j < fids.length; j++) {
        const a = fids[i]!;
        const b = fids[j]!;
        const level = (state.relationshipMatrix[a]?.[b] ?? 0) as number;
        if (level > 50) tensionHotspots.push({ factions: `${fname(a)} ↔ ${fname(b)}`, level });
      }
    }
    tensionHotspots.sort((a, b) => b.level - a.level);

    const diplomatic: DynamicsAssessment['diplomatic'] = {
      influenceRank,
      topAlly: topAlly ? fname(topAlly) : null,
      topRival: topRival ? fname(topRival) : null,
      tensionHotspots: tensionHotspots.slice(0, 5),
      summary: `Influence rank: #${influenceRank}, Ally: ${topAlly ? fname(topAlly) : 'None'}, Rival: ${topRival ? fname(topRival) : 'None'}, Hotspots: ${tensionHotspots.length}`,
    };

    // Technology
    const techLevel = (pn as any)?.techLevel ?? 0;
    const allTech = ALL_FACTIONS.map((fid) => ({
      fid,
      tech: ((state.nationStates[fid] as any)?.techLevel ?? 0) as number,
    })).sort((a, b) => b.tech - a.tech);
    const techRank = allTech.findIndex((f) => f.fid === pf) + 1;

    let leadingDomain: string | null = null;
    let weakestDomain: string | null = null;
    const ti = technologyIndices?.[pf];
    if (ti) {
      const domains = ['ai', 'semiconductors', 'space', 'cyber', 'biotech', 'quantum'] as const;
      let maxVal = -1;
      let minVal = Infinity;
      for (const d of domains) {
        const val = (ti[d] ?? 0) as number;
        if (val > maxVal) { maxVal = val; leadingDomain = d; }
        if (val < minVal) { minVal = val; weakestDomain = d; }
      }
    }

    const prevDiscoveries = prev?.dynamics.technology.discoveryRate ?? 0;
    const technology: DynamicsAssessment['technology'] = {
      overallRank: techRank,
      leadingDomain,
      weakestDomain,
      discoveryRate: prevDiscoveries, // Updated externally with actual discoveries
      summary: `Tech rank: #${techRank}, Leading: ${leadingDomain ?? 'N/A'}, Weakest: ${weakestDomain ?? 'N/A'}`,
    };

    // Education
    const stability = (pn as any)?.stability ?? 0;
    const baseLiteracy = 40 + (techLevel * 0.35) + Math.min(gdp / 600, 15) + (stability > 50 ? 5 : 0);
    const innovationCap = Math.round(techLevel * 0.4 + stability * 0.2 + Math.min(gdp / 500, 20));
    const prevLiteracy = prev?.dynamics.education.innovationCapacity ?? innovationCap;
    const literacyTrend: DynamicsAssessment['education']['literacyTrend'] =
      innovationCap > prevLiteracy + 1 ? 'improving' : innovationCap < prevLiteracy - 1 ? 'declining' : 'stable';

    const education: DynamicsAssessment['education'] = {
      literacyTrend,
      innovationCapacity: innovationCap,
      summary: `Literacy: ${Math.min(99, Math.round(baseLiteracy))}%, Innovation: ${innovationCap} (${literacyTrend})`,
    };

    // Market
    let sentiment: DynamicsAssessment['market']['sentiment'] = 'mixed';
    let volatility: DynamicsAssessment['market']['volatility'] = 'moderate';
    let eventCount = 0;

    if (marketState?.sentimentStates) {
      const sEntries = Object.entries(marketState.sentimentStates as Record<string, any>);
      const bullish = sEntries.filter(([, s]) => (s as any).sentiment === 'bullish' || (s as any).sentiment === 'very_bullish');
      const bearish = sEntries.filter(([, s]) => (s as any).sentiment === 'bearish' || (s as any).sentiment === 'very_bearish');
      sentiment = bullish.length > bearish.length ? 'bullish' : bearish.length > bullish.length ? 'bearish' : 'mixed';

      const highVol = sEntries.filter(([, s]) => ((s as any).volatilityIndex ?? 0) > 30);
      volatility = highVol.length > sEntries.length * 0.5 ? 'high' : highVol.length > 0 ? 'moderate' : 'low';
    }
    if (marketState?.marketEventLog) {
      eventCount = (marketState.marketEventLog as any[]).length;
    }

    const market: DynamicsAssessment['market'] = {
      sentiment, volatility, eventCount,
      summary: `Sentiment: ${sentiment}, Volatility: ${volatility}, Events: ${eventCount}`,
    };

    return { economic, military, diplomatic, technology, education, market };
  }

  // ── Stage 3: Threat & Opportunity Detection ──

  private detectThreatsAndOpportunities(
    state: GameState,
    dynamics: DynamicsAssessment,
    prev: DeepRoundAnalysis | null,
  ): ThreatOpportunity[] {
    const items: ThreatOpportunity[] = [];
    const pf = state.playerFaction;

    // Economic threats
    if (dynamics.economic.inflationStatus === 'crisis') {
      items.push({
        type: 'threat', domain: 'economic', severity: 'critical',
        description: `Inflation crisis at ${((state.nationStates[pf] as any)?.inflation ?? 0).toFixed(4)}% — economy at risk of collapse`,
        suggestedResponse: 'Implement austerity measures or negotiate trade agreements to stabilize',
      });
    } else if (dynamics.economic.inflationStatus === 'high') {
      items.push({
        type: 'threat', domain: 'economic', severity: 'high',
        description: `Inflation elevated — eroding purchasing power and stability`,
        suggestedResponse: 'Consider tightening fiscal policy',
      });
    }

    if (dynamics.economic.treasuryHealth === 'critical') {
      items.push({
        type: 'threat', domain: 'economic', severity: 'critical',
        description: `Treasury critically low — cannot sustain military or economic programs`,
        suggestedResponse: 'Emergency economic focus needed; cut military spending',
      });
    }

    if (dynamics.economic.gdpTrend === 'growing' && dynamics.economic.treasuryHealth === 'surplus') {
      items.push({
        type: 'opportunity', domain: 'economic', severity: 'medium',
        description: `Strong economic position — surplus treasury with growing GDP`,
        suggestedResponse: 'Invest in technology or military expansion',
      });
    }

    // Military threats
    if (dynamics.military.threatLevel === 'critical') {
      items.push({
        type: 'threat', domain: 'military', severity: 'critical',
        description: `Severe military gap — rival forces significantly outmatch us`,
        suggestedResponse: 'Urgently increase military readiness; consider alliances',
      });
    } else if (dynamics.military.threatLevel === 'high') {
      items.push({
        type: 'threat', domain: 'military', severity: 'high',
        description: `Military disadvantage detected — rival buildup exceeds our capabilities`,
        suggestedResponse: 'Raise readiness levels and deploy deterrent forces',
      });
    }

    if (dynamics.military.readinessLevel === 'dominant') {
      items.push({
        type: 'opportunity', domain: 'military', severity: 'medium',
        description: `Military dominance — can leverage for diplomatic coercion`,
        suggestedResponse: 'Use military position to extract diplomatic concessions',
      });
    }

    // Diplomatic threats
    const criticalHotspots = dynamics.diplomatic.tensionHotspots.filter((h) => h.level > 70);
    for (const hs of criticalHotspots.slice(0, 3)) {
      const involvesPlayer = hs.factions.includes(fname(pf));
      if (involvesPlayer) {
        items.push({
          type: 'threat', domain: 'diplomatic', severity: 'critical',
          description: `Critical tension: ${hs.factions} at level ${hs.level} — risk of military escalation`,
          suggestedResponse: 'Call diplomatic summit immediately',
        });
      } else {
        items.push({
          type: 'threat', domain: 'diplomatic', severity: 'high',
          description: `Regional crisis: ${hs.factions} at level ${hs.level} — could destabilize region`,
          suggestedResponse: 'Monitor closely; consider mediation',
        });
      }
    }

    if (dynamics.diplomatic.influenceRank === 1) {
      items.push({
        type: 'opportunity', domain: 'diplomatic', severity: 'medium',
        description: `Leading diplomatic influence — maximum soft power projection`,
        suggestedResponse: 'Leverage influence for favorable trade deals or alliances',
      });
    }

    // Technology threats & opportunities
    if (dynamics.technology.overallRank > 4) {
      items.push({
        type: 'threat', domain: 'technology', severity: 'high',
        description: `Falling behind in technology race — rank #${dynamics.technology.overallRank}`,
        suggestedResponse: 'Increase R&D investment; prioritize education and tech stimulus',
      });
    } else if (dynamics.technology.overallRank === 1) {
      items.push({
        type: 'opportunity', domain: 'technology', severity: 'medium',
        description: `Leading the technology race — advantage in ${dynamics.technology.leadingDomain ?? 'multiple domains'}`,
        suggestedResponse: 'Maintain lead through continued investment; consider cyber operations to slow rivals',
      });
    }

    // Market threats
    if (dynamics.market.sentiment === 'bearish' && dynamics.market.volatility === 'high') {
      items.push({
        type: 'threat', domain: 'market', severity: 'high',
        description: `Market turmoil — bearish sentiment with high volatility`,
        suggestedResponse: 'Stabilize domestic economy; avoid provocative actions',
      });
    }

    if (dynamics.market.sentiment === 'bullish' && dynamics.market.volatility === 'low') {
      items.push({
        type: 'opportunity', domain: 'market', severity: 'low',
        description: `Favorable market conditions — stable bullish trend`,
        suggestedResponse: 'Good time for economic expansion or trade agreements',
      });
    }

    // Trend-based detection (compare with previous round)
    if (prev) {
      const prevMilThreat = prev.dynamics.military.threatLevel;
      if (dynamics.military.threatLevel === 'critical' && prevMilThreat !== 'critical') {
        items.push({
          type: 'threat', domain: 'military', severity: 'critical',
          description: `ESCALATION: Military threat level jumped to critical — new development`,
          suggestedResponse: 'Immediate response required — raise alert level',
        });
      }
      if (prev.dynamics.economic.gdpTrend === 'growing' && dynamics.economic.gdpTrend === 'declining') {
        items.push({
          type: 'threat', domain: 'economic', severity: 'medium',
          description: `Economic reversal — GDP switched from growth to decline`,
          suggestedResponse: 'Consider economic stimulus to reverse trajectory',
        });
      }
    }

    return items.sort((a, b) => {
      const sev = { critical: 4, high: 3, medium: 2, low: 1 };
      return sev[b.severity] - sev[a.severity];
    });
  }

  // ── Stage 4a: AI-Powered Briefing ──

  private async generateAIBriefing(
    state: GameState,
    turnNumber: number,
    dynamics: DynamicsAssessment,
    threats: ThreatOpportunity[],
    playerDecision: FactionDecision,
    decisionLabels: string[],
  ): Promise<string> {
    if (!this.config.aiProvider) throw new Error('No AI provider configured');

    const stateContext = this.buildStateContext(state, turnNumber, dynamics, threats, decisionLabels);

    const adapter = createAdapter(this.config.aiProvider);
    const response = await adapter.complete({
      systemPrompt: `You are a geopolitical intelligence analyst. Provide a brief SITREP for Turn ${turnNumber}. Cover: 1) Situation summary (2 sentences) 2) Decision assessment 3) Economy (GDP, inflation, treasury) 4) Security (military, threats) 5) Diplomacy (tensions) 6) Top threats/opportunities 7) Next-round priorities. Use numbers. ~200 words. Markdown headers.`,
      userPrompt: stateContext,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    return response.content || this.generateInternalBriefing(
      state, turnNumber, dynamics, threats, playerDecision, decisionLabels,
    );
  }

  // ── Stage 4b: Internal Engine Briefing ──

  private generateInternalBriefing(
    state: GameState,
    turnNumber: number,
    dynamics: DynamicsAssessment,
    threats: ThreatOpportunity[],
    playerDecision: FactionDecision,
    decisionLabels: string[],
  ): string {
    const pf = state.playerFaction;
    const lines: string[] = [];

    lines.push(`### Turn ${turnNumber} — SITREP`);
    lines.push('');

    // Decision
    lines.push(`**Decision:** ${decisionLabels[0] ?? 'No action'}`);
    if (playerDecision.selectedAction) {
      const risk = playerDecision.selectedAction.riskLevel;
      const riskLabel = risk > 50 ? '⚠️ High-risk' : risk > 25 ? 'Moderate-risk' : 'Low-risk';
      lines.push(`**Risk Level:** ${riskLabel} (${risk})`);
    }
    lines.push('');

    // Dynamics summary
    lines.push(`**Economic:** ${dynamics.economic.summary}`);
    lines.push(`**Military:** ${dynamics.military.summary}`);
    lines.push(`**Diplomatic:** ${dynamics.diplomatic.summary}`);
    lines.push(`**Technology:** ${dynamics.technology.summary}`);
    lines.push(`**Education:** ${dynamics.education.summary}`);
    lines.push(`**Markets:** ${dynamics.market.summary}`);
    lines.push('');

    // Threats & opportunities
    const critThreats = threats.filter((t) => t.type === 'threat' && (t.severity === 'critical' || t.severity === 'high'));
    const opps = threats.filter((t) => t.type === 'opportunity');

    if (critThreats.length > 0) {
      lines.push('**⚠️ Active Threats:**');
      for (const t of critThreats.slice(0, 3)) {
        lines.push(`- [${t.severity.toUpperCase()}] ${t.description}`);
      }
      lines.push('');
    }

    if (opps.length > 0) {
      lines.push('**💡 Opportunities:**');
      for (const o of opps.slice(0, 2)) {
        lines.push(`- ${o.description}`);
      }
      lines.push('');
    }

    // Power snapshot
    const factionPowers = ALL_FACTIONS.map((fid) => {
      const ns = state.nationStates[fid] as any;
      if (!ns) return { fid, power: 0 };
      const power = Math.round(
        (ns.stability ?? 0) * 0.2 + ((ns.gdp ?? 0) / 200) * 0.3 +
        (ns.militaryReadiness ?? 0) * 0.2 + (ns.diplomaticInfluence ?? 0) * 0.15 +
        (ns.techLevel ?? 0) * 0.15,
      );
      return { fid, power };
    }).sort((a, b) => b.power - a.power);

    const playerRank = factionPowers.findIndex((f) => f.fid === pf) + 1;
    lines.push(`**Global Standing:** #${playerRank} of ${factionPowers.length} — Power index: ${factionPowers.find((f) => f.fid === pf)?.power ?? 0}`);

    return lines.join('\n');
  }

  // ── Stage 5: Recommendations ──

  private generateRecommendations(
    state: GameState,
    dynamics: DynamicsAssessment,
    threats: ThreatOpportunity[],
  ): string[] {
    const recs: string[] = [];

    // Priority from threats
    const criticalThreats = threats.filter((t) => t.type === 'threat' && t.severity === 'critical');
    for (const t of criticalThreats.slice(0, 2)) {
      if (t.suggestedResponse) recs.push(`🔴 CRITICAL: ${t.suggestedResponse}`);
    }

    // Domain-specific recommendations
    if (dynamics.economic.inflationStatus === 'high' || dynamics.economic.inflationStatus === 'crisis') {
      recs.push('📉 Implement austerity measures to control inflation');
    }

    if (dynamics.military.threatLevel === 'elevated' || dynamics.military.threatLevel === 'high') {
      recs.push('🛡️ Increase military readiness to deter adversaries');
    }

    if (dynamics.diplomatic.tensionHotspots.length > 3) {
      recs.push('🤝 Pursue diplomatic outreach to reduce global tensions');
    }

    if (dynamics.technology.overallRank > 3) {
      recs.push('🔬 Prioritize R&D investment to improve technology position');
    }

    if (dynamics.market.sentiment === 'bearish') {
      recs.push('💹 Stabilize markets through economic confidence measures');
    }

    // Opportunity-based
    const opps = threats.filter((t) => t.type === 'opportunity');
    for (const o of opps.slice(0, 1)) {
      if (o.suggestedResponse) recs.push(`💡 ${o.suggestedResponse}`);
    }

    // If nothing critical, general growth
    if (recs.length === 0) {
      recs.push('✅ Stable position — focus on long-term growth and technology');
    }

    return recs.slice(0, 5);
  }

  // ── Utility ──

  private buildStateContext(
    state: GameState,
    turnNumber: number,
    dynamics: DynamicsAssessment,
    threats: ThreatOpportunity[],
    decisionLabels: string[],
  ): string {
    const pf = state.playerFaction;
    const pn = state.nationStates[pf] as any;
    const lines: string[] = [];

    lines.push(`# Turn ${turnNumber} State Report — ${fname(pf)}`);
    lines.push('');
    lines.push('## Player Decision This Round:');
    decisionLabels.forEach((d) => lines.push(`- ${d}`));
    lines.push('');

    if (pn) {
      lines.push('## Player Nation Metrics:');
      lines.push(`- Stability: ${pn.stability ?? 0}`);
      lines.push(`- GDP: $${pn.gdp ?? 0}B`);
      lines.push(`- Treasury: $${pn.treasury ?? 0}B`);
      lines.push(`- Inflation: ${(pn.inflation ?? 0).toFixed(4)}%`);
      lines.push(`- Military Readiness: ${pn.militaryReadiness ?? 0}`);
      lines.push(`- Diplomatic Influence: ${pn.diplomaticInfluence ?? 0}`);
      lines.push(`- Popularity: ${pn.popularity ?? 0}`);
      lines.push(`- Nuclear Threshold: ${pn.nuclearThreshold ?? 0}`);
      lines.push(`- Tech Level: ${pn.techLevel ?? 0}`);
      lines.push('');
    }

    lines.push('## Dynamics Assessment:');
    lines.push(`- Economic: ${dynamics.economic.summary}`);
    lines.push(`- Military: ${dynamics.military.summary}`);
    lines.push(`- Diplomatic: ${dynamics.diplomatic.summary}`);
    lines.push(`- Technology: ${dynamics.technology.summary}`);
    lines.push(`- Education: ${dynamics.education.summary}`);
    lines.push(`- Markets: ${dynamics.market.summary}`);
    lines.push('');

    lines.push('## Rival Nations:');
    for (const fid of ALL_FACTIONS) {
      if (fid === pf) continue;
      const ns = state.nationStates[fid] as any;
      if (!ns) continue;
      const tension = (state.relationshipMatrix[pf]?.[fid] ?? 0) as number;
      lines.push(`- ${fname(fid)}: Stab=${ns.stability ?? 0} GDP=$${ns.gdp ?? 0}B Mil=${ns.militaryReadiness ?? 0} Tension=${tension}`);
    }
    lines.push('');

    if (threats.length > 0) {
      lines.push('## Active Threats & Opportunities:');
      for (const t of threats.slice(0, 6)) {
        lines.push(`- [${t.type.toUpperCase()}/${t.severity}] ${t.description}`);
      }
    }

    return lines.join('\n');
  }
}

export type { FactionDecision, TurnDecisions };
