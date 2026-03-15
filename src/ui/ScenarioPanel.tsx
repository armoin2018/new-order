/**
 * ScenarioPanel — FR-3600
 *
 * Combined view for scenario scoring (FR-3601), history (FR-3603),
 * and export (FR-3604). Shows scoring at game end, event timeline
 * during gameplay, and download buttons for JSON/CSV/HTML exports.
 */

import { useState, useCallback } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type {
  ScenarioScore,
  DimensionScore,
} from '@/data/types/model.types';

// ─── Styles ──────────────────────────────────────────────────

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

// ─── Grade Colors ────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'S': return '#ffd700';
    case 'A': return '#4caf50';
    case 'B': return '#8bc34a';
    case 'C': return '#f59e0b';
    case 'D': return '#ef5350';
    case 'F': return '#b71c1c';
    default: return '#888';
  }
}

function scoreColor(score: number): string {
  if (score >= 800) return '#ffd700';
  if (score >= 600) return '#4caf50';
  if (score >= 400) return '#f59e0b';
  if (score >= 200) return '#ef5350';
  return '#b71c1c';
}

// ─── Component ───────────────────────────────────────────────

export interface ScenarioPanelProps {
  /** Externally provided score (from processTurn game-over result). */
  scenarioScore?: ScenarioScore | null;
}

export const ScenarioPanel: FC<ScenarioPanelProps> = ({ scenarioScore }) => {
  const isGameOver = useGameStore((s) => s.gameOver);
  const gameEndReason = useGameStore((s) => s.gameEndReason);
  const currentTurn = useGameStore((s) => s.currentTurn) as number;
  const playerFaction = useGameStore((s) => s.playerFaction);
  const [activeTab, setActiveTab] = useState<'scoring' | 'history' | 'export'>('scoring');

  return (
    <div style={panelStyle} data-testid="scenario-panel">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🏆 Scenario Analytics</h2>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #222' }}>
        {(['scoring', 'history', 'export'] as const).map((tab) => (
          <button
            key={tab}
            data-testid={`scenario-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? '#1a1a1a' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #4caf50' : '2px solid transparent',
              color: activeTab === tab ? '#e0e0e0' : '#666',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontFamily: 'inherit',
            }}
          >
            {tab === 'scoring' ? '📊 Scoring' : tab === 'history' ? '📜 History' : '💾 Export'}
          </button>
        ))}
      </div>

      {activeTab === 'scoring' && (
        <ScoringView score={scenarioScore ?? null} isGameOver={isGameOver} gameEndReason={gameEndReason} />
      )}
      {activeTab === 'history' && (
        <HistoryView currentTurn={currentTurn} playerFaction={playerFaction} />
      )}
      {activeTab === 'export' && (
        <ExportView isGameOver={isGameOver} />
      )}
    </div>
  );
};

// ─── Scoring View ────────────────────────────────────────────

const ScoringView: FC<{
  score: ScenarioScore | null;
  isGameOver: boolean;
  gameEndReason: string | null;
}> = ({ score, isGameOver, gameEndReason }) => {
  if (!isGameOver) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
        <p style={{ fontSize: 14 }}>Scenario scoring is computed when the game ends.</p>
        <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
          Complete the scenario to see your composite score across 7 dimensions:
          Stability, Economy, Military, Diplomacy, Technology, Markets, Strategy.
        </p>
      </div>
    );
  }

  if (!score) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
        <p style={{ fontSize: 14 }}>Game over: {gameEndReason}</p>
        <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
          Score calculation not available for this session.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="scoring-view">
      {/* Composite Score */}
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>COMPOSITE SCORE</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor(score.totalScore) }}>
          {score.totalScore}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>out of 1,000</div>
        {gameEndReason && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, fontStyle: 'italic' }}>
            {gameEndReason}
          </div>
        )}
      </div>

      {/* Dimension Breakdown */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Dimension Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Dimension</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Grade</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Score</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Weight</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Weighted</th>
            </tr>
          </thead>
          <tbody>
            {score.dimensions.map((dim: DimensionScore) => (
              <tr key={dim.dimension} data-testid={`dimension-row-${dim.dimension}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600, textTransform: 'capitalize' }}>{dim.dimension}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 28,
                    height: 28,
                    lineHeight: '28px',
                    borderRadius: '50%',
                    backgroundColor: gradeColor(dim.letterGrade) + '22',
                    color: gradeColor(dim.letterGrade),
                    fontWeight: 800,
                    fontSize: 13,
                  }}>
                    {dim.letterGrade}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{dim.rawScore.toFixed(1)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#888' }}>{(dim.weight * 100).toFixed(4)}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{dim.weightedScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── History View ────────────────────────────────────────────

const HistoryView: FC<{ currentTurn: number; playerFaction: string }> = ({ currentTurn, playerFaction }) => {
  const eventLog = useGameStore((s) => s.eventLog);
  const recent = eventLog.slice(-50).reverse();

  return (
    <div data-testid="history-view">
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Event Timeline (Turn {currentTurn})
        </h3>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
          Faction: {playerFaction} — Showing last 50 events
        </div>
        {recent.length === 0 ? (
          <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 20 }}>
            No events recorded yet. Play a few turns to see the timeline.
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {recent.map((evt, i) => (
              <div
                key={`evt-${i}`}
                data-testid={`history-event-${i}`}
                style={{
                  padding: '6px 8px',
                  marginBottom: 2,
                  borderLeft: '2px solid #333',
                  backgroundColor: i % 2 === 0 ? '#0a0a0a' : 'transparent',
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#888' }}>T{(evt as any).turn ?? '?'}</span>
                {' — '}
                <span>{(evt as any).description ?? JSON.stringify(evt).substring(0, 80)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Export View ─────────────────────────────────────────────

const ExportView: FC<{ isGameOver: boolean }> = ({ isGameOver }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback((format: 'json' | 'csv' | 'html') => {
    setExporting(true);
    try {
      const state = useGameStore.getState();
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify({
          scenarioMeta: state.scenarioMeta,
          currentTurn: state.currentTurn,
          playerFaction: state.playerFaction,
          nationStates: state.nationStates,
          marketState: state.marketState,
          eventLog: state.eventLog,
          gameOver: state.gameOver,
          gameEndReason: state.gameEndReason,
          exportedAt: new Date().toISOString(),
        }, null, 2);
        filename = `neworder-scenario-${state.scenarioMeta.id || 'export'}.json`;
        mimeType = 'application/json';
      } else if (format === 'csv') {
        const rows = ['turn,faction,stability,treasury,gdp,inflation,militaryReadiness,popularity'];
        const ns = state.nationStates;
        for (const [fid, nation] of Object.entries(ns)) {
          if (nation) {
            rows.push(`${state.currentTurn},${fid},${nation.stability},${nation.treasury},${nation.gdp},${nation.inflation},${nation.militaryReadiness},${nation.popularity}`);
          }
        }
        content = rows.join('\n');
        filename = `neworder-scenario-${state.scenarioMeta.id || 'export'}.csv`;
        mimeType = 'text/csv';
      } else {
        content = `<!DOCTYPE html>
<html><head><title>New Order — Scenario Report</title>
<style>body{font-family:system-ui;background:#0a0a12;color:#e0e0e0;padding:20px}
table{border-collapse:collapse;width:100%}th,td{padding:6px 10px;border:1px solid #333;text-align:left}
th{background:#1a1a1a}.card{background:#111;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:16px}</style></head>
<body><h1>⚔️ New Order — Scenario Report</h1>
<div class="card"><h2>Scenario: ${state.scenarioMeta.name || 'N/A'}</h2>
<p>Turn: ${state.currentTurn} | Faction: ${state.playerFaction} | ${state.gameOver ? 'COMPLETED' : 'IN PROGRESS'}</p>
${state.gameEndReason ? `<p><strong>${state.gameEndReason}</strong></p>` : ''}
</div>
<div class="card"><h2>Nation States</h2>
<table><tr><th>Faction</th><th>Stability</th><th>Treasury</th><th>GDP</th><th>Inflation</th><th>Military</th><th>Popularity</th></tr>
${Object.entries(state.nationStates).map(([fid, n]) => n ? `<tr><td>${fid}</td><td>${n.stability}</td><td>$${n.treasury}B</td><td>$${n.gdp}B</td><td>${n.inflation.toFixed(4)}%</td><td>${n.militaryReadiness}</td><td>${n.popularity}</td></tr>` : '').join('')}
</table></div>
<p style="color:#555;font-size:12px">Exported: ${new Date().toISOString()}</p>
</body></html>`;
        filename = `neworder-scenario-${state.scenarioMeta.id || 'export'}.html`;
        mimeType = 'text/html';
      }

      // Trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div data-testid="export-view">
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Download Scenario Archive</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          Export the complete scenario data including nation states, market data, event history, and scores.
          {!isGameOver && ' Note: The scenario is still in progress — scores will only be available at game end.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton label="📄 JSON" format="json" onExport={handleExport} disabled={exporting} />
          <ExportButton label="📊 CSV" format="csv" onExport={handleExport} disabled={exporting} />
          <ExportButton label="🌐 HTML Report" format="html" onExport={handleExport} disabled={exporting} />
        </div>
      </div>
    </div>
  );
};

const ExportButton: FC<{
  label: string;
  format: 'json' | 'csv' | 'html';
  onExport: (format: 'json' | 'csv' | 'html') => void;
  disabled: boolean;
}> = ({ label, format, onExport, disabled }) => (
  <button
    data-testid={`export-btn-${format}`}
    onClick={() => onExport(format)}
    disabled={disabled}
    style={{
      padding: '8px 16px',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: 4,
      color: disabled ? '#555' : '#e0e0e0',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'inherit',
    }}
  >
    {label}
  </button>
);

export default ScenarioPanel;
