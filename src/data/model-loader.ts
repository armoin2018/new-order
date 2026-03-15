/**
 * model-loader.ts — Static loader for all JSON model data.
 *
 * Uses Vite's import.meta.glob to eagerly import every JSON model file
 * under models/ at build time.  Exports typed arrays for each model
 * collection so they can be consumed by the Module Browser / Editor
 * and by market-state initialisation.
 */

import type {
  StockExchangeModel,
  NationTickerSet,
  MarketIndexModel,
} from './types';

// ─── Raw glob imports (eager, resolved at build time) ──────────────

const exchangeGlob = import.meta.glob<{ default: StockExchangeModel }>(
  '../../models/markets/exchanges/*.json',
  { eager: true },
);

const tickerGlob = import.meta.glob<{ default: NationTickerSet }>(
  '../../models/markets/tickers/*.json',
  { eager: true },
);

const indexGlob = import.meta.glob<{ default: MarketIndexModel }>(
  '../../models/markets/indexes/*.json',
  { eager: true },
);

const politicalGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/political-systems/*.json',
  { eager: true },
);

const technologyGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/technology/*.json',
  { eager: true },
);

const educationGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/education/*.json',
  { eager: true },
);

const populationGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/population/*.json',
  { eager: true },
);

const religionGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/religion/*.json',
  { eager: true },
);

const sentimentBaselineGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../models/markets/sentiment-baseline.json',
  { eager: true },
);

// ─── Helpers ────────────────────────────────────────────────────────

/** Filter out _manifest.json and extract the default export from each module. */
function collect<T>(glob: Record<string, { default: T }>): T[] {
  return Object.entries(glob)
    .filter(([path]) => !path.includes('_manifest'))
    .map(([, mod]) => mod.default);
}

// ─── Typed exports ──────────────────────────────────────────────────

/** All exchange definitions (models/markets/exchanges/*.json). */
export const EXCHANGE_MODELS: readonly StockExchangeModel[] = collect(exchangeGlob);

/** All nation ticker sets (models/markets/tickers/*.json). */
export const TICKER_SET_MODELS: readonly NationTickerSet[] = collect(tickerGlob);

/** All preset market indexes (models/markets/indexes/*.json). */
export const INDEX_MODELS: readonly MarketIndexModel[] = collect(indexGlob);

/** All political system profiles (models/political-systems/*.json). */
export const POLITICAL_SYSTEM_MODELS: readonly Record<string, unknown>[] = collect(politicalGlob);

/** All technology research models (models/technology/*.json). */
export const TECHNOLOGY_MODELS: readonly Record<string, unknown>[] = collect(technologyGlob);

/** All education investment models (models/education/*.json). */
export const EDUCATION_MODELS: readonly Record<string, unknown>[] = collect(educationGlob);

/** All population demographic profiles (models/population/*.json). */
export const POPULATION_MODELS: readonly Record<string, unknown>[] = collect(populationGlob);

/** All religion/belief system profiles (models/religion/*.json). */
export const RELIGION_MODELS: readonly Record<string, unknown>[] = collect(religionGlob);

// ─── Sentiment Baseline ─────────────────────────────────────────────

/** Exchange-level sentiment baseline configuration. */
export interface ExchangeBaselineSentiment {
  readonly sentiment: 'bullish' | 'neutral' | 'bearish';
  readonly sentimentScore: number;
  readonly trendStrength: number;
  readonly note?: string;
}

/** Full sentiment baseline configuration from JSON. */
export interface SentimentBaselineConfig {
  readonly globalSentiment: string;
  readonly globalSentimentScore: number;
  readonly exchangeBaselines: Record<string, ExchangeBaselineSentiment>;
  readonly climateRiskFactors: Record<string, Record<string, number>>;
}

const baselineRaw = Object.values(sentimentBaselineGlob)[0]?.default as SentimentBaselineConfig | undefined;

/** Loaded sentiment baseline (or a sensible default). */
export const SENTIMENT_BASELINE: SentimentBaselineConfig = baselineRaw ?? {
  globalSentiment: 'neutral',
  globalSentimentScore: 0,
  exchangeBaselines: {},
  climateRiskFactors: {},
};
