/**
 * CandlestickChart — Pure SVG Candlestick / OHLC Chart
 *
 * Renders financial candlestick charts with:
 * - Green/red candle bodies (close > open = green)
 * - High/low wicks
 * - Responsive SVG viewBox
 * - Moving average overlay line
 * - Volume bars (bottom 15% of chart)
 * - Crosshair + tooltip on hover
 * - Time range selector buttons
 * - Timeline range slider for custom zoom
 * - Simulation start marker (vertical dashed line)
 *
 * @module ui/CandlestickChart
 */

import { useState, useMemo, useRef, useCallback, type FC, type CSSProperties } from 'react';
import type { OHLCPoint, TimeRange } from '@/engine/market-history-generator';
import { filterByTimeRange, filterByDateRange } from '@/engine/market-history-generator';

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const CHART_W = 900;
const CHART_H = 360;
const PADDING = { top: 20, right: 60, bottom: 50, left: 65 };
const VOLUME_HEIGHT_RATIO = 0.15;

const COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  wick: '#666',
  grid: '#1a1a1a',
  gridText: '#555',
  bg: '#0a0a0a',
  maLine: '#60a5fa',
  volumeUp: 'rgba(34,197,94,0.3)',
  volumeDown: 'rgba(239,68,68,0.3)',
  crosshair: '#555',
  simLine: '#f59e0b',
  tooltipBg: '#1a1a1a',
  tooltipBorder: '#333',
} as const;

// Moving average window
const MA_WINDOW = 12;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface CandlestickChartProps {
  /** Full OHLC data (historical + simulation). */
  data: readonly OHLCPoint[];
  /** Display name shown above the chart. */
  title: string;
  /** ISO date string marking where the simulation begins. */
  scenarioStartDate?: string;
  /** Currently selected time range. */
  selectedRange?: TimeRange;
  /** Callback when user changes range. */
  onRangeChange?: (range: TimeRange) => void;
  /** Height override in pixels. */
  height?: number;
  /** Whether to show the timeline slider. */
  showTimeline?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const S_CONTAINER: CSSProperties = {
  backgroundColor: COLORS.bg,
  borderRadius: 6,
  border: '1px solid #222',
  padding: 12,
  marginBottom: 12,
};

const S_HEADER: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const S_TITLE: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#e0e0e0',
};

const S_RANGE_BAR: CSSProperties = {
  display: 'flex',
  gap: 2,
};

const S_RANGE_BTN: CSSProperties = {
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 3,
  border: '1px solid #333',
  background: '#111',
  color: '#888',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.15s',
};

const S_RANGE_BTN_ACTIVE: CSSProperties = {
  ...S_RANGE_BTN,
  background: '#1a3a1a',
  borderColor: '#4caf50',
  color: '#4caf50',
};

const S_TOOLTIP: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 40,
  backgroundColor: COLORS.tooltipBg,
  border: `1px solid ${COLORS.tooltipBorder}`,
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 11,
  color: '#e0e0e0',
  lineHeight: 1.5,
  minWidth: 140,
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
};

const S_TIMELINE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
  padding: '4px 0',
};

const S_SLIDER: CSSProperties = {
  flex: 1,
  height: 4,
  appearance: 'none',
  WebkitAppearance: 'none',
  background: '#333',
  borderRadius: 2,
  outline: 'none',
  cursor: 'pointer',
};

const S_SLIDER_LABEL: CSSProperties = {
  fontSize: 10,
  color: '#666',
  minWidth: 70,
  textAlign: 'center',
};

// ═══════════════════════════════════════════════════════════════
// Time range presets
// ═══════════════════════════════════════════════════════════════

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'scenario', label: 'Scenario' },
  { key: '1m', label: '1M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: '10y', label: '10Y' },
];

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function computeMA(data: readonly OHLCPoint[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      sum += data[j]!.close;
    }
    return sum / window;
  });
}

function formatPrice(val: number): string {
  if (val >= 10000) return val.toFixed(0);
  if (val >= 1000) return val.toFixed(0);
  if (val >= 100) return val.toFixed(1);
  return val.toFixed(2);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export const CandlestickChart: FC<CandlestickChartProps> = ({
  data,
  title,
  scenarioStartDate = '2026-01-15',
  selectedRange = 'scenario',
  onRangeChange,
  height,
  showTimeline = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Range & custom zoom state ─────────────────────────────
  const [activeRange, setActiveRange] = useState<TimeRange>(selectedRange);
  const [sliderStart, setSliderStart] = useState(0);
  const [sliderEnd, setSliderEnd] = useState(100);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Filter data by range ──────────────────────────────────
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    // First apply time range
    let filtered = filterByTimeRange(data, activeRange, scenarioStartDate) as OHLCPoint[];

    // Then apply slider zoom if not at full range
    if (showTimeline && (sliderStart > 0 || sliderEnd < 100) && filtered.length > 1) {
      const startIdx = Math.floor((sliderStart / 100) * (filtered.length - 1));
      const endIdx = Math.ceil((sliderEnd / 100) * (filtered.length - 1));
      filtered = filtered.slice(startIdx, endIdx + 1);
    }

    return filtered;
  }, [data, activeRange, sliderStart, sliderEnd, scenarioStartDate, showTimeline]);

  // ── Compute derived data ──────────────────────────────────
  const { priceMin, priceMax, volMax, ma, chartArea, simStartIdx } = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        priceMin: 0,
        priceMax: 100,
        volMax: 1,
        ma: [] as (number | null)[],
        chartArea: {
          x: PADDING.left,
          y: PADDING.top,
          w: CHART_W - PADDING.left - PADDING.right,
          h: CHART_H - PADDING.top - PADDING.bottom,
        },
        simStartIdx: -1,
      };
    }

    let pMin = Infinity;
    let pMax = -Infinity;
    let vMax = 0;
    for (const p of filteredData) {
      if (p.low < pMin) pMin = p.low;
      if (p.high > pMax) pMax = p.high;
      if (p.volume > vMax) vMax = p.volume;
    }
    // Add 5% padding to price range
    const range = pMax - pMin || 1;
    pMin -= range * 0.05;
    pMax += range * 0.05;
    pMin = Math.max(0, pMin);

    const maData = computeMA(filteredData, MA_WINDOW);

    // Find simulation start index
    const simIdx = filteredData.findIndex((p) => p.date >= scenarioStartDate);

    return {
      priceMin: pMin,
      priceMax: pMax,
      volMax: vMax || 1,
      ma: maData,
      chartArea: {
        x: PADDING.left,
        y: PADDING.top,
        w: CHART_W - PADDING.left - PADDING.right,
        h: CHART_H - PADDING.top - PADDING.bottom,
      },
      simStartIdx: simIdx,
    };
  }, [filteredData, scenarioStartDate]);

  // ── Coordinate mappers ────────────────────────────────────
  const n = filteredData.length;
  const candleWidth = n > 0 ? Math.max(1, Math.min(12, (chartArea.w / n) * 0.7)) : 4;
  const gap = n > 0 ? chartArea.w / n : 1;

  const xForIdx = (i: number) => chartArea.x + gap * i + gap / 2;
  const yForPrice = (price: number) => {
    const ratio = (price - priceMin) / (priceMax - priceMin || 1);
    const priceAreaH = chartArea.h * (1 - VOLUME_HEIGHT_RATIO);
    return chartArea.y + priceAreaH * (1 - ratio);
  };
  const yForVolume = (vol: number) => {
    const volAreaTop = chartArea.y + chartArea.h * (1 - VOLUME_HEIGHT_RATIO);
    const volAreaH = chartArea.h * VOLUME_HEIGHT_RATIO;
    const ratio = vol / volMax;
    return volAreaTop + volAreaH * (1 - ratio);
  };
  const volBarBottom = chartArea.y + chartArea.h;

  // ── Event handlers ────────────────────────────────────────
  const handleRangeClick = useCallback((range: TimeRange) => {
    setActiveRange(range);
    setSliderStart(0);
    setSliderEnd(100);
    onRangeChange?.(range);
  }, [onRangeChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = CHART_W / rect.width;
    const svgX = (e.clientX - rect.left) * scaleX;

    // Find closest candle
    const idx = Math.round((svgX - chartArea.x - gap / 2) / gap);
    if (idx >= 0 && idx < n) {
      setHoveredIdx(idx);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    } else {
      setHoveredIdx(null);
    }
  }, [n, chartArea.x, gap]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  // ── Price labels (Y axis) ────────────────────────────────
  const yLabels = useMemo(() => {
    const count = 6;
    const labels: { y: number; label: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const price = priceMin + (priceMax - priceMin) * (i / count);
      labels.push({ y: yForPrice(price), label: formatPrice(price) });
    }
    return labels;
  }, [priceMin, priceMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── X axis date labels ────────────────────────────────────
  const xLabels = useMemo(() => {
    if (n === 0) return [];
    const maxLabels = Math.min(10, n);
    const step = Math.max(1, Math.floor(n / maxLabels));
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < n; i += step) {
      labels.push({
        x: xForIdx(i),
        label: formatDateShort(filteredData[i]!.date),
      });
    }
    return labels;
  }, [n, filteredData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current summary ───────────────────────────────────────
  const summaryPoint = filteredData.length > 0 ? filteredData[filteredData.length - 1]! : null;
  const prevPoint = filteredData.length > 1 ? filteredData[filteredData.length - 2]! : null;
  const overallChange = summaryPoint && filteredData[0]
    ? ((summaryPoint.close - filteredData[0].open) / filteredData[0].open) * 100
    : 0;

  const hoveredPoint = hoveredIdx !== null ? filteredData[hoveredIdx] ?? null : null;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const svgHeight = height ?? CHART_H;

  if (data.length === 0) {
    return (
      <div style={S_CONTAINER}>
        <div style={S_TITLE}>{title}</div>
        <div style={{ color: '#555', fontSize: 12, padding: 40, textAlign: 'center' }}>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S_CONTAINER, position: 'relative' }} ref={containerRef}>
      {/* Header: title + current value + range buttons */}
      <div style={S_HEADER}>
        <div>
          <div style={S_TITLE}>{title}</div>
          {summaryPoint && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#e0e0e0' }}>
                {formatPrice(summaryPoint.close)}
              </span>
              {prevPoint && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: summaryPoint.close >= prevPoint.close ? COLORS.up : COLORS.down,
                }}>
                  {summaryPoint.close >= prevPoint.close ? '+' : ''}
                  {((summaryPoint.close - prevPoint.close) / prevPoint.close * 100).toFixed(4)}%
                </span>
              )}
              <span style={{
                fontSize: 11,
                color: overallChange >= 0 ? COLORS.up : COLORS.down,
              }}>
                {activeRange !== 'scenario' ? `${activeRange.toUpperCase()}: ` : 'Scenario: '}
                {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(4)}%
              </span>
            </div>
          )}
        </div>
        <div style={S_RANGE_BAR}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => handleRangeClick(r.key)}
              style={activeRange === r.key ? S_RANGE_BTN_ACTIVE : S_RANGE_BTN}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background */}
        <rect x={0} y={0} width={CHART_W} height={svgHeight} fill={COLORS.bg} />

        {/* Grid lines */}
        {yLabels.map((lbl, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={chartArea.x} y1={lbl.y}
              x2={chartArea.x + chartArea.w} y2={lbl.y}
              stroke={COLORS.grid} strokeWidth={0.5}
            />
            <text
              x={chartArea.x - 8} y={lbl.y + 3}
              textAnchor="end" fontSize={9} fill={COLORS.gridText}
            >
              {lbl.label}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xLabels.map((lbl, i) => (
          <text
            key={`xlbl-${i}`}
            x={lbl.x} y={chartArea.y + chartArea.h + 16}
            textAnchor="middle" fontSize={9} fill={COLORS.gridText}
          >
            {lbl.label}
          </text>
        ))}

        {/* Volume bars (bottom area) */}
        {filteredData.map((p, i) => {
          const isUp = p.close >= p.open;
          const x = xForIdx(i) - candleWidth / 2;
          const yTop = yForVolume(p.volume);
          const h = volBarBottom - yTop;
          return (
            <rect
              key={`vol-${i}`}
              x={x} y={yTop}
              width={candleWidth} height={Math.max(0, h)}
              fill={isUp ? COLORS.volumeUp : COLORS.volumeDown}
            />
          );
        })}

        {/* Simulation start line */}
        {simStartIdx >= 0 && (
          <g>
            <line
              x1={xForIdx(simStartIdx)} y1={chartArea.y}
              x2={xForIdx(simStartIdx)} y2={chartArea.y + chartArea.h}
              stroke={COLORS.simLine} strokeWidth={1}
              strokeDasharray="4,3" opacity={0.6}
            />
            <text
              x={xForIdx(simStartIdx) + 4} y={chartArea.y + 10}
              fontSize={8} fill={COLORS.simLine} fontWeight={600}
            >
              SIM START
            </text>
          </g>
        )}

        {/* Candlestick bodies + wicks */}
        {filteredData.map((p, i) => {
          const isUp = p.close >= p.open;
          const x = xForIdx(i);
          const bodyTop = yForPrice(Math.max(p.open, p.close));
          const bodyBot = yForPrice(Math.min(p.open, p.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);

          return (
            <g key={`candle-${i}`}>
              {/* Wick (high-low line) */}
              <line
                x1={x} y1={yForPrice(p.high)}
                x2={x} y2={yForPrice(p.low)}
                stroke={isUp ? COLORS.up : COLORS.down}
                strokeWidth={1}
              />
              {/* Body */}
              <rect
                x={x - candleWidth / 2} y={bodyTop}
                width={candleWidth} height={bodyH}
                fill={isUp ? COLORS.up : COLORS.down}
                rx={1}
              />
            </g>
          );
        })}

        {/* Moving average line */}
        {ma.length > 0 && (
          <polyline
            points={ma
              .map((val, i) => (val !== null ? `${xForIdx(i)},${yForPrice(val)}` : null))
              .filter(Boolean)
              .join(' ')}
            fill="none"
            stroke={COLORS.maLine}
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}

        {/* Crosshair */}
        {hoveredIdx !== null && hoveredPoint && (
          <g>
            <line
              x1={xForIdx(hoveredIdx)} y1={chartArea.y}
              x2={xForIdx(hoveredIdx)} y2={chartArea.y + chartArea.h}
              stroke={COLORS.crosshair} strokeWidth={0.5}
              strokeDasharray="3,2"
            />
            <line
              x1={chartArea.x} y1={yForPrice(hoveredPoint.close)}
              x2={chartArea.x + chartArea.w} y2={yForPrice(hoveredPoint.close)}
              stroke={COLORS.crosshair} strokeWidth={0.5}
              strokeDasharray="3,2"
            />
            {/* Price label on Y axis */}
            <rect
              x={chartArea.x + chartArea.w + 2}
              y={yForPrice(hoveredPoint.close) - 8}
              width={52} height={16} rx={3}
              fill="#333"
            />
            <text
              x={chartArea.x + chartArea.w + 28}
              y={yForPrice(hoveredPoint.close) + 3}
              textAnchor="middle" fontSize={9} fill="#e0e0e0"
            >
              {formatPrice(hoveredPoint.close)}
            </text>
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && containerRef.current && (
        <div style={{
          ...S_TOOLTIP,
          left: Math.min(
            tooltipPos.x - containerRef.current.getBoundingClientRect().left + 16,
            containerRef.current.clientWidth - 170,
          ),
          top: Math.max(0, tooltipPos.y - containerRef.current.getBoundingClientRect().top - 100),
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#ccc' }}>
            {formatDate(hoveredPoint.date)}
          </div>
          <div>O: <span style={{ color: '#e0e0e0' }}>{formatPrice(hoveredPoint.open)}</span></div>
          <div>H: <span style={{ color: COLORS.up }}>{formatPrice(hoveredPoint.high)}</span></div>
          <div>L: <span style={{ color: COLORS.down }}>{formatPrice(hoveredPoint.low)}</span></div>
          <div>C: <span style={{ color: hoveredPoint.close >= hoveredPoint.open ? COLORS.up : COLORS.down }}>
            {formatPrice(hoveredPoint.close)}
          </span></div>
          <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>
            Vol: {(hoveredPoint.volume / 1_000_000).toFixed(1)}M
          </div>
        </div>
      )}

      {/* Timeline slider */}
      {showTimeline && (
        <div style={S_TIMELINE}>
          <div style={S_SLIDER_LABEL}>
            {filteredData[0] ? formatDateShort(filteredData[0].date) : '—'}
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSliderStart(Math.min(v, sliderEnd - 5));
            }}
            style={S_SLIDER}
            title="Zoom start"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={sliderEnd}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSliderEnd(Math.max(v, sliderStart + 5));
            }}
            style={S_SLIDER}
            title="Zoom end"
          />
          <div style={S_SLIDER_LABEL}>
            {filteredData.length > 0 ? formatDateShort(filteredData[filteredData.length - 1]!.date) : '—'}
          </div>
        </div>
      )}
    </div>
  );
};

export default CandlestickChart;
