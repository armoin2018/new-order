/**
 * Live Data Configuration — FR-4400
 *
 * API endpoints, faction-to-country mappings, default settings, and
 * cache/timeout configuration for internet data collection.
 *
 * All live-data tuning is centralised here — no code changes required.
 *
 * @see NFR-204  — All game formulas shall be configurable via constants.
 * @see FR-4400  — Live data fetching at game start
 */

import { FactionId } from '@/data/types';
import type { FactionCountryMap, LiveDataConfig } from '@/data/types/live-data.types';

// ── Faction → Country Code Mapping ──────────────────────────────────────────

/**
 * Maps each in-game faction to the ISO-3166 alpha-2 country code
 * used by public APIs (World Bank, REST Countries, etc.).
 *
 * EU uses 'EUU' for World Bank aggregate indicator, or 'EMU' for eurozone.
 */
export const FACTION_COUNTRY_CODES: FactionCountryMap = {
  [FactionId.US]: 'US',
  [FactionId.China]: 'CN',
  [FactionId.Russia]: 'RU',
  [FactionId.Japan]: 'JP',
  [FactionId.Iran]: 'IR',
  [FactionId.DPRK]: 'KP',
  [FactionId.EU]: 'EUU',
  [FactionId.Syria]: 'SY',
} as FactionCountryMap;

/**
 * World Bank indicator codes used for economic data.
 * @see https://data.worldbank.org/indicator
 */
export const WORLD_BANK_INDICATORS = {
  gdp: 'NY.GDP.MKTP.CD',            // GDP (current US$)
  gdpGrowth: 'NY.GDP.MKTP.KD.ZG',   // GDP growth (annual %)
  inflation: 'FP.CPI.TOTL.ZG',       // Consumer price inflation (annual %)
  unemployment: 'SL.UEM.TOTL.ZS',    // Unemployment total (% of total labor force)
  debtToGdp: 'GC.DOD.TOTL.GD.ZS',   // Central government debt, total (% of GDP)
  tradeBalance: 'NE.RSB.GNFS.CD',    // External balance on goods and services (current US$)
  reserves: 'FI.RES.TOTL.CD',        // Total reserves (includes gold, current US$)
  militarySpending: 'MS.MIL.XPND.CD',     // Military expenditure (current US$)
  militaryPctGdp: 'MS.MIL.XPND.GD.ZS',   // Military expenditure (% of GDP)
  population: 'SP.POP.TOTL',              // Total population
  rndSpending: 'GB.XPD.RSDV.GD.ZS',      // R&D expenditure (% of GDP)
  internetUsers: 'IT.NET.USER.ZS',        // Internet users (% of population)
} as const;

/**
 * Faction → currency code mapping for exchange-rate APIs.
 */
export const FACTION_CURRENCY_CODES: Record<string, string> = {
  [FactionId.US]: 'USD',
  [FactionId.China]: 'CNY',
  [FactionId.Russia]: 'RUB',
  [FactionId.Japan]: 'JPY',
  [FactionId.Iran]: 'IRR',
  [FactionId.DPRK]: 'KPW',
  [FactionId.EU]: 'EUR',
  [FactionId.Syria]: 'SYP',
};

// ── API Endpoints ───────────────────────────────────────────────────────────

export const liveDataConfig = {
  /** @see FR-4400 */
  defaults: {
    enabled: false,
    categories: {
      economic: true,
      military: true,
      diplomatic: true,
      technology: true,
      markets: true,
    },
    timeoutMs: 15_000,
    blendFactor: 0.7,
    cacheHours: 24,
  } satisfies LiveDataConfig,

  /**
   * Free public API endpoints.
   * All use GET requests, return JSON, require no API key.
   */
  apis: {
    /** World Bank Open Data — economic indicators */
    worldBank: {
      baseUrl: 'https://api.worldbank.org/v2',
      format: 'json',
      perPage: 1,
      /** Most-recent-year indicator for a country */
      indicatorUrl: (country: string, indicator: string) =>
        `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=1&mrv=1`,
    },

    /** ExchangeRate-API (free tier — 1,500 req/mo) */
    exchangeRate: {
      baseUrl: 'https://open.er-api.com/v6/latest/USD',
    },

    /** REST Countries v3.1 (free, no key) */
    restCountries: {
      baseUrl: 'https://restcountries.com/v3.1',
      byCode: (code: string) =>
        `https://restcountries.com/v3.1/alpha/${code}?fields=name,population,gini,area`,
    },
  },

  /**
   * Scaling functions to map real-world data to game-scale values.
   * These convert raw API numbers into the 0–100 ranges used by NationState.
   */
  scaling: {
    /** Convert real GDP (billions USD) to game-scale GDP value. */
    gdpToGameScale: (gdpBillions: number): number => {
      // Game uses raw billions — already in comparable scale
      return Math.round(gdpBillions);
    },

    /** Convert real inflation % to game-scale inflation value. */
    inflationToGameScale: (inflationPct: number): number => {
      return Math.round(Math.max(0, Math.min(100, inflationPct)));
    },

    /** Convert foreign reserves (billions USD) to game treasury value. */
    reservesToTreasury: (reservesBillions: number): number => {
      return Math.round(reservesBillions);
    },

    /** Convert military spending % of GDP to 0–100 readiness estimate. */
    militarySpendingToReadiness: (pctGdp: number, gdpBillions: number): number => {
      // Heuristic: higher absolute spending and % = higher readiness
      const absoluteScore = Math.min(50, (gdpBillions * pctGdp / 100) / 20);
      const pctScore = Math.min(50, pctGdp * 10);
      return Math.round(Math.min(100, absoluteScore + pctScore));
    },

    /** Convert R&D % of GDP to 0–100 tech level. */
    rndToTechLevel: (rndPctGdp: number): number => {
      // 5% R&D/GDP → ~90 tech level; 0% → ~10
      return Math.round(Math.min(100, Math.max(5, rndPctGdp * 18)));
    },

    /** Convert population millions to no transform (informational). */
    populationScale: (popMillions: number): number => {
      return Math.round(popMillions);
    },
  },
} as const;
