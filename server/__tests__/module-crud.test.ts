/**
 * CNFL-3701 — Module CRUD Endpoint Tests
 *
 * Tests for listing, reading, creating, updating, patching,
 * and deleting module records via the REST API.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';
import { resolve } from 'node:path';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('Module CRUD Routes', () => {
  let app: FastifyInstance;
  let tempModelsDir: string;

  beforeAll(async () => {
    // Copy models to temp dir so tests don't mutate real data
    tempModelsDir = await mkdtemp(resolve(tmpdir(), 'neworder-test-'));
    await cp(resolve(__dirname, '..', '..', 'models'), tempModelsDir, { recursive: true });

    app = await buildServer({ modelsDir: tempModelsDir, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(tempModelsDir, { recursive: true, force: true });
  });

  // ── List leaders ──

  describe('GET /api/v1/modules/leaders', () => {
    it('returns paginated leaders list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/leaders' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThan(0);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(50);
      expect(body.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('supports search filtering', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/modules/leaders?search=putin',
      });
      const body = res.json();
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items.some((i: { leaderId: string }) => i.leaderId === 'vladimir-putin')).toBe(true);
    });

    it('supports pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/modules/leaders?page=1&pageSize=2',
      });
      const body = res.json();
      expect(body.items.length).toBeLessThanOrEqual(2);
      expect(body.pageSize).toBe(2);
    });
  });

  // ── Get by ID ──

  describe('GET /api/v1/modules/leaders/:id', () => {
    it('returns a leader by ID', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/leaders/xi-jinping' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.leaderId).toBe('xi-jinping');
      expect(body.name).toBe('Xi Jinping');
      expect(body.schemaVersion).toBe('1.0.0');
    });

    it('returns 404 for nonexistent leader', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/leaders/nonexistent-person' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Nested module (military) ──

  describe('Nested modules — military', () => {
    it('lists subcategories', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/military/subcategories' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.subcategories).toBeInstanceOf(Array);
      expect(body.subcategories).toContain('ground');
      expect(body.subcategories).toContain('air');
      expect(body.subcategories).toContain('sea');
    });

    it('lists all military records across subcategories', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/military' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
      // Should have items from various subcategories
      const subcategories = new Set(body.items.map((i: { _subcategory: string }) => i._subcategory));
      expect(subcategories.size).toBeGreaterThan(1);
    });

    it('filters by subcategory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/modules/military?subcategory=ground',
      });
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
      body.items.forEach((i: { _subcategory: string }) => {
        expect(i._subcategory).toBe('ground');
      });
    });

    it('gets a specific military record', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/military/m1a2-abrams' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.equipmentId).toBe('m1a2-abrams');
      expect(body._subcategory).toBe('ground');
    });

    it('gets manifest for subcategory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/modules/military/manifest?subcategory=ground',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.collection).toContain('ground');
      expect(body.files).toBeInstanceOf(Array);
    });
  });

  // ── Technology ──

  describe('Technology module', () => {
    it('lists technology records', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/technology' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(20);
    });

    it('gets technology manifest', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/technology/manifest' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.collection).toBe('technology');
      expect(body.count).toBeGreaterThan(0);
    });
  });

  // ── Create / Update / Patch / Delete ──

  describe('CRUD operations', () => {
    const testId = 'test-leader-crud';

    it('creates a new leader record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/modules/leaders',
        payload: {
          id: testId,
          data: {
            leaderId: testId,
            name: 'Test Leader',
            title: 'President of Testing',
            factionId: 'test-faction',
            mbtiType: 'ENTJ',
          },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.leaderId).toBe(testId);
      expect(body.schemaVersion).toBe('1.0.0');
    });

    it('returns 409 on duplicate creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/modules/leaders',
        payload: {
          id: testId,
          data: { leaderId: testId, name: 'Duplicate' },
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('reads the created record', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/modules/leaders/${testId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Test Leader');
    });

    it('fully replaces a record with PUT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/modules/leaders/${testId}`,
        payload: {
          data: {
            leaderId: testId,
            name: 'Updated Leader',
            title: 'Prime Minister of Testing',
            factionId: 'test-faction-v2',
          },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Updated Leader');
      expect(res.json().mbtiType).toBeUndefined(); // Full replace should not keep old fields
    });

    it('partially updates a record with PATCH', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/modules/leaders/${testId}`,
        payload: {
          data: {
            title: 'Chancellor of Testing',
            mbtiType: 'INFP',
          },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.title).toBe('Chancellor of Testing');
      expect(body.mbtiType).toBe('INFP');
      expect(body.name).toBe('Updated Leader'); // Preserved from PUT
    });

    it('soft-deletes a record', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/modules/leaders/${testId}`,
      });
      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({ method: 'GET', url: `/api/v1/modules/leaders/${testId}` });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 when deleting nonexistent record', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/modules/leaders/does-not-exist',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Create in nested module ──

  describe('CRUD in nested modules', () => {
    const testId = 'test-tank-crud';

    it('creates a record in a military subcategory', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/modules/military',
        payload: {
          id: testId,
          subcategory: 'ground',
          data: {
            equipmentId: testId,
            name: 'Test Tank',
            category: 'ground',
            subcategory: 'mbt',
            attackPower: 50,
            defensePower: 60,
          },
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('reads the nested record', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/modules/military/${testId}?subcategory=ground`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Test Tank');
    });

    it('finds nested record without subcategory hint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/modules/military/${testId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().equipmentId).toBe(testId);
    });

    it('deletes nested record', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/modules/military/${testId}?subcategory=ground`,
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── Markets nested module ──

  describe('Markets module', () => {
    it('lists market subcategories', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/markets/subcategories' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.subcategories).toContain('exchanges');
      expect(body.subcategories).toContain('indexes');
      expect(body.subcategories).toContain('tickers');
    });

    it('filters markets by subcategory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/modules/markets?subcategory=exchanges',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ──

  describe('Edge cases', () => {
    it('handles empty module type gracefully', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/scenarios' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('returns non-nested subcategories as empty array', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/leaders/subcategories' });
      expect(res.statusCode).toBe(200);
      expect(res.json().subcategories).toEqual([]);
    });

    it('validates module type param (rejects invalid)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/invalid-type' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Population module ──

  describe('Population module', () => {
    it('lists population records', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/population' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
    });
  });

  // ── Education module ──

  describe('Education module', () => {
    it('lists education records', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/education' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
    });
  });

  // ── Religion module ──

  describe('Religion module', () => {
    it('lists religion records', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/religion' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
    });
  });

  // ── Political systems ──

  describe('Political systems module', () => {
    it('lists political system records', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/modules/political-systems' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
    });
  });
});
