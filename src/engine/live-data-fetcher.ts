/**
 * Live Data Fetcher — FR-4400
 *
 * Network layer for collecting real-world data from free public APIs.
 * Each function fetches a specific data category for all factions.
 *
 * **This module performs actual network I/O** — all other live-data modules
 * are pure functions.
 *
 * APIs used (all free, no API key required):
 * - World Bank Open Data API — GDP, inflation, trade, military spending
 * - ExchangeRate-API (open tier) — currency exchange rates
 * - REST Countries v3.1 — population data
 *
 * @see FR-4400 — Live data fetching at game start
 * @see FR-4401 — Economic data (GDP, inflation, debt, trade)
 * @see FR-4402 — Military spending data
 * @see FR-4403 — Diplomatic/political stability data
 * @see FR-4405 — Market / exchange rate data
 */

import { ALL_FACTIONS } from '@/data/types';
import type {
  EconomicDataPoint,
  MilitaryDataPoint,
  MarketDataPoint,
  DiplomaticDataPoint,
  TechnologyDataPoint,
  LiveDataResult,
  CategoryFetchResult,
  LiveDataConfig,
  LiveDataProgress,
  LiveDataCategory,
} from '@/data/types/live-data.types';
import {
  FACTION_COUNTRY_CODES,
  FACTION_CURRENCY_CODES,
  WORLD_BANK_INDICATORS,
  liveDataConfig,
} from '@/engine/config/live-data';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch JSON with timeout and error handling.
 * Returns null on any failure (network, parse, timeout).
 */
async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch a single World Bank indicator for a country.
 * Returns the numeric value or null.
 *
 * World Bank API response: `[{page metadata}, [{value, ...}]]`
 */
async function fetchWorldBankIndicator(
  countryCode: string,
  indicator: string,
  timeoutMs: number,
): Promise<number | null> {
  const url = liveDataConfig.apis.worldBank.indicatorUrl(countryCode, indicator);
  const data = await fetchJson<[unknown, Array<{ value: number | null }> | null]>(url, timeoutMs);
  if (!data || !Array.isArray(data) || data.length < 2) return null;
  const records = data[1];
  if (!Array.isArray(records) || records.length === 0) return null;
  const val = records[0]?.value;
  return typeof val === 'number' ? val : null;
}

// ── Category Fetchers ───────────────────────────────────────────────────────

/**
 * Fetch economic indicators for all factions from World Bank.
 * @see FR-4401
 */
export async function fetchEconomicData(
  timeoutMs: number,
): Promise<EconomicDataPoint[]> {
  const results: EconomicDataPoint[] = [];

  for (const factionId of ALL_FACTIONS) {
    const cc = FACTION_COUNTRY_CODES[factionId];

    // Fetch indicators in parallel per faction
    const [gdpRaw, gdpGrowth, inflation, unemployment, debtToGdp, tradeBalance, reserves] =
      await Promise.all([
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.gdp, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.gdpGrowth, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.inflation, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.unemployment, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.debtToGdp, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.tradeBalance, timeoutMs),
        fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.reserves, timeoutMs),
      ]);

    results.push({
      factionId,
      gdpBillions: gdpRaw !== null ? Math.round(gdpRaw / 1_000_000_000) : null,
      gdpGrowthPct: gdpGrowth,
      inflationPct: inflation,
      unemploymentPct: unemployment,
      debtToGdpPct: debtToGdp,
      tradeBalanceBillions: tradeBalance !== null ? Math.round(tradeBalance / 1_000_000_000) : null,
      foreignReservesBillions: reserves !== null ? Math.round(reserves / 1_000_000_000) : null,
    });
  }

  return results;
}

/**
 * Fetch military spending data for all factions from World Bank.
 * @see FR-4402
 */
export async function fetchMilitaryData(
  timeoutMs: number,
): Promise<MilitaryDataPoint[]> {
  const results: MilitaryDataPoint[] = [];

  for (const factionId of ALL_FACTIONS) {
    const cc = FACTION_COUNTRY_CODES[factionId];

    const [spendingRaw, spendingPct] = await Promise.all([
      fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.militarySpending, timeoutMs),
      fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.militaryPctGdp, timeoutMs),
    ]);

    results.push({
      factionId,
      defenseSpendingBillions: spendingRaw !== null ? Math.round(spendingRaw / 1_000_000_000) : null,
      defenseSpendingPctGdp: spendingPct,
      activePersonnel: null, // Not available from World Bank free API
    });
  }

  return results;
}

/**
 * Fetch diplomatic/population data from World Bank + REST Countries.
 * @see FR-4403
 */
export async function fetchDiplomaticData(
  timeoutMs: number,
): Promise<DiplomaticDataPoint[]> {
  const results: DiplomaticDataPoint[] = [];

  for (const factionId of ALL_FACTIONS) {
    const cc = FACTION_COUNTRY_CODES[factionId];

    const populationRaw = await fetchWorldBankIndicator(
      cc,
      WORLD_BANK_INDICATORS.population,
      timeoutMs,
    );

    results.push({
      factionId,
      freedomScore: null, // Requires paid API
      politicalStabilityIndex: null, // Requires paid API
      corruptionPerceptionsIndex: null, // Requires paid API
      populationMillions: populationRaw !== null ? Math.round(populationRaw / 1_000_000) : null,
    });
  }

  return results;
}

/**
 * Fetch technology indicators from World Bank.
 * @see FR-4404
 */
export async function fetchTechnologyData(
  timeoutMs: number,
): Promise<TechnologyDataPoint[]> {
  const results: TechnologyDataPoint[] = [];

  for (const factionId of ALL_FACTIONS) {
    const cc = FACTION_COUNTRY_CODES[factionId];

    const [rndSpending, internetUsers] = await Promise.all([
      fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.rndSpending, timeoutMs),
      fetchWorldBankIndicator(cc, WORLD_BANK_INDICATORS.internetUsers, timeoutMs),
    ]);

    results.push({
      factionId,
      rndSpendingPctGdp: rndSpending,
      patentsPerYear: null, // Not available from World Bank free API
      internetPenetrationPct: internetUsers,
      globalInnovationIndex: null, // Requires paid API
    });
  }

  return results;
}

/**
 * Fetch exchange rate data from ExchangeRate-API.
 * @see FR-4405
 */
export async function fetchMarketData(
  timeoutMs: number,
): Promise<MarketDataPoint[]> {
  const results: MarketDataPoint[] = [];

  // Single request gets all rates from USD base
  const rateData = await fetchJson<{
    result: string;
    rates: Record<string, number>;
  }>(liveDataConfig.apis.exchangeRate.baseUrl, timeoutMs);

  for (const factionId of ALL_FACTIONS) {
    const currencyCode = FACTION_CURRENCY_CODES[factionId] ?? 'USD';
    const rate = rateData?.rates?.[currencyCode] ?? null;

    results.push({
      factionId,
      currencyCode,
      exchangeRateToUsd: rate,
      stockIndexValue: null, // Would require a market data API key
      stockIndexChangePct: null,
    });
  }

  return results;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Fetch all enabled live data categories and return a complete result.
 *
 * Progress updates are reported via the optional callback so the UI
 * can show per-category status.
 *
 * @param config    - User configuration (which categories are enabled, timeout, etc.)
 * @param onProgress - Optional progress callback for UI updates.
 * @returns A complete {@link LiveDataResult} with all fetched data.
 * @see FR-4400
 */
export async function fetchAllLiveData(
  config: LiveDataConfig = liveDataConfig.defaults,
  onProgress?: (progress: LiveDataProgress) => void,
): Promise<LiveDataResult> {
  const startTime = Date.now();
  const categories: CategoryFetchResult[] = [];
  let economic: EconomicDataPoint[] = [];
  let military: MilitaryDataPoint[] = [];
  let diplomatic: DiplomaticDataPoint[] = [];
  let technology: TechnologyDataPoint[] = [];
  let markets: MarketDataPoint[] = [];

  const fetchCategory = async <T>(
    category: LiveDataCategory,
    fetcher: (timeout: number) => Promise<T[]>,
  ): Promise<T[]> => {
    if (!config.categories[category]) {
      categories.push({ category, status: 'skipped', durationMs: 0, dataPointCount: 0 });
      onProgress?.({ category, status: 'skipped', progressPct: 100, message: `${category}: skipped` });
      return [];
    }

    onProgress?.({ category, status: 'fetching', progressPct: 0, message: `Fetching ${category} data...` });
    const catStart = Date.now();

    try {
      const data = await fetcher(config.timeoutMs);
      const durationMs = Date.now() - catStart;
      categories.push({ category, status: 'complete', durationMs, dataPointCount: data.length });
      onProgress?.({ category, status: 'complete', progressPct: 100, message: `${category}: ${data.length} data points` });
      return data;
    } catch (err) {
      const durationMs = Date.now() - catStart;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      categories.push({ category, status: 'error', durationMs, error: errorMsg, dataPointCount: 0 });
      onProgress?.({ category, status: 'error', progressPct: 100, message: `${category}: ${errorMsg}` });
      return [];
    }
  };

  // Fetch categories sequentially to be gentle on APIs and show clear progress
  economic = await fetchCategory('economic', fetchEconomicData);
  military = await fetchCategory('military', fetchMilitaryData);
  diplomatic = await fetchCategory('diplomatic', fetchDiplomaticData);
  technology = await fetchCategory('technology', fetchTechnologyData);
  markets = await fetchCategory('markets', fetchMarketData);

  const totalDurationMs = Date.now() - startTime;
  const hasErrors = categories.some((c) => c.status === 'error');
  const allSkipped = categories.every((c) => c.status === 'skipped');

  return {
    timestamp: new Date().toISOString(),
    categories,
    economic,
    military,
    diplomatic,
    technology,
    markets,
    overallStatus: allSkipped ? 'skipped' : hasErrors ? 'error' : 'complete',
    totalDurationMs,
  };
}
