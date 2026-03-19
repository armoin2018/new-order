/**
 * Market Data Service — Real Historical Data Integration
 *
 * Loads 10-year weekly OHLCV data from the `data/markets/` store
 * (fetched via the server API or at build time) and provides it
 * in the same {@link HistoricalSeries} format as the synthetic
 * {@link generateHistoricalSeries} generator.
 *
 * **Priority**: real stored data → synthetic generated data.
 *
 * The data is downloaded by `scripts/download-market-data.ts` and
 * extended during the live-data update cycle via the server route
 * `POST /api/v1/market-data/refresh`.
 *
 * @module engine/market-data-service
 */

import type { HistoricalSeries, OHLCPoint } from '@/engine/market-history-generator';

// ---------------------------------------------------------------------------
// Types matching the stored JSON shape
// ---------------------------------------------------------------------------

interface StoredOHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StoredMarketFile {
  symbol: string;
  name: string;
  gameId: string;
  nationId: string;
  granularity: 'weekly';
  startDate: string;
  endDate: string;
  dataPoints: number;
  downloadedAt: string;
  data: StoredOHLCV[];
}

interface StoredMarketSummary {
  gameId: string;
  symbol: string;
  name: string;
  nationId: string;
  dataPoints: number;
  startDate: string;
  endDate: string;
  downloadedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const cache = new Map<string, HistoricalSeries>();
let catalogCache: StoredMarketSummary[] | null = null;

// ---------------------------------------------------------------------------
// Server API URL helper
// ---------------------------------------------------------------------------

function apiBase(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a catalog of all available stored market data sets.
 * Returns an empty array if the server is unavailable.
 */
export async function listStoredMarketData(): Promise<readonly StoredMarketSummary[]> {
  if (catalogCache) return catalogCache;

  try {
    const resp = await fetch(`${apiBase()}/api/v1/market-data`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as { items: StoredMarketSummary[] };
    catalogCache = json.items;
    return json.items;
  } catch {
    return [];
  }
}

/**
 * Load stored OHLCV data for a market index and return it as a
 * {@link HistoricalSeries} compatible with the chart system.
 *
 * Returns `null` if the data is not available (server down, file missing,
 * or the initial download hasn't been run yet).
 *
 * @param gameId — The market game ID (e.g. `'sp500'`, `'nikkei-225'`).
 */
export async function getStoredMarketHistory(
  gameId: string,
): Promise<HistoricalSeries | null> {
  // Check cache
  const cached = cache.get(gameId);
  if (cached) return cached;

  try {
    const resp = await fetch(`${apiBase()}/api/v1/market-data/${encodeURIComponent(gameId)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;

    const file = (await resp.json()) as StoredMarketFile;
    if (!file.data || file.data.length === 0) return null;

    const series = storedToHistoricalSeries(file);
    cache.set(gameId, series);
    return series;
  } catch {
    return null;
  }
}

/**
 * Get stored market history, falling back to a synthetic series
 * produced by the provided generator function.
 *
 * @param gameId — Market game ID.
 * @param fallback — Function that generates synthetic data if real data is unavailable.
 */
export async function getMarketHistoryWithFallback(
  gameId: string,
  fallback: () => HistoricalSeries,
): Promise<HistoricalSeries> {
  const stored = await getStoredMarketHistory(gameId);
  return stored ?? fallback();
}

/**
 * Clear the in-memory cache (e.g. after a refresh).
 */
export function clearMarketDataCache(): void {
  cache.clear();
  catalogCache = null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Convert a stored market data file to the engine's {@link HistoricalSeries} format.
 */
function storedToHistoricalSeries(file: StoredMarketFile): HistoricalSeries {
  const data: OHLCPoint[] = file.data.map((p) => ({
    date: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: p.volume,
  }));

  const lastClose = data.length > 0 ? data[data.length - 1]!.close : 0;

  return {
    id: file.gameId,
    name: file.name,
    granularity: 'weekly',
    data,
    simulationStartPrice: lastClose,
  };
}

/**
 * Map between common index/exchange names used in models and the
 * market data gameIds used by the download script.
 *
 * For example, the game's exchange model for "nyse" should look up "sp500"
 * or "djia" market data.
 */
export const INDEX_GAME_ID_MAP: Record<string, string> = {
  // US indexes
  'us-composite': 'sp500',
  'us-sp500': 'sp500',
  'us-djia': 'djia',
  'us-nasdaq': 'nasdaq',
  'sp500': 'sp500',
  'djia': 'djia',
  'nasdaq': 'nasdaq',

  // China
  'china-composite': 'sse-composite',
  'sse-composite': 'sse-composite',
  'szse-component': 'szse-component',

  // Russia
  'russia-composite': 'moex-index',
  'moex-index': 'moex-index',

  // Japan
  'japan-composite': 'nikkei-225',
  'nikkei-225': 'nikkei-225',
  'topix': 'topix',

  // EU
  'eu-composite': 'eurostoxx-50',
  'eurostoxx-50': 'eurostoxx-50',
  'dax': 'dax',
  'cac-40': 'cac-40',
  'ftse-100': 'ftse-100',

  // Iran
  'iran-composite': 'tedpix',
  'tedpix': 'tedpix',

  // Commodities
  'wti-crude': 'wti-crude',
  'gold': 'gold',
  'natgas': 'natgas',
};
