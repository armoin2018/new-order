/**
 * Market Data Store — File-system backed OHLCV historical market data
 *
 * Reads and writes weekly OHLCV market data from `data/markets/` directory.
 * Supports extending existing data with new points and refreshing from
 * Yahoo Finance (server-side only, avoids CORS issues).
 *
 * @module server/services/market-data-store
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OHLCVPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataFile {
  symbol: string;
  name: string;
  gameId: string;
  nationId: string;
  granularity: 'weekly';
  startDate: string;
  endDate: string;
  dataPoints: number;
  downloadedAt: string;
  data: OHLCVPoint[];
}

export interface MarketDataSummary {
  gameId: string;
  symbol: string;
  name: string;
  nationId: string;
  dataPoints: number;
  startDate: string;
  endDate: string;
  downloadedAt: string;
}

// Yahoo Finance symbol mapping (same as download script)
const SYMBOL_MAP: Record<string, string> = {
  'sp500': '^GSPC',
  'djia': '^DJI',
  'nasdaq': '^IXIC',
  'sse-composite': '000001.SS',
  'szse-component': '399001.SZ',
  'moex-index': 'IMOEX.ME',
  'nikkei-225': '^N225',
  'topix': '^TOPX',
  'eurostoxx-50': '^STOXX50E',
  'dax': '^GDAXI',
  'cac-40': '^FCHI',
  'ftse-100': '^FTSE',
  'tedpix': '^TEDPIX',
  'wti-crude': 'CL=F',
  'gold': 'GC=F',
  'natgas': 'NG=F',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class MarketDataStore {
  constructor(private readonly dataDir: string) {}

  /**
   * Ensure the data/markets directory exists.
   */
  async ensureDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  /**
   * List all available market data files with summaries (no full data).
   */
  async list(): Promise<MarketDataSummary[]> {
    await this.ensureDir();

    const entries = await readdir(this.dataDir);
    const jsonFiles = entries.filter(
      (f) => extname(f) === '.json' && f !== '_manifest.json',
    );

    const summaries: MarketDataSummary[] = [];

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(this.dataDir, file), 'utf-8');
        const parsed = JSON.parse(raw) as MarketDataFile;
        summaries.push({
          gameId: parsed.gameId,
          symbol: parsed.symbol,
          name: parsed.name,
          nationId: parsed.nationId,
          dataPoints: parsed.dataPoints,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          downloadedAt: parsed.downloadedAt,
        });
      } catch {
        // Skip malformed files
      }
    }

    return summaries;
  }

  /**
   * Get full historical data for a specific market by gameId.
   */
  async get(gameId: string): Promise<MarketDataFile | null> {
    const filePath = join(this.dataDir, `${gameId}.json`);
    try {
      await stat(filePath);
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as MarketDataFile;
    } catch {
      return null;
    }
  }

  /**
   * Fetch latest weekly data from Yahoo Finance and extend stored data.
   * Server-side only (avoids CORS).
   */
  async refreshOne(gameId: string): Promise<{
    gameId: string;
    newPoints: number;
    totalPoints: number;
    status: 'ok' | 'error';
    error?: string;
  }> {
    const symbol = SYMBOL_MAP[gameId];
    if (!symbol) {
      return { gameId, newPoints: 0, totalPoints: 0, status: 'error', error: `Unknown gameId: ${gameId}` };
    }

    try {
      const existing = await this.get(gameId);
      const lastDate = existing?.endDate ?? '';

      // Fetch last 3 months of weekly data to ensure overlap + new points
      const now = Math.floor(Date.now() / 1000);
      const threeMonthsAgo = now - 90 * 24 * 60 * 60;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${threeMonthsAgo}&period2=${now}&interval=1wk`;

      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewOrderGame/1.0)',
          'Accept': 'application/json',
        },
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = (await resp.json()) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<Record<string, number[]>> } }> } };
      const result = json?.chart?.result?.[0];
      if (!result?.timestamp) throw new Error('No chart data');

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      if (!quote) throw new Error('No quote data');

      const newPoints: OHLCVPoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const open = quote['open']?.[i];
        const high = quote['high']?.[i];
        const low = quote['low']?.[i];
        const close = quote['close']?.[i];
        const volume = quote['volume']?.[i];

        if (ts == null || open == null || close == null) continue;

        const dateStr = new Date(ts * 1000).toISOString().split('T')[0]!;

        // Only include points newer than the last stored date
        if (dateStr <= lastDate) continue;

        newPoints.push({
          date: dateStr,
          open: Math.round(open * 100) / 100,
          high: Math.round((high ?? open) * 100) / 100,
          low: Math.round((low ?? open) * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume: Math.round(volume ?? 0),
        });
      }

      if (newPoints.length === 0 && existing) {
        return { gameId, newPoints: 0, totalPoints: existing.dataPoints, status: 'ok' };
      }

      // Merge with existing data
      const allData = existing ? [...existing.data, ...newPoints] : newPoints;

      const updated: MarketDataFile = {
        symbol,
        name: existing?.name ?? gameId,
        gameId,
        nationId: existing?.nationId ?? 'global',
        granularity: 'weekly',
        startDate: allData[0]?.date ?? '',
        endDate: allData[allData.length - 1]?.date ?? '',
        dataPoints: allData.length,
        downloadedAt: new Date().toISOString(),
        data: allData,
      };

      await this.ensureDir();
      await writeFile(
        join(this.dataDir, `${gameId}.json`),
        JSON.stringify(updated, null, 2) + '\n',
      );

      return { gameId, newPoints: newPoints.length, totalPoints: allData.length, status: 'ok' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { gameId, newPoints: 0, totalPoints: 0, status: 'error', error: msg };
    }
  }

  /**
   * Refresh all known market data files.
   */
  async refreshAll(): Promise<Array<{ gameId: string; newPoints: number; totalPoints: number; status: string; error?: string }>> {
    const results = [];
    for (const gameId of Object.keys(SYMBOL_MAP)) {
      results.push(await this.refreshOne(gameId));
      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }

    // Update manifest
    const manifest = {
      description: 'Historical market data manifest — 10-year weekly OHLCV data',
      lastRefreshedAt: new Date().toISOString(),
      symbols: results.map((r) => ({
        symbol: SYMBOL_MAP[r.gameId] ?? '',
        name: r.gameId,
        points: r.totalPoints,
        status: r.status,
      })),
    };
    await writeFile(
      join(this.dataDir, '_manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );

    return results;
  }
}
