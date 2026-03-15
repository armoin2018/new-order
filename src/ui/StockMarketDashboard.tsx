/**
 * StockMarketDashboard — FR-3300, FR-3400, FR-3306
 *
 * Displays per-exchange stock tickers, market indexes, and sentiment.
 * Reads from GameState.marketState (RuntimeMarketState).
 */

import { useState } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type {
  RuntimeMarketState,
  TickerRuntimeState,
  IndexRuntimeState,
  MarketEventLogEntry,
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

const exchangeNames: Record<string, string> = {
  nyse: '🇺🇸 NYSE',
  sse: '🇨🇳 SSE',
  moex: '🇷🇺 MOEX',
  tse: '🇯🇵 TSE',
  tedpix: '🇮🇷 TEDPIX',
  pse: '🇰🇵 PSE',
  euronext: '🇪🇺 Euronext',
  dse: '🇸🇾 DSE',
};

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

const exchangeToComposite: Record<string, string> = {
  nyse: 'us-composite',
  sse: 'china-composite',
  moex: 'russia-composite',
  tse: 'japan-composite',
  tedpix: 'iran-composite',
  pse: 'dprk-composite',
  euronext: 'eu-composite',
  dse: 'syria-composite',
};

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

function sentimentColor(s: string): string {
  if (s === 'bullish') return '#4caf50';
  if (s === 'bearish') return '#ef5350';
  return '#f59e0b';
}

/** Build merged chart data for an index: historical + simulation turns. */
function buildChartData(
  indexId: string,
  indexState: IndexRuntimeState | undefined,
  historicalData: RuntimeMarketState['historicalData'],
): readonly OHLCPoint[] {
  const historical = historicalData?.[indexId];
  if (!historical || !indexState) {
    // Fallback: build from simulation history only
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

export const StockMarketDashboard: FC = () => {
  const marketState = useGameStore((s) => s.marketState) as RuntimeMarketState | null;
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<TimeRange>('scenario');

  if (!marketState) {
    return (
      <div style={panelStyle} data-testid="stock-market-dashboard">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📈 Global Stock Markets</h2>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          <p style={{ fontSize: 14 }}>Market data will appear after the first turn is processed.</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
            Stock exchanges, sector tickers, and market indexes activate once the simulation begins.
          </p>
        </div>
      </div>
    );
  }

  // Group flat tickerStates by exchangeId
  const tickersByExchange: Record<string, Record<string, TickerRuntimeState>> = {};
  for (const [tid, ticker] of Object.entries(marketState.tickerStates)) {
    const exId = ticker.exchangeId;
    if (!tickersByExchange[exId]) tickersByExchange[exId] = {};
    tickersByExchange[exId][tid] = ticker;
  }
  const exchangeIds = Object.keys(tickersByExchange);
  // Also include exchanges from sentimentStates that might not have tickers yet
  for (const exId of Object.keys(marketState.sentimentStates)) {
    if (!exchangeIds.includes(exId)) exchangeIds.push(exId);
  }
  const activeExchange = selectedExchange ?? exchangeIds[0] ?? null;

  // Index IDs for quick-select bar
  const presetIds = marketState.presetIndexes.map((i) => i.indexId);
  const customIds = marketState.customIndexes.map((i) => i.indexId);
  const allIndexIds = [...presetIds, ...customIds];
  const focusedId = focusedIndex ?? 'global-composite';
  const focusedChartData = buildChartData(focusedId, marketState.indexStates[focusedId], marketState.historicalData);
  const focusedName = indexDisplayNames[focusedId] ?? focusedId;

  return (
    <div style={panelStyle} data-testid="stock-market-dashboard">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📈 Global Stock Markets</h2>

      {/* ── Candlestick Chart ── */}
      <CandlestickChart
        data={focusedChartData}
        title={focusedName}
        selectedRange={chartRange}
        onRangeChange={setChartRange}
        showTimeline={true}
      />

      {/* ── Index Quick Links ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#888' }}>📊 INDEX QUICK SELECT</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {allIndexIds.map((id) => {
            const state = marketState.indexStates[id];
            if (!state) return null;
            const lastVal = state.history.length > 1
              ? (state.history[state.history.length - 2]?.value ?? state.currentValue)
              : state.currentValue;
            const changePct = lastVal > 0 ? ((state.currentValue - lastVal) / lastVal) * 100 : 0;
            const isFocused = id === focusedId;
            return (
              <button
                key={id}
                data-testid={`index-link-${id}`}
                onClick={() => setFocusedIndex(id)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: isFocused ? 700 : 500,
                  borderRadius: 4, border: isFocused ? '1px solid #4caf50' : '1px solid #333',
                  background: isFocused ? '#1a3a1a' : '#0d0d0d', color: isFocused ? '#4caf50' : '#ccc',
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{indexDisplayNames[id] ?? id}</span>
                <span style={{ fontSize: 10, color: changeColor(changePct), fontWeight: 600 }}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(4)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Exchange Overview Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
        {exchangeIds.map((exId) => {
          const sentiment = marketState.sentimentStates[exId];
          const tickerArr = Object.values(tickersByExchange[exId] ?? {});
          const avgChange = tickerArr.length > 0
            ? tickerArr.reduce((sum: number, t: TickerRuntimeState) => sum + ((t.currentPrice - t.previousPrice) / Math.max(t.previousPrice, 0.01)) * 100, 0) / tickerArr.length
            : 0;

          return (
            <button
              key={exId}
              data-testid={`exchange-card-${exId}`}
              onClick={() => {
                setSelectedExchange(exId);
                const composite = exchangeToComposite[exId];
                if (composite) setFocusedIndex(composite);
              }}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                border: activeExchange === exId ? '1px solid #4caf50' : '1px solid #222',
                textAlign: 'left',
                background: activeExchange === exId ? '#1a2a1a' : '#111',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {exchangeNames[exId] ?? exId.toUpperCase()}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: changeColor(avgChange) }}>
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(4)}%
              </div>
              {sentiment && (
                <div style={{ fontSize: 10, color: sentimentColor(sentiment.sentiment), marginTop: 4 }}>
                  {sentiment.sentiment.toUpperCase()} ({sentiment.sentimentScore > 0 ? '+' : ''}{sentiment.sentimentScore.toFixed(0)})
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Sector Tickers for Selected Exchange ── */}
      {activeExchange && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            {exchangeNames[activeExchange] ?? activeExchange.toUpperCase()} — Sector Tickers
          </h3>
          <TickerTable tickers={tickersByExchange[activeExchange] ?? {}} />
        </div>
      )}

      {/* ── Market Indexes ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Market Indexes</h3>
        <IndexTable indexStates={marketState.indexStates} onSelectIndex={setFocusedIndex} focusedIndex={focusedId} />
      </div>

      {/* ── Recent Market Events ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Recent Market Events</h3>
        <EventLog events={marketState.marketEventLog} />
      </div>
    </div>
  );
};

// ─── Sub-Components ──────────────────────────────────────────

const TickerTable: FC<{ tickers: Record<string, TickerRuntimeState> }> = ({ tickers }) => {
  const tickerArr = Object.values(tickers);
  if (tickerArr.length === 0) {
    return <div style={{ color: '#555', fontSize: 12 }}>No tickers available</div>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Sector</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Price</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Change</th>
          <th style={{ textAlign: 'center', padding: '4px 8px' }}>Trend</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATH</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATL</th>
        </tr>
      </thead>
      <tbody>
        {tickerArr.map((t) => {
          const changePct = t.previousPrice > 0
            ? ((t.currentPrice - t.previousPrice) / t.previousPrice) * 100
            : 0;
          return (
            <tr key={t.tickerId} data-testid={`ticker-row-${t.tickerId}`} style={{ borderBottom: '1px solid #1a1a1a' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.tickerId}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>${t.currentPrice.toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: changeColor(changePct) }}>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(4)}%
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: changeColor(changePct) }}>
                {trendArrow(t.trendDirection)}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4caf50' }}>${t.allTimeHigh.toFixed(2)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ef5350' }}>${t.allTimeLow.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const IndexTable: FC<{
  indexStates: Record<string, IndexRuntimeState>;
  onSelectIndex?: (id: string) => void;
  focusedIndex?: string;
}> = ({ indexStates, onSelectIndex, focusedIndex }) => {
  const entries = Object.values(indexStates);
  if (entries.length === 0) {
    return <div style={{ color: '#555', fontSize: 12 }}>No index data available</div>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Index</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Value</th>
          <th style={{ textAlign: 'center', padding: '4px 8px' }}>Trend</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATH</th>
          <th style={{ textAlign: 'right', padding: '4px 8px' }}>ATL</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((idx) => {
          const lastVal = idx.history.length > 1 ? idx.history[idx.history.length - 2]?.value ?? idx.currentValue : idx.currentValue;
          const changePct = lastVal > 0 ? ((idx.currentValue - lastVal) / lastVal) * 100 : 0;
          const isFocused = idx.indexId === focusedIndex;
          return (
            <tr
              key={idx.indexId}
              data-testid={`index-row-${idx.indexId}`}
              onClick={() => onSelectIndex?.(idx.indexId)}
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
                {indexDisplayNames[idx.indexId] ?? idx.indexId}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{idx.currentValue.toFixed(1)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'center', color: changeColor(changePct) }}>
                {trendArrow(idx.trendDirection)} {changePct >= 0 ? '+' : ''}{changePct.toFixed(4)}%
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#4caf50' }}>{idx.allTimeHigh.toFixed(1)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#ef5350' }}>{idx.allTimeLow.toFixed(1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const EventLog: FC<{ events: readonly MarketEventLogEntry[] }> = ({ events }) => {
  const recent = events.slice(-10).reverse();
  if (recent.length === 0) {
    return <div style={{ color: '#555', fontSize: 12 }}>No market events recorded yet</div>;
  }

  return (
    <div>
      {recent.map((evt, i) => (
        <div
          key={`${evt.eventId}-${i}`}
          data-testid={`market-event-${evt.eventId}`}
          style={{
            padding: '6px 8px',
            marginBottom: 4,
            borderLeft: `3px solid ${evt.eventType === 'crash' || evt.eventType === 'contagion' ? '#ef5350' : evt.eventType === 'rally' ? '#4caf50' : '#f59e0b'}`,
            backgroundColor: '#0a0a0a',
            fontSize: 11,
          }}
        >
          <span style={{ color: '#888' }}>T{evt.turn}</span>
          {' '}
          <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{evt.eventType}</span>
          {' — '}
          <span>{evt.cause}</span>
          {evt.affectedExchanges.length > 0 && (
            <span style={{ color: '#666' }}> ({evt.affectedExchanges.join(', ')})</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default StockMarketDashboard;
