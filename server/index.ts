/**
 * CNFL-3700 — Fastify Server Entry Point
 *
 * API server providing CRUD endpoints for all module types,
 * OpenAPI 3.1 spec generation, and Swagger UI.
 *
 * @module server/index
 */

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyRateLimit from '@fastify/rate-limit';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { correlationId } from './middleware/correlation-id.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerScenarioRoutes } from './routes/scenarios.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export interface ServerOptions {
  port?: number;
  host?: string;
  modelsDir?: string;
  distDir?: string;
  logger?: boolean;
}

export async function buildServer(opts: ServerOptions = {}) {
  const {
    port: _port,
    host: _host,
    modelsDir = resolve(ROOT, 'models'),
    distDir = resolve(ROOT, 'dist'),
    logger = true,
  } = opts;

  const app = Fastify({
    logger: logger ? {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    } : false,
  });

  // ── Correlation ID ──
  correlationId(app);

  // ── Rate Limiting ──
  await app.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true, 'retry-after': true },
  });

  // ── CORS ──
  await app.register(fastifyCors, {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    credentials: true,
  });

  // ── OpenAPI / Swagger ──
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'New Order API',
        description: 'API for the New Order geopolitical simulation — manage leaders, scenarios, military equipment, technology, and more.',
        version: '1.0.0',
        contact: { name: 'New Order Team' },
        license: { name: 'MIT' },
      },
      servers: [{ url: 'http://localhost:3000', description: 'Development' }],
      tags: [
        { name: 'health', description: 'Server health' },
        { name: 'leaders', description: 'Leader profiles' },
        { name: 'political-systems', description: 'Political system definitions' },
        { name: 'military', description: 'Military equipment catalog' },
        { name: 'technology', description: 'Technology modules' },
        { name: 'education', description: 'Education programs' },
        { name: 'population', description: 'Population demographics' },
        { name: 'religion', description: 'Religious profiles' },
        { name: 'scenarios', description: 'Game scenarios' },
        { name: 'markets', description: 'Financial market data' },
        { name: 'jobs', description: 'Scenario execution jobs' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 2,
    },
    staticCSP: true,
  });

  // ── Static serving (production build) ──
  await app.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
    decorateReply: true,
    wildcard: false,
  });

  // ── Error handling ──
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // ── Health endpoint ──
  app.get('/api/v1/health', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  }));

  // ── Module CRUD routes ──
  registerModuleRoutes(app, modelsDir);

  // ── Scenario execution routes ──
  registerScenarioRoutes(app, modelsDir);

  return app;
}

// ── CLI entry ──
async function main() {
  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  const host = process.env['HOST'] ?? '0.0.0.0';
  const app = await buildServer({ port, host });
  try {
    await app.listen({ port, host });
    app.log.info(`Server ready at http://localhost:${port}`);
    app.log.info(`Swagger UI: http://localhost:${port}/api/docs`);
    app.log.info(`OpenAPI spec: http://localhost:${port}/api/docs/json`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests)
const isMainModule = process.argv[1]?.endsWith('/server/index.ts') ||
                     process.argv[1]?.endsWith('/server/index.js');
if (isMainModule) {
  main();
}
