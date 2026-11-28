import { Router } from 'express';
import type { Environment } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { getSubjects } from './subject.controller.js';

export function createSubjectRouter(config: Environment): Router {
  const router = Router();
  router.use(authenticate(config));
  router.get('/', getSubjects);
  return router;
}
