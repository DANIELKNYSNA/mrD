import type { Request, Response } from 'express';
import { metrics } from '../services/metricsService.js';

export function getMetrics(_req: Request, res: Response): void {
  res.set('Cache-Control', 'no-store');
  res.json(metrics.snapshot());
}
