import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import { useCurrentTurn, usePlayerFaction, useIsGameOver, useGameActions } from '@/engine/hooks';
import { MARCH_2026_SCENARIO } from '@/data/scenarios/march2026.scenario';
import { ALL_FACTIONS } from '@/data/types';
import type { FactionId, TurnNumber, MilitaryForceStructure, TechnologyIndex } from '@/data/types';
import {
  AVAILABLE_ACTIONS,
  FACTION_INFO,
  executeAction,
  processTurn,
} from '@/engine/game-controller';
import { GAME_CONFIG } from '@/engine/config';
import { computeActionCost, detectInteractionEffects } from '@/engine/action-slate-engine';
import type { ActionDefinition, ActionId, InteractionEffect } from '@/data/types/action-slate.types';
import { actionSlateConfig } from '@/engine/config/action-slate';
import { StrategicAnalysisEngine } from '@/engine/strategic-analysis-engine';
import type { GameAction, TurnHeadline } from '@/engine/game-controller';
import { createAdapter, DeepAIStrategyEngine } from '@/engine/ai';
import type { AIProvider, DeepRoundAnalysis } from '@/engine/ai';
import { AutonomousPlayer } from '@/engine/ai/ai-autonomous-player';
import type { ConnectionTestResult } from './AISettingsPanel';
import type { RunConfig } from './AutomationDashboard';
import { StockMarketDashboard } from './StockMarketDashboard';
import { ForexDashboard } from './ForexDashboard';
import { ScenarioPanel } from './ScenarioPanel';
import { MarketIndexPanel } from './MarketIndexPanel';
import { MarketSentimentWidget } from './MarketSentimentWidget';
import { TechModuleViewer } from './TechModuleViewer';
import { ModuleBrowser } from './ModuleBrowser';
import type { ModuleSummary } from './ModuleBrowser';
import { ModuleEditor } from './ModuleEditor';
import type { JsonSchema } from './SchemaForm';
import { AISettingsPanel } from './AISettingsPanel';
import type { AISettingsState } from './AISettingsPanel';
import { AutomationDashboard } from './AutomationDashboard';
import { ImportExportPanel } from './ImportExportPanel';
import { MilitaryDashboard } from './MilitaryDashboard';
import { EquipmentCatalog } from './EquipmentCatalog';
import { DemographicsDashboard } from './DemographicsDashboard';
import { EducationDashboard } from './EducationDashboard';
import { PoliticalSystemCreator } from './PoliticalSystemCreator';
import type { PoliticalSystemPreset } from './PoliticalSystemCreator';
import { InnovationDashboard } from './InnovationDashboard';
import { PolicyDashboard } from './PolicyDashboard';
import { CivilWarPanel } from './CivilWarPanel';
import { TickerBar } from './TickerBar';
import { WorldMapSVG } from './WorldMapSVG';
import { TimelineSummary } from './TimelineSummary';
import {
  EXCHANGE_MODELS,
  TICKER_SET_MODELS,
  INDEX_MODELS,
  POLITICAL_SYSTEM_MODELS,
  TECHNOLOGY_MODELS,
  EDUCATION_MODELS,
  POPULATION_MODELS,
  RELIGION_MODELS,
} from '@/data/model-loader';

// ─── Timeline Export ─────────────────────────────────────────

interface TurnSnapshot {
  turn: number;
  date: string;
  headlines: string[];
  actions: string[];           // AI faction actions
  decisions: string[];          // Player decisions this turn
  stateChanges: string[];       // System warnings / state changes
  factions: Record<string, {
    stability: number;
    gdp: number;
    treasury: number;
    inflation: number;
    militaryReadiness: number;
    diplomaticInfluence: number;
    popularity: number;
    nuclearThreshold: number;
    techLevel: number;
  }>;
  // ── Market detail ──
  marketSummary: string | null;
  marketTickers: Record<string, { price: number; change: number; changePct: number; trend: string }> | null;
  marketIndexes: Record<string, { value: number; change: number; changePct: number }> | null;
  marketSentiment: Record<string, { sentiment: string; score: number; volatility: number }> | null;
  marketEvents: string[];
  // ── Technology ──
  technology: Record<string, {
    ai: number; semiconductors: number; space: number;
    cyber: number; biotech: number; quantum: number;
  }> | null;
  techDiscoveries: string[];
  // ── Education (derived from nation state) ──
  education: Record<string, {
    literacyRate: number;
    researchBonus: number;
    innovationCapacity: number;
    techInvestmentIndex: number;
  }> | null;
  // ── Diplomatic tensions (top pairs) ──
  tensions: Array<{ factionA: string; factionB: string; level: number; trend: string }>;
  // ── Per-turn market analysis commentary ──
  marketAnalysis: string;
  // ── Deep AI strategy per-round analysis (when deep-ai strategy selected) ──
  deepAnalysis: string | null;
}

const AI_SETTINGS_KEY = 'neworder-ai-settings';
const TIMELINE_KEY = 'neworder-game-timeline';

function buildExportPayload(
  timeline: TurnSnapshot[],
  reason: string | null,
  playerFaction: string,
  scenarioName: string,
) {
  return {
    exportedAt: new Date().toISOString(),
    scenario: scenarioName,
    playerFaction,
    outcome: reason ?? 'In progress',
    totalTurns: timeline.length,
    timeline,
  };
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Markdown Report ────────────────────────────────────────

function buildMarkdownReport(
  timeline: TurnSnapshot[],
  reason: string | null,
  playerFaction: string,
  scenarioName: string,
  analysis?: string | null,
): string {
  const fInfo = (FACTION_INFO as Record<string, any>)[playerFaction];
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');
  const lines: string[] = [];
  const hr = '---';

  lines.push(`# ⚔️ New Order — Simulation Report`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Scenario** | ${scenarioName} |`);
  lines.push(`| **Player** | ${fInfo?.flag ?? ''} ${fInfo?.name ?? playerFaction} |`);
  lines.push(`| **Outcome** | ${isVictory ? '🏆 Victory' : '💀 Defeat'} — ${reason ?? 'Unknown'} |`);
  lines.push(`| **Total Turns** | ${timeline.length} |`);
  lines.push(`| **Exported** | ${new Date().toISOString()} |`);
  lines.push('');
  lines.push(hr);
  lines.push('');

  // Executive Summary
  if (timeline.length > 0) {
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const pFirst = first?.factions[playerFaction];
    const pLast = last?.factions[playerFaction];
    if (pFirst && pLast) {
      lines.push(`## 📈 Executive Summary`);
      lines.push('');
      const delta = (a: number, b: number) => { const d = b - a; return d >= 0 ? `+${d}` : `${d}`; };
      lines.push(`| Metric | Start | End | Δ |`);
      lines.push(`|--------|-------|-----|---|`);
      lines.push(`| Stability | ${pFirst.stability} | ${pLast.stability} | ${delta(pFirst.stability, pLast.stability)} |`);
      lines.push(`| GDP | $${pFirst.gdp}B | $${pLast.gdp}B | ${delta(pFirst.gdp, pLast.gdp)} |`);
      lines.push(`| Treasury | $${pFirst.treasury}B | $${pLast.treasury}B | ${delta(pFirst.treasury, pLast.treasury)} |`);
      lines.push(`| Inflation | ${pFirst.inflation}% | ${pLast.inflation}% | ${delta(pFirst.inflation, pLast.inflation)} |`);
      lines.push(`| Military | ${pFirst.militaryReadiness} | ${pLast.militaryReadiness} | ${delta(pFirst.militaryReadiness, pLast.militaryReadiness)} |`);
      lines.push(`| Diplomacy | ${pFirst.diplomaticInfluence} | ${pLast.diplomaticInfluence} | ${delta(pFirst.diplomaticInfluence, pLast.diplomaticInfluence)} |`);
      lines.push(`| Popularity | ${pFirst.popularity} | ${pLast.popularity} | ${delta(pFirst.popularity, pLast.popularity)} |`);
      lines.push(`| Nuclear | ${pFirst.nuclearThreshold} | ${pLast.nuclearThreshold} | ${delta(pFirst.nuclearThreshold, pLast.nuclearThreshold)} |`);
      lines.push(`| Tech Level | ${pFirst.techLevel} | ${pLast.techLevel} | ${delta(pFirst.techLevel, pLast.techLevel)} |`);
      lines.push('');
    }
  }

  // Education & Innovation summary
  if (timeline.length > 0) {
    const first = timeline[0]!;
    const last = timeline[timeline.length - 1]!;
    const eduFirst = first.education?.[playerFaction];
    const eduLast = last.education?.[playerFaction];
    if (eduFirst && eduLast) {
      const delta = (a: number, b: number) => { const d = +(b - a).toFixed(4); return d >= 0 ? `+${d}` : `${d}`; };
      lines.push(`## 🎓 Education & Innovation`);
      lines.push('');
      lines.push(`| Metric | Start | End | Δ |`);
      lines.push(`|--------|-------|-----|---|`);
      lines.push(`| Literacy Rate | ${eduFirst.literacyRate}% | ${eduLast.literacyRate}% | ${delta(eduFirst.literacyRate, eduLast.literacyRate)} |`);
      lines.push(`| Research Bonus | ${eduFirst.researchBonus} | ${eduLast.researchBonus} | ${delta(eduFirst.researchBonus, eduLast.researchBonus)} |`);
      lines.push(`| Innovation Capacity | ${eduFirst.innovationCapacity} | ${eduLast.innovationCapacity} | ${delta(eduFirst.innovationCapacity, eduLast.innovationCapacity)} |`);
      lines.push(`| Tech Investment | ${eduFirst.techInvestmentIndex} | ${eduLast.techInvestmentIndex} | ${delta(eduFirst.techInvestmentIndex, eduLast.techInvestmentIndex)} |`);
      lines.push('');
    }
  }

  // Diplomatic tensions
  const lastSnap = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  const tensions = lastSnap?.tensions ?? [];
  if (tensions.length > 0) {
    lines.push(`## 🌐 Diplomatic Tensions`);
    lines.push('');
    lines.push(`| Faction A | Faction B | Level | Trend |`);
    lines.push(`|-----------|-----------|-------|-------|`);
    tensions.forEach((t) => {
      const aName = (FACTION_INFO as Record<string, any>)[t.factionA]?.name ?? t.factionA;
      const bName = (FACTION_INFO as Record<string, any>)[t.factionB]?.name ?? t.factionB;
      lines.push(`| ${aName} | ${bName} | ${t.level} | ${t.trend} |`);
    });
    lines.push('');
  }

  // Market analysis highlights
  const mktAnalysis = timeline.filter((s) => s.marketAnalysis);
  if (mktAnalysis.length > 0) {
    lines.push(`## 💹 Market Analysis`);
    lines.push('');
    mktAnalysis.filter((_, i) => i % 3 === 0 || i === mktAnalysis.length - 1).forEach((s) => {
      lines.push(`**Turn ${s.turn}:** ${s.marketAnalysis}`);
    });
    lines.push('');
  }

  // Strategic Analysis (AI or internal)
  if (analysis) {
    lines.push(`## 🤖 Strategic Analysis`);
    lines.push('');
    lines.push(analysis);
    lines.push('');
    lines.push(hr);
    lines.push('');
  }

  // Tech discoveries summary
  const allDisc = timeline.flatMap((s) => s.techDiscoveries);
  if (allDisc.length > 0) {
    lines.push(`## 🔬 Technology Discoveries (${allDisc.length})`);
    lines.push('');
    allDisc.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  // Decisions summary
  const allDecisions = timeline.flatMap((s) => s.decisions.map((d) => ({ turn: s.turn, date: s.date, decision: d })));
  if (allDecisions.length > 0) {
    lines.push(`## 🎯 Decisions Made (${allDecisions.length})`);
    lines.push('');
    lines.push(`| Turn | Date | Decision |`);
    lines.push(`|------|------|----------|`);
    allDecisions.forEach((d) => lines.push(`| ${d.turn} | ${d.date} | ${d.decision} |`));
    lines.push('');
  }

  // Turn-by-turn timeline
  lines.push(`## 📅 Turn-by-Turn Timeline`);
  lines.push('');
  for (const snap of timeline) {
    lines.push(`### Turn ${snap.turn} — ${snap.date}`);
    lines.push('');
    if (snap.decisions.length) {
      lines.push(`**Decisions:** ${snap.decisions.join('; ')}`);
      lines.push('');
    }
    if (snap.headlines.length) {
      lines.push(`**Headlines:**`);
      snap.headlines.forEach((h) => lines.push(`- ${h}`));
      lines.push('');
    }
    if (snap.actions.length) {
      lines.push(`**AI Actions:**`);
      snap.actions.forEach((a) => lines.push(`- ${a}`));
      lines.push('');
    }
    if (snap.stateChanges.length) {
      lines.push(`**⚠️ State Changes:**`);
      snap.stateChanges.forEach((c) => lines.push(`- ${c}`));
      lines.push('');
    }
    if (snap.marketEvents.length) {
      lines.push(`**📊 Market Events:**`);
      snap.marketEvents.forEach((e) => lines.push(`- ${e}`));
      lines.push('');
    }
    if (snap.techDiscoveries.length) {
      lines.push(`**🔬 Tech Discoveries:**`);
      snap.techDiscoveries.forEach((t) => lines.push(`- ${t}`));
      lines.push('');
    }
    if (snap.marketAnalysis) {
      lines.push(`**💹 Market Analysis:** ${snap.marketAnalysis}`);
      lines.push('');
    }
    if (snap.deepAnalysis) {
      lines.push(`**🧠 Deep Strategy Briefing:**`);
      lines.push('');
      lines.push(snap.deepAnalysis);
      lines.push('');
    }
    lines.push(hr);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Interactive HTML Report ─────────────────────────────────

function buildHtmlReport(
  timeline: TurnSnapshot[],
  reason: string | null,
  playerFaction: string,
  scenarioName: string,
  analysis?: string | null,
): string {
  const fInfo = (FACTION_INFO as Record<string, any>)[playerFaction];
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');
  const fids = timeline.length > 0 ? Object.keys(timeline[0].factions) : [];
  const techDomains = ['ai', 'semiconductors', 'space', 'cyber', 'biotech', 'quantum'];
  const turns = timeline.map((s) => s.turn);

  // Build series for charts
  const playerStats = timeline.map((s) => s.factions[playerFaction]);
  const stabilitySeries = JSON.stringify(playerStats.map((p) => p?.stability ?? 0));
  const gdpSeries = JSON.stringify(playerStats.map((p) => p?.gdp ?? 0));
  const treasurySeries = JSON.stringify(playerStats.map((p) => p?.treasury ?? 0));
  const inflationSeries = JSON.stringify(playerStats.map((p) => p?.inflation ?? 0));
  const militarySeries = JSON.stringify(playerStats.map((p) => p?.militaryReadiness ?? 0));
  const popularitySeries = JSON.stringify(playerStats.map((p) => p?.popularity ?? 0));
  const nuclearSeries = JSON.stringify(playerStats.map((p) => p?.nuclearThreshold ?? 0));
  const turnsJson = JSON.stringify(turns);

  // Tech series for player
  const techSeries: Record<string, string> = {};
  for (const domain of techDomains) {
    techSeries[domain] = JSON.stringify(timeline.map((s) => (s.technology?.[playerFaction] as any)?.[domain] ?? 0));
  }

  // Market index series (first 5 indexes)
  const allIndexIds = [...new Set(timeline.flatMap((s) => s.marketIndexes ? Object.keys(s.marketIndexes) : []))];
  const indexIds = allIndexIds.slice(0, 6);
  const indexSeries: Record<string, string> = {};
  for (const id of indexIds) {
    indexSeries[id] = JSON.stringify(timeline.map((s) => s.marketIndexes?.[id]?.value ?? null));
  }

  // Faction comparison: final turn stability
  const lastSnap = timeline[timeline.length - 1];
  const factionLabels = JSON.stringify(fids.map((f) => (FACTION_INFO as Record<string, any>)[f]?.name ?? f));
  const factionStability = JSON.stringify(fids.map((f) => lastSnap?.factions[f]?.stability ?? 0));
  const factionGdp = JSON.stringify(fids.map((f) => lastSnap?.factions[f]?.gdp ?? 0));
  const factionColors = JSON.stringify(fids.map((f) => (FACTION_INFO as Record<string, any>)[f]?.color ?? '#888'));

  // All decisions and headline data
  const allDecisions = timeline.flatMap((s) => s.decisions.map((d) => ({ turn: s.turn, date: s.date, decision: d })));
  const allStateChanges = timeline.flatMap((s) => s.stateChanges.map((c) => ({ turn: s.turn, text: c })));
  const allTechDisc = timeline.flatMap((s) => s.techDiscoveries.map((t) => ({ turn: s.turn, text: t })));
  const allMarketEvts = timeline.flatMap((s) => s.marketEvents.map((e) => ({ turn: s.turn, text: e })));
  const allMktAnalysis = timeline.filter((s) => s.marketAnalysis).map((s) => ({ turn: s.turn, text: s.marketAnalysis }));

  // Education series for player
  const eduLiteracy = JSON.stringify(timeline.map((s) => s.education?.[playerFaction]?.literacyRate ?? 0));
  const eduResearch = JSON.stringify(timeline.map((s) => s.education?.[playerFaction]?.researchBonus ?? 0));
  const eduInnovation = JSON.stringify(timeline.map((s) => s.education?.[playerFaction]?.innovationCapacity ?? 0));
  const eduTechInvest = JSON.stringify(timeline.map((s) => s.education?.[playerFaction]?.techInvestmentIndex ?? 0));

  // Tension data (final state)
  const finalTensions = lastSnap?.tensions ?? [];

  // Escaped analysis HTML
  const analysisHtml = analysis ? analysis
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--cyan);margin:16px 0 8px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--accent);margin:20px 0 10px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:var(--text);margin:24px 0 12px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px">$1</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>') : '';

  const p1 = playerStats[0];
  const pN = playerStats[playerStats.length - 1];
  const d = (a: number | undefined, b: number | undefined) => {
    const v = (b ?? 0) - (a ?? 0);
    return v >= 0 ? `<span class="up">+${v}</span>` : `<span class="down">${v}</span>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>New Order — Simulation Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
:root{--bg:#0a0a12;--card:#12121f;--border:#222;--text:#e0e0e0;--muted:#888;--accent:${isVictory ? '#4caf50' : '#ef5350'};--blue:#2196f3;--yellow:#ffb300;--cyan:#06b6d4}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.6;min-height:100vh}
.container{max-width:1200px;margin:0 auto;padding:24px}
.header{text-align:center;padding:40px 0 24px;border-bottom:1px solid var(--border);margin-bottom:32px}
.header h1{font-size:32px;font-weight:800;letter-spacing:3px;color:var(--accent)}
.header .subtitle{font-size:14px;color:var(--muted);margin-top:8px}
.meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:32px}
.meta-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center}
.meta-card .label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:4px}
.meta-card .value{font-size:20px;font-weight:700;color:var(--text)}
.tabs{display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:24px;flex-wrap:wrap}
.tab{padding:10px 20px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit;transition:all .15s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.panel{display:none}
.panel.active{display:block}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px}
.card h3{font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text)}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:768px){.chart-row{grid-template-columns:1fr}}
.chart-box{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px}
.chart-box h4{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px}
canvas{max-height:280px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px}
td{padding:8px 12px;border-bottom:1px solid var(--border)}
tr:hover{background:rgba(255,255,255,.02)}
.up{color:#4caf50;font-weight:600}.down{color:#ef5350;font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge-warn{background:rgba(255,179,0,.15);color:var(--yellow)}
.badge-crit{background:rgba(239,83,80,.15);color:#ef5350}
.badge-info{background:rgba(33,150,243,.15);color:var(--blue)}
.badge-tech{background:rgba(6,182,212,.15);color:var(--cyan)}
.timeline-entry{border-left:3px solid var(--border);padding:12px 16px;margin-bottom:8px;border-radius:0 8px 8px 0;background:var(--card);transition:border-color .15s}
.timeline-entry:hover{border-left-color:var(--accent)}
.timeline-entry .turn-label{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px}
.timeline-entry .content{margin-top:6px;font-size:12px;color:var(--muted)}
.timeline-entry .content strong{color:var(--text)}
.search-box{width:100%;padding:10px 16px;background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;margin-bottom:16px;font-family:inherit}
.search-box::placeholder{color:#555}
.filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-btn{padding:4px 12px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:11px;font-family:inherit}
.filter-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
footer{text-align:center;padding:32px 0;color:#444;font-size:11px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${isVictory ? '🏆' : '💀'} NEW ORDER — SIMULATION REPORT</h1>
    <div class="subtitle">${fInfo?.flag ?? ''} ${fInfo?.name ?? playerFaction} · ${scenarioName} · ${timeline.length} Turns</div>
  </div>

  <div class="meta-grid">
    <div class="meta-card"><div class="label">Outcome</div><div class="value" style="color:var(--accent)">${isVictory ? 'Victory' : 'Defeat'}</div></div>
    <div class="meta-card"><div class="label">Stability</div><div class="value">${pN?.stability ?? '?'} ${d(p1?.stability, pN?.stability)}</div></div>
    <div class="meta-card"><div class="label">GDP</div><div class="value">$${pN?.gdp ?? '?'}B ${d(p1?.gdp, pN?.gdp)}</div></div>
    <div class="meta-card"><div class="label">Treasury</div><div class="value">$${pN?.treasury ?? '?'}B ${d(p1?.treasury, pN?.treasury)}</div></div>
    <div class="meta-card"><div class="label">Military</div><div class="value">${pN?.militaryReadiness ?? '?'} ${d(p1?.militaryReadiness, pN?.militaryReadiness)}</div></div>
    <div class="meta-card"><div class="label">Popularity</div><div class="value">${pN?.popularity ?? '?'} ${d(p1?.popularity, pN?.popularity)}</div></div>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('overview')">📈 Overview</button>
    <button class="tab" onclick="switchTab('markets')">💹 Markets</button>
    <button class="tab" onclick="switchTab('tech')">🔬 Technology</button>
    <button class="tab" onclick="switchTab('education')">🎓 Education</button>
    <button class="tab" onclick="switchTab('factions')">🌍 Factions</button>
    <button class="tab" onclick="switchTab('decisions')">🎯 Decisions</button>
    <button class="tab" onclick="switchTab('analysis')">🤖 Analysis</button>
    <button class="tab" onclick="switchTab('timeline')">📅 Timeline</button>
  </div>

  <!-- OVERVIEW -->
  <div id="panel-overview" class="panel active">
    <div class="chart-row">
      <div class="chart-box"><h4>Stability & Popularity</h4><canvas id="chartStability"></canvas></div>
      <div class="chart-box"><h4>Economy</h4><canvas id="chartEconomy"></canvas></div>
    </div>
    <div class="chart-row" style="margin-top:20px">
      <div class="chart-box"><h4>Military & Nuclear</h4><canvas id="chartMilitary"></canvas></div>
      <div class="chart-box"><h4>Inflation</h4><canvas id="chartInflation"></canvas></div>
    </div>
  </div>

  <!-- MARKETS -->
  <div id="panel-markets" class="panel">
    <div class="chart-row">
      <div class="chart-box" style="grid-column:1/-1"><h4>Market Indexes</h4><canvas id="chartIndexes"></canvas></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>📊 Market Events</h3>
      <table><thead><tr><th>Turn</th><th>Event</th></tr></thead><tbody>
        ${allMarketEvts.map((e) => `<tr><td>${e.turn}</td><td>${esc(e.text)}</td></tr>`).join('')}
        ${allMarketEvts.length === 0 ? '<tr><td colspan="2" style="color:#555">No market events recorded</td></tr>' : ''}
      </tbody></table>
    </div>
    ${allMktAnalysis.length > 0 ? `<div class="card" style="margin-top:20px"><h3>💹 Market Analysis</h3>
      <table><thead><tr><th>Turn</th><th>Analysis</th></tr></thead><tbody>
        ${allMktAnalysis.map((a) => `<tr><td>${a.turn}</td><td>${esc(a.text)}</td></tr>`).join('')}
      </tbody></table>
    </div>` : ''}
  </div>

  <!-- TECHNOLOGY -->
  <div id="panel-tech" class="panel">
    <div class="chart-row">
      <div class="chart-box" style="grid-column:1/-1"><h4>Technology Progress — ${fInfo?.name ?? playerFaction}</h4><canvas id="chartTech"></canvas></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>🔬 Discoveries</h3>
      <table><thead><tr><th>Turn</th><th>Discovery</th></tr></thead><tbody>
        ${allTechDisc.map((t) => `<tr><td>${t.turn}</td><td><span class="badge badge-tech">${esc(t.text)}</span></td></tr>`).join('')}
        ${allTechDisc.length === 0 ? '<tr><td colspan="2" style="color:#555">No discoveries recorded</td></tr>' : ''}
      </tbody></table>
    </div>
  </div>

  <!-- EDUCATION -->
  <div id="panel-education" class="panel">
    <div class="chart-row">
      <div class="chart-box"><h4>Literacy Rate & Innovation Capacity</h4><canvas id="chartEduLit"></canvas></div>
      <div class="chart-box"><h4>Research Bonus & Tech Investment</h4><canvas id="chartEduResearch"></canvas></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>🎓 Education Metrics — All Factions (Final State)</h3>
      <table><thead><tr><th>Faction</th><th>Literacy</th><th>Research Bonus</th><th>Innovation</th><th>Tech Investment</th></tr></thead><tbody>
        ${fids.map((f) => {
          const edu = lastSnap?.education?.[f];
          const fi = (FACTION_INFO as Record<string, any>)[f];
          return `<tr><td>${fi?.flag ?? ''} ${fi?.name ?? f}</td><td>${edu?.literacyRate ?? '?'}%</td><td>${edu?.researchBonus ?? '?'}</td><td>${edu?.innovationCapacity ?? '?'}</td><td>${edu?.techInvestmentIndex ?? '?'}</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>
    ${finalTensions.length > 0 ? `<div class="card" style="margin-top:20px"><h3>🌐 Diplomatic Tensions</h3>
      <table><thead><tr><th>Faction A</th><th>Faction B</th><th>Level</th><th>Trend</th><th>Severity</th></tr></thead><tbody>
        ${finalTensions.map((t) => {
          const aName = (FACTION_INFO as Record<string, any>)[t.factionA]?.name ?? t.factionA;
          const bName = (FACTION_INFO as Record<string, any>)[t.factionB]?.name ?? t.factionB;
          const sev = t.level > 70 ? '<span class="badge badge-crit">Critical</span>' : t.level > 50 ? '<span class="badge badge-warn">Elevated</span>' : '<span class="badge badge-info">Moderate</span>';
          return `<tr><td>${aName}</td><td>${bName}</td><td>${t.level}</td><td>${t.trend}</td><td>${sev}</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>` : ''}
  </div>

  <!-- FACTIONS -->
  <div id="panel-factions" class="panel">
    <div class="chart-row">
      <div class="chart-box"><h4>Final Stability Comparison</h4><canvas id="chartFactionStab"></canvas></div>
      <div class="chart-box"><h4>Final GDP Comparison</h4><canvas id="chartFactionGdp"></canvas></div>
    </div>
    <div class="card" style="margin-top:20px"><h3>🌍 Final State</h3>
      <table><thead><tr><th>Faction</th><th>Stability</th><th>GDP</th><th>Treasury</th><th>Military</th><th>Diplomacy</th><th>Nuclear</th></tr></thead><tbody>
        ${fids.map((f) => {
          const fs = lastSnap?.factions[f];
          const fi = (FACTION_INFO as Record<string, any>)[f];
          return `<tr><td>${fi?.flag ?? ''} ${fi?.name ?? f}</td><td>${fs?.stability ?? '?'}</td><td>$${fs?.gdp ?? '?'}B</td><td>$${fs?.treasury ?? '?'}B</td><td>${fs?.militaryReadiness ?? '?'}</td><td>${fs?.diplomaticInfluence ?? '?'}</td><td>${fs?.nuclearThreshold ?? '?'}</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>
  </div>

  <!-- DECISIONS -->
  <div id="panel-decisions" class="panel">
    <div class="card"><h3>🎯 Player Decisions (${allDecisions.length})</h3>
      <table><thead><tr><th>Turn</th><th>Date</th><th>Decision</th></tr></thead><tbody>
        ${allDecisions.map((dd) => `<tr><td>${dd.turn}</td><td>${esc(dd.date)}</td><td>${esc(dd.decision)}</td></tr>`).join('')}
        ${allDecisions.length === 0 ? '<tr><td colspan="3" style="color:#555">No decisions recorded</td></tr>' : ''}
      </tbody></table>
    </div>
    ${allStateChanges.length > 0 ? `<div class="card"><h3>⚠️ Warnings & State Changes (${allStateChanges.length})</h3>
      <table><thead><tr><th>Turn</th><th>Warning</th></tr></thead><tbody>
        ${allStateChanges.map((c) => `<tr><td>${c.turn}</td><td><span class="badge badge-warn">${esc(c.text)}</span></td></tr>`).join('')}
      </tbody></table>
    </div>` : ''}
  </div>

  <!-- ANALYSIS -->
  <div id="panel-analysis" class="panel">
    <div class="card">
      <h3>🤖 Strategic Analysis</h3>
      ${analysisHtml ? `<div style="line-height:1.8;font-size:13px">${analysisHtml}</div>` : '<p style="color:#555">No analysis available. Configure AI settings or run the simulation to generate analysis.</p>'}
    </div>
    ${(() => {
      const deepEntries = timeline.filter((s) => s.deepAnalysis);
      if (deepEntries.length === 0) return '';
      return `<div class="card" style="margin-top:16px">
        <h3>🧠 Per-Round Deep Strategy Briefings (${deepEntries.length} rounds)</h3>
        <div style="max-height:600px;overflow-y:auto">
          ${deepEntries.map((s) => {
            const briefHtml = esc(s.deepAnalysis ?? '').replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            return `<div style="border-left:3px solid #4fc3f7;padding:12px 16px;margin:8px 0;background:#111">
              <div style="font-weight:600;color:#4fc3f7;margin-bottom:8px">Turn ${s.turn} — ${esc(s.date)}</div>
              <div style="font-size:12px;color:#ccc;line-height:1.7">${briefHtml}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    })()}
  </div>

  <!-- TIMELINE -->
  <div id="panel-timeline" class="panel">
    <input class="search-box" id="timelineSearch" placeholder="🔍 Search timeline (headlines, decisions, events...)" oninput="filterTimeline()">
    <div class="filter-bar">
      <button class="filter-btn active" data-filter="all" onclick="toggleFilter(this)">All</button>
      <button class="filter-btn" data-filter="decisions" onclick="toggleFilter(this)">Decisions</button>
      <button class="filter-btn" data-filter="headlines" onclick="toggleFilter(this)">Headlines</button>
      <button class="filter-btn" data-filter="market" onclick="toggleFilter(this)">Market</button>
      <button class="filter-btn" data-filter="tech" onclick="toggleFilter(this)">Tech</button>
      <button class="filter-btn" data-filter="warnings" onclick="toggleFilter(this)">Warnings</button>
      <button class="filter-btn" data-filter="analysis" onclick="toggleFilter(this)">Analysis</button>
    </div>
    <div id="timelineContainer">
      ${timeline.map((s) => {
        const parts: string[] = [];
        if (s.decisions.length) parts.push(`<strong>Decisions:</strong> ${s.decisions.map((x) => esc(x)).join('; ')}`);
        if (s.headlines.length) parts.push(`<strong>Headlines:</strong> ${s.headlines.map((x) => esc(x)).join('; ')}`);
        if (s.actions.length) parts.push(`<strong>AI Actions:</strong> ${s.actions.map((x) => esc(x)).join('; ')}`);
        if (s.stateChanges.length) parts.push(`<strong>⚠️ Warnings:</strong> ${s.stateChanges.map((x) => esc(x)).join('; ')}`);
        if (s.marketEvents.length) parts.push(`<strong>📊 Market:</strong> ${s.marketEvents.map((x) => esc(x)).join('; ')}`);
        if (s.marketAnalysis) parts.push(`<strong>💹 Analysis:</strong> ${esc(s.marketAnalysis)}`);
        if (s.techDiscoveries.length) parts.push(`<strong>🔬 Tech:</strong> ${s.techDiscoveries.map((x) => esc(x)).join('; ')}`);
        if (s.deepAnalysis) parts.push(`<strong>🧠 Strategy:</strong> ${esc(s.deepAnalysis.split('\n')[0] ?? '')}`);
        const cats = [
          s.decisions.length ? 'decisions' : '',
          s.headlines.length ? 'headlines' : '',
          s.marketEvents.length || s.marketAnalysis ? 'market' : '',
          s.techDiscoveries.length ? 'tech' : '',
          s.stateChanges.length ? 'warnings' : '',
          s.deepAnalysis ? 'analysis' : '',
        ].filter(Boolean).join(' ');
        return `<div class="timeline-entry" data-cats="${cats} all" data-text="${esc(parts.join(' ').toLowerCase())}"><div class="turn-label">Turn ${s.turn} — ${esc(s.date)}</div><div class="content">${parts.join('<br>')}</div></div>`;
      }).join('')}
    </div>
  </div>

  <footer>Generated by New Order Simulation Engine · ${new Date().toLocaleDateString()}</footer>
</div>

<script>
const TURNS = ${turnsJson};
const chartOpts = (title) => ({responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#888',font:{size:11}}},title:{display:!!title,text:title,color:'#e0e0e0'}},scales:{x:{ticks:{color:'#555'},grid:{color:'#1a1a2e'}},y:{ticks:{color:'#555'},grid:{color:'#1a1a2e'}}}});
const mkDs = (label,data,color,fill=false) => ({label,data,borderColor:color,backgroundColor:fill?color+'33':'transparent',borderWidth:2,pointRadius:1,tension:.3,fill});

// Overview charts
new Chart('chartStability',{type:'line',data:{labels:TURNS,datasets:[mkDs('Stability',${stabilitySeries},'#4caf50'),mkDs('Popularity',${popularitySeries},'#2196f3')]},options:chartOpts()});
new Chart('chartEconomy',{type:'line',data:{labels:TURNS,datasets:[mkDs('GDP ($B)',${gdpSeries},'#ffb300'),mkDs('Treasury ($B)',${treasurySeries},'#06b6d4')]},options:chartOpts()});
new Chart('chartMilitary',{type:'line',data:{labels:TURNS,datasets:[mkDs('Military',${militarySeries},'#ef5350'),mkDs('Nuclear',${nuclearSeries},'#f59e0b')]},options:chartOpts()});
new Chart('chartInflation',{type:'line',data:{labels:TURNS,datasets:[mkDs('Inflation %',${inflationSeries},'#e91e63',true)]},options:chartOpts()});

// Market indexes
${indexIds.length > 0 ? `new Chart('chartIndexes',{type:'line',data:{labels:TURNS,datasets:[${indexIds.map((id, i) => `mkDs('${id}',${indexSeries[id]},['#4caf50','#2196f3','#ffb300','#ef5350','#06b6d4','#e91e63'][${i}%6])`).join(',')}]},options:chartOpts()});` : `document.getElementById('chartIndexes').parentElement.innerHTML='<p style="color:#555;text-align:center;padding:40px">No market index data available</p>';`}

// Technology
new Chart('chartTech',{type:'line',data:{labels:TURNS,datasets:[${techDomains.map((d, i) => `mkDs('${d}',${techSeries[d]},['#4caf50','#2196f3','#ffb300','#ef5350','#06b6d4','#e91e63'][${i}])`).join(',')}]},options:chartOpts()});

// Education
new Chart('chartEduLit',{type:'line',data:{labels:TURNS,datasets:[mkDs('Literacy %',${eduLiteracy},'#4caf50'),mkDs('Innovation',${eduInnovation},'#06b6d4')]},options:chartOpts()});
new Chart('chartEduResearch',{type:'line',data:{labels:TURNS,datasets:[mkDs('Research Bonus',${eduResearch},'#ffb300'),mkDs('Tech Investment',${eduTechInvest},'#e91e63')]},options:chartOpts()});

// Faction comparison
new Chart('chartFactionStab',{type:'bar',data:{labels:${factionLabels},datasets:[{label:'Stability',data:${factionStability},backgroundColor:${factionColors}}]},options:{...chartOpts(),indexAxis:'y'}});
new Chart('chartFactionGdp',{type:'bar',data:{labels:${factionLabels},datasets:[{label:'GDP ($B)',data:${factionGdp},backgroundColor:${factionColors}}]},options:{...chartOpts(),indexAxis:'y'}});

// Tab switching
function switchTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');
  event.target.classList.add('active');
}

// Timeline filtering
function filterTimeline(){
  const q = document.getElementById('timelineSearch').value.toLowerCase();
  document.querySelectorAll('.timeline-entry').forEach(el=>{
    el.style.display = el.dataset.text.includes(q) ? '' : 'none';
  });
}
function toggleFilter(btn){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const f = btn.dataset.filter;
  document.querySelectorAll('.timeline-entry').forEach(el=>{
    el.style.display = el.dataset.cats.includes(f) ? '' : 'none';
  });
}
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function csvEsc(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function downloadCsv(timeline: TurnSnapshot[], filename: string) {
  const fids = timeline[0] ? Object.keys(timeline[0].factions) : [];
  // Collect all ticker / index / sentiment / tech domain keys across all snapshots
  const tickerIds = [...new Set(timeline.flatMap((s) => s.marketTickers ? Object.keys(s.marketTickers) : []))];
  const indexIds  = [...new Set(timeline.flatMap((s) => s.marketIndexes ? Object.keys(s.marketIndexes) : []))];
  const techFids  = [...new Set(timeline.flatMap((s) => s.technology ? Object.keys(s.technology) : []))];
  const techDomains: Array<'ai' | 'semiconductors' | 'space' | 'cyber' | 'biotech' | 'quantum'> =
    ['ai', 'semiconductors', 'space', 'cyber', 'biotech', 'quantum'];

  // Collect education faction keys
  const eduFids = [...new Set(timeline.flatMap((s) => s.education ? Object.keys(s.education) : []))];

  const headers = [
    'Turn', 'Date', 'Headlines', 'Decisions', 'AI_Actions', 'State_Changes',
    // Per-faction core stats
    ...fids.flatMap((f) => [
      `${f}_stability`, `${f}_gdp`, `${f}_treasury`, `${f}_inflation`,
      `${f}_military`, `${f}_diplomacy`, `${f}_popularity`, `${f}_nuclear`, `${f}_tech`,
    ]),
    // Education per faction
    ...eduFids.flatMap((f) => [
      `${f}_literacy`, `${f}_researchBonus`, `${f}_innovation`, `${f}_techInvestIdx`,
    ]),
    // Market tickers
    ...tickerIds.flatMap((t) => [`${t}_price`, `${t}_change`, `${t}_pct`, `${t}_trend`]),
    // Market indexes
    ...indexIds.flatMap((ix) => [`idx_${ix}_value`, `idx_${ix}_change`, `idx_${ix}_pct`]),
    'Market_Events', 'Market_Analysis',
    // Technology per faction
    ...techFids.flatMap((f) => techDomains.map((d) => `${f}_tech_${d}`)),
    'Tech_Discoveries',
    // Diplomatic tensions
    'Tensions',
    // Deep analysis
    'Deep_Analysis',
  ];

  const rows = timeline.map((s) => [
    s.turn, s.date,
    csvEsc(s.headlines.join('; ')),
    csvEsc(s.decisions.join('; ')),
    csvEsc(s.actions.join('; ')),
    csvEsc(s.stateChanges.join('; ')),
    // Per-faction stats
    ...fids.flatMap((f) => {
      const fs = s.factions[f];
      return fs ? [fs.stability, fs.gdp, fs.treasury, fs.inflation,
        fs.militaryReadiness, fs.diplomaticInfluence, fs.popularity, fs.nuclearThreshold, fs.techLevel] : Array(9).fill('');
    }),
    // Education per faction
    ...eduFids.flatMap((f) => {
      const ed = s.education?.[f];
      return ed ? [ed.literacyRate.toFixed(2), ed.researchBonus.toFixed(2),
        ed.innovationCapacity.toFixed(2), ed.techInvestmentIndex.toFixed(2)] : ['', '', '', ''];
    }),
    // Tickers
    ...tickerIds.flatMap((t) => {
      const tk = s.marketTickers?.[t];
      return tk ? [tk.price.toFixed(2), tk.change.toFixed(2), tk.changePct.toFixed(4), tk.trend] : ['', '', '', ''];
    }),
    // Indexes
    ...indexIds.flatMap((ix) => {
      const mi = s.marketIndexes?.[ix];
      return mi ? [mi.value.toFixed(2), mi.change.toFixed(2), mi.changePct.toFixed(4)] : ['', '', ''];
    }),
    csvEsc(s.marketEvents.join('; ')),
    csvEsc(s.marketAnalysis || ''),
    // Technology
    ...techFids.flatMap((f) => techDomains.map((d) => s.technology?.[f]?.[d] ?? '')),
    csvEsc(s.techDiscoveries.join('; ')),
    // Tensions
    csvEsc(s.tensions ? s.tensions.map((t) => `${t.factionA}↔${t.factionB}:${t.level.toFixed(0)}(${t.trend})`).join('; ') : ''),
    // Deep analysis
    csvEsc(s.deepAnalysis ?? ''),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ANALYSIS_KEY = 'neworder-scenario-analysis';

// ─── Scenario Analysis Generator (AI or Internal Engine) ──────

/**
 * Generate a comprehensive scenario analysis. If AI settings are configured
 * and enabled, sends the scenario summary to the AI provider for a rich
 * narrative analysis. Otherwise, falls back to the internal
 * StrategicAnalysisEngine for a deterministic analysis.
 */
async function generateScenarioAnalysis(
  timeline: TurnSnapshot[],
  reason: string | null,
  playerFaction: string,
  scenarioName: string,
  aiSettings: AISettingsState | null,
): Promise<string> {
  if (timeline.length === 0) return 'No simulation data available for analysis.';

  const fInfo = (FACTION_INFO as Record<string, any>)[playerFaction];
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');
  const first = timeline[0]!;
  const last = timeline[timeline.length - 1]!;
  const pFirst = first.factions[playerFaction];
  const pLast = last.factions[playerFaction];
  const allDecisions = timeline.flatMap((s) => s.decisions);
  const allDisc = timeline.flatMap((s) => s.techDiscoveries);
  const allMarketEvts = timeline.flatMap((s) => s.marketEvents);
  const allWarnings = timeline.flatMap((s) => s.stateChanges);
  const topTensions = last.tensions?.slice(0, 5) ?? [];

  // Build a compact scenario summary for the AI prompt
  const summaryLines: string[] = [];
  summaryLines.push(`# Scenario: ${scenarioName}`);
  summaryLines.push(`Player: ${fInfo?.flag ?? ''} ${fInfo?.name ?? playerFaction}`);
  summaryLines.push(`Outcome: ${isVictory ? 'Victory' : 'Defeat'} — ${reason ?? 'Unknown'}`);
  summaryLines.push(`Total Turns: ${timeline.length}`);
  summaryLines.push('');
  if (pFirst && pLast) {
    summaryLines.push('## Key Metrics (Start → End):');
    summaryLines.push(`- Stability: ${pFirst.stability} → ${pLast.stability}`);
    summaryLines.push(`- GDP: $${pFirst.gdp}B → $${pLast.gdp}B`);
    summaryLines.push(`- Treasury: $${pFirst.treasury}B → $${pLast.treasury}B`);
    summaryLines.push(`- Inflation: ${pFirst.inflation}% → ${pLast.inflation}%`);
    summaryLines.push(`- Military Readiness: ${pFirst.militaryReadiness} → ${pLast.militaryReadiness}`);
    summaryLines.push(`- Diplomatic Influence: ${pFirst.diplomaticInfluence} → ${pLast.diplomaticInfluence}`);
    summaryLines.push(`- Popularity: ${pFirst.popularity} → ${pLast.popularity}`);
    summaryLines.push(`- Tech Level: ${pFirst.techLevel} → ${pLast.techLevel}`);
    summaryLines.push('');
  }
  // Education summary
  const eduFirst = first.education?.[playerFaction];
  const eduLast = last.education?.[playerFaction];
  if (eduFirst && eduLast) {
    summaryLines.push('## Education & Innovation:');
    summaryLines.push(`- Literacy Rate: ${eduFirst.literacyRate}% → ${eduLast.literacyRate}%`);
    summaryLines.push(`- Research Bonus: ${eduFirst.researchBonus} → ${eduLast.researchBonus}`);
    summaryLines.push(`- Innovation Capacity: ${eduFirst.innovationCapacity} → ${eduLast.innovationCapacity}`);
    summaryLines.push(`- Tech Investment Index: ${eduFirst.techInvestmentIndex} → ${eduLast.techInvestmentIndex}`);
    summaryLines.push('');
  }
  // Technology
  const techFirst = first.technology?.[playerFaction];
  const techLast = last.technology?.[playerFaction];
  if (techFirst && techLast) {
    summaryLines.push('## Technology Domains (Start → End):');
    for (const d of ['ai', 'semiconductors', 'space', 'cyber', 'biotech', 'quantum'] as const) {
      summaryLines.push(`- ${d}: ${techFirst[d]} → ${techLast[d]}`);
    }
    summaryLines.push('');
  }
  if (allDisc.length > 0) {
    summaryLines.push(`## Technology Discoveries (${allDisc.length}):`);
    allDisc.slice(0, 20).forEach((d) => summaryLines.push(`- ${d}`));
    summaryLines.push('');
  }
  // Market overview
  if (allMarketEvts.length > 0) {
    summaryLines.push(`## Market Events (${allMarketEvts.length} total, showing last 15):`);
    allMarketEvts.slice(-15).forEach((e) => summaryLines.push(`- ${e}`));
    summaryLines.push('');
  }
  // Market analysis per-turn summary
  const marketCommentary = timeline.filter((s) => s.marketAnalysis).map((s) => `Turn ${s.turn}: ${s.marketAnalysis}`);
  if (marketCommentary.length > 0) {
    summaryLines.push('## Market Analysis Highlights:');
    // Sample every 5th turn to keep prompt manageable
    marketCommentary.filter((_, i) => i % 5 === 0 || i === marketCommentary.length - 1).forEach((c) => summaryLines.push(`- ${c}`));
    summaryLines.push('');
  }
  // Tensions
  if (topTensions.length > 0) {
    summaryLines.push('## Top Diplomatic Tensions (final state):');
    topTensions.forEach((t) => {
      const aName = (FACTION_INFO as Record<string, any>)[t.factionA]?.name ?? t.factionA;
      const bName = (FACTION_INFO as Record<string, any>)[t.factionB]?.name ?? t.factionB;
      summaryLines.push(`- ${aName} vs ${bName}: ${t.level} (${t.trend})`);
    });
    summaryLines.push('');
  }
  // Warnings
  if (allWarnings.length > 0) {
    summaryLines.push(`## System Warnings (${allWarnings.length}):`);
    allWarnings.slice(-10).forEach((w) => summaryLines.push(`- ${w}`));
    summaryLines.push('');
  }
  // Key decisions sample
  if (allDecisions.length > 0) {
    summaryLines.push(`## Key Decisions (${allDecisions.length} total, sample):`);
    // Sample every 3rd decision
    allDecisions.filter((_, i) => i % 3 === 0).slice(0, 20).forEach((d) => summaryLines.push(`- ${d}`));
    summaryLines.push('');
  }
  // Faction comparison
  summaryLines.push('## Faction Comparison (final state):');
  for (const [fid, fs] of Object.entries(last.factions)) {
    const fi = (FACTION_INFO as Record<string, any>)[fid];
    summaryLines.push(`- ${fi?.flag ?? ''} ${fi?.name ?? fid}: Stab=${fs.stability} GDP=$${fs.gdp}B Mil=${fs.militaryReadiness} Dip=${fs.diplomaticInfluence} Tech=${fs.techLevel}`);
  }

  const scenarioSummary = summaryLines.join('\n');

  // ── Try AI adapter first if configured ──
  if (aiSettings?.enabled && aiSettings.apiKey) {
    try {
      const adapter = createAdapter({
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
      });
      const response = await adapter.complete({
        systemPrompt: `You are a world-class geopolitical analyst and strategic advisor. You are analyzing the results of a geopolitical simulation game called "New Order" set in 2026+. Provide an extremely detailed, professional analysis covering:\n\n1. **Executive Summary** (2-3 paragraphs: overall assessment, key turning points, outcome evaluation)\n2. **Strategic Performance** (player decision quality, missed opportunities, critical errors)\n3. **Economic Analysis** (GDP trajectory, inflation management, treasury utilization, market performance)\n4. **Technology & Innovation Assessment** (R&D progress, discoveries, tech advantages/gaps, education impact)\n5. **Military & Security Review** (readiness trends, threat assessment, nuclear posture)\n6. **Diplomatic Landscape** (alliance shifts, tension hotspots, influence trajectory)\n7. **Education & Human Capital** (literacy trends, research capacity, innovation potential)\n8. **Market Intelligence** (market events impact, sentiment patterns, economic resilience)\n9. **Scenario Verdict** (final grade, what went right/wrong, lessons learned)\n10. **Strategic Recommendations** (what the player should do differently next time)\n\nBe specific with numbers. Reference actual turns, events, and decisions from the data. Use professional geopolitical analysis language. Format with clear markdown headings and bullet points.`,
        userPrompt: `Analyze this completed simulation:\n\n${scenarioSummary}`,
        temperature: aiSettings.temperature ?? 0.7,
        maxTokens: aiSettings.maxTokens ?? 4096,
      });
      if (response.content) return response.content;
    } catch (err: any) {
      console.warn('AI analysis failed, falling back to internal engine:', err?.message);
    }
  }

  // ── Fallback: Internal Strategic Analysis Engine ──
  return generateInternalAnalysis(timeline, reason, playerFaction, scenarioName);
}

/**
 * Deterministic internal analysis using StrategicAnalysisEngine + computed metrics.
 * No AI required — uses pure engine calculations.
 */
function generateInternalAnalysis(
  timeline: TurnSnapshot[],
  reason: string | null,
  playerFaction: string,
  scenarioName: string,
): string {
  const fInfo = (FACTION_INFO as Record<string, any>)[playerFaction];
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');
  const first = timeline[0]!;
  const last = timeline[timeline.length - 1]!;
  const pFirst = first.factions[playerFaction];
  const pLast = last.factions[playerFaction];
  const lines: string[] = [];

  // Strategic grade computation via engine
  let gradeText = 'C';
  try {
    const engine = new StrategicAnalysisEngine({
      postGameAnalysis: GAME_CONFIG.postGameAnalysis,
      advisory: GAME_CONFIG.advisory,
    });
    // Compute composite scores from stability/gdp/military/diplomacy across timeline
    const compositeScores = timeline.map((s) => {
      const fs = s.factions[playerFaction];
      if (!fs) return 50;
      return Math.round(fs.stability * 0.25 + (fs.gdp / 300) * 0.2 + fs.militaryReadiness * 0.2 +
        fs.diplomaticInfluence * 0.15 + fs.popularity * 0.1 + fs.techLevel * 0.1);
    });
    const outcome = isVictory ? 'victory' as const : reason?.includes('collapsed') ? 'loss' as const : 'timeout' as const;
    const gradeResult = engine.computeStrategicGrade({
      compositeScores,
      inflectionPointCount: 0,
      finalOutcome: outcome,
    });
    gradeText = gradeResult.grade;
  } catch { /* use default */ }

  lines.push(`# 📋 Strategic Analysis Report`);
  lines.push('');
  lines.push(`**Scenario:** ${scenarioName}`);
  lines.push(`**Player:** ${fInfo?.flag ?? ''} ${fInfo?.name ?? playerFaction}`);
  lines.push(`**Outcome:** ${isVictory ? '🏆 Victory' : '💀 Defeat'} — ${reason ?? 'Unknown'}`);
  lines.push(`**Strategic Grade:** ${gradeText}`);
  lines.push(`**Turns Played:** ${timeline.length}`);
  lines.push('');

  // Executive summary
  lines.push(`## Executive Summary`);
  lines.push('');
  if (pFirst && pLast) {
    const stabDelta = pLast.stability - pFirst.stability;
    const gdpDelta = pLast.gdp - pFirst.gdp;
    const milDelta = pLast.militaryReadiness - pFirst.militaryReadiness;
    const dipDelta = pLast.diplomaticInfluence - pFirst.diplomaticInfluence;
    const techDelta = pLast.techLevel - pFirst.techLevel;
    const popDelta = pLast.popularity - pFirst.popularity;

    lines.push(`Over ${timeline.length} turns, ${fInfo?.name ?? playerFaction} experienced ${stabDelta >= 0 ? 'improving' : 'declining'} stability (${stabDelta >= 0 ? '+' : ''}${stabDelta} points) and ${gdpDelta >= 0 ? 'economic growth' : 'economic contraction'} of $${Math.abs(gdpDelta)}B GDP.`);
    lines.push('');

    if (milDelta > 10) lines.push('Military capabilities expanded significantly, strengthening the nation\'s deterrence posture.');
    else if (milDelta < -10) lines.push('Military readiness declined, potentially weakening the nation\'s security position.');
    lines.push('');

    if (dipDelta > 10) lines.push('Diplomatic influence grew substantially, expanding the nation\'s soft power projection.');
    else if (dipDelta < -10) lines.push('Diplomatic standing deteriorated, limiting foreign policy options.');
    lines.push('');

    if (techDelta > 15) lines.push('Technology leadership advanced rapidly, creating competitive advantages across multiple domains.');
    else if (techDelta < 0) lines.push('Technology stagnated, risking loss of competitive edge to rival powers.');
    lines.push('');

    if (popDelta > 10) lines.push('Public approval strengthened considerably, providing a stable mandate for governance.');
    else if (popDelta < -10) lines.push('Public confidence eroded significantly, undermining regime legitimacy.');
    lines.push('');
  }

  // Economic analysis
  lines.push(`## Economic Performance`);
  lines.push('');
  if (pFirst && pLast) {
    const gdpGrowthPct = pFirst.gdp > 0 ? (((pLast.gdp - pFirst.gdp) / pFirst.gdp) * 100).toFixed(4) : '0';
    lines.push(`- GDP Growth: ${gdpGrowthPct}% ($${pFirst.gdp}B → $${pLast.gdp}B)`);
    lines.push(`- Inflation: ${pFirst.inflation}% → ${pLast.inflation}% ${pLast.inflation > 15 ? '⚠️ CRITICAL' : pLast.inflation > 8 ? '⚠️ Elevated' : '✅ Manageable'}`);
    lines.push(`- Treasury: $${pFirst.treasury}B → $${pLast.treasury}B ${pLast.treasury < 50 ? '⚠️ Dangerously low' : ''}`);
    lines.push('');
    // Inflation trend
    const highInflationTurns = timeline.filter((s) => (s.factions[playerFaction]?.inflation ?? 0) > 12);
    if (highInflationTurns.length > 0) {
      lines.push(`Inflation exceeded 12% on ${highInflationTurns.length} turn(s), indicating persistent economic pressure.`);
      lines.push('');
    }
  }

  // Market intelligence
  const allMktEvts = timeline.flatMap((s) => s.marketEvents);
  const allMktAnalysis = timeline.filter((s) => s.marketAnalysis).map((s) => s.marketAnalysis);
  lines.push(`## Market Intelligence`);
  lines.push('');
  if (allMktEvts.length > 0) {
    const crashes = allMktEvts.filter((e) => e.includes('crash'));
    const rallies = allMktEvts.filter((e) => e.includes('rally'));
    lines.push(`Market events: ${allMktEvts.length} total (${crashes.length} crashes, ${rallies.length} rallies).`);
    if (crashes.length > rallies.length * 2) lines.push('Markets were predominantly bearish throughout the simulation, indicating systemic economic instability.');
    else if (rallies.length > crashes.length * 2) lines.push('Markets showed strong bullish momentum, reflecting positive economic fundamentals.');
    else lines.push('Markets displayed mixed signals with alternating periods of growth and contraction.');
    lines.push('');
  } else {
    lines.push('No significant market events were recorded during the simulation.');
    lines.push('');
  }
  if (allMktAnalysis.length > 0) {
    lines.push('**Turn-by-turn market highlights:**');
    allMktAnalysis.filter((_, i) => i % 5 === 0 || i === allMktAnalysis.length - 1).forEach((a) => lines.push(`- ${a}`));
    lines.push('');
  }

  // Technology assessment
  const techFirst = first.technology?.[playerFaction];
  const techLast = last.technology?.[playerFaction];
  const allDisc = timeline.flatMap((s) => s.techDiscoveries);
  lines.push(`## Technology & Innovation`);
  lines.push('');
  if (techFirst && techLast) {
    const domains = ['ai', 'semiconductors', 'space', 'cyber', 'biotech', 'quantum'] as const;
    for (const d of domains) {
      const delta = techLast[d] - techFirst[d];
      const assessment = delta > 10 ? 'Rapid advancement' : delta > 5 ? 'Steady progress' : delta > 0 ? 'Moderate growth' : 'Stagnant';
      lines.push(`- **${d.charAt(0).toUpperCase() + d.slice(1)}**: ${techFirst[d]} → ${techLast[d]} (${delta >= 0 ? '+' : ''}${delta}) — ${assessment}`);
    }
    lines.push('');
    // Leading domains
    const sorted = domains.map((d) => ({ domain: d, value: techLast[d] })).sort((a, b) => b.value - a.value);
    lines.push(`Leading domain: **${sorted[0]?.domain}** (${sorted[0]?.value}). Weakest: **${sorted[sorted.length - 1]?.domain}** (${sorted[sorted.length - 1]?.value}).`);
    lines.push('');
  }
  if (allDisc.length > 0) {
    lines.push(`**Discoveries (${allDisc.length}):**`);
    allDisc.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  } else {
    lines.push('No technology breakthroughs were recorded. R&D investment may have been insufficient.');
    lines.push('');
  }

  // Education & human capital
  const eduFirst = first.education?.[playerFaction];
  const eduLast = last.education?.[playerFaction];
  lines.push(`## Education & Human Capital`);
  lines.push('');
  if (eduFirst && eduLast) {
    lines.push(`- Literacy Rate: ${eduFirst.literacyRate}% → ${eduLast.literacyRate}% ${eduLast.literacyRate > 90 ? '✅ World-class' : eduLast.literacyRate > 70 ? 'Adequate' : '⚠️ Below target'}`);
    lines.push(`- Research Bonus: ${eduFirst.researchBonus} → ${eduLast.researchBonus}`);
    lines.push(`- Innovation Capacity: ${eduFirst.innovationCapacity} → ${eduLast.innovationCapacity}`);
    lines.push(`- Tech Investment Index: ${eduFirst.techInvestmentIndex} → ${eduLast.techInvestmentIndex}`);
    lines.push('');
    if (eduLast.innovationCapacity > eduFirst.innovationCapacity) {
      lines.push('Human capital metrics improved over the simulation, supporting long-term technological competitiveness.');
    } else {
      lines.push('Human capital metrics stagnated or declined, potentially limiting future innovation capacity.');
    }
    lines.push('');
  }

  // Diplomatic landscape
  const lastTensions = last.tensions ?? [];
  lines.push(`## Diplomatic Landscape`);
  lines.push('');
  if (lastTensions.length > 0) {
    lines.push('**Active Tension Hotspots:**');
    for (const t of lastTensions.slice(0, 8)) {
      const aName = (FACTION_INFO as Record<string, any>)[t.factionA]?.name ?? t.factionA;
      const bName = (FACTION_INFO as Record<string, any>)[t.factionB]?.name ?? t.factionB;
      const severity = t.level > 70 ? '🔴 Critical' : t.level > 50 ? '🟠 Elevated' : '🟡 Moderate';
      lines.push(`- ${aName} ↔ ${bName}: Level ${t.level} (${t.trend}) — ${severity}`);
    }
    lines.push('');
    const critical = lastTensions.filter((t) => t.level > 70);
    if (critical.length > 0) {
      lines.push(`⚠️ ${critical.length} critical tension point(s) detected. Risk of military escalation is significant.`);
      lines.push('');
    }
  } else {
    lines.push('No significant diplomatic tensions were recorded at simulation end.');
    lines.push('');
  }

  // Warnings & crises
  const allWarnings = timeline.flatMap((s) => s.stateChanges);
  if (allWarnings.length > 0) {
    lines.push(`## Warnings & Crises (${allWarnings.length})`);
    lines.push('');
    const critical = allWarnings.filter((w) => w.includes('CRITICAL'));
    const warnings = allWarnings.filter((w) => !w.includes('CRITICAL'));
    if (critical.length > 0) {
      lines.push(`**Critical alerts:** ${critical.length}`);
      critical.slice(0, 5).forEach((w) => lines.push(`- 🔴 ${w}`));
      lines.push('');
    }
    if (warnings.length > 0) {
      lines.push(`**Warnings:** ${warnings.length}`);
      warnings.slice(0, 10).forEach((w) => lines.push(`- ⚠️ ${w}`));
      lines.push('');
    }
  }

  // Faction comparison
  lines.push(`## Global Power Rankings (End State)`);
  lines.push('');
  const rankings = Object.entries(last.factions).map(([fid, fs]) => ({
    fid, name: (FACTION_INFO as Record<string, any>)[fid]?.name ?? fid,
    flag: (FACTION_INFO as Record<string, any>)[fid]?.flag ?? '',
    power: Math.round(fs.stability * 0.2 + (fs.gdp / 200) * 0.3 + fs.militaryReadiness * 0.2 +
      fs.diplomaticInfluence * 0.15 + fs.techLevel * 0.15),
    ...fs,
  })).sort((a, b) => b.power - a.power);
  rankings.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const isPlayer = r.fid === playerFaction;
    lines.push(`${medal} ${r.flag} **${r.name}**${isPlayer ? ' (You)' : ''} — Power: ${r.power} | Stab: ${r.stability} | GDP: $${r.gdp}B | Mil: ${r.militaryReadiness} | Dip: ${r.diplomaticInfluence}`);
  });
  lines.push('');

  // Verdict
  lines.push(`## Scenario Verdict`);
  lines.push('');
  lines.push(`**Grade: ${gradeText}**`);
  lines.push('');
  if (isVictory) {
    lines.push('The simulation concluded with a victory, demonstrating effective strategic management across multiple domains.');
  } else {
    lines.push('The simulation ended without achieving victory conditions. Key areas for improvement have been identified above.');
  }
  lines.push('');
  lines.push('*Analysis generated by New Order Internal Strategic Engine*');

  return lines.join('\n');
}

function captureTurnSnapshot(
  turnNum: number,
  nationStates: Record<string, any>,
  headlineTexts: string[],
  actionTexts: string[],
  marketState: any,
  opts?: {
    decisions?: string[];
    stateChanges?: string[];
    technologyIndices?: Record<string, any> | null;
    techModuleRegistry?: any;
    prevTechDiscoveryCount?: number;
    relationshipMatrix?: Record<string, Record<string, number>> | null;
    prevSnapshot?: TurnSnapshot | null;
    deepAnalysis?: string | null;
  },
): TurnSnapshot {
  const base = new Date(2026, 2, 1);
  base.setMonth(base.getMonth() + turnNum - 1);
  const date = base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const factions: TurnSnapshot['factions'] = {};
  for (const [fid, ns] of Object.entries(nationStates)) {
    if (!ns) continue;
    factions[fid] = {
      stability: Math.round(ns.stability ?? 0),
      gdp: Math.round(ns.gdp ?? 0),
      treasury: Math.round(ns.treasury ?? 0),
      inflation: +(ns.inflation ?? 0).toFixed(4),
      militaryReadiness: Math.round(ns.militaryReadiness ?? 0),
      diplomaticInfluence: Math.round(ns.diplomaticInfluence ?? 0),
      popularity: Math.round(ns.popularity ?? 0),
      nuclearThreshold: Math.round(ns.nuclearThreshold ?? 0),
      techLevel: Math.round(ns.techLevel ?? 0),
    };
  }

  // ── Market summary (legacy compact) ──
  let marketSummary: string | null = null;
  if (marketState?.exchangeStates) {
    const exchanges = Object.entries(marketState.exchangeStates as Record<string, any>)
      .map(([k, v]: [string, any]) => `${k}: ${v.currentPrice?.toFixed(0) ?? '?'}`)
      .join(', ');
    marketSummary = exchanges;
  }

  // ── Detailed market data ──
  let marketTickers: TurnSnapshot['marketTickers'] = null;
  let marketIndexes: TurnSnapshot['marketIndexes'] = null;
  let marketSentiment: TurnSnapshot['marketSentiment'] = null;
  const marketEvents: string[] = [];

  if (marketState) {
    // Tickers
    if (marketState.tickerStates) {
      marketTickers = {};
      for (const [id, ts] of Object.entries(marketState.tickerStates as Record<string, any>)) {
        const change = (ts.currentPrice ?? 0) - (ts.previousPrice ?? ts.currentPrice ?? 0);
        const prev = ts.previousPrice ?? ts.currentPrice ?? 1;
        marketTickers[id] = {
          price: +(ts.currentPrice ?? 0).toFixed(2),
          change: +change.toFixed(2),
          changePct: prev !== 0 ? +((change / prev) * 100).toFixed(4) : 0,
          trend: ts.trendDirection ?? 'stable',
        };
      }
    }
    // Indexes
    if (marketState.indexStates) {
      marketIndexes = {};
      for (const [id, ix] of Object.entries(marketState.indexStates as Record<string, any>)) {
        const hist = ix.history as any[] | undefined;
        const lastChange = hist?.length ? hist[hist.length - 1] : null;
        marketIndexes[id] = {
          value: +(ix.currentValue ?? 0).toFixed(2),
          change: +(lastChange?.change ?? 0).toFixed(2),
          changePct: +(lastChange?.changePercent ?? 0).toFixed(4),
        };
      }
    }
    // Sentiment
    if (marketState.sentimentStates) {
      marketSentiment = {};
      for (const [id, ss] of Object.entries(marketState.sentimentStates as Record<string, any>)) {
        marketSentiment[id] = {
          sentiment: ss.sentiment ?? 'neutral',
          score: ss.sentimentScore ?? 0,
          volatility: ss.volatilityIndex ?? 0,
        };
      }
    }
    // Events
    if (marketState.marketEventLog?.length) {
      const log = marketState.marketEventLog as any[];
      for (const evt of log.slice(-5)) {
        marketEvents.push(`[${evt.eventType}] ${evt.cause ?? ''} (magnitude: ${evt.magnitude ?? '?'})`);
      }
    }
  }

  // ── Technology snapshot ──
  let technology: TurnSnapshot['technology'] = null;
  const techDiscoveries: string[] = [];
  const techIdx = opts?.technologyIndices;
  if (techIdx && typeof techIdx === 'object') {
    technology = {};
    for (const [fid, ti] of Object.entries(techIdx)) {
      if (!ti) continue;
      technology[fid] = {
        ai: Math.round(ti.ai ?? 0),
        semiconductors: Math.round(ti.semiconductors ?? 0),
        space: Math.round(ti.space ?? 0),
        cyber: Math.round(ti.cyber ?? 0),
        biotech: Math.round(ti.biotech ?? 0),
        quantum: Math.round(ti.quantum ?? 0),
      };
    }
  }
  // New tech module discoveries
  const tmr = opts?.techModuleRegistry;
  if (tmr?.discoveryLog?.length) {
    const prevCount = opts?.prevTechDiscoveryCount ?? 0;
    const newEntries = (tmr.discoveryLog as any[]).slice(prevCount);
    for (const d of newEntries) {
      techDiscoveries.push(`${d.factionId ?? '?'}: ${d.techName ?? d.techId ?? '?'} (${d.domain ?? '?'})`);
    }
  }

  // ── Education (derived from nation-state metrics) ──
  const education: TurnSnapshot['education'] = {};
  for (const [fid, ns] of Object.entries(nationStates)) {
    if (!ns) continue;
    const techLvl = ns.techLevel ?? 0;
    const gdp = ns.gdp ?? 0;
    const stability = ns.stability ?? 0;
    // Literacy: derived from tech level, GDP per capita proxy, and stability
    const baseLiteracy = 40 + (techLvl * 0.35) + Math.min(gdp / 600, 15) + (stability > 50 ? 5 : 0);
    const literacyRate = Math.min(99, Math.max(10, Math.round(baseLiteracy)));
    // Research bonus: tech investment drives research acceleration
    const researchBonus = +(techLvl * 0.12 + Math.max(0, gdp / 2000)).toFixed(1);
    // Innovation capacity: composite of tech, stability, and economic strength
    const innovationCapacity = Math.round(techLvl * 0.4 + stability * 0.2 + Math.min(gdp / 500, 20));
    // Tech investment index: budget proxy based on GDP allocation
    const techInvestmentIndex = +(gdp * 0.025 * (techLvl / 100 + 0.3)).toFixed(1);
    education[fid] = { literacyRate, researchBonus, innovationCapacity, techInvestmentIndex };
  }

  // ── Diplomatic tensions ──
  const tensions: TurnSnapshot['tensions'] = [];
  const relMatrix = opts?.relationshipMatrix;
  if (relMatrix) {
    const tensionPairs: Array<{ factionA: string; factionB: string; level: number }> = [];
    const fKeys = Object.keys(relMatrix);
    for (let i = 0; i < fKeys.length; i++) {
      for (let j = i + 1; j < fKeys.length; j++) {
        const a = fKeys[i]!;
        const b = fKeys[j]!;
        const level = relMatrix[a]?.[b] ?? 0;
        if (level > 10) tensionPairs.push({ factionA: a, factionB: b, level });
      }
    }
    tensionPairs.sort((x, y) => y.level - x.level);
    const prevSnap = opts?.prevSnapshot;
    for (const tp of tensionPairs.slice(0, 8)) {
      const prevPair = prevSnap?.tensions?.find(
        (t) => (t.factionA === tp.factionA && t.factionB === tp.factionB) ||
               (t.factionA === tp.factionB && t.factionB === tp.factionA),
      );
      const prevLevel = prevPair?.level ?? tp.level;
      const trend = tp.level > prevLevel + 2 ? 'rising' : tp.level < prevLevel - 2 ? 'falling' : 'stable';
      tensions.push({ ...tp, trend });
    }
  }

  // ── Market analysis commentary ──
  let marketAnalysis = '';
  if (marketSentiment || marketEvents.length > 0) {
    const commentParts: string[] = [];
    if (marketSentiment) {
      const sentiments = Object.entries(marketSentiment);
      const bullish = sentiments.filter(([, s]) => s.sentiment === 'bullish' || s.sentiment === 'very_bullish');
      const bearish = sentiments.filter(([, s]) => s.sentiment === 'bearish' || s.sentiment === 'very_bearish');
      if (bullish.length > bearish.length) {
        commentParts.push(`Markets are broadly optimistic (${bullish.length}/${sentiments.length} exchanges bullish)`);
      } else if (bearish.length > bullish.length) {
        commentParts.push(`Markets are under pressure (${bearish.length}/${sentiments.length} exchanges bearish)`);
      } else {
        commentParts.push('Market sentiment is mixed across global exchanges');
      }
      const highVol = sentiments.filter(([, s]) => s.volatility > 30);
      if (highVol.length > 0) commentParts.push(`${highVol.length} exchange(s) showing elevated volatility`);
    }
    if (marketEvents.length > 0) {
      commentParts.push(`Notable events: ${marketEvents.slice(0, 3).join('; ')}`);
    }
    // Index performance summary
    if (marketIndexes) {
      const ixEntries = Object.entries(marketIndexes);
      const gainers = ixEntries.filter(([, v]) => v.changePct > 0.5);
      const losers = ixEntries.filter(([, v]) => v.changePct < -0.5);
      if (gainers.length > 0) commentParts.push(`${gainers.length} index(es) gaining`);
      if (losers.length > 0) commentParts.push(`${losers.length} index(es) declining`);
    }
    marketAnalysis = commentParts.join('. ') + '.';
  }

  return {
    turn: turnNum, date, headlines: headlineTexts, actions: actionTexts,
    decisions: opts?.decisions ?? [],
    stateChanges: opts?.stateChanges ?? [],
    factions, marketSummary,
    marketTickers, marketIndexes, marketSentiment, marketEvents,
    technology, techDiscoveries,
    education: Object.keys(education).length > 0 ? education : null,
    tensions,
    marketAnalysis,
    deepAnalysis: opts?.deepAnalysis ?? null,
  };
}

// ─── Styles ──────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: '100vw',
  height: '100vh',
  backgroundColor: '#0a0a12',
  color: '#e0e0e0',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export const App: FC = () => {
  const turn = useCurrentTurn();
  const isGameOver = useIsGameOver();
  const gameEndReason = useGameStore((s) => s.gameEndReason);
  const isInitialized = (turn as number) > 0;
  const [endConfirmed, setEndConfirmed] = useState(false);

  // Reset confirmation when game resets (turn goes to 0)
  if (!isInitialized && endConfirmed) {
    setEndConfirmed(false);
  }

  if (!isInitialized) {
    return <StartScreen />;
  }

  // Game-over now routes through an intermediate confirmation screen
  // unless the player has already confirmed they want to see the results.
  if (isGameOver && endConfirmed) {
    return <GameOverScreen reason={gameEndReason} />;
  }

  if (isGameOver && !endConfirmed) {
    return <GameEndConfirmation reason={gameEndReason} onViewResults={() => setEndConfirmed(true)} />;
  }

  return <GameScreen />;
};

// ═══════════════════════════════════════════════════════════════
// START SCREEN — Faction Selection + Live Data
// ═══════════════════════════════════════════════════════════════

import { fetchAllLiveData } from '@/engine/live-data-fetcher';
import {
  applyLiveDataToScenario,
  getCachedLiveData,
  cacheLiveData,
  createDefaultLiveDataConfig,
} from '@/engine/live-data-engine';
import { LEADER_MODELS } from '@/data/model-loader';
import type { LiveDataProgress, LiveDataResult } from '@/data/types/live-data.types';
import type { LiveDataPatchSummary } from '@/engine/live-data-engine';

/** Persisted live-data toggle key. */
const LIVE_DATA_TOGGLE_KEY = 'neworder-live-data-enabled';

const StartScreen: FC = () => {
  const { initializeFromScenario } = useGameActions();
  const [selectedFaction, setSelectedFaction] = useState<FactionId | null>(null);

  // ── Live Data State ──────────────────────────────────────────
  const [liveDataEnabled, setLiveDataEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(LIVE_DATA_TOGGLE_KEY) === 'true'; } catch { return false; }
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<LiveDataProgress[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [patchSummaries, setPatchSummaries] = useState<LiveDataPatchSummary[] | null>(null);
  const [liveDataReady, setLiveDataReady] = useState(false);
  const liveDataResultRef = useRef<LiveDataResult | null>(null);

  // Persist toggle
  useEffect(() => {
    try { localStorage.setItem(LIVE_DATA_TOGGLE_KEY, String(liveDataEnabled)); } catch { /* non-critical */ }
  }, [liveDataEnabled]);

  // ── Fetch live data when enabled ─────────────────────────────
  const handleFetchLiveData = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    setFetchProgress([]);
    setPatchSummaries(null);
    setLiveDataReady(false);

    const config = createDefaultLiveDataConfig();
    config.enabled = true;

    // Check cache first
    const cached = getCachedLiveData(config.cacheHours);
    if (cached && cached.overallStatus === 'complete') {
      liveDataResultRef.current = cached;
      const { summaries } = applyLiveDataToScenario(MARCH_2026_SCENARIO, cached, config, LEADER_MODELS);
      setPatchSummaries(summaries);
      setLiveDataReady(true);
      setIsFetching(false);
      return;
    }

    try {
      const result = await fetchAllLiveData(config, (progress) => {
        setFetchProgress((prev) => {
          const idx = prev.findIndex((p) => p.category === progress.category);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = progress;
            return next;
          }
          return [...prev, progress];
        });
      }, MARCH_2026_SCENARIO);

      liveDataResultRef.current = result;
      cacheLiveData(result);

      const { summaries } = applyLiveDataToScenario(MARCH_2026_SCENARIO, result, config, LEADER_MODELS);
      setPatchSummaries(summaries);
      setLiveDataReady(true);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch live data');
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Auto-fetch when toggle is turned on
  useEffect(() => {
    if (liveDataEnabled && !liveDataReady && !isFetching) {
      handleFetchLiveData();
    }
    if (!liveDataEnabled) {
      setLiveDataReady(false);
      setPatchSummaries(null);
      liveDataResultRef.current = null;
    }
  }, [liveDataEnabled, liveDataReady, isFetching, handleFetchLiveData]);

  // ── Start game (with or without live data) ───────────────────
  const handleStart = useCallback(() => {
    if (!selectedFaction) return;

    let scenario = MARCH_2026_SCENARIO;

    if (liveDataEnabled && liveDataResultRef.current) {
      const config = createDefaultLiveDataConfig();
      config.enabled = true;
      const { scenario: patched } = applyLiveDataToScenario(
        MARCH_2026_SCENARIO,
        liveDataResultRef.current,
        config,
        LEADER_MODELS,
      );
      scenario = patched;
    }

    initializeFromScenario(scenario, selectedFaction);
  }, [selectedFaction, initializeFromScenario, liveDataEnabled]);

  // ── Memoised display scenario ────────────────────────────────
  const displayScenario = useMemo(() => {
    if (!liveDataReady || !liveDataResultRef.current) return MARCH_2026_SCENARIO;
    const config = createDefaultLiveDataConfig();
    config.enabled = true;
    return applyLiveDataToScenario(MARCH_2026_SCENARIO, liveDataResultRef.current, config, LEADER_MODELS).scenario;
  }, [liveDataReady]);

  return (
    <div style={{
      ...rootStyle,
      overflowY: 'auto',
      background: 'radial-gradient(ellipse at center, #0f1a2e 0%, #0a0a12 70%)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 900, margin: '0 auto', padding: '48px 32px' }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: 4, marginBottom: 8, color: '#e0e0e0' }}>
          ⚔️ NEW ORDER
        </h1>
        <p style={{ fontSize: 16, color: '#888', marginBottom: 40, letterSpacing: 1 }}>
          Global Simulation Engine — March 2026
        </p>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
          Choose your faction. Every decision echoes.
        </p>

        {/* ── Live Data Toggle ──────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '10px 20px',
          background: liveDataEnabled ? 'rgba(33,150,243,0.08)' : 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: liveDataEnabled ? '1px solid rgba(33,150,243,0.3)' : '1px solid #222',
          transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <span style={{ fontSize: 13, color: liveDataEnabled ? '#64b5f6' : '#888', fontWeight: 600 }}>
            Real-World Data
          </span>
          <button
            onClick={() => setLiveDataEnabled((v) => !v)}
            disabled={isFetching}
            style={{
              position: 'relative',
              width: 44,
              height: 24,
              borderRadius: 12,
              border: 'none',
              background: liveDataEnabled ? '#2196f3' : '#333',
              cursor: isFetching ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              padding: 0,
            }}
            aria-label="Toggle live data"
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: liveDataEnabled ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: 11, color: '#666', maxWidth: 200, textAlign: 'left', lineHeight: 1.3 }}>
            {liveDataEnabled
              ? 'Fetches live economic & military data from public APIs'
              : 'Use scenario defaults'}
          </span>
        </div>

        {/* ── Fetch Progress ────────────────────────────────── */}
        {liveDataEnabled && (isFetching || fetchProgress.length > 0) && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 8,
            border: '1px solid #222',
          }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, fontWeight: 600 }}>
              {isFetching ? '⏳ Fetching live data…' : '✅ Live data loaded'}
            </div>
            {fetchProgress.map((p) => (
              <div key={p.category} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#888', width: 80, textTransform: 'capitalize' }}>
                  {p.category}
                </span>
                <div style={{
                  flex: 1,
                  height: 6,
                  background: '#1a1a1a',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: p.status === 'complete' ? '100%'
                      : p.status === 'error' ? '100%'
                      : p.status === 'fetching' ? '50%' : '0%',
                    height: '100%',
                    background: p.status === 'complete' ? '#4caf50'
                      : p.status === 'error' ? '#f44336'
                      : '#2196f3',
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{
                  fontSize: 10,
                  color: p.status === 'complete' ? '#4caf50'
                    : p.status === 'error' ? '#f44336'
                    : '#2196f3',
                  width: 16,
                }}>
                  {p.status === 'complete' ? '✓' : p.status === 'error' ? '✗' : '…'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Fetch Error ───────────────────────────────────── */}
        {fetchError && (
          <div style={{
            marginBottom: 16,
            padding: '10px 16px',
            background: 'rgba(244,67,54,0.08)',
            borderRadius: 8,
            border: '1px solid rgba(244,67,54,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: '#ef9a9a' }}>⚠️ {fetchError}</span>
            <button
              onClick={handleFetchLiveData}
              style={{
                fontSize: 11,
                color: '#f44336',
                background: 'none',
                border: '1px solid #f44336',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Patch Summary ─────────────────────────────────── */}
        {patchSummaries && patchSummaries.length > 0 && !isFetching && (
          <details style={{
            marginBottom: 16,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 8,
            border: '1px solid #222',
            textAlign: 'left',
          }}>
            <summary style={{
              padding: '10px 16px',
              fontSize: 12,
              color: '#64b5f6',
              cursor: 'pointer',
              fontWeight: 600,
            }}>
              📊 Live data adjustments ({patchSummaries.length} factions updated)
            </summary>
            <div style={{ padding: '0 16px 12px' }}>
              {patchSummaries.map((ps) => (
                <div key={ps.factionId} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700, marginBottom: 2 }}>
                    {FACTION_INFO[ps.factionId]?.flag} {FACTION_INFO[ps.factionId]?.name ?? ps.factionId}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ps.changes.map((c) => {
                      const delta = c.after - c.before;
                      const isUp = delta > 0;
                      return (
                        <span
                          key={c.field}
                          style={{
                            fontSize: 10,
                            color: isUp ? '#81c784' : '#ef9a9a',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '2px 6px',
                            borderRadius: 3,
                          }}
                        >
                          {c.field}: {c.before.toFixed(4)} → {c.after.toFixed(4)} ({isUp ? '+' : ''}{delta.toFixed(4)})
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {ALL_FACTIONS.map((fid) => {
            const info = FACTION_INFO[fid];
            const ns = displayScenario.nationStates[fid];
            const baseNs = MARCH_2026_SCENARIO.nationStates[fid];
            const isSelected = selectedFaction === fid;
            const hasLiveDelta = liveDataReady && baseNs && ns !== baseNs;
            return (
              <button
                key={fid}
                onClick={() => setSelectedFaction(fid)}
                style={{
                  background: isSelected ? `${info.color}22` : '#111',
                  border: isSelected ? `2px solid ${info.color}` : '1px solid #333',
                  borderRadius: 8,
                  padding: '16px 12px',
                  cursor: 'pointer',
                  color: '#e0e0e0',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{info.flag}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: info.color, marginBottom: 4 }}>{info.name}</div>
                <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginBottom: 8 }}>{info.description}</div>
                {ns && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <MiniStat label="STB" value={ns.stability} base={hasLiveDelta ? baseNs.stability : undefined} />
                    <MiniStat label="MIL" value={ns.militaryReadiness} base={hasLiveDelta ? baseNs.militaryReadiness : undefined} />
                    <MiniStat label="DIP" value={ns.diplomaticInfluence} base={hasLiveDelta ? baseNs.diplomaticInfluence : undefined} />
                    <MiniStat label="TRS" value={ns.treasury} prefix="$" suffix="B" base={hasLiveDelta ? baseNs.treasury : undefined} />
                  </div>
                )}
                {hasLiveDelta && (
                  <div style={{ marginTop: 4, fontSize: 9, color: '#64b5f6', opacity: 0.7 }}>
                    🌐 live-adjusted
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleStart}
          disabled={!selectedFaction || (liveDataEnabled && isFetching)}
          style={{
            padding: '14px 48px',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            border: selectedFaction && !(liveDataEnabled && isFetching)
              ? '2px solid #4caf50' : '1px solid #333',
            borderRadius: 6,
            background: selectedFaction && !(liveDataEnabled && isFetching)
              ? 'rgba(76,175,80,0.1)' : '#1a1a1a',
            color: selectedFaction && !(liveDataEnabled && isFetching)
              ? '#4caf50' : '#555',
            cursor: selectedFaction && !(liveDataEnabled && isFetching)
              ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {liveDataEnabled && isFetching
            ? '⏳ Loading Live Data…'
            : liveDataEnabled && liveDataReady
              ? '🌐 Begin Simulation (Live Data)'
              : 'Begin Simulation'}
        </button>
      </div>
    </div>
  );
};

const MiniStat: FC<{ label: string; value: number; prefix?: string; suffix?: string; base?: number }> = ({ label, value, prefix, suffix, base }) => {
  const delta = base !== undefined ? value - base : 0;
  const hasDelta = base !== undefined && Math.abs(delta) >= 0.5;
  return (
    <span style={{ fontSize: 10, color: '#aaa' }}>
      <span style={{ color: '#666' }}>{label}</span>{' '}
      <span style={{ fontWeight: 600 }}>{prefix}{Math.round(value)}{suffix}</span>
      {hasDelta && (
        <span style={{ fontSize: 8, color: delta > 0 ? '#81c784' : '#ef9a9a', marginLeft: 2 }}>
          {delta > 0 ? '▲' : '▼'}
        </span>
      )}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// GAME END CONFIRMATION — Intermediate screen before results
// ═══════════════════════════════════════════════════════════════

const GameEndConfirmation: FC<{ reason: string | null; onViewResults: () => void }> = ({ reason, onViewResults }) => {
  const { resetGame } = useGameActions();
  const turn = useCurrentTurn() as number;
  const playerFaction = usePlayerFaction();
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');
  const fInfo = (FACTION_INFO as Record<string, any>)[playerFaction];

  return (
    <div style={{
      ...rootStyle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isVictory
        ? 'radial-gradient(ellipse at center, #0f2e1a 0%, #0a0a12 70%)'
        : 'radial-gradient(ellipse at center, #2e0f0f 0%, #0a0a12 70%)',
    }} data-testid="game-end-confirmation">
      <div style={{ textAlign: 'center', maxWidth: 600, padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: isVictory ? '#4caf50' : '#ef5350', marginBottom: 12 }}>
          {isVictory ? '🏆 SCENARIO COMPLETE' : '⚠️ SCENARIO ENDED'}
        </h1>
        <p style={{ fontSize: 15, color: '#ccc', marginBottom: 8, lineHeight: 1.6 }}>{reason}</p>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 32 }}>
          {fInfo?.flag} {fInfo?.name} — Turn {turn} ({simulatedDate(turn)})
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onViewResults}
            data-testid="view-results-btn"
            style={{
              padding: '14px 32px', fontSize: 14, fontWeight: 700,
              border: `2px solid ${isVictory ? '#4caf50' : '#ef5350'}`, borderRadius: 6,
              background: isVictory ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.15)',
              color: isVictory ? '#4caf50' : '#ef5350',
              cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: 1, textTransform: 'uppercase',
            }}
          >
            📊 View Results & Reports
          </button>
          <button
            onClick={resetGame}
            data-testid="new-game-from-end-btn"
            style={{
              padding: '14px 32px', fontSize: 14, fontWeight: 700,
              border: '2px solid #555', borderRadius: 6,
              background: 'transparent', color: '#888',
              cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: 1, textTransform: 'uppercase',
            }}
          >
            🔄 New Game
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════

const GameOverScreen: FC<{ reason: string | null }> = ({ reason }) => {
  const { resetGame } = useGameActions();
  const playerFaction = usePlayerFaction();
  const scenarioName = useGameStore((s) => s.scenarioMeta?.name ?? 'Unknown Scenario');
  const turn = useCurrentTurn();
  const isVictory = reason?.includes('Victory') || reason?.includes('Hegemony') || reason?.includes('Supremacy');

  // AI settings for analysis generation
  const [analysisState, setAnalysisState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [analysisText, setAnalysisText] = useState<string | null>(() => {
    try { const cached = localStorage.getItem(ANALYSIS_KEY); return cached; } catch { return null; }
  });

  // Retrieve AI settings from localStorage
  const aiSettingsRef = useRef<AISettingsState | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AI_SETTINGS_KEY);
      if (saved) aiSettingsRef.current = JSON.parse(saved);
    } catch { /* use null */ }
  }, []);

  // Auto-generate analysis on mount
  useEffect(() => {
    if (analysisText) { setAnalysisState('done'); return; }
    let cancelled = false;
    setAnalysisState('generating');
    (async () => {
      try {
        const raw = localStorage.getItem(TIMELINE_KEY);
        const timeline: TurnSnapshot[] = raw ? JSON.parse(raw) : [];
        const text = await generateScenarioAnalysis(timeline, reason, playerFaction, scenarioName, aiSettingsRef.current);
        if (cancelled) return;
        setAnalysisText(text);
        setAnalysisState('done');
        try { localStorage.setItem(ANALYSIS_KEY, text); } catch { /* non-critical */ }
      } catch {
        if (!cancelled) setAnalysisState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [reason, playerFaction, scenarioName, analysisText]);

  const handleDownloadJson = useCallback(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      const timeline: TurnSnapshot[] = raw ? JSON.parse(raw) : [];
      const payload = buildExportPayload(timeline, reason, playerFaction, scenarioName);
      downloadJson(payload, `neworder-results-turn${turn as number}.json`);
    } catch { /* non-critical */ }
  }, [reason, playerFaction, scenarioName, turn]);

  const handleDownloadCsv = useCallback(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      const timeline: TurnSnapshot[] = raw ? JSON.parse(raw) : [];
      downloadCsv(timeline, `neworder-results-turn${turn as number}.csv`);
    } catch { /* non-critical */ }
  }, [turn]);

  const handleDownloadMarkdown = useCallback(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      const timeline: TurnSnapshot[] = raw ? JSON.parse(raw) : [];
      const md = buildMarkdownReport(timeline, reason, playerFaction, scenarioName, analysisText);
      downloadBlob(md, `neworder-report-turn${turn as number}.md`, 'text/markdown');
    } catch { /* non-critical */ }
  }, [reason, playerFaction, scenarioName, turn, analysisText]);

  const handleDownloadHtml = useCallback(() => {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      const timeline: TurnSnapshot[] = raw ? JSON.parse(raw) : [];
      const html = buildHtmlReport(timeline, reason, playerFaction, scenarioName, analysisText);
      downloadBlob(html, `neworder-report-turn${turn as number}.html`, 'text/html');
    } catch { /* non-critical */ }
  }, [reason, playerFaction, scenarioName, turn, analysisText]);

  return (
    <div style={{
      ...rootStyle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isVictory
        ? 'radial-gradient(ellipse at center, #0f2e1a 0%, #0a0a12 70%)'
        : 'radial-gradient(ellipse at center, #2e0f0f 0%, #0a0a12 70%)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 700, padding: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: isVictory ? '#4caf50' : '#ef5350', marginBottom: 16 }}>
          {isVictory ? '🏆 VICTORY' : '💀 GAME OVER'}
        </h1>
        <p style={{ fontSize: 16, color: '#ccc', marginBottom: 24, lineHeight: 1.6 }}>{reason}</p>

        {/* Analysis Status */}
        <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
          {analysisState === 'generating' && (
            <span style={{ color: '#ffb300' }}>🔄 Generating strategic analysis{aiSettingsRef.current?.enabled ? ' via AI...' : ' via internal engine...'}</span>
          )}
          {analysisState === 'done' && (
            <span style={{ color: '#4caf50' }}>✅ Strategic analysis ready{aiSettingsRef.current?.enabled ? ' (AI-powered)' : ' (internal engine)'}</span>
          )}
          {analysisState === 'error' && (
            <span style={{ color: '#ef5350' }}>⚠️ Analysis generation failed — reports will include basic data only</span>
          )}
        </div>

        {/* Download Results */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadHtml}
            style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 600,
              border: '1px solid #e91e63', borderRadius: 6,
              background: 'rgba(233,30,99,0.1)', color: '#e91e63',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📊 Interactive Report (HTML)
          </button>
          <button
            onClick={handleDownloadMarkdown}
            style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 600,
              border: '1px solid #9c27b0', borderRadius: 6,
              background: 'rgba(156,39,176,0.1)', color: '#9c27b0',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📝 Summary Report (Markdown)
          </button>
        </div>
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadJson}
            style={{
              padding: '8px 20px', fontSize: 12, fontWeight: 600,
              border: '1px solid #4caf50', borderRadius: 6,
              background: 'rgba(76,175,80,0.08)', color: '#4caf50',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📥 Raw Data (JSON)
          </button>
          <button
            onClick={handleDownloadCsv}
            style={{
              padding: '8px 20px', fontSize: 12, fontWeight: 600,
              border: '1px solid #2196f3', borderRadius: 6,
              background: 'rgba(33,150,243,0.08)', color: '#2196f3',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📋 Spreadsheet (CSV)
          </button>
        </div>

        <button
          onClick={resetGame}
          style={{
            padding: '12px 36px',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            border: '2px solid #888',
            borderRadius: 6,
            background: 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          New Game
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE HELPERS — build browsable entries from game state
// ═══════════════════════════════════════════════════════════════

function buildModuleSummaries(nationStates: Record<string, any>, playerFaction: string): ModuleSummary[] {
  const modules: ModuleSummary[] = [];

  // Nation states as editable modules
  for (const [fid, ns] of Object.entries(nationStates)) {
    if (!ns) continue;
    modules.push({
      id: fid,
      name: ns.nationName ?? fid,
      moduleType: 'leaders',
      description: `Leader profile for ${ns.nationName ?? fid}`,
      tags: [fid === playerFaction ? 'player' : 'ai'],
    });
    modules.push({
      id: `${fid}-economy`,
      name: `${ns.nationName ?? fid} — Economy`,
      moduleType: 'scenarios',
      description: `GDP: $${ns.gdp}B | Inflation: ${ns.inflation?.toFixed(4)}%`,
      tags: ['economy'],
    });
    modules.push({
      id: `${fid}-military`,
      name: `${ns.nationName ?? fid} — Military`,
      moduleType: 'military',
      description: `Readiness: ${ns.militaryReadiness}%`,
      tags: ['military'],
    });
  }

  // Ticker market modules — from live state or from static models
  const marketState = (useGameStore.getState() as any).marketState;
  if (marketState?.tickerStates) {
    for (const [tickerId, ticker] of Object.entries(marketState.tickerStates as Record<string, any>)) {
      modules.push({
        id: tickerId,
        name: tickerId,
        moduleType: 'markets',
        subcategory: 'tickers',
        description: `Price: ${ticker.currentPrice?.toFixed(2) ?? '—'} | Sector: ${ticker.sectorName ?? '—'}`,
        tags: ['ticker', ticker.exchangeId ?? ''],
      });
    }
  } else {
    // Fall back to static ticker models when market state hasn't been initialised
    for (const tickerSet of TICKER_SET_MODELS) {
      for (const ticker of tickerSet.tickers) {
        modules.push({
          id: ticker.tickerId,
          name: ticker.tickerId,
          moduleType: 'markets',
          subcategory: 'tickers',
          description: `Initial: $${ticker.initialPrice} | Sector: ${ticker.sectorName}`,
          tags: ['ticker', tickerSet.exchangeId],
        });
      }
    }
  }
  // Exchange summaries
  for (const exchange of EXCHANGE_MODELS) {
    modules.push({
      id: exchange.exchangeId,
      name: exchange.exchangeName,
      moduleType: 'markets',
      subcategory: 'exchanges',
      description: `${exchange.currencyCode} | Cap: $${exchange.marketCapBillions ?? '—'}B`,
      tags: ['exchange', exchange.nationId],
    });
  }

  // ── Political Systems (from JSON models) ─────────────────────────
  for (const ps of POLITICAL_SYSTEM_MODELS) {
    const id = (ps['systemId'] ?? ps['systemName'] ?? 'unknown') as string;
    modules.push({
      id,
      name: (ps['systemName'] ?? id) as string,
      moduleType: 'political-systems',
      description: ((ps['description'] ?? '') as string).slice(0, 100),
      tags: (ps['tags'] as string[] | undefined) ?? ['political'],
    });
  }

  // ── Technology (from JSON models) ────────────────────────────────
  for (const tech of TECHNOLOGY_MODELS) {
    const id = (tech['techId'] ?? 'unknown') as string;
    modules.push({
      id,
      name: (tech['name'] ?? id) as string,
      moduleType: 'technology',
      subcategory: (tech['domain'] as string | undefined) ?? undefined,
      description: `Tier ${tech['tier'] ?? '?'} — ${((tech['description'] ?? '') as string).slice(0, 80)}`,
      tags: (tech['tags'] as string[] | undefined) ?? ['tech'],
    });
  }

  // ── Education (from JSON models) ─────────────────────────────────
  for (const edu of EDUCATION_MODELS) {
    const id = (edu['educationId'] ?? 'unknown') as string;
    modules.push({
      id,
      name: (edu['name'] ?? id) as string,
      moduleType: 'education',
      subcategory: (edu['category'] as string | undefined) ?? undefined,
      description: ((edu['description'] ?? '') as string).slice(0, 100),
      tags: (edu['tags'] as string[] | undefined) ?? ['education'],
    });
  }

  // ── Population (from JSON models) ────────────────────────────────
  for (const pop of POPULATION_MODELS) {
    const id = (pop['nationId'] ?? 'unknown') as string;
    const popM = pop['populationMillions'] as number | undefined;
    modules.push({
      id,
      name: `${id.toUpperCase()} Population`,
      moduleType: 'population',
      description: popM ? `${popM}M — Growth: ${pop['growthRatePercent'] ?? '?'}%` : id,
      tags: (pop['tags'] as string[] | undefined) ?? ['demographics'],
    });
  }

  // ── Religion (from JSON models) ──────────────────────────────────
  for (const rel of RELIGION_MODELS) {
    const id = (rel['religionId'] ?? 'unknown') as string;
    modules.push({
      id,
      name: (rel['name'] ?? id) as string,
      moduleType: 'religion',
      description: ((rel['description'] ?? '') as string).slice(0, 100),
      tags: (rel['tags'] as string[] | undefined) ?? ['religion'],
    });
  }

  return modules;
}

function getModuleData(
  nationStates: Record<string, any>,
  playerFaction: string,
  moduleType: string,
  id: string,
): Record<string, unknown> | null {
  if (moduleType === 'leaders') {
    const ns = nationStates[id];
    if (!ns) return null;
    return {
      nationName: ns.nationName ?? id,
      leaderName: ns.leaderName ?? '',
      stability: ns.stability ?? 0,
      popularity: ns.popularity ?? 0,
      diplomaticInfluence: ns.diplomaticInfluence ?? 0,
      nuclearThreshold: ns.nuclearThreshold ?? 0,
    };
  }
  if (moduleType === 'scenarios') {
    const fid = id.replace('-economy', '');
    const ns = nationStates[fid];
    if (!ns) return null;
    return {
      nationName: ns.nationName ?? fid,
      gdp: ns.gdp ?? 0,
      inflation: ns.inflation ?? 0,
      treasury: ns.treasury ?? 0,
      tradeOpenness: ns.tradeOpenness ?? 0,
    };
  }
  if (moduleType === 'military') {
    const fid = id.replace('-military', '');
    const ns = nationStates[fid];
    if (!ns) return null;
    return {
      nationName: ns.nationName ?? fid,
      militaryReadiness: ns.militaryReadiness ?? 0,
      militaryBudget: ns.militaryBudget ?? 0,
    };
  }
  if (moduleType === 'markets') {
    // Try live ticker state first
    const marketState = (useGameStore.getState() as any).marketState;
    const ticker = marketState?.tickerStates?.[id];
    if (ticker) {
      return {
        tickerId: id,
        sectorName: ticker.sectorName ?? 'defense',
        initialPrice: ticker.initialPrice ?? 100,
        currentPrice: ticker.currentPrice ?? 100,
        volatilityMultiplier: ticker.volatilityMultiplier ?? 1.0,
        eventSensitivityWeights: ticker.eventSensitivityWeights ?? {},
        exchangeId: ticker.exchangeId ?? '',
      };
    }
    // Fall back to static exchange model
    const exchange = EXCHANGE_MODELS.find((e) => e.exchangeId === id);
    if (exchange) return { ...exchange } as Record<string, unknown>;
    // Fall back to static ticker model
    for (const set of TICKER_SET_MODELS) {
      const t = set.tickers.find((tk) => tk.tickerId === id);
      if (t) return { ...t, exchangeId: set.exchangeId, nationId: set.nationId } as Record<string, unknown>;
    }
    return null;
  }
  if (moduleType === 'political-systems') {
    const ps = POLITICAL_SYSTEM_MODELS.find((m) => (m['systemId'] ?? m['systemName']) === id);
    return ps ? { ...ps } : null;
  }
  if (moduleType === 'technology') {
    const tech = TECHNOLOGY_MODELS.find((m) => m['techId'] === id);
    return tech ? { ...tech } : null;
  }
  if (moduleType === 'education') {
    const edu = EDUCATION_MODELS.find((m) => m['educationId'] === id);
    return edu ? { ...edu } : null;
  }
  if (moduleType === 'population') {
    const pop = POPULATION_MODELS.find((m) => m['nationId'] === id);
    return pop ? { ...pop } : null;
  }
  if (moduleType === 'religion') {
    const rel = RELIGION_MODELS.find((m) => m['religionId'] === id);
    return rel ? { ...rel } : null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// DATA ADAPTERS — Bridge store types to dashboard components
// ═══════════════════════════════════════════════════════════════

const FACTION_POPULATIONS: Record<string, number> = {
  us: 340_000_000, china: 1_400_000_000, russia: 144_000_000, japan: 124_000_000,
  iran: 88_000_000, dprk: 26_000_000, eu: 450_000_000, syria: 22_000_000,
};

function buildMilitaryData(milStruct: MilitaryForceStructure | undefined, gdp: number) {
  if (!milStruct) return { inventory: [] as any[], budget: { totalBudget: 0, maintenanceCost: 0, procurementSpending: 0, available: 0 } };
  const items = [
    { equipmentId: 'ground-forces', name: `Ground Forces (${milStruct.activeForces}K)`, category: 'ground',
      quantity: milStruct.activeForces, deployed: Math.round(milStruct.activeForces * 0.6),
      inTransit: Math.round(milStruct.activeForces * 0.05), readinessPercent: milStruct.readiness,
      maintenanceCostPerTurn: +((milStruct.activeForces) * 0.003).toFixed(1) },
    { equipmentId: 'naval-fleet', name: 'Naval Fleet', category: 'naval',
      quantity: Math.round(milStruct.navalPower * 3), deployed: Math.round(milStruct.navalPower * 1.8),
      inTransit: Math.round(milStruct.navalPower * 0.2), readinessPercent: Math.min(100, milStruct.readiness + 2),
      maintenanceCostPerTurn: +(milStruct.navalPower * 0.08).toFixed(1) },
    { equipmentId: 'air-wing', name: 'Air Wing', category: 'air',
      quantity: Math.round(milStruct.airPower * 5), deployed: Math.round(milStruct.airPower * 3),
      inTransit: Math.round(milStruct.airPower * 0.3), readinessPercent: Math.max(0, milStruct.readiness - 2),
      maintenanceCostPerTurn: +(milStruct.airPower * 0.065).toFixed(1) },
  ];
  if (milStruct.nuclearArsenal > 0) {
    items.push({ equipmentId: 'nuclear-arsenal', name: 'Nuclear Arsenal', category: 'strategic',
      quantity: milStruct.nuclearArsenal, deployed: Math.round(milStruct.nuclearArsenal * 0.3),
      inTransit: 0, readinessPercent: milStruct.readiness,
      maintenanceCostPerTurn: +(milStruct.nuclearArsenal * 0.005).toFixed(1) });
  }
  for (let i = 0; i < milStruct.specialCapability.length; i++) {
    items.push({ equipmentId: `special-${i}`, name: milStruct.specialCapability[i],
      category: 'special', quantity: 1, deployed: 1, inTransit: 0,
      readinessPercent: milStruct.readiness, maintenanceCostPerTurn: 0.5 });
  }
  const maintenanceCost = items.reduce((sum, e) => sum + e.maintenanceCostPerTurn, 0);
  const totalBudget = Math.round(gdp * 0.035);
  return {
    inventory: items,
    budget: { totalBudget, maintenanceCost: +maintenanceCost.toFixed(1), procurementSpending: 0, available: +(totalBudget - maintenanceCost).toFixed(1) },
  };
}

function buildEducationData(
  techIdx: TechnologyIndex | undefined,
  ns: any,
  allNations: Record<string, any>,
  allTechIdx: Record<string, TechnologyIndex>,
) {
  const avgTech = techIdx
    ? Math.round((techIdx.ai + techIdx.semiconductors + techIdx.space + techIdx.cyber + techIdx.biotech + techIdx.quantum) / 6)
    : (ns?.techLevel ?? 50);
  const sectors = [
    { sectorId: 'primary', name: 'Primary Education', currentBudget: Math.round(avgTech * 0.08), maxBudget: 20, qualityIndex: Math.min(100, avgTech + 10), enrollmentRate: Math.min(100, 60 + avgTech * 0.35), impactDelay: 3 },
    { sectorId: 'secondary', name: 'Secondary Education', currentBudget: Math.round(avgTech * 0.06), maxBudget: 15, qualityIndex: avgTech, enrollmentRate: Math.min(100, 40 + avgTech * 0.4), impactDelay: 4 },
    { sectorId: 'higher', name: 'Higher Education', currentBudget: Math.round(avgTech * 0.07), maxBudget: 25, qualityIndex: Math.max(0, avgTech - 5), enrollmentRate: Math.min(100, 15 + avgTech * 0.3), impactDelay: 6 },
    { sectorId: 'stem', name: 'STEM Programs', currentBudget: Math.round(avgTech * 0.05), maxBudget: 15, qualityIndex: techIdx ? Math.round((techIdx.ai + techIdx.quantum + techIdx.semiconductors) / 3) : avgTech, enrollmentRate: Math.min(100, 10 + avgTech * 0.25), impactDelay: 5 },
  ];
  const totalBudget = sectors.reduce((s, sec) => s + sec.currentBudget, 0);
  const stemIdx = techIdx ? Math.round((techIdx.ai + techIdx.quantum + techIdx.semiconductors) / 3) : avgTech;
  const metrics = {
    literacyRate: Math.min(100, 50 + avgTech * 0.45),
    averageQuality: avgTech,
    stemIndex: stemIdx,
    brainDrainRate: Math.max(0, Math.min(100, 80 - avgTech)),
    totalBudget,
    gdpPercent: ns?.gdp ? +((totalBudget / ns.gdp) * 100).toFixed(4) : 3.5,
  };
  const nationComparison = Object.entries(allNations).map(([fid, nation]: [string, any]) => {
    const t = allTechIdx?.[fid];
    const at = t ? Math.round((t.ai + t.semiconductors + t.space + t.cyber + t.biotech + t.quantum) / 6) : (nation?.techLevel ?? 0);
    return { nationId: fid, nationName: nation?.nationName ?? fid, literacyRate: Math.min(100, 50 + at * 0.45), qualityIndex: at, stemIndex: t ? Math.round((t.ai + t.quantum + t.semiconductors) / 3) : at };
  });
  const recommendations: Array<{ id: string; text: string; priority: 'high' | 'medium' | 'low' }> = [];
  if (metrics.brainDrainRate > 50) recommendations.push({ id: 'brain-drain', text: 'Brain drain is critical. Increase STEM funding and research incentives.', priority: 'high' });
  if (stemIdx < 40) recommendations.push({ id: 'stem-low', text: 'STEM capabilities are falling behind. Invest in AI and quantum programs.', priority: 'high' });
  if (metrics.literacyRate < 70) recommendations.push({ id: 'literacy', text: 'Literacy rates need improvement. Expand primary education access.', priority: 'medium' });
  if (recommendations.length === 0) recommendations.push({ id: 'maintain', text: 'Education metrics are strong. Maintain current investment levels.', priority: 'low' });
  return { sectors, metrics, nationComparison, recommendations, projectedEffects: [] as Array<{ turn: number; literacyRate: number; qualityIndex: number }> };
}

function buildDemographicsData(
  factionId: string,
  ns: any,
  faultLines: any,
  massPsych: any,
  civilUnrest: any,
) {
  const pop = FACTION_POPULATIONS[factionId] ?? 50_000_000;
  const metrics = {
    totalPopulation: pop,
    urbanPercent: factionId === 'japan' ? 92 : factionId === 'us' ? 83 : factionId === 'eu' ? 75 : factionId === 'china' ? 65 : factionId === 'iran' ? 76 : factionId === 'russia' ? 75 : factionId === 'dprk' ? 63 : 56,
    ruralPercent: 0,
    medianAge: factionId === 'japan' ? 49 : factionId === 'eu' ? 44 : factionId === 'us' ? 38 : factionId === 'china' ? 39 : factionId === 'iran' ? 32 : factionId === 'russia' ? 40 : factionId === 'dprk' ? 35 : 24,
    growthRate: factionId === 'japan' ? -0.3 : factionId === 'eu' ? 0.1 : factionId === 'us' ? 0.5 : factionId === 'china' ? -0.1 : factionId === 'iran' ? 0.9 : factionId === 'syria' ? 2.0 : 0.4,
    fertilityRate: factionId === 'japan' ? 1.2 : factionId === 'eu' ? 1.5 : factionId === 'us' ? 1.7 : factionId === 'iran' ? 1.7 : factionId === 'syria' ? 2.8 : 1.6,
    lifeExpectancy: factionId === 'japan' ? 85 : factionId === 'eu' ? 81 : factionId === 'us' ? 79 : factionId === 'china' ? 78 : factionId === 'iran' ? 77 : factionId === 'dprk' ? 72 : factionId === 'syria' ? 73 : factionId === 'russia' ? 73 : 75,
  };
  metrics.ruralPercent = 100 - metrics.urbanPercent;
  const agePyramid = [
    { label: '0-14', malePercent: factionId === 'syria' ? 20 : 8, femalePercent: factionId === 'syria' ? 19 : 7.5 },
    { label: '15-24', malePercent: 7, femalePercent: 6.5 },
    { label: '25-54', malePercent: 20, femalePercent: 19 },
    { label: '55-64', malePercent: 7, femalePercent: 7.5 },
    { label: '65+', malePercent: factionId === 'japan' ? 14 : 6, femalePercent: factionId === 'japan' ? 16 : 7 },
  ];
  const religions: Array<{ religionId: string; name: string; percent: number; radicalizationRisk: number; trend: 'growing' | 'stable' | 'declining' }> = [];
  const fl = faultLines?.faultLines ?? [];
  for (const line of fl) {
    religions.push({
      religionId: line.groupName.toLowerCase().replace(/\s+/g, '-'),
      name: line.groupName,
      percent: Math.round(line.tensionBase * 0.3),
      radicalizationRisk: Math.round(line.tensionBase * 0.8 + (line.foreignSponsorVulnerability ?? 0) * 0.2),
      trend: line.tensionBase > 50 ? 'growing' : line.tensionBase > 30 ? 'stable' : 'declining',
    });
  }
  if (religions.length === 0) {
    religions.push({ religionId: 'majority', name: 'Majority Population', percent: 85, radicalizationRisk: 5, trend: 'stable' });
  }
  const regions = [{ regionId: 'capital', name: 'Capital Region', population: Math.round(pop * 0.2), urbanPercent: 95, dominantReligion: religions[0]?.name ?? 'Unknown', growthRate: metrics.growthRate + 0.3 }];
  const forecasts = Array.from({ length: 5 }, (_, i) => ({
    turn: i + 1, totalPopulation: Math.round(pop * (1 + metrics.growthRate / 100) ** (i + 1)),
    urbanPercent: Math.min(98, metrics.urbanPercent + i * 0.3), medianAge: +(metrics.medianAge + i * 0.15).toFixed(1),
  }));
  return { metrics, agePyramid, migrationFlows: [] as Array<{ fromNation: string; toNation: string; volume: number; reason: string }>, religions, regions, forecasts, nationName: ns?.nationName ?? factionId };
}

const POLITICAL_PRESETS: PoliticalSystemPreset[] = [
  { systemId: 'liberal-democracy', systemName: 'Liberal Democracy', description: 'Free elections, separation of powers, strong civil liberties',
    modifiers: { decisionSpeedModifier: -10, stabilityBaseline: 15, civilLibertyIndex: 85, pressFreedomIndex: 80, corruptionBaseline: 25, successionRisk: 10, reformCapacity: 75 },
    gameplayModifiers: { stabilityRecoveryRate: 1.2, crisisResistance: 0.9, controversialActionDelay: 2, propagandaEffectiveness: 0.6, civilUnrestThreshold: 0.4 } },
  { systemId: 'authoritarian', systemName: 'Authoritarian Regime', description: 'Centralized power, restricted liberties, rapid decision-making',
    modifiers: { decisionSpeedModifier: 30, stabilityBaseline: 10, civilLibertyIndex: 20, pressFreedomIndex: 15, corruptionBaseline: 65, successionRisk: 60, reformCapacity: 25 },
    gameplayModifiers: { stabilityRecoveryRate: 0.8, crisisResistance: 1.3, controversialActionDelay: 0, propagandaEffectiveness: 1.6, civilUnrestThreshold: 0.7 } },
  { systemId: 'one-party', systemName: 'One-Party State', description: 'Single ruling party with technocratic governance',
    modifiers: { decisionSpeedModifier: 20, stabilityBaseline: 12, civilLibertyIndex: 30, pressFreedomIndex: 20, corruptionBaseline: 55, successionRisk: 45, reformCapacity: 40 },
    gameplayModifiers: { stabilityRecoveryRate: 1.0, crisisResistance: 1.2, controversialActionDelay: 1, propagandaEffectiveness: 1.4, civilUnrestThreshold: 0.6 } },
  { systemId: 'theocracy', systemName: 'Theocratic Republic', description: 'Religious authority guides policy, limited democratic elements',
    modifiers: { decisionSpeedModifier: 5, stabilityBaseline: 8, civilLibertyIndex: 25, pressFreedomIndex: 20, corruptionBaseline: 50, successionRisk: 55, reformCapacity: 20 },
    gameplayModifiers: { stabilityRecoveryRate: 0.9, crisisResistance: 1.1, controversialActionDelay: 1, propagandaEffectiveness: 1.3, civilUnrestThreshold: 0.8 } },
  { systemId: 'military-junta', systemName: 'Military Junta', description: 'Military-controlled governance with martial law tendencies',
    modifiers: { decisionSpeedModifier: 40, stabilityBaseline: 5, civilLibertyIndex: 10, pressFreedomIndex: 10, corruptionBaseline: 70, successionRisk: 70, reformCapacity: 15 },
    gameplayModifiers: { stabilityRecoveryRate: 0.7, crisisResistance: 1.5, controversialActionDelay: 0, propagandaEffectiveness: 1.8, civilUnrestThreshold: 0.9 } },
];

// ═══════════════════════════════════════════════════════════════
// MAIN GAME SCREEN
// ═══════════════════════════════════════════════════════════════

const GameScreen: FC = () => {
  const store = useGameStore();
  const turn = useCurrentTurn();
  const playerFaction = usePlayerFaction();
  const { advanceTurn, setGameOver, resetGame, addPolicy, removePolicy } = useGameActions();
  const nationStates = useGameStore((s) => s.nationStates);
  const relations = useGameStore((s) => s.relationshipMatrix);
  const playerNation = nationStates[playerFaction];
  const militaryStructure = useGameStore((s) => s.militaryForceStructures?.[playerFaction]);
  const technologyIdx = useGameStore((s) => s.technologyIndices?.[playerFaction]);
  const allTechIndices = useGameStore((s) => s.technologyIndices) as Record<string, TechnologyIndex>;
  const massPsych = useGameStore((s) => s.massPsychology?.[playerFaction]);
  const faultLines = useGameStore((s) => s.nationFaultLines?.[playerFaction]);
  const civilUnrest = useGameStore((s) => s.civilUnrestComponents?.[playerFaction]);
  const innovationState = useGameStore((s) => s.innovationState);
  const nationalPolicies = useGameStore((s) => s.nationalPolicies);
  const civilWarStates = useGameStore((s) => s.civilWarStates);

  type PanelId = 'map' | 'diplomacy' | 'dashboard' | 'markets' | 'forex' | 'indexes' | 'tech' | 'innovation' | 'policy' | 'civilwar' | 'scenario' | 'editor' | 'military' | 'automation' | 'settings' | 'education' | 'demographics' | 'politics' | 'timeline';
  const [activePanel, setActivePanel] = useState<PanelId>('map');
  const [headlines, setHeadlines] = useState<TurnHeadline[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [turnProcessing, setTurnProcessing] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState<GameAction | null>(null);
  const [showStimulusSlider, setShowStimulusSlider] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // ── Module Editor state ──
  const [editingModule, setEditingModule] = useState<{ type: string; id: string; data: Record<string, unknown> } | null>(null);

  // ── AI Settings state (persisted to localStorage) ──
  const [aiSettings, setAiSettingsRaw] = useState<AISettingsState>(() => {
    try {
      const saved = localStorage.getItem(AI_SETTINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* use defaults */ }
    return { enabled: false, provider: 'openai' as any, apiKey: '', model: 'gpt-4o', temperature: 0.7, maxTokens: 2048 };
  });
  const setAiSettings = useCallback((s: AISettingsState) => {
    setAiSettingsRaw(s);
    try { localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(s)); } catch { /* non-critical */ }
  }, []);

  // ── Game timeline tracking ──
  const timelineRef = useRef<TurnSnapshot[]>([]);

  // Reset timeline on new game (turn resets to 1)
  useEffect(() => {
    if (turn === 1) {
      timelineRef.current = [];
      try { localStorage.removeItem(TIMELINE_KEY); } catch { /* non-critical */ }
      try { localStorage.removeItem(ANALYSIS_KEY); } catch { /* non-critical */ }
    }
  }, [turn]);

  // ── Map action popover state ──
  const [mapActionTarget, setMapActionTarget] = useState<FactionId | null>(null);

  // ── AI Test Connection handler ──
  const handleTestConnection = useCallback(
    async (provider: AIProvider, apiKey: string, model: string): Promise<ConnectionTestResult> => {
      try {
        const adapter = createAdapter({ provider, apiKey, model });
        return await adapter.testConnection();
      } catch (err: any) {
        return { ok: false, message: err?.message ?? 'Connection failed', latencyMs: 0 };
      }
    },
    [],
  );

  // ── Run Scenario handler ──
  const handleRunScenario = useCallback(
    (config: RunConfig) => {
      setTurnProcessing(true);
      const turnsToRun = Math.min(config.maxTurns, 60);
      let turnsCompleted = 0;

      // ── Deep AI Strategy engine (when selected) ──
      let deepEngine: DeepAIStrategyEngine | null = null;
      let lastDeepAnalysis: DeepRoundAnalysis | null = null;
      if (config.aiStrategy === 'deep-ai') {
        const aiRaw = localStorage.getItem(AI_SETTINGS_KEY);
        const aiSettings: AISettingsState | null = aiRaw ? JSON.parse(aiRaw) : null;
        // Ollama requires no API key; other providers do
        const hasValidProvider = aiSettings?.enabled &&
          (aiSettings.provider === 'ollama' || !!aiSettings.apiKey);
        deepEngine = new DeepAIStrategyEngine({
          difficulty: config.difficulty,
          aiProvider: hasValidProvider ? {
            provider: aiSettings!.provider,
            apiKey: aiSettings!.apiKey || '',
            model: aiSettings!.model,
            baseUrl: aiSettings!.baseUrl,
          } : null,
          temperature: aiSettings?.temperature ?? 0.6,
          maxTokens: aiSettings?.maxTokens ?? 800,
          aiBriefingInterval: 3,
        });
      }

      // ── Autonomous player for player-faction decisions (all strategies) ──
      const autoPlayer = new AutonomousPlayer({
        strategy: config.aiStrategy === 'deep-ai' ? 'rule-based' : config.aiStrategy === 'passive' ? 'passive' : config.aiStrategy === 'random' ? 'random' : 'rule-based',
        difficulty: config.difficulty,
      });

      const runNextTurn = async () => {
        const state = useGameStore.getState();
        if (state.gameOver || turnsCompleted >= turnsToRun) {
          setTurnProcessing(false);
          return;
        }

        const turnNum = (state.currentTurn as number) + 1;
        const result = processTurn(state);

        // Use nation states & relations produced by processTurn (includes all AI actions,
        // feedback loops, policy effects, civil war progression, and natural drift)
        const ns = result.nationStates;
        const rel = result.relationshipMatrix;

        const storeUpdate: Record<string, unknown> = { nationStates: ns, relationshipMatrix: rel };
        if (result.marketState) storeUpdate.marketState = result.marketState;
        if (result.innovationState) storeUpdate.innovationState = result.innovationState;
        if (result.nationalPolicies) storeUpdate.nationalPolicies = result.nationalPolicies;
        if (result.civilWarStates) storeUpdate.civilWarStates = result.civilWarStates;
        if (result.multiVectorSummary) storeUpdate.multiVectorSummary = result.multiVectorSummary;
        if (result.currencyState) storeUpdate.currencyState = result.currencyState;
        if (result.emergentTechState) storeUpdate.emergentTechState = result.emergentTechState;
        useGameStore.setState(storeUpdate);

        setHeadlines(result.headlines);
        setActionLog((prev) => [...prev, `── Auto Turn ${turnNum} ──`, ...result.aiActions]);

        // ── Generate player AI decisions ──
        let playerDecisionLabels: string[];
        let deepAnalysisText: string | null = null;

        if (deepEngine) {
          // Deep AI Strategy: multi-stage analysis with player decisions
          try {
            const updState = useGameStore.getState();
            const deepResult = await deepEngine.analyzeRound(
              updState, turnNum,
              result.marketState ?? updState.marketState,
              updState.technologyIndices ?? null,
              lastDeepAnalysis,
            );
            lastDeepAnalysis = deepResult;
            playerDecisionLabels = deepResult.decisionLabels;
            deepAnalysisText = deepResult.briefing;
          } catch (err) {
            // Fallback to basic autonomous player
            console.warn(`[DeepAI] analyzeRound failed on turn ${turnNum}:`, err);
            const decision = autoPlayer.decideFaction(state, state.playerFaction, turnNum);
            playerDecisionLabels = decision.selectedActions.length > 0
              ? decision.selectedActions.map((a) => `${a.name}${a.targetFaction ? ` → ${a.targetFaction}` : ''}`)
              : [`Turn ${turnNum} — no decisive action taken`];
          }
        } else {
          // Standard strategies: generate player decisions via AutonomousPlayer
          const decision = autoPlayer.decideFaction(state, state.playerFaction, turnNum);
          playerDecisionLabels = decision.selectedActions.length > 0
            ? decision.selectedActions.map((a) => `${a.name}${a.targetFaction ? ` → ${a.targetFaction}` : ''}`)
            : [`Turn ${turnNum} — no decisive action taken`];
        }

        // Record timeline snapshot with market + tech detail + player decisions
        const updatedState = useGameStore.getState();
        const prevSnap = timelineRef.current.length > 0 ? timelineRef.current[timelineRef.current.length - 1] : null;
        const snap = captureTurnSnapshot(
          turnNum, ns,
          result.headlines.map((h) => h.text), result.aiActions,
          result.marketState ?? updatedState.marketState,
          {
            decisions: playerDecisionLabels,
            stateChanges: result.stateChanges,
            technologyIndices: updatedState.technologyIndices,
            techModuleRegistry: updatedState.techModuleRegistry,
            prevTechDiscoveryCount: timelineRef.current.reduce((n, s) => n + s.techDiscoveries.length, 0),
            relationshipMatrix: rel as Record<string, Record<string, number>>,
            prevSnapshot: prevSnap,
            deepAnalysis: deepAnalysisText,
          },
        );
        timelineRef.current = [...timelineRef.current, snap];
        try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(timelineRef.current)); } catch { /* non-critical */ }

        if (result.gameOver && result.gameOverReason) {
          setGameOver(result.gameOverReason);
          setTurnProcessing(false);
          return;
        }

        advanceTurn();
        turnsCompleted++;

        // Yield to the browser between turns so the UI stays responsive
        if (config.speed === 'instant') {
          setTimeout(runNextTurn, 0);
        } else {
          setTimeout(runNextTurn, config.speed === 'accelerated' ? 200 : 1000);
        }
      };

      // Kick off
      setTimeout(runNextTurn, 100);
    },
    [advanceTurn, setGameOver],
  );

  // Track pending actions with undo support
  interface PendingAction {
    label: string;
    cost: number;
    snapshotNS: any;
    snapshotRel: any;
  }
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [turnSpent, setTurnSpent] = useState(0);

  const handleAction = useCallback((action: GameAction) => {
    // Special: economic stimulus opens slider
    if (action.type === 'economic_stimulus') {
      setShowStimulusSlider(true);
      return;
    }
    if (action.targetRequired) {
      setShowTargetPicker(action);
      return;
    }
    // Save snapshot before executing
    const snapNS = structuredClone(useGameStore.getState().nationStates);
    const snapRel = structuredClone(useGameStore.getState().relationshipMatrix);
    const currentState = useGameStore.getState();
    const result = executeAction(action, null, currentState);
    useGameStore.setState({
      nationStates: result.nationStates,
      relationshipMatrix: result.relations,
    });
    setActionLog((prev) => [...prev, result.result.headline]);
    setPendingActions((prev) => [...prev, { label: action.label, cost: action.cost, snapshotNS: snapNS, snapshotRel: snapRel }]);
    setTurnSpent((prev) => prev + action.cost);
    setShowTargetPicker(null);
  }, []);

  const handleTargetedAction = useCallback((action: GameAction, target: FactionId) => {
    const snapNS = structuredClone(useGameStore.getState().nationStates);
    const snapRel = structuredClone(useGameStore.getState().relationshipMatrix);
    const currentState = useGameStore.getState();
    const result = executeAction(action, target, currentState);
    useGameStore.setState({
      nationStates: result.nationStates,
      relationshipMatrix: result.relations,
    });
    setActionLog((prev) => [...prev, result.result.headline]);
    setPendingActions((prev) => [...prev, { label: `${action.label} → ${FACTION_INFO[target]?.name}`, cost: action.cost, snapshotNS: snapNS, snapshotRel: snapRel }]);
    setTurnSpent((prev) => prev + action.cost);
    setShowTargetPicker(null);
  }, []);

  const handleStimulusConfirm = useCallback((amount: number) => {
    const snapNS = structuredClone(useGameStore.getState().nationStates);
    const snapRel = structuredClone(useGameStore.getState().relationshipMatrix);
    const currentState = useGameStore.getState();
    // Create a custom action with the slider amount as cost
    const stimAction: GameAction = { ...AVAILABLE_ACTIONS.find((a) => a.type === 'economic_stimulus')!, cost: amount };
    const result = executeAction(stimAction, null, currentState);
    useGameStore.setState({
      nationStates: result.nationStates,
      relationshipMatrix: result.relations,
    });
    setActionLog((prev) => [...prev, result.result.headline]);
    setPendingActions((prev) => [...prev, { label: `Economic Stimulus ($${amount}B)`, cost: amount, snapshotNS: snapNS, snapshotRel: snapRel }]);
    setTurnSpent((prev) => prev + amount);
    setShowStimulusSlider(false);
  }, []);

  const handleRemoveAction = useCallback((index: number) => {
    const action = pendingActions[index];
    if (!action) return;
    // Restore the snapshot from that action (undo all actions from that point)
    // For simplicity, we restore the snapshot and re-execute remaining actions
    useGameStore.setState({
      nationStates: action.snapshotNS,
      relationshipMatrix: action.snapshotRel,
    });
    // Remove this action and recalculate subsequent ones
    const remaining = pendingActions.slice(0, index);
    const removedCost = pendingActions.slice(index).reduce((sum, a) => sum + a.cost, 0);
    setPendingActions(remaining);
    setTurnSpent((prev) => prev - removedCost);
    setActionLog((prev) => [...prev, `↩ Cancelled: ${action.label}`]);
  }, [pendingActions]);

  const handleEndTurn = useCallback(() => {
    setTurnProcessing(true);
    setTimeout(() => {
      const turnState = useGameStore.getState();
      const result = processTurn(turnState);

      // Use nation states & relations produced by processTurn (includes all AI actions,
      // feedback loops, policy effects, civil war progression, and natural drift)
      const ns = result.nationStates;
      const rel = result.relationshipMatrix;

      // Persist updated states (FR-3300/3400)
      const storeUpdate: Record<string, unknown> = {
        nationStates: ns,
        relationshipMatrix: rel,
      };
      if (result.marketState) {
        storeUpdate.marketState = result.marketState;
      }
      if (result.innovationState) {
        storeUpdate.innovationState = result.innovationState;
      }
      if (result.nationalPolicies) {
        storeUpdate.nationalPolicies = result.nationalPolicies;
      }
      if (result.civilWarStates) {
        storeUpdate.civilWarStates = result.civilWarStates;
      }
      if (result.multiVectorSummary) {
        storeUpdate.multiVectorSummary = result.multiVectorSummary;
      }
      if (result.currencyState) {
        storeUpdate.currencyState = result.currencyState;
      }
      if (result.emergentTechState) {
        storeUpdate.emergentTechState = result.emergentTechState;
      }

      useGameStore.setState(storeUpdate);

      setHeadlines(result.headlines);
      setActionLog((prev) => [...prev, `── Turn ${turn as number} ends ──`, ...result.aiActions]);

      // Record timeline snapshot with decisions, market detail, & technology
      const fullState = useGameStore.getState();
      const prevSnap = timelineRef.current.length > 0 ? timelineRef.current[timelineRef.current.length - 1] : null;
      const snap = captureTurnSnapshot(
        turnState.currentTurn as number, ns,
        result.headlines.map((h) => h.text), result.aiActions,
        result.marketState ?? fullState.marketState,
        {
          decisions: pendingActions.map((a) => a.label),
          stateChanges: result.stateChanges,
          technologyIndices: fullState.technologyIndices,
          techModuleRegistry: fullState.techModuleRegistry,
          prevTechDiscoveryCount: timelineRef.current.reduce((n, s) => n + s.techDiscoveries.length, 0),
          relationshipMatrix: rel as Record<string, Record<string, number>>,
          prevSnapshot: prevSnap,
        },
      );
      timelineRef.current = [...timelineRef.current, snap];
      try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(timelineRef.current)); } catch { /* non-critical */ }

      if (result.gameOver && result.gameOverReason) {
        setGameOver(result.gameOverReason);
      } else {
        advanceTurn();
      }
      setPendingActions([]);
      setTurnSpent(0);
      setTurnProcessing(false);
    }, 300);
  }, [turn, advanceTurn, setGameOver, pendingActions]);

  const calDate = simulatedDate(turn as number);

  return (
    <div style={rootStyle}>
      {/* ── TOP BAR ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', backgroundColor: '#111', borderBottom: '1px solid #222',
        fontSize: 13, minHeight: 48, gap: 16, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, color: FACTION_INFO[playerFaction]?.color }}>
            {FACTION_INFO[playerFaction]?.flag} {FACTION_INFO[playerFaction]?.name}
          </span>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ fontWeight: 600 }}>Turn {turn as number}</span>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: '#aaa' }}>{calDate}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
          NEW ORDER
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {playerNation && (
            <>
              <TopStat label="STB" value={playerNation.stability} color={statColor(playerNation.stability)} />
              <TopStat label="TRS" value={playerNation.treasury} prefix="$" suffix="B" />
              <TopStat label="MIL" value={playerNation.militaryReadiness} color={statColor(playerNation.militaryReadiness)} />
              <TopStat label="DIP" value={playerNation.diplomaticInfluence} color={statColor(playerNation.diplomaticInfluence)} />
              <TopStat label="POP" value={playerNation.popularity} color={statColor(playerNation.popularity)} />
              <TopStat label="NUC" value={playerNation.nuclearThreshold} color={nucColor(playerNation.nuclearThreshold)} />
            </>
          )}
          <button onClick={() => setShowQuitConfirm(true)} style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            Quit
          </button>
        </div>
      </header>

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 0, backgroundColor: '#0d0d0d', borderBottom: '1px solid #222', flexShrink: 0, overflowX: 'auto' }}>
        {(['map', 'diplomacy', 'dashboard', 'markets', 'indexes', 'tech', 'innovation', 'policy', 'civilwar', 'scenario', 'military', 'education', 'demographics', 'politics', 'timeline', 'editor', 'automation', 'settings'] as const).map((tab) => {
          const labels: Record<string, string> = {
            map: '🗺️ Map', diplomacy: '🤝 Diplomacy', dashboard: '📊 Dashboard',
            markets: '📈 Markets', forex: '💱 Forex', indexes: '📊 Indexes', tech: '🔬 Tech',
            innovation: '💡 Innovation', policy: '🏛️ Policy', civilwar: '✊ Unrest',
            scenario: '🏆 Scenario', timeline: '📜 Timeline',
            military: '⚔️ Military', education: '🎓 Education', demographics: '👥 Demographics',
            politics: '🏛️ Politics', editor: '🛠️ Editor', automation: '🤖 Automation', settings: '⚙️ Settings',
          };
          return (
            <button
              key={tab}
              onClick={() => setActivePanel(tab)}
              style={{
                padding: '8px 20px', background: activePanel === tab ? '#1a1a1a' : 'transparent',
                border: 'none', borderBottom: activePanel === tab ? '2px solid #4caf50' : '2px solid transparent',
                color: activePanel === tab ? '#e0e0e0' : '#666', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'inherit',
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT: Actions */}
        <div style={{
          width: 240, backgroundColor: '#0f0f0f', borderRight: '1px solid #222',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          <ActionSidebar
            actions={AVAILABLE_ACTIONS}
            playerTreasury={playerNation?.treasury ?? 0}
            turnSpent={turnSpent}
            pendingCount={pendingActions.length}
            maxActions={actionSlateConfig.limits.defaultMaxActions}
            onAction={handleAction}
          />
          {/* This Turn + End Turn pinned to bottom */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #222' }}>
            {pendingActions.length > 0 && (() => {
              // Map pending actions to ActionDefinition-like objects for interaction detection
              const slateActions: ActionDefinition[] = pendingActions.map((a, i) => ({
                actionId: `act_pending_${i}` as ActionId,
                actionType: 'economic' as const,
                targetNation: 'self',
                targetDimension: null,
                parameters: {},
                estimatedImpact: {},
                resourceCost: a.cost,
                priority: 3 as const,
                label: a.label,
                description: a.label,
              }));
              const interactions = pendingActions.length >= 2 ? detectInteractionEffects(slateActions) : [];
              return (
                <div style={{ padding: '8px 12px', fontSize: 11, maxHeight: 160, overflow: 'auto' }}>
                  <div style={{ color: '#888', marginBottom: 4, fontWeight: 600 }}>This Turn (${turnSpent}B spent):</div>
                  {pendingActions.map((a, i) => {
                    const scaledCost = computeActionCost(a.cost, i);
                    const isScaled = i >= 3;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4caf50', marginBottom: 2 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {a.label}</span>
                        {isScaled && (
                          <span title={`Scaled from $${a.cost}B (slot ${i + 1} surcharge)`}
                            style={{ fontSize: 9, color: '#ff9800', marginRight: 4, flexShrink: 0 }}>
                            ↑${Math.round(scaledCost)}B
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveAction(i)}
                          title="Undo this action"
                          style={{
                            background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer',
                            fontSize: 13, padding: '0 4px', fontFamily: 'inherit', lineHeight: 1, flexShrink: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  {interactions.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid #222' }}>
                      {interactions.map((fx, idx) => (
                        <div key={idx} style={{
                          fontSize: 10, padding: '2px 6px', marginBottom: 2, borderRadius: 3,
                          backgroundColor: fx.effectType === 'synergy' ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.15)',
                          color: fx.effectType === 'synergy' ? '#66bb6a' : '#ef5350',
                        }}>
                          {fx.effectType === 'synergy' ? '🤝 Synergy' : '⚡ Conflict'}: {fx.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <button
              onClick={handleEndTurn}
              disabled={turnProcessing}
              style={{
                margin: '8px 12px 12px', padding: '12px 0', width: 'calc(100% - 24px)',
                border: '1px solid #4caf50', borderRadius: 4,
                backgroundColor: turnProcessing ? '#1a1a1a' : 'transparent',
                color: turnProcessing ? '#666' : '#4caf50',
                fontWeight: 700, fontSize: 14, cursor: turnProcessing ? 'wait' : 'pointer',
                textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              {turnProcessing ? 'Processing...' : 'End Turn'}
            </button>
          </div>
        </div>

        {/* CENTER */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {activePanel === 'map' && (
            <>
              <WorldMapSVG
                nationStates={nationStates}
                relations={relations}
                playerFaction={playerFaction}
                onSelectFaction={(fid) => setMapActionTarget(fid)}
              />
              {mapActionTarget && (
                <MapActionPopover
                  target={mapActionTarget}
                  playerTreasury={playerNation?.treasury ?? 0}
                  onSelectAction={(action) => {
                    handleTargetedAction(action, mapActionTarget);
                    setMapActionTarget(null);
                  }}
                  onCancel={() => setMapActionTarget(null)}
                />
              )}
            </>
          )}
          {activePanel === 'diplomacy' && (
            <DiplomacyView nationStates={nationStates} relations={relations} playerFaction={playerFaction} />
          )}
          {activePanel === 'dashboard' && (
            <DashboardView nationStates={nationStates} playerFaction={playerFaction} turn={turn as number} />
          )}
          {activePanel === 'markets' && (
            <div style={{ display: 'flex', gap: 0, height: '100%' }}>
              <div style={{ flex: 1, overflow: 'auto' }}><StockMarketDashboard /></div>
              <div style={{ width: 240, borderLeft: '1px solid #222', overflow: 'auto', padding: 8 }}>
                <MarketSentimentWidget />
              </div>
            </div>
          )}
          {activePanel === 'indexes' && (
            <MarketIndexPanel />
          )}
          {activePanel === 'forex' && (
            <ForexDashboard />
          )}
          {activePanel === 'tech' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              {technologyIdx && (
                <div style={{ padding: 16, borderBottom: '1px solid #222' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔬 National Technology Index</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                    {([
                      ['AI', technologyIdx.ai, '#7c4dff'],
                      ['Semiconductors', technologyIdx.semiconductors, '#42a5f5'],
                      ['Space', technologyIdx.space, '#26c6da'],
                      ['Cyber', technologyIdx.cyber, '#ef5350'],
                      ['Biotech', technologyIdx.biotech, '#66bb6a'],
                      ['Quantum', technologyIdx.quantum, '#ffa726'],
                    ] as [string, number, string][]).map(([label, val, color]) => (
                      <div key={label} style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                        <div style={{ height: 4, backgroundColor: '#222', borderRadius: 2, marginTop: 6 }}>
                          <div style={{ height: '100%', width: `${val}%`, backgroundColor: color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {technologyIdx.techBlocAlignment && (
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
                      Tech Bloc: <strong style={{ color: '#89b4fa' }}>{technologyIdx.techBlocAlignment}</strong>
                    </div>
                  )}
                  {technologyIdx.activeResearch.length > 0 && (
                    <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Active Research</div>
                      {technologyIdx.activeResearch.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                          <span style={{ color: '#ccc' }}>{r.projectName} ({r.domain})</span>
                          <span style={{ color: '#4caf50' }}>{r.turnsRemaining} turns left</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <TechModuleViewer />
            </div>
          )}
          {activePanel === 'scenario' && (
            <ScenarioPanel />
          )}
          {activePanel === 'military' && (() => {
            const milData = buildMilitaryData(militaryStructure, playerNation?.gdp ?? 0);
            return (
              <div style={{ overflow: 'auto', height: '100%' }}>
                <MilitaryDashboard
                  inventory={milData.inventory}
                  procurementQueue={[]}
                  budget={milData.budget}
                  overallReadiness={militaryStructure?.readiness ?? playerNation?.militaryReadiness ?? 0}
                />
                {militaryStructure && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: 6, padding: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Force Structure</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                        <div style={{ textAlign: 'center', padding: 8, backgroundColor: '#0a0a12', borderRadius: 4 }}>
                          <div style={{ fontSize: 11, color: '#666' }}>Doctrine</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#89b4fa', textTransform: 'capitalize' }}>{militaryStructure.doctrine}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, backgroundColor: '#0a0a12', borderRadius: 4 }}>
                          <div style={{ fontSize: 11, color: '#666' }}>Force Projection</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: statColor(militaryStructure.forceProjection) }}>{militaryStructure.forceProjection}/100</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, backgroundColor: '#0a0a12', borderRadius: 4 }}>
                          <div style={{ fontSize: 11, color: '#666' }}>Tech Level</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#89b4fa' }}>{militaryStructure.techLevel}/100</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {activePanel === 'editor' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              {editingModule ? (
                <ModuleEditor
                  moduleType={editingModule.type}
                  moduleId={editingModule.id}
                  initialData={editingModule.data}
                  schema={{
                    type: 'object' as const,
                    properties: Object.fromEntries(
                      Object.entries(editingModule.data).map(([k, v]) => [
                        k,
                        typeof v === 'number'
                          ? { type: 'number' as const }
                          : typeof v === 'boolean'
                          ? { type: 'boolean' as const }
                          : { type: 'string' as const },
                      ]),
                    ),
                  }}
                  onSave={async (_type, _id, _data) => {
                    setEditingModule(null);
                  }}
                  onClose={() => setEditingModule(null)}
                  onDelete={async () => { setEditingModule(null); }}
                  onClone={(_type, _id, data) => {
                    setEditingModule({ type: editingModule.type, id: `${editingModule.id}-copy`, data: { ...data } });
                  }}
                />
              ) : (
                <ModuleBrowser
                  modules={buildModuleSummaries(nationStates, playerFaction)}
                  onSelectModule={(moduleType, id) => {
                    const data = getModuleData(nationStates, playerFaction, moduleType, id);
                    if (data) setEditingModule({ type: moduleType, id, data });
                  }}
                />
              )}
            </div>
          )}
          {activePanel === 'automation' && (
            <AutomationDashboard
              scenarios={[
                { id: 'march-2026', name: 'March 2026 Crisis', description: 'Default geopolitical scenario', maxTurns: 60 },
              ]}
              onRunScenario={handleRunScenario}
            />
          )}
          {activePanel === 'settings' && (
            <div style={{ overflow: 'auto', height: '100%', display: 'flex', justifyContent: 'center', padding: 24 }}>
              <AISettingsPanel
                settings={aiSettings}
                onSettingsChange={setAiSettings}
                onTestConnection={handleTestConnection}
              />
            </div>
          )}
          {activePanel === 'education' && (() => {
            const eduData = buildEducationData(technologyIdx, playerNation, nationStates, allTechIndices);
            return (
              <div style={{ overflow: 'auto', height: '100%' }}>
                <EducationDashboard
                  sectors={eduData.sectors}
                  metrics={eduData.metrics}
                  nationComparison={eduData.nationComparison}
                  recommendations={eduData.recommendations}
                  projectedEffects={eduData.projectedEffects}
                />
              </div>
            );
          })()}
          {activePanel === 'demographics' && (() => {
            const demoData = buildDemographicsData(playerFaction, playerNation, faultLines, massPsych, civilUnrest);
            return (
              <div style={{ overflow: 'auto', height: '100%' }}>
                <DemographicsDashboard
                  metrics={demoData.metrics}
                  agePyramid={demoData.agePyramid}
                  migrationFlows={demoData.migrationFlows}
                  religions={demoData.religions}
                  regions={demoData.regions}
                  forecasts={demoData.forecasts}
                  nationName={demoData.nationName}
                />
              </div>
            );
          })()}
          {activePanel === 'politics' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <PoliticalSystemCreator
                presets={POLITICAL_PRESETS}
                onSave={() => {}}
                onCancel={() => setActivePanel('dashboard')}
              />
            </div>
          )}

          {activePanel === 'innovation' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <InnovationDashboard
                innovationState={innovationState ?? null}
                playerNationId={playerFaction}
              />
            </div>
          )}

          {activePanel === 'policy' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <PolicyDashboard
                policyState={nationalPolicies?.[playerFaction]}
                nationName={(FACTION_INFO as Record<string, any>)[playerFaction]?.name ?? playerFaction}
                nationId={playerFaction}
                currentTurn={turn}
                onAddPolicy={addPolicy}
                onRemovePolicy={removePolicy}
              />
            </div>
          )}

          {activePanel === 'civilwar' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <CivilWarPanel
                civilWarState={civilWarStates?.[playerFaction]}
                nationName={(FACTION_INFO as Record<string, any>)[playerFaction]?.name ?? playerFaction}
                isPlayerNation={true}
              />
            </div>
          )}

          {activePanel === 'timeline' && (
            <div style={{ overflow: 'auto', height: '100%' }}>
              <TimelineSummary />
            </div>
          )}
        </div>
        <div style={{
          width: 280, backgroundColor: '#0f0f0f', borderLeft: '1px solid #222',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          <IntelSidebar nationStates={nationStates} relations={relations} playerFaction={playerFaction} />
          <HeadlinesTicker headlines={headlines} />
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', borderTop: '1px solid #222' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 6 }}>Event Log</div>
            {actionLog.slice(-15).reverse().map((log, i) => (
              <div key={i} style={{ fontSize: 11, color: log.startsWith('──') ? '#555' : '#aaa', marginBottom: 3, borderLeft: '2px solid #222', paddingLeft: 8 }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TICKER BAR ── */}
      <TickerBar />

      {/* Target Picker Modal */}
      {showTargetPicker && (
        <TargetPickerModal
          action={showTargetPicker}
          playerFaction={playerFaction}
          onSelect={(target) => handleTargetedAction(showTargetPicker, target)}
          onCancel={() => setShowTargetPicker(null)}
        />
      )}

      {/* Economic Stimulus Slider Modal */}
      {showStimulusSlider && (
        <StimulusSliderModal
          maxBudget={Math.floor(playerNation?.treasury ?? 0)}
          onConfirm={handleStimulusConfirm}
          onCancel={() => setShowStimulusSlider(false)}
        />
      )}

      {/* ── QUIT CONFIRMATION MODAL ── */}
      {showQuitConfirm && (
        <div
          data-testid="quit-confirm-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowQuitConfirm(false)}
        >
          <div
            data-testid="quit-confirm-dialog"
            style={{
              background: '#1a1a2e',
              border: '1px solid #e74c3c',
              borderRadius: 12,
              padding: '2rem 2.5rem',
              maxWidth: 420,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 0 40px rgba(231,76,60,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h2 style={{ color: '#e74c3c', margin: '0 0 0.75rem', fontSize: '1.3rem' }}>
              Quit Current Game?
            </h2>
            <p style={{ color: '#aaa', margin: '0 0 1.5rem', lineHeight: 1.5, fontSize: '0.95rem' }}>
              All unsaved progress will be lost. You can export your timeline
              from the 📜&nbsp;Timeline tab before quitting.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                data-testid="quit-cancel-btn"
                onClick={() => setShowQuitConfirm(false)}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#2a2a3e',
                  color: '#ccc',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Cancel
              </button>
              <button
                data-testid="quit-confirm-btn"
                onClick={() => { setShowQuitConfirm(false); resetGame(); }}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                }}
              >
                🚪 Quit Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// WORLD MAP (SVG)
// ═══════════════════════════════════════════════════════════════

interface MapRegion {
  fid: FactionId;
  cx: number;
  cy: number;
  r: number;
  shape: string;
}

const REGIONS: MapRegion[] = [
  { fid: 'us' as FactionId, cx: 150, cy: 160, r: 70, shape: 'M60,120 L100,100 L200,105 L240,130 L230,200 L200,230 L100,225 L65,190 Z' },
  { fid: 'eu' as FactionId, cx: 430, cy: 140, r: 45, shape: 'M385,105 L420,95 L475,100 L480,160 L465,185 L400,180 L385,155 Z' },
  { fid: 'russia' as FactionId, cx: 600, cy: 85, r: 80, shape: 'M490,55 L550,40 L710,45 L750,70 L740,115 L670,140 L540,130 L495,105 Z' },
  { fid: 'china' as FactionId, cx: 660, cy: 210, r: 60, shape: 'M605,175 L650,160 L720,170 L735,210 L710,260 L645,265 L610,240 L605,205 Z' },
  { fid: 'japan' as FactionId, cx: 790, cy: 195, r: 22, shape: 'M775,170 L800,165 L810,180 L808,215 L795,225 L778,218 L775,195 Z' },
  { fid: 'iran' as FactionId, cx: 520, cy: 230, r: 28, shape: 'M495,210 L530,200 L550,215 L548,250 L525,260 L500,250 L495,235 Z' },
  { fid: 'dprk' as FactionId, cx: 740, cy: 160, r: 16, shape: 'M728,148 L745,142 L755,150 L753,172 L742,178 L730,170 Z' },
  { fid: 'syria' as FactionId, cx: 475, cy: 215, r: 16, shape: 'M462,205 L480,198 L492,207 L490,228 L477,234 L464,225 Z' },
];

const WorldMap: FC<{
  nationStates: Record<string, any>;
  relations: Record<string, Record<string, number>>;
  playerFaction: FactionId;
  onSelectFaction: (fid: FactionId) => void;
}> = ({ nationStates, relations, playerFaction, onSelectFaction }) => (
  <div style={{
    width: '100%', height: '100%', backgroundColor: '#0d0d18',
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
    backgroundSize: '50px 50px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg viewBox="0 0 860 340" style={{ width: '100%', maxWidth: 1100, height: 'auto' }}>
      <rect x="0" y="0" width="860" height="340" fill="#0d1117" rx="6" />

      {/* Continent wireframe outlines */}
      <g opacity="0.15" fill="none" stroke="#2a3a4a" strokeWidth="1">
        {/* North America */}
        <path d="M40,60 Q60,40 100,35 Q140,30 180,42 Q220,50 250,70 Q260,95 255,130 Q248,160 230,195 Q210,225 190,240 Q160,255 130,250 Q100,245 80,235 Q60,220 50,195 Q35,165 32,130 Q30,100 40,60 Z" />
        {/* Central America */}
        <path d="M130,250 Q145,265 160,280 Q165,295 155,305 Q140,310 125,305" />
        {/* South America */}
        <path d="M155,305 Q175,295 200,295 Q220,300 235,315 Q240,335 230,350 Q210,370 190,380 Q170,375 155,360 Q140,345 135,325 Q135,310 155,305 Z" strokeDasharray="4,3" />
        {/* Europe */}
        <path d="M370,65 Q390,50 415,48 Q440,45 465,52 Q490,60 500,80 Q505,100 498,125 Q490,150 478,170 Q462,185 440,190 Q415,192 395,185 Q378,175 370,155 Q365,135 362,110 Q360,85 370,65 Z" />
        {/* Africa */}
        <path d="M395,200 Q415,195 440,198 Q460,205 475,225 Q485,250 480,280 Q470,310 455,330 Q435,345 415,340 Q400,330 390,310 Q380,290 378,260 Q378,230 395,200 Z" strokeDasharray="4,3" />
        {/* Russia / Northern Asia */}
        <path d="M480,30 Q520,20 570,18 Q630,15 690,20 Q740,28 770,45 Q785,65 780,90 Q770,115 748,130 Q720,145 680,150 Q640,148 590,140 Q545,132 510,115 Q490,100 482,80 Q478,55 480,30 Z" />
        {/* Middle East */}
        <path d="M480,190 Q500,180 525,182 Q545,188 560,205 Q568,225 565,250 Q555,270 538,278 Q518,282 500,275 Q485,265 478,245 Q472,225 480,190 Z" />
        {/* South/East Asia */}
        <path d="M590,155 Q625,148 660,152 Q700,158 740,170 Q760,185 765,210 Q760,240 742,265 Q720,280 690,285 Q655,282 625,270 Q600,255 585,235 Q578,210 580,185 Q582,165 590,155 Z" />
        {/* Japan arc */}
        <path d="M770,140 Q785,135 795,145 Q805,160 808,180 Q810,200 805,220 Q798,235 788,240 Q778,238 772,225 Q768,208 768,190 Q770,165 770,140 Z" />
        {/* Oceania hint */}
        <path d="M700,295 Q720,290 745,295 Q760,305 758,320 Q750,332 735,335 Q715,332 705,320 Q698,308 700,295 Z" strokeDasharray="3,4" />
      </g>

      {/* Grid */}
      {Array.from({ length: 18 }, (_, i) => (
        <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="340" stroke="#1a1a2e" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 50} x2="860" y2={i * 50} stroke="#1a1a2e" strokeWidth="0.5" />
      ))}

      {/* Tension lines */}
      {REGIONS.map((r1, i) =>
        REGIONS.slice(i + 1).map((r2) => {
          const tension = relations[r1.fid]?.[r2.fid] ?? 0;
          if (Math.abs(tension) < 20) return null;
          const color = tension > 50 ? '#ef535050' : tension > 0 ? '#ffb30030' : '#4caf5030';
          return (
            <line key={`${r1.fid}-${r2.fid}`} x1={r1.cx} y1={r1.cy} x2={r2.cx} y2={r2.cy}
              stroke={color} strokeWidth={Math.abs(tension) / 30} strokeDasharray={tension > 0 ? '8,4' : undefined} />
          );
        })
      )}

      {/* Territories */}
      {REGIONS.map((region) => {
        const info = FACTION_INFO[region.fid];
        const ns = nationStates[region.fid];
        const isPlayer = region.fid === playerFaction;

        return (
          <g key={region.fid}
            onClick={() => region.fid !== playerFaction && onSelectFaction(region.fid)}
            style={{ cursor: region.fid !== playerFaction ? 'pointer' : 'default' }}>
            <path d={region.shape}
              fill={`${info.color}${isPlayer ? '40' : '25'}`}
              stroke={isPlayer ? info.color : `${info.color}80`}
              strokeWidth={isPlayer ? 2 : 1} />
            <text x={region.cx} y={region.cy - 14} textAnchor="middle" fontSize="16" fill="#fff">{info.flag}</text>
            <text x={region.cx} y={region.cy + 2} textAnchor="middle" fontSize="9" fill={info.color} fontWeight="700">{info.name}</text>
            {ns && (
              <>
                <text x={region.cx} y={region.cy + 14} textAnchor="middle" fontSize="7.5" fill="#aaa">
                  STB {Math.round(ns.stability)} · MIL {Math.round(ns.militaryReadiness)}
                </text>
                <text x={region.cx} y={region.cy + 24} textAnchor="middle" fontSize="7.5" fill="#777">
                  ${Math.round(ns.treasury)}B · DIP {Math.round(ns.diplomaticInfluence)}
                </text>
              </>
            )}
            {isPlayer && (
              <text x={region.cx} y={region.cy - 27} textAnchor="middle" fontSize="7" fill="#4caf50" fontWeight="700">★ YOU</text>
            )}
          </g>
        );
      })}
    </svg>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ACTION SIDEBAR
// ═══════════════════════════════════════════════════════════════

const ActionSidebar: FC<{
  actions: GameAction[];
  playerTreasury: number;
  turnSpent: number;
  pendingCount: number;
  maxActions: number;
  onAction: (action: GameAction) => void;
}> = ({ actions, playerTreasury, turnSpent, pendingCount, maxActions, onAction }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = new Map<string, GameAction[]>();
  for (const a of actions) {
    const g = groups.get(a.category) ?? [];
    g.push(a);
    groups.set(a.category, g);
  }
  const available = Math.round(playerTreasury);
  const atCapacity = pendingCount >= maxActions;
  const nextActionScaled = pendingCount >= 3;

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: '8px 0' }}>
      <div style={{ padding: '4px 14px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#555' }}>
        Orders · ${available}B available
      </div>
      {/* Capacity indicator */}
      <div style={{
        padding: '4px 14px 6px', fontSize: 10, display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: atCapacity ? '#ef5350' : '#888' }}>
          {pendingCount}/{maxActions} actions queued
        </span>
        {nextActionScaled && !atCapacity && (
          <span style={{ color: '#ff9800', fontSize: 9, fontStyle: 'italic' }}>
            +{Math.round((actionSlateConfig.costs.additionalActionCostScaling) * 100)}% cost
          </span>
        )}
        {atCapacity && (
          <span style={{ color: '#ef5350', fontSize: 9, fontWeight: 700 }}>FULL</span>
        )}
      </div>
      {[...groups.entries()].map(([cat, items]) => {
        const isCollapsed = collapsed[cat] ?? false;
        return (
          <div key={cat}>
            <div
              onClick={() => setCollapsed((p) => ({ ...p, [cat]: !p[cat] }))}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: 1, color: '#888',
                borderBottom: '1px solid #1a1a1a', userSelect: 'none',
              }}
            >
              <span>{cat}</span>
              <span>{isCollapsed ? '▸' : '▾'}</span>
            </div>
            {!isCollapsed && items.map((action) => {
              const canAfford = playerTreasury >= action.cost;
              return (
                <button key={action.id} onClick={() => canAfford && onAction(action)}
                  disabled={!canAfford} title={action.description}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 14px 7px 22px', cursor: canAfford ? 'pointer' : 'not-allowed',
                    border: 'none', background: 'none', color: canAfford ? '#ccc' : '#444',
                    fontSize: 13, width: '100%', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                  <span>{action.label}</span>
                  {action.cost > 0 && (
                    <span style={{ fontSize: 11, color: canAfford ? '#666' : '#333' }}>${action.cost}B</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TARGET PICKER MODAL
// ═══════════════════════════════════════════════════════════════

const TargetPickerModal: FC<{
  action: GameAction;
  playerFaction: FactionId;
  onSelect: (target: FactionId) => void;
  onCancel: () => void;
}> = ({ action, playerFaction, onSelect, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 24, maxWidth: 500, width: '90%' }}>
      <h3 style={{ fontSize: 16, marginBottom: 4, marginTop: 0 }}>{action.label}</h3>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Select target nation:</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {ALL_FACTIONS.filter((f) => f !== playerFaction).map((fid) => {
          const info = FACTION_INFO[fid];
          return (
            <button key={fid} onClick={() => onSelect(fid)}
              style={{
                padding: '10px 12px', background: '#111', border: '1px solid #333',
                borderRadius: 6, cursor: 'pointer', color: '#e0e0e0',
                textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
              }}>
              <span style={{ marginRight: 8 }}>{info.flag}</span>
              <span style={{ color: info.color, fontWeight: 600 }}>{info.name}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onCancel}
        style={{
          marginTop: 16, padding: '8px 24px', background: 'transparent',
          border: '1px solid #555', borderRadius: 4, color: '#aaa',
          cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}>
        Cancel
      </button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// STIMULUS SLIDER MODAL
// ═══════════════════════════════════════════════════════════════

const StimulusSliderModal: FC<{
  maxBudget: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}> = ({ maxBudget, onConfirm, onCancel }) => {
  const [amount, setAmount] = useState(Math.min(5, maxBudget));
  const cap = Math.min(maxBudget, 40);
  const preview = {
    stability: +(amount * 0.3).toFixed(4),
    popularity: +(amount * 0.5).toFixed(4),
    inflation: +(amount * 0.2).toFixed(4),
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 24, maxWidth: 420, width: '90%' }}>
        <h3 style={{ fontSize: 16, marginBottom: 4, marginTop: 0 }}>💰 Economic Stimulus Package</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Allocate funds from treasury to boost economy. Higher spending means more impact — and more inflation.</p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#888' }}>Budget Allocation</span>
            <span style={{ color: '#4caf50', fontWeight: 700, fontSize: 18 }}>${amount}B</span>
          </div>
          <input
            type="range" min={1} max={cap} value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#4caf50' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 4 }}>
            <span>$1B</span>
            <span>${cap}B</span>
          </div>
        </div>

        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 6, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#555', marginBottom: 8 }}>Projected Effects</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Stability</span>
            <span style={{ color: '#4caf50' }}>+{preview.stability}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#888' }}>Popularity</span>
            <span style={{ color: '#4caf50' }}>+{preview.popularity}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#888' }}>Inflation</span>
            <span style={{ color: '#ef5350' }}>+{preview.inflation}%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onConfirm(amount)}
            style={{
              flex: 1, padding: '10px 0', background: '#4caf50', border: 'none',
              borderRadius: 4, color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Authorize ${amount}B Stimulus
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px', background: 'transparent', border: '1px solid #555',
              borderRadius: 4, color: '#aaa', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DIPLOMACY VIEW
// ═══════════════════════════════════════════════════════════════

const DiplomacyView: FC<{
  nationStates: Record<string, any>;
  relations: Record<string, Record<string, number>>;
  playerFaction: FactionId;
}> = ({ nationStates, relations, playerFaction }) => (
  <div style={{ padding: 24, overflow: 'auto', height: '100%' }}>
    <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 700 }}>Diplomatic Relations</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {ALL_FACTIONS.filter((f) => f !== playerFaction).map((fid) => {
        const info = FACTION_INFO[fid];
        const ns = nationStates[fid];
        const tension = relations[playerFaction]?.[fid] ?? 0;
        const label = tension <= -50 ? 'Allied' : tension <= -20 ? 'Friendly' : tension <= 20 ? 'Neutral' : tension <= 50 ? 'Tense' : tension <= 80 ? 'Hostile' : 'At War';
        const color = tension <= -20 ? '#4caf50' : tension <= 20 ? '#ffb300' : '#ef5350';

        return (
          <div key={fid} style={{ background: '#141414', border: '1px solid #222', borderRadius: 6, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{info.flag} {info.name}</span>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                backgroundColor: `${color}22`, color,
              }}>
                {label}
              </span>
            </div>
            <TensionBar value={tension} />
            {ns && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#aaa' }}>
                <span>STB <strong style={{ color: statColor(ns.stability) }}>{Math.round(ns.stability)}</strong></span>
                <span>MIL <strong style={{ color: statColor(ns.militaryReadiness) }}>{Math.round(ns.militaryReadiness)}</strong></span>
                <span>DIP <strong>{Math.round(ns.diplomaticInfluence)}</strong></span>
                <span>NUC <strong style={{ color: nucColor(ns.nuclearThreshold) }}>{Math.round(ns.nuclearThreshold)}</strong></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const TensionBar: FC<{ value: number }> = ({ value }) => {
  const pct = ((value + 100) / 200) * 100;
  const color = value <= -20 ? '#4caf50' : value <= 20 ? '#ffb300' : '#ef5350';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#4caf50', width: 30 }}>-100</span>
      <div style={{ flex: 1, height: 6, backgroundColor: '#222', borderRadius: 3, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, backgroundColor: '#444' }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: -3, width: 10, height: 12,
          backgroundColor: color, borderRadius: 2, transform: 'translateX(-50%)',
        }} />
      </div>
      <span style={{ fontSize: 10, color: '#ef5350', width: 30, textAlign: 'right' }}>+100</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════

const thStyle: CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #333', color: '#888', fontWeight: 600 };
const tdStyle: CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #1a1a1a' };

const DashboardView: FC<{
  nationStates: Record<string, any>;
  playerFaction: FactionId;
  turn: number;
}> = ({ nationStates, playerFaction, turn }) => {
  const pn = nationStates[playerFaction];
  if (!pn) return <div style={{ padding: 24, color: '#888' }}>No data</div>;
  const info = FACTION_INFO[playerFaction];

  return (
    <div style={{ padding: 24, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 700 }}>
        {info.flag} {info.name} — Strategic Dashboard
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <DashCard label="Stability" value={pn.stability} max={100} color={statColor(pn.stability)} />
        <DashCard label="Treasury" value={pn.treasury} suffix="B" prefix="$" color="#e0e0e0" />
        <DashCard label="GDP" value={pn.gdp} suffix="B" prefix="$" color="#e0e0e0" />
        <DashCard label="Inflation" value={pn.inflation} suffix="%" color={pn.inflation > 15 ? '#ef5350' : pn.inflation > 8 ? '#ffb300' : '#4caf50'} />
        <DashCard label="Military Readiness" value={pn.militaryReadiness} max={100} color={statColor(pn.militaryReadiness)} />
        <DashCard label="Nuclear Threshold" value={pn.nuclearThreshold} max={100} color={nucColor(pn.nuclearThreshold)} />
        <DashCard label="Diplomatic Influence" value={pn.diplomaticInfluence} max={100} color={statColor(pn.diplomaticInfluence)} />
        <DashCard label="Popularity" value={pn.popularity} max={100} color={statColor(pn.popularity)} />
        <DashCard label="Alliance Credibility" value={pn.allianceCredibility} max={100} color={statColor(pn.allianceCredibility)} />
        <DashCard label="Technology Level" value={pn.techLevel} max={100} color="#89b4fa" />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#888' }}>Global Comparison — Turn {turn}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Nation</th><th style={thStyle}>STB</th><th style={thStyle}>Treasury</th>
            <th style={thStyle}>GDP</th><th style={thStyle}>MIL</th><th style={thStyle}>DIP</th>
            <th style={thStyle}>NUC</th><th style={thStyle}>Tech</th>
          </tr>
        </thead>
        <tbody>
          {ALL_FACTIONS.map((fid) => {
            const ns = nationStates[fid];
            if (!ns) return null;
            const fi = FACTION_INFO[fid];
            const isP = fid === playerFaction;
            return (
              <tr key={fid} style={{ backgroundColor: isP ? 'rgba(76,175,80,0.08)' : undefined }}>
                <td style={tdStyle}><span style={{ color: fi.color, fontWeight: isP ? 700 : 400 }}>{fi.flag} {fi.name}</span></td>
                <td style={{ ...tdStyle, color: statColor(ns.stability) }}>{Math.round(ns.stability)}</td>
                <td style={tdStyle}>${Math.round(ns.treasury)}B</td>
                <td style={tdStyle}>${Math.round(ns.gdp).toLocaleString()}B</td>
                <td style={{ ...tdStyle, color: statColor(ns.militaryReadiness) }}>{Math.round(ns.militaryReadiness)}</td>
                <td style={tdStyle}>{Math.round(ns.diplomaticInfluence)}</td>
                <td style={{ ...tdStyle, color: nucColor(ns.nuclearThreshold) }}>{Math.round(ns.nuclearThreshold)}</td>
                <td style={tdStyle}>{Math.round(ns.techLevel)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const DashCard: FC<{ label: string; value: number; max?: number; color: string; prefix?: string; suffix?: string }> = ({
  label, value, max, color, prefix, suffix,
}) => (
  <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 6, padding: 14 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{prefix}{Math.round(value).toLocaleString()}{suffix}</div>
    {max && (
      <div style={{ height: 4, backgroundColor: '#222', borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: '100%', width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color, borderRadius: 2 }} />
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// INTEL SIDEBAR
// ═══════════════════════════════════════════════════════════════

const IntelSidebar: FC<{
  nationStates: Record<string, any>;
  relations: Record<string, Record<string, number>>;
  playerFaction: FactionId;
}> = ({ nationStates, relations, playerFaction }) => (
  <div style={{ overflow: 'auto', padding: '12px', flex: 1 }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 8 }}>
      Intelligence Brief
    </div>
    {ALL_FACTIONS.filter((f) => f !== playerFaction).map((fid) => {
      const info = FACTION_INFO[fid];
      const ns = nationStates[fid];
      const tension = relations[playerFaction]?.[fid] ?? 0;
      if (!ns) return null;
      return (
        <div key={fid} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 4, padding: '8px 10px', marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{info.flag} {info.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#888' }}>Stability</span>
            <span style={{ color: statColor(ns.stability), fontWeight: 600 }}>{Math.round(ns.stability)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#888' }}>Tension</span>
            <span style={{ color: tension > 50 ? '#ef5350' : tension > 0 ? '#ffb300' : '#4caf50', fontWeight: 600 }}>
              {tension > 0 ? '+' : ''}{Math.round(tension)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#888' }}>Military</span>
            <span style={{ color: '#aaa' }}>{Math.round(ns.militaryReadiness)}</span>
          </div>
        </div>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAP ACTION POPOVER
// ═══════════════════════════════════════════════════════════════

const MapActionPopover: FC<{
  target: FactionId;
  playerTreasury: number;
  onSelectAction: (action: (typeof AVAILABLE_ACTIONS)[number]) => void;
  onCancel: () => void;
}> = ({ target, playerTreasury, onSelectAction, onCancel }) => {
  const info = FACTION_INFO[target];
  const targetedActions = AVAILABLE_ACTIONS.filter((a) => a.targetRequired);
  const categories = [...new Set(targetedActions.map((a) => a.category))];

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e', border: '1px solid #333', borderRadius: 10,
          padding: 20, minWidth: 340, maxWidth: 420, maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: info?.color ?? '#ccc', marginBottom: 12 }}>
          {info?.flag ?? ''} {info?.name ?? target} — Select Action
        </div>
        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 1.2, color: '#666', marginBottom: 6,
            }}>
              {cat}
            </div>
            {targetedActions.filter((a) => a.category === cat).map((action) => {
              const canAfford = playerTreasury >= (action.cost ?? 0);
              return (
                <button
                  key={action.id}
                  disabled={!canAfford}
                  onClick={() => onSelectAction(action)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                    border: `1px solid ${canAfford ? '#333' : '#222'}`,
                    background: canAfford ? '#111' : '#0a0a0a',
                    color: canAfford ? '#e0e0e0' : '#555',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', fontSize: 12,
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => { if (canAfford) e.currentTarget.style.background = '#1a2a1a'; }}
                  onMouseOut={(e) => { if (canAfford) e.currentTarget.style.background = '#111'; }}
                >
                  <span style={{ fontWeight: 600 }}>{action.label}</span>
                  {action.cost ? (
                    <span style={{ float: 'right', color: canAfford ? '#ffb300' : '#555', fontSize: 11 }}>
                      ${action.cost}B
                    </span>
                  ) : null}
                  {action.description ? (
                    <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>{action.description}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
        <button
          onClick={onCancel}
          style={{
            marginTop: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600,
            border: '1px solid #444', borderRadius: 6, background: 'transparent',
            color: '#999', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// HEADLINES TICKER
// ═══════════════════════════════════════════════════════════════

const HeadlinesTicker: FC<{ headlines: TurnHeadline[] }> = ({ headlines }) => (
  <div style={{ borderTop: '1px solid #222', padding: '8px 12px', maxHeight: 150, overflow: 'auto' }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 6 }}>
      Headlines
    </div>
    {headlines.length === 0 ? (
      <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic' }}>Awaiting events...</div>
    ) : (
      headlines.slice(-8).reverse().map((h, i) => (
        <div key={i} style={{
          fontSize: 11,
          color: h.severity === 'critical' ? '#ef5350' : h.severity === 'high' ? '#ffb300' : '#ccc',
          marginBottom: 3, paddingLeft: 8,
          borderLeft: `2px solid ${h.severity === 'critical' ? '#ef5350' : h.severity === 'high' ? '#ffb300' : '#333'}`,
        }}>
          {h.text}
        </div>
      ))
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const TopStat: FC<{ label: string; value: number; color?: string; prefix?: string; suffix?: string }> = ({
  label, value, color, prefix, suffix,
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: '#1a1a1a', fontSize: 12 }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color: color ?? '#e0e0e0', fontWeight: 600 }}>{prefix}{Math.round(value)}{suffix}</span>
  </span>
);

function statColor(value: number): string {
  if (value > 60) return '#4caf50';
  if (value >= 30) return '#ffb300';
  return '#ef5350';
}

function nucColor(value: number): string {
  if (value < 20) return '#4caf50';
  if (value < 50) return '#ffb300';
  return '#ef5350';
}

function simulatedDate(turn: number): string {
  const base = new Date(2026, 2, 1);
  base.setMonth(base.getMonth() + turn - 1);
  return base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
