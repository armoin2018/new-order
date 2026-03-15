/**
 * CNFL-3804 — Module Detail View
 *
 * Read-only detail panel for viewing module data with relationship
 * visualization, usage stats, and module-specific renderings
 * (radar charts for leaders, stat bars for military, etc.).
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModuleRelationship {
  targetType: string;
  targetId: string;
  targetName: string;
  relationship: string;
}

export interface UsageStat {
  scenarioId: string;
  scenarioName: string;
}

export interface ModuleDetailViewProps {
  moduleType: string;
  moduleId: string;
  data: Record<string, unknown>;
  relationships?: ModuleRelationship[];
  usage?: UsageStat[];
  onNavigateTo?: (moduleType: string, id: string) => void;
  onEdit?: () => void;
  onPreviewInGame?: () => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const detailRoot: CSSProperties = { width: '100%', maxWidth: 1000, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const headerBar: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #333' };
const titleStyle: CSSProperties = { fontSize: 22, fontWeight: 600, color: '#fff', margin: 0 };
const subtitleStyle: CSSProperties = { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const btnGroup: CSSProperties = { display: 'flex', gap: 8 };
const btnPrimary: CSSProperties = { padding: '8px 16px', background: '#1976d2', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 };
const btnSecondary: CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: 4, color: '#ccc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' };
const sectionBox: CSSProperties = { border: '1px solid #222', borderRadius: 8, padding: 20, marginBottom: 20, background: '#0d0d0d' };
const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em' };
const fieldRow: CSSProperties = { display: 'grid', gridTemplateColumns: '180px 1fr', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13, gap: 12 };
const fieldLabel: CSSProperties = { color: '#888', fontWeight: 500 };
const fieldValue: CSSProperties = { color: '#e0e0e0', wordBreak: 'break-word' };
const tagStyle: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 3, background: '#1a1a1a', color: '#aaa', fontSize: 11, marginRight: 4, marginBottom: 4 };
const linkStyle: CSSProperties = { color: '#4fc3f7', cursor: 'pointer', textDecoration: 'underline' };
const statBarContainer: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 };
const statLabel: CSSProperties = { width: 100, fontSize: 12, color: '#aaa', textAlign: 'right' };
const statBarOuter: CSSProperties = { flex: 1, height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' };
const statValue: CSSProperties = { width: 36, fontSize: 12, color: '#ccc', textAlign: 'right' };
const tabBar: CSSProperties = { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #333', paddingBottom: 8 };
const tabBase: CSSProperties = { padding: '6px 14px', border: '1px solid #333', borderRadius: 4, background: 'transparent', color: '#999', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' };
const tabActive: CSSProperties = { ...tabBase, background: '#1a3a5c', color: '#4fc3f7', borderColor: '#4fc3f7' };
const emptyMsg: CSSProperties = { color: '#666', fontSize: 13, fontStyle: 'italic' };

type DetailTab = 'fields' | 'relationships' | 'usage' | 'json';

// ─── Stat helpers ───────────────────────────────────────────────────────────

const STAT_FIELDS: Record<string, { fields: string[]; max: number }> = {
  military: { fields: ['attackPower', 'defensePower', 'range', 'speed', 'stealthRating'], max: 100 },
  leaders: { fields: ['riskTolerance', 'paranoia', 'narcissism', 'pragmatism', 'patience', 'charisma', 'empathy'], max: 100 },
};

function statColor(pct: number): string {
  if (pct >= 0.7) return '#4caf50';
  if (pct >= 0.4) return '#ffaa00';
  return '#ff4a4a';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ModuleDetailView: FC<ModuleDetailViewProps> = ({
  moduleType,
  moduleId,
  data,
  relationships = [],
  usage = [],
  onNavigateTo,
  onEdit,
  onPreviewInGame,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('fields');

  const name = (data.name as string) ?? (data.leaderId as string) ?? moduleId;
  const description = data.description as string | undefined;

  // Flatten top-level fields for display
  const flatFields = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('_')) continue;
      if (typeof val === 'object' && val !== null) {
        entries.push([key, JSON.stringify(val, null, 2)]);
      } else {
        entries.push([key, String(val ?? '')]);
      }
    }
    return entries;
  }, [data]);

  // Stat bar config
  const statConfig = STAT_FIELDS[moduleType];
  const statValues = useMemo(() => {
    if (!statConfig) return [];
    return statConfig.fields
      .map((f) => {
        // For leaders, stats might be nested under psychology
        const val = (data[f] as number) ?? ((data.psychology as Record<string, number> | undefined)?.[f]);
        return val !== undefined ? { field: f, value: val } : null;
      })
      .filter(Boolean) as Array<{ field: string; value: number }>;
  }, [data, statConfig]);

  return (
    <div data-testid="module-detail" style={detailRoot}>
      {/* Header */}
      <div style={headerBar}>
        <div>
          <h2 style={titleStyle}>{name}</h2>
          <div style={subtitleStyle}>{moduleType} • {moduleId}</div>
        </div>
        <div style={btnGroup}>
          {onEdit && <button data-testid="edit-btn" style={btnPrimary} onClick={onEdit}>Edit</button>}
          {onPreviewInGame && <button data-testid="preview-btn" style={btnSecondary} onClick={onPreviewInGame}>Preview in Game</button>}
        </div>
      </div>

      {description && (
        <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 16 }}>{description}</p>
      )}

      {/* Stat Bars (for military/leaders) */}
      {statValues.length > 0 && (
        <div data-testid="stat-bars" style={sectionBox}>
          <div style={sectionTitle}>Stats</div>
          {statValues.map(({ field, value }) => (
            <div key={field} style={statBarContainer}>
              <span style={statLabel}>{field.replace(/([A-Z])/g, ' $1')}</span>
              <div style={statBarOuter}>
                <div style={{ height: '100%', width: `${(value / (statConfig?.max ?? 100)) * 100}%`, background: statColor(value / (statConfig?.max ?? 100)), borderRadius: 4 }} />
              </div>
              <span style={statValue}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div data-testid="detail-tabs" style={tabBar}>
        {(['fields', 'relationships', 'usage', 'json'] as DetailTab[]).map((tab) => (
          <button key={tab} data-testid={`tab-${tab}`} style={activeTab === tab ? tabActive : tabBase} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'relationships' && relationships.length > 0 && ` (${relationships.length})`}
            {tab === 'usage' && usage.length > 0 && ` (${usage.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'fields' && (
        <div data-testid="fields-tab">
          {flatFields.map(([key, val]) => (
            <div key={key} style={fieldRow}>
              <span style={fieldLabel}>{key}</span>
              <span style={fieldValue}>
                {val.length > 200 ? (
                  <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: '#ccc' }}>{val}</pre>
                ) : val}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'relationships' && (
        <div data-testid="relationships-tab">
          {relationships.length === 0 ? (
            <p style={emptyMsg}>No relationships found</p>
          ) : relationships.map((r, i) => (
            <div key={i} style={fieldRow}>
              <span style={fieldLabel}>{r.relationship}</span>
              <span style={fieldValue}>
                <span style={tagStyle}>{r.targetType}</span>
                <span style={linkStyle} onClick={() => onNavigateTo?.(r.targetType, r.targetId)}>
                  {r.targetName}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'usage' && (
        <div data-testid="usage-tab">
          {usage.length === 0 ? (
            <p style={emptyMsg}>Not used in any scenarios</p>
          ) : usage.map((u) => (
            <div key={u.scenarioId} style={fieldRow}>
              <span style={fieldLabel}>Scenario</span>
              <span style={fieldValue}>
                <span style={linkStyle} onClick={() => onNavigateTo?.('scenarios', u.scenarioId)}>
                  {u.scenarioName}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'json' && (
        <div data-testid="json-tab" style={sectionBox}>
          <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#4fc3f7', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
