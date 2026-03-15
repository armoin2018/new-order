/**
 * Correlation ID middleware — attaches X-Correlation-ID to every request/response.
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export function correlationId(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    const id = (req.headers['x-correlation-id'] as string) ?? uuidv4();
    req.headers['x-correlation-id'] = id;
    void reply.header('x-correlation-id', id);
  });
}
