/**
 * CNFL-3701 / CNFL-3702 — Module CRUD Routes with OpenAPI Schemas
 *
 * Registers RESTful CRUD endpoints for all module types:
 *   leaders, political-systems, military, technology, education,
 *   population, religion, scenarios, markets
 *
 * @module server/routes/modules
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ModuleStore } from '../services/module-store.js';
import type { ListOptions, StoreError } from '../services/module-store.js';

// ────────────────────────────────────────────────────────────
// Module type registry
// ────────────────────────────────────────────────────────────

const MODULE_TYPES = [
  'leaders',
  'political-systems',
  'military',
  'technology',
  'education',
  'population',
  'religion',
  'scenarios',
  'markets',
] as const;

type ModuleType = (typeof MODULE_TYPES)[number];

// Modules with sub-categories (military/ground, markets/exchanges, etc.)
const NESTED_TYPES = new Set<string>(['military', 'markets']);

// ────────────────────────────────────────────────────────────
// Shared JSON Schema fragments
// ────────────────────────────────────────────────────────────

const paginationQuerystring = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer' as const, minimum: 1, default: 1, description: 'Page number' },
    pageSize: { type: 'integer' as const, minimum: 1, maximum: 200, default: 50, description: 'Items per page' },
    search: { type: 'string' as const, description: 'Full-text search across all fields' },
    sortBy: { type: 'string' as const, default: 'name', description: 'Field to sort by' },
    sortDir: { type: 'string' as const, enum: ['asc', 'desc'], default: 'asc', description: 'Sort direction' },
    subcategory: { type: 'string' as const, description: 'Subcategory filter (military/markets only)' },
  },
};

const listResponse = {
  type: 'object' as const,
  properties: {
    items: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
    total: { type: 'integer' as const },
    page: { type: 'integer' as const },
    pageSize: { type: 'integer' as const },
    totalPages: { type: 'integer' as const },
  },
};

const moduleParams = {
  type: 'object' as const,
  properties: {
    moduleType: { type: 'string' as const, enum: [...MODULE_TYPES], description: 'Module type' },
  },
  required: ['moduleType'] as const,
};

const recordParams = {
  type: 'object' as const,
  properties: {
    moduleType: { type: 'string' as const, enum: [...MODULE_TYPES], description: 'Module type' },
    id: { type: 'string' as const, pattern: '^[a-z0-9][a-z0-9-]*$', description: 'Record ID (kebab-case)' },
  },
  required: ['moduleType', 'id'] as const,
};

const recordBody = {
  type: 'object' as const,
  additionalProperties: true,
  description: 'Record data object (varies by module type)',
};

const problemResponse = {
  type: 'object' as const,
  properties: {
    type: { type: 'string' as const },
    title: { type: 'string' as const },
    status: { type: 'integer' as const },
    detail: { type: 'string' as const },
    instance: { type: 'string' as const },
    correlationId: { type: 'string' as const },
  },
};

// ────────────────────────────────────────────────────────────
// Error helpers
// ────────────────────────────────────────────────────────────

function handleStoreError(error: unknown, reply: FastifyReply): FastifyReply {
  const storeErr = error as StoreError;
  switch (storeErr.code) {
    case 'NOT_FOUND':
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: storeErr.message });
    case 'ALREADY_EXISTS':
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: storeErr.message });
    case 'INVALID_INPUT':
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: storeErr.message });
    default:
      throw error;
  }
}

// ────────────────────────────────────────────────────────────
// Route registration
// ────────────────────────────────────────────────────────────

export function registerModuleRoutes(app: FastifyInstance, modelsDir: string): void {
  const store = new ModuleStore(modelsDir);
  const prefix = '/api/v1/modules';

  // ── GET /api/v1/modules — List all module types ──
  app.get(prefix, {
    schema: {
      tags: ['health'],
      summary: 'List available module types',
      response: {
        200: {
          type: 'object' as const,
          properties: {
            moduleTypes: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  name: { type: 'string' as const },
                  nested: { type: 'boolean' as const },
                  endpoint: { type: 'string' as const },
                },
              },
            },
          },
        },
      },
    },
  }, async () => ({
    moduleTypes: MODULE_TYPES.map((m) => ({
      name: m,
      nested: NESTED_TYPES.has(m),
      endpoint: `${prefix}/${m}`,
    })),
  }));

  // ── GET /api/v1/modules/:moduleType — List records in a module ──
  app.get<{
    Params: { moduleType: ModuleType };
    Querystring: ListOptions;
  }>(`${prefix}/:moduleType`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'List records in a module',
      params: moduleParams,
      querystring: paginationQuerystring,
      response: { 200: listResponse, 400: problemResponse },
    },
  }, async (req) => {
    const { moduleType } = req.params;
    return store.list(moduleType, req.query);
  });

  // ── GET /api/v1/modules/:moduleType/subcategories — List nested sub-directories ──
  app.get<{
    Params: { moduleType: ModuleType };
  }>(`${prefix}/:moduleType/subcategories`, {
    schema: {
      tags: ['military', 'markets'],
      summary: 'List subcategories for nested module types',
      params: moduleParams,
      response: {
        200: {
          type: 'object' as const,
          properties: {
            subcategories: { type: 'array' as const, items: { type: 'string' as const } },
          },
        },
      },
    },
  }, async (req) => {
    const { moduleType } = req.params;
    const subcategories = await store.listSubcategories(moduleType);
    return { subcategories };
  });

  // ── GET /api/v1/modules/:moduleType/manifest — Get manifest ──
  app.get<{
    Params: { moduleType: ModuleType };
    Querystring: { subcategory?: string };
  }>(`${prefix}/:moduleType/manifest`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Get the module manifest',
      params: moduleParams,
      querystring: {
        type: 'object' as const,
        properties: { subcategory: { type: 'string' as const } },
      },
      response: { 200: { type: 'object' as const, additionalProperties: true }, 404: problemResponse },
    },
  }, async (req, reply) => {
    const manifest = await store.getManifest(req.params.moduleType, req.query.subcategory);
    if (!manifest) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Manifest not found' });
    }
    return manifest;
  });

  // ── GET /api/v1/modules/:moduleType/:id — Get a single record ──
  app.get<{
    Params: { moduleType: ModuleType; id: string };
    Querystring: { subcategory?: string };
  }>(`${prefix}/:moduleType/:id`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Get a record by ID',
      params: recordParams,
      querystring: {
        type: 'object' as const,
        properties: { subcategory: { type: 'string' as const } },
      },
      response: {
        200: { type: 'object' as const, additionalProperties: true },
        404: problemResponse,
      },
    },
  }, async (req, reply) => {
    const record = await store.getById(req.params.moduleType, req.params.id, req.query.subcategory);
    if (!record) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Record '${req.params.id}' not found` });
    }
    return record;
  });

  // ── POST /api/v1/modules/:moduleType — Create a new record ──
  app.post<{
    Params: { moduleType: ModuleType };
    Body: { id: string; data: Record<string, unknown>; subcategory?: string };
  }>(`${prefix}/:moduleType`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Create a new record',
      params: moduleParams,
      body: {
        type: 'object' as const,
        required: ['id', 'data'] as const,
        properties: {
          id: { type: 'string' as const, pattern: '^[a-z0-9][a-z0-9-]*$', description: 'Record ID (kebab-case)' },
          data: recordBody,
          subcategory: { type: 'string' as const, description: 'Subcategory (military/markets only)' },
        },
      },
      response: { 201: { type: 'object' as const, additionalProperties: true }, 400: problemResponse, 409: problemResponse },
    },
  }, async (req: FastifyRequest<{ Params: { moduleType: ModuleType }; Body: { id: string; data: Record<string, unknown>; subcategory?: string } }>, reply: FastifyReply) => {
    try {
      const { id, data, subcategory } = req.body;
      const record = await store.create(req.params.moduleType, id, data, subcategory);
      return reply.status(201).send(record);
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── PUT /api/v1/modules/:moduleType/:id — Full replace ──
  app.put<{
    Params: { moduleType: ModuleType; id: string };
    Body: { data: Record<string, unknown>; subcategory?: string };
  }>(`${prefix}/:moduleType/:id`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Replace a record entirely',
      params: recordParams,
      body: {
        type: 'object' as const,
        required: ['data'] as const,
        properties: {
          data: recordBody,
          subcategory: { type: 'string' as const },
        },
      },
      response: { 200: { type: 'object' as const, additionalProperties: true }, 404: problemResponse },
    },
  }, async (req: FastifyRequest<{ Params: { moduleType: ModuleType; id: string }; Body: { data: Record<string, unknown>; subcategory?: string } }>, reply: FastifyReply) => {
    try {
      const record = await store.update(req.params.moduleType, req.params.id, req.body.data, req.body.subcategory);
      return record;
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── PATCH /api/v1/modules/:moduleType/:id — Partial update ──
  app.patch<{
    Params: { moduleType: ModuleType; id: string };
    Body: { data: Record<string, unknown>; subcategory?: string };
  }>(`${prefix}/:moduleType/:id`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Partially update a record (deep merge)',
      params: recordParams,
      body: {
        type: 'object' as const,
        required: ['data'] as const,
        properties: {
          data: recordBody,
          subcategory: { type: 'string' as const },
        },
      },
      response: { 200: { type: 'object' as const, additionalProperties: true }, 404: problemResponse },
    },
  }, async (req: FastifyRequest<{ Params: { moduleType: ModuleType; id: string }; Body: { data: Record<string, unknown>; subcategory?: string } }>, reply: FastifyReply) => {
    try {
      const record = await store.patch(req.params.moduleType, req.params.id, req.body.data, req.body.subcategory);
      return record;
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });

  // ── DELETE /api/v1/modules/:moduleType/:id — Soft delete ──
  app.delete<{
    Params: { moduleType: ModuleType; id: string };
    Querystring: { subcategory?: string };
  }>(`${prefix}/:moduleType/:id`, {
    schema: {
      tags: ['leaders', 'political-systems', 'military', 'technology', 'education', 'population', 'religion', 'scenarios', 'markets'],
      summary: 'Soft-delete a record (moves to .backups/)',
      params: recordParams,
      querystring: {
        type: 'object' as const,
        properties: { subcategory: { type: 'string' as const } },
      },
      response: {
        204: { type: 'null' as const, description: 'Record deleted' },
        404: problemResponse,
      },
    },
  }, async (req: FastifyRequest<{ Params: { moduleType: ModuleType; id: string }; Querystring: { subcategory?: string } }>, reply: FastifyReply) => {
    try {
      await store.remove(req.params.moduleType, req.params.id, req.query.subcategory);
      return reply.status(204).send();
    } catch (err) {
      return handleStoreError(err, reply);
    }
  });
}
