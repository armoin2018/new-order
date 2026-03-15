/**
 * CNFL-3704 — Scenario Execution Routes
 *
 * Provides endpoints for creating, listing, and managing scenarios,
 * plus asynchronous scenario execution with job status tracking.
 *
 * @module server/routes/scenarios
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ModuleStore } from '../services/module-store.js';
import type { ModuleRecord, StoreError } from '../services/module-store.js';
import { v4 as uuidv4 } from 'uuid';

// ────────────────────────────────────────────────────────────
// Job types
// ────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionJob {
  jobId: string;
  scenarioId: string;
  status: JobStatus;
  progress: number;          // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ModuleRecord;
  error?: string;
  turns: number;
  currentTurn: number;
}

// In-memory job store (production would use a proper queue)
const jobs = new Map<string, ExecutionJob>();

// ────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────

const scenarioParams = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, pattern: '^[a-z0-9][a-z0-9-]*$', description: 'Scenario ID' },
  },
  required: ['id'] as const,
};

const jobParams = {
  type: 'object' as const,
  properties: {
    jobId: { type: 'string' as const, format: 'uuid', description: 'Job ID' },
  },
  required: ['jobId'] as const,
};

const executeBody = {
  type: 'object' as const,
  required: ['turns'] as const,
  properties: {
    turns: { type: 'integer' as const, minimum: 1, maximum: 100, description: 'Number of turns to execute' },
    options: {
      type: 'object' as const,
      properties: {
        speed: { type: 'string' as const, enum: ['slow', 'normal', 'fast'], default: 'normal' },
        autoResolveConflicts: { type: 'boolean' as const, default: false },
        enableAI: { type: 'boolean' as const, default: true },
      },
      additionalProperties: true,
    },
  },
};

const jobResponse = {
  type: 'object' as const,
  properties: {
    jobId: { type: 'string' as const },
    scenarioId: { type: 'string' as const },
    status: { type: 'string' as const, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
    progress: { type: 'number' as const },
    createdAt: { type: 'string' as const },
    startedAt: { type: 'string' as const },
    completedAt: { type: 'string' as const },
    turns: { type: 'integer' as const },
    currentTurn: { type: 'integer' as const },
    error: { type: 'string' as const },
  },
};

const problemResponse = {
  type: 'object' as const,
  properties: {
    type: { type: 'string' as const },
    title: { type: 'string' as const },
    status: { type: 'integer' as const },
    detail: { type: 'string' as const },
  },
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function handleStoreError(error: unknown, reply: FastifyReply): FastifyReply {
  const storeErr = error as StoreError;
  switch (storeErr.code) {
    case 'NOT_FOUND':
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: storeErr.message });
    case 'ALREADY_EXISTS':
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: storeErr.message });
    default:
      throw error;
  }
}

/** Simulate scenario execution (placeholder until full engine integration). */
function simulateExecution(job: ExecutionJob): void {
  job.status = 'running';
  job.startedAt = new Date().toISOString();

  const tickInterval = 50; // ms per turn simulation
  const tick = () => {
    if (job.status === 'cancelled') return;

    job.currentTurn++;
    job.progress = Math.round((job.currentTurn / job.turns) * 100);

    if (job.currentTurn >= job.turns) {
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = {
        turnsCompleted: job.turns,
        summary: `Scenario ${job.scenarioId} executed ${job.turns} turns successfully`,
        timestamp: job.completedAt,
      };
      return;
    }

    setTimeout(tick, tickInterval);
  };

  setTimeout(tick, tickInterval);
}

// ────────────────────────────────────────────────────────────
// Route registration
// ────────────────────────────────────────────────────────────

export function registerScenarioRoutes(app: FastifyInstance, modelsDir: string): void {
  const store = new ModuleStore(modelsDir);
  const prefix = '/api/v1/scenarios';
  const jobsPrefix = '/api/v1/jobs';

  // ── GET /api/v1/scenarios — List scenarios ──
  app.get(prefix, {
    schema: {
      tags: ['scenarios'],
      summary: 'List all scenarios',
      querystring: {
        type: 'object' as const,
        properties: {
          page: { type: 'integer' as const, minimum: 1, default: 1 },
          pageSize: { type: 'integer' as const, minimum: 1, maximum: 200, default: 50 },
          search: { type: 'string' as const },
        },
      },
      response: {
        200: {
          type: 'object' as const,
          properties: {
            items: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
            total: { type: 'integer' as const },
            page: { type: 'integer' as const },
            pageSize: { type: 'integer' as const },
            totalPages: { type: 'integer' as const },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { page?: number; pageSize?: number; search?: string } }>) => {
    return store.list('scenarios', req.query);
  });

  // ── GET /api/v1/scenarios/:id — Get a scenario ──
  app.get<{ Params: { id: string } }>(`${prefix}/:id`, {
    schema: {
      tags: ['scenarios'],
      summary: 'Get scenario details',
      params: scenarioParams,
      response: {
        200: { type: 'object' as const, additionalProperties: true },
        404: problemResponse,
      },
    },
  }, async (req, reply) => {
    const record = await store.getById('scenarios', req.params.id);
    if (!record) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Scenario '${req.params.id}' not found` });
    }
    return record;
  });

  // ── POST /api/v1/scenarios — Create a scenario ──
  app.post<{
    Body: { id: string; data: Record<string, unknown> };
  }>(prefix, {
    schema: {
      tags: ['scenarios'],
      summary: 'Create a new scenario',
      body: {
        type: 'object' as const,
        required: ['id', 'data'] as const,
        properties: {
          id: { type: 'string' as const, pattern: '^[a-z0-9][a-z0-9-]*$' },
          data: { type: 'object' as const, additionalProperties: true },
        },
      },
      response: {
        201: { type: 'object' as const, additionalProperties: true },
        409: problemResponse,
      },
    },
  }, async (req, reply) => {
    try {
      const record = await store.create('scenarios', req.body.id, req.body.data);
      return reply.status(201).send(record);
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── PUT /api/v1/scenarios/:id — Replace a scenario ──
  app.put<{
    Params: { id: string };
    Body: { data: Record<string, unknown> };
  }>(`${prefix}/:id`, {
    schema: {
      tags: ['scenarios'],
      summary: 'Replace a scenario',
      params: scenarioParams,
      body: {
        type: 'object' as const,
        required: ['data'] as const,
        properties: { data: { type: 'object' as const, additionalProperties: true } },
      },
      response: { 200: { type: 'object' as const, additionalProperties: true }, 404: problemResponse },
    },
  }, async (req, reply) => {
    try {
      return await store.update('scenarios', req.params.id, req.body.data);
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── DELETE /api/v1/scenarios/:id — Soft delete ──
  app.delete<{ Params: { id: string } }>(`${prefix}/:id`, {
    schema: {
      tags: ['scenarios'],
      summary: 'Soft-delete a scenario',
      params: scenarioParams,
      response: { 204: { type: 'null' as const }, 404: problemResponse },
    },
  }, async (req, reply) => {
    try {
      await store.remove('scenarios', req.params.id);
      return reply.status(204).send();
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── POST /api/v1/scenarios/:id/execute — Launch execution job ──
  app.post<{
    Params: { id: string };
    Body: { turns: number; options?: Record<string, unknown> };
  }>(`${prefix}/:id/execute`, {
    schema: {
      tags: ['jobs'],
      summary: 'Execute a scenario simulation',
      description: 'Creates an asynchronous execution job. Poll GET /api/v1/jobs/:jobId for status.',
      params: scenarioParams,
      body: executeBody,
      response: {
        202: jobResponse,
        404: problemResponse,
      },
    },
  }, async (req, reply) => {
    const scenario = await store.getById('scenarios', req.params.id);
    if (!scenario) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Scenario '${req.params.id}' not found` });
    }

    const job: ExecutionJob = {
      jobId: uuidv4(),
      scenarioId: req.params.id,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      turns: req.body.turns,
      currentTurn: 0,
    };

    jobs.set(job.jobId, job);

    // Kick off async execution
    simulateExecution(job);

    return reply.status(202).send(job);
  });

  // ── GET /api/v1/jobs — List all jobs ──
  app.get(jobsPrefix, {
    schema: {
      tags: ['jobs'],
      summary: 'List all execution jobs',
      querystring: {
        type: 'object' as const,
        properties: {
          status: { type: 'string' as const, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
          scenarioId: { type: 'string' as const },
        },
      },
      response: {
        200: {
          type: 'object' as const,
          properties: {
            jobs: { type: 'array' as const, items: jobResponse },
            total: { type: 'integer' as const },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Querystring: { status?: JobStatus; scenarioId?: string } }>) => {
    let list = [...jobs.values()];

    if (req.query.status) {
      list = list.filter((j) => j.status === req.query.status);
    }
    if (req.query.scenarioId) {
      list = list.filter((j) => j.scenarioId === req.query.scenarioId);
    }

    // Sort newest first
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { jobs: list, total: list.length };
  });

  // ── GET /api/v1/jobs/:jobId — Get job status ──
  app.get<{ Params: { jobId: string } }>(`${jobsPrefix}/:jobId`, {
    schema: {
      tags: ['jobs'],
      summary: 'Get execution job status',
      params: jobParams,
      response: { 200: jobResponse, 404: problemResponse },
    },
  }, async (req, reply) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Job '${req.params.jobId}' not found` });
    }
    return job;
  });

  // ── POST /api/v1/jobs/:jobId/cancel — Cancel a running job ──
  app.post<{ Params: { jobId: string } }>(`${jobsPrefix}/:jobId/cancel`, {
    schema: {
      tags: ['jobs'],
      summary: 'Cancel a running execution job',
      params: jobParams,
      response: { 200: jobResponse, 404: problemResponse, 409: problemResponse },
    },
  }, async (req, reply) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Job '${req.params.jobId}' not found` });
    }
    if (job.status !== 'pending' && job.status !== 'running') {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: `Job is already ${job.status}` });
    }
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    return job;
  });
}

// ── Test helper — access the in-memory jobs for testing ──
export function _getJobsMap(): Map<string, ExecutionJob> {
  return jobs;
}
