/**
 * WorldMapSVG — Real SVG world map using SimpleMaps MIT-licensed data.
 *
 * Source: https://simplemaps.com/resources/svg-world
 * License: MIT — Copyright (c) 2020 Pareto Software, LLC DBA Simplemaps.com
 *
 * Loads public/world.svg via Vite ?raw import, injects it into the DOM,
 * then manipulates country path elements to highlight the 8 game factions.
 * Draws relationship lines with conflict (⚔️) and ally (🤝) icons.
 */

import { useRef, useEffect, useState, useCallback, type FC, type JSX, type CSSProperties } from 'react';
import type { FactionId } from '@/data/types';
import { FACTION_INFO } from '@/engine/game-controller';
import { mapViewConfig } from '@/engine/config/map-view';
// Vite ?raw import — gives us the SVG markup as a string
import worldSvgRaw from '../assets/world.svg?raw';

// ═══════════════════════════════════════════════════════════════
// ZOOM / PAN STATE & HELPERS
// ═══════════════════════════════════════════════════════════════

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const { min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP } = mapViewConfig.zoom;

// ═══════════════════════════════════════════════════════════════
// TOOLBAR STYLES
// ═══════════════════════════════════════════════════════════════

const S_TOOLBAR: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  zIndex: 30,
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

const S_ZOOM_BADGE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 24,
  fontSize: 10,
  color: '#777',
  userSelect: 'none',
};

// ═══════════════════════════════════════════════════════════════
// FACTION → SVG ELEMENT SELECTOR MAPPING
// The SimpleMaps SVG uses:
//   class="CountryName" for multi-path countries (islands etc.)
//   id="XX"             for single-path countries (ISO 3166-1 alpha-2)
// ═══════════════════════════════════════════════════════════════

interface FactionMapConfig {
  /** CSS selectors to find this faction's <path> elements in the SVG */
  selectors: string[];
  /** Label anchor (x, y) in the SVG's 2000×857 viewBox coordinate space */
  cx: number;
  cy: number;
  /** Optional label offset from centroid so small-country labels don't overlap territory */
  labelDx?: number;
  labelDy?: number;
}

const FACTION_MAP: Record<string, FactionMapConfig> = {
  us: {
    selectors: ['.United.States', '[class="United States"]'],
    cx: 373, cy: 219,
  },
  eu: {
    selectors: [
      '[class="France"]', '[id="DE"]', '[id="ES"]',
      '[class="Italy"]', '[id="NL"]', '[id="BE"]',
      '[id="PL"]', '[id="SE"]', '[id="AT"]', '[id="PT"]',
      '[id="IE"]', '[id="FI"]', '[class="Denmark"]',
      '[class="Greece"]', '[id="CZ"]', '[id="HU"]',
      '[id="RO"]', '[id="BG"]', '[id="HR"]', '[id="SK"]',
      '[id="SI"]', '[id="LT"]', '[id="LV"]', '[id="EE"]',
      '[id="LU"]', '[class="Cyprus"]',
    ],
    cx: 1052, cy: 172,
    labelDx: -30, labelDy: 20,
  },
  russia: {
    selectors: ['[class="Russian Federation"]'],
    cx: 1430, cy: 124,
    labelDy: -10,
  },
  china: {
    selectors: ['[class="China"]'],
    cx: 1517, cy: 273,
    labelDy: 10,
  },
  japan: {
    selectors: ['[class="Japan"]'],
    cx: 1710, cy: 256,
    labelDx: 30,
  },
  iran: {
    selectors: ['[id="IR"]'],
    cx: 1276, cy: 294,
    labelDy: 45,
  },
  dprk: {
    selectors: ['[id="KP"]'],
    cx: 1649, cy: 243,
    labelDx: -55, labelDy: 30,
  },
  syria: {
    selectors: ['[id="SY"]'],
    cx: 1194, cy: 279,
    labelDx: -70, labelDy: 10,
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Parse the raw SVG string into an SVGSVGElement ready for DOM insertion. */
function parseSvg(raw: string): SVGSVGElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export const WorldMapSVG: FC<{
  nationStates: Record<string, any>;
  relations: Record<string, Record<string, number>>;
  playerFaction: FactionId;
  onSelectFaction: (fid: FactionId) => void;
}> = ({ nationStates, relations, playerFaction, onSelectFaction }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);

  // ── Zoom / Pan state ──────────────────────────────────────────
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // ── Zoom helpers ──────────────────────────────────────────────
  const doZoom = useCallback((delta: number) => {
    setZoom((z) => clamp(z + delta, ZOOM_MIN, ZOOM_MAX));
  }, []);

  const handleZoomIn = useCallback(() => doZoom(ZOOM_STEP), [doZoom]);
  const handleZoomOut = useCallback(() => doZoom(-ZOOM_STEP), [doZoom]);
  const handleZoomReset = useCallback(() => {
    setZoom(ZOOM_MIN);
    setPanX(0);
    setPanY(0);
  }, []);

  // ── Mouse wheel zoom ─────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((z) => clamp(z + delta, ZOOM_MIN, ZOOM_MAX));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Drag-to-pan ───────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPanX((px) => px + dx);
    setPanY((py) => py + dy);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  }, []);

  // ── Inject & style the base world SVG ────────────────────────
  useEffect(() => {
    const el = transformRef.current;
    if (!el) return;

    // Remove any previously-injected map SVG
    const old = el.querySelector('svg.world-base');
    if (old) old.remove();

    // Parse raw SVG into a real DOM element
    const svgEl = parseSvg(worldSvgRaw);
    svgEl.classList.add('world-base');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    // Ensure proper viewBox (the source SVG uses lowercase 'viewbox')
    if (!svgEl.getAttribute('viewBox')) {
      svgEl.setAttribute('viewBox', '0 0 2000 857');
    }
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.style.display = 'block';
    // Overwrite default light fill with dark-theme land colour
    svgEl.setAttribute('fill', '#1a2233');
    svgEl.setAttribute('stroke', '#2a3a4a');
    svgEl.setAttribute('stroke-width', '0.4');

    // ── Colour each faction's territory ──────────────────────
    const fids = Object.keys(FACTION_MAP);
    for (const fid of fids) {
      const cfg = FACTION_MAP[fid]!;
      const info = FACTION_INFO[fid as FactionId];
      if (!info) continue;
      const isPlayer = fid === (playerFaction as string);

      for (const sel of cfg.selectors) {
        svgEl.querySelectorAll(sel).forEach((node) => {
          const p = node as SVGPathElement;
          p.setAttribute('fill', isPlayer ? `${info.color}50` : `${info.color}30`);
          p.setAttribute('stroke', isPlayer ? info.color : `${info.color}88`);
          p.setAttribute('stroke-width', isPlayer ? '2' : '0.8');
          p.style.cursor = isPlayer ? 'default' : 'pointer';
          p.style.transition = 'fill 0.2s, stroke 0.2s';
          p.dataset.faction = fid;
        });
      }
    }

    // Insert SVG as first child (overlay goes on top)
    el.insertBefore(svgEl, el.firstChild);

    // ── Click handler (event delegation) ─────────────────────
    const onClick = (e: Event) => {
      const tgt = e.target as SVGElement;
      const fid = tgt?.dataset?.faction;
      if (fid && fid !== (playerFaction as string)) {
        onSelectFaction(fid as FactionId);
      }
    };
    svgEl.addEventListener('click', onClick);

    // ── Hover effects ────────────────────────────────────────
    const onOver = (e: Event) => {
      const tgt = e.target as SVGPathElement;
      const fid = tgt?.dataset?.faction;
      if (!fid || fid === (playerFaction as string)) return;
      const info = FACTION_INFO[fid as FactionId];
      if (info) {
        tgt.setAttribute('fill', `${info.color}55`);
        tgt.setAttribute('stroke-width', '2');
      }
    };
    const onOut = (e: Event) => {
      const tgt = e.target as SVGPathElement;
      const fid = tgt?.dataset?.faction;
      if (!fid) return;
      const info = FACTION_INFO[fid as FactionId];
      if (!info) return;
      const isP = fid === (playerFaction as string);
      tgt.setAttribute('fill', isP ? `${info.color}50` : `${info.color}30`);
      tgt.setAttribute('stroke-width', isP ? '2' : '0.8');
    };
    svgEl.addEventListener('mouseover', onOver);
    svgEl.addEventListener('mouseout', onOut);

    return () => {
      svgEl.removeEventListener('click', onClick);
      svgEl.removeEventListener('mouseover', onOver);
      svgEl.removeEventListener('mouseout', onOut);
    };
  }, [playerFaction, onSelectFaction]);

  // ═════════════════════════════════════════════════════════════
  // OVERLAY: relationship lines, labels, legend
  // ═════════════════════════════════════════════════════════════
  const fids = Object.keys(FACTION_MAP);

  // ── Relationship lines ───────────────────────────────────────
  const lines: JSX.Element[] = [];
  for (let i = 0; i < fids.length; i++) {
    for (let j = i + 1; j < fids.length; j++) {
      const f1 = fids[i]!;
      const f2 = fids[j]!;
      const tension = relations[f1]?.[f2] ?? 0;
      if (Math.abs(tension) < 15) continue;

      const c1 = FACTION_MAP[f1]!;
      const c2 = FACTION_MAP[f2]!;
      const isConflict = tension > 40;
      const isAlly = tension < -30;
      const isHostile = tension > 0;

      const stroke = isConflict
        ? 'rgba(239,83,80,0.5)'
        : isHostile
          ? 'rgba(255,179,0,0.25)'
          : 'rgba(76,175,80,0.4)';
      const sw = Math.min(3, Math.abs(tension) / 20);
      const mx = (c1.cx + c2.cx) / 2;
      const my = (c1.cy + c2.cy) / 2;

      lines.push(
        <g key={`r-${f1}-${f2}`}>
          <line x1={c1.cx} y1={c1.cy} x2={c2.cx} y2={c2.cy}
            stroke={stroke} strokeWidth={sw}
            strokeDasharray={isHostile ? '8,5' : undefined} />
          {isConflict && (
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontSize="22">⚔️</text>
          )}
          {isAlly && (
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
              fontSize="22">🤝</text>
          )}
          {(isConflict || isAlly) && (
            <text x={mx} y={my + 18} textAnchor="middle" fontSize="11"
              fill={isConflict ? '#ef5350' : '#4caf50'} opacity="0.8">
              {tension > 0 ? '+' : ''}{Math.round(tension)}
            </text>
          )}
        </g>,
      );
    }
  }

  // ── Faction labels ───────────────────────────────────────────
  const labels = fids.map((fid) => {
    const cfg = FACTION_MAP[fid]!;
    const info = FACTION_INFO[fid as FactionId];
    const ns = nationStates[fid];
    const isPlayer = fid === (playerFaction as string);
    if (!info) return null;

    // Label position = centroid + optional offset
    const lx = cfg.cx + (cfg.labelDx ?? 0);
    const ly = cfg.cy + (cfg.labelDy ?? 0);

    return (
      <g key={`lbl-${fid}`}>
        {/* Connector line from centroid to offset label */}
        {(cfg.labelDx || cfg.labelDy) && (
          <line x1={cfg.cx} y1={cfg.cy} x2={lx} y2={ly}
            stroke={info.color} strokeWidth={0.8} opacity={0.4}
            strokeDasharray="3,2" />
        )}

        {/* Animated pulse ring for player (at territory centroid) */}
        {isPlayer && (
          <circle cx={cfg.cx} cy={cfg.cy} r={6} fill="none"
            stroke="#4caf50" strokeWidth="2" opacity="0.5">
            <animate attributeName="r" values="6;20;6" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.05;0.5" dur="3s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Background pill */}
        <rect x={lx - 52} y={ly - 36} width={104} height={isPlayer ? 74 : 66}
          rx={6} fill="rgba(0,0,0,0.7)"
          stroke={isPlayer ? info.color : 'rgba(255,255,255,0.06)'}
          strokeWidth={isPlayer ? 1.5 : 0.5} />

        {/* ★ YOU tag */}
        {isPlayer && (
          <text x={lx} y={ly - 24} textAnchor="middle"
            fontSize="11" fill="#4caf50" fontWeight="700">★ YOU</text>
        )}

        {/* Flag emoji */}
        <text x={lx} y={ly - 8} textAnchor="middle"
          fontSize="22">{info.flag}</text>

        {/* Country name */}
        <text x={lx} y={ly + 10} textAnchor="middle"
          fontSize="13" fill={info.color} fontWeight="700">{info.name}</text>

        {/* Stats */}
        {ns && (
          <>
            <text x={lx} y={ly + 22} textAnchor="middle"
              fontSize="9.5" fill="#aaa">
              STB {Math.round(ns.stability)} · MIL {Math.round(ns.militaryReadiness)}
            </text>
            <text x={lx} y={ly + 33} textAnchor="middle"
              fontSize="9.5" fill="#777">
              ${Math.round(ns.treasury)}B · DIP {Math.round(ns.diplomaticInfluence)}
            </text>
          </>
        )}
      </g>
    );
  });

  // ── Legend ────────────────────────────────────────────────────
  const legend = (
    <g transform="translate(24, 814)">
      <rect x="-8" y="-16" width={430} height={38} rx={5} fill="rgba(0,0,0,0.65)" />
      <text x="0" y="0" fontSize="10" fill="#555" fontWeight="700" letterSpacing="1">LEGEND</text>
      <text x="0" y="16" fontSize="15">⚔️</text>
      <text x="22" y="16" fontSize="10" fill="#ef5350">Conflict (tension &gt; 40)</text>
      <text x="165" y="16" fontSize="15">🤝</text>
      <text x="187" y="16" fontSize="10" fill="#4caf50">Alliance (tension &lt; −30)</text>
      <line x1="325" y1="12" x2="362" y2="12" stroke="rgba(255,179,0,0.6)" strokeWidth="2" strokeDasharray="6,4" />
      <text x="368" y="16" fontSize="10" fill="#ffb300">Hostile</text>
    </g>
  );

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#070b14',
        backgroundImage: 'radial-gradient(ellipse at 50% 50%, #0d1422 0%, #070b14 70%)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
      }}
    >
      {/* ── Transform wrapper (zoom + pan) ────────────────────── */}
      <div
        ref={transformRef}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
          transformOrigin: 'center center',
          transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {/* Overlay SVG sits on top of the injected world.svg */}
        <svg
          viewBox="0 0 2000 857"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        >
          {lines}
          {labels}
          {legend}
        </svg>
      </div>

      {/* ── Zoom toolbar (stays fixed in screen space) ────────── */}
      <div style={S_TOOLBAR}>
        <button style={S_BTN} title="Zoom in" onClick={handleZoomIn}>+</button>
        <button style={S_BTN} title="Zoom out" onClick={handleZoomOut}>−</button>
        <button style={S_BTN} title="Reset view" onClick={handleZoomReset}>⌂</button>
        <div style={S_ZOOM_BADGE}>{zoom.toFixed(1)}×</div>
      </div>
    </div>
  );
};
