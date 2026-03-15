/**
 * Market History Generator — Pre-Simulation Historical Data
 *
 * Generates realistic 10-year historical OHLC data for market indexes
 * and individual tickers. Uses geometric Brownian motion with regime
 * switching to produce realistic price series including:
 *
 * - Bull/bear market cycles (average 2-4 years per cycle)
 * - Volatility clustering (GARCH-like effects)
 * - Mean reversion around secular trend
 * - Occasional crash events (3-5% of months)
 * - Different risk profiles per exchange/index
 *
 * The historical data provides context for the simulation charts and
 * informs market impact estimation during gameplay.
 *
 * @module engine/market-history-generator
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** OHLCV data point for a single time period. */
export interface OHLCPoint {
  /** ISO date string (YYYY-MM-DD). */
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

/** Time granularity for historical data. */
export type HistoryGranularity = 'daily' | 'weekly' | 'monthly';

/** Complete historical data set for a single index or ticker. */
export interface HistoricalSeries {
  readonly id: string;
  readonly name: string;
  readonly granularity: HistoryGranularity;
  readonly data: readonly OHLCPoint[];
  /** The price at the start of the simulation (last close). */
  readonly simulationStartPrice: number;
}

/** Risk profile affecting how volatile and trendy the history is. */
export interface HistoryProfile {
  /** Annual drift (expected return). e.g. 0.07 = 7% annual. */
  readonly annualDrift: number;
  /** Annual volatility. e.g. 0.15 = 15% annual vol. */
  readonly annualVol: number;
  /** Probability of a crash month (sudden -10% to -25% drop). */
  readonly crashProb: number;
  /** Mean reversion strength (0 = none, 1 = strong pull). */
  readonly meanReversionStrength: number;
}

// ---------------------------------------------------------------------------
// Pre-defined profiles per exchange / index category
// ---------------------------------------------------------------------------

const PROFILES: Record<string, HistoryProfile> = {
  // Developed / Large
  nyse:     { annualDrift: 0.08, annualVol: 0.16, crashProb: 0.025, meanReversionStrength: 0.02 },
  euronext: { annualDrift: 0.06, annualVol: 0.17, crashProb: 0.030, meanReversionStrength: 0.02 },
  tse:      { annualDrift: 0.05, annualVol: 0.18, crashProb: 0.025, meanReversionStrength: 0.03 },

  // Emerging / Higher risk
  sse:      { annualDrift: 0.09, annualVol: 0.25, crashProb: 0.035, meanReversionStrength: 0.04 },
  moex:     { annualDrift: 0.04, annualVol: 0.30, crashProb: 0.045, meanReversionStrength: 0.05 },
  tedpix:   { annualDrift: 0.03, annualVol: 0.35, crashProb: 0.050, meanReversionStrength: 0.06 },

  // Frontier / Extreme
  pse:      { annualDrift: 0.01, annualVol: 0.40, crashProb: 0.060, meanReversionStrength: 0.08 },
  dse:      { annualDrift: 0.02, annualVol: 0.38, crashProb: 0.055, meanReversionStrength: 0.07 },

  // Sector profiles
  defense:  { annualDrift: 0.07, annualVol: 0.20, crashProb: 0.020, meanReversionStrength: 0.03 },
  energy:   { annualDrift: 0.05, annualVol: 0.28, crashProb: 0.040, meanReversionStrength: 0.04 },
  tech:     { annualDrift: 0.12, annualVol: 0.24, crashProb: 0.035, meanReversionStrength: 0.02 },
  finance:  { annualDrift: 0.07, annualVol: 0.22, crashProb: 0.040, meanReversionStrength: 0.03 },
  consumer: { annualDrift: 0.06, annualVol: 0.14, crashProb: 0.020, meanReversionStrength: 0.02 },

  // Composite / Global
  global:   { annualDrift: 0.07, annualVol: 0.15, crashProb: 0.025, meanReversionStrength: 0.02 },
};

/** Get the best matching profile for an ID. */
function resolveProfile(id: string): HistoryProfile {
  // Exact match
  if (PROFILES[id]) return PROFILES[id];

  // Check if ID contains a known key
  for (const [key, profile] of Object.entries(PROFILES)) {
    if (id.includes(key)) return profile;
  }

  // Default to global profile
  return PROFILES.global!;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (deterministic reproducibility)
// ---------------------------------------------------------------------------

/**
 * Simple seeded PRNG (mulberry32). Produces values in [0, 1).
 */
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform: uniform [0,1) → standard normal. */
function normalRandom(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Core Generator
// ---------------------------------------------------------------------------

/**
 * Generate historical OHLC data for a given asset.
 *
 * Uses geometric Brownian motion with:
 * - Regime switching (bull/bear cycles)
 * - Volatility clustering
 * - Crash events
 * - Mean reversion to secular trend
 *
 * @param id — Unique identifier for the asset (indexId or tickerId).
 * @param name — Display name.
 * @param startPrice — Price at the beginning of the history (10 years ago).
 * @param endPrice — Target price at the end (simulation start).
 * @param years — Number of years of history to generate (default 10).
 * @param seed — Random seed for deterministic output.
 * @returns Complete historical series with daily data.
 */
export function generateHistoricalSeries(
  id: string,
  name: string,
  startPrice: number,
  endPrice: number,
  years: number = 10,
  seed: number = 42,
): HistoricalSeries {
  const profile = resolveProfile(id);
  const rng = createRng(seed + hashString(id));

  // We generate monthly data (more efficient, user can select daily view which interpolates)
  const totalMonths = years * 12;
  const monthlyDrift = profile.annualDrift / 12;
  const monthlyVol = profile.annualVol / Math.sqrt(12);

  // Calculate the required overall drift to get from startPrice to endPrice
  const requiredTotalReturn = Math.log(endPrice / startPrice);
  const requiredMonthlyDrift = requiredTotalReturn / totalMonths;

  // Blend the profile drift with the required drift (70% required, 30% natural)
  const blendedDrift = requiredMonthlyDrift * 0.7 + monthlyDrift * 0.3;

  const points: OHLCPoint[] = [];
  let price = startPrice;
  let volatilityState = 1.0; // volatility multiplier (GARCH-like)
  let regime: 'bull' | 'bear' = rng() > 0.5 ? 'bull' : 'bear';
  let regimeCounter = 0;
  const regimeDuration = () => Math.floor(12 + rng() * 36); // 1-4 years

  // Start date: 10 years before a reference simulation start (Jan 2026)
  const simStartYear = 2026;
  const historyStartYear = simStartYear - years;

  for (let m = 0; m < totalMonths; m++) {
    const year = historyStartYear + Math.floor(m / 12);
    const month = (m % 12) + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Regime switching
    regimeCounter++;
    if (regimeCounter > regimeDuration()) {
      regime = regime === 'bull' ? 'bear' : 'bull';
      regimeCounter = 0;
    }

    // Regime-adjusted drift
    const regimeMod = regime === 'bull' ? 1.3 : 0.5;
    const drift = blendedDrift * regimeMod;

    // Mean reversion toward the path to endPrice
    const expectedPrice = startPrice * Math.exp(requiredTotalReturn * (m / totalMonths));
    const deviation = (price - expectedPrice) / expectedPrice;
    const meanRevPull = -deviation * profile.meanReversionStrength;

    // Volatility clustering (slow-moving multiplier)
    volatilityState = 0.95 * volatilityState + 0.05 * (0.5 + rng() * 1.5);

    // Crash events
    let crashImpact = 0;
    if (rng() < profile.crashProb) {
      crashImpact = -(0.08 + rng() * 0.17); // -8% to -25%
    }

    // Monthly return via GBM + adjustments
    const noise = normalRandom(rng) * monthlyVol * volatilityState;
    const monthlyReturn = drift + meanRevPull + noise + crashImpact;
    const newPrice = price * Math.exp(monthlyReturn);

    // Generate OHLC from the monthly return
    const open = price;
    const close = Math.max(0.01, newPrice);

    // Intra-month high/low estimation
    const intraVol = Math.abs(monthlyReturn) * 0.5 + monthlyVol * volatilityState * 0.3;
    const high = Math.max(open, close) * (1 + rng() * intraVol);
    const low = Math.min(open, close) * (1 - rng() * intraVol);

    // Volume (higher during volatile months)
    const baseVolume = 1_000_000 + rng() * 5_000_000;
    const volMultiplier = 1 + Math.abs(monthlyReturn) * 5;

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(15, daysInMonth)).padStart(2, '0')}`;

    points.push({
      date: dateStr,
      open: round2(open),
      high: round2(Math.max(high, open, close)),
      low: round2(Math.max(0.01, Math.min(low, open, close))),
      close: round2(close),
      volume: Math.round(baseVolume * volMultiplier),
    });

    price = close;
  }

  return {
    id,
    name,
    granularity: 'monthly',
    data: points,
    simulationStartPrice: points[points.length - 1]?.close ?? endPrice,
  };
}

// ---------------------------------------------------------------------------
// Batch generators for indexes and tickers
// ---------------------------------------------------------------------------

/** Index metadata needed for history generation. */
export interface IndexHistoryInput {
  readonly indexId: string;
  readonly indexName: string;
  readonly baseValue: number;
}

/**
 * Generate historical series for all indexes.
 *
 * Each index gets a 10-year history ending at its current baseValue.
 * The start price is estimated from the profile's expected annual return.
 *
 * @param indexes — Array of index metadata.
 * @param seed — Random seed for reproducibility.
 * @returns Map of indexId → HistoricalSeries.
 */
export function generateAllIndexHistories(
  indexes: readonly IndexHistoryInput[],
  seed: number = 12345,
): Record<string, HistoricalSeries> {
  const result: Record<string, HistoricalSeries> = {};

  for (const idx of indexes) {
    const profile = resolveProfile(idx.indexId);
    // Estimate start price: work backwards from current value using annual drift
    const startPrice = idx.baseValue / Math.exp(profile.annualDrift * 10);

    result[idx.indexId] = generateHistoricalSeries(
      idx.indexId,
      idx.indexName,
      round2(startPrice),
      idx.baseValue,
      10,
      seed,
    );
  }

  return result;
}

/**
 * Generate historical series for all tickers.
 *
 * @param tickers — Array of { tickerId, name, initialPrice, exchangeId }.
 * @param seed — Random seed for reproducibility.
 * @returns Map of tickerId → HistoricalSeries.
 */
export function generateAllTickerHistories(
  tickers: readonly { tickerId: string; name: string; initialPrice: number; exchangeId: string }[],
  seed: number = 54321,
): Record<string, HistoricalSeries> {
  const result: Record<string, HistoricalSeries> = {};

  for (const t of tickers) {
    const profile = resolveProfile(t.exchangeId);
    const sectorProfile = resolveProfile(t.tickerId);
    // Blend exchange and sector profiles
    const blendedDrift = (profile.annualDrift + sectorProfile.annualDrift) / 2;
    const startPrice = t.initialPrice / Math.exp(blendedDrift * 10);

    result[t.tickerId] = generateHistoricalSeries(
      t.tickerId,
      t.name,
      round2(Math.max(1, startPrice)),
      t.initialPrice,
      10,
      seed,
    );
  }

  return result;
}

/**
 * Merge simulation turn data into a historical series.
 *
 * Appends per-turn OHLC points from the game's IndexRuntimeState.history
 * or TickerRuntimeState.priceHistory onto the end of the historical data,
 * providing a unified series for chart rendering.
 *
 * @param historical — Pre-simulation historical data.
 * @param turnData — Array of turn-level data points.
 * @param simStartDate — ISO date string for turn 1 (e.g. "2026-01-15").
 * @returns Combined series with historical + simulation data.
 */
export function mergeHistoryWithSimulation(
  historical: HistoricalSeries,
  turnData: readonly { turn: number; value: number; change: number; changePercent: number }[],
  simStartDate: string = '2026-01-15',
): HistoricalSeries {
  const baseDate = new Date(simStartDate);
  const simPoints: OHLCPoint[] = [];

  let prevClose = historical.simulationStartPrice;

  for (const td of turnData) {
    // Each turn = 1 month in game time
    const turnDate = new Date(baseDate);
    turnDate.setMonth(turnDate.getMonth() + (td.turn - 1));
    const dateStr = turnDate.toISOString().slice(0, 10);

    const open = prevClose;
    const close = td.value;
    const high = Math.max(open, close) * (1 + Math.abs(td.changePercent) * 0.005);
    const low = Math.min(open, close) * (1 - Math.abs(td.changePercent) * 0.005);

    simPoints.push({
      date: dateStr,
      open: round2(open),
      high: round2(high),
      low: round2(Math.max(0.01, low)),
      close: round2(close),
      volume: 1_000_000,
    });

    prevClose = close;
  }

  return {
    ...historical,
    data: [...historical.data, ...simPoints],
  };
}

// ---------------------------------------------------------------------------
// Utility: Time range filtering
// ---------------------------------------------------------------------------

/** Time range presets for chart display. */
export type TimeRange = '10y' | '5y' | '1y' | '6m' | '1m' | '1w' | '1d' | 'scenario';

/**
 * Filter a historical series to a time range.
 *
 * @param series — Full data series.
 * @param range — Time range preset.
 * @param scenarioStartDate — Date the simulation started.
 * @returns Filtered data points within the range.
 */
export function filterByTimeRange(
  series: readonly OHLCPoint[],
  range: TimeRange,
  scenarioStartDate: string = '2026-01-15',
): readonly OHLCPoint[] {
  if (series.length === 0) return series;

  const lastDate = new Date(series[series.length - 1]!.date);

  switch (range) {
    case 'scenario': {
      return series.filter((p) => p.date >= scenarioStartDate);
    }
    case '10y': return series; // Full history
    case '5y': {
      const cutoff = new Date(lastDate);
      cutoff.setFullYear(cutoff.getFullYear() - 5);
      return series.filter((p) => new Date(p.date) >= cutoff);
    }
    case '1y': {
      const cutoff = new Date(lastDate);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      return series.filter((p) => new Date(p.date) >= cutoff);
    }
    case '6m': {
      const cutoff = new Date(lastDate);
      cutoff.setMonth(cutoff.getMonth() - 6);
      return series.filter((p) => new Date(p.date) >= cutoff);
    }
    case '1m': {
      const cutoff = new Date(lastDate);
      cutoff.setMonth(cutoff.getMonth() - 1);
      return series.filter((p) => new Date(p.date) >= cutoff);
    }
    case '1w': {
      const cutoff = new Date(lastDate);
      cutoff.setDate(cutoff.getDate() - 7);
      return series.filter((p) => new Date(p.date) >= cutoff);
    }
    case '1d': {
      return series.slice(-1);
    }
    default:
      return series;
  }
}

/**
 * Filter a series to a custom date range (for timeline slider).
 */
export function filterByDateRange(
  series: readonly OHLCPoint[],
  startDate: string,
  endDate: string,
): readonly OHLCPoint[] {
  return series.filter((p) => p.date >= startDate && p.date <= endDate);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
