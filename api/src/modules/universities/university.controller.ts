import type { RequestHandler } from 'express';
import { universityListQuerySchema } from './university.schemas.js';
import { listUniversities } from './university.service.js';

export const getUniversities: RequestHandler = async (req, res) => {
  const query = universityListQuerySchema.parse(req.query);
  res.status(200).json(await listUniversities(query));
};
