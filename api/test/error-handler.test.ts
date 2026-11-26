import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createErrorHandler } from '../src/middleware/error-handler.js';

describe('API error handler', () => {
  it('returns Zod validation issues as a 422 error envelope', async () => {
    const app = express();
    app.get('/invalid', (_req, _res, next) => {
      const result = z.object({ email: z.email() }).safeParse({ email: 'invalid' });
      if (!result.success) next(result.error);
    });
    app.use(createErrorHandler('test'));

    const response = await request(app).get('/invalid');

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      status: 422,
    });
    expect(response.body.error.details).toEqual([
      { path: 'email', message: expect.any(String) },
    ]);
  });

  it('does not expose internal error details in production', async () => {
    const app = express();
    app.get('/failure', (_req, _res, next) => next(new Error('private implementation detail')));
    app.use(createErrorHandler('production'));

    const response = await request(app).get('/failure');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        status: 500,
        details: [],
      },
    });
  });
});
