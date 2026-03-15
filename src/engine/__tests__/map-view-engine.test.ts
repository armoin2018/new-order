/**
 * Interactive Map View Engine — Test Suite
 *
 * 42 Vitest tests covering all 10 pure functions in map-view-engine.ts.
 *
 * @see FR-4901 — Smooth zoom and pan
 * @see FR-4902 — Auto-zoom to home country
 * @see FR-4903 — Country flag overlays
 * @see FR-4904 — Mini country dashboard tooltip
 * @see FR-4906 — Map visual enhancements
 */

import { describe, it, expect } from 'vitest';
import {
  initializeMapViewState,
  applyZoom,
  applyPan,
  zoomToCountry,
  computeFlagScale,
  buildMiniDashboard,
  computeRelationshipLineColor,
  classifyTension,
  isAnimating,
  resetToHome,
} from '@/engine/map-view-engine';
import type { MapViewState } from '@/data/types/map-view.types';
import { mapViewConfig } from '@/engine/config/map-view';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMapState(overrides: Partial<MapViewState> = {}): MapViewState {
  return {
    zoomLevel: 1.0 as MapViewState['zoomLevel'],
    panOffset: { x: 0, y: 0 },
    hoveredNationId: null,
    selectedNationId: null,
    homeCountryId: 'us',
    showRelationshipLines: true,
    showFlashpointIcons: true,
    showMinimapPanel: true,
    animationInProgress: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeMapViewState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeMapViewState', () => {
  it('creates state with the given homeCountryId', () => {
    const state = initializeMapViewState('us');
    expect(state.homeCountryId).toBe('us');
  });

  it('starts at zoom level 1.0', () => {
    const state = initializeMapViewState('eu');
    expect(state.zoomLevel).toBe(1.0);
  });

  it('starts with pan offset at origin', () => {
    const state = initializeMapViewState('china');
    expect(state.panOffset).toEqual({ x: 0, y: 0 });
  });

  it('is not animating initially', () => {
    const state = initializeMapViewState('us');
    expect(state.animationInProgress).toBe(false);
  });

  it('has no hovered or selected nation', () => {
    const state = initializeMapViewState('us');
    expect(state.hoveredNationId).toBeNull();
    expect(state.selectedNationId).toBeNull();
  });

  it('defaults overlay toggles to true', () => {
    const state = initializeMapViewState('us');
    expect(state.showRelationshipLines).toBe(true);
    expect(state.showFlashpointIcons).toBe(true);
    expect(state.showMinimapPanel).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — applyZoom
// ═══════════════════════════════════════════════════════════════════════════

describe('applyZoom', () => {
  it('increases zoom on positive delta', () => {
    const state = buildMapState({ zoomLevel: 2.0 as any });
    const result = applyZoom(state, 0.5);
    expect(result.zoomLevel).toBe(2.5);
  });

  it('decreases zoom on negative delta', () => {
    const state = buildMapState({ zoomLevel: 3.0 as any });
    const result = applyZoom(state, -1.0);
    expect(result.zoomLevel).toBe(2.0);
  });

  it('clamps at maximum zoom', () => {
    const state = buildMapState({ zoomLevel: 7.5 as any });
    const result = applyZoom(state, 2.0);
    expect(result.zoomLevel).toBe(mapViewConfig.zoom.max);
  });

  it('clamps at minimum zoom', () => {
    const state = buildMapState({ zoomLevel: 1.5 as any });
    const result = applyZoom(state, -2.0);
    expect(result.zoomLevel).toBe(mapViewConfig.zoom.min);
  });

  it('returns a new object (immutable)', () => {
    const state = buildMapState();
    const result = applyZoom(state, 0.5);
    expect(result).not.toBe(state);
  });

  it('applies zoom step increments', () => {
    const state = buildMapState({ zoomLevel: 1.0 as any });
    const result = applyZoom(state, mapViewConfig.zoom.step);
    expect(result.zoomLevel).toBe(1.0 + mapViewConfig.zoom.step);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — applyPan
// ═══════════════════════════════════════════════════════════════════════════

describe('applyPan', () => {
  const bounds = { width: 2000, height: 857 };

  it('moves pan offset by dx and dy', () => {
    const state = buildMapState();
    const result = applyPan(state, 100, 50, bounds);
    expect(result.panOffset.x).toBe(100);
    expect(result.panOffset.y).toBe(50);
  });

  it('constrains pan to map bounds (positive)', () => {
    const state = buildMapState();
    const result = applyPan(state, 5000, 3000, bounds);
    expect(result.panOffset.x).toBeLessThanOrEqual(bounds.width);
    expect(result.panOffset.y).toBeLessThanOrEqual(bounds.height);
  });

  it('constrains pan to map bounds (negative)', () => {
    const state = buildMapState();
    const result = applyPan(state, -5000, -3000, bounds);
    expect(result.panOffset.x).toBeGreaterThanOrEqual(-bounds.width);
    expect(result.panOffset.y).toBeGreaterThanOrEqual(-bounds.height);
  });

  it('returns a new object', () => {
    const state = buildMapState();
    const result = applyPan(state, 10, 10, bounds);
    expect(result).not.toBe(state);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — zoomToCountry
// ═══════════════════════════════════════════════════════════════════════════

describe('zoomToCountry', () => {
  it('centers on the given coordinates', () => {
    const state = buildMapState();
    const result = zoomToCountry(state, 500, 300, 100, 800, 600);
    expect(result.panOffset.x).not.toBe(0);
  });

  it('calculates zoom to fill ~60% of viewport', () => {
    const state = buildMapState();
    const result = zoomToCountry(state, 500, 300, 50, 800, 600);
    expect(result.zoomLevel).toBeGreaterThan(1.0);
  });

  it('clamps zoom to max', () => {
    const state = buildMapState();
    const result = zoomToCountry(state, 500, 300, 1, 800, 600);
    expect(result.zoomLevel).toBeLessThanOrEqual(mapViewConfig.zoom.max);
  });

  it('returns new state object', () => {
    const state = buildMapState();
    const result = zoomToCountry(state, 500, 300, 100, 800, 600);
    expect(result).not.toBe(state);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — computeFlagScale
// ═══════════════════════════════════════════════════════════════════════════

describe('computeFlagScale', () => {
  it('returns minScale at minimum zoom', () => {
    const scale = computeFlagScale(mapViewConfig.zoom.min);
    expect(scale).toBeCloseTo(mapViewConfig.flags.minScale, 1);
  });

  it('returns maxScale at maximum zoom', () => {
    const scale = computeFlagScale(mapViewConfig.zoom.max);
    expect(scale).toBeCloseTo(mapViewConfig.flags.maxScale, 1);
  });

  it('returns intermediate scale at mid zoom', () => {
    const midZoom = (mapViewConfig.zoom.min + mapViewConfig.zoom.max) / 2;
    const scale = computeFlagScale(midZoom);
    expect(scale).toBeGreaterThan(mapViewConfig.flags.minScale);
    expect(scale).toBeLessThan(mapViewConfig.flags.maxScale);
  });

  it('clamps below min scale', () => {
    const scale = computeFlagScale(0);
    expect(scale).toBeGreaterThanOrEqual(mapViewConfig.flags.minScale);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — buildMiniDashboard
// ═══════════════════════════════════════════════════════════════════════════

describe('buildMiniDashboard', () => {
  it('returns all required fields', () => {
    const data = buildMiniDashboard(
      'us', 'United States', 'President', '/img/us.png',
      75, '$28.7T', 90, 85, 15,
      { stability: 'up', gdp: 'stable' },
      'ally', 10,
    );
    expect(data.nationId).toBe('us');
    expect(data.nationName).toBe('United States');
    expect(data.leaderName).toBe('President');
    expect(data.stability).toBe(75);
    expect(data.gdp).toBe('$28.7T');
    expect(data.militaryReadiness).toBe(90);
    expect(data.diplomaticInfluence).toBe(85);
    expect(data.civilUnrest).toBe(15);
  });

  it('includes trend arrows', () => {
    const data = buildMiniDashboard(
      'us', 'US', 'Pres', '/img.png', 50, '$1T', 50, 50, 50,
      { stability: 'down', economy: 'up' },
      'neutral', 50,
    );
    expect(data.trendArrows.stability).toBe('down');
    expect(data.trendArrows.economy).toBe('up');
  });

  it('includes relationship with player', () => {
    const data = buildMiniDashboard(
      'iran', 'Iran', 'Leader', '/img.png', 30, '$300B', 60, 20, 70,
      {},
      'hostile', 90,
    );
    expect(data.relationshipToPlayer.category).toBe('hostile');
    expect(data.relationshipToPlayer.tensionScore).toBe(90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — computeRelationshipLineColor
// ═══════════════════════════════════════════════════════════════════════════

describe('computeRelationshipLineColor', () => {
  it('returns ally color for low tension', () => {
    const color = computeRelationshipLineColor(10);
    expect(color).toBe(mapViewConfig.relationships.allyColor);
  });

  it('returns neutral color for moderate tension', () => {
    const color = computeRelationshipLineColor(40);
    expect(color).toBe(mapViewConfig.relationships.neutralColor);
  });

  it('returns rival color for high tension', () => {
    const color = computeRelationshipLineColor(60);
    expect(color).toBe(mapViewConfig.relationships.rivalColor);
  });

  it('returns hostile color for very high tension', () => {
    const color = computeRelationshipLineColor(90);
    expect(color).toBe(mapViewConfig.relationships.hostileColor);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — classifyTension
// ═══════════════════════════════════════════════════════════════════════════

describe('classifyTension', () => {
  it('classifies 0 as ally', () => {
    expect(classifyTension(0)).toBe('ally');
  });

  it('classifies 25 as ally', () => {
    expect(classifyTension(25)).toBe('ally');
  });

  it('classifies 26 as neutral', () => {
    expect(classifyTension(26)).toBe('neutral');
  });

  it('classifies 50 as neutral', () => {
    expect(classifyTension(50)).toBe('neutral');
  });

  it('classifies 51 as rival', () => {
    expect(classifyTension(51)).toBe('rival');
  });

  it('classifies 75 as rival', () => {
    expect(classifyTension(75)).toBe('rival');
  });

  it('classifies 76 as hostile', () => {
    expect(classifyTension(76)).toBe('hostile');
  });

  it('classifies 100 as hostile', () => {
    expect(classifyTension(100)).toBe('hostile');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — isAnimating
// ═══════════════════════════════════════════════════════════════════════════

describe('isAnimating', () => {
  it('returns false when not animating', () => {
    const state = buildMapState({ animationInProgress: false });
    expect(isAnimating(state)).toBe(false);
  });

  it('returns true when animating', () => {
    const state = buildMapState({ animationInProgress: true });
    expect(isAnimating(state)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — resetToHome
// ═══════════════════════════════════════════════════════════════════════════

describe('resetToHome', () => {
  it('resets zoom to 1.0', () => {
    const state = buildMapState({ zoomLevel: 5.0 as any, panOffset: { x: 500, y: 300 } });
    const result = resetToHome(state);
    expect(result.zoomLevel).toBe(1.0);
  });

  it('resets pan to origin', () => {
    const state = buildMapState({ panOffset: { x: 500, y: 300 } });
    const result = resetToHome(state);
    expect(result.panOffset).toEqual({ x: 0, y: 0 });
  });

  it('preserves homeCountryId', () => {
    const state = buildMapState({ homeCountryId: 'japan' });
    const result = resetToHome(state);
    expect(result.homeCountryId).toBe('japan');
  });

  it('returns new object', () => {
    const state = buildMapState();
    const result = resetToHome(state);
    expect(result).not.toBe(state);
  });
});
