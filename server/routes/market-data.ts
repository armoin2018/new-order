/**
 * Market Data Routes — OHLCV Historical Data API
 *
 * Provides endpoints for listing, reading, and refreshing stored
 * historical market OHLCV data from `data/markets/`.
 *
 * Routes:
 *   GET  /api/v1/market-data          — List available market data sets
 *   GET  /api/v1/market-data/:gameId  — Get full OHLCV history for an index
 *   POST /api/v1/market-data/refresh  — Extend all market data with latest points
 *   POST /api/v1/market-data/refresh/:gameId — Extend one market data set
 *
 * @module server/routes/market-data
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MarketDataStore } from '../services/market-data-store.js';

// ── Schemas ─────────────────────────────────────────────────────────────────

const summarySchema = {
  type: 'object' as const,
  properties: {
    gameId: { type: 'string' as const },
    symbol: { type: 'string' as const },
    name: { type: 'string' as const },
    nationId: { type: 'string' as const },
    dataPoints: { type: 'integer' as const },
    startDate: { type: 'string' as const },
    endDate: { type: 'string' as const },
    downloadedAt: { type: 'string' as const },
  },
};

const ohlcPointSchema = {
  type: 'object' as const,
  properties: {
    date: { type: 'string' as const },
    open: { type: 'number' as const },
    high: { type: 'number' as const },
    low: { type: 'number' as const },
    close: { type: 'number' as const },
    volume: { type: 'number' as const },
  },
};

const refreshResultSchema = {
  type: 'object' as const,
  properties: {
    gameId: { type: 'string' as const },
    newPoints: { type: 'integer' as const },
    totalPoints: { type: 'integer' as const },
    status: { type: 'string' as const },
    error: { type: 'string' as const },
  },
};

// ── Route Registration ──────────────────────────────────────────────────────

export function registerMarketDataRoutes(
  app: FastifyInstance,
  dataDir: string,
): void {
  const store = new MarketDataStore(dataDir);

  // ── List all market data sets ──
  app.get('/api/v1/market-data', {
    schema: {
      tags: ['market-data'],
      summary: 'List available historical market data sets',
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: summarySchema },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const items = await store.list();
    return { items, total: items.length };
  });

  // ── Get full history for one market ──
  app.get<{ Params: { gameId: string } }>('/api/v1/market-data/:gameId', {
    schema: {
      tags: ['market-data'],
      summary: 'Get full OHLCV history for a market index',
      params: {
        type: 'object',
        properties: {
          gameId: { type: 'string', description: 'Market game ID (e.g. sp500, nikkei-225)' },
        },
        required: ['gameId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            name: { type: 'string' },
            gameId: { type: 'string' },
            nationId: { type: 'string' },
            granularity: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            dataPoints: { type: 'integer' },
            downloadedAt: { type: 'string' },
            data: { type: 'array', items: ohlcPointSchema },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const data = await store.get(req.params.gameId);
    if (!data) {
      return reply.status(404).send({ error: `No market data for gameId: ${req.params.gameId}` });
    }
    return data;
  });

  // ── Refresh all market data ──
  app.post('/api/v1/market-data/refresh', {
    schema: {
      tags: ['market-data'],
      summary: 'Refresh all market data with latest weekly OHLCV points',
      response: {
        200: {
          type: 'object',
          properties: {
            refreshedAt: { type: 'string' },
            results: { type: 'array', items: refreshResultSchema },
          },
        },
      },
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const results = await store.refreshAll();
    return { refreshedAt: new Date().toISOString(), results };
  });

  // ── Refresh one market data set ──
  app.post<{ Params: { gameId: string } }>('/api/v1/market-data/refresh/:gameId', {
    schema: {
      tags: ['market-data'],
      summary: 'Refresh one market data set with latest weekly OHLCV points',
      params: {
        type: 'object',
        properties: {
          gameId: { type: 'string', description: 'Market game ID' },
        },
        required: ['gameId'],
      },
      response: {
        200: refreshResultSchema,
      },
    },
  }, async (req, _reply) => {
    return store.refreshOne(req.params.gameId);
  });
}
