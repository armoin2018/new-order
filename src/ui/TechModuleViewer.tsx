/**
 * TechModuleViewer — FR-3500, CNFL-0030-S7
 *
 * Lists all auto-generated tech modules from the TechModuleRegistryState,
 * shows computed fields (actual cost, synergy bonuses, discovery context),
 * and provides single + batch export buttons. Includes a simple
 * leaderboard-style ranking by faction.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type {
  TechModuleRegistryState,
  TechModuleRecord,
  TechModuleDiscoveryEntry,
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

const badgeStyle = (color: string): CSSProperties => ({
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 700,
  color,
  backgroundColor: color + '22',
  marginRight: 4,
});

// ─── Helpers ─────────────────────────────────────────────────

function domainColor(domain: string): string {
  const map: Record<string, string> = {
    military: '#ef5350',
    cyber: '#7c4dff',
    space: '#42a5f5',
    energy: '#ffa726',
    biotech: '#66bb6a',
    materials: '#8d6e63',
    information: '#26c6da',
    infrastructure: '#bdbdbd',
  };
  return map[domain] ?? '#888';
}

function tierLabel(tier?: number): string {
  if (!tier) return '';
  return `T${tier}`;
}

// ─── Component ───────────────────────────────────────────────

export const TechModuleViewer: FC = () => {
  const registry = useGameStore((s) => s.techModuleRegistry) as TechModuleRegistryState | null;
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [filterFaction, setFilterFaction] = useState<string | null>(null);

  const modules = useMemo(() => {
    if (!registry) return [];
    let arr = Object.values(registry.modules);
    if (filterFaction) {
      arr = arr.filter((m) => m.generatedBy === filterFaction);
    }
    return arr.sort((a, b) => b.generatedOnTurn - a.generatedOnTurn);
  }, [registry, filterFaction]);

  const factionCounts = useMemo(() => {
    if (!registry) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const m of Object.values(registry.modules)) {
      counts.set(m.generatedBy, (counts.get(m.generatedBy) ?? 0) + 1);
    }
    return counts;
  }, [registry]);

  if (!registry || Object.keys(registry.modules).length === 0) {
    return (
      <div style={panelStyle} data-testid="tech-module-viewer">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔬 Tech Module Registry</h2>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          <p style={{ fontSize: 14 }}>No tech modules generated yet.</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
            Modules are auto-generated when factions complete technology research.
          </p>
        </div>
      </div>
    );
  }

  const selected = selectedModule ? registry.modules[selectedModule] : null;

  return (
    <div style={panelStyle} data-testid="tech-module-viewer">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔬 Tech Module Registry</h2>

      {/* ── Leaderboard ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Research Leaderboard</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <LeaderButton
            label="All"
            count={Object.keys(registry.modules).length}
            active={!filterFaction}
            onClick={() => setFilterFaction(null)}
          />
          {Array.from(factionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([fid, count]) => (
              <LeaderButton
                key={fid}
                label={fid.toUpperCase()}
                count={count}
                active={filterFaction === fid}
                onClick={() => setFilterFaction(fid)}
              />
            ))}
        </div>
      </div>

      {/* ── Module List ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            Modules ({modules.length})
          </h3>
          <button
            data-testid="export-all-modules-btn"
            onClick={() => exportAllModules(modules)}
            style={{
              padding: '4px 10px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#e0e0e0',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            💾 Export All
          </button>
        </div>

        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {modules.map((mod) => (
            <ModuleRow
              key={`${mod.techId}-${mod.generatedBy}`}
              module={mod}
              isSelected={selectedModule === `${mod.techId}-${mod.generatedBy}`}
              onSelect={() => setSelectedModule(
                selectedModule === `${mod.techId}-${mod.generatedBy}` ? null : `${mod.techId}-${mod.generatedBy}`
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {selected && <ModuleDetail module={selected} />}

      {/* ── Discovery Log ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Discovery Log ({registry.discoveryLog.length} entries)
        </h3>
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {registry.discoveryLog.slice(-20).reverse().map((entry, i) => (
            <DiscoveryLogRow key={`log-${i}`} entry={entry} index={i} />
          ))}
          {registry.discoveryLog.length === 0 && (
            <div style={{ color: '#555', fontSize: 12 }}>No discoveries logged yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-Components ──────────────────────────────────────────

const LeaderButton: FC<{
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}> = ({ label, count, active, onClick }) => (
  <button
    data-testid={`leader-${label.toLowerCase()}`}
    onClick={onClick}
    style={{
      padding: '4px 10px',
      borderRadius: 4,
      border: active ? '1px solid #4caf50' : '1px solid #333',
      background: active ? '#1a3a1a' : '#0a0a0a',
      color: active ? '#4caf50' : '#888',
      cursor: 'pointer',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'inherit',
    }}
  >
    {label} ({count})
  </button>
);

const ModuleRow: FC<{
  module: TechModuleRecord;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ module: mod, isSelected, onSelect }) => (
  <button
    data-testid={`module-row-${mod.techId}-${mod.generatedBy}`}
    onClick={onSelect}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '6px 8px',
      marginBottom: 2,
      border: 'none',
      borderLeft: isSelected ? '3px solid #4caf50' : '3px solid transparent',
      backgroundColor: isSelected ? '#1a2a1a' : 'transparent',
      color: '#e0e0e0',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: 12,
      fontFamily: 'inherit',
    }}
  >
    <span style={badgeStyle(domainColor(mod.domain))}>{mod.domain}</span>
    {mod.tier !== undefined && <span style={{ color: '#888', fontSize: 10 }}>{tierLabel(mod.tier)}</span>}
    <span style={{ flex: 1, fontWeight: 600 }}>{mod.name}</span>
    <span style={{ color: '#888', fontSize: 10 }}>{mod.generatedBy.toUpperCase()}</span>
    <span style={{ color: '#555', fontSize: 10 }}>T{mod.generatedOnTurn}</span>
  </button>
);

const ModuleDetail: FC<{ module: TechModuleRecord }> = ({ module: mod }) => (
  <div style={cardStyle} data-testid={`module-detail-${mod.techId}`}>
    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
      {mod.name}
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
      <DetailRow label="Tech ID" value={mod.techId} />
      <DetailRow label="Domain" value={mod.domain} />
      <DetailRow label="Tier" value={mod.tier?.toString() ?? '—'} />
      <DetailRow label="Generated By" value={mod.generatedBy.toUpperCase()} />
      <DetailRow label="Turn" value={`T${mod.generatedOnTurn}`} />
      <DetailRow label="Scenario" value={mod.scenarioId} />
      <DetailRow label="Actual Cost" value={`$${mod.actualCostPaid.toLocaleString()}`} />
      <DetailRow label="Duration" value={`${mod.effectiveDurationTurns} turns`} />
      <DetailRow label="Exportable" value={mod.exportable ? '✅ Yes' : '❌ No'} />
    </div>
    {mod.synergyBonuses.length > 0 && (
      <div style={{ marginTop: 8, fontSize: 11 }}>
        <span style={{ color: '#888' }}>Synergy Bonuses: </span>
        {mod.synergyBonuses.join(', ')}
      </div>
    )}
    <div style={{ marginTop: 8 }}>
      <button
        data-testid={`export-module-${mod.techId}`}
        onClick={() => exportSingleModule(mod)}
        style={{
          padding: '4px 10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 4,
          color: '#e0e0e0',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        💾 Export Module
      </button>
    </div>
  </div>
);

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span style={{ color: '#888' }}>{label}: </span>
    <span style={{ fontWeight: 600 }}>{value}</span>
  </div>
);

const DiscoveryLogRow: FC<{ entry: TechModuleDiscoveryEntry; index: number }> = ({ entry, index }) => (
  <div
    data-testid={`discovery-log-${index}`}
    style={{
      padding: '4px 8px',
      borderLeft: '2px solid #333',
      marginBottom: 2,
      backgroundColor: index % 2 === 0 ? '#0a0a0a' : 'transparent',
      fontSize: 11,
    }}
  >
    <span style={{ color: '#888' }}>T{entry.turnDiscovered}</span>
    {' — '}
    <span style={{ fontWeight: 600 }}>{entry.factionId.toUpperCase()}</span>
    {' discovered '}
    <span style={{ color: '#42a5f5' }}>{entry.techId}</span>
    <span style={{ color: '#666' }}> (${entry.actualCost.toLocaleString()}, {entry.actualDuration}t)</span>
  </div>
);

// ─── Export Helpers ───────────────────────────────────────────

function exportSingleModule(mod: TechModuleRecord): void {
  const content = JSON.stringify(mod, null, 2);
  download(content, `tech-module-${mod.techId}-${mod.generatedBy}.json`, 'application/json');
}

function exportAllModules(modules: readonly TechModuleRecord[]): void {
  const content = JSON.stringify(modules, null, 2);
  download(content, `tech-modules-export-${modules.length}.json`, 'application/json');
}

function download(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default TechModuleViewer;
