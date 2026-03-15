/**
 * CNFL-3704 — Scenario & Job Execution Tests
 *
 * Tests for scenario CRUD, execution jobs, and job management.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';
import { resolve } from 'node:path';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { _getJobsMap } from '../routes/scenarios.js';

describe('Scenario & Job Routes', () => {
  let app: FastifyInstance;
  let tempModelsDir: string;

  beforeAll(async () => {
    tempModelsDir = await mkdtemp(resolve(tmpdir(), 'neworder-scenario-test-'));
    await cp(resolve(__dirname, '..', '..', 'models'), tempModelsDir, { recursive: true });

    app = await buildServer({ modelsDir: tempModelsDir, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(tempModelsDir, { recursive: true, force: true });
  });

  afterEach(() => {
    // Clear in-memory jobs between tests
    _getJobsMap().clear();
  });

  // ── Scenario CRUD ──

  describe('Scenario CRUD', () => {
    const scenarioId = 'test-scenario-1';

    it('creates a scenario', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: {
          id: scenarioId,
          data: {
            scenarioId,
            name: 'Test Scenario',
            description: 'A test scenario for unit testing',
            factions: ['us', 'china'],
            startYear: 2025,
            maxTurns: 50,
          },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.scenarioId).toBe(scenarioId);
      expect(body.name).toBe('Test Scenario');
    });

    it('lists scenarios', async () => {
      // Create scenario first
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: {
          id: 'list-test-scenario',
          data: { scenarioId: 'list-test-scenario', name: 'List Test' },
        },
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/scenarios' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('gets a scenario by ID', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'get-test', data: { scenarioId: 'get-test', name: 'Get Test' } },
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/scenarios/get-test' });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Get Test');
    });

    it('returns 404 for nonexistent scenario', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/scenarios/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('replaces a scenario with PUT', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'put-test', data: { scenarioId: 'put-test', name: 'Before', maxTurns: 10 } },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/scenarios/put-test',
        payload: { data: { scenarioId: 'put-test', name: 'After' } },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('After');
      expect(res.json().maxTurns).toBeUndefined();
    });

    it('soft-deletes a scenario', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'delete-test', data: { scenarioId: 'delete-test', name: 'Delete Me' } },
      });

      const deleteRes = await app.inject({ method: 'DELETE', url: '/api/v1/scenarios/delete-test' });
      expect(deleteRes.statusCode).toBe(204);

      const getRes = await app.inject({ method: 'GET', url: '/api/v1/scenarios/delete-test' });
      expect(getRes.statusCode).toBe(404);
    });
  });

  // ── Execution Jobs ──

  describe('Execution Jobs', () => {
    it('returns 404 when executing a nonexistent scenario', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/nonexistent/execute',
        payload: { turns: 5 },
      });
      expect(res.statusCode).toBe(404);
    });

    it('creates an execution job for a valid scenario', async () => {
      // Create scenario first
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'exec-test', data: { scenarioId: 'exec-test', name: 'Exec Test' } },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/exec-test/execute',
        payload: { turns: 10 },
      });
      expect(res.statusCode).toBe(202);
      const job = res.json();
      expect(job.jobId).toBeDefined();
      expect(job.scenarioId).toBe('exec-test');
      expect(job.status).toMatch(/pending|running/);
      expect(job.turns).toBe(10);
      expect(job.currentTurn).toBe(0);
    });

    it('lists all jobs', async () => {
      // Create scenario and execute
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'jobs-list-test', data: { scenarioId: 'jobs-list-test', name: 'Jobs List' } },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/jobs-list-test/execute',
        payload: { turns: 3 },
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/jobs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.jobs).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('gets a specific job by ID', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'job-get-test', data: { scenarioId: 'job-get-test', name: 'Job Get' } },
      });
      const execRes = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/job-get-test/execute',
        payload: { turns: 2 },
      });
      const jobId = execRes.json().jobId;

      const res = await app.inject({ method: 'GET', url: `/api/v1/jobs/${jobId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().jobId).toBe(jobId);
    });

    it('returns 404 for nonexistent job', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/jobs/00000000-0000-4000-8000-000000000000' });
      expect(res.statusCode).toBe(404);
    });

    it('cancels a running job', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'cancel-test', data: { scenarioId: 'cancel-test', name: 'Cancel Test' } },
      });
      const execRes = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/cancel-test/execute',
        payload: { turns: 100 }, // Long enough not to complete
      });
      const jobId = execRes.json().jobId;

      const cancelRes = await app.inject({ method: 'POST', url: `/api/v1/jobs/${jobId}/cancel` });
      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.json().status).toBe('cancelled');
      expect(cancelRes.json().completedAt).toBeDefined();
    });

    it('returns 409 when cancelling a completed job', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'cancel-done', data: { scenarioId: 'cancel-done', name: 'Done Test' } },
      });
      const execRes = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/cancel-done/execute',
        payload: { turns: 1 },
      });
      const jobId = execRes.json().jobId;

      // Wait for it to complete (1 turn = 50ms)
      await new Promise((r) => setTimeout(r, 200));

      const cancelRes = await app.inject({ method: 'POST', url: `/api/v1/jobs/${jobId}/cancel` });
      expect(cancelRes.statusCode).toBe(409);
    });

    it('filters jobs by status', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'filter-test', data: { scenarioId: 'filter-test', name: 'Filter Test' } },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/filter-test/execute',
        payload: { turns: 1 },
      });

      // Wait for completion
      await new Promise((r) => setTimeout(r, 200));

      const res = await app.inject({ method: 'GET', url: '/api/v1/jobs?status=completed' });
      expect(res.statusCode).toBe(200);
      res.json().jobs.forEach((j: { status: string }) => {
        expect(j.status).toBe('completed');
      });
    });

    it('filters jobs by scenario ID', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'filter-scenario', data: { scenarioId: 'filter-scenario', name: 'Filter Scenario' } },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/filter-scenario/execute',
        payload: { turns: 1 },
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/jobs?scenarioId=filter-scenario' });
      expect(res.statusCode).toBe(200);
      expect(res.json().total).toBeGreaterThanOrEqual(1);
      res.json().jobs.forEach((j: { scenarioId: string }) => {
        expect(j.scenarioId).toBe('filter-scenario');
      });
    });
  });

  // ── Validation ──

  describe('Request Validation', () => {
    it('rejects scenario execution with zero turns', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { id: 'validate-test', data: { scenarioId: 'validate-test', name: 'Validate' } },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/validate-test/execute',
        payload: { turns: 0 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects scenario execution with excessive turns', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios/validate-test/execute',
        payload: { turns: 999 },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects POST scenario without required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/scenarios',
        payload: { data: { name: 'Missing ID' } },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
