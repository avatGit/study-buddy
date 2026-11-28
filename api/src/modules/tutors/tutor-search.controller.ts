import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import { tutorSearchQuerySchema } from './tutor-search.schemas.js';
import { searchTutors } from './tutor-search.service.js';

export const getTutors: RequestHandler = async (req, res) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const query = tutorSearchQuerySchema.parse(req.query);
  res.status(200).json(await searchTutors(req.auth, query));
};
