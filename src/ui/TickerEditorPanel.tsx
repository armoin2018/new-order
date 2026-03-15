/**
 * CNFL-3103 — Ticker Editor Panel
 *
 * Specialized editor for SectorTicker model types within the Module Builder.
 * Provides:
 * - Ticker ID and initial price fields
 * - MarketSector dropdown selector
 * - EventSensitivityWeights sliders (one per MarketEventType)
 * - Volatility multiplier slider
 */

import { useCallback, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

/** All recognized market sectors. */
export const MARKET_SECTORS = [
  'defense',
  'energy',
  'technology',
  'finance',
  'consumer',
  'healthcare',
  'infrastructure',
  'mining',
] as const;

/** All recognized market event types for sensitivity weights. */
export const MARKET_EVENT_TYPES = [
  'military-conflict',
  'sanctions-imposed',
  'tech-breakthrough',
  'civil-unrest',
  'trade-deal',
  'oil-disruption',
  'regime-change',
  'natural-disaster',
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TickerEditorData {
  tickerId: string;
  sectorName: string;
  initialPrice: number;
  volatilityMultiplier: number;
  eventSensitivityWeights: Record<string, number>;
}

export interface TickerEditorPanelProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SENSITIVITY_MIN = 0;
const SENSITIVITY_MAX = 5;
const SENSITIVITY_STEP = 0.1;
const VOLATILITY_MIN = 0;
const VOLATILITY_MAX = 3;
const VOLATILITY_STEP = 0.05;

function formatLabel(s: string): string {
  return s
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelRoot: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  color: '#e0e0e0',
};
const sectionBox: CSSProperties = {
  border: '1px solid #222',
  borderRadius: 6,
  padding: 16,
  marginBottom: 16,
  background: '#0d0d0d',
};
const sectionHeading: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#ccc',
  marginBottom: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
};
const fieldRow: CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 12,
  alignItems: 'flex-end',
};
const fieldCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
};
const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#aaa',
  marginBottom: 4,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
};
const inputBase: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: '#111',
  border: '1px solid #333',
  borderRadius: 4,
  color: '#e0e0e0',
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const selectBase: CSSProperties = {
  ...inputBase,
  cursor: 'pointer',
};
const sliderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
};
const sliderLabel: CSSProperties = {
  width: 160,
  fontSize: 12,
  color: '#ccc',
  flexShrink: 0,
};
const sliderInput: CSSProperties = {
  flex: 1,
  cursor: 'pointer',
  accentColor: '#4fc3f7',
};
const sliderValue: CSSProperties = {
  width: 48,
  textAlign: 'right' as const,
  fontSize: 12,
  color: '#4fc3f7',
  fontWeight: 600,
  fontFamily: 'monospace',
  flexShrink: 0,
};
const tickerBadge: CSSProperties = {
  display: 'inline-block',
  background: '#1976d2',
  color: '#fff',
  padding: '2px 10px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 12,
};

// ─── Component ──────────────────────────────────────────────────────────────

export const TickerEditorPanel: FC<TickerEditorPanelProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const tickerId = (value.tickerId as string) ?? '';
  const sectorName = (value.sectorName as string) ?? MARKET_SECTORS[0];
  const initialPrice = (value.initialPrice as number) ?? 100;
  const volatilityMultiplier = (value.volatilityMultiplier as number) ?? 1.0;
  const rawWeights = (value.eventSensitivityWeights as Record<string, number>) ?? {};

  // Ensure all event types have a value (default 0)
  const weights = useMemo<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    for (const t of MARKET_EVENT_TYPES) {
      w[t] = rawWeights[t] ?? 0;
    }
    return w;
  }, [rawWeights]);

  const setField = useCallback(
    (key: string, val: unknown) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange],
  );

  const setWeight = useCallback(
    (eventType: string, weight: number) => {
      const next = { ...weights, [eventType]: weight };
      // Strip zero weights to keep data clean
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(next)) {
        if (v !== 0) clean[k] = v;
      }
      onChange({ ...value, eventSensitivityWeights: clean });
    },
    [value, weights, onChange],
  );

  return (
    <div data-testid="ticker-editor-panel" style={panelRoot}>
      <span style={tickerBadge}>TICKER MODEL</span>

      {/* ── Basic Fields ─────────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionHeading}>Ticker Properties</div>
        <div style={fieldRow}>
          <div style={fieldCol}>
            <label style={labelStyle}>Ticker ID</label>
            <input
              data-testid="ticker-id-input"
              type="text"
              style={inputBase}
              value={tickerId}
              onChange={(e) => setField('tickerId', e.target.value)}
              disabled={readOnly}
              placeholder="e.g. US-DEF-001"
            />
          </div>
          <div style={fieldCol}>
            <label style={labelStyle}>Initial Price</label>
            <input
              data-testid="initial-price-input"
              type="number"
              style={inputBase}
              value={initialPrice}
              min={0}
              step={0.01}
              onChange={(e) =>
                setField('initialPrice', e.target.value === '' ? 0 : Number(e.target.value))
              }
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* ── Sector Dropdown ──────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionHeading}>Sector Configuration</div>
        <label style={labelStyle}>Market Sector</label>
        <select
          data-testid="sector-dropdown"
          style={selectBase}
          value={sectorName}
          onChange={(e) => setField('sectorName', e.target.value)}
          disabled={readOnly}
        >
          {MARKET_SECTORS.map((s) => (
            <option key={s} value={s}>
              {formatLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* ── Sensitivity Sliders ──────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionHeading}>Event Sensitivity Weights</div>
        {MARKET_EVENT_TYPES.map((eventType) => (
          <div key={eventType} style={sliderRow} data-testid={`sensitivity-row-${eventType}`}>
            <span style={sliderLabel}>{formatLabel(eventType)}</span>
            <input
              data-testid={`sensitivity-slider-${eventType}`}
              type="range"
              style={sliderInput}
              min={SENSITIVITY_MIN}
              max={SENSITIVITY_MAX}
              step={SENSITIVITY_STEP}
              value={weights[eventType] ?? 0}
              onChange={(e) => setWeight(eventType, Number(e.target.value))}
              disabled={readOnly}
            />
            <span data-testid={`sensitivity-value-${eventType}`} style={sliderValue}>
              {(weights[eventType] ?? 0).toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Volatility Multiplier ────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionHeading}>Volatility</div>
        <div style={sliderRow}>
          <span style={sliderLabel}>Volatility Multiplier</span>
          <input
            data-testid="volatility-slider"
            type="range"
            style={sliderInput}
            min={VOLATILITY_MIN}
            max={VOLATILITY_MAX}
            step={VOLATILITY_STEP}
            value={volatilityMultiplier}
            onChange={(e) => setField('volatilityMultiplier', Number(e.target.value))}
            disabled={readOnly}
          />
          <span data-testid="volatility-value" style={sliderValue}>
            {volatilityMultiplier.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
