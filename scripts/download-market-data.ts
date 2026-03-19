#!/usr/bin/env node
/**
 * download-market-data.ts — Fetch 10 years of historical market data
 *
 * Downloads OHLCV data for major market indexes (matching the game's
 * exchange/index models) from Yahoo Finance's chart API (free, no key).
 *
 * Stores data as JSON in data/markets/{symbol}.json with schema:
 * { symbol, name, exchangeId, granularity, startDate, endDate, data: OHLCPoint[] }
 *
 * Run: npx tsx scripts/download-market-data.ts
 *
 * @module scripts/download-market-data
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Root of the project (scripts/ is one level down). */
const PROJECT_ROOT = path.resolve(import.meta.dirname ?? __dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'data', 'markets');

/** 10 years in seconds. */
const TEN_YEARS_S = 10 * 365.25 * 24 * 60 * 60;

interface SymbolConfig {
  /** Yahoo Finance ticker symbol. */
  symbol: string;
  /** Human-readable index name. */
  name: string;
  /** Matching exchangeId or indexId in models/. */
  gameId: string;
  /** Which nation's exchange this represents. */
  nationId: string;
}

/**
 * Major indexes mapped to game exchange/index IDs.
 * Yahoo Finance tickers for major world indexes.
 */
const SYMBOLS: SymbolConfig[] = [
  // United States
  { symbol: '^GSPC', name: 'S&P 500', gameId: 'sp500', nationId: 'us' },
  { symbol: '^DJI', name: 'Dow Jones Industrial Average', gameId: 'djia', nationId: 'us' },
  { symbol: '^IXIC', name: 'NASDAQ Composite', gameId: 'nasdaq', nationId: 'us' },

  // China
  { symbol: '000001.SS', name: 'SSE Composite Index', gameId: 'sse-composite', nationId: 'china' },
  { symbol: '399001.SZ', name: 'Shenzhen Component', gameId: 'szse-component', nationId: 'china' },

  // Russia (MOEX — may have limited data)
  { symbol: 'IMOEX.ME', name: 'MOEX Russia Index', gameId: 'moex-index', nationId: 'russia' },

  // Japan
  { symbol: '^N225', name: 'Nikkei 225', gameId: 'nikkei-225', nationId: 'japan' },
  { symbol: '^TOPX', name: 'TOPIX', gameId: 'topix', nationId: 'japan' },

  // European Union
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', gameId: 'eurostoxx-50', nationId: 'eu' },
  { symbol: '^GDAXI', name: 'DAX 40', gameId: 'dax', nationId: 'eu' },
  { symbol: '^FCHI', name: 'CAC 40', gameId: 'cac-40', nationId: 'eu' },
  { symbol: '^FTSE', name: 'FTSE 100', gameId: 'ftse-100', nationId: 'eu' },

  // Iran (TEDPIX — may be unavailable via Yahoo)
  { symbol: '^TEDPIX', name: 'Tehran Price Index', gameId: 'tedpix', nationId: 'iran' },

  // Commodities (cross-cutting)
  { symbol: 'CL=F', name: 'Crude Oil Futures (WTI)', gameId: 'wti-crude', nationId: 'global' },
  { symbol: 'GC=F', name: 'Gold Futures', gameId: 'gold', nationId: 'global' },
  { symbol: 'NG=F', name: 'Natural Gas Futures', gameId: 'natgas', nationId: 'global' },
];

// ---------------------------------------------------------------------------
// Yahoo Finance Chart API
// ---------------------------------------------------------------------------

interface YahooOHLCResult {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchYahooChart(symbol: string): Promise<YahooOHLCResult[]> {
  const now = Math.floor(Date.now() / 1000);
  const period1 = Math.floor(now - TEN_YEARS_S);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${now}&interval=1wk`;

  console.log(`  Fetching ${symbol} ...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewOrderGame/1.0)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${symbol}: ${response.statusText}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    throw new Error(`No chart result for ${symbol}`);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    throw new Error(`No quote data for ${symbol}`);
  }

  const ohlc: YahooOHLCResult[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    // Skip null/NaN entries (market closures, etc.)
    if (
      ts == null || open == null || high == null ||
      low == null || close == null
    ) {
      continue;
    }

    const date = new Date(ts * 1000);
    ohlc.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume ?? 0),
    });
  }

  return ohlc;
}

// ---------------------------------------------------------------------------
// Output structure
// ---------------------------------------------------------------------------

interface MarketDataFile {
  symbol: string;
  name: string;
  gameId: string;
  nationId: string;
  granularity: 'weekly';
  startDate: string;
  endDate: string;
  dataPoints: number;
  downloadedAt: string;
  data: YahooOHLCResult[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   New Order — Market Data Downloader (10-year)    ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const summary: { symbol: string; name: string; points: number; status: string }[] = [];

  for (const cfg of SYMBOLS) {
    try {
      const data = await fetchYahooChart(cfg.symbol);

      if (data.length === 0) {
        console.log(`  ⚠ ${cfg.name}: No data returned, skipping`);
        summary.push({ symbol: cfg.symbol, name: cfg.name, points: 0, status: 'no-data' });
        continue;
      }

      const file: MarketDataFile = {
        symbol: cfg.symbol,
        name: cfg.name,
        gameId: cfg.gameId,
        nationId: cfg.nationId,
        granularity: 'weekly',
        startDate: data[0].date,
        endDate: data[data.length - 1].date,
        dataPoints: data.length,
        downloadedAt: new Date().toISOString(),
        data,
      };

      const filename = `${cfg.gameId}.json`;
      const filePath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n');

      console.log(`  ✓ ${cfg.name}: ${data.length} weekly data points (${data[0].date} → ${data[data.length - 1].date})`);
      summary.push({ symbol: cfg.symbol, name: cfg.name, points: data.length, status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${cfg.name}: ${msg}`);
      summary.push({ symbol: cfg.symbol, name: cfg.name, points: 0, status: `error: ${msg}` });
    }

    // Rate limit: 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Write manifest
  const manifest = {
    description: 'Historical market data manifest — 10-year weekly OHLCV data',
    downloadedAt: new Date().toISOString(),
    symbols: summary,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  // Print summary
  console.log('\n── Summary ─────────────────────────────────');
  const ok = summary.filter((s) => s.status === 'ok');
  const failed = summary.filter((s) => s.status !== 'ok');
  console.log(`  ✓ ${ok.length} indexes downloaded successfully`);
  console.log(`  Total data points: ${ok.reduce((sum, s) => sum + s.points, 0)}`);
  if (failed.length > 0) {
    console.log(`  ✗ ${failed.length} indexes failed:`);
    for (const f of failed) {
      console.log(`    - ${f.name}: ${f.status}`);
    }
  }
  console.log(`\nData stored in: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
