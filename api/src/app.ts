import express, { type Express } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ApiError } from './common/api-error.js';
import { requestLogger } from './common/logger.js';
import type { Environment } from './config/env.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createTutorRouter } from './modules/tutors/tutor.routes.js';

export function createApp(config: Environment): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      skip: (req) => req.method === 'GET' && req.path === '/health',
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth', createAuthRouter(config));
  app.use('/api/tutors', createTutorRouter(config));
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.use((_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.'));
  });
  app.use(createErrorHandler(config.NODE_ENV));
  return app;
}
