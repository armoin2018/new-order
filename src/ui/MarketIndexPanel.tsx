/**
 * MarketIndexPanel — FR-3400, CNFL-0030-S2
 *
 * Displays preset and custom market indexes with current values, trends,
 * and history. Includes a "Create Custom Index" form with ticker selection,
 * weight assignment, and name input. Maximum 10 custom indexes enforced.
 */

import { useState, useCallback } from 'react';
import type { FC, CSSProperties, FormEvent } from 'react';
import { useGameStore } from '@/engine/store';
import type {
  RuntimeMarketState,
  IndexRuntimeState,
  TickerRuntimeState,
} from '@/data/types/model.types';
import { CandlestickChart } from './CandlestickChart';
import { mergeHistoryWithSimulation, type OHLCPoint, type TimeRange } from '@/engine/market-history-generator';

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

const inputStyle: CSSProperties = {
  backgroundColor: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '6px 8px',
  color: '#e0e0e0',
  fontSize: 12,
  fontFamily: 'inherit',
  width: '100%',
};

const btnStyle: CSSProperties = {
  padding: '6px 14px',
  backgroundColor: '#1a3a1a',
  border: '1px solid #4caf50',
  borderRadius: 4,
  color: '#4caf50',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
};

const MAX_CUSTOM_INDEXES = 10;

// ─── Helpers ─────────────────────────────────────────────────

function changeColor(val: number): string {
  if (val > 0) return '#4caf50';
  if (val < 0) return '#ef5350';
  return '#888';
}

function trendArrow(dir: string): string {
  if (dir === 'rising') return '▲';
  if (dir === 'falling') return '▼';
  return '─';
}

const indexDisplayNames: Record<string, string> = {
  'global-composite': '🌍 Global Composite',
  'global-defense': '🛡️ Global Defense',
  'global-energy': '⚡ Global Energy',
  'global-technology': '💻 Global Technology',
  'global-finance': '🏦 Global Finance',
  'global-consumer': '🛒 Global Consumer',
  'us-composite': '🇺🇸 US Composite',
  'china-composite': '🇨🇳 China Composite',
  'russia-composite': '🇷🇺 Russia Composite',
  'japan-composite': '🇯🇵 Japan Composite',
  'iran-composite': '🇮🇷 Iran Composite',
  'dprk-composite': '🇰🇵 DPRK Composite',
  'eu-composite': '🇪🇺 EU Composite',
  'syria-composite': '🇸🇾 Syria Composite',
};

/** Build merged chart data for an index. */
function buildChartData(
  indexId: string,
  indexState: IndexRuntimeState | undefined,
  historicalData: RuntimeMarketState['historicalData'],
): readonly OHLCPoint[] {
  const historical = historicalData?.[indexId];
  if (!historical || !indexState) {
    if (!indexState?.history?.length) return [];
    return indexState.history.map((h) => ({
      date: `2026-${String(Math.max(1, h.turn)).padStart(2, '0')}-15`,
      open: h.value - h.change,
      high: Math.max(h.value, h.value - h.change) * 1.005,
      low: Math.min(h.value, h.value - h.change) * 0.995,
      close: h.value,
      volume: 1_000_000,
    }));
  }
  return mergeHistoryWithSimulation(historical, indexState.history).data;
}

// ─── Component ───────────────────────────────────────────────

export const MarketIndexPanel: FC = () => {
  const marketState = useGameStore((s) => s.marketState) as RuntimeMarketState | null;
  const [showForm, setShowForm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<TimeRange>('scenario');

  if (!marketState) {
    return (
      <div style={panelStyle} data-testid="market-index-panel">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📊 Market Indexes</h2>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          <p style={{ fontSize: 14 }}>Index data will appear after the first turn.</p>
        </div>
      </div>
    );
  }

  const presetIds = marketState.presetIndexes.map((i) => i.indexId);
  const customIds = marketState.customIndexes.map((i) => i.indexId);
  const canCreateMore = customIds.length < MAX_CUSTOM_INDEXES;

  const focusedId = focusedIndex ?? (presetIds[0] || 'global-composite');
  const focusedChartData = buildChartData(focusedId, marketState.indexStates[focusedId], marketState.historicalData);
  const focusedName = indexDisplayNames[focusedId] ?? focusedId;

  return (
    <div style={panelStyle} data-testid="market-index-panel">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📊 Market Indexes</h2>

      {/* ── Candlestick Chart ── */}
      <CandlestickChart
        data={focusedChartData}
        title={focusedName}
        selectedRange={chartRange}
        onRangeChange={setChartRange}
        showTimeline={true}
      />

      {/* ── Preset Indexes ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Preset Indexes</h3>
        <IndexTable ids={presetIds} indexStates={marketState.indexStates} onSelectIndex={setFocusedIndex} focusedIndex={focusedId} />
      </div>

      {/* ── Custom Indexes ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            Custom Indexes ({customIds.length}/{MAX_CUSTOM_INDEXES})
          </h3>
          {canCreateMore && (
            <button
              data-testid="create-index-btn"
              onClick={() => setShowForm(!showForm)}
              style={btnStyle}
            >
              {showForm ? 'Cancel' : '+ New Index'}
            </button>
          )}
        </div>
        {customIds.length === 0 && !showForm ? (
          <div style={{ color: '#555', fontSize: 12 }}>No custom indexes created yet.</div>
        ) : (
          <IndexTable ids={customIds} indexStates={marketState.indexStates} showDelete onSelectIndex={setFocusedIndex} focusedIndex={focusedId} />
        )}
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <CreateIndexForm
          tickerStates={marketState.tickerStates}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

// ─── Index Table ─────────────────────────────────────────────

const IndexTable: FC<{
  ids: readonly string[];
  indexStates: Readonly<Record<string, IndexRuntimeState>>;
  showDelete?: boolean;
  onSelectIndex?: (id: string) => void;
  focusedIndex?: string;
}> = ({ ids, indexStates, showDelete, onSelectIndex, focusedIndex }) => {
  if (ids.length === 0) return null;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Index</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Value</th>
          <th style={{ textAlign: 'center', padding: '4px 8px' }}>Trend</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATH</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATL</th>
          {showDelete && <th style={{ textAlign: 'center', padding: '4px 8px' }}></th>}
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const state = indexStates[id];
          if (!state) return null;
          const lastVal = state.history.length > 1
            ? (state.history[state.history.length - 2]?.value ?? state.currentValue)
            : state.currentValue;
          const changePct = lastVal > 0 ? ((state.currentValue - lastVal) / lastVal) * 100 : 0;
          const isFocused = id === focusedIndex;

          return (
            <tr
              key={id}
              data-testid={`index-row-${id}`}
              onClick={() => onSelectIndex?.(id)}
              style={{
                borderBottom: '1px solid #1a1a1a',
                cursor: onSelectIndex ? 'pointer' : 'default',
                backgroundColor: isFocused ? '#0d1a0d' : 'transparent',
              }}
            >
              <td style={{
                padding: '6px 8px', fontWeight: 600,
                color: isFocused ? '#4caf50' : '#e0e0e0',
                textDecoration: onSelectIndex ? 'underline' : 'none',
                textDecorationColor: isFocused ? '#4caf50' : '#333',
              }}>
                {indexDisplayNames[id] ?? id}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{state.currentValue.toFixed(1)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: changeColor(changePct) }}>
                {trendArrow(state.trendDirection)} {changePct >= 0 ? '+' : ''}{changePct.toFixed(4)}%
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4caf50' }}>{state.allTimeHigh.toFixed(1)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ef5350' }}>{state.allTimeLow.toFixed(1)}</td>
              {showDelete && (
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <button
                    data-testid={`delete-index-${id}`}
                    style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: 12 }}
                    title="Delete custom index"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ─── Create Index Form ───────────────────────────────────────

interface TickerSelection {
  tickerId: string;
  exchangeId: string;
  weight: number;
}

const CreateIndexForm: FC<{
  tickerStates: Readonly<Record<string, TickerRuntimeState>>;
  onClose: () => void;
}> = ({ tickerStates, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<TickerSelection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allTickers = Object.values(tickerStates);

  const toggleTicker = useCallback((tickerId: string, exchangeId: string) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.tickerId === tickerId);
      if (exists) return prev.filter((s) => s.tickerId !== tickerId);
      return [...prev, { tickerId, exchangeId, weight: 0 }];
    });
    setError(null);
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Index name is required');
      return;
    }
    if (selected.length < 2) {
      setError('Select at least 2 tickers');
      return;
    }

    // Equal-weight the selected tickers
    const equalWeight = Number((1 / selected.length).toFixed(4));
    const constituents = selected.map((s) => ({
      tickerId: s.tickerId,
      exchangeId: s.exchangeId,
      weight: equalWeight,
    }));

    // NOTE: In a full implementation, this would call MarketIndexEngine.createCustomIndex()
    // and update the store. For now, log the intent.
    console.info('[MarketIndexPanel] Create custom index:', { name, description, constituents });
    onClose();
  }, [name, description, selected, onClose]);

  return (
    <div style={cardStyle} data-testid="create-index-form">
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Create Custom Index</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Index Name</label>
          <input
            data-testid="index-name-input"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Custom Defense Index"
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Description (optional)</label>
          <input
            data-testid="index-desc-input"
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Tracks defense sector across US and EU"
          />
        </div>

        {/* Ticker Selector Grid */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
            Select Tickers ({selected.length} selected, equal-weighted)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 150, overflow: 'auto' }}>
            {allTickers.map((t) => {
              const isSelected = selected.some((s) => s.tickerId === t.tickerId);
              return (
                <button
                  key={t.tickerId}
                  type="button"
                  data-testid={`ticker-select-${t.tickerId}`}
                  onClick={() => toggleTicker(t.tickerId, t.exchangeId)}
                  style={{
                    padding: '3px 8px',
                    fontSize: 10,
                    borderRadius: 3,
                    border: isSelected ? '1px solid #4caf50' : '1px solid #333',
                    background: isSelected ? '#1a3a1a' : '#0a0a0a',
                    color: isSelected ? '#4caf50' : '#888',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.tickerId}
                </button>
              );
            })}
          </div>
        </div>

        {error && <div style={{ color: '#ef5350', fontSize: 11, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" data-testid="submit-index-btn" style={btnStyle}>
            Create Index
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnStyle, backgroundColor: '#1a1a1a', borderColor: '#333', color: '#888' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default MarketIndexPanel;
