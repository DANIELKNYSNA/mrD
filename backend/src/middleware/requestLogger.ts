import type { NextFunction, Request, Response } from 'express';
import { metrics } from '../services/metricsService.js';
import { config } from '../utils/config.js';

/** Counts every request for /api/metrics and logs method, path, status and duration (not in tests). */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const started = performance.now();
  res.on('finish', () => {
    metrics.recordRequest(res.statusCode);
    if (config.nodeEnv === 'test') return;
    const ms = (performance.now() - started).toFixed(1);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}
