/**
 * CNFL-3904 — Scenario Automation Dashboard
 *
 * Configure, launch, monitor, and analyze automated scenario runs.
 * Features: scenario selection, configuration form, run/batch buttons,
 * active jobs progress, completed runs results, multi-run comparison,
 * and results export.
 */

import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExecutionMode = 'autonomous' | 'manual';
export type ExecutionSpeed = 'instant' | 'accelerated' | 'realtime';
export type AIStrategy = 'rule-based' | 'random' | 'passive' | 'deep-ai';

export interface ScenarioOption {
  id: string;
  name: string;
  description?: string;
  maxTurns: number;
}

export interface RunConfig {
  scenarioId: string;
  maxTurns: number;
  mode: ExecutionMode;
  speed: ExecutionSpeed;
  aiStrategy: AIStrategy;
  difficulty: number;
  seed: number | null;
  /** For batch runs: number of runs with sequential seeds. */
  batchCount: number;
}

export interface ActiveJob {
  id: string;
  scenarioName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentTurn: number;
  totalTurns: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
}

export interface CompletedRun {
  id: string;
  scenarioName: string;
  turnsPlayed: number;
  winner: string | null;
  elapsedMs: number;
  seed: number | null;
  completedAt: number;
  grade: string;
}

export interface AutomationDashboardProps {
  scenarios: ScenarioOption[];
  activeJobs?: ActiveJob[];
  completedRuns?: CompletedRun[];
  onRunScenario?: (config: RunConfig) => void;
  onCancelJob?: (jobId: string) => void;
  onViewResults?: (runId: string) => void;
  onCompareRuns?: (runIds: string[]) => void;
  onExportResults?: (runId: string, format: 'json' | 'csv') => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const root: CSSProperties = { width: '100%', maxWidth: 1200, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionBox: CSSProperties = { border: '1px solid #222', borderRadius: 8, padding: 20, marginBottom: 20, background: '#0d0d0d' };
const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 16 };
const formGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const fieldGroup: CSSProperties = { marginBottom: 12 };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' };
const inputStyle: CSSProperties = { width: '100%', padding: '8px 12px', backgroundColor: '#111', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const selectStyle: CSSProperties = { ...inputStyle, appearance: 'none' as const };
const btnPrimary: CSSProperties = { padding: '10px 24px', background: '#1976d2', border: 'none', borderRadius: 4, color: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 };
const btnSecondary: CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: 4, color: '#ccc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' };
const btnDanger: CSSProperties = { ...btnSecondary, borderColor: '#c62828', color: '#ef5350' };
const btnGroup: CSSProperties = { display: 'flex', gap: 8, marginTop: 16 };
const progressOuter: CSSProperties = { width: '100%', height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' };
const progressFill: CSSProperties = { height: '100%', borderRadius: 4, transition: 'width 0.3s' };
const jobRow: CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 3fr 1fr', gap: 12, padding: '12px 0', borderBottom: '1px solid #1a1a1a', alignItems: 'center', fontSize: 13 };
const runRow: CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '10px 0', borderBottom: '1px solid #1a1a1a', alignItems: 'center', fontSize: 13 };
const statusBadge = (status: string): CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600,
  background: status === 'running' ? '#0d47a1' : status === 'completed' ? '#1b5e20' : status === 'failed' ? '#b71c1c' : status === 'queued' ? '#333' : '#4e342e',
  color: status === 'running' ? '#90caf9' : status === 'completed' ? '#a5d6a7' : status === 'failed' ? '#ef9a9a' : status === 'queued' ? '#aaa' : '#bcaaa4',
});
const gradeBadge = (grade: string): CSSProperties => ({
  display: 'inline-block', width: 28, height: 28, borderRadius: '50%', textAlign: 'center', lineHeight: '28px', fontWeight: 700, fontSize: 13,
  background: grade === 'A' ? '#1b5e20' : grade === 'B' ? '#33691e' : grade === 'C' ? '#f57f17' : grade === 'D' ? '#e65100' : '#b71c1c',
  color: '#fff',
});
const checkboxLabel: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#aaa', cursor: 'pointer' };
const emptyMsg: CSSProperties = { color: '#666', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: 16 };

// ─── Component ──────────────────────────────────────────────────────────────

export const AutomationDashboard: FC<AutomationDashboardProps> = ({
  scenarios,
  activeJobs = [],
  completedRuns = [],
  onRunScenario,
  onCancelJob,
  onViewResults,
  onCompareRuns,
  onExportResults,
}) => {
  // Config state
  const [selectedScenario, setSelectedScenario] = useState<string>(scenarios[0]?.id ?? '');
  const [maxTurns, setMaxTurns] = useState(60);
  const [mode, setMode] = useState<ExecutionMode>('autonomous');
  const [speed, setSpeed] = useState<ExecutionSpeed>('instant');
  const [aiStrategy, setAiStrategy] = useState<AIStrategy>('rule-based');
  const [difficulty, setDifficulty] = useState(1);
  const [seed, setSeed] = useState<string>('');
  const [batchCount, setBatchCount] = useState(1);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());

  const scenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenario),
    [scenarios, selectedScenario],
  );

  const handleRun = useCallback(() => {
    if (!onRunScenario || !selectedScenario) return;
    onRunScenario({
      scenarioId: selectedScenario,
      maxTurns,
      mode,
      speed,
      aiStrategy,
      difficulty,
      seed: seed ? parseInt(seed, 10) : null,
      batchCount,
    });
  }, [onRunScenario, selectedScenario, maxTurns, mode, speed, aiStrategy, difficulty, seed, batchCount]);

  const toggleRunSelection = useCallback((id: string) => {
    setSelectedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (onCompareRuns && selectedRuns.size >= 2) {
      onCompareRuns(Array.from(selectedRuns));
    }
  }, [onCompareRuns, selectedRuns]);

  const formatMs = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  return (
    <div data-testid="automation-dashboard" style={root}>
      <h2 style={{ fontSize: 22, color: '#fff', marginBottom: 20 }}>Scenario Automation</h2>

      {/* Configuration Section */}
      <div data-testid="config-section" style={sectionBox}>
        <div style={sectionTitle}>Run Configuration</div>
        <div style={formGrid}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Scenario</label>
            <select data-testid="scenario-select" style={selectStyle} value={selectedScenario} onChange={(e) => { setSelectedScenario(e.target.value); const s = scenarios.find((sc) => sc.id === e.target.value); if (s) setMaxTurns(s.maxTurns); }}>
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Max Turns</label>
            <input data-testid="turns-input" type="number" style={inputStyle} value={maxTurns} min={1} max={999} onChange={(e) => setMaxTurns(Number(e.target.value))} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Mode</label>
            <select data-testid="mode-select" style={selectStyle} value={mode} onChange={(e) => setMode(e.target.value as ExecutionMode)}>
              <option value="autonomous">Autonomous (All AI)</option>
              <option value="manual">Manual (Step-by-Step)</option>
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Speed</label>
            <select data-testid="speed-select" style={selectStyle} value={speed} onChange={(e) => setSpeed(e.target.value as ExecutionSpeed)}>
              <option value="instant">Instant</option>
              <option value="accelerated">Accelerated (50ms/turn)</option>
              <option value="realtime">Real-time (1s/turn)</option>
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>AI Strategy</label>
            <select data-testid="strategy-select" style={selectStyle} value={aiStrategy} onChange={(e) => setAiStrategy(e.target.value as AIStrategy)}>
              <option value="rule-based">Rule-Based (Utility Evaluator)</option>
              <option value="deep-ai">Deep AI Strategy (Multi-Stage Analysis)</option>
              <option value="random">Random</option>
              <option value="passive">Passive</option>
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Difficulty (0.5 – 2.0)</label>
            <input data-testid="difficulty-input" type="number" style={inputStyle} value={difficulty} min={0.5} max={2} step={0.1} onChange={(e) => setDifficulty(Number(e.target.value))} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Seed (optional)</label>
            <input data-testid="seed-input" type="text" style={inputStyle} placeholder="Random" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Batch Count</label>
            <input data-testid="batch-input" type="number" style={inputStyle} value={batchCount} min={1} max={100} onChange={(e) => setBatchCount(Number(e.target.value))} />
          </div>
        </div>

        {scenario && (
          <p data-testid="scenario-desc" style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
            {scenario.description ?? `${scenario.name} — ${scenario.maxTurns} turns`}
          </p>
        )}

        <div style={btnGroup}>
          <button data-testid="run-btn" style={btnPrimary} onClick={handleRun} disabled={!selectedScenario}>
            {batchCount > 1 ? `Run ${batchCount} Simulations` : 'Run Scenario'}
          </button>
        </div>
      </div>

      {/* Active Jobs Section */}
      <div data-testid="active-jobs" style={sectionBox}>
        <div style={sectionTitle}>Active Jobs ({activeJobs.length})</div>
        {activeJobs.length === 0 ? (
          <p style={emptyMsg}>No active jobs</p>
        ) : (
          <>
            <div style={{ ...jobRow, fontWeight: 600, color: '#888', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
              <span>Scenario</span><span>Status</span><span>Progress</span><span>Actions</span>
            </div>
            {activeJobs.map((job) => (
              <div key={job.id} data-testid={`job-${job.id}`} style={jobRow}>
                <span style={{ color: '#fff' }}>{job.scenarioName}</span>
                <span style={statusBadge(job.status)}>{job.status}</span>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                    <span>Turn {job.currentTurn}/{job.totalTurns}</span>
                    <span>{job.percentComplete}%</span>
                  </div>
                  <div style={progressOuter}>
                    <div style={{ ...progressFill, width: `${job.percentComplete}%`, background: job.status === 'running' ? '#4fc3f7' : '#333' }} />
                  </div>
                  {job.estimatedRemainingMs !== null && (
                    <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>ETA: {formatMs(job.estimatedRemainingMs)}</div>
                  )}
                </div>
                <div>
                  {(job.status === 'queued' || job.status === 'running') && onCancelJob && (
                    <button data-testid={`cancel-${job.id}`} style={btnDanger} onClick={() => onCancelJob(job.id)}>Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Completed Runs Section */}
      <div data-testid="completed-runs" style={sectionBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={sectionTitle}>Completed Runs ({completedRuns.length})</div>
          {selectedRuns.size >= 2 && onCompareRuns && (
            <button data-testid="compare-btn" style={btnSecondary} onClick={handleCompare}>
              Compare {selectedRuns.size} Runs
            </button>
          )}
        </div>
        {completedRuns.length === 0 ? (
          <p style={emptyMsg}>No completed runs yet</p>
        ) : (
          <>
            <div style={{ ...runRow, fontWeight: 600, color: '#888', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
              <span>Scenario</span><span>Turns</span><span>Winner</span><span>Time</span><span>Grade</span><span>Actions</span>
            </div>
            {completedRuns.map((run) => (
              <div key={run.id} data-testid={`run-${run.id}`} style={runRow}>
                <label style={checkboxLabel}>
                  <input type="checkbox" checked={selectedRuns.has(run.id)} onChange={() => toggleRunSelection(run.id)} />
                  {run.scenarioName}
                </label>
                <span style={{ color: '#aaa' }}>{run.turnsPlayed}</span>
                <span style={{ color: run.winner ? '#4caf50' : '#888' }}>{run.winner ?? 'N/A'}</span>
                <span style={{ color: '#aaa' }}>{formatMs(run.elapsedMs)}</span>
                <span style={gradeBadge(run.grade)}>{run.grade}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {onViewResults && <button data-testid={`view-${run.id}`} style={btnSecondary} onClick={() => onViewResults(run.id)}>View</button>}
                  {onExportResults && <button data-testid={`export-${run.id}`} style={btnSecondary} onClick={() => onExportResults(run.id, 'json')}>Export</button>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
