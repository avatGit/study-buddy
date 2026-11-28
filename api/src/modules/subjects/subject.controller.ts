import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import { subjectListQuerySchema } from './subject.schemas.js';
import { listSubjects } from './subject.service.js';

export const getSubjects: RequestHandler = async (req, res) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const query = subjectListQuerySchema.parse(req.query);
  res.status(200).json(await listSubjects(req.auth, query));
};
