/**
 * Prometheus metrics for Suban API.
 *
 * Names are prefixed with `suban_api_` so the platform dashboard can combine
 * this service with the controller, indexer and relayer without collisions.
 */
import client from 'prom-client';
import { NextFunction, Request, Response } from 'express';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'suban_api_' });

export const httpRequests = new client.Counter({
  name: 'suban_api_http_requests_total',
  help: 'HTTP requests by method, normalized route and status',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

export const httpDuration = new client.Histogram({
  name: 'suban_api_http_request_duration_seconds',
  help: 'HTTP request duration by method, normalized route and status',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const cacheEvents = new client.Counter({
  name: 'suban_api_cache_events_total',
  help: 'Cache hits, misses and writes',
  labelNames: ['result'],
  registers: [registry],
});

export const horizonRequests = new client.Counter({
  name: 'suban_api_horizon_requests_total',
  help: 'Upstream Horizon requests by method and status',
  labelNames: ['method', 'status'],
  registers: [registry],
});

export const horizonDuration = new client.Histogram({
  name: 'suban_api_horizon_request_duration_seconds',
  help: 'Upstream Horizon request duration',
  labelNames: ['method', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Keep label cardinality bounded: proxy prefixes collapse to a single bucket,
 * and long ids/addresses/hashes collapse to `:id`.
 */
export function normalizeRoute(path: string): string {
  if (path.startsWith('/horizon')) return '/horizon/*';
  if (path.startsWith('/arc')) return '/arc/*';
  return path.replace(/\/[A-Za-z0-9:_-]{16,}/g, '/:id');
}

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Don't measure scrapes themselves.
  if (req.path === '/metrics') {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  const route = normalizeRoute(req.path);

  res.on('finish', () => {
    const status = String(res.statusCode);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequests.inc({ method: req.method, route, status });
    httpDuration.observe({ method: req.method, route, status }, seconds);
  });

  next();
}

export async function metricsHandler(
  _req: Request,
  res: Response
): Promise<void> {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
