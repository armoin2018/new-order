/**
 * ScenarioPanel — FR-3600
 *
 * Combined view for scenario scoring (FR-3601), history (FR-3603),
 * and export (FR-3604). Shows scoring at game end, event timeline
 * during gameplay, and download buttons for JSON/CSV/HTML exports.
 */

import { useState, useCallback, useRef } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type { GameActions } from '@/engine/store';
import { MARCH_2026_SCENARIO } from '@/data/scenarios/march2026.scenario';
import type { ScenarioDefinition, FactionId } from '@/data/types';
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
  const [activeTab, setActiveTab] = useState<'scoring' | 'history' | 'export' | 'scenario-io'>('scoring');

  const tabLabels: Record<typeof activeTab, string> = {
    scoring: '📊 Scoring',
    history: '📜 History',
    export: '💾 Export',
    'scenario-io': '📦 Scenario I/O',
  };

  return (
    <div style={panelStyle} data-testid="scenario-panel">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🏆 Scenario Analytics</h2>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #222' }}>
        {(['scoring', 'history', 'export', 'scenario-io'] as const).map((tab) => (
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
            {tabLabels[tab]}
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
      {activeTab === 'scenario-io' && (
        <ScenarioIOView />
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

// ─── Scenario I/O View ───────────────────────────────────────

/** Build a ScenarioDefinition from the current game state for export. */
function buildScenarioFromState(): ScenarioDefinition {
  const s = useGameStore.getState();
  return {
    meta: { ...s.scenarioMeta },
    factions: Object.keys(s.nationStates) as FactionId[],
    relationshipMatrix: s.relationshipMatrix,
    nationStates: s.nationStates,
    geographicPostures: s.geographicPostures,
    nationFaultLines: s.nationFaultLines,
    mapConfig: MARCH_2026_SCENARIO.mapConfig,
    units: Object.values(s.unitRegistry),
    militaryForceStructures: s.militaryForceStructures,
    intelligenceCapabilities: s.intelligenceCapabilities,
    aiProfiles: MARCH_2026_SCENARIO.aiProfiles,
    cognitiveBiasDefinitions: s.cognitiveBiasRegistry?.definitions ?? MARCH_2026_SCENARIO.cognitiveBiasDefinitions,
    interpersonalChemistry: s.interpersonalChemistry ?? MARCH_2026_SCENARIO.interpersonalChemistry,
    massPsychology: s.massPsychology ?? MARCH_2026_SCENARIO.massPsychology,
    mediaEcosystems: MARCH_2026_SCENARIO.mediaEcosystems,
    technologyIndices: s.technologyIndices ?? MARCH_2026_SCENARIO.technologyIndices,
    techBlocInfo: s.techBlocAlignmentMap?.nations ?? MARCH_2026_SCENARIO.techBlocInfo,
    resourceSecurity: s.resourceSecurity ?? MARCH_2026_SCENARIO.resourceSecurity,
    climateEvents: s.climateEventQueue?.upcoming ?? MARCH_2026_SCENARIO.climateEvents,
    nonStateActors: MARCH_2026_SCENARIO.nonStateActors,
    proxyRelationships: MARCH_2026_SCENARIO.proxyRelationships,
    flashpoints: MARCH_2026_SCENARIO.flashpoints,
    victoryConditions: MARCH_2026_SCENARIO.victoryConditions,
    lossConditions: MARCH_2026_SCENARIO.lossConditions,
    eventTimeline: MARCH_2026_SCENARIO.eventTimeline,
  };
}

/** Minimal validation that a parsed object looks like a ScenarioDefinition. */
function isValidScenario(obj: unknown): obj is ScenarioDefinition {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (!o.meta || typeof o.meta !== 'object') return false;
  const meta = o.meta as Record<string, unknown>;
  if (typeof meta.id !== 'string' || typeof meta.name !== 'string') return false;
  if (!o.factions || !Array.isArray(o.factions) || o.factions.length === 0) return false;
  if (!o.nationStates || typeof o.nationStates !== 'object') return false;
  if (!o.relationshipMatrix || typeof o.relationshipMatrix !== 'object') return false;
  return true;
}

const ScenarioIOView: FC = () => {
  const currentTurn = useGameStore((s) => s.currentTurn) as number;
  const scenarioMeta = useGameStore((s) => s.scenarioMeta);
  const initializeFromScenario: GameActions['initializeFromScenario'] = useGameStore((s) => s.initializeFromScenario);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewData, setPreviewData] = useState<ScenarioDefinition | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<FactionId | null>(null);

  // ── Export current scenario ────────────────────────────────
  const handleExportScenario = useCallback(() => {
    try {
      const scenario = buildScenarioFromState();
      const content = JSON.stringify(scenario, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scenario-${scenario.meta.id || 'custom'}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — UI only
    }
  }, []);

  // ── Import: read file ──────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus(null);
    setPreviewData(null);
    setSelectedFaction(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportStatus({ type: 'error', message: 'Please select a .json file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!isValidScenario(parsed)) {
          setImportStatus({ type: 'error', message: 'Invalid scenario file — missing required fields (meta, factions, nationStates, relationshipMatrix).' });
          return;
        }
        setPreviewData(parsed);
        setImportStatus({ type: 'success', message: `Loaded "${parsed.meta.name}" — ${parsed.factions.length} factions, ${parsed.meta.maxTurns} max turns.` });
      } catch {
        setImportStatus({ type: 'error', message: 'Failed to parse JSON file. Please check the file format.' });
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);
  }, []);

  // ── Import: start simulation ───────────────────────────────
  const handleStartFromImport = useCallback(() => {
    if (!previewData || !selectedFaction) return;
    initializeFromScenario(previewData, selectedFaction);
  }, [previewData, selectedFaction, initializeFromScenario]);

  const handleClearImport = useCallback(() => {
    setPreviewData(null);
    setImportStatus(null);
    setSelectedFaction(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div data-testid="scenario-io-view">
      {/* ── Export Section ───────────────────────────────────── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📤 Export Scenario Definition</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
          Export the current world state as a reusable scenario definition (JSON).
          This captures nation states, relationships, military structures, technology,
          and all other parameters — ready to be imported and replayed.
        </p>
        {currentTurn > 0 && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 10, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 4, border: '1px solid rgba(245,158,11,0.2)' }}>
            ⚠️ Exporting at turn {currentTurn} — the scenario will reflect the <strong>current</strong> world state, not the original starting conditions.
          </div>
        )}
        <button
          data-testid="export-scenario-btn"
          onClick={handleExportScenario}
          style={{
            padding: '8px 20px',
            backgroundColor: 'rgba(76,175,80,0.1)',
            border: '1px solid #4caf50',
            borderRadius: 4,
            color: '#4caf50',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          📤 Export Scenario as JSON
        </button>
        {scenarioMeta?.id && (
          <div style={{ fontSize: 10, color: '#555', marginTop: 8 }}>
            Current: {scenarioMeta.name} (v{scenarioMeta.version})
          </div>
        )}
      </div>

      {/* ── Import Section ───────────────────────────────────── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📥 Import Scenario Definition</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
          Load a previously exported scenario JSON file to start a new simulation.
          Choose your faction after importing, then launch.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          data-testid="import-file-input"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            data-testid="import-browse-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 20px',
              backgroundColor: 'rgba(33,150,243,0.1)',
              border: '1px solid #2196f3',
              borderRadius: 4,
              color: '#2196f3',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            📁 Browse for Scenario File
          </button>
          {previewData && (
            <button
              data-testid="import-clear-btn"
              onClick={handleClearImport}
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#888',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'inherit',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Status Message */}
        {importStatus && (
          <div
            data-testid="import-status"
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 4,
              fontSize: 12,
              color: importStatus.type === 'error' ? '#ef9a9a' : '#81c784',
              background: importStatus.type === 'error' ? 'rgba(244,67,54,0.08)' : 'rgba(76,175,80,0.08)',
              border: `1px solid ${importStatus.type === 'error' ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.3)'}`,
            }}
          >
            {importStatus.type === 'error' ? '❌' : '✅'} {importStatus.message}
          </div>
        )}

        {/* Preview + Faction Select */}
        {previewData && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 4,
              border: '1px solid #222',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{previewData.meta.name}</div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                <span>v{previewData.meta.version}</span>
                {' · '}
                <span>{previewData.meta.author}</span>
                {' · '}
                <span>{previewData.meta.maxTurns} turns</span>
              </div>
              {previewData.meta.description && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>
                  {previewData.meta.description}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Select Faction:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {previewData.factions.map((fid) => {
                const isActive = selectedFaction === fid;
                return (
                  <button
                    key={fid}
                    data-testid={`import-faction-${fid}`}
                    onClick={() => setSelectedFaction(fid)}
                    style={{
                      padding: '6px 14px',
                      background: isActive ? 'rgba(76,175,80,0.15)' : '#111',
                      border: isActive ? '1px solid #4caf50' : '1px solid #333',
                      borderRadius: 4,
                      color: isActive ? '#4caf50' : '#aaa',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 400,
                      fontFamily: 'inherit',
                      textTransform: 'capitalize',
                    }}
                  >
                    {fid}
                  </button>
                );
              })}
            </div>

            <button
              data-testid="import-start-btn"
              onClick={handleStartFromImport}
              disabled={!selectedFaction}
              style={{
                marginTop: 14,
                padding: '10px 28px',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                border: selectedFaction ? '2px solid #4caf50' : '1px solid #333',
                borderRadius: 5,
                background: selectedFaction ? 'rgba(76,175,80,0.1)' : '#1a1a1a',
                color: selectedFaction ? '#4caf50' : '#555',
                cursor: selectedFaction ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              🚀 Begin Simulation from Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioPanel;
