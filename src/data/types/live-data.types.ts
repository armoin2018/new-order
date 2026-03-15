/**
 * Live Data Types — FR-4400
 *
 * Type definitions for internet-based real-world data collection
 * used to update scenario initial conditions at game start.
 *
 * @see FR-4400 — Live data fetching at game start
 * @see FR-4401 — Economic data (GDP, inflation, debt, trade)
 * @see FR-4402 — Military spending data
 * @see FR-4403 — Diplomatic/political stability data
 * @see FR-4404 — Technology indices
 * @see FR-4405 — Market / exchange rate data
 */

import type { FactionId } from './enums';

// ── Fetch status lifecycle ──────────────────────────────────────────────────

/** Status of a single data-fetching operation. */
export type LiveDataStatus =
  | 'idle'
  | 'fetching'
  | 'complete'
  | 'error'
  | 'skipped';

/** Category of live data being fetched. @see FR-4401–FR-4405 */
export type LiveDataCategory =
  | 'economic'
  | 'military'
  | 'diplomatic'
  | 'technology'
  | 'markets';

/** Constant array of all live data categories. */
export const LIVE_DATA_CATEGORIES: readonly LiveDataCategory[] = [
  'economic',
  'military',
  'diplomatic',
  'technology',
  'markets',
] as const;

// ── Fetched data points ─────────────────────────────────────────────────────

/** Mapping of faction IDs to ISO-3166 alpha-2/3 country codes for API lookups. */
export type FactionCountryMap = Record<FactionId, string>;

/** A single fetched economic indicator for one faction. @see FR-4401 */
export interface EconomicDataPoint {
  readonly factionId: FactionId;
  readonly gdpBillions: number | null;
  readonly gdpGrowthPct: number | null;
  readonly inflationPct: number | null;
  readonly unemploymentPct: number | null;
  readonly debtToGdpPct: number | null;
  readonly tradeBalanceBillions: number | null;
  readonly foreignReservesBillions: number | null;
}

/** Military spending data for one faction. @see FR-4402 */
export interface MilitaryDataPoint {
  readonly factionId: FactionId;
  readonly defenseSpendingBillions: number | null;
  readonly defenseSpendingPctGdp: number | null;
  readonly activePersonnel: number | null;
}

/** Exchange rate / market data for one faction. @see FR-4405 */
export interface MarketDataPoint {
  readonly factionId: FactionId;
  readonly currencyCode: string;
  readonly exchangeRateToUsd: number | null;
  readonly stockIndexValue: number | null;
  readonly stockIndexChangePct: number | null;
}

/** Diplomatic / stability data for one faction. @see FR-4403 */
export interface DiplomaticDataPoint {
  readonly factionId: FactionId;
  readonly freedomScore: number | null;
  readonly politicalStabilityIndex: number | null;
  readonly corruptionPerceptionsIndex: number | null;
  readonly populationMillions: number | null;
}

/** Technology competitiveness data for one faction. @see FR-4404 */
export interface TechnologyDataPoint {
  readonly factionId: FactionId;
  readonly rndSpendingPctGdp: number | null;
  readonly patentsPerYear: number | null;
  readonly internetPenetrationPct: number | null;
  readonly globalInnovationIndex: number | null;
}

// ── Aggregate result ────────────────────────────────────────────────────────

/** A single category fetch result. */
export interface CategoryFetchResult {
  readonly category: LiveDataCategory;
  readonly status: LiveDataStatus;
  readonly durationMs: number;
  readonly error?: string;
  readonly dataPointCount: number;
}

/** Full result of a live-data collection run. */
export interface LiveDataResult {
  readonly timestamp: string;
  readonly categories: CategoryFetchResult[];
  readonly economic: EconomicDataPoint[];
  readonly military: MilitaryDataPoint[];
  readonly diplomatic: DiplomaticDataPoint[];
  readonly technology: TechnologyDataPoint[];
  readonly markets: MarketDataPoint[];
  readonly overallStatus: LiveDataStatus;
  readonly totalDurationMs: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

/** User-facing configuration for live data fetching. */
export interface LiveDataConfig {
  /** Master toggle: whether to fetch live data on game start. */
  readonly enabled: boolean;
  /** Per-category enable/disable. */
  readonly categories: Record<LiveDataCategory, boolean>;
  /** Request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** How aggressively to override scenario defaults (0–1). */
  readonly blendFactor: number;
  /** Cache live data for this many hours before re-fetching. */
  readonly cacheHours: number;
}

/** Progress callback for UI updates during fetching. */
export interface LiveDataProgress {
  readonly category: LiveDataCategory;
  readonly status: LiveDataStatus;
  readonly progressPct: number;
  readonly message: string;
}
