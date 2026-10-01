import { Router } from 'express';
import { getMetrics } from '../controllers/metricsController.js';

export const metricsRoutes = Router();

metricsRoutes.get('/', getMetrics);
