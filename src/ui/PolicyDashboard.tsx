import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties } from 'react';
import type {
  NationalPolicyState,
  PolicyScope,
  PolicyState,
  PolicyModel,
} from '@/data/types/policy.types';
import {
  getActivePolicies,
} from '@/engine/policy-engine';
import {
  getFullPolicyCatalog,
  getPolicyModelById,
} from '@/engine/config/default-policies';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PolicyDashboardProps {
  policyState: NationalPolicyState | undefined;
  nationName: string;
  nationId: string;
  currentTurn: number;
  onAddPolicy: (policy: PolicyModel) => void;
  onRemovePolicy: (policyId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCOPE_FILTERS: Array<{ label: string; value: PolicyScope | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: '🏠 Domestic', value: 'domestic' },
  { label: '🤝 Bilateral', value: 'bilateral' },
  { label: '🌐 Multilateral', value: 'multilateral' },
];

const STATUS_COLORS: Record<string, string> = {
  proposed: '#ffa726',
  active: '#4caf50',
  suspended: '#ef5350',
  repealed: '#757575',
};

const DIMENSION_ICONS: Record<string, string> = {
  military: '⚔️',
  technology: '🔬',
  treasury: '💰',
  stability: '🏛️',
  diplomatic: '🌍',
  popularity: '👥',
  economic: '📈',
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = {
  root: {
    background: '#0a0a0a',
    color: '#e0e0e0',
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    padding: 20,
    minHeight: '100%',
    boxSizing: 'border-box',
  } as CSSProperties,

  /* --- overview bar --- */
  overviewBar: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 20,
    padding: 14,
    border: '1px solid #222',
    borderRadius: 8,
    background: '#111',
  } as CSSProperties,

  overviewItem: {
    flex: '1 1 140px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as CSSProperties,

  overviewLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#888',
  } as CSSProperties,

  overviewValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e0e0e0',
  } as CSSProperties,

  /* --- scope tabs --- */
  tabRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 18,
    flexWrap: 'wrap',
  } as CSSProperties,

  tab: (active: boolean): CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 4,
    border: '1px solid #222',
    background: active ? '#4caf50' : '#111',
    color: active ? '#000' : '#e0e0e0',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 13,
    transition: 'background 0.15s',
  }),

  /* --- add policy button --- */
  addBtn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid #4caf50',
    background: '#1a2e1a',
    color: '#4caf50',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginLeft: 'auto',
  } as CSSProperties,

  /* --- layout columns --- */
  columns: {
    display: 'flex',
    gap: 18,
    flexWrap: 'wrap',
  } as CSSProperties,

  mainCol: {
    flex: '1 1 520px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as CSSProperties,

  sideCol: {
    flex: '0 0 340px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as CSSProperties,

  /* --- policy card --- */
  card: {
    border: '1px solid #222',
    borderRadius: 8,
    background: '#111',
    padding: 14,
  } as CSSProperties,

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  } as CSSProperties,

  cardName: {
    fontSize: 15,
    fontWeight: 600,
    flex: 1,
  } as CSSProperties,

  badge: (bg: string): CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: '2px 7px',
    borderRadius: 3,
    background: bg,
    color: '#fff',
  }),

  statusDot: (color: string): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),

  scopeBadge: (scope: PolicyScope): CSSProperties => ({
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 3,
    background: scope === 'domestic' ? '#1a2e3e' : scope === 'bilateral' ? '#2e2e1a' : '#1a2e1a',
    color: scope === 'domestic' ? '#64b5f6' : scope === 'bilateral' ? '#ffd54f' : '#81c784',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),

  dimRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  } as CSSProperties,

  dimLabel: {
    width: 100,
    fontSize: 11,
    color: '#888',
    textTransform: 'capitalize',
    flexShrink: 0,
  } as CSSProperties,

  dimBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    background: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  } as CSSProperties,

  dimBarFill: (value: number, maxVal: number = 15): CSSProperties => {
    const norm = Math.max(-1, Math.min(1, value / maxVal));
    const isPositive = norm >= 0;
    const pct = Math.abs(norm) * 50;
    return {
      position: 'absolute',
      top: 0,
      height: '100%',
      borderRadius: 4,
      background: isPositive ? '#4caf50' : '#ef5350',
      left: isPositive ? '50%' : `${50 - pct}%`,
      width: `${pct}%`,
      transition: 'width 0.25s',
    };
  },

  dimCenter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 1,
    height: '100%',
    background: '#333',
  } as CSSProperties,

  costLine: {
    marginTop: 8,
    fontSize: 11,
    color: '#888',
  } as CSSProperties,

  description: {
    fontSize: 12,
    color: '#999',
    lineHeight: 1.4,
    marginBottom: 8,
  } as CSSProperties,

  /* --- buttons --- */
  repealBtn: {
    padding: '5px 14px',
    borderRadius: 4,
    border: '1px solid #ef5350',
    background: 'transparent',
    color: '#ef5350',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as CSSProperties,

  enactBtn: {
    padding: '5px 14px',
    borderRadius: 4,
    border: '1px solid #4caf50',
    background: 'transparent',
    color: '#4caf50',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as CSSProperties,

  /* --- panels --- */
  panelTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#4caf50',
    marginBottom: 10,
  } as CSSProperties,

  sectionHeading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555',
    marginTop: 6,
    marginBottom: 2,
  } as CSSProperties,

  impactValue: (v: number): CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    width: 44,
    textAlign: 'right',
    color: v > 0 ? '#4caf50' : v < 0 ? '#ef5350' : '#555',
    flexShrink: 0,
  }),

  /* --- modal overlay --- */
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  } as CSSProperties,

  modal: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 10,
    padding: 24,
    width: '90%',
    maxWidth: 720,
    maxHeight: '80vh',
    overflow: 'auto',
    color: '#e0e0e0',
  } as CSSProperties,

  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  } as CSSProperties,

  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4caf50',
  } as CSSProperties,

  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: 22,
    cursor: 'pointer',
    padding: '4px 8px',
  } as CSSProperties,

  catalogCard: (disabled: boolean): CSSProperties => ({
    border: `1px solid ${disabled ? '#1a1a1a' : '#222'}`,
    borderRadius: 8,
    background: disabled ? '#0a0a0a' : '#111',
    padding: 14,
    marginBottom: 10,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'not-allowed' : 'default',
  }),

  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#0a0a0a',
    color: '#e0e0e0',
    fontSize: 13,
    marginBottom: 16,
    boxSizing: 'border-box',
  } as CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const DimensionBar: FC<{ dim: string; value: number; maxVal?: number }> = ({ dim, value, maxVal = 15 }) => (
  <div style={s.dimRow}>
    <span style={s.dimLabel}>
      {DIMENSION_ICONS[dim] ?? '📊'} {dim}
    </span>
    <div style={s.dimBarTrack}>
      <div style={s.dimCenter} />
      <div style={s.dimBarFill(value, maxVal)} />
    </div>
    <span style={s.impactValue(value)}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}
    </span>
  </div>
);

/** Active policy card with repeal button. */
const ActivePolicyCard: FC<{
  ps: PolicyState;
  model: PolicyModel | undefined;
  onRepeal: (id: string) => void;
}> = ({ ps, model, onRepeal }) => {
  const { policyId, status, turnsActive, currentEffectiveness } = ps;
  const [confirmRepeal, setConfirmRepeal] = useState(false);

  const impacts = model?.dimensionalImpacts ?? [];
  const scope = model?.scope ?? 'domestic';

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={s.statusDot(STATUS_COLORS[status] ?? '#555')} title={status} />
        <span style={s.cardName}>{model?.name ?? policyId}</span>
        <span style={s.scopeBadge(scope)}>{scope}</span>
        <span style={{ ...s.badge(STATUS_COLORS[status] ?? '#555'), marginLeft: 4 }}>
          {status}
        </span>
      </div>

      {model?.description && (
        <div style={s.description}>{model.description}</div>
      )}

      {impacts.length > 0 && (
        <>
          <div style={s.sectionHeading}>Dimensional Impacts</div>
          {impacts.map((di) => (
            <DimensionBar key={di.dimension} dim={di.dimension} value={di.magnitude} />
          ))}
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={s.costLine}>
          Effectiveness: <strong>{currentEffectiveness.toFixed(0)}</strong> &nbsp;·&nbsp;
          Active <strong>{turnsActive}</strong> turn{turnsActive === 1 ? '' : 's'}
          {model?.costPerTurn ? <> &nbsp;·&nbsp; Cost: <strong>${model.costPerTurn}B</strong>/turn</> : null}
        </div>
        {status === 'active' && (
          confirmRepeal ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                style={{ ...s.repealBtn, background: '#ef5350', color: '#fff' }}
                onClick={() => { onRepeal(policyId); setConfirmRepeal(false); }}
              >
                Confirm Repeal
              </button>
              <button
                type="button"
                style={{ ...s.enactBtn, borderColor: '#555', color: '#888' }}
                onClick={() => setConfirmRepeal(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              style={s.repealBtn}
              onClick={() => setConfirmRepeal(true)}
            >
              ✕ Repeal
            </button>
          )
        )}
      </div>
    </div>
  );
};

/** Catalog policy card in the "Add Policy" modal. */
const CatalogPolicyCard: FC<{
  model: PolicyModel;
  isActive: boolean;
  onEnact: (model: PolicyModel) => void;
}> = ({ model, isActive, onEnact }) => (
  <div style={s.catalogCard(isActive)}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{model.name}</span>
      <span style={s.scopeBadge(model.scope)}>{model.scope}</span>
      {isActive && (
        <span style={s.badge('#4caf50')}>Active</span>
      )}
    </div>
    <div style={s.description}>{model.description}</div>

    <div style={{ marginBottom: 8 }}>
      {model.dimensionalImpacts.map((di) => (
        <DimensionBar key={di.dimension} dim={di.dimension} value={di.magnitude} />
      ))}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: '#888' }}>
        Cost: <strong>${model.costPerTurn}B</strong>/turn
      </span>
      {!isActive && (
        <button
          type="button"
          style={s.enactBtn}
          onClick={() => onEnact(model)}
        >
          + Enact Policy
        </button>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Add Policy Modal                                                   */
/* ------------------------------------------------------------------ */

const AddPolicyModal: FC<{
  nationId: string;
  activeIds: Set<string>;
  onEnact: (model: PolicyModel) => void;
  onClose: () => void;
}> = ({ nationId, activeIds, onEnact, onClose }) => {
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<PolicyScope | 'all'>('all');

  const catalog = useMemo(() => getFullPolicyCatalog(nationId), [nationId]);

  const filtered = useMemo(() => {
    let list = catalog;
    if (scopeFilter !== 'all') {
      list = list.filter((pm) => pm.scope === scopeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (pm) =>
          pm.name.toLowerCase().includes(q) ||
          pm.description.toLowerCase().includes(q) ||
          pm.dimensionalImpacts.some((di) => di.dimension.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [catalog, scopeFilter, search]);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>📋 Policy Catalog</span>
          <button type="button" style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <input
          style={s.searchInput}
          placeholder="Search policies by name, description, or dimension..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div style={{ ...s.tabRow, marginBottom: 14 }}>
          {SCOPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              style={s.tab(scopeFilter === f.value)}
              onClick={() => setScopeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          {filtered.length} polic{filtered.length === 1 ? 'y' : 'ies'} available
          {activeIds.size > 0 && <> · {activeIds.size} currently active</>}
        </div>

        {filtered.map((pm) => (
          <CatalogPolicyCard
            key={pm.policyId}
            model={pm}
            isActive={activeIds.has(pm.policyId)}
            onEnact={onEnact}
          />
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>
            No policies matching your search
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const PolicyDashboard: FC<PolicyDashboardProps> = ({
  policyState,
  nationName,
  nationId,
  currentTurn,
  onAddPolicy,
  onRemovePolicy,
}) => {
  const [scopeFilter, setScopeFilter] = useState<PolicyScope | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  /* --- derived data --- */
  const activePolicies = useMemo(
    () => (policyState ? getActivePolicies(policyState) : []),
    [policyState],
  );

  const activeIds = useMemo(
    () => new Set(activePolicies.map((ps) => ps.policyId)),
    [activePolicies],
  );

  const filteredPolicies = useMemo(() => {
    if (!policyState) return [];
    const policies = policyState.activePolicies;
    if (scopeFilter === 'all') return policies;
    // Filter by scope using model data
    return policies.filter((ps) => {
      const model = getPolicyModelById(ps.policyId, nationId);
      return model ? model.scope === scopeFilter : true;
    });
  }, [policyState, scopeFilter, nationId]);

  const aggregateImpact = useMemo(() => {
    if (!policyState || activePolicies.length === 0) return null;
    // Compute from model data for accurate display
    const aggregate: Record<string, number> = {};
    for (const ps of activePolicies) {
      if (ps.status !== 'active') continue;
      const model = getPolicyModelById(ps.policyId, nationId);
      if (!model) continue;
      for (const di of model.dimensionalImpacts) {
        aggregate[di.dimension] = (aggregate[di.dimension] ?? 0) + di.magnitude;
      }
    }
    return aggregate;
  }, [policyState, activePolicies, nationId]);

  const totalCost = useMemo(() => {
    let cost = 0;
    for (const ps of activePolicies) {
      if (ps.status !== 'active') continue;
      const model = getPolicyModelById(ps.policyId, nationId);
      cost += model?.costPerTurn ?? 0;
    }
    return cost;
  }, [activePolicies, nationId]);

  const netImpactSummary = useMemo(() => {
    if (!aggregateImpact) return 0;
    return Object.values(aggregateImpact).reduce((sum, v) => sum + v, 0);
  }, [aggregateImpact]);

  const handleAddPolicy = useCallback((model: PolicyModel) => {
    onAddPolicy(model);
    setShowAddModal(false);
  }, [onAddPolicy]);

  /* --- placeholder / empty states --- */
  if (!policyState) {
    return (
      <div style={s.root}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, fontSize: 18, color: '#888', textAlign: 'center', flexDirection: 'column', gap: 16 }}>
          <span>🏛️ Policy System — Available after game starts</span>
        </div>
      </div>
    );
  }

  /* --- render --- */
  return (
    <div style={s.root}>
      {/* ---- Overview Bar ---- */}
      <div style={s.overviewBar}>
        <div style={s.overviewItem}>
          <span style={s.overviewLabel}>Nation</span>
          <span style={s.overviewValue}>{nationName}</span>
        </div>
        <div style={s.overviewItem}>
          <span style={s.overviewLabel}>Active Policies</span>
          <span style={s.overviewValue}>{activePolicies.length}</span>
        </div>
        <div style={s.overviewItem}>
          <span style={s.overviewLabel}>Net Impact</span>
          <span
            style={{
              ...s.overviewValue,
              color: netImpactSummary > 0 ? '#4caf50' : netImpactSummary < 0 ? '#ef5350' : '#888',
            }}
          >
            {netImpactSummary > 0 ? '+' : ''}
            {netImpactSummary.toFixed(1)}
          </span>
        </div>
        <div style={s.overviewItem}>
          <span style={s.overviewLabel}>Total Cost</span>
          <span style={{ ...s.overviewValue, color: '#ffa726' }}>
            ${totalCost}B/turn
          </span>
        </div>
        <div style={s.overviewItem}>
          <span style={s.overviewLabel}>History</span>
          <span style={s.overviewValue}>
            {policyState.policyHistory.length} action{policyState.policyHistory.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ---- Scope Filter + Add Button ---- */}
      <div style={{ ...s.tabRow, alignItems: 'center' }}>
        {SCOPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            style={s.tab(scopeFilter === f.value)}
            onClick={() => setScopeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          style={s.addBtn}
          onClick={() => setShowAddModal(true)}
        >
          + Add Policy
        </button>
      </div>

      {/* ---- Columns ---- */}
      <div style={s.columns}>
        {/* Main — Policy Cards */}
        <div style={s.mainCol}>
          {filteredPolicies.length === 0 && (
            <div style={{ ...s.card, color: '#555', textAlign: 'center', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40 }}>🏛️</span>
              <span>No active policies{scopeFilter !== 'all' ? ` with "${scopeFilter}" scope` : ''}</span>
              <button
                type="button"
                style={s.enactBtn}
                onClick={() => setShowAddModal(true)}
              >
                + Browse Policy Catalog
              </button>
            </div>
          )}
          {filteredPolicies.map((ps) => (
            <ActivePolicyCard
              key={ps.policyId}
              ps={ps}
              model={getPolicyModelById(ps.policyId, nationId)}
              onRepeal={onRemovePolicy}
            />
          ))}
        </div>

        {/* Side — Aggregate Impact + Repealed */}
        <div style={s.sideCol}>
          {/* Aggregate Impact Panel */}
          <div style={s.card}>
            <div style={s.panelTitle}>📊 Aggregate Impact</div>
            {!aggregateImpact || Object.keys(aggregateImpact).length === 0 ? (
              <div style={{ fontSize: 12, color: '#555' }}>No active policies to aggregate</div>
            ) : (
              Object.entries(aggregateImpact)
                .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                .map(([dim, value]) => <DimensionBar key={dim} dim={dim} value={value} />)
            )}
            {aggregateImpact && Object.keys(aggregateImpact).length > 0 && (
              <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid #222', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Net Impact</span>
                  <span style={{ fontWeight: 700, color: netImpactSummary > 0 ? '#4caf50' : netImpactSummary < 0 ? '#ef5350' : '#888' }}>
                    {netImpactSummary > 0 ? '+' : ''}{netImpactSummary.toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: '#888' }}>Total Cost</span>
                  <span style={{ fontWeight: 700, color: '#ffa726' }}>${totalCost}B/turn</span>
                </div>
              </div>
            )}
          </div>

          {/* Policy Summary Panel */}
          <div style={s.card}>
            <div style={s.panelTitle}>📋 Policy Summary</div>
            <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6 }}>
              <div>🏠 Domestic: <strong>{activePolicies.filter((ps) => getPolicyModelById(ps.policyId, nationId)?.scope === 'domestic').length}</strong></div>
              <div>🤝 Bilateral: <strong>{activePolicies.filter((ps) => getPolicyModelById(ps.policyId, nationId)?.scope === 'bilateral').length}</strong></div>
              <div>🌐 Multilateral: <strong>{activePolicies.filter((ps) => getPolicyModelById(ps.policyId, nationId)?.scope === 'multilateral').length}</strong></div>
              <div style={{ marginTop: 6, borderTop: '1px solid #222', paddingTop: 6 }}>
                📜 Repealed: <strong>{policyState.repealedPolicies.length}</strong>
              </div>
            </div>
          </div>

          {/* Repealed Policies Panel */}
          {policyState.repealedPolicies.length > 0 && (
            <div style={s.card}>
              <div style={{ ...s.panelTitle, color: '#ef5350' }}>🚫 Repealed Policies</div>
              {policyState.repealedPolicies.map((ps) => {
                const model = getPolicyModelById(ps.policyId, nationId);
                return (
                  <div key={ps.policyId} style={{ fontSize: 12, color: '#555', padding: '5px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <div style={{ fontWeight: 600, color: '#888' }}>
                      ✕ {model?.name ?? ps.policyId}
                    </div>
                    <div>
                      {ps.turnsActive} turn{ps.turnsActive !== 1 ? 's' : ''} active
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- Add Policy Modal ---- */}
      {showAddModal && (
        <AddPolicyModal
          nationId={nationId}
          activeIds={activeIds}
          onEnact={handleAddPolicy}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

export { PolicyDashboard };
