import { Types } from 'mongoose';
import { ApiError } from '../../common/api-error.js';
import type { AuthClaims } from '../auth/auth.types.js';
import { AvailabilityException } from './models/availability-exception.js';
import {
  availabilityExceptionInputSchema,
  type AvailabilityExceptionInput,
  type AvailabilityExceptionPatch,
} from './availability.schemas.js';
import { TutorProfile } from '../tutors/models/tutor-profile.js';

export async function getOwnExceptions(claims: AuthClaims): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const profile = await findOwnTutorProfile(claims.sub);
  const items = await AvailabilityException.find({ tutorProfileId: profile._id })
    .sort({ date: 1, startTime: 1, createdAt: 1 })
    .lean();
  return { items: items.map(exceptionResponse) };
}

export async function addOwnException(
  claims: AuthClaims,
  input: AvailabilityExceptionInput,
): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const profile = await findOwnTutorProfile(claims.sub);
  const [exception] = await AvailabilityException.create([
    { ...input, tutorProfileId: profile._id },
  ]);
  if (!exception) throw new Error('Availability exception creation completed without a document.');
  return exceptionResponse(exception);
}

export async function updateOwnException(
  claims: AuthClaims,
  exceptionId: string,
  patch: AvailabilityExceptionPatch,
): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const profile = await findOwnTutorProfile(claims.sub);
  const exception = await AvailabilityException.findOne({
    _id: exceptionId,
    tutorProfileId: profile._id,
  });
  if (!exception) throw exceptionNotFound();

  const kind = patch.kind ?? exception.kind;
  const candidate = {
    date: patch.date ?? exception.date,
    kind,
    timeZone: patch.timeZone ?? exception.timeZone,
    ...(kind === 'BLOCK_TIME'
      ? {
          startTime: patch.startTime ?? exception.startTime,
          endTime: patch.endTime ?? exception.endTime,
        }
      : {
          ...(patch.startTime === undefined ? {} : { startTime: patch.startTime }),
          ...(patch.endTime === undefined ? {} : { endTime: patch.endTime }),
        }),
  };
  const input = availabilityExceptionInputSchema.parse(candidate);

  exception.date = input.date;
  exception.kind = input.kind;
  exception.timeZone = input.timeZone;
  if (input.kind === 'BLOCK_TIME') {
    exception.startTime = input.startTime;
    exception.endTime = input.endTime;
  } else {
    exception.set('startTime', undefined);
    exception.set('endTime', undefined);
  }
  await exception.save();
  return exceptionResponse(exception);
}

export async function deleteOwnException(claims: AuthClaims, exceptionId: string): Promise<void> {
  assertUserRole(claims);
  const profile = await findOwnTutorProfile(claims.sub);
  const result = await AvailabilityException.deleteOne({
    _id: exceptionId,
    tutorProfileId: profile._id,
  });
  if (result.deletedCount === 0) throw exceptionNotFound();
}

async function findOwnTutorProfile(userId: string) {
  const profile = await TutorProfile.findOne({ userId: new Types.ObjectId(userId) }).select('_id');
  if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Tutor profile not found.');
  return profile;
}

function exceptionResponse(exception: {
  _id: Types.ObjectId;
  date: string;
  kind: 'BLOCK_DAY' | 'BLOCK_TIME';
  timeZone: string;
  startTime?: string;
  endTime?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): Record<string, unknown> {
  return {
    id: exception._id.toString(),
    date: exception.date,
    kind: exception.kind,
    timeZone: exception.timeZone,
    ...(exception.startTime === undefined ? {} : { startTime: exception.startTime }),
    ...(exception.endTime === undefined ? {} : { endTime: exception.endTime }),
    ...(exception.createdAt ? { createdAt: exception.createdAt } : {}),
    ...(exception.updatedAt ? { updatedAt: exception.updatedAt } : {}),
  };
}

function assertUserRole(claims: AuthClaims): void {
  if (claims.role !== 'USER') {
    throw new ApiError(403, 'FORBIDDEN', 'Only USER accounts can manage tutor availability.');
  }
}

function exceptionNotFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Availability exception not found.');
}
