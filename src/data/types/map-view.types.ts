/**
 * Interactive Map View Types — FR-4900
 *
 * Type definitions for the interactive SVG world-map view including
 * zoom/pan state, country flag overlays, relationship lines,
 * flashpoint icons, mini-dashboard data, and map interaction events.
 *
 * @see FR-4900 — Interactive Map View feature
 * @see DR-218 — Map view state shape
 * @see DR-211 — Mini-dashboard data contract
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Branded number representing the camera zoom level.
 * Valid range: 1.0 (fully zoomed out) – 8.0 (maximum zoom).
 */
export type ZoomLevel = number & { readonly __brand: 'ZoomLevel' };

/**
 * Pixel offset of the map camera from its home position.
 */
export interface PanOffset {
  /** Horizontal pixel offset (positive = shifted right). */
  readonly x: number;
  /** Vertical pixel offset (positive = shifted down). */
  readonly y: number;
}

// ---------------------------------------------------------------------------
// FR-4900 / DR-218 — Map View State
// ---------------------------------------------------------------------------

/**
 * Full client-side state of the interactive map view.
 * @see DR-218
 */
export interface MapViewState {
  /** Current camera zoom level (1.0 – 8.0). */
  zoomLevel: ZoomLevel;
  /** Current camera pan offset in pixels. */
  panOffset: PanOffset;
  /** Nation code the cursor is currently hovering over, or null. */
  hoveredNationId: string | null;
  /** Nation code the player has clicked / selected, or null. */
  selectedNationId: string | null;
  /** Nation code of the player's home country. */
  homeCountryId: string;
  /** Whether diplomatic relationship lines are rendered on the map. */
  showRelationshipLines: boolean;
  /** Whether flashpoint severity icons are rendered on the map. */
  showFlashpointIcons: boolean;
  /** Whether the mini-map navigation panel is visible. */
  showMinimapPanel: boolean;
  /** True while a zoom/pan animation is in progress. */
  animationInProgress: boolean;
}

// ---------------------------------------------------------------------------
// Relationship & Trend Enumerations
// ---------------------------------------------------------------------------

/**
 * Direction of a stat trend arrow in the mini-dashboard.
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * High-level diplomatic relationship category with the player.
 */
export type RelationshipCategory = 'ally' | 'neutral' | 'rival' | 'hostile';

// ---------------------------------------------------------------------------
// DR-211 — Mini-Dashboard Data
// ---------------------------------------------------------------------------

/**
 * Data contract for the per-nation mini-dashboard tooltip/panel.
 * @see DR-211
 */
export interface MiniDashboardData {
  /** Unique nation identifier. */
  readonly nationId: string;
  /** Display name of the nation. */
  readonly nationName: string;
  /** Display name of the current leader. */
  readonly leaderName: string;
  /** Path or URL to the leader's portrait image. */
  readonly leaderPortrait: string;
  /** Overall stability score. Range: 0–100. */
  readonly stability: number;
  /** Formatted GDP string (e.g. "$1.2T"). */
  readonly gdp: string;
  /** Military readiness score. Range: 0–100. */
  readonly militaryReadiness: number;
  /** Diplomatic influence score. Range: 0–100. */
  readonly diplomaticInfluence: number;
  /** Civil unrest score. Range: 0–100. */
  readonly civilUnrest: number;
  /** Trend arrows keyed by metric name. */
  readonly trendArrows: Record<string, TrendDirection>;
  /** Relationship summary relative to the player's nation. */
  readonly relationshipToPlayer: {
    /** High-level category. */
    readonly category: RelationshipCategory;
    /** Numeric tension score (higher = more tense). */
    readonly tensionScore: number;
  };
}

// ---------------------------------------------------------------------------
// Map Overlays
// ---------------------------------------------------------------------------

/**
 * Positional and visual data for a single country flag overlay on the map.
 */
export interface CountryFlagOverlay {
  /** Nation this flag represents. */
  readonly nationId: string;
  /** Centroid X coordinate on the SVG canvas. */
  readonly cx: number;
  /** Centroid Y coordinate on the SVG canvas. */
  readonly cy: number;
  /** Path or URL to the flag image asset. */
  readonly flagPath: string;
  /** Whether this nation is currently active / interactive. */
  readonly isActive: boolean;
  /** Scale multiplier applied to the flag icon. */
  readonly scaleFactor: number;
}

/**
 * A single diplomatic relationship line rendered between two nations.
 */
export interface RelationshipLine {
  /** Nation code of the relationship origin. */
  readonly from: string;
  /** Nation code of the relationship target. */
  readonly to: string;
  /** Numeric tension value influencing line style. */
  readonly tension: number;
  /** CSS/SVG colour string for the line. */
  readonly color: string;
}

/**
 * A flashpoint severity icon rendered at a geographic location on the map.
 */
export interface FlashpointIcon {
  /** Unique flashpoint identifier. */
  readonly flashpointId: string;
  /** Centre X coordinate on the SVG canvas. */
  readonly cx: number;
  /** Centre Y coordinate on the SVG canvas. */
  readonly cy: number;
  /** Severity score (higher = more severe). */
  readonly severity: number;
  /** Short human-readable label. */
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Interaction Events
// ---------------------------------------------------------------------------

/**
 * Discriminated union of user interaction events on the map.
 */
export type MapInteractionEvent =
  | { readonly type: 'zoom'; readonly payload: { readonly delta: number; readonly anchorX: number; readonly anchorY: number } }
  | { readonly type: 'pan'; readonly payload: { readonly dx: number; readonly dy: number } }
  | { readonly type: 'hover'; readonly payload: { readonly nationId: string | null } }
  | { readonly type: 'click'; readonly payload: { readonly nationId: string } }
  | { readonly type: 'home'; readonly payload: Record<string, never> };
