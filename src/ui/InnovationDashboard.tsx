/**
 * FR-5100 — Innovation Research & Discovery Dashboard
 *
 * Displays the full innovation research tree, per-nation progress,
 * category-filtered grid, discovery log, and research summary stats.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';
import type {
  InnovationState,
  InnovationCategory,
  InnovationModel,
  InnovationResearchState,
} from '@/data/types/innovation.types';
import { innovationConfig } from '@/engine/config/innovation';
import { getInnovationsByCategory, getResearchSummary } from '@/engine/innovation-engine';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface InnovationDashboardProps {
  innovationState: InnovationState | null;
  playerNationId: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_CATEGORIES: InnovationCategory[] = [
  'space',
  'quantum',
  'biotech',
  'ai_computing',
  'materials',
  'energy',
  'military',
  'human_enhancement',
  'virtual_digital',
];

const TIER_STARS: Record<number, string> = {
  1: '★',
  2: '★★',
  3: '★★★',
  4: '★★★★',
  5: '★★★★★',
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  width: '100%',
  maxWidth: 1100,
  margin: '0 auto',
  padding: 24,
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  background: '#0a0a0a',
};

const sectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: '#888',
  borderBottom: '1px solid #333',
  paddingBottom: 8,
  marginBottom: 16,
  marginTop: 24,
};

const metricCard: CSSProperties = {
  textAlign: 'center',
  padding: 16,
  backgroundColor: '#111',
  borderRadius: 8,
  border: '1px solid #333',
};

const card: CSSProperties = {
  backgroundColor: '#111',
  border: '1px solid #333',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

const emptyContainer: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 320,
  color: '#888',
  fontSize: 18,
  fontWeight: 600,
  background: '#0a0a0a',
};

const tabRow: CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
  paddingBottom: 8,
  marginBottom: 16,
};

const gridContainer: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))',
  gap: 12,
};

const logContainer: CSSProperties = {
  maxHeight: 280,
  overflowY: 'auto',
  padding: '4px 0',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function progressColor(v: number): string {
  if (v >= 80) return '#4caf50';
  if (v >= 40) return '#ffaa00';
  return '#ff4a4a';
}

function tabStyle(active: boolean, color: string): CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    border: active ? `1px solid ${color}` : '1px solid #333',
    backgroundColor: active ? `${color}22` : '#0f0f0f',
    color: active ? color : '#888',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  };
}

function progressBarStyle(): CSSProperties {
  return {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#222',
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative' as const,
  };
}

function progressFillStyle(pct: number, color: string): CSSProperties {
  return {
    height: '100%',
    width: `${Math.min(100, Math.max(0, pct))}%`,
    backgroundColor: color,
    borderRadius: 3,
    transition: 'width 0.3s ease',
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const InnovationDashboard: FC<InnovationDashboardProps> = ({
  innovationState,
  playerNationId,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<InnovationCategory | 'all'>('all');

  // ── Empty state ──────────────────────────────────
  if (!innovationState) {
    return (
      <div style={emptyContainer} data-testid="innovation-dashboard-empty">
        🔬 Innovation System — Available after game starts
      </div>
    );
  }

  const { innovations, nationResearch, discoveryLog } = innovationState;

  // ── Player research lookup ───────────────────────
  const playerResearch = nationResearch[playerNationId] ?? {};

  // ── Research summary ─────────────────────────────
  const summary = useMemo(
    () => getResearchSummary(playerResearch),
    [playerResearch],
  );

  // ── Overall progress % ──────────────────────────
  const totalInnovations = Object.keys(innovations).length;
  const overallProgress = totalInnovations > 0
    ? Math.round((summary.discovered / totalInnovations) * 100)
    : 0;

  // ── Filtered innovations ─────────────────────────
  const filteredInnovations: InnovationModel[] = useMemo(() => {
    if (selectedCategory === 'all') return Object.values(innovations);
    return getInnovationsByCategory(innovations, selectedCategory);
  }, [innovations, selectedCategory]);

  // ── Recent discoveries (last 10) ────────────────
  const recentDiscoveries = useMemo(
    () => [...discoveryLog].reverse().slice(0, 10),
    [discoveryLog],
  );

  // ── Per-nation research summaries ────────────────
  const nationSummaries = useMemo(() => {
    return Object.entries(nationResearch).map(([nationId, researchMap]) => ({
      nationId,
      ...getResearchSummary(researchMap),
    }));
  }, [nationResearch]);

  // ── Render ───────────────────────────────────────
  return (
    <div style={panel} data-testid="innovation-dashboard">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🔬 Innovation Research &amp; Discovery
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Explore research domains, track progress, and review breakthrough discoveries.
      </p>

      {/* ── Top Stats Bar ─────────────────────────────── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}
        data-testid="stats-bar"
      >
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#e0e0e0' }}>
            {totalInnovations}
          </div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Total Innovations</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#ffaa00' }}>
            {summary.inProgress}
          </div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Active Research</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: '#4caf50' }}>
            {summary.discovered}
          </div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Discovered</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: progressColor(overallProgress) }}>
            {overallProgress}%
          </div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Overall Progress</div>
        </div>
      </div>

      {/* ── Category Filter Tabs ──────────────────────── */}
      <div style={sectionTitle}>Research Categories</div>
      <div style={tabRow} data-testid="category-tabs">
        <div
          style={tabStyle(selectedCategory === 'all', '#4caf50')}
          onClick={() => setSelectedCategory('all')}
          data-testid="tab-all"
        >
          🌍 All
        </div>
        {ALL_CATEGORIES.map((cat) => {
          const meta = innovationConfig.categories[cat];
          return (
            <div
              key={cat}
              style={tabStyle(selectedCategory === cat, meta.color)}
              onClick={() => setSelectedCategory(cat)}
              data-testid={`tab-${cat}`}
            >
              {meta.icon} {meta.label}
            </div>
          );
        })}
      </div>

      {/* ── Innovation Grid ───────────────────────────── */}
      <div style={gridContainer} data-testid="innovation-grid">
        {filteredInnovations.map((inn) => {
          const research: InnovationResearchState | undefined = playerResearch[inn.innovationId];
          const progress = research?.researchProgress ?? 0;
          const discovered = research?.discovered ?? false;
          const catMeta = innovationConfig.categories[inn.category];
          const depsMet = inn.dependencies.every((depId) => playerResearch[depId]?.discovered);

          return (
            <div
              key={inn.innovationId}
              style={{
                ...card,
                borderColor: discovered ? '#4caf50' : depsMet ? '#333' : '#222',
                opacity: depsMet || discovered ? 1 : 0.55,
              }}
              data-testid={`innovation-card-${inn.innovationId}`}
            >
              {/* Header: name + discovered status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, flex: 1 }}>
                  {inn.name}
                </div>
                <span style={{ fontSize: 16, marginLeft: 8, flexShrink: 0 }}>
                  {discovered ? '✅' : depsMet ? '🔓' : '🔒'}
                </span>
              </div>

              {/* Tier stars */}
              <div style={{ fontSize: 11, color: '#ffaa00', marginBottom: 4, letterSpacing: 1 }}>
                {TIER_STARS[inn.tier] ?? '★'}
                <span style={{ marginLeft: 6, color: '#666', fontSize: 10 }}>Tier {inn.tier}</span>
              </div>

              {/* Category badge */}
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: `${catMeta.color}33`,
                  color: catMeta.color,
                  border: `1px solid ${catMeta.color}44`,
                  marginBottom: 8,
                }}
              >
                {catMeta.icon} {catMeta.label}
              </span>

              {/* Description */}
              <div style={{ fontSize: 11, color: '#999', lineHeight: 1.45, marginBottom: 8, minHeight: 32 }}>
                {inn.description}
              </div>

              {/* Research progress bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 2 }}>
                <span>Research Progress</span>
                <span style={{ fontFamily: 'monospace', color: progressColor(progress) }}>
                  {progress}%
                </span>
              </div>
              <div style={progressBarStyle()}>
                <div style={progressFillStyle(progress, discovered ? '#4caf50' : catMeta.color)} />
              </div>

              {/* Dependencies */}
              {inn.dependencies.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                  <span style={{ fontWeight: 600, color: '#888' }}>Deps: </span>
                  {inn.dependencies.map((depId, i) => {
                    const depModel = innovations[depId];
                    const depDone = playerResearch[depId]?.discovered ?? false;
                    return (
                      <span key={depId}>
                        <span style={{ color: depDone ? '#4caf50' : '#ff4a4a' }}>
                          {depDone ? '✓' : '✗'} {depModel?.name ?? depId}
                        </span>
                        {i < inn.dependencies.length - 1 && <span style={{ color: '#444' }}> · </span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredInnovations.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#666', fontSize: 13 }} data-testid="grid-empty">
          No innovations in this category.
        </div>
      )}

      {/* ── Discovery Log ─────────────────────────────── */}
      <div style={sectionTitle}>Recent Discoveries</div>
      {recentDiscoveries.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#666', fontSize: 13 }} data-testid="log-empty">
          No discoveries yet.
        </div>
      ) : (
        <div style={card} data-testid="discovery-log">
          <div style={logContainer}>
            {recentDiscoveries.map((evt, idx) => {
              const evtModel = innovations[evt.innovationId];
              const catMeta = evtModel
                ? innovationConfig.categories[evtModel.category]
                : null;

              return (
                <div
                  key={`${evt.innovationId}-${evt.nationId}-${evt.turn}`}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    borderBottom: idx < recentDiscoveries.length - 1 ? '1px solid #222' : 'none',
                  }}
                  data-testid={`discovery-${evt.innovationId}`}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: 3,
                      backgroundColor: '#222',
                      color: '#4caf50',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    T{evt.turn}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', marginBottom: 2 }}>
                      {evt.headline}
                    </div>
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {catMeta && (
                        <span style={{ color: catMeta.color, marginRight: 8 }}>
                          {catMeta.icon} {catMeta.label}
                        </span>
                      )}
                      <span>by {evt.nationId}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Research Summary Panel ────────────────────── */}
      <div style={sectionTitle}>Nation Research Overview</div>
      {nationSummaries.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#666', fontSize: 13 }} data-testid="summary-empty">
          No research data available.
        </div>
      ) : (
        <div style={card} data-testid="research-summary">
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr repeat(4, 1fr)',
              gap: 8,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#888',
              paddingBottom: 8,
              borderBottom: '1px solid #333',
              marginBottom: 4,
            }}
          >
            <span>Nation</span>
            <span style={{ textAlign: 'right' }}>Total</span>
            <span style={{ textAlign: 'right' }}>In Progress</span>
            <span style={{ textAlign: 'right' }}>Discovered</span>
            <span style={{ textAlign: 'right' }}>Locked</span>
          </div>

          {nationSummaries.map((ns) => {
            const isPlayer = ns.nationId === playerNationId;
            return (
              <div
                key={ns.nationId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr repeat(4, 1fr)',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid #222',
                  fontSize: 12,
                }}
                data-testid={`summary-${ns.nationId}`}
              >
                <span style={{ fontWeight: isPlayer ? 700 : 500, color: isPlayer ? '#4caf50' : '#ccc' }}>
                  {ns.nationId}{isPlayer ? ' (You)' : ''}
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{ns.total}</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#ffaa00' }}>{ns.inProgress}</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#4caf50' }}>{ns.discovered}</span>
                <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#666' }}>{ns.locked}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
