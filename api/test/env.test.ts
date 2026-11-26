import { describe, expect, it } from 'vitest';
import { loadEnvironment } from '../src/config/env.js';

describe('environment configuration', () => {
  it('loads defaults when required settings are valid', () => {
    const config = loadEnvironment({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/studybuddy',
      ACCESS_TOKEN_SECRET: 'a'.repeat(32),
    });

    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CLIENT_ORIGIN: 'http://localhost:3000',
    });
  });

  it('rejects an invalid access token secret', () => {
    expect(() =>
      loadEnvironment({
        MONGODB_URI: 'mongodb://127.0.0.1:27017/studybuddy',
        ACCESS_TOKEN_SECRET: 'too-short',
      }),
    ).toThrow();
  });
});
