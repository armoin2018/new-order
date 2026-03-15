/**
 * Web State Gathering Types — FR-4300 (DR-190)
 *
 * Type definitions for AI-powered web state gathering, enrichment models,
 * and scenario application.
 *
 * @see FR-4301 — Settings panel for AI-powered web state gathering
 * @see FR-4302 — Enrichment model file format
 * @see FR-4303 — Dimension-specific gathering
 * @see FR-4304 — Apply gathered data to active scenarios
 * @see DR-190  — Enrichment model file format
 */

// ── Gathering dimensions ────────────────────────────────────────────────────

/** The five supported gathering dimensions. @see FR-4303 */
export type GatheringDimension =
  | 'economic'
  | 'military'
  | 'political'
  | 'technology'
  | 'diplomatic';

/** Constant array of all gathering dimensions. @see FR-4303 */
export const GATHERING_DIMENSIONS: readonly GatheringDimension[] = [
  'economic',
  'military',
  'political',
  'technology',
  'diplomatic',
] as const;

// ── Gathering status ────────────────────────────────────────────────────────

/** Lifecycle status of a gathering operation. @see FR-4301 */
export type GatheringStatus =
  | 'idle'
  | 'gathering'
  | 'processing'
  | 'complete'
  | 'error';

// ── Data source & query ─────────────────────────────────────────────────────

/** A configurable data source for web gathering. @see FR-4303 */
export interface DataSource {
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly enabled: boolean;
}

/** Query configuration for a single dimension. @see FR-4303 */
export interface GatheringQuery {
  readonly dimension: GatheringDimension;
  readonly searchTerms: string[];
  readonly dataSources: DataSource[];
  readonly maxResults: number;
}

// ── Data point & enrichment model ───────────────────────────────────────────

/** A single gathered data point with provenance and confidence. @see DR-190 */
export interface DataPoint {
  readonly key: string;
  readonly value: string | number;
  readonly unit?: string;
  readonly source: string;
  /** Confidence score in [0, 1]. */
  readonly confidence: number;
}

/**
 * Enrichment model persisted at `~/.newOrder/models/{dimension}/{description}.json`.
 * @see FR-4302, DR-190
 */
export interface EnrichmentModel {
  readonly id: string;
  readonly dimension: GatheringDimension;
  readonly description: string;
  readonly sourceUrls: string[];
  readonly gatheringTimestamp: string;
  readonly dataPoints: DataPoint[];
  /** Aggregate confidence in [0, 1]. */
  readonly confidenceScore: number;
  readonly structuredPayload: Record<string, unknown>;
  readonly appliedToScenarios: string[];
}

// ── Gathering result ────────────────────────────────────────────────────────

/** Outcome of a single dimension gathering operation. @see FR-4301 */
export interface GatheringResult {
  readonly dimension: GatheringDimension;
  readonly status: GatheringStatus;
  readonly enrichmentModel: EnrichmentModel | null;
  readonly error?: string;
  readonly durationMs: number;
}

// ── Application types ───────────────────────────────────────────────────────

/** How gathered data is applied to a scenario. @see FR-4304 */
export type ApplicationMode =
  | 'initialConditions'
  | 'midGameEvent'
  | 'scenarioPreset';

/** Player-initiated request to apply an enrichment model. @see FR-4304 */
export interface ApplicationRequest {
  readonly enrichmentModelId: string;
  readonly scenarioId: string;
  readonly mode: ApplicationMode;
  readonly confirmed: boolean;
}

/** Result of applying an enrichment model to a scenario. @see FR-4304 */
export interface ApplicationResult {
  readonly success: boolean;
  readonly fieldsUpdated: string[];
  readonly warnings: string[];
  readonly error?: string;
}

// ── Aggregate state ─────────────────────────────────────────────────────────

/** Top-level state for the web gathering subsystem. @see FR-4300 */
export interface WebGatheringState {
  readonly enabled: boolean;
  readonly dimensions: Record<
    GatheringDimension,
    {
      readonly enabled: boolean;
      readonly lastGathered: string | null;
      readonly queryConfig: GatheringQuery;
    }
  >;
  readonly enrichmentModels: EnrichmentModel[];
  readonly activeGatherings: GatheringResult[];
  readonly lastFullGatheringTimestamp: string | null;
}
