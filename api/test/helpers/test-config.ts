import { loadEnvironment } from '../../src/config/env.js';

export const testConfig = loadEnvironment({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/studybuddy-test',
  ACCESS_TOKEN_SECRET: 'test-only-access-token-secret-at-least-32-chars',
});
