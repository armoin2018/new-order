/**
 * TimelineSummary — Accessible-anytime timeline viewer
 *
 * Displays a turn-by-turn summary of the entire simulation with:
 * - Turn date, headlines, player decisions, AI actions, state changes
 * - Faction stat sparklines (stability, GDP, treasury)
 * - Market events & tech discoveries
 * - Export to JSON (full timeline + reimportable scenario seed)
 * - Import from previously exported JSON
 *
 * @module ui/TimelineSummary
 */

import { useState, useCallback, useRef } from 'react';
import type { FC, CSSProperties, ChangeEvent } from 'react';
import { usePlayerFaction, useCurrentTurn } from '@/engine/hooks';
import { useGameStore } from '@/engine/store';
import { FACTION_INFO } from '@/engine/game-controller';

// ─── Constants & Style ───────────────────────────────────────

const TIMELINE_KEY = 'neworder-game-timeline';

const panelStyle: CSSProperties = {
  padding: 16,
  color: '#e0e0e0',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  height: '100%',
  overflow: 'auto',
};

const cardStyle: CSSProperties = {
  backgroundColor: '#111',
  border: '1px solid #222',
  borderRadius: 6,
  padding: 12,
  marginBottom: 12,
};

const btnStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: '1px solid #4caf50',
  background: 'rgba(76,175,80,0.08)',
  color: '#4caf50',
};

// ─── TurnSnapshot type (mirrors App.tsx) ─────────────────────

interface TurnSnapshotFaction {
  stability: number;
  gdp: number;
  treasury: number;
  inflation: number;
  militaryReadiness: number;
  diplomaticInfluence: number;
  popularity: number;
  nuclearThreshold: number;
  techLevel: number;
}

interface TurnSnapshot {
  turn: number;
  date: string;
  headlines: string[];
  actions: string[];
  decisions: string[];
  stateChanges: string[];
  factions: Record<string, TurnSnapshotFaction>;
  marketSummary: string | null;
  marketTickers: Record<string, { price: number; change: number; changePct: number; trend: string }> | null;
  marketIndexes: Record<string, { value: number; change: number; changePct: number }> | null;
  marketSentiment: Record<string, { sentiment: string; score: number; volatility: number }> | null;
  marketEvents: string[];
  technology: Record<string, {
    ai: number; semiconductors: number; space: number;
    cyber: number; biotech: number; quantum: number;
  }> | null;
  techDiscoveries: string[];
  education: Record<string, {
    literacyRate: number; researchBonus: number;
    innovationCapacity: number; techInvestmentIndex: number;
  }> | null;
  tensions: Array<{ factionA: string; factionB: string; level: number; trend: string }>;
  marketAnalysis: string;
  deepAnalysis: string | null;
}

// ─── Export helpers ───────────────────────────────────────────

function buildTimelineExport(
  timeline: TurnSnapshot[],
  playerFaction: string,
  scenarioName: string,
  currentTurn: number,
) {
  return {
    exportedAt: new Date().toISOString(),
    format: 'neworder-timeline-v1',
    scenario: scenarioName,
    playerFaction,
    currentTurn,
    totalTurns: timeline.length,
    timeline,
  };
}

function buildScenarioSeed(
  timeline: TurnSnapshot[],
  playerFaction: string,
  scenarioName: string,
) {
  // Use the final turn state as the seed for a new scenario
  const lastSnap = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  const factions = Object.keys(lastSnap?.factions ?? {});

  // Build nation state seeds from last snapshot
  const nationSeeds: Record<string, Record<string, unknown>> = {};
  if (lastSnap) {
    for (const [fid, data] of Object.entries(lastSnap.factions)) {
      nationSeeds[fid] = {
        stability: data.stability,
        gdp: data.gdp,
        treasury: data.treasury,
        inflation: data.inflation,
        militaryReadiness: data.militaryReadiness,
        diplomaticInfluence: data.diplomaticInfluence,
        popularity: data.popularity,
        nuclearThreshold: data.nuclearThreshold,
        techLevel: data.techLevel,
      };
    }
  }

  // Build tension seeds from last snapshot
  const tensionSeeds: Array<{ factionA: string; factionB: string; level: number }> = [];
  if (lastSnap?.tensions) {
    for (const t of lastSnap.tensions) {
      tensionSeeds.push({ factionA: t.factionA, factionB: t.factionB, level: t.level });
    }
  }

  // Build market seeds from last snapshot
  const marketSeeds: Record<string, unknown> = {};
  if (lastSnap?.marketIndexes) {
    marketSeeds.indexes = lastSnap.marketIndexes;
  }
  if (lastSnap?.marketSentiment) {
    marketSeeds.sentiment = lastSnap.marketSentiment;
  }

  // Build technology seeds from last snapshot
  const techSeeds: Record<string, unknown> = {};
  if (lastSnap?.technology) {
    techSeeds.technologyIndices = lastSnap.technology;
  }

  return {
    exportedAt: new Date().toISOString(),
    format: 'neworder-scenario-seed-v1',
    description: `Scenario seed generated from "${scenarioName}" at turn ${timeline.length}`,
    sourceScenario: scenarioName,
    playerFaction,
    sourceTurn: timeline.length,
    factions,
    nationStates: nationSeeds,
    tensions: tensionSeeds,
    markets: marketSeeds,
    technology: techSeeds,
    // Include full timeline for reference
    timeline: timeline.map((t) => ({
      turn: t.turn,
      date: t.date,
      headlines: t.headlines,
      decisions: t.decisions,
      actions: t.actions,
    })),
  };
}

function downloadFile(data: unknown, filename: string, mime = 'application/json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────

export const TimelineSummary: FC = () => {
  const playerFaction = usePlayerFaction();
  const currentTurn = useCurrentTurn() as number;
  const scenarioName = useGameStore((s) => s.scenarioMeta?.name ?? 'Unknown Scenario');
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read timeline from localStorage
  const timeline: TurnSnapshot[] = (() => {
    try {
      const raw = localStorage.getItem(TIMELINE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  })();

  const factionInfo = FACTION_INFO as Record<string, { flag: string; name: string; color: string }>;

  // ── Exports ──
  const handleExportTimeline = useCallback(() => {
    const payload = buildTimelineExport(timeline, playerFaction, scenarioName, currentTurn);
    downloadFile(payload, `neworder-timeline-turn${currentTurn}.json`);
  }, [timeline, playerFaction, scenarioName, currentTurn]);

  const handleExportScenario = useCallback(() => {
    const payload = buildScenarioSeed(timeline, playerFaction, scenarioName);
    downloadFile(payload, `neworder-scenario-seed-turn${currentTurn}.json`);
  }, [timeline, playerFaction, scenarioName, currentTurn]);

  // ── Import ──
  const handleImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.format === 'neworder-timeline-v1' && Array.isArray(data.timeline)) {
          localStorage.setItem(TIMELINE_KEY, JSON.stringify(data.timeline));
          setImportStatus(`✅ Imported ${data.timeline.length} turns from "${data.scenario}"`);
        } else if (data.format === 'neworder-scenario-seed-v1' && Array.isArray(data.timeline)) {
          // Scenario seed — import the summary timeline for reference
          localStorage.setItem(TIMELINE_KEY, JSON.stringify(
            data.timeline.map((t: any) => ({
              ...t,
              factions: data.nationStates ?? {},
              stateChanges: [],
              marketSummary: null,
              marketTickers: null,
              marketIndexes: null,
              marketSentiment: null,
              marketEvents: [],
              technology: data.technology?.technologyIndices ?? null,
              techDiscoveries: [],
              education: null,
              tensions: data.tensions ?? [],
              marketAnalysis: '',
              deepAnalysis: null,
            })),
          ));
          setImportStatus(`✅ Imported scenario seed from "${data.sourceScenario}" (${data.sourceTurn} turns)`);
        } else {
          setImportStatus('⚠️ Unrecognized file format — expected neworder-timeline-v1 or neworder-scenario-seed-v1');
        }
      } catch {
        setImportStatus('❌ Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, []);

  // ── No data state ──
  if (timeline.length === 0) {
    return (
      <div style={panelStyle} data-testid="timeline-summary">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📜 Timeline Summary</h2>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          <p style={{ fontSize: 14 }}>No timeline data available yet.</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
            The timeline records each turn's headlines, decisions, and faction data as the simulation progresses.
          </p>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => fileInputRef.current?.click()} style={btnStyle}>
              📂 Import Timeline
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </div>
          {importStatus && <p style={{ marginTop: 8, fontSize: 11 }}>{importStatus}</p>}
        </div>
      </div>
    );
  }

  // ── Stats summary ──
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const pFirst = first?.factions[playerFaction];
  const pLast = last?.factions[playerFaction];

  return (
    <div style={panelStyle} data-testid="timeline-summary">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📜 Timeline Summary</h2>

      {/* ── Export / Import Bar ── */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleExportTimeline} style={btnStyle} data-testid="export-timeline-btn">
          📥 Export Timeline (JSON)
        </button>
        <button onClick={handleExportScenario} style={{ ...btnStyle, borderColor: '#e91e63', color: '#e91e63', background: 'rgba(233,30,99,0.08)' }} data-testid="export-scenario-btn">
          🎮 Export as Scenario Seed
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, borderColor: '#2196f3', color: '#2196f3', background: 'rgba(33,150,243,0.08)' }}>
          📂 Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
        {importStatus && <span style={{ fontSize: 11 }}>{importStatus}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#666' }}>
          {timeline.length} turns recorded
        </span>
      </div>

      {/* ── Player Stats Overview ── */}
      {pFirst && pLast && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#888' }}>
            {factionInfo[playerFaction]?.flag} {factionInfo[playerFaction]?.name} — Overview
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
            {([
              ['Stability', pFirst.stability, pLast.stability],
              ['GDP', pFirst.gdp, pLast.gdp],
              ['Treasury', pFirst.treasury, pLast.treasury],
              ['Inflation', pFirst.inflation, pLast.inflation],
              ['Military', pFirst.militaryReadiness, pLast.militaryReadiness],
              ['Diplomacy', pFirst.diplomaticInfluence, pLast.diplomaticInfluence],
              ['Popularity', pFirst.popularity, pLast.popularity],
              ['Nuclear', pFirst.nuclearThreshold, pLast.nuclearThreshold],
              ['Tech', pFirst.techLevel, pLast.techLevel],
            ] as [string, number, number][]).map(([label, start, end]) => {
              const delta = end - start;
              return (
                <div key={label} style={{ backgroundColor: '#0a0a0a', borderRadius: 4, padding: '6px 8px', fontSize: 11 }}>
                  <div style={{ color: '#666', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#e0e0e0' }}>{Math.round(end)}</div>
                  <div style={{ color: delta > 0 ? '#4caf50' : delta < 0 ? '#ef5350' : '#666', fontSize: 10 }}>
                    {delta > 0 ? '+' : ''}{Math.round(delta)} from start
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Turn-by-turn timeline ── */}
      {timeline.slice().reverse().map((snap) => {
        const isExpanded = expandedTurn === snap.turn;
        const pFaction = snap.factions[playerFaction];

        return (
          <div key={snap.turn} style={cardStyle} data-testid={`timeline-turn-${snap.turn}`}>
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedTurn(isExpanded ? null : snap.turn)}
              style={{
                background: 'none', border: 'none', color: '#e0e0e0', cursor: 'pointer',
                width: '100%', textAlign: 'left', padding: 0, fontFamily: 'inherit',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#4caf50' }}>Turn {snap.turn}</span>
                <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>{snap.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pFaction && (
                  <span style={{ fontSize: 10, color: '#888' }}>
                    STB:{pFaction.stability} GDP:{pFaction.gdp}B TRS:{pFaction.treasury}B
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#555' }}>{isExpanded ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Headlines preview (always show top 2) */}
            {!isExpanded && snap.headlines.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#999' }}>
                {snap.headlines.slice(0, 2).map((h, i) => (
                  <div key={i} style={{ marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid #333' }}>{h}</div>
                ))}
                {snap.headlines.length > 2 && (
                  <div style={{ color: '#555', paddingLeft: 8, fontSize: 10 }}>+{snap.headlines.length - 2} more</div>
                )}
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ marginTop: 8 }}>
                {/* Headlines */}
                {snap.headlines.length > 0 && (
                  <Section title="📰 Headlines" items={snap.headlines} />
                )}

                {/* Player decisions */}
                {snap.decisions.length > 0 && (
                  <Section title="🎯 Player Decisions" items={snap.decisions} color="#4caf50" />
                )}

                {/* AI actions */}
                {snap.actions.length > 0 && (
                  <Section title="🤖 AI Actions" items={snap.actions} color="#2196f3" />
                )}

                {/* State changes */}
                {snap.stateChanges.length > 0 && (
                  <Section title="⚠️ State Changes" items={snap.stateChanges} color="#ffb300" />
                )}

                {/* Tech discoveries */}
                {snap.techDiscoveries.length > 0 && (
                  <Section title="🔬 Tech Discoveries" items={snap.techDiscoveries} color="#9c27b0" />
                )}

                {/* Market events */}
                {snap.marketEvents.length > 0 && (
                  <Section title="📈 Market Events" items={snap.marketEvents} color="#00bcd4" />
                )}

                {/* Faction stats */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Faction Snapshot
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333', color: '#666' }}>
                        <th style={{ textAlign: 'left', padding: '3px 6px' }}>Faction</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>STB</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>GDP</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>TRS</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>MIL</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>DIP</th>
                        <th style={{ textAlign: 'right', padding: '3px 6px' }}>POP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(snap.factions).map(([fid, f]) => (
                        <tr key={fid} style={{ borderBottom: '1px solid #1a1a1a' }}>
                          <td style={{ padding: '3px 6px', fontWeight: 600, color: fid === playerFaction ? '#4caf50' : '#ccc' }}>
                            {factionInfo[fid]?.flag ?? ''} {factionInfo[fid]?.name ?? fid}
                          </td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>{f.stability}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>${f.gdp}B</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>${f.treasury}B</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>{f.militaryReadiness}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>{f.diplomaticInfluence}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>{f.popularity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Market indexes */}
                {snap.marketIndexes && Object.keys(snap.marketIndexes).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Market Indexes
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(snap.marketIndexes).map(([id, ix]) => (
                        <span key={id} style={{
                          padding: '2px 8px', borderRadius: 3, fontSize: 10,
                          backgroundColor: '#0a0a0a', border: '1px solid #222',
                        }}>
                          <span style={{ color: '#888' }}>{id}: </span>
                          <span style={{ fontWeight: 600 }}>{ix.value.toFixed(0)}</span>
                          <span style={{ color: ix.changePct >= 0 ? '#4caf50' : '#ef5350', marginLeft: 4 }}>
                            {ix.changePct >= 0 ? '+' : ''}{ix.changePct.toFixed(4)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tensions */}
                {snap.tensions.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Top Tensions
                    </div>
                    {snap.tensions.slice(0, 5).map((t, i) => (
                      <div key={i} style={{ fontSize: 10, color: t.level > 70 ? '#ef5350' : t.level > 40 ? '#ffb300' : '#888', marginBottom: 2 }}>
                        {factionInfo[t.factionA]?.flag ?? ''} {t.factionA} ↔ {factionInfo[t.factionB]?.flag ?? ''} {t.factionB}: {t.level}
                        <span style={{ color: '#555' }}> ({t.trend})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Deep analysis */}
                {snap.deepAnalysis && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#0a0a0a', borderRadius: 4, fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      🧠 AI Analysis
                    </div>
                    {snap.deepAnalysis}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Section helper ──────────────────────────────────────────

const Section: FC<{ title: string; items: string[]; color?: string }> = ({ title, items, color = '#ccc' }) => (
  <div style={{ marginTop: 6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
      {title}
    </div>
    {items.map((item, i) => (
      <div key={i} style={{
        fontSize: 11, color, marginBottom: 2, paddingLeft: 8,
        borderLeft: `2px solid ${color}33`,
      }}>
        {item}
      </div>
    ))}
  </div>
);

export default TimelineSummary;
