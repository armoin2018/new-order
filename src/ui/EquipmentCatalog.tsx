/**
 * CNFL-3205 — Military Equipment Catalog Browser
 *
 * Browse military equipment by category/subcategory, search, sort,
 * compare side-by-side, and view stat cards with radar-style bars.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EquipmentItem {
  equipmentId: string;
  name: string;
  category: string;
  subcategory: string;
  nation: string;
  description: string;
  purchaseCost: number;
  maintenanceCostPerTurn: number;
  attackPower: number;
  defensePower: number;
  range: number;
  speed: number;
  stealthRating: number;
  buildTime: number;
  tags: string[];
}

type SortKey = 'name' | 'purchaseCost' | 'attackPower' | 'defensePower' | 'range' | 'speed';
type ViewMode = 'grid' | 'list';

export interface EquipmentCatalogProps {
  items: EquipmentItem[];
  onAddToWishlist?: (equipmentId: string) => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = { width: '100%', maxWidth: 1200, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const filterBar: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' };
const selectStyle: CSSProperties = { padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 12, fontFamily: 'inherit' };
const searchStyle: CSSProperties = { padding: '6px 12px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 180 };
const statBarOuter: CSSProperties = { height: 6, borderRadius: 3, backgroundColor: '#222', overflow: 'hidden', flex: 1 };

function statColor(val: number, max: number): string {
  const pct = val / max;
  if (pct >= 0.7) return '#4caf50';
  if (pct >= 0.4) return '#ffaa00';
  return '#ff4a4a';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const EquipmentCatalog: FC<EquipmentCatalogProps> = ({ items, onAddToWishlist }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category));
    return ['all', ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (categoryFilter !== 'all') list = list.filter((i) => i.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q)));
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b[sortBy] as number) - (a[sortBy] as number);
    });
    return list;
  }, [items, categoryFilter, search, sortBy]);

  const selectedItem = useMemo(() => items.find((i) => i.equipmentId === selectedId) ?? null, [items, selectedId]);
  const compareItems = useMemo(() => items.filter((i) => compareIds.includes(i.equipmentId)), [items, compareIds]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  const STAT_KEYS: { key: keyof EquipmentItem; label: string; max: number }[] = [
    { key: 'attackPower', label: 'ATK', max: 100 },
    { key: 'defensePower', label: 'DEF', max: 100 },
    { key: 'range', label: 'RNG', max: 10 },
    { key: 'speed', label: 'SPD', max: 10 },
    { key: 'stealthRating', label: 'STL', max: 100 },
  ];

  return (
    <div style={panel} data-testid="equipment-catalog">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🛡️ Military Equipment Catalog
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Browse, compare, and plan procurement across all equipment categories.
      </p>

      {/* ── Filters ───────────────────────────────────── */}
      <div style={filterBar} data-testid="filter-bar">
        <input
          data-testid="input-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment…"
          style={searchStyle}
        />
        <select data-testid="select-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>
        <select data-testid="select-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle}>
          <option value="name">Name</option>
          <option value="purchaseCost">Cost</option>
          <option value="attackPower">Attack</option>
          <option value="defensePower">Defense</option>
          <option value="range">Range</option>
          <option value="speed">Speed</option>
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['grid', 'list'] as ViewMode[]).map((m) => (
            <button
              key={m}
              data-testid={`view-${m}`}
              onClick={() => setViewMode(m)}
              style={{
                padding: '4px 10px', fontSize: 11, border: viewMode === m ? '1px solid #4caf50' : '1px solid #444',
                borderRadius: 3, background: viewMode === m ? 'rgba(76,175,80,0.1)' : 'transparent',
                color: viewMode === m ? '#4caf50' : '#888', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results count ─────────────────────────────── */}
      <div style={{ fontSize: 11, color: '#666', marginBottom: 12 }} data-testid="result-count">
        {filtered.length} item{filtered.length !== 1 ? 's' : ''} found
      </div>

      {/* ── Item Grid / List ──────────────────────────── */}
      <div
        style={{
          display: viewMode === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined,
          flexDirection: viewMode === 'list' ? 'column' : undefined,
          gap: 12,
          marginBottom: 24,
        }}
        data-testid="item-container"
      >
        {filtered.map((item) => {
          const isComparing = compareIds.includes(item.equipmentId);
          const isSelected = selectedId === item.equipmentId;
          return (
            <div
              key={item.equipmentId}
              data-testid={`item-${item.equipmentId}`}
              onClick={() => setSelectedId(item.equipmentId)}
              style={{
                backgroundColor: isSelected ? '#0d1a0d' : '#111',
                border: isSelected ? '2px solid #4caf50' : isComparing ? '2px solid #ffaa00' : '1px solid #333',
                borderRadius: 8, padding: 14, cursor: 'pointer',
                display: viewMode === 'list' ? 'flex' : 'block',
                gap: viewMode === 'list' ? 16 : undefined,
                alignItems: viewMode === 'list' ? 'center' : undefined,
              }}
            >
              <div style={{ flex: viewMode === 'list' ? 1 : undefined }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
                  {item.category} · {item.subcategory} · {item.nation}
                </div>
                {viewMode === 'grid' && (
                  <div style={{ fontSize: 11, color: '#777', marginBottom: 8, lineHeight: 1.5 }}>
                    {item.description.slice(0, 100)}{item.description.length > 100 ? '…' : ''}
                  </div>
                )}
              </div>

              {/* Stat Bars */}
              <div style={{ minWidth: viewMode === 'list' ? 200 : undefined }}>
                {STAT_KEYS.map(({ key, label, max }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: '#666', width: 28 }}>{label}</span>
                    <div style={statBarOuter}>
                      <div style={{ width: `${((item[key] as number) / max) * 100}%`, height: '100%', backgroundColor: statColor(item[key] as number, max), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, width: 24, textAlign: 'right' }}>{item[key] as number}</span>
                  </div>
                ))}
              </div>

              {/* Cost & Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>💰 ${item.purchaseCost}B · 🔧 ${item.maintenanceCostPerTurn}/turn</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    data-testid={`compare-${item.equipmentId}`}
                    onClick={(e) => { e.stopPropagation(); toggleCompare(item.equipmentId); }}
                    style={{
                      padding: '2px 8px', fontSize: 9, border: isComparing ? '1px solid #ffaa00' : '1px solid #444',
                      borderRadius: 3, background: isComparing ? 'rgba(255,170,0,0.1)' : 'transparent',
                      color: isComparing ? '#ffaa00' : '#888', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {isComparing ? '✓ Compare' : 'Compare'}
                  </button>
                  {onAddToWishlist && (
                    <button
                      data-testid={`wishlist-${item.equipmentId}`}
                      onClick={(e) => { e.stopPropagation(); onAddToWishlist(item.equipmentId); }}
                      style={{
                        padding: '2px 8px', fontSize: 9, border: '1px solid #444',
                        borderRadius: 3, background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      + Wishlist
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Comparison Panel ──────────────────────────── */}
      {compareItems.length >= 2 && (
        <div data-testid="comparison-panel" style={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#ffaa00' }}>⚔️ Side-by-Side Comparison</div>
          <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${compareItems.length}, 1fr)`, gap: 8, fontSize: 12 }}>
            <div />
            {compareItems.map((c) => <div key={c.equipmentId} style={{ fontWeight: 700, textAlign: 'center' }}>{c.name}</div>)}
            {STAT_KEYS.map(({ key, label }) => (
              <>
                <div key={`lbl-${key}`} style={{ color: '#888' }}>{label}</div>
                {compareItems.map((c) => (
                  <div key={`${c.equipmentId}-${key}`} style={{ textAlign: 'center', fontWeight: 600 }}>
                    {c[key] as number}
                  </div>
                ))}
              </>
            ))}
            <div style={{ color: '#888' }}>Cost</div>
            {compareItems.map((c) => <div key={`${c.equipmentId}-cost`} style={{ textAlign: 'center' }}>${c.purchaseCost}B</div>)}
          </div>
        </div>
      )}

      {/* ── Detail Panel ──────────────────────────────── */}
      {selectedItem && (
        <div data-testid="detail-panel" style={{ backgroundColor: '#111', border: '1px solid #4caf50', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedItem.name}</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{selectedItem.category} · {selectedItem.subcategory} · {selectedItem.nation}</div>
          <p style={{ fontSize: 13, color: '#bbb', lineHeight: 1.6, marginBottom: 12 }}>{selectedItem.description}</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
            <span>ATK: <strong>{selectedItem.attackPower}</strong></span>
            <span>DEF: <strong>{selectedItem.defensePower}</strong></span>
            <span>RNG: <strong>{selectedItem.range}</strong></span>
            <span>SPD: <strong>{selectedItem.speed}</strong></span>
            <span>STL: <strong>{selectedItem.stealthRating}</strong></span>
            <span>Build: <strong>{selectedItem.buildTime} turns</strong></span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            {selectedItem.tags.map((t) => (
              <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, backgroundColor: '#1a1a2e', color: '#aac', fontWeight: 600 }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
