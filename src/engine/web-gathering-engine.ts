/**
 * Web State Gathering Engine — FR-4300 (DR-190)
 *
 * Pure functions for AI-powered web state gathering, enrichment model
 * management, and scenario application.
 *
 * **No side effects** — actual network calls / AI adapter work lives in a
 * separate adapter layer.
 *
 * @see FR-4301 — Settings panel for AI-powered web state gathering
 * @see FR-4302 — Enrichment model file format
 * @see FR-4303 — Dimension-specific gathering
 * @see FR-4304 — Apply gathered data to active scenarios
 * @see DR-190  — Enrichment model file format
 */

import type {
  GatheringDimension,
  GatheringQuery,
  DataPoint,
  DataSource,
  EnrichmentModel,
  GatheringResult,
  ApplicationMode,
  WebGatheringState,
} from '@/data/types/web-gathering.types';
import { GATHERING_DIMENSIONS } from '@/data/types/web-gathering.types';
import { webGatheringConfig } from '@/engine/config/web-gathering';

// ── Helper types exported for tests ─────────────────────────────────────────

/** Sort key for enrichment models. */
export type EnrichmentSortKey =
  | 'date'
  | 'confidence'
  | 'dimension'
  | 'description';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** Preview of changes that would occur when applying an enrichment model. */
export interface ApplicationPreview {
  readonly mode: ApplicationMode;
  readonly enrichmentModelId: string;
  readonly dimension: GatheringDimension;
  readonly fieldsAffected: string[];
  readonly summary: string;
}

/** Validation result for an enrichment model. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Random hex string of `length` characters. */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeWebGatheringState                                  FR-4301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a default {@link WebGatheringState} with all dimensions configured
 * from the global config.
 *
 * @param config - Optional partial config overrides (mainly for testing).
 * @returns A fully initialised gathering state.
 * @see FR-4301
 */
export function initializeWebGatheringState(
  config: typeof webGatheringConfig = webGatheringConfig,
): Readonly<WebGatheringState> {
  const dimensions = {} as Record<
    GatheringDimension,
    {
      enabled: boolean;
      lastGathered: string | null;
      queryConfig: GatheringQuery;
    }
  >;

  for (const dim of GATHERING_DIMENSIONS) {
    const dimConfig = config.dimensions[dim];
    dimensions[dim] = {
      enabled: true,
      lastGathered: null,
      queryConfig: {
        dimension: dim,
        searchTerms: [...dimConfig.defaultSearchTerms],
        dataSources: dimConfig.defaultDataSources.map((ds) => ({ ...ds })),
        maxResults: config.defaultMaxResults,
      },
    };
  }

  return {
    enabled: false,
    dimensions,
    enrichmentModels: [],
    activeGatherings: [],
    lastFullGatheringTimestamp: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — createGatheringQuery                                         FR-4303
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a {@link GatheringQuery} for a specific dimension using config
 * defaults merged with optional overrides.
 *
 * @param dimension - The dimension to build the query for.
 * @param overrides - Optional partial overrides for searchTerms, dataSources, or maxResults.
 * @returns A complete gathering query ready for the AI adapter.
 * @see FR-4303
 */
export function createGatheringQuery(
  dimension: GatheringDimension,
  overrides?: Partial<Pick<GatheringQuery, 'searchTerms' | 'dataSources' | 'maxResults'>>,
): Readonly<GatheringQuery> {
  const dimConfig = webGatheringConfig.dimensions[dimension];
  return {
    dimension,
    searchTerms: overrides?.searchTerms ?? [...dimConfig.defaultSearchTerms],
    dataSources:
      overrides?.dataSources ??
      dimConfig.defaultDataSources.map((ds) => ({ ...ds })),
    maxResults: overrides?.maxResults ?? webGatheringConfig.defaultMaxResults,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — createEnrichmentModel                                        FR-4302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new {@link EnrichmentModel} with a generated ID, timestamp, and
 * computed aggregate confidence.
 *
 * @param dimension   - Gathering dimension.
 * @param description - Human-readable description.
 * @param dataPoints  - Collected data points.
 * @param sourceUrls  - URLs the data was gathered from.
 * @returns A fully formed enrichment model.
 * @see FR-4302, DR-190
 */
export function createEnrichmentModel(
  dimension: GatheringDimension,
  description: string,
  dataPoints: readonly DataPoint[],
  sourceUrls: readonly string[],
): Readonly<EnrichmentModel> {
  return {
    id: `enr_${Date.now()}_${randomHex(8)}`,
    dimension,
    description,
    sourceUrls: [...sourceUrls],
    gatheringTimestamp: new Date().toISOString(),
    dataPoints: [...dataPoints],
    confidenceScore: computeAggregateConfidence(dataPoints),
    structuredPayload: {},
    appliedToScenarios: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — validateEnrichmentModel                                      FR-4302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an enrichment model for completeness and data-point confidence.
 *
 * @param model - The enrichment model to validate.
 * @returns A validation result with `valid` flag and error messages.
 * @see FR-4302, DR-190
 */
export function validateEnrichmentModel(
  model: EnrichmentModel,
): Readonly<ValidationResult> {
  const errors: string[] = [];

  if (!model.id || model.id.trim().length === 0) {
    errors.push('Model id is required');
  }
  if (!model.dimension || !GATHERING_DIMENSIONS.includes(model.dimension)) {
    errors.push('Invalid or missing dimension');
  }
  if (!model.description || model.description.trim().length === 0) {
    errors.push('Description is required');
  }
  if (!model.gatheringTimestamp || model.gatheringTimestamp.trim().length === 0) {
    errors.push('Gathering timestamp is required');
  }
  if (!Array.isArray(model.sourceUrls) || model.sourceUrls.length === 0) {
    errors.push('At least one source URL is required');
  }
  if (!Array.isArray(model.dataPoints) || model.dataPoints.length === 0) {
    errors.push('At least one data point is required');
  }
  if (
    typeof model.confidenceScore !== 'number' ||
    model.confidenceScore < 0 ||
    model.confidenceScore > 1
  ) {
    errors.push('Confidence score must be a number between 0 and 1');
  }

  // Check individual data-point confidence values
  for (const dp of model.dataPoints ?? []) {
    if (typeof dp.confidence !== 'number' || dp.confidence < 0 || dp.confidence > 1) {
      errors.push(`Data point "${dp.key}" has invalid confidence: ${dp.confidence}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — computeAggregateConfidence                                   DR-190
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the weighted average confidence across a set of data points.
 * If the array is empty, returns 0.
 *
 * Weight for each point is its own confidence (higher-confidence points
 * contribute more to the average).
 *
 * @param dataPoints - Data points whose confidences to aggregate.
 * @returns Aggregate confidence in [0, 1].
 * @see DR-190
 */
export function computeAggregateConfidence(
  dataPoints: readonly DataPoint[],
): number {
  if (dataPoints.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const dp of dataPoints) {
    weightedSum += dp.confidence * dp.confidence;
    totalWeight += dp.confidence;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — filterEnrichmentModels                                       FR-4302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter enrichment models by dimension and/or minimum confidence score.
 *
 * @param models        - Full array of enrichment models.
 * @param dimension     - Optional dimension filter.
 * @param minConfidence - Optional minimum confidence threshold.
 * @returns Filtered array of models.
 * @see FR-4302
 */
export function filterEnrichmentModels(
  models: readonly EnrichmentModel[],
  dimension?: GatheringDimension,
  minConfidence?: number,
): ReadonlyArray<EnrichmentModel> {
  let result = [...models];

  if (dimension) {
    result = result.filter((m) => m.dimension === dimension);
  }
  if (minConfidence !== undefined) {
    result = result.filter((m) => m.confidenceScore >= minConfidence);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — sortEnrichmentModels                                         FR-4302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sort enrichment models by the given key in the given direction.
 *
 * @param models    - Array of enrichment models to sort.
 * @param sortBy    - Sort key: `'date'`, `'confidence'`, `'dimension'`, or `'description'`.
 * @param direction - `'asc'` or `'desc'`.
 * @returns A new sorted array (original is not mutated).
 * @see FR-4302
 */
export function sortEnrichmentModels(
  models: readonly EnrichmentModel[],
  sortBy: EnrichmentSortKey,
  direction: SortDirection,
): ReadonlyArray<EnrichmentModel> {
  const sorted = [...models];
  const dir = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return (
          dir *
          (new Date(a.gatheringTimestamp).getTime() -
            new Date(b.gatheringTimestamp).getTime())
        );
      case 'confidence':
        return dir * (a.confidenceScore - b.confidenceScore);
      case 'dimension':
        return dir * a.dimension.localeCompare(b.dimension);
      case 'description':
        return dir * a.description.localeCompare(b.description);
    }
  });

  return sorted;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildApplicationPreview                                      FR-4304
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a preview of what fields would change if an enrichment model were
 * applied in the given mode.
 *
 * @param model - The enrichment model to preview.
 * @param mode  - The application mode.
 * @returns An application preview with affected fields and summary.
 * @see FR-4304
 */
export function buildApplicationPreview(
  model: EnrichmentModel,
  mode: ApplicationMode,
): Readonly<ApplicationPreview> {
  const fieldsAffected = model.dataPoints.map((dp) => dp.key);

  const modeLabels: Record<ApplicationMode, string> = {
    initialConditions: 'initial conditions',
    midGameEvent: 'mid-game event',
    scenarioPreset: 'scenario preset',
  };

  const summary =
    `Apply ${model.dataPoints.length} data point(s) from "${model.description}" ` +
    `(${model.dimension}) as ${modeLabels[mode]}. ` +
    `Aggregate confidence: ${(model.confidenceScore * 100).toFixed(4)}%.`;

  return {
    mode,
    enrichmentModelId: model.id,
    dimension: model.dimension,
    fieldsAffected,
    summary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — processApplicationResult                                     FR-4304
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark an enrichment model as applied to a scenario and return the
 * updated model.
 *
 * @param model         - The enrichment model being applied.
 * @param scenarioId    - The scenario it was applied to.
 * @param fieldsUpdated - Fields that were actually changed.
 * @returns A new model with the scenario recorded in `appliedToScenarios`.
 * @see FR-4304
 */
export function processApplicationResult(
  model: EnrichmentModel,
  scenarioId: string,
  fieldsUpdated: string[],
): Readonly<EnrichmentModel> {
  return {
    ...model,
    appliedToScenarios: [...model.appliedToScenarios, scenarioId],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — buildGatheringPrompt                                        FR-4301
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the AI prompt text for a gathering query. The resulting string is
 * handed to the AI adapter — no network call happens here.
 *
 * @param query - The gathering query to build a prompt for.
 * @returns A prompt string for the AI provider.
 * @see FR-4301, FR-4303
 */
export function buildGatheringPrompt(query: GatheringQuery): string {
  const dimConfig = webGatheringConfig.dimensions[query.dimension];
  const enabledSources = query.dataSources.filter((ds) => ds.enabled);

  const lines: string[] = [
    `You are a geopolitical data analyst. Gather current ${dimConfig.label.toLowerCase()} data.`,
    '',
    `Dimension: ${dimConfig.label}`,
    `Description: ${dimConfig.description}`,
    '',
    'Search terms:',
    ...query.searchTerms.map((t) => `- ${t}`),
    '',
    'Preferred data sources:',
    ...enabledSources.map((ds) => `- ${ds.name} (${ds.url}): ${ds.description}`),
    '',
    `Return up to ${query.maxResults} structured data points, each with:`,
    '- key: identifier for the metric',
    '- value: current value (string or number)',
    '- unit: unit of measurement (if applicable)',
    '- source: URL or name of the source',
    '- confidence: your confidence in the data accuracy (0–1)',
    '',
    'Respond in JSON format.',
  ];

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — getStaleModels                                               FR-4302
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return enrichment models whose gathering timestamp is older than
 * `maxAgeDays` relative to `now`.
 *
 * @param models     - Array of enrichment models.
 * @param maxAgeDays - Maximum age in days before a model is considered stale.
 * @param now        - Reference date (defaults to `new Date()`).
 * @returns Array of stale models.
 * @see FR-4302
 */
export function getStaleModels(
  models: readonly EnrichmentModel[],
  maxAgeDays: number,
  now: Date = new Date(),
): ReadonlyArray<EnrichmentModel> {
  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;

  return models.filter(
    (m) => new Date(m.gatheringTimestamp).getTime() < cutoffMs,
  );
}
