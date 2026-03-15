/**
 * Live Data Engine — FR-4400
 *
 * Pure functions for mapping internet-fetched real-world data onto
 * a scenario definition's initial conditions. No side effects — all
 * network I/O lives in `live-data-fetcher.ts`.
 *
 * The engine uses a configurable "blend factor" (0–1) to interpolate
 * between scenario defaults and live data:
 *   result = scenarioValue × (1 − blend) + liveValue × blend
 *
 * @see FR-4400 — Live data fetching at game start
 * @see FR-4401 — Economic data mapping
 * @see FR-4402 — Military data mapping
 * @see FR-4404 — Technology data mapping
 */

import type { ScenarioDefinition } from '@/data/types/scenario.types';
import type { NationState } from '@/data/types/nation.types';
import type { FactionId } from '@/data/types/enums';
import { ALL_FACTIONS } from '@/data/types';
import type {
  LiveDataResult,
  EconomicDataPoint,
  MilitaryDataPoint,
  TechnologyDataPoint,
  MarketDataPoint,
  LiveDataConfig,
} from '@/data/types/live-data.types';
import type { CurrencyState } from '@/data/types/currency.types';
import { liveDataConfig } from '@/engine/config/live-data';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Linearly interpolate between two values using blend factor.
 * blend=0 → returns `base`, blend=1 → returns `live`.
 */
export function blendValue(base: number, live: number, blend: number): number {
  return Math.round(base * (1 - blend) + live * blend);
}

// ── Economic Data Application ───────────────────────────────────────────────

/**
 * Apply economic data points to nation states within a scenario.
 *
 * Maps real GDP → game GDP, real inflation → game inflation,
 * and foreign reserves → game treasury.
 *
 * @param nationStates - Current nation states (from scenario).
 * @param economicData - Fetched economic data points.
 * @param blend        - Blend factor (0–1).
 * @returns Updated nation states with economic data blended in.
 * @see FR-4401
 */
export function applyEconomicData(
  nationStates: Record<FactionId, NationState>,
  economicData: readonly EconomicDataPoint[],
  blend: number,
): Record<FactionId, NationState> {
  const result = structuredClone(nationStates);
  const scaling = liveDataConfig.scaling;

  for (const dp of economicData) {
    const ns = result[dp.factionId];
    if (!ns) continue;

    if (dp.gdpBillions !== null) {
      ns.gdp = blendValue(ns.gdp, scaling.gdpToGameScale(dp.gdpBillions), blend);
    }
    if (dp.inflationPct !== null) {
      ns.inflation = blendValue(ns.inflation, scaling.inflationToGameScale(dp.inflationPct), blend);
    }
    if (dp.foreignReservesBillions !== null) {
      ns.treasury = blendValue(ns.treasury, scaling.reservesToTreasury(dp.foreignReservesBillions), blend);
    }
  }

  return result;
}

// ── Military Data Application ───────────────────────────────────────────────

/**
 * Apply military spending data to nation states.
 *
 * Uses a heuristic combining absolute spending and % of GDP
 * to estimate military readiness.
 *
 * @param nationStates  - Current nation states.
 * @param militaryData  - Fetched military data points.
 * @param economicData  - Economic data (for GDP reference).
 * @param blend         - Blend factor (0–1).
 * @returns Updated nation states with military readiness blended in.
 * @see FR-4402
 */
export function applyMilitaryData(
  nationStates: Record<FactionId, NationState>,
  militaryData: readonly MilitaryDataPoint[],
  economicData: readonly EconomicDataPoint[],
  blend: number,
): Record<FactionId, NationState> {
  const result = structuredClone(nationStates);
  const scaling = liveDataConfig.scaling;

  // Build GDP lookup for readiness calculation
  const gdpMap = new Map<FactionId, number>();
  for (const ep of economicData) {
    if (ep.gdpBillions !== null) {
      gdpMap.set(ep.factionId, ep.gdpBillions);
    }
  }

  for (const dp of militaryData) {
    const ns = result[dp.factionId];
    if (!ns) continue;

    if (dp.defenseSpendingPctGdp !== null) {
      const gdpB = gdpMap.get(dp.factionId) ?? ns.gdp;
      const liveReadiness = scaling.militarySpendingToReadiness(dp.defenseSpendingPctGdp, gdpB);
      ns.militaryReadiness = blendValue(ns.militaryReadiness, liveReadiness, blend);
    }
  }

  return result;
}

// ── Technology Data Application ─────────────────────────────────────────────

/**
 * Apply technology R&D data to nation states.
 *
 * @param nationStates - Current nation states.
 * @param techData     - Fetched technology data points.
 * @param blend        - Blend factor (0–1).
 * @returns Updated nation states with tech level blended in.
 * @see FR-4404
 */
export function applyTechnologyData(
  nationStates: Record<FactionId, NationState>,
  techData: readonly TechnologyDataPoint[],
  blend: number,
): Record<FactionId, NationState> {
  const result = structuredClone(nationStates);
  const scaling = liveDataConfig.scaling;

  for (const dp of techData) {
    const ns = result[dp.factionId];
    if (!ns) continue;

    if (dp.rndSpendingPctGdp !== null) {
      const liveTech = scaling.rndToTechLevel(dp.rndSpendingPctGdp);
      ns.techLevel = blendValue(ns.techLevel, liveTech, blend);
    }
  }

  return result;
}

// ── Currency / Forex Data Application ───────────────────────────────────────

/**
 * Apply live exchange rate data to an existing CurrencyState.
 *
 * Uses the blend factor to interpolate between the game's current rate
 * and the real-world rate fetched from the API. This keeps the game's
 * starting exchange rates realistic when live data is enabled.
 *
 * @param currencyState - Existing currency state to update (not mutated).
 * @param marketData    - Fetched market data containing exchange rates.
 * @param blend         - Blend factor (0–1).
 * @returns Updated currency state with blended exchange rates.
 * @see FR-4405
 */
export function applyCurrencyData(
  currencyState: CurrencyState,
  marketData: readonly MarketDataPoint[],
  blend: number,
): CurrencyState {
  const result: CurrencyState = {
    records: { ...currencyState.records },
    history: { ...currencyState.history },
  };

  for (const dp of marketData) {
    const rec = result.records[dp.factionId];
    if (!rec || dp.exchangeRateToUsd === null) continue;

    // Blend game rate with live rate
    const blendedRate = rec.exchangeRateVsUSD * (1 - blend) + dp.exchangeRateToUsd * blend;
    result.records[dp.factionId] = {
      ...rec,
      exchangeRateVsUSD: Math.max(0.0001, blendedRate),
      previousRate: rec.exchangeRateVsUSD,
      percentChange: ((blendedRate - rec.exchangeRateVsUSD) / rec.exchangeRateVsUSD) * 100,
      rateDriverEvents: [...rec.rateDriverEvents, 'Live exchange rate data applied'],
    };
  }

  return result;
}

// ── Composite Application ───────────────────────────────────────────────────

/**
 * Build a summary of what fields were updated and their before/after values.
 */
export interface LiveDataPatchSummary {
  readonly factionId: FactionId;
  readonly changes: Array<{
    readonly field: string;
    readonly before: number;
    readonly after: number;
    readonly source: string;
  }>;
}

/**
 * Apply all live data to a scenario definition, producing a patched copy.
 *
 * This is the primary entry point for the live-data pipeline.
 * It clones the scenario, applies each data category using the blend
 * factor, and returns the modified scenario plus a patch summary.
 *
 * @param scenario  - Original scenario definition.
 * @param liveData  - Complete live data result from fetcher.
 * @param config    - Live data configuration (blend factor, enabled categories).
 * @returns Patched scenario and summary of changes.
 * @see FR-4400
 */
export function applyLiveDataToScenario(
  scenario: ScenarioDefinition,
  liveData: LiveDataResult,
  config: LiveDataConfig = liveDataConfig.defaults,
): {
  scenario: ScenarioDefinition;
  summaries: LiveDataPatchSummary[];
} {
  const patched = structuredClone(scenario);
  const blend = config.blendFactor;
  const summaries: LiveDataPatchSummary[] = [];

  // Capture original values for summary
  const origNS = structuredClone(scenario.nationStates);

  // Apply economic data
  if (config.categories.economic && liveData.economic.length > 0) {
    patched.nationStates = applyEconomicData(
      patched.nationStates,
      liveData.economic,
      blend,
    );
  }

  // Apply military data
  if (config.categories.military && liveData.military.length > 0) {
    patched.nationStates = applyMilitaryData(
      patched.nationStates,
      liveData.military,
      liveData.economic,
      blend,
    );
  }

  // Apply technology data
  if (config.categories.technology && liveData.technology.length > 0) {
    patched.nationStates = applyTechnologyData(
      patched.nationStates,
      liveData.technology,
      blend,
    );
  }

  // Build summaries per faction
  for (const factionId of ALL_FACTIONS) {
    const orig = origNS[factionId];
    const updated = patched.nationStates[factionId];
    if (!orig || !updated) continue;

    const changes: LiveDataPatchSummary['changes'] = [];
    const fields: Array<[keyof NationState, string]> = [
      ['gdp', 'economic'],
      ['inflation', 'economic'],
      ['treasury', 'economic'],
      ['militaryReadiness', 'military'],
      ['techLevel', 'technology'],
    ];

    for (const [field, source] of fields) {
      const before = orig[field] as number;
      const after = updated[field] as number;
      if (before !== after) {
        changes.push({ field, before, after, source });
      }
    }

    if (changes.length > 0) {
      summaries.push({ factionId, changes });
    }
  }

  return { scenario: patched, summaries };
}

// ── Cache Helpers ───────────────────────────────────────────────────────────

const CACHE_KEY = 'neworder-live-data-cache';

/** Persist live data result to localStorage with timestamp. */
export function cacheLiveData(result: LiveDataResult): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // Non-critical — cache may be full
  }
}

/** Retrieve cached live data if it exists and is not expired. */
export function getCachedLiveData(maxAgeHours: number): LiveDataResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LiveDataResult;
    const age = Date.now() - new Date(data.timestamp).getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    if (age > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear the live data cache. */
export function clearLiveDataCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Non-critical
  }
}

// ── Initialization Helper ───────────────────────────────────────────────────

/**
 * Create a default LiveDataConfig from game configuration.
 */
export function createDefaultLiveDataConfig(): LiveDataConfig {
  return { ...liveDataConfig.defaults };
}
