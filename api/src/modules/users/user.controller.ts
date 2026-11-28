import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import { getCurrentUser } from './user.service.js';

export const getMe: RequestHandler = async (req, res) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  res.status(200).json({ user: await getCurrentUser(req.auth) });
};
