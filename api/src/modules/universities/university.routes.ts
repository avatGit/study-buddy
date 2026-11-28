import { Router } from 'express';
import { getUniversities } from './university.controller.js';

export function createUniversityRouter(): Router {
  const router = Router();
  router.get('/', getUniversities);
  return router;
}
