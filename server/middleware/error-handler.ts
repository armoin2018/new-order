/**
 * CNFL-3705 — RFC 7807 Error Handler
 *
 * Standardised error responses following RFC 7807 Problem Details format.
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  correlationId?: string;
  errors?: Array<{ field: string; message: string }>;
}

function buildProblem(
  req: FastifyRequest,
  status: number,
  title: string,
  detail: string,
  errors?: ProblemDetail['errors'],
): ProblemDetail {
  return {
    type: `https://neworder.app/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    instance: req.url,
    correlationId: (req.headers['x-correlation-id'] as string) ?? undefined,
    ...(errors ? { errors } : {}),
  };
}

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const status = error.statusCode ?? 500;

  // Validation errors from Fastify schema validation
  if (error.validation) {
    const validationErrors = error.validation.map((v) => ({
      field: String(v.instancePath || v.params?.['missingProperty'] || 'unknown'),
      message: v.message ?? 'Validation error',
    }));
    const problem = buildProblem(req, 400, 'Validation Error', 'Request validation failed', validationErrors);
    return reply.status(400).header('content-type', 'application/problem+json').send(problem);
  }

  // Rate limit errors
  if (status === 429) {
    const problem = buildProblem(req, 429, 'Rate Limit Exceeded', 'Too many requests. Please try again later.');
    return reply.status(429).header('content-type', 'application/problem+json').send(problem);
  }

  // Application errors
  if (status >= 400 && status < 500) {
    const problem = buildProblem(req, status, error.name || 'Client Error', error.message);
    return reply.status(status).header('content-type', 'application/problem+json').send(problem);
  }

  // Server errors
  req.log.error(error);
  const problem = buildProblem(req, 500, 'Internal Server Error', 'An unexpected error occurred');
  return reply.status(500).header('content-type', 'application/problem+json').send(problem);
}

export function notFoundHandler(req: FastifyRequest, reply: FastifyReply) {
  const problem = buildProblem(req, 404, 'Not Found', `Route ${req.method} ${req.url} not found`);
  return reply.status(404).header('content-type', 'application/problem+json').send(problem);
}
