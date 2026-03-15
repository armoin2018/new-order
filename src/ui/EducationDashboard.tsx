/**
 * CNFL-3402 — Education Investment Management Dashboard
 *
 * Budget sliders for education sectors, projected literacy/quality timelines,
 * nation comparison, brain-drain indicator, and advisor recommendations.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EducationSector {
  sectorId: string;
  name: string;
  currentBudget: number;
  maxBudget: number;
  qualityIndex: number; // 0–100
  enrollmentRate: number; // 0–100
  impactDelay: number; // turns until effect
}

export interface EducationMetrics {
  literacyRate: number; // 0–100
  averageQuality: number; // 0–100
  stemIndex: number; // 0–100
  brainDrainRate: number; // 0–100 (high = bad)
  totalBudget: number;
  gdpPercent: number;
}

export interface NationEducationLevel {
  nationId: string;
  nationName: string;
  literacyRate: number;
  qualityIndex: number;
  stemIndex: number;
}

export interface AdvisorRecommendation {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProjectedEffect {
  turn: number;
  literacyRate: number;
  qualityIndex: number;
}

export interface EducationDashboardProps {
  sectors: EducationSector[];
  metrics: EducationMetrics;
  nationComparison: NationEducationLevel[];
  recommendations: AdvisorRecommendation[];
  projectedEffects: ProjectedEffect[];
  onBudgetChange?: (sectorId: string, newBudget: number) => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = { width: '100%', maxWidth: 1100, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 16, marginTop: 24 };
const card: CSSProperties = { backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 12 };
const metricCard: CSSProperties = { textAlign: 'center', padding: 16, backgroundColor: '#111', borderRadius: 8, border: '1px solid #333' };

function qualityColor(v: number): string {
  if (v >= 70) return '#4caf50';
  if (v >= 40) return '#ffaa00';
  return '#ff4a4a';
}

const priorityColor: Record<string, string> = { high: '#ff4a4a', medium: '#ffaa00', low: '#4a9eff' };

// ─── Component ──────────────────────────────────────────────────────────────

export const EducationDashboard: FC<EducationDashboardProps> = ({
  sectors,
  metrics,
  nationComparison,
  recommendations,
  projectedEffects,
  onBudgetChange,
}) => {
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const brainDrainSeverity = useMemo(() => {
    if (metrics.brainDrainRate >= 60) return { label: 'Critical', color: '#ff4a4a' };
    if (metrics.brainDrainRate >= 30) return { label: 'Moderate', color: '#ffaa00' };
    return { label: 'Low', color: '#4caf50' };
  }, [metrics.brainDrainRate]);

  return (
    <div style={panel} data-testid="education-dashboard">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🎓 Education Investment Dashboard
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Manage sector budgets, track projected outcomes, and compare education levels across nations.
      </p>

      {/* ── Top Metrics ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }} data-testid="metrics-row">
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, color: qualityColor(metrics.literacyRate) }}>{metrics.literacyRate}%</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Literacy</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, color: qualityColor(metrics.averageQuality) }}>{metrics.averageQuality}%</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Quality</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, color: qualityColor(metrics.stemIndex) }}>{metrics.stemIndex}%</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>STEM</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>${metrics.totalBudget}B</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Budget ({metrics.gdpPercent}% GDP)</div>
        </div>
        <div style={metricCard} data-testid="brain-drain">
          <div style={{ fontSize: 22, fontWeight: 800, color: brainDrainSeverity.color }}>{metrics.brainDrainRate}%</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Brain Drain ({brainDrainSeverity.label})</div>
        </div>
      </div>

      {/* ── Sector Budgets ────────────────────────────── */}
      <div style={sectionTitle}>Sector Budget Allocation</div>
      {sectors.map((s) => (
        <div key={s.sectorId} style={card} data-testid={`sector-${s.sectorId}`}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setExpandedSector(expandedSector === s.sectorId ? null : s.sectorId)}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
              <span style={{ marginLeft: 12, fontSize: 11, color: '#888' }}>Quality: <span style={{ color: qualityColor(s.qualityIndex) }}>{s.qualityIndex}%</span></span>
              <span style={{ marginLeft: 12, fontSize: 11, color: '#888' }}>Enrollment: {s.enrollmentRate}%</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700 }}>${s.currentBudget}B</span>
          </div>
          {expandedSector === s.sectorId && (
            <div style={{ marginTop: 12 }} data-testid={`sector-detail-${s.sectorId}`}>
              {onBudgetChange && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#888', minWidth: 30 }}>$0B</span>
                  <input
                    type="range"
                    min={0}
                    max={s.maxBudget}
                    value={s.currentBudget}
                    onChange={(e) => onBudgetChange(s.sectorId, Number(e.target.value))}
                    data-testid={`slider-${s.sectorId}`}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 11, color: '#888', minWidth: 40 }}>${s.maxBudget}B</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#888' }}>
                Effect delay: {s.impactDelay} turns
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Projected Effects ─────────────────────────── */}
      {projectedEffects.length > 0 && (
        <>
          <div style={sectionTitle}>Projected Outcomes</div>
          <div style={card} data-testid="projected-effects">
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0' }}>
              {projectedEffects.map((pe) => (
                <div key={pe.turn} data-testid={`proj-turn-${pe.turn}`} style={{ minWidth: 80, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Turn {pe.turn}</div>
                  <div style={{ fontSize: 12, color: qualityColor(pe.literacyRate), fontWeight: 600 }}>{pe.literacyRate}%</div>
                  <div style={{ fontSize: 9, color: '#666' }}>Literacy</div>
                  <div style={{ fontSize: 12, color: qualityColor(pe.qualityIndex), fontWeight: 600, marginTop: 4 }}>{pe.qualityIndex}%</div>
                  <div style={{ fontSize: 9, color: '#666' }}>Quality</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Advisor Recommendations ───────────────────── */}
      {recommendations.length > 0 && (
        <>
          <div style={sectionTitle}>Advisor Recommendations</div>
          <div style={card} data-testid="recommendations">
            {recommendations.map((r) => (
              <div key={r.id} data-testid={`rec-${r.id}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, backgroundColor: priorityColor[r.priority], color: '#000', textTransform: 'uppercase' }}>{r.priority}</span>
                <span style={{ fontSize: 12, color: '#ccc' }}>{r.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Nation Comparison ──────────────────────────── */}
      {nationComparison.length > 0 && (
        <>
          <div style={sectionTitle}>Nation Education Comparison</div>
          <div style={card} data-testid="nation-comparison">
            {nationComparison.map((n) => (
              <div key={n.nationId} data-testid={`nation-${n.nationId}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{n.nationName}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#888' }}>
                  <span>Literacy: <span style={{ color: qualityColor(n.literacyRate) }}>{n.literacyRate}%</span></span>
                  <span>Quality: <span style={{ color: qualityColor(n.qualityIndex) }}>{n.qualityIndex}%</span></span>
                  <span>STEM: <span style={{ color: qualityColor(n.stemIndex) }}>{n.stemIndex}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
