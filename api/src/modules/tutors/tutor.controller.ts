import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import {
  availabilityIdSchema,
  availabilityInputSchema,
  availabilityPatchSchema,
  profileInputSchema,
  subjectIdsInputSchema,
  tutorProfileIdSchema,
} from './tutor.schemas.js';
import {
  addOwnAvailability,
  deleteOwnAvailability,
  getOwnAvailabilities,
  getOwnProfile,
  getPublicTutorProfile,
  publishOwnProfile,
  replaceOwnSubjects,
  saveOwnProfile,
  unpublishOwnProfile,
  updateOwnAvailability,
} from './tutor.service.js';

const claimsOf = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return req.auth;
};

export const getOwnTutorProfile: RequestHandler = async (req, res) => {
  res.status(200).json(await getOwnProfile(claimsOf(req)));
};

export const putOwnTutorProfile: RequestHandler = async (req, res) => {
  const input = profileInputSchema.parse(req.body);
  const result = await saveOwnProfile(claimsOf(req), input);
  res.status(result.status).json(result.body);
};

export const putOwnTutorSubjects: RequestHandler = async (req, res) => {
  const input = subjectIdsInputSchema.parse(req.body);
  res.status(200).json(await replaceOwnSubjects(claimsOf(req), input));
};

export const getOwnTutorAvailabilities: RequestHandler = async (req, res) => {
  res.status(200).json(await getOwnAvailabilities(claimsOf(req)));
};

export const postOwnTutorAvailability: RequestHandler = async (req, res) => {
  const input = availabilityInputSchema.parse(req.body);
  res.status(201).json(await addOwnAvailability(claimsOf(req), input));
};

export const patchOwnTutorAvailability: RequestHandler = async (req, res) => {
  const id = parseId(availabilityIdSchema, req.params.availabilityId);
  const patch = availabilityPatchSchema.parse(req.body);
  res.status(200).json(await updateOwnAvailability(claimsOf(req), id, patch));
};

export const deleteOwnTutorAvailability: RequestHandler = async (req, res) => {
  const id = parseId(availabilityIdSchema, req.params.availabilityId);
  await deleteOwnAvailability(claimsOf(req), id);
  res.status(204).end();
};

export const publishOwnTutorProfile: RequestHandler = async (req, res) => {
  rejectBody(req);
  res.status(200).json(await publishOwnProfile(claimsOf(req)));
};

export const unpublishOwnTutorProfile: RequestHandler = async (req, res) => {
  rejectBody(req);
  res.status(200).json(await unpublishOwnProfile(claimsOf(req)));
};

export const getPublicTutorProfileHandler: RequestHandler = async (req, res) => {
  const id = parseId(tutorProfileIdSchema, req.params.id);
  res.status(200).json(await getPublicTutorProfile(claimsOf(req), id));
};

function parseId(schema: typeof tutorProfileIdSchema, value: unknown): string {
  return schema.parse(value);
}

function rejectBody(req: Parameters<RequestHandler>[0]): void {
  const contentLength = Number(req.get('content-length') ?? 0);
  if (contentLength > 0 || req.get('transfer-encoding') !== undefined) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'This route does not accept a request body.', [
      { path: 'body', message: 'A request body is not allowed.' },
    ]);
  }
}
