/**
 * MarketSentimentWidget — FR-3306, CNFL-0030-S3
 *
 * Compact widget showing per-exchange sentiment indicators and aggregated
 * global market sentiment. Designed for sidebar or dashboard embedding.
 */

import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import { StockMarketEngine } from '@/engine/stock-market-engine';
import type { GlobalSentiment } from '@/engine/stock-market-engine';
import type {
  RuntimeMarketState,
  ExchangeSentimentState,
} from '@/data/types/model.types';

// ─── Styles ──────────────────────────────────────────────────

const widgetStyle: CSSProperties = {
  backgroundColor: '#111',
  border: '1px solid #222',
  borderRadius: 6,
  padding: 12,
  color: '#e0e0e0',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 12,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  borderBottom: '1px solid #1a1a1a',
};

// ─── Helpers ─────────────────────────────────────────────────

const EXCHANGE_LABELS: Record<string, string> = {
  nyse: '🇺🇸 NYSE',
  sse: '🇨🇳 SSE',
  moex: '🇷🇺 MOEX',
  tse: '🇯🇵 TSE',
  tedpix: '🇮🇷 TEDPIX',
  pse: '🇰🇵 PSE',
  euronext: '🇪🇺 EURO',
  dse: '🇸🇾 DSE',
};

function sentimentEmoji(s: string): string {
  if (s === 'bullish') return '🟢';
  if (s === 'bearish') return '🔴';
  return '🟡';
}

function sentimentColor(s: string): string {
  if (s === 'bullish') return '#4caf50';
  if (s === 'bearish') return '#ef5350';
  return '#f59e0b';
}

function volatilityLabel(v: number): string {
  if (v > 70) return 'HIGH';
  if (v > 40) return 'MED';
  return 'LOW';
}

// ─── Component ───────────────────────────────────────────────

const engine = new StockMarketEngine();

export const MarketSentimentWidget: FC = () => {
  const marketState = useGameStore((s) => s.marketState) as RuntimeMarketState | null;

  if (!marketState) {
    return (
      <div style={widgetStyle} data-testid="market-sentiment-widget">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 Market Sentiment</div>
        <div style={{ color: '#555', fontSize: 11 }}>Awaiting market data…</div>
      </div>
    );
  }

  const entries = Object.entries(marketState.sentimentStates) as [string, ExchangeSentimentState][];
  const global: GlobalSentiment = engine.computeGlobalSentiment(marketState.sentimentStates);

  return (
    <div style={widgetStyle} data-testid="market-sentiment-widget">
      {/* Global Headline */}
      <div style={{ marginBottom: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>GLOBAL SENTIMENT</div>
        <div
          data-testid="global-sentiment"
          style={{ fontSize: 20, fontWeight: 800, color: sentimentColor(global.sentiment) }}
        >
          {sentimentEmoji(global.sentiment)} {global.sentiment.toUpperCase()}
        </div>
        <div style={{ fontSize: 10, color: '#666' }}>
          Score: {global.sentimentScore > 0 ? '+' : ''}{global.sentimentScore} | Vol: {global.averageVolatility}
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
          🟢 {global.bullishCount} 🟡 {global.neutralCount} 🔴 {global.bearishCount}
        </div>
      </div>

      {/* Per-Exchange Rows */}
      <div style={{ borderTop: '1px solid #333', paddingTop: 6 }}>
        {entries.map(([exId, state]) => (
          <div key={exId} style={rowStyle} data-testid={`sentiment-row-${exId}`}>
            <span style={{ fontWeight: 600, minWidth: 72 }}>
              {EXCHANGE_LABELS[exId] ?? exId.toUpperCase()}
            </span>
            <span style={{ color: sentimentColor(state.sentiment) }}>
              {sentimentEmoji(state.sentiment)} {state.sentimentScore > 0 ? '+' : ''}{state.sentimentScore}
            </span>
            <span style={{ color: '#666', fontSize: 10 }}>
              ↕ {state.trendStrength} | {volatilityLabel(state.volatilityIndex)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketSentimentWidget;
