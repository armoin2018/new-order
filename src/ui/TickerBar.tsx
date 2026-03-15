/**
 * TickerBar — Scrolling stock ticker along the bottom of the game screen.
 *
 * Shows live market prices/trends from RuntimeMarketState, projected
 * climate impact, and exchange sentiment.  Uses CSS keyframe animation
 * for a smooth infinite scroll.
 */

import { useMemo } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type { RuntimeMarketState, TickerRuntimeState } from '@/data/types';
import { TICKER_SET_MODELS, EXCHANGE_MODELS } from '@/data/model-loader';

// ─── Styles ──────────────────────────────────────────────────

const barOuter: CSSProperties = {
  width: '100%',
  height: 32,
  backgroundColor: '#0a0a10',
  borderTop: '1px solid #1a1a2e',
  overflow: 'hidden',
  position: 'relative',
  flexShrink: 0,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 12,
  userSelect: 'none',
};

// ─── Helpers ─────────────────────────────────────────────────

const EXCHANGE_FLAGS: Record<string, string> = {
  nyse: '🇺🇸', sse: '🇨🇳', moex: '🇷🇺', tse: '🇯🇵',
  tedpix: '🇮🇷', pse: '🇰🇵', euronext: '🇪🇺', dse: '🇸🇾',
};

const CLIMATE_IMPACT: Record<string, { label: string; color: string }> = {
  HeatWave: { label: '🌡️ HeatWave', color: '#ef5350' },
  Flooding: { label: '🌊 Flood', color: '#42a5f5' },
  Drought: { label: '☀️ Drought', color: '#ffa726' },
  Typhoon: { label: '🌀 Typhoon', color: '#7c4dff' },
  ArcticCollapse: { label: '🧊 Arctic', color: '#26c6da' },
  Wildfire: { label: '🔥 Wildfire', color: '#ff7043' },
  Earthquake: { label: '⚡ Quake', color: '#ffb300' },
};

interface TickerEntry {
  id: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  flag: string;
}

function buildTickerEntries(marketState: RuntimeMarketState | null): TickerEntry[] {
  const entries: TickerEntry[] = [];

  if (marketState?.tickerStates) {
    for (const [tid, ts] of Object.entries(marketState.tickerStates) as [string, TickerRuntimeState][]) {
      const change = ts.currentPrice - ts.previousPrice;
      const changePct = ts.previousPrice > 0 ? (change / ts.previousPrice) * 100 : 0;
      const flag = EXCHANGE_FLAGS[ts.exchangeId] ?? '🏦';
      entries.push({ id: tid, label: tid.toUpperCase(), price: ts.currentPrice, change, changePct, flag });
    }
  } else {
    // Build from static models at initial price with 0 change
    for (const set of TICKER_SET_MODELS) {
      const flag = EXCHANGE_FLAGS[set.exchangeId] ?? '🏦';
      for (const t of set.tickers) {
        entries.push({ id: t.tickerId, label: t.tickerId.toUpperCase(), price: t.initialPrice, change: 0, changePct: 0, flag });
      }
    }
  }

  // Add exchange-level index values
  if (marketState?.indexStates) {
    for (const [iid, idx] of Object.entries(marketState.indexStates)) {
      const hist = idx.history;
      const prev = hist.length > 1 ? hist[hist.length - 2]!.value : idx.currentValue;
      const change = idx.currentValue - prev;
      const changePct = prev > 0 ? (change / prev) * 100 : 0;
      entries.push({ id: iid, label: `IDX:${iid.toUpperCase()}`, price: idx.currentValue, change, changePct, flag: '📊' });
    }
  }

  return entries;
}

// ─── Component ───────────────────────────────────────────────

export const TickerBar: FC = () => {
  const marketState = useGameStore((s) => s.marketState) as RuntimeMarketState | null;
  const climateQueue = useGameStore((s) => s.climateEventQueue);

  const entries = useMemo(() => buildTickerEntries(marketState), [marketState]);

  // Upcoming climate events (next 3 turns)
  const currentTurn = useGameStore((s) => s.currentTurn) as number;
  const upcomingClimate = useMemo(() => {
    if (!climateQueue?.upcoming) return [];
    return climateQueue.upcoming
      .filter((e) => !e.fired && (e.turnToFire as number) <= currentTurn + 3)
      .slice(0, 3);
  }, [climateQueue, currentTurn]);

  // Global sentiment summary
  const sentimentLabel = useMemo(() => {
    if (!marketState?.sentimentStates) return null;
    const scores = Object.values(marketState.sentimentStates).map((s) => s.sentimentScore);
    if (scores.length === 0) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > 15) return { text: 'BULLISH', color: '#4caf50' };
    if (avg < -15) return { text: 'BEARISH', color: '#ef5350' };
    return { text: 'NEUTRAL', color: '#f59e0b' };
  }, [marketState?.sentimentStates]);

  if (entries.length === 0) {
    return (
      <div style={barOuter}>
        <div style={{ color: '#333', padding: '6px 16px', fontSize: 11 }}>Awaiting market data…</div>
      </div>
    );
  }

  // Duplicate entries for seamless looping
  const items = [...entries, ...entries];
  const itemWidth = 180; // approx px per item
  const totalWidth = items.length * itemWidth;
  const duration = Math.max(30, entries.length * 3); // seconds

  return (
    <div style={barOuter} data-testid="ticker-bar">
      {/* Inject keyframes */}
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-${totalWidth / 2}px); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          whiteSpace: 'nowrap',
          animation: `tickerScroll ${duration}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {/* Sentiment badge */}
        {sentimentLabel && (
          <span style={{ padding: '0 14px', fontSize: 10, fontWeight: 800, color: sentimentLabel.color, letterSpacing: 1 }}>
            ● {sentimentLabel.text}
          </span>
        )}

        {/* Climate warnings */}
        {upcomingClimate.map((evt, i) => {
          const info = CLIMATE_IMPACT[evt.type] ?? { label: evt.type, color: '#888' };
          return (
            <span key={`clim-${i}`} style={{
              padding: '0 12px', fontSize: 11, color: info.color, fontWeight: 600,
            }}>
              {info.label} T{evt.turnToFire as number} sev:{evt.severity}
            </span>
          );
        })}

        {/* Ticker entries */}
        {items.map((entry, i) => {
          const up = entry.change >= 0;
          const arrow = entry.change === 0 ? '—' : up ? '▲' : '▼';
          const clr = entry.change === 0 ? '#555' : up ? '#4caf50' : '#ef5350';
          return (
            <span key={`${entry.id}-${i}`} style={{ padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11 }}>{entry.flag}</span>
              <span style={{ color: '#999', fontWeight: 600, fontSize: 11 }}>{entry.label}</span>
              <span style={{ color: '#e0e0e0', fontWeight: 700 }}>{entry.price.toFixed(1)}</span>
              <span style={{ color: clr, fontWeight: 600, fontSize: 10 }}>
                {arrow} {Math.abs(entry.changePct).toFixed(4)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
