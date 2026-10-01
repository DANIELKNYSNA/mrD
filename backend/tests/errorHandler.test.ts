import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';

/** Minimal stand-in for Express's Response that records status and body. */
function fakeResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

const handle = (err: unknown) => {
  const res = fakeResponse();
  errorHandler(err, {} as Request, res as unknown as Response, (() => {}) as NextFunction);
  return res;
};

describe('errorHandler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps an AppError to its status and envelope', () => {
    const res = handle(AppError.badRequest('Bad thing', { field: 'q' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Bad thing', details: { field: 'q' } } });
  });

  it('turns unexpected errors into a generic 500 without leaking internals', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = handle(new Error('db password is hunter2'));

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(log).toHaveBeenCalledOnce(); // still logged server-side
  });

  it('handles non-Error throwables', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(handle('just a string').statusCode).toBe(500);
  });
});
