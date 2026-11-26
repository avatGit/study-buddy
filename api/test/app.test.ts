import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('API application', () => {
  it('returns a healthy response from GET /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects malformed JSON with a client error', async () => {
    const response = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{invalid-json');

    expect(response.status).toBe(400);
  });
});
