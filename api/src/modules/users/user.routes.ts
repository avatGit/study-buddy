import { Router } from 'express';
import type { Environment } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { getMe } from './user.controller.js';

export function createUserRouter(config: Environment): Router {
  const router = Router();
  router.use(authenticate(config));
  router.get('/me', getMe);
  return router;
}
