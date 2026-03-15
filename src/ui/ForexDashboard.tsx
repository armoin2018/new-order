/**
 * ForexDashboard — FR-3800, FR-3802
 *
 * Displays per-nation currency exchange rates, percent change, trend,
 * foreign reserves, top movers, and the cross-rate matrix.
 * Reads from GameState.currencyState (CurrencyState).
 */

import { useState } from 'react';
import type { FC, CSSProperties } from 'react';
import { useGameStore } from '@/engine/store';
import type { CurrencyState, CurrencyRecord } from '@/data/types/currency.types';
import type { FactionId } from '@/data/types/enums';
import { getCurrencyTopMovers, getCrossRateMatrix } from '@/engine/currency-engine';

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

const NATION_LABELS: Record<string, string> = {
  us: '🇺🇸 United States',
  china: '🇨🇳 China',
  russia: '🇷🇺 Russia',
  japan: '🇯🇵 Japan',
  iran: '🇮🇷 Iran',
  dprk: '🇰🇵 North Korea',
  eu: '🇪🇺 European Union',
  syria: '🇸🇾 Syria',
};

const NATION_FLAGS: Record<string, string> = {
  us: '🇺🇸',
  china: '🇨🇳',
  russia: '🇷🇺',
  japan: '🇯🇵',
  iran: '🇮🇷',
  dprk: '🇰🇵',
  eu: '🇪🇺',
  syria: '🇸🇾',
};

// ─── Helpers ─────────────────────────────────────────────────

function changeColor(val: number): string {
  // For forex: positive % means currency weakened vs USD (more local per USD)
  // So we invert: positive change = red (depreciation), negative = green (appreciation)
  if (val > 0.5) return '#ef5350';
  if (val < -0.5) return '#4caf50';
  return '#888';
}

function changeArrow(val: number): string {
  if (val > 0.5) return '▼'; // weakening
  if (val < -0.5) return '▲'; // strengthening
  return '─';
}

function formatRate(rate: number): string {
  if (rate >= 10000) return rate.toFixed(0);
  if (rate >= 100) return rate.toFixed(1);
  if (rate >= 1) return rate.toFixed(3);
  return rate.toFixed(4);
}

function formatReserves(reserves: number): string {
  if (reserves >= 1000) return `$${(reserves / 1000).toFixed(1)}T`;
  return `$${reserves.toFixed(0)}B`;
}

function reserveColor(reserves: number): string {
  if (reserves >= 500) return '#4caf50';
  if (reserves >= 100) return '#f59e0b';
  return '#ef5350';
}

// ─── Component ───────────────────────────────────────────────

export const ForexDashboard: FC = () => {
  const currencyState = useGameStore((s) => s.currencyState) as CurrencyState | null;
  const [showCrossRate, setShowCrossRate] = useState(false);

  if (!currencyState) {
    return (
      <div style={panelStyle} data-testid="forex-dashboard">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>💱 Foreign Exchange</h2>
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          <p style={{ fontSize: 14 }}>Forex data will appear after the first turn is processed.</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
            Currency exchange rates, reserves, and cross-rate matrix activate once the simulation begins.
          </p>
        </div>
      </div>
    );
  }

  const records = Object.values(currencyState.records) as CurrencyRecord[];
  const nationIds = Object.keys(currencyState.records) as FactionId[];
  const topMovers = getCurrencyTopMovers(currencyState, 5);

  return (
    <div style={panelStyle} data-testid="forex-dashboard">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>💱 Foreign Exchange</h2>

      {/* ── Top Movers ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🔥 Top Movers</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {topMovers.map((m) => {
            const rec = currencyState.records[m.nation];
            if (!rec) return null;
            return (
              <div
                key={m.nation}
                data-testid={`forex-mover-${m.nation}`}
                style={{
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${changeColor(m.change)}33`,
                  borderRadius: 4,
                  padding: '8px 12px',
                  minWidth: 120,
                  flex: '1 1 120px',
                }}
              >
                <div style={{ fontSize: 11, color: '#888' }}>
                  {NATION_FLAGS[m.nation] ?? ''} {rec.currencyCode}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: changeColor(m.change) }}>
                  {m.change >= 0 ? '+' : ''}{m.change.toFixed(4)}%
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>
                  {m.change > 0.5 ? 'Weakening' : m.change < -0.5 ? 'Strengthening' : 'Stable'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Exchange Rate Table ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Exchange Rates vs USD</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Nation</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Currency</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Rate/USD</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Change</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Trend</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>Reserves</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr
                key={rec.nationCode}
                data-testid={`forex-row-${rec.nationCode}`}
                style={{ borderBottom: '1px solid #1a1a1a' }}
              >
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                  {NATION_LABELS[rec.nationCode] ?? rec.nationCode}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#aaa' }}>
                  {rec.currencyCode} ({rec.currencyName})
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRate(rec.exchangeRateVsUSD)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: changeColor(rec.percentChange) }}>
                  {rec.percentChange >= 0 ? '+' : ''}{rec.percentChange.toFixed(4)}%
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: changeColor(rec.percentChange), fontSize: 14 }}>
                  {changeArrow(rec.percentChange)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: reserveColor(rec.foreignReserves) }}>
                  {formatReserves(rec.foreignReserves)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Rate Driver Events ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Rate Driver Events</h3>
        {records.filter((r) => r.rateDriverEvents.length > 0).length === 0 ? (
          <div style={{ color: '#555', fontSize: 12 }}>No rate-driving events this turn</div>
        ) : (
          <div>
            {records
              .filter((r) => r.rateDriverEvents.length > 0)
              .map((rec) => (
                <div key={rec.nationCode} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 2 }}>
                    {NATION_FLAGS[rec.nationCode] ?? ''} {rec.currencyCode}
                  </div>
                  {rec.rateDriverEvents.map((evt, i) => (
                    <div
                      key={`${rec.nationCode}-${i}`}
                      style={{
                        padding: '3px 8px',
                        marginLeft: 12,
                        borderLeft: `2px solid ${changeColor(rec.percentChange)}`,
                        fontSize: 11,
                        color: '#999',
                      }}
                    >
                      {evt}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Cross-Rate Matrix Toggle ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Cross-Rate Matrix</h3>
          <button
            onClick={() => setShowCrossRate(!showCrossRate)}
            data-testid="forex-cross-rate-toggle"
            style={{
              background: 'none',
              border: '1px solid #333',
              color: '#888',
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            {showCrossRate ? 'Hide' : 'Show'}
          </button>
        </div>
        {showCrossRate && <CrossRateTable state={currencyState} nations={nationIds} />}
      </div>

      {/* ── Reserve Overview ── */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Foreign Reserves</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {records
            .sort((a, b) => b.foreignReserves - a.foreignReserves)
            .map((rec) => {
              const maxReserves = Math.max(...records.map((r) => r.foreignReserves), 1);
              const barWidth = Math.max(2, (rec.foreignReserves / maxReserves) * 100);
              return (
                <div key={rec.nationCode} style={{ width: '100%', marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span>
                      {NATION_FLAGS[rec.nationCode] ?? ''} {rec.currencyCode}
                    </span>
                    <span style={{ color: reserveColor(rec.foreignReserves) }}>
                      {formatReserves(rec.foreignReserves)}
                      {rec.reserveChangeAmount !== 0 && (
                        <span style={{ color: rec.reserveChangeAmount > 0 ? '#4caf50' : '#ef5350', marginLeft: 4 }}>
                          ({rec.reserveChangeAmount > 0 ? '+' : ''}{rec.reserveChangeAmount.toFixed(1)}B)
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ height: 4, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidth}%`,
                        backgroundColor: reserveColor(rec.foreignReserves),
                        borderRadius: 2,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-Components ──────────────────────────────────────────

const CrossRateTable: FC<{ state: CurrencyState; nations: FactionId[] }> = ({ state, nations }) => {
  const matrix = getCrossRateMatrix(state, nations);
  const codes = nations
    .map((n) => state.records[n]?.currencyCode)
    .filter((c): c is string => !!c);

  if (codes.length === 0) {
    return <div style={{ color: '#555', fontSize: 12 }}>No cross-rate data available</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333' }}>
            <th style={{ padding: '3px 4px', textAlign: 'left', color: '#888' }}>1 →</th>
            {codes.map((c) => (
              <th key={c} style={{ padding: '3px 4px', textAlign: 'right', color: '#888', minWidth: 52 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((rowCode) => (
            <tr key={rowCode} style={{ borderBottom: '1px solid #1a1a1a' }}>
              <td style={{ padding: '3px 4px', fontWeight: 600, color: '#aaa' }}>{rowCode}</td>
              {codes.map((colCode) => {
                const val = matrix[rowCode]?.[colCode] ?? 0;
                const isSelf = rowCode === colCode;
                return (
                  <td
                    key={colCode}
                    style={{
                      padding: '3px 4px',
                      textAlign: 'right',
                      color: isSelf ? '#333' : '#ccc',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {isSelf ? '1.000' : formatRate(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ForexDashboard;
