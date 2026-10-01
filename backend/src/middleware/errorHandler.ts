import type { NextFunction, Request, Response } from 'express';
import type { IApiError } from '../interfaces/IApiError.js';
import { AppError } from '../utils/AppError.js';

// Express identifies error middleware by its 4-argument signature, so `_next` must stay.
export function errorHandler(err: unknown, _req: Request, res: Response<IApiError>, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
