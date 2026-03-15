/**
 * CNFL-3304 — Technology Tree Visualization & Research Management
 *
 * Interactive tech tree with domain/tier layout, prerequisite edges,
 * research progress, budget sliders, research queue, and nation comparison.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TechDomain = 'military' | 'civilian' | 'cyber' | 'space' | 'biotech' | 'energy' | 'ai' | 'nanotech';

export interface TechNode {
  techId: string;
  name: string;
  domain: TechDomain;
  tier: number; // 1-5
  description: string;
  prerequisites: string[];
  researchCost: number;
  turnsToComplete: number;
  currentProgress: number; // 0-100
  status: 'locked' | 'available' | 'researching' | 'completed';
  effects: string[];
}

export interface ResearchQueueItem {
  techId: string;
  name: string;
  priority: number;
  estimatedTurns: number;
}

export interface NationTechLevel {
  nationId: string;
  nationName: string;
  techCount: number;
  averageTier: number;
  leadingDomain: TechDomain;
}

export interface TechTreeProps {
  technologies: TechNode[];
  researchQueue: ResearchQueueItem[];
  researchBudget: number;
  maxBudget: number;
  nationComparison: NationTechLevel[];
  onStartResearch?: (techId: string) => void;
  onCancelResearch?: (techId: string) => void;
  onBudgetChange?: (newBudget: number) => void;
  onQueueReorder?: (queue: ResearchQueueItem[]) => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = { width: '100%', maxWidth: 1200, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 16, marginTop: 24 };
const card: CSSProperties = { backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 12 };

const DOMAIN_COLORS: Record<TechDomain, string> = {
  military: '#ff4a4a',
  civilian: '#4a9eff',
  cyber: '#00e5ff',
  space: '#9c27b0',
  biotech: '#4caf50',
  energy: '#ffaa00',
  ai: '#ff6fcf',
  nanotech: '#76ff03',
};

function statusBadge(status: TechNode['status']): CSSProperties {
  const colors: Record<string, string> = {
    locked: '#555',
    available: '#4a9eff',
    researching: '#ffaa00',
    completed: '#4caf50',
  };
  return { display: 'inline-block', padding: '2px 8px', fontSize: 9, borderRadius: 3, backgroundColor: colors[status] ?? '#555', color: '#000', fontWeight: 700, textTransform: 'uppercase' };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const TechTree: FC<TechTreeProps> = ({
  technologies,
  researchQueue,
  researchBudget,
  maxBudget,
  nationComparison,
  onStartResearch,
  onCancelResearch,
  onBudgetChange,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<TechDomain | 'all'>('all');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  const domains = useMemo(() => {
    const ds = new Set(technologies.map((t) => t.domain));
    return Array.from(ds).sort();
  }, [technologies]);

  const filtered = useMemo(() => {
    if (selectedDomain === 'all') return technologies;
    return technologies.filter((t) => t.domain === selectedDomain);
  }, [technologies, selectedDomain]);

  const tiers = useMemo(() => {
    const map = new Map<number, TechNode[]>();
    for (const t of filtered) {
      if (!map.has(t.tier)) map.set(t.tier, []);
      map.get(t.tier)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const stats = useMemo(() => {
    const completed = technologies.filter((t) => t.status === 'completed').length;
    const researching = technologies.filter((t) => t.status === 'researching').length;
    return { total: technologies.length, completed, researching, available: technologies.filter((t) => t.status === 'available').length };
  }, [technologies]);

  const detail = useMemo(() => technologies.find((t) => t.techId === selectedTech) ?? null, [technologies, selectedTech]);

  return (
    <div style={panel} data-testid="tech-tree">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🔬 Technology Research Tree
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        {stats.completed}/{stats.total} completed • {stats.researching} in progress • {stats.available} available
      </p>

      {/* ── Stats Bar ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }} data-testid="stats-bar">
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4caf50' }}>{stats.completed}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Completed</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ffaa00' }}>{stats.researching}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Researching</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4a9eff' }}>{stats.available}</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Available</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>${researchBudget}B</div>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>R&D Budget</div>
        </div>
      </div>

      {/* ── Domain Filter ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }} data-testid="domain-filter">
        <button
          data-testid="domain-all"
          onClick={() => setSelectedDomain('all')}
          style={{ padding: '4px 12px', borderRadius: 4, border: selectedDomain === 'all' ? '2px solid #fff' : '1px solid #333', background: '#222', color: '#ccc', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
        >
          All
        </button>
        {domains.map((d) => (
          <button
            key={d}
            data-testid={`domain-${d}`}
            onClick={() => setSelectedDomain(d)}
            style={{ padding: '4px 12px', borderRadius: 4, border: selectedDomain === d ? `2px solid ${DOMAIN_COLORS[d]}` : '1px solid #333', background: '#222', color: DOMAIN_COLORS[d], cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ── Tech Tree by Tier ──────────────────────────── */}
      <div style={sectionTitle}>Technology Tree</div>
      {tiers.map(([tier, nodes]) => (
        <div key={tier} data-testid={`tier-${tier}`} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>Tier {tier}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {nodes.map((n) => (
              <div
                key={n.techId}
                data-testid={`tech-${n.techId}`}
                onClick={() => setSelectedTech(n.techId)}
                style={{
                  ...card,
                  width: 180,
                  cursor: 'pointer',
                  borderColor: selectedTech === n.techId ? DOMAIN_COLORS[n.domain] : '#333',
                  opacity: n.status === 'locked' ? 0.45 : 1,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: DOMAIN_COLORS[n.domain] }}>{n.name}</div>
                <span style={statusBadge(n.status)}>{n.status}</span>
                {n.status === 'researching' && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                      <div data-testid={`progress-${n.techId}`} style={{ width: `${n.currentProgress}%`, height: '100%', background: '#ffaa00', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{n.currentProgress}%</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Detail Panel ───────────────────────────────── */}
      {detail && (
        <div style={{ ...card, borderColor: DOMAIN_COLORS[detail.domain] }} data-testid="tech-detail">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: DOMAIN_COLORS[detail.domain] }}>{detail.name}</h3>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{detail.description}</p>
          <div style={{ fontSize: 11, marginBottom: 8 }}>
            <span style={{ color: '#888' }}>Cost:</span> ${detail.researchCost}B &nbsp;
            <span style={{ color: '#888' }}>Turns:</span> {detail.turnsToComplete} &nbsp;
            <span style={{ color: '#888' }}>Progress:</span> {detail.currentProgress}%
          </div>
          {detail.effects.length > 0 && (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <strong>Effects:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                {detail.effects.map((e, i) => <li key={i} style={{ color: '#aaa' }}>{e}</li>)}
              </ul>
            </div>
          )}
          {detail.prerequisites.length > 0 && (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <strong>Prerequisites:</strong> {detail.prerequisites.join(', ')}
            </div>
          )}
          {detail.status === 'available' && onStartResearch && (
            <button
              data-testid="btn-start-research"
              onClick={() => onStartResearch(detail.techId)}
              style={{ padding: '6px 16px', background: '#4a9eff', border: 'none', borderRadius: 4, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
            >
              Start Research
            </button>
          )}
          {detail.status === 'researching' && onCancelResearch && (
            <button
              data-testid="btn-cancel-research"
              onClick={() => onCancelResearch(detail.techId)}
              style={{ padding: '6px 16px', background: '#ff4a4a', border: 'none', borderRadius: 4, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
            >
              Cancel Research
            </button>
          )}
        </div>
      )}

      {/* ── Budget Slider ──────────────────────────────── */}
      {onBudgetChange && (
        <>
          <div style={sectionTitle}>R&D Budget Allocation</div>
          <div style={card} data-testid="budget-slider">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#888' }}>$0B</span>
              <input
                type="range"
                min={0}
                max={maxBudget}
                value={researchBudget}
                onChange={(e) => onBudgetChange(Number(e.target.value))}
                data-testid="input-budget"
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: '#888' }}>${maxBudget}B</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, marginTop: 8 }}>${researchBudget}B allocated</div>
          </div>
        </>
      )}

      {/* ── Research Queue ─────────────────────────────── */}
      <div style={sectionTitle}>Research Queue ({researchQueue.length})</div>
      <div style={card} data-testid="research-queue">
        {researchQueue.length === 0 ? (
          <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 16 }}>Queue is empty</div>
        ) : (
          researchQueue.map((item, idx) => (
            <div key={item.techId} data-testid={`queue-${item.techId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < researchQueue.length - 1 ? '1px solid #222' : 'none' }}>
              <div>
                <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>#{item.priority}</span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{item.name}</span>
              </div>
              <span style={{ fontSize: 11, color: '#888' }}>~{item.estimatedTurns} turns</span>
            </div>
          ))
        )}
      </div>

      {/* ── Nation Comparison ──────────────────────────── */}
      {nationComparison.length > 0 && (
        <>
          <div style={sectionTitle}>Nation Tech Comparison</div>
          <div style={card} data-testid="nation-comparison">
            {nationComparison.map((n) => (
              <div key={n.nationId} data-testid={`nation-${n.nationId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{n.nationName}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#888' }}>
                  <span>{n.techCount} techs</span>
                  <span>Avg Tier {n.averageTier.toFixed(1)}</span>
                  <span style={{ color: DOMAIN_COLORS[n.leadingDomain] }}>{n.leadingDomain}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
