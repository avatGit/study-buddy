import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import type { Environment } from '../../config/env.js';
import {
  deleteOwnTutorAvailability,
  getOwnTutorAvailabilities,
  getOwnTutorProfile,
  getPublicTutorProfileHandler,
  patchOwnTutorAvailability,
  postOwnTutorAvailability,
  publishOwnTutorProfile,
  putOwnTutorProfile,
  putOwnTutorSubjects,
  unpublishOwnTutorProfile,
} from './tutor.controller.js';

export function createTutorRouter(config: Environment): Router {
  const router = Router();
  router.use(authenticate(config));

  router.get('/me/profile', getOwnTutorProfile);
  router.put('/me/profile', putOwnTutorProfile);
  router.put('/me/subjects', putOwnTutorSubjects);
  router.get('/me/availabilities', getOwnTutorAvailabilities);
  router.post('/me/availabilities', postOwnTutorAvailability);
  router.patch('/me/availabilities/:availabilityId', patchOwnTutorAvailability);
  router.delete('/me/availabilities/:availabilityId', deleteOwnTutorAvailability);
  router.post('/me/publish', publishOwnTutorProfile);
  router.post('/me/unpublish', unpublishOwnTutorProfile);
  router.get('/:id', getPublicTutorProfileHandler);

  return router;
}
