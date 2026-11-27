import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import {
  availabilityExceptionIdSchema,
  availabilityExceptionInputSchema,
  availabilityExceptionPatchSchema,
} from './availability.schemas.js';
import {
  addOwnException,
  deleteOwnException,
  getOwnExceptions,
  updateOwnException,
} from './availability.service.js';

const claimsOf = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return req.auth;
};

export const getOwnAvailabilityExceptions: RequestHandler = async (req, res) => {
  res.status(200).json(await getOwnExceptions(claimsOf(req)));
};

export const postOwnAvailabilityException: RequestHandler = async (req, res) => {
  const input = availabilityExceptionInputSchema.parse(req.body);
  res.status(201).json(await addOwnException(claimsOf(req), input));
};

export const patchOwnAvailabilityException: RequestHandler = async (req, res) => {
  const id = availabilityExceptionIdSchema.parse(req.params.exceptionId);
  const patch = availabilityExceptionPatchSchema.parse(req.body);
  res.status(200).json(await updateOwnException(claimsOf(req), id, patch));
};

export const deleteOwnAvailabilityException: RequestHandler = async (req, res) => {
  const id = availabilityExceptionIdSchema.parse(req.params.exceptionId);
  await deleteOwnException(claimsOf(req), id);
  res.status(204).end();
};
