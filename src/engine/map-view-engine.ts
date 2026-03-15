/**
 * Interactive Map View Engine — FR-4900
 *
 * Pure functions for managing the interactive SVG world-map view:
 * zoom/pan state, country flag scaling, mini-dashboard data assembly,
 * relationship line colouring, and tension classification.
 *
 * **No side effects** — all functions return new objects without mutation.
 *
 * @see FR-4900 — Interactive Map View feature
 * @see FR-4901 — Zoom and pan controls
 * @see FR-4902 — Home country focus and reset
 * @see FR-4903 — Flag overlay scaling
 * @see FR-4904 — Mini-dashboard tooltip data
 * @see FR-4906 — Relationship line colouring
 */

import type {
  MapViewState,
  ZoomLevel,
  MiniDashboardData,
  RelationshipCategory,
  TrendDirection,
} from '@/data/types/map-view.types';
import { mapViewConfig } from '@/engine/config/map-view';

// ═══════════════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clamp a numeric value between an inclusive minimum and maximum.
 *
 * @param v — Value to clamp.
 * @param min — Lower bound (inclusive).
 * @param max — Upper bound (inclusive).
 * @returns Clamped value.
 */
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeMapViewState                                      FR-4902
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a fresh {@link MapViewState} zoomed to the player's home country.
 *
 * The initial zoom level is set to the minimum (fully zoomed out) and the
 * pan offset is centred at the origin.
 *
 * @param homeCountryId — Nation code of the player's home country.
 * @returns An initial map view state ready for interaction.
 * @see FR-4902
 */
export function initializeMapViewState(homeCountryId: string): MapViewState {
  return {
    zoomLevel: mapViewConfig.zoom.min as ZoomLevel,
    panOffset: { x: 0, y: 0 },
    hoveredNationId: null,
    selectedNationId: null,
    homeCountryId,
    showRelationshipLines: true,
    showFlashpointIcons: true,
    showMinimapPanel: true,
    animationInProgress: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — applyZoom                                                   FR-4901
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a zoom delta to the current state, clamping the result to the
 * configured minimum and maximum zoom levels.
 *
 * @param state — Current map view state.
 * @param delta — Signed zoom delta (positive = zoom in, negative = zoom out).
 * @returns Updated state with the new zoom level.
 * @see FR-4901
 */
export function applyZoom(state: MapViewState, delta: number): MapViewState {
  const newZoom = clamp(
    state.zoomLevel + delta,
    mapViewConfig.zoom.min,
    mapViewConfig.zoom.max,
  ) as ZoomLevel;

  return {
    ...state,
    zoomLevel: newZoom,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — applyPan                                                    FR-4901
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a pan offset to the current state, constraining the camera
 * within the supplied map bounds.
 *
 * @param state — Current map view state.
 * @param dx — Horizontal pixel delta (positive = pan right).
 * @param dy — Vertical pixel delta (positive = pan down).
 * @param mapBounds — Pixel dimensions of the full map canvas.
 * @returns Updated state with the constrained pan offset.
 * @see FR-4901
 */
export function applyPan(
  state: MapViewState,
  dx: number,
  dy: number,
  mapBounds: { width: number; height: number },
): MapViewState {
  const newX = clamp(state.panOffset.x + dx, -mapBounds.width, mapBounds.width);
  const newY = clamp(state.panOffset.y + dy, -mapBounds.height, mapBounds.height);

  return {
    ...state,
    panOffset: { x: newX, y: newY },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — zoomToCountry                                               FR-4902
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the zoom level and pan offset required to centre a country
 * on-screen, filling approximately 60 % of the viewport (configurable
 * via {@link mapViewConfig.zoom.homeZoomFillPercent}).
 *
 * The resulting zoom is clamped to the configured min/max range.
 *
 * @param state — Current map view state.
 * @param cx — Country centroid X coordinate on the SVG canvas.
 * @param cy — Country centroid Y coordinate on the SVG canvas.
 * @param territoryRadius — Approximate radius (in SVG units) of the country's territory.
 * @param viewportWidth — Current viewport width in pixels.
 * @param viewportHeight — Current viewport height in pixels.
 * @returns Updated state zoomed and panned to the target country.
 * @see FR-4902
 */
export function zoomToCountry(
  state: MapViewState,
  cx: number,
  cy: number,
  territoryRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): MapViewState {
  const fillPct = mapViewConfig.zoom.homeZoomFillPercent;
  const viewportMin = Math.min(viewportWidth, viewportHeight);

  // Desired diameter on screen = fillPct × viewportMin.
  // zoom = desiredDiameter / (2 × territoryRadius)
  const desiredDiameter = fillPct * viewportMin;
  const rawZoom = territoryRadius > 0
    ? desiredDiameter / (2 * territoryRadius)
    : mapViewConfig.zoom.min;

  const newZoom = clamp(
    rawZoom,
    mapViewConfig.zoom.min,
    mapViewConfig.zoom.max,
  ) as ZoomLevel;

  // Pan so the country centroid is at the viewport centre.
  const panX = (viewportWidth / 2) - cx * newZoom;
  const panY = (viewportHeight / 2) - cy * newZoom;

  return {
    ...state,
    zoomLevel: newZoom,
    panOffset: { x: panX, y: panY },
    animationInProgress: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — computeFlagScale                                            FR-4903
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the display scale for country flag overlays based on the
 * current zoom level, clamped between the configured minimum and maximum
 * flag scales.
 *
 * Formula:
 * ```
 * t     = (zoomLevel - zoomMin) / (zoomMax - zoomMin)
 * scale = minScale + t × (maxScale - minScale)
 * ```
 *
 * @param zoomLevel — Current camera zoom level.
 * @returns Scale factor for flag overlays.
 * @see FR-4903
 */
export function computeFlagScale(zoomLevel: number): number {
  const { min: zoomMin, max: zoomMax } = mapViewConfig.zoom;
  const { minScale, maxScale } = mapViewConfig.flags;

  const t = zoomMax !== zoomMin
    ? (zoomLevel - zoomMin) / (zoomMax - zoomMin)
    : 0;

  const scale = minScale + t * (maxScale - minScale);
  return clamp(scale, minScale, maxScale);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — buildMiniDashboard                                          FR-4904
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble a {@link MiniDashboardData} object for a nation's tooltip panel.
 *
 * This is a pure data-mapping function — it does not fetch or derive any
 * values itself.
 *
 * @param nationId — Unique nation identifier.
 * @param nationName — Display name of the nation.
 * @param leaderName — Display name of the current leader.
 * @param leaderPortrait — Path or URL to the leader's portrait image.
 * @param stability — Overall stability score (0–100).
 * @param gdp — Formatted GDP string (e.g. "$1.2T").
 * @param militaryReadiness — Military readiness score (0–100).
 * @param diplomaticInfluence — Diplomatic influence score (0–100).
 * @param civilUnrest — Civil unrest score (0–100).
 * @param trendArrows — Trend arrows keyed by metric name.
 * @param relationshipCategory — High-level relationship category with the player.
 * @param tensionScore — Numeric tension score (higher = more tense).
 * @returns A fully populated {@link MiniDashboardData} object.
 * @see FR-4904
 */
export function buildMiniDashboard(
  nationId: string,
  nationName: string,
  leaderName: string,
  leaderPortrait: string,
  stability: number,
  gdp: string,
  militaryReadiness: number,
  diplomaticInfluence: number,
  civilUnrest: number,
  trendArrows: Record<string, TrendDirection>,
  relationshipCategory: RelationshipCategory,
  tensionScore: number,
): MiniDashboardData {
  return {
    nationId,
    nationName,
    leaderName,
    leaderPortrait,
    stability,
    gdp,
    militaryReadiness,
    diplomaticInfluence,
    civilUnrest,
    trendArrows,
    relationshipToPlayer: {
      category: relationshipCategory,
      tensionScore,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — computeRelationshipLineColor                                FR-4906
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return the CSS colour string for a diplomatic relationship line based
 * on the numeric tension score.
 *
 * Tension is first classified via {@link classifyTension}, then the
 * corresponding colour is looked up from the config.
 *
 * @param tension — Numeric tension score.
 * @returns Hex colour string from {@link mapViewConfig.relationships}.
 * @see FR-4906
 */
export function computeRelationshipLineColor(tension: number): string {
  const category = classifyTension(tension);

  switch (category) {
    case 'ally':
      return mapViewConfig.relationships.allyColor;
    case 'neutral':
      return mapViewConfig.relationships.neutralColor;
    case 'rival':
      return mapViewConfig.relationships.rivalColor;
    case 'hostile':
      return mapViewConfig.relationships.hostileColor;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — classifyTension                                             Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a numeric tension score into a {@link RelationshipCategory}.
 *
 * | Range     | Category   |
 * |-----------|------------|
 * |  0 – 25   | `ally`     |
 * | 26 – 50   | `neutral`  |
 * | 51 – 75   | `rival`    |
 * | 76 – 100  | `hostile`  |
 *
 * @param tension — Numeric tension score (0–100).
 * @returns The corresponding relationship category.
 */
export function classifyTension(tension: number): RelationshipCategory {
  if (tension <= 25) return 'ally';
  if (tension <= 50) return 'neutral';
  if (tension <= 75) return 'rival';
  return 'hostile';
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — isAnimating                                                 Guard
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guard check: returns `true` if the map view is currently mid-animation
 * (e.g. a zoom or pan transition is in progress).
 *
 * @param state — Current map view state.
 * @returns `true` if an animation is in progress.
 */
export function isAnimating(state: MapViewState): boolean {
  return state.animationInProgress;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — resetToHome                                                FR-4902
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset the map view to the initial home position: minimum zoom level,
 * centred pan offset, and animation flag set to indicate the transition.
 *
 * @param state — Current map view state.
 * @returns Updated state reset to the home position.
 * @see FR-4902
 */
export function resetToHome(state: MapViewState): MapViewState {
  return {
    ...state,
    zoomLevel: mapViewConfig.zoom.min as ZoomLevel,
    panOffset: { x: 0, y: 0 },
    animationInProgress: true,
  };
}
