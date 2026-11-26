import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../../common/api-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import type { Environment } from '../../config/env.js';
import { createAuthController } from './auth.controller.js';

export function createAuthRouter(config: Environment): Router {
  const router = Router();
  const controller = createAuthController(config);
  const credentialsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new ApiError(429, 'RATE_LIMITED', 'Too many authentication attempts. Try again later.'));
    },
  });

  router.post('/register', credentialsRateLimit, controller.register);
  router.post('/login', credentialsRateLimit, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', authenticate(config), controller.logout);

  return router;
}
