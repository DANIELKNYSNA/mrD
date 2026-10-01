import { Router } from 'express';
import { healthRoutes } from './healthRoutes.js';
import { metricsRoutes } from './metricsRoutes.js';
import { searchRoutes } from './searchRoutes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/metrics', metricsRoutes);
apiRouter.use('/', searchRoutes);
