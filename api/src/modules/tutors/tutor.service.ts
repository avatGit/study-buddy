import mongoose, { Types } from 'mongoose';
import { ApiError } from '../../common/api-error.js';
import type { AuthClaims } from '../auth/auth.types.js';
import { User } from '../auth/models/user.js';
import { RecurringAvailability } from '../availability/models/recurring-availability.js';
import { Subject } from '../subjects/models/subject.js';
import { University } from '../universities/models/university.js';
import type {
  AvailabilityInput,
  AvailabilityPatch,
  ProfileInput,
  SubjectIdsInput,
} from './tutor.schemas.js';
import { availabilityInputSchema } from './tutor.schemas.js';
import { TutorProfile, type TutorProfileFields } from './models/tutor-profile.js';

export async function getOwnProfile(claims: AuthClaims): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const [user, profile] = await Promise.all([
    findUser(claims.sub),
    TutorProfile.findOne({ userId: claims.sub }),
  ]);
  if (!profile) throw profileNotFound();

  return ownProfileResponse(profile, user.universityId);
}

export async function saveOwnProfile(
  claims: AuthClaims,
  input: ProfileInput,
): Promise<{ status: number; body: Record<string, unknown> }> {
  assertUserRole(claims);
  await Promise.all([User.init(), TutorProfile.init()]);
  const userId = new Types.ObjectId(claims.sub);
  let created = false;
  let profile: (typeof TutorProfile.prototype) | null = null;
  let universityId: Types.ObjectId | null | undefined;

  try {
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findById(userId).session(session);
      if (!user) throw unauthorized();

      if (input.universityId !== undefined) {
        universityId = input.universityId === null ? null : new Types.ObjectId(input.universityId);
        if (
          universityId &&
          !(await University.exists({ _id: universityId, isActive: true }).session(session))
        ) {
          throw validationError('universityId', 'University must exist and be active.');
        }

        const currentProfile = await TutorProfile.findOne({ userId }).session(session);
        if (
          currentProfile &&
          !(await areSubjectsInScope(currentProfile.subjectIds, universityId, session))
        ) {
          throw validationError(
            'universityId',
            'Update or remove subjects that are outside the selected university scope first.',
          );
        }

        user.universityId = universityId;
        await user.save({ session });
      } else {
        universityId = user.universityId;
      }

      profile = await TutorProfile.findOne({ userId }).session(session);
      if (profile) {
        profile.displayName = input.displayName;
        profile.bio = input.bio;
        await profile.save({ session });
      } else {
        created = true;
        [profile] = await TutorProfile.create(
          [
            {
              userId,
              displayName: input.displayName,
              bio: input.bio,
              subjectIds: [],
              status: 'DRAFT',
            },
          ],
          { session },
        );
      }
    });
  } catch (error) {
    if (isTutorProfileDuplicate(error)) {
      throw new ApiError(409, 'CONFLICT', 'A tutor profile already exists for this account.');
    }
    throw error;
  }

  if (!profile) throw new Error('Tutor profile transaction completed without a profile.');
  return {
    status: created ? 201 : 200,
    body: ownProfileResponse(profile, universityId ?? null),
  };
}

export async function replaceOwnSubjects(
  claims: AuthClaims,
  input: SubjectIdsInput,
): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const session = await mongoose.startSession();
  let response: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const user = await findUser(claims.sub, session);
      const profile = await findOwnTutorProfile(claims.sub, session);
      const subjectIds = input.subjectIds.map((id) => new Types.ObjectId(id));
      if (!(await areSubjectsInScope(subjectIds, user.universityId, session))) {
        throw validationError('subjectIds', 'Each subject must be active and within your university scope.');
      }

      profile.subjectIds = subjectIds;
      await profile.save({ session });
      response = ownProfileResponse(profile, user.universityId);
    });
  } finally {
    await session.endSession();
  }

  if (!response) throw new Error('Subject update completed without a profile response.');
  return response;
}

export async function getOwnAvailabilities(claims: AuthClaims): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const profile = await findOwnTutorProfile(claims.sub);
  const items = await RecurringAvailability.find({ tutorProfileId: profile._id })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();
  return { items: items.map(availabilityResponse) };
}

export async function addOwnAvailability(
  claims: AuthClaims,
  input: AvailabilityInput,
): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  return withProfileLock(claims.sub, async (profile, session) => {
    await assertNoOverlap(profile._id, input, undefined, session);
    const [availability] = await RecurringAvailability.create(
      [{ ...input, tutorProfileId: profile._id }],
      { session },
    );
    if (!availability) throw new Error('Availability creation completed without a document.');
    return availabilityResponse(availability);
  });
}

export async function updateOwnAvailability(
  claims: AuthClaims,
  availabilityId: string,
  patch: AvailabilityPatch,
): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  return withProfileLock(claims.sub, async (profile, session) => {
    const availability = await RecurringAvailability.findOne({
      _id: availabilityId,
      tutorProfileId: profile._id,
    }).session(session);
    if (!availability) throw availabilityNotFound();

    const candidate = {
      dayOfWeek: patch.dayOfWeek ?? availability.dayOfWeek,
      startTime: patch.startTime ?? availability.startTime,
      endTime: patch.endTime ?? availability.endTime,
      timeZone: patch.timeZone ?? availability.timeZone,
    };
    availabilityInputSchema.parse(candidate);
    await assertNoOverlap(profile._id, candidate, availability._id, session);

    Object.assign(availability, candidate);
    await availability.save({ session });
    return availabilityResponse(availability);
  });
}

export async function deleteOwnAvailability(
  claims: AuthClaims,
  availabilityId: string,
): Promise<void> {
  assertUserRole(claims);
  await withProfileLock(claims.sub, async (profile, session) => {
    const result = await RecurringAvailability.deleteOne({
      _id: availabilityId,
      tutorProfileId: profile._id,
    }).session(session);
    if (result.deletedCount === 0) throw availabilityNotFound();
  });
}

export async function publishOwnProfile(claims: AuthClaims): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const session = await mongoose.startSession();
  let response: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const user = await findUser(claims.sub, session);
      const profile = await findOwnTutorProfile(claims.sub, session);
      if (profile.status !== 'DRAFT') {
        throw new ApiError(409, 'CONFLICT', 'Only a draft tutor profile can be published.');
      }
      if (profile.bio.trim().length === 0) {
        throw validationError('bio', 'A non-empty biography is required to publish.');
      }
      if (
        profile.subjectIds.length === 0 ||
        !(await areSubjectsInScope(profile.subjectIds, user.universityId, session))
      ) {
        throw validationError('subjectIds', 'At least one active in-scope subject is required to publish.');
      }
      if (!(await RecurringAvailability.exists({ tutorProfileId: profile._id }).session(session))) {
        throw validationError('availabilities', 'At least one recurring availability is required to publish.');
      }

      profile.status = 'ACTIVE';
      await profile.save({ session });
      response = ownProfileResponse(profile, user.universityId);
    });
  } finally {
    await session.endSession();
  }

  if (!response) throw new Error('Publication completed without a profile response.');
  return response;
}

export async function unpublishOwnProfile(claims: AuthClaims): Promise<Record<string, unknown>> {
  assertUserRole(claims);
  const session = await mongoose.startSession();
  let response: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const user = await findUser(claims.sub, session);
      const profile = await findOwnTutorProfile(claims.sub, session);
      if (profile.status !== 'ACTIVE') {
        throw new ApiError(409, 'CONFLICT', 'Only an active tutor profile can be unpublished.');
      }
      profile.status = 'DRAFT';
      await profile.save({ session });
      response = ownProfileResponse(profile, user.universityId);
    });
  } finally {
    await session.endSession();
  }

  if (!response) throw new Error('Unpublish completed without a profile response.');
  return response;
}

export async function getPublicTutorProfile(
  viewerClaims: AuthClaims,
  profileId: string,
): Promise<Record<string, unknown>> {
  const viewer = await findUser(viewerClaims.sub);
  const profile = await TutorProfile.findOne({ _id: profileId, status: 'ACTIVE' }).lean();
  if (!profile) throw publicProfileNotFound();

  const owner = await User.findById(profile.userId).select('universityId').lean();
  if (!owner || !isInUniversityScope(owner.universityId, viewer.universityId)) {
    throw publicProfileNotFound();
  }

  const [subjects, availabilities] = await Promise.all([
    Subject.find({
      _id: { $in: profile.subjectIds },
      isActive: true,
      universityId: { $in: scopedUniversityIds(viewer.universityId) },
    })
      .select('name code')
      .sort({ normalizedName: 1 })
      .lean(),
    RecurringAvailability.find({ tutorProfileId: profile._id })
      .select('dayOfWeek startTime endTime timeZone')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean(),
  ]);

  return {
    id: profile._id.toString(),
    displayName: profile.displayName,
    bio: profile.bio,
    universityId: owner.universityId?.toString() ?? null,
    subjects: subjects.map((subject) => ({
      id: subject._id.toString(),
      name: subject.name,
      ...(subject.code === undefined ? {} : { code: subject.code }),
    })),
    availabilities: availabilities.map(availabilityResponse),
  };
}

export async function isTutorEligibleForRequests(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  const [user, profile] = await Promise.all([
    User.findById(userId).select('universityId').lean(),
    TutorProfile.findOne({ userId, status: 'ACTIVE' }).lean(),
  ]);
  if (!user || !profile || profile.bio.trim().length === 0) return false;

  const [hasSubjects, hasAvailability] = await Promise.all([
    Subject.exists({
      _id: { $in: profile.subjectIds },
      isActive: true,
      universityId: { $in: scopedUniversityIds(user.universityId) },
    }),
    RecurringAvailability.exists({ tutorProfileId: profile._id }),
  ]);
  return Boolean(hasSubjects && hasAvailability);
}

async function withProfileLock<T>(
  userId: string,
  operation: (profile: InstanceType<typeof TutorProfile>, session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  let result: { value: T } | undefined;
  try {
    await session.withTransaction(async () => {
      const profile = await findOwnTutorProfile(userId, session);
      const lock = await TutorProfile.updateOne(
        { _id: profile._id },
        { $inc: { __v: 1 }, $set: { updatedAt: new Date() } },
        { session },
      );
      if (lock.matchedCount !== 1) throw profileNotFound();
      result = { value: await operation(profile, session) };
    });
  } finally {
    await session.endSession();
  }
  if (!result) throw new Error('Tutor profile operation completed without a result.');
  return result.value;
}

async function assertNoOverlap(
  tutorProfileId: Types.ObjectId,
  input: Pick<AvailabilityInput, 'dayOfWeek' | 'startTime' | 'endTime'>,
  excludedId: Types.ObjectId | undefined,
  session: mongoose.ClientSession,
): Promise<void> {
  const overlapping = await RecurringAvailability.exists({
    tutorProfileId,
    dayOfWeek: input.dayOfWeek,
    startTime: { $lt: input.endTime },
    endTime: { $gt: input.startTime },
    ...(excludedId ? { _id: { $ne: excludedId } } : {}),
  }).session(session);
  if (overlapping) {
    throw new ApiError(409, 'CONFLICT', 'Recurring availability overlaps an existing window.');
  }
}

async function areSubjectsInScope(
  subjectIds: Types.ObjectId[],
  universityId: Types.ObjectId | null | undefined,
  session?: mongoose.ClientSession,
): Promise<boolean> {
  if (subjectIds.length === 0) return true;
  const filter = {
    _id: { $in: subjectIds },
    isActive: true,
    universityId: { $in: scopedUniversityIds(universityId) },
  };
  const query = Subject.find(filter).select('_id');
  if (session) query.session(session);
  const matches = await query.lean();
  return matches.length === subjectIds.length;
}

function scopedUniversityIds(universityId: Types.ObjectId | null | undefined): (Types.ObjectId | null)[] {
  return universityId ? [null, universityId] : [null];
}

function isInUniversityScope(
  ownerUniversityId: Types.ObjectId | null | undefined,
  viewerUniversityId: Types.ObjectId | null | undefined,
): boolean {
  return !ownerUniversityId || Boolean(viewerUniversityId?.equals(ownerUniversityId));
}

async function findUser(userId: string, session?: mongoose.ClientSession) {
  const query = User.findById(userId);
  if (session) query.session(session);
  const user = await query;
  if (!user) throw unauthorized();
  return user;
}

async function findOwnTutorProfile(userId: string, session?: mongoose.ClientSession) {
  const query = TutorProfile.findOne({ userId });
  if (session) query.session(session);
  const profile = await query;
  if (!profile) throw profileNotFound();
  return profile;
}

function ownProfileResponse(
  profile: Pick<TutorProfileFields, 'displayName' | 'bio' | 'subjectIds' | 'status'> & {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  },
  universityId: Types.ObjectId | null | undefined,
): Record<string, unknown> {
  return {
    id: profile._id.toString(),
    displayName: profile.displayName,
    bio: profile.bio,
    universityId: universityId?.toString() ?? null,
    subjectIds: profile.subjectIds.map((id) => id.toString()),
    status: profile.status,
    ...(profile.createdAt ? { createdAt: profile.createdAt } : {}),
    ...(profile.updatedAt ? { updatedAt: profile.updatedAt } : {}),
  };
}

function availabilityResponse(availability: {
  _id: Types.ObjectId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeZone: string;
  createdAt?: Date;
  updatedAt?: Date;
}): Record<string, unknown> {
  return {
    id: availability._id.toString(),
    dayOfWeek: availability.dayOfWeek,
    startTime: availability.startTime,
    endTime: availability.endTime,
    timeZone: availability.timeZone,
    ...(availability.createdAt ? { createdAt: availability.createdAt } : {}),
    ...(availability.updatedAt ? { updatedAt: availability.updatedAt } : {}),
  };
}

function assertUserRole(claims: AuthClaims): void {
  if (claims.role !== 'USER') {
    throw new ApiError(403, 'FORBIDDEN', 'Only USER accounts can manage tutor profiles.');
  }
}

function validationError(path: string, message: string): ApiError {
  return new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed.', [{ path, message }]);
}

function unauthorized(): ApiError {
  return new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
}

function profileNotFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Tutor profile not found.');
}

function publicProfileNotFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Tutor profile not found.');
}

function availabilityNotFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Availability window not found.');
}

function isTutorProfileDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000 &&
    'keyPattern' in error &&
    typeof error.keyPattern === 'object' &&
    error.keyPattern !== null &&
    'userId' in error.keyPattern
  );
}
