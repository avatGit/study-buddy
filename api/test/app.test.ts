import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testConfig } from './helpers/test-config.js';

const app = createApp(testConfig);

describe('API application', () => {
  it('returns a healthy response from GET /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects malformed JSON with a client error', async () => {
    const response = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{invalid-json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'MALFORMED_REQUEST',
        message: 'The request body contains invalid JSON.',
        status: 400,
        details: [],
      },
    });
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const response = await request(app).get('/not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        status: 404,
        details: [],
      },
    });
  });
});
