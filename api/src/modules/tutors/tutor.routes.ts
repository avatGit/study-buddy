import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import type { Environment } from '../../config/env.js';
import {
  deleteOwnAvailabilityException,
  getOwnAvailabilityExceptions,
  patchOwnAvailabilityException,
  postOwnAvailabilityException,
} from '../availability/availability.controller.js';
import { getTutors } from './tutor-search.controller.js';
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
  router.get('/me/exceptions', getOwnAvailabilityExceptions);
  router.post('/me/exceptions', postOwnAvailabilityException);
  router.patch('/me/exceptions/:exceptionId', patchOwnAvailabilityException);
  router.delete('/me/exceptions/:exceptionId', deleteOwnAvailabilityException);
  router.post('/me/publish', publishOwnTutorProfile);
  router.post('/me/unpublish', unpublishOwnTutorProfile);
  router.get('/', getTutors);
  router.get('/:id', getPublicTutorProfileHandler);

  return router;
}
