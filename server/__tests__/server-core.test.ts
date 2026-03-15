/**
 * CNFL-3700 / 3705 — Server Core Tests
 *
 * Tests for server bootstrapping, health endpoint,
 * correlation-id middleware, error handling, and 404s.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';
import { resolve } from 'node:path';

const MODELS_DIR = resolve(__dirname, '..', '..', 'models');

describe('Server Core', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ modelsDir: MODELS_DIR, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Health ──

  describe('GET /api/v1/health', () => {
    it('returns 200 with health payload', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(body.version).toBe('1.0.0');
    });
  });

  // ── Correlation ID ──

  describe('Correlation-ID middleware', () => {
    it('generates a correlation ID if none provided', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
      const correlationId = res.headers['x-correlation-id'];
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      // UUID v4 pattern
      expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('echoes back a provided correlation ID', async () => {
      const id = 'test-correlation-12345';
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { 'x-correlation-id': id },
      });
      expect(res.headers['x-correlation-id']).toBe(id);
    });
  });

  // ── 404 handling ──

  describe('Not Found handler', () => {
    it('returns RFC 7807 problem for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.title).toBe('Not Found');
      expect(body.status).toBe(404);
      expect(body.detail).toContain('not found');
    });
  });

  // ── Module types listing ──

  describe('GET /api/v1/modules', () => {
    it('returns all available module types', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.moduleTypes).toBeInstanceOf(Array);
      expect(body.moduleTypes.length).toBe(9);

      const names = body.moduleTypes.map((m: { name: string }) => m.name);
      expect(names).toContain('leaders');
      expect(names).toContain('military');
      expect(names).toContain('technology');
      expect(names).toContain('scenarios');
      expect(names).toContain('markets');
    });

    it('marks nested modules correctly', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules' });
      const body = res.json();
      const military = body.moduleTypes.find((m: { name: string }) => m.name === 'military');
      const leaders = body.moduleTypes.find((m: { name: string }) => m.name === 'leaders');
      expect(military.nested).toBe(true);
      expect(leaders.nested).toBe(false);
    });
  });

  // ── OpenAPI / Swagger ──

  describe('OpenAPI spec', () => {
    it('serves JSON spec at /api/docs/json', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      expect(res.statusCode).toBe(200);
      const spec = res.json();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('New Order API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.paths).toBeDefined();
    });

    it('contains expected tags', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      const spec = res.json();
      const tagNames = spec.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('health');
      expect(tagNames).toContain('leaders');
      expect(tagNames).toContain('scenarios');
      expect(tagNames).toContain('jobs');
    });

    it('includes health endpoint path', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      const spec = res.json();
      expect(spec.paths['/api/v1/health']).toBeDefined();
      expect(spec.paths['/api/v1/health'].get).toBeDefined();
    });

    it('includes module CRUD paths', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      const spec = res.json();
      expect(spec.paths['/api/v1/modules']).toBeDefined();
      expect(spec.paths['/api/v1/modules/{moduleType}']).toBeDefined();
      expect(spec.paths['/api/v1/modules/{moduleType}/{id}']).toBeDefined();
    });
  });
});
