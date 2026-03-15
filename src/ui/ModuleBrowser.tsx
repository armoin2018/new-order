/**
 * CNFL-3800 — Module Browser
 *
 * Main entry point for the Module Builder — browse, search, filter,
 * and navigate to modules across all types (leaders, military, tech, etc.).
 * Supports grid/list views, type tabs with count badges, pagination,
 * and debounced search.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModuleSummary {
  id: string;
  name: string;
  moduleType: string;
  subcategory?: string;
  description?: string;
  tags?: string[];
  updatedAt?: string;
}

export type ModuleType =
  | 'leaders'
  | 'political-systems'
  | 'military'
  | 'technology'
  | 'education'
  | 'population'
  | 'religion'
  | 'scenarios'
  | 'markets';

export type ViewMode = 'grid' | 'list';
export type SortKey = 'name' | 'moduleType' | 'updatedAt';

export interface ModuleBrowserProps {
  modules: ModuleSummary[];
  moduleCounts?: Record<string, number>;
  onSelectModule?: (moduleType: string, id: string) => void;
  onCreateModule?: (moduleType: string) => void;
  onDeleteModule?: (moduleType: string, id: string) => void;
  onCloneModule?: (moduleType: string, id: string) => void;
}

const MODULE_TYPES: ModuleType[] = [
  'leaders', 'political-systems', 'military', 'technology',
  'education', 'population', 'religion', 'scenarios', 'markets',
];

const TYPE_LABELS: Record<ModuleType, string> = {
  leaders: 'Leaders',
  'political-systems': 'Political Systems',
  military: 'Military',
  technology: 'Technology',
  education: 'Education',
  population: 'Population',
  religion: 'Religion',
  scenarios: 'Scenarios',
  markets: 'Markets',
};

const PAGE_SIZE = 20;

// ─── Styles ─────────────────────────────────────────────────────────────────

const root: CSSProperties = { width: '100%', maxWidth: 1400, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const tabBar: CSSProperties = { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid #333', paddingBottom: 8 };
const tabBase: CSSProperties = { padding: '6px 14px', border: '1px solid #333', borderRadius: 4, background: 'transparent', color: '#999', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 };
const tabActive: CSSProperties = { ...tabBase, background: '#1a3a5c', color: '#4fc3f7', borderColor: '#4fc3f7' };
const badge: CSSProperties = { background: '#333', padding: '1px 6px', borderRadius: 8, fontSize: 10, color: '#aaa', minWidth: 18, textAlign: 'center' };
const badgeActive: CSSProperties = { ...badge, background: '#4fc3f7', color: '#0a0a0a' };
const toolbar: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' };
const searchInput: CSSProperties = { padding: '8px 14px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 200 };
const selectInput: CSSProperties = { padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary: CSSProperties = { padding: '8px 16px', background: '#1976d2', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 };
const btnIcon: CSSProperties = { padding: '6px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 4, color: '#aaa', cursor: 'pointer', fontSize: 14 };
const btnIconActive: CSSProperties = { ...btnIcon, color: '#4fc3f7', borderColor: '#4fc3f7' };
const gridContainer: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 };
const card: CSSProperties = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' };
const cardHover: CSSProperties = { ...card, borderColor: '#4fc3f7' };
const listRow: CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', alignItems: 'center', fontSize: 13 };
const listHeader: CSSProperties = { ...listRow, cursor: 'default', fontWeight: 600, color: '#aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
const emptyState: CSSProperties = { textAlign: 'center', padding: 48, color: '#666' };
const paginationBar: CSSProperties = { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' };
const pageBtn: CSSProperties = { padding: '4px 10px', border: '1px solid #333', borderRadius: 4, background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 };
const pageBtnActive: CSSProperties = { ...pageBtn, background: '#1976d2', color: '#fff', borderColor: '#1976d2' };
const actionsRow: CSSProperties = { display: 'flex', gap: 6, marginTop: 8 };
const smallBtn: CSSProperties = { padding: '3px 8px', border: '1px solid #333', borderRadius: 3, background: 'transparent', color: '#999', cursor: 'pointer', fontSize: 11 };
const tagStyle: CSSProperties = { display: 'inline-block', padding: '1px 6px', borderRadius: 3, background: '#1a1a1a', color: '#888', fontSize: 10, marginRight: 4 };

// ─── Component ──────────────────────────────────────────────────────────────

export const ModuleBrowser: FC<ModuleBrowserProps> = ({
  modules,
  moduleCounts,
  onSelectModule,
  onCreateModule,
  onDeleteModule,
  onCloneModule,
}) => {
  const [activeTab, setActiveTab] = useState<ModuleType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch, sortBy, sortDir]);

  const filtered = useMemo(() => {
    let list = modules;
    if (activeTab !== 'all') list = list.filter((m) => m.moduleType === activeTab);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    list = [...list].sort((a, b) => {
      const valA = a[sortBy] ?? '';
      const valB = b[sortBy] ?? '';
      const cmp = typeof valA === 'string' ? valA.localeCompare(valB as string) : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [modules, activeTab, debouncedSearch, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleTabClick = useCallback((tab: ModuleType | 'all') => { setActiveTab(tab); }, []);

  const getCount = (type: ModuleType | 'all'): number => {
    if (type === 'all') return modules.length;
    return moduleCounts?.[type] ?? modules.filter((m) => m.moduleType === type).length;
  };

  return (
    <div data-testid="module-browser" style={root}>
      {/* Header */}
      <div style={header}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#fff' }}>Module Builder</h2>
        {onCreateModule && activeTab !== 'all' && (
          <button data-testid="create-btn" style={btnPrimary} onClick={() => onCreateModule(activeTab)}>
            + Create {TYPE_LABELS[activeTab as ModuleType] ?? 'Module'}
          </button>
        )}
      </div>

      {/* Type Tabs */}
      <div data-testid="type-tabs" style={tabBar}>
        <button
          data-testid="tab-all"
          style={activeTab === 'all' ? tabActive : tabBase}
          onClick={() => handleTabClick('all')}
        >
          All <span style={activeTab === 'all' ? badgeActive : badge}>{getCount('all')}</span>
        </button>
        {MODULE_TYPES.map((type) => (
          <button
            key={type}
            data-testid={`tab-${type}`}
            style={activeTab === type ? tabActive : tabBase}
            onClick={() => handleTabClick(type)}
          >
            {TYPE_LABELS[type]} <span style={activeTab === type ? badgeActive : badge}>{getCount(type)}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div data-testid="toolbar" style={toolbar}>
        <input
          data-testid="search-input"
          type="text"
          placeholder="Search modules..."
          style={searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select data-testid="sort-select" style={selectInput} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="name">Name</option>
          <option value="moduleType">Type</option>
          <option value="updatedAt">Updated</option>
        </select>
        <button
          data-testid="sort-dir"
          style={btnIcon}
          onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
        <button
          data-testid="view-grid"
          style={viewMode === 'grid' ? btnIconActive : btnIcon}
          onClick={() => setViewMode('grid')}
          title="Grid view"
        >▦</button>
        <button
          data-testid="view-list"
          style={viewMode === 'list' ? btnIconActive : btnIcon}
          onClick={() => setViewMode('list')}
          title="List view"
        >☰</button>
      </div>

      {/* Content */}
      {paged.length === 0 ? (
        <div data-testid="empty-state" style={emptyState}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No modules found</p>
          <p style={{ fontSize: 13 }}>Try adjusting your search or filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div data-testid="grid-view" style={gridContainer}>
          {paged.map((m) => (
            <div
              key={`${m.moduleType}-${m.id}`}
              data-testid={`card-${m.id}`}
              style={hoveredId === m.id ? cardHover : card}
              onClick={() => onSelectModule?.(m.moduleType, m.id)}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{m.name}</span>
                <span style={tagStyle}>{TYPE_LABELS[m.moduleType as ModuleType] ?? m.moduleType}</span>
              </div>
              {m.subcategory && <div style={{ ...tagStyle, marginBottom: 8 }}>{m.subcategory}</div>}
              {m.description && (
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {m.description}
                </p>
              )}
              {m.tags && m.tags.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {m.tags.slice(0, 4).map((t) => <span key={t} style={tagStyle}>{t}</span>)}
                </div>
              )}
              <div style={actionsRow}>
                {onCloneModule && <button data-testid={`clone-${m.id}`} style={smallBtn} onClick={(e) => { e.stopPropagation(); onCloneModule(m.moduleType, m.id); }}>Clone</button>}
                {onDeleteModule && <button data-testid={`delete-${m.id}`} style={smallBtn} onClick={(e) => { e.stopPropagation(); onDeleteModule(m.moduleType, m.id); }}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="list-view">
          <div style={listHeader}>
            <span>Name</span>
            <span>Type</span>
            <span>Tags</span>
            <span>Actions</span>
          </div>
          {paged.map((m) => (
            <div
              key={`${m.moduleType}-${m.id}`}
              data-testid={`row-${m.id}`}
              style={listRow}
              onClick={() => onSelectModule?.(m.moduleType, m.id)}
            >
              <span style={{ color: '#fff' }}>{m.name}</span>
              <span style={{ color: '#aaa' }}>{TYPE_LABELS[m.moduleType as ModuleType] ?? m.moduleType}</span>
              <span>{m.tags?.slice(0, 3).map((t) => <span key={t} style={tagStyle}>{t}</span>)}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {onCloneModule && <button data-testid={`clone-${m.id}`} style={smallBtn} onClick={(e) => { e.stopPropagation(); onCloneModule(m.moduleType, m.id); }}>Clone</button>}
                {onDeleteModule && <button data-testid={`delete-${m.id}`} style={smallBtn} onClick={(e) => { e.stopPropagation(); onDeleteModule(m.moduleType, m.id); }}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div data-testid="pagination" style={paginationBar}>
          <button style={pageBtn} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>← Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button key={p} data-testid={`page-${p}`} style={page === p ? pageBtnActive : pageBtn} onClick={() => setPage(p)}>
                {p}
              </button>
            );
          })}
          {totalPages > 7 && <span style={{ color: '#666' }}>…</span>}
          <button style={pageBtn} onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next →</button>
          <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>
            {filtered.length} module{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};
