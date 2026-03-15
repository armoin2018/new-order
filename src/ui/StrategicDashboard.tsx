import { useState } from 'react';
import type { FC, CSSProperties } from 'react';
import {
  ViabilityLabel,
  TrendDirection,
  ConfidenceLevel,
} from '@/data/types';
import type { VictoryPathViability } from '@/data/types';

// ── Types exported from this module ─────────────────────────────────────────

export interface LossConditionDisplayData {
  lossConditionId: string;
  label: string;
  threatLevel: number; // 0-100, higher = more dangerous
  urgency: 'watch' | 'warning' | 'critical';
  turnsUntilTrigger: number | null;
}

export interface RecommendedActionDisplayData {
  actionId: string;
  label: string;
  description: string;
  viabilityImpact: number; // expected change to viability
  cost: string;
  risk: 'low' | 'medium' | 'high';
  targetPath: string;
}

export interface RivalLeaderboardEntry {
  factionId: string;
  factionName: string;
  closestVictory: string;
  turnsEstimate: number | null;
  confidence: ConfidenceLevel;
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface StrategicDashboardProps {
  victoryPaths: VictoryPathViability[];
  lossConditions: LossConditionDisplayData[];
  recommendedActions: RecommendedActionDisplayData[];
  rivals: RivalLeaderboardEntry[];
  strategyScore: number | null;
  onSimulateAction?: (actionId: string) => void;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface SectionState {
  victoryPaths: boolean;
  lossConditions: boolean;
  recommendedActions: boolean;
  rivalLeaderboard: boolean;
}

const VIABILITY_COLORS: Record<ViabilityLabel, string> = {
  [ViabilityLabel.Foreclosed]: '#555',
  [ViabilityLabel.Difficult]: '#ff4a4a',
  [ViabilityLabel.Viable]: '#ffaa00',
  [ViabilityLabel.Favorable]: '#4aff4a',
  [ViabilityLabel.Imminent]: '#4a9eff',
};

const TREND_ARROWS: Record<TrendDirection, string> = {
  [TrendDirection.RisingFast]: '↑',
  [TrendDirection.Rising]: '↗',
  [TrendDirection.Stable]: '→',
  [TrendDirection.Falling]: '↘',
  [TrendDirection.FallingFast]: '↓',
};

const URGENCY_COLORS: Record<LossConditionDisplayData['urgency'], string> = {
  watch: '#ffaa00',
  warning: '#ff6600',
  critical: '#ff0000',
};

const RISK_COLORS: Record<RecommendedActionDisplayData['risk'], string> = {
  low: '#4aff4a',
  medium: '#ffaa00',
  high: '#ff4a4a',
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.High]: '#4aff4a',
  [ConfidenceLevel.Medium]: '#ffaa00',
  [ConfidenceLevel.Low]: '#ff4a4a',
};

function formatConditionId(id: string): string {
  return id
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function strategyScoreColor(score: number): string {
  if (score >= 75) return '#4aff4a';
  if (score >= 50) return '#a8e04a';
  if (score >= 25) return '#ffaa00';
  return '#ff4a4a';
}

// ── Inline styles ───────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  overflowY: 'auto',
  padding: '40px 16px',
};

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: 900,
  background: '#111',
  border: '1px solid #333',
  borderRadius: 8,
  padding: '24px 28px',
  position: 'relative',
  color: '#e0e0e0',
  fontFamily: 'monospace',
};

const closeBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 16,
  background: 'none',
  border: 'none',
  color: '#e0e0e0',
  fontSize: 22,
  cursor: 'pointer',
  lineHeight: 1,
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  padding: '10px 0',
  borderBottom: '1px solid #333',
  userSelect: 'none',
};

const toggleBtnStyle: CSSProperties = {
  background: 'none',
  border: '1px solid #555',
  color: '#e0e0e0',
  borderRadius: 4,
  padding: '2px 10px',
  cursor: 'pointer',
  fontSize: 12,
};

const gaugeTrackStyle: CSSProperties = {
  width: '100%',
  height: 14,
  background: '#222',
  borderRadius: 7,
  overflow: 'hidden',
};

const cardStyle: CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  padding: '12px 14px',
  marginBottom: 8,
};

const badgeBase: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const simulateBtnStyle: CSSProperties = {
  background: '#333',
  border: '1px solid #555',
  color: '#e0e0e0',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
  marginTop: 6,
};

// ── Component ───────────────────────────────────────────────────────────────

export const StrategicDashboard: FC<StrategicDashboardProps> = ({
  victoryPaths,
  lossConditions,
  recommendedActions,
  rivals,
  strategyScore,
  onSimulateAction,
  onClose,
}) => {
  const [sections, setSections] = useState<SectionState>({
    victoryPaths: true,
    lossConditions: true,
    recommendedActions: true,
    rivalLeaderboard: true,
  });

  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});

  const toggle = (key: keyof SectionState) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAction = (actionId: string) => {
    setExpandedActions((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  const sortedRivals = [...rivals].sort((a, b) => {
    if (a.turnsEstimate === null && b.turnsEstimate === null) return 0;
    if (a.turnsEstimate === null) return 1;
    if (b.turnsEstimate === null) return -1;
    return a.turnsEstimate - b.turnsEstimate;
  });

  return (
    <div style={overlayStyle} role="dialog" aria-label="Strategic Dashboard">
      <div style={panelStyle}>
        {/* Close button */}
        <button style={closeBtnStyle} onClick={onClose} aria-label="Close dashboard">
          ✕
        </button>

        {/* Title + Strategy Score */}
        <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#e0e0e0' }}>
          Strategic Dashboard
        </h2>

        {strategyScore !== null ? (
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: strategyScoreColor(strategyScore),
              marginBottom: 20,
            }}
          >
            Strategic Rating: {strategyScore}/100
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#777', marginBottom: 20 }}>
            Strategic Rating: —
          </div>
        )}

        {/* ── Section 1: Victory Path Gauges ──────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={sectionHeaderStyle}
            onClick={() => { toggle('victoryPaths'); }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Victory Path Gauges</span>
            <button style={toggleBtnStyle} type="button">
              {sections.victoryPaths ? '▼' : '▶'}
            </button>
          </div>

          {sections.victoryPaths && (
            <div style={{ padding: '10px 0' }}>
              {victoryPaths.map((vp) => {
                const color = VIABILITY_COLORS[vp.label] ?? '#555';
                const arrow = TREND_ARROWS[vp.trend] ?? '→';
                return (
                  <div key={vp.victoryConditionId} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {formatConditionId(vp.victoryConditionId)}
                      </span>
                      <span>
                        <span
                          style={{
                            ...badgeBase,
                            background: color,
                            color: '#000',
                            marginRight: 6,
                          }}
                        >
                          {vp.label}
                        </span>
                        <span style={{ marginRight: 6 }} title={`Trend: ${vp.trend}`}>
                          {arrow}
                        </span>
                        <span style={{ color: '#aaa', fontSize: 12 }}>
                          {vp.turnsToVictoryEstimate !== null
                            ? `~${String(vp.turnsToVictoryEstimate)} turns`
                            : '—'}
                        </span>
                      </span>
                    </div>

                    <div style={gaugeTrackStyle}>
                      <div
                        style={{
                          width: `${Math.min(Math.max(vp.viabilityScore, 0), 100)}%`,
                          height: '100%',
                          background: color,
                          borderRadius: 7,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      Score: {vp.viabilityScore}/100 · Confidence: {vp.confidence}
                    </div>
                  </div>
                );
              })}

              {victoryPaths.length === 0 && (
                <div style={{ color: '#666', fontSize: 13 }}>No victory paths available.</div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 2: Loss Condition Monitor ───────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={sectionHeaderStyle}
            onClick={() => { toggle('lossConditions'); }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Loss Condition Monitor</span>
            <button style={toggleBtnStyle} type="button">
              {sections.lossConditions ? '▼' : '▶'}
            </button>
          </div>

          {sections.lossConditions && (
            <div style={{ padding: '10px 0' }}>
              {lossConditions.map((lc) => {
                const urgencyColor = URGENCY_COLORS[lc.urgency] ?? '#ffaa00';
                return (
                  <div key={lc.lossConditionId} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{lc.label}</span>
                      <span>
                        <span
                          style={{
                            ...badgeBase,
                            background: urgencyColor,
                            color: '#000',
                            marginRight: 6,
                          }}
                        >
                          {lc.urgency}
                        </span>
                        <span style={{ color: '#aaa', fontSize: 12 }}>
                          {lc.turnsUntilTrigger !== null
                            ? `${String(lc.turnsUntilTrigger)} turns`
                            : '—'}
                        </span>
                      </span>
                    </div>

                    <div style={gaugeTrackStyle}>
                      <div
                        style={{
                          width: `${Math.min(Math.max(lc.threatLevel, 0), 100)}%`,
                          height: '100%',
                          background: urgencyColor,
                          borderRadius: 7,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      Threat Level: {lc.threatLevel}/100
                    </div>
                  </div>
                );
              })}

              {lossConditions.length === 0 && (
                <div style={{ color: '#666', fontSize: 13 }}>No active loss conditions.</div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 3: Recommended Actions ──────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={sectionHeaderStyle}
            onClick={() => { toggle('recommendedActions'); }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Recommended Actions</span>
            <button style={toggleBtnStyle} type="button">
              {sections.recommendedActions ? '▼' : '▶'}
            </button>
          </div>

          {sections.recommendedActions && (
            <div style={{ padding: '10px 0' }}>
              {recommendedActions.map((action) => {
                const isExpanded = expandedActions[action.actionId] === true;
                const riskColor = RISK_COLORS[action.risk] ?? '#ffaa00';
                const impactSign = action.viabilityImpact >= 0 ? '+' : '';
                const impactColor = action.viabilityImpact >= 0 ? '#4aff4a' : '#ff4a4a';

                return (
                  <div key={action.actionId} style={cardStyle}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => { toggleAction(action.actionId); }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {action.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 8, fontSize: 13 }}>
                        <p style={{ margin: '0 0 6px', color: '#ccc' }}>
                          {action.description}
                        </p>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: '#aaa' }}>
                            Cost: <strong style={{ color: '#e0e0e0' }}>{action.cost}</strong>
                          </span>

                          <span
                            style={{
                              ...badgeBase,
                              background: riskColor,
                              color: '#000',
                            }}
                          >
                            Risk: {action.risk}
                          </span>

                          <span style={{ color: impactColor, fontWeight: 700 }}>
                            {impactSign}{String(action.viabilityImpact)} viability
                          </span>

                          <span
                            style={{
                              ...badgeBase,
                              background: '#333',
                              color: '#aaa',
                              border: '1px solid #555',
                            }}
                          >
                            {action.targetPath}
                          </span>
                        </div>

                        {onSimulateAction && (
                          <button
                            style={simulateBtnStyle}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSimulateAction(action.actionId);
                            }}
                          >
                            Simulate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {recommendedActions.length === 0 && (
                <div style={{ color: '#666', fontSize: 13 }}>No recommended actions.</div>
              )}
            </div>
          )}
        </div>

        {/* ── Section 4: Rival Leaderboard ────────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={sectionHeaderStyle}
            onClick={() => { toggle('rivalLeaderboard'); }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Rival Leaderboard</span>
            <button style={toggleBtnStyle} type="button">
              {sections.rivalLeaderboard ? '▼' : '▶'}
            </button>
          </div>

          {sections.rivalLeaderboard && (
            <div style={{ padding: '10px 0', overflowX: 'auto' }}>
              {sortedRivals.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid #333',
                        textAlign: 'left',
                        color: '#999',
                      }}
                    >
                      <th style={{ padding: '6px 8px' }}>Faction</th>
                      <th style={{ padding: '6px 8px' }}>Closest Victory</th>
                      <th style={{ padding: '6px 8px' }}>Est. Turns</th>
                      <th style={{ padding: '6px 8px' }}>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRivals.map((rival) => {
                      const confColor = CONFIDENCE_COLORS[rival.confidence] ?? '#ffaa00';
                      return (
                        <tr
                          key={rival.factionId}
                          style={{ borderBottom: '1px solid #222' }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                            {rival.factionName}
                          </td>
                          <td style={{ padding: '6px 8px', color: '#ccc' }}>
                            {formatConditionId(rival.closestVictory)}
                          </td>
                          <td style={{ padding: '6px 8px', color: '#aaa' }}>
                            {rival.turnsEstimate !== null
                              ? `~${String(rival.turnsEstimate)}`
                              : '—'}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span
                              style={{
                                ...badgeBase,
                                background: confColor,
                                color: '#000',
                              }}
                            >
                              {rival.confidence}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#666', fontSize: 13 }}>No rival data available.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
