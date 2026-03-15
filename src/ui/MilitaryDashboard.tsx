/**
 * CNFL-3206 — Military Resource Management Dashboard
 *
 * Displays inventory, budget, procurement queue, deployment status,
 * readiness percentages, and quick-action buttons.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InventoryEntry {
  equipmentId: string;
  name: string;
  category: string;
  quantity: number;
  deployed: number;
  inTransit: number;
  readinessPercent: number;
  maintenanceCostPerTurn: number;
}

export interface ProcurementOrder {
  orderId: string;
  equipmentId: string;
  name: string;
  quantity: number;
  turnsRemaining: number;
  totalCost: number;
}

export interface MilitaryBudget {
  totalBudget: number;
  maintenanceCost: number;
  procurementSpending: number;
  available: number;
}

export type QuickAction = 'buy' | 'sell' | 'relocate' | 'recall';

export interface MilitaryDashboardProps {
  inventory: InventoryEntry[];
  procurementQueue: ProcurementOrder[];
  budget: MilitaryBudget;
  overallReadiness: number;
  onQuickAction?: (action: QuickAction, equipmentId: string) => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = { width: '100%', maxWidth: 1100, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionTitle: CSSProperties = { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 16, marginTop: 24 };
const card: CSSProperties = { backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 12 };
const metricCard: CSSProperties = { textAlign: 'center', padding: 16, backgroundColor: '#111', borderRadius: 8, border: '1px solid #333' };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const th: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #333', color: '#888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' };
const td: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #1a1a1a' };
const miniBtn: CSSProperties = { padding: '2px 8px', fontSize: 9, border: '1px solid #444', borderRadius: 3, background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 };

function readinessColor(pct: number): string {
  if (pct >= 80) return '#4caf50';
  if (pct >= 50) return '#ffaa00';
  return '#ff4a4a';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const MilitaryDashboard: FC<MilitaryDashboardProps> = ({
  inventory,
  procurementQueue,
  budget,
  overallReadiness,
  onQuickAction,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set(inventory.map((i) => i.category));
    return ['all', ...Array.from(cats).sort()];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (categoryFilter === 'all') return inventory;
    return inventory.filter((i) => i.category === categoryFilter);
  }, [inventory, categoryFilter]);

  const totalUnits = useMemo(() => inventory.reduce((sum, i) => sum + i.quantity, 0), [inventory]);
  const totalDeployed = useMemo(() => inventory.reduce((sum, i) => sum + i.deployed, 0), [inventory]);

  return (
    <div style={panel} data-testid="military-dashboard">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🎖️ Military Resource Management
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Manage inventory, procurement, and deployment across all military branches.
      </p>

      {/* ── Top Metrics ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }} data-testid="metrics-row">
        <div style={metricCard}>
          <div style={{ fontSize: 24, fontWeight: 800, color: readinessColor(overallReadiness) }}>{overallReadiness}%</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4, textTransform: 'uppercase' }}>Overall Readiness</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{totalUnits}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4, textTransform: 'uppercase' }}>Total Units</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ffaa00' }}>{totalDeployed}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4, textTransform: 'uppercase' }}>Deployed</div>
        </div>
        <div style={metricCard}>
          <div style={{ fontSize: 24, fontWeight: 800, color: budget.available >= 0 ? '#4caf50' : '#ff4a4a' }}>
            ${budget.available}B
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4, textTransform: 'uppercase' }}>Available Budget</div>
        </div>
      </div>

      {/* ── Budget Breakdown ──────────────────────────── */}
      <div style={sectionTitle}>Budget Breakdown</div>
      <div style={{ ...card, display: 'flex', gap: 24 }} data-testid="budget-breakdown">
        <div><span style={{ fontSize: 11, color: '#888' }}>Total:</span> <strong>${budget.totalBudget}B</strong></div>
        <div><span style={{ fontSize: 11, color: '#888' }}>Maintenance:</span> <strong style={{ color: '#ff6600' }}>${budget.maintenanceCost}B</strong></div>
        <div><span style={{ fontSize: 11, color: '#888' }}>Procurement:</span> <strong style={{ color: '#ffaa00' }}>${budget.procurementSpending}B</strong></div>
        <div><span style={{ fontSize: 11, color: '#888' }}>Available:</span> <strong style={{ color: '#4caf50' }}>${budget.available}B</strong></div>
      </div>

      {/* ── Inventory Table ───────────────────────────── */}
      <div style={sectionTitle}>
        Inventory
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          data-testid="select-inv-category"
          style={{ marginLeft: 12, padding: '2px 8px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 3, color: '#ccc', fontSize: 11 }}
        >
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All' : c}</option>)}
        </select>
      </div>
      <div style={card}>
        <table style={table} data-testid="inventory-table">
          <thead>
            <tr>
              <th style={th}>Equipment</th>
              <th style={th}>Category</th>
              <th style={th}>Qty</th>
              <th style={th}>Deployed</th>
              <th style={th}>In Transit</th>
              <th style={th}>Readiness</th>
              <th style={th}>Maint/Turn</th>
              {onQuickAction && <th style={th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.equipmentId} data-testid={`inv-row-${item.equipmentId}`}>
                <td style={td}>{item.name}</td>
                <td style={{ ...td, color: '#888' }}>{item.category}</td>
                <td style={td}>{item.quantity}</td>
                <td style={td}>{item.deployed}</td>
                <td style={td}>{item.inTransit}</td>
                <td style={td}>
                  <span style={{ color: readinessColor(item.readinessPercent), fontWeight: 600 }}>{item.readinessPercent}%</span>
                </td>
                <td style={td}>${item.maintenanceCostPerTurn}</td>
                {onQuickAction && (
                  <td style={td}>
                    {(['buy', 'sell', 'relocate', 'recall'] as QuickAction[]).map((a) => (
                      <button
                        key={a}
                        data-testid={`action-${a}-${item.equipmentId}`}
                        onClick={() => onQuickAction(a, item.equipmentId)}
                        style={miniBtn}
                      >
                        {a}
                      </button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Procurement Queue ─────────────────────────── */}
      <div style={sectionTitle}>Procurement Queue ({procurementQueue.length})</div>
      <div style={card}>
        {procurementQueue.length === 0 ? (
          <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 16 }}>No active orders</div>
        ) : (
          <table style={table} data-testid="procurement-table">
            <thead>
              <tr>
                <th style={th}>Equipment</th>
                <th style={th}>Qty</th>
                <th style={th}>Turns Left</th>
                <th style={th}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {procurementQueue.map((o) => (
                <tr key={o.orderId} data-testid={`order-${o.orderId}`}>
                  <td style={td}>{o.name}</td>
                  <td style={td}>{o.quantity}</td>
                  <td style={td}>{o.turnsRemaining}</td>
                  <td style={td}>${o.totalCost}B</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
