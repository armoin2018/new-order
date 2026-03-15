/**
 * Interactive Map View Configuration — FR-4900
 *
 * Default zoom limits, flag overlay sizing, tooltip timing,
 * relationship-line colours, mini-map dimensions, and flashpoint
 * visual parameters.
 *
 * All visual and interaction constants are tunable here without code changes.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4900 — Interactive Map View feature
 * @see DR-218 — Map view state shape
 * @see DR-211 — Mini-dashboard data contract
 */

export const mapViewConfig = {
  /**
   * Zoom behaviour settings.
   * @see FR-4900
   */
  zoom: {
    /** Minimum zoom level (fully zoomed out). */
    min: 1.0,
    /** Maximum zoom level (fully zoomed in). */
    max: 8.0,
    /** Zoom increment per scroll / button press. */
    step: 0.25,
    /** Fraction of the viewport the home country should fill when centred. */
    homeZoomFillPercent: 0.6,
    /** Duration of animated zoom transitions in milliseconds. */
    animationDurationMs: 500,
    /** CSS easing function applied to zoom animations. */
    animationEasing: 'ease-out',
  } as const,

  /**
   * Country flag overlay sizing and opacity.
   * @see FR-4900
   */
  flags: {
    /** Minimum scale factor for flag icons at low zoom. */
    minScale: 0.3,
    /** Maximum scale factor for flag icons at high zoom. */
    maxScale: 1.5,
    /** Opacity applied to dimmed (non-selected) flags. */
    dimmedOpacity: 0.3,
    /** Opacity applied to the active / selected flag. */
    activeOpacity: 1.0,
  } as const,

  /**
   * Mini-dashboard tooltip timing and positioning.
   * @see DR-211
   */
  tooltip: {
    /** Delay before showing the tooltip in milliseconds. */
    showDelayMs: 200,
    /** Delay before hiding the tooltip in milliseconds. */
    hideDelayMs: 100,
    /** Horizontal pixel offset from the cursor. */
    offsetX: 16,
    /** Vertical pixel offset from the cursor. */
    offsetY: 16,
    /** Maximum render budget per frame in milliseconds. */
    maxRenderMs: 16,
  } as const,

  /**
   * Diplomatic relationship line colours and stroke settings.
   * Colours map to the RelationshipCategory type.
   * @see FR-4900
   */
  relationships: {
    /** Colour for ally relationships. */
    allyColor: '#22c55e',
    /** Colour for neutral relationships. */
    neutralColor: '#eab308',
    /** Colour for rival relationships. */
    rivalColor: '#f97316',
    /** Colour for hostile relationships. */
    hostileColor: '#ef4444',
    /** Stroke width in pixels for relationship lines. */
    lineWidth: 2,
    /** Opacity applied to relationship lines. */
    lineOpacity: 0.6,
  } as const,

  /**
   * Mini-map navigation panel dimensions and styling.
   * @see FR-4900
   */
  minimap: {
    /** Panel width in pixels. */
    width: 200,
    /** Panel height in pixels. */
    height: 100,
    /** Colour of the viewport indicator rectangle. */
    viewportRectColor: '#3b82f6',
    /** Opacity of the viewport indicator rectangle. */
    viewportRectOpacity: 0.5,
  } as const,

  /**
   * Flashpoint icon animation and severity colour mapping.
   * @see FR-4900
   */
  flashpoints: {
    /** Duration of the pulsing animation loop in milliseconds. */
    pulseAnimationMs: 2000,
    /** Colour keyed by severity level. */
    severityColors: {
      low: '#eab308',
      medium: '#f97316',
      high: '#ef4444',
      critical: '#dc2626',
    },
  } as const,
} as const;
