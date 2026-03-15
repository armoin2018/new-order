import { type FC, type CSSProperties, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { MapViewState } from '@/data/types/map-view.types';
import { FactionId, ALL_FACTIONS } from '@/data/types';
import { FACTION_INFO } from '@/engine/game-controller';
import { useGameStore } from '@/engine/store';
import {
  initializeMapViewState,
  applyZoom,
  applyPan,
  resetToHome,
  computeRelationshipLineColor,
  classifyTension,
  computeFlagScale,
} from '@/engine/map-view-engine';
import { mapViewConfig } from '@/engine/config/map-view';

// ═══════════════════════════════════════════════════════════════════════════
// Constants — faction node positions (approximate geographic layout)
// ═══════════════════════════════════════════════════════════════════════════

/** Canvas logical dimensions for the abstract world layout. */
const CANVAS_W = 1200;
const CANVAS_H = 700;

/**
 * Approximate geographic positions for each faction on the abstract canvas.
 * x/y are in logical canvas coordinates.
 */
const FACTION_POSITIONS: Record<FactionId, { x: number; y: number }> = {
  us:    { x: 200,  y: 280 },
  eu:    { x: 540,  y: 220 },
  russia:{ x: 740,  y: 180 },
  china: { x: 880,  y: 320 },
  japan: { x: 1020, y: 300 },
  dprk:  { x: 950,  y: 240 },
  iran:  { x: 680,  y: 370 },
  syria: { x: 620,  y: 340 },
};

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const S_ROOT: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#0d0d0d',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
  backgroundSize: '48px 48px',
  cursor: 'grab',
  userSelect: 'none',
};

const S_TOOLBAR: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  zIndex: 20,
};

const S_BTN: CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #333',
  borderRadius: 6,
  backgroundColor: '#1a1a1a',
  color: '#e0e0e0',
  fontSize: 16,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

const S_BTN_ACTIVE: CSSProperties = {
  ...S_BTN,
  backgroundColor: '#4caf50',
  color: '#0d0d0d',
  borderColor: '#4caf50',
};

const S_TOOLTIP: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 30,
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 8,
  padding: '12px 16px',
  color: '#e0e0e0',
  fontSize: 12,
  lineHeight: 1.6,
  minWidth: 200,
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
};

const S_LEGEND: CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: 12,
  display: 'flex',
  gap: 12,
  zIndex: 20,
  fontSize: 10,
  color: '#888',
};

const S_LEGEND_ITEM: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

/** Toolbar button with hover effect. */
const ToolbarBtn: FC<{
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}> = ({ label, title, active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const base = active ? S_BTN_ACTIVE : S_BTN;
  const style: CSSProperties = {
    ...base,
    ...(hovered && !active ? { backgroundColor: '#2a2a2a' } : {}),
  };
  return (
    <button
      style={style}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export const MapViewport: FC = () => {
  // ── Store data ──────────────────────────────────────────────────────────
  const playerFaction = useGameStore((s) => s.playerFaction);
  const nationStates = useGameStore((s) => s.nationStates);
  const relationshipMatrix = useGameStore((s) => s.relationshipMatrix);

  // ── Local map state ─────────────────────────────────────────────────────
  const [mapState, setMapState] = useState<MapViewState>(() =>
    initializeMapViewState(playerFaction || 'us'),
  );

  // ── Tooltip / interaction state ─────────────────────────────────────────
  const [hoveredFaction, setHoveredFaction] = useState<FactionId | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<FactionId | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag state ──────────────────────────────────────────────────────────
  const isDragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const zoom = mapState.zoomLevel;
  const panX = mapState.panOffset.x;
  const panY = mapState.panOffset.y;
  const flagScale = computeFlagScale(zoom);

  const hasFactions = ALL_FACTIONS.some((fid) => nationStates[fid] !== undefined);

  // ── Relationship lines (memoised) ──────────────────────────────────────
  const relationshipLines = useMemo(() => {
    if (!mapState.showRelationshipLines) return [];
    const lines: Array<{
      from: FactionId;
      to: FactionId;
      color: string;
      tension: number;
    }> = [];
    for (let i = 0; i < ALL_FACTIONS.length; i++) {
      for (let j = i + 1; j < ALL_FACTIONS.length; j++) {
        const a = ALL_FACTIONS[i]!;
        const b = ALL_FACTIONS[j]!;
        const tension = relationshipMatrix?.[a]?.[b] ?? 50;
        lines.push({
          from: a,
          to: b,
          color: computeRelationshipLineColor(tension),
          tension,
        });
      }
    }
    return lines;
  }, [relationshipMatrix, mapState.showRelationshipLines]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? mapViewConfig.zoom.step : -mapViewConfig.zoom.step;
      setMapState((prev) => applyZoom(prev, delta));
    },
    [],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (rootRef.current) rootRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Tooltip tracking
      setTooltipPos({ x: e.clientX, y: e.clientY });

      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setMapState((prev) =>
        applyPan(prev, dx, dy, { width: CANVAS_W, height: CANVAS_H }),
      );
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (rootRef.current) rootRef.current.style.cursor = 'grab';
  }, []);

  const handleZoomIn = useCallback(() => {
    setMapState((prev) => applyZoom(prev, mapViewConfig.zoom.step));
  }, []);

  const handleZoomOut = useCallback(() => {
    setMapState((prev) => applyZoom(prev, -mapViewConfig.zoom.step));
  }, []);

  const handleHome = useCallback(() => {
    setMapState((prev) => resetToHome(prev));
  }, []);

  const toggleRelLines = useCallback(() => {
    setMapState((prev) => ({ ...prev, showRelationshipLines: !prev.showRelationshipLines }));
  }, []);

  const toggleFlashpoints = useCallback(() => {
    setMapState((prev) => ({ ...prev, showFlashpointIcons: !prev.showFlashpointIcons }));
  }, []);

  // Clear animation flag after transition
  useEffect(() => {
    if (!mapState.animationInProgress) return;
    const id = setTimeout(
      () => setMapState((prev) => ({ ...prev, animationInProgress: false })),
      mapViewConfig.zoom.animationDurationMs,
    );
    return () => clearTimeout(id);
  }, [mapState.animationInProgress]);

  // ── Faction hover helpers ───────────────────────────────────────────────
  const onFactionEnter = useCallback((fid: FactionId) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(
      () => setHoveredFaction(fid),
      mapViewConfig.tooltip.showDelayMs,
    );
  }, []);

  const onFactionLeave = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(
      () => setHoveredFaction(null),
      mapViewConfig.tooltip.hideDelayMs,
    );
  }, []);

  const onFactionClick = useCallback((fid: FactionId) => {
    setSelectedFaction((prev) => (prev === fid ? null : fid));
  }, []);

  // ── Tooltip content builder ─────────────────────────────────────────────
  const renderTooltip = () => {
    if (!hoveredFaction) return null;
    const info = FACTION_INFO[hoveredFaction];
    const ns = nationStates[hoveredFaction];
    const playerFid = playerFaction || 'us';
    const tension: number = relationshipMatrix?.[playerFid as FactionId]?.[hoveredFaction] ?? 50;
    const category = classifyTension(tension);

    const categoryBadge: Record<string, { label: string; color: string }> = {
      ally: { label: '🤝 Ally', color: '#22c55e' },
      neutral: { label: '🤜🤛 Neutral', color: '#eab308' },
      rival: { label: '⚔️ Rival', color: '#f97316' },
      hostile: { label: '💀 Hostile', color: '#ef4444' },
    };

    const badge = categoryBadge[category] ?? { label: '🤜🤛 Neutral', color: '#eab308' };

    return (
      <div
        style={{
          ...S_TOOLTIP,
          left: tooltipPos.x + mapViewConfig.tooltip.offsetX,
          top: tooltipPos.y + mapViewConfig.tooltip.offsetY,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: info?.color ?? '#e0e0e0' }}>
          {info?.flag} {info?.name ?? hoveredFaction}
        </div>
        {ns ? (
          <>
            <div>Stability: <b>{ns.stability}</b></div>
            <div>GDP: <b>${ns.gdp}B</b></div>
            <div>Military: <b>{ns.militaryReadiness}</b></div>
            <div>Diplomacy: <b>{ns.diplomaticInfluence}</b></div>
            <div>Treasury: <b>${ns.treasury}B</b></div>
            <div style={{ marginTop: 6, color: badge.color, fontWeight: 600 }}>
              {badge.label} — Tension {tension}
            </div>
          </>
        ) : (
          <div style={{ color: '#666' }}>No data available</div>
        )}
      </div>
    );
  };

  // ── Selected faction detail panel ───────────────────────────────────────
  const renderDetailPanel = () => {
    if (!selectedFaction) return null;
    const info = FACTION_INFO[selectedFaction];
    const ns = nationStates[selectedFaction];
    const playerFid = playerFaction || 'us';
    const tension: number = relationshipMatrix?.[playerFid as FactionId]?.[selectedFaction] ?? 50;
    const category = classifyTension(tension);

    return (
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 25,
          backgroundColor: '#141414',
          border: `1px solid ${info?.color ?? '#333'}`,
          borderRadius: 10,
          padding: '16px 20px',
          color: '#e0e0e0',
          fontSize: 13,
          lineHeight: 1.7,
          minWidth: 240,
          maxWidth: 300,
          boxShadow: '0 6px 32px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{info?.flag}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: info?.color }}>{info?.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{info?.description}</div>
          </div>
        </div>
        {ns ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
            <span style={{ color: '#888' }}>Stability</span><span style={{ fontWeight: 600 }}>{ns.stability}</span>
            <span style={{ color: '#888' }}>GDP</span><span style={{ fontWeight: 600 }}>${ns.gdp}B</span>
            <span style={{ color: '#888' }}>Treasury</span><span style={{ fontWeight: 600 }}>${ns.treasury}B</span>
            <span style={{ color: '#888' }}>Military</span><span style={{ fontWeight: 600 }}>{ns.militaryReadiness}</span>
            <span style={{ color: '#888' }}>Diplomacy</span><span style={{ fontWeight: 600 }}>{ns.diplomaticInfluence}</span>
            <span style={{ color: '#888' }}>Tech</span><span style={{ fontWeight: 600 }}>{ns.techLevel}</span>
            <span style={{ color: '#888' }}>Nuke Idx</span><span style={{ fontWeight: 600 }}>{ns.nuclearThreshold}</span>
            <span style={{ color: '#888' }}>Popularity</span><span style={{ fontWeight: 600 }}>{ns.popularity}</span>
            <span style={{ color: '#888' }}>Tension</span>
            <span style={{ fontWeight: 600, color: computeRelationshipLineColor(tension) }}>
              {tension} ({category})
            </span>
          </div>
        ) : (
          <div style={{ color: '#555' }}>No nation data loaded</div>
        )}
        <button
          onClick={() => setSelectedFaction(null)}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '4px 0',
            border: '1px solid #333',
            borderRadius: 4,
            backgroundColor: '#1a1a1a',
            color: '#888',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Close
        </button>
      </div>
    );
  };

  // ── Render faction node ─────────────────────────────────────────────────
  const renderFactionNode = (fid: FactionId) => {
    const info = FACTION_INFO[fid];
    if (!info) return null;
    const pos = FACTION_POSITIONS[fid];
    if (!pos) return null;

    const isSelected = selectedFaction === fid;
    const isHovered = hoveredFaction === fid;
    const isPlayer = fid === playerFaction;
    const dimmed = selectedFaction !== null && !isSelected;

    const nodeSize = 54 * flagScale;
    const glowColor = info.color;

    return (
      <g
        key={fid}
        transform={`translate(${pos.x}, ${pos.y})`}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => onFactionEnter(fid)}
        onMouseLeave={onFactionLeave}
        onClick={(e) => { e.stopPropagation(); onFactionClick(fid); }}
      >
        {/* Glow ring for selected / hovered */}
        {(isSelected || isHovered) && (
          <circle
            r={nodeSize * 0.72}
            fill="none"
            stroke={glowColor}
            strokeWidth={isSelected ? 3 : 1.5}
            opacity={isSelected ? 0.9 : 0.5}
          >
            {isSelected && (
              <animate attributeName="r" from={nodeSize * 0.72} to={nodeSize * 0.85} dur="1.5s" repeatCount="indefinite" />
            )}
          </circle>
        )}

        {/* Player indicator ring */}
        {isPlayer && (
          <circle
            r={nodeSize * 0.65}
            fill="none"
            stroke="#4caf50"
            strokeWidth={2}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        )}

        {/* Background hex-ish shape */}
        <circle
          r={nodeSize * 0.55}
          fill={`${info.color}22`}
          stroke={info.color}
          strokeWidth={1.5}
          opacity={dimmed ? mapViewConfig.flags.dimmedOpacity : mapViewConfig.flags.activeOpacity}
        />

        {/* Flag emoji */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={nodeSize * 0.45}
          style={{ pointerEvents: 'none' }}
          opacity={dimmed ? 0.35 : 1}
        >
          {info.flag}
        </text>

        {/* Label below */}
        <text
          y={nodeSize * 0.7}
          textAnchor="middle"
          fill={dimmed ? '#555' : '#ccc'}
          fontSize={Math.max(9, 11 * flagScale)}
          fontWeight={isSelected ? 700 : 500}
          style={{ pointerEvents: 'none', letterSpacing: 0.5 }}
        >
          {info.name}
        </text>

        {/* Faction color dot */}
        <circle
          cx={nodeSize * 0.45}
          cy={-nodeSize * 0.38}
          r={4 * flagScale}
          fill={info.color}
          opacity={dimmed ? 0.3 : 0.9}
        />
      </g>
    );
  };

  // ── Render relationship lines (SVG) ─────────────────────────────────────
  const renderLines = () =>
    relationshipLines.map(({ from, to, color, tension }) => {
      const pA = FACTION_POSITIONS[from];
      const pB = FACTION_POSITIONS[to];
      if (!pA || !pB) return null;
      return (
        <line
          key={`${from}-${to}`}
          x1={pA.x}
          y1={pA.y}
          x2={pB.x}
          y2={pB.y}
          stroke={color}
          strokeWidth={mapViewConfig.relationships.lineWidth}
          strokeOpacity={mapViewConfig.relationships.lineOpacity}
          strokeDasharray={tension > 75 ? '6 4' : tension > 50 ? '8 4' : undefined}
        />
      );
    });

  // ── Flashpoint pulsing icons ────────────────────────────────────────────
  const renderFlashpoints = () => {
    if (!mapState.showFlashpointIcons) return null;
    // Show flashpoints at midpoints between hostile pairs
    return relationshipLines
      .filter((l) => l.tension > 75)
      .map(({ from, to, tension }) => {
        const pA = FACTION_POSITIONS[from];
        const pB = FACTION_POSITIONS[to];
        if (!pA || !pB) return null;
        const mx = (pA.x + pB.x) / 2;
        const my = (pA.y + pB.y) / 2;
        const severity = tension > 90 ? 'critical' : 'high';
        const col = mapViewConfig.flashpoints.severityColors[severity];
        return (
          <g key={`fp-${from}-${to}`} transform={`translate(${mx}, ${my})`}>
            <circle r={6} fill={col} opacity={0.7}>
              <animate
                attributeName="r"
                values="6;10;6"
                dur={`${mapViewConfig.flashpoints.pulseAnimationMs}ms`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0.3;0.7"
                dur={`${mapViewConfig.flashpoints.pulseAnimationMs}ms`}
                repeatCount="indefinite"
              />
            </circle>
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fill="#fff"
              style={{ pointerEvents: 'none' }}
            >
              ⚠
            </text>
          </g>
        );
      });
  };

  // ── Grid background for the SVG canvas ──────────────────────────────────
  const renderGrid = () => {
    const lines: React.ReactNode[] = [];
    const step = 60;
    for (let x = 0; x <= CANVAS_W; x += step) {
      lines.push(
        <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={CANVAS_H} stroke="#ffffff06" strokeWidth={0.5} />,
      );
    }
    for (let y = 0; y <= CANVAS_H; y += step) {
      lines.push(
        <line key={`gy-${y}`} x1={0} y1={y} x2={CANVAS_W} y2={y} stroke="#ffffff06" strokeWidth={0.5} />,
      );
    }
    return lines;
  };

  // ── CSS transform ───────────────────────────────────────────────────────
  const transformStyle: CSSProperties = {
    transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
    transformOrigin: '0 0',
    transition: mapState.animationInProgress
      ? `transform ${mapViewConfig.zoom.animationDurationMs}ms ${mapViewConfig.zoom.animationEasing}`
      : 'none',
  };

  // ── Zoom percent label ──────────────────────────────────────────────────
  const zoomPct = `${Math.round(zoom * 100)}%`;

  // ═══════════════════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div
      ref={rootRef}
      style={S_ROOT}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── SVG Canvas ─────────────────────────────────────────────────── */}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ ...transformStyle, display: 'block' }}
      >
        {/* Subtle grid */}
        {renderGrid()}

        {/* Relationship lines */}
        {renderLines()}

        {/* Flashpoint icons */}
        {renderFlashpoints()}

        {/* Faction nodes */}
        {ALL_FACTIONS.map(renderFactionNode)}

        {/* "No data" overlay if game not initialised */}
        {!hasFactions && (
          <text
            x={CANVAS_W / 2}
            y={CANVAS_H / 2}
            textAnchor="middle"
            fill="#444"
            fontSize={16}
            fontWeight={600}
            letterSpacing={2}
          >
            ⬡ START A SCENARIO TO POPULATE MAP
          </text>
        )}
      </svg>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={S_TOOLBAR}>
        <ToolbarBtn label="+" title="Zoom In" onClick={handleZoomIn} />
        <ToolbarBtn label="−" title="Zoom Out" onClick={handleZoomOut} />
        <ToolbarBtn label="⌂" title="Reset Home" onClick={handleHome} />
        <div style={{ height: 8 }} />
        <ToolbarBtn
          label="⟋"
          title="Toggle Relationship Lines"
          active={mapState.showRelationshipLines}
          onClick={toggleRelLines}
        />
        <ToolbarBtn
          label="⚠"
          title="Toggle Flashpoint Icons"
          active={mapState.showFlashpointIcons}
          onClick={toggleFlashpoints}
        />
      </div>

      {/* ── Zoom indicator ─────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 20,
          color: '#555',
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        {zoomPct}
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={S_LEGEND}>
        <span style={S_LEGEND_ITEM}>
          <span style={{ width: 14, height: 3, backgroundColor: mapViewConfig.relationships.allyColor, display: 'inline-block', borderRadius: 1 }} />
          Ally
        </span>
        <span style={S_LEGEND_ITEM}>
          <span style={{ width: 14, height: 3, backgroundColor: mapViewConfig.relationships.neutralColor, display: 'inline-block', borderRadius: 1 }} />
          Neutral
        </span>
        <span style={S_LEGEND_ITEM}>
          <span style={{ width: 14, height: 3, backgroundColor: mapViewConfig.relationships.rivalColor, display: 'inline-block', borderRadius: 1 }} />
          Rival
        </span>
        <span style={S_LEGEND_ITEM}>
          <span style={{ width: 14, height: 3, backgroundColor: mapViewConfig.relationships.hostileColor, display: 'inline-block', borderRadius: 1, borderTop: '1px dashed #ef4444' }} />
          Hostile
        </span>
      </div>

      {/* ── Tooltip overlay ────────────────────────────────────────────── */}
      {renderTooltip()}

      {/* ── Detail panel ───────────────────────────────────────────────── */}
      {renderDetailPanel()}
    </div>
  );
};
