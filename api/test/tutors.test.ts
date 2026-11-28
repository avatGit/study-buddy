import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnvironment, type Environment } from '../src/config/env.js';
import { AvailabilityException } from '../src/modules/availability/models/availability-exception.js';
import { RecurringAvailability } from '../src/modules/availability/models/recurring-availability.js';
import { AuthSession } from '../src/modules/auth/models/auth-session.js';
import { User } from '../src/modules/auth/models/user.js';
import { Subject } from '../src/modules/subjects/models/subject.js';
import { TutorProfile } from '../src/modules/tutors/models/tutor-profile.js';
import { isTutorEligibleForRequests } from '../src/modules/tutors/tutor.service.js';
import { University } from '../src/modules/universities/models/university.js';

const tokenSecret = 'tutor-integration-test-secret-not-for-production';
const password = 'correct horse battery staple';
const mondayWindow = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '11:00',
  timeZone: 'Europe/Paris',
};

describe('tutor profile API', () => {
  let replicaSet: MongoMemoryReplSet | undefined;
  let config: Environment;
  let requestApp: ReturnType<typeof createApp>;
  let accountNumber = 0;

  beforeAll(async () => {
    const runningReplicaSet = new MongoMemoryReplSet({
      instanceOpts: [{ launchTimeout: 60_000 }],
      replSet: { count: 1 },
    });
    replicaSet = runningReplicaSet;
    await runningReplicaSet.start();
    config = loadEnvironment({
      NODE_ENV: 'test',
      MONGODB_URI: runningReplicaSet.getUri(),
      ACCESS_TOKEN_SECRET: tokenSecret,
    });
    await mongoose.connect(config.MONGODB_URI);
    await Promise.all([
      AuthSession.init(),
      User.init(),
      University.init(),
      Subject.init(),
      TutorProfile.init(),
      RecurringAvailability.init(),
      AvailabilityException.init(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      AuthSession.deleteMany({}),
      User.deleteMany({}),
      University.deleteMany({}),
      Subject.deleteMany({}),
      TutorProfile.deleteMany({}),
      RecurringAvailability.deleteMany({}),
      AvailabilityException.deleteMany({}),
    ]);
    requestApp = createApp(config);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });

  async function createAccount(): Promise<{ userId: string; email: string; token: string }> {
    accountNumber += 1;
    const email = `tutor${accountNumber}@example.test`;
    const response = await request(requestApp)
      .post('/api/auth/register')
      .send({ fullName: 'Tutor Example', email, password });
    expect(response.status).toBe(201);
    return {
      userId: response.body.user.id as string,
      email,
      token: response.body.accessToken as string,
    };
  }

  async function createProfile(
    token: string,
    fields: { displayName?: string; bio?: string } = {},
  ): Promise<{ id: string; response: request.Response }> {
    const response = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        displayName: fields.displayName ?? 'Tutor A',
        bio: fields.bio ?? 'Draft biography',
      });
    return { id: response.body.id as string, response };
  }

  async function createSubject(options: {
    name: string;
    universityId?: Types.ObjectId | null;
    isActive?: boolean;
    code?: string;
  }): Promise<Types.ObjectId> {
    const subject = await Subject.create({
      name: options.name,
      universityId: options.universityId ?? null,
      isActive: options.isActive ?? true,
      ...(options.code ? { code: options.code } : {}),
    });
    return subject._id;
  }

  async function addAvailability(token: string, window = mondayWindow): Promise<request.Response> {
    return request(requestApp)
      .post('/api/tutors/me/availabilities')
      .set('Authorization', `Bearer ${token}`)
      .send(window);
  }

  async function preparePublishableProfile(token: string): Promise<string> {
    const { id, response } = await createProfile(token, {
      displayName: 'Ada Tutor',
      bio: 'Mathematics tutor',
    });
    expect(response.status).toBe(201);
    const subjectId = await createSubject({ name: 'Algebra', code: 'ALG' });
    const subjectResponse = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectIds: [subjectId.toString()] });
    expect(subjectResponse.status).toBe(200);
    expect((await addAvailability(token)).status).toBe(201);
    return id;
  }

  async function setUserUniversity(userId: string, universityId: Types.ObjectId | null): Promise<void> {
    await User.updateOne({ _id: userId }, { $set: { universityId } });
  }

  async function createActiveTutor(
    token: string,
    options: {
      displayName: string;
      subjectIds: Types.ObjectId[];
      daysOfWeek?: number[];
      averageRating?: number;
      reviewCount?: number;
    },
  ): Promise<string> {
    const profile = await createProfile(token, {
      displayName: options.displayName,
      bio: `${options.displayName} biography`,
    });
    expect(profile.response.status).toBe(201);

    const subjects = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectIds: options.subjectIds.map((id) => id.toString()) });
    expect(subjects.status).toBe(200);

    for (const dayOfWeek of options.daysOfWeek ?? [1]) {
      const availability = await addAvailability(token, { ...mondayWindow, dayOfWeek });
      expect(availability.status).toBe(201);
    }

    const published = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(200);

    if (options.averageRating !== undefined || options.reviewCount !== undefined) {
      await TutorProfile.updateOne(
        { _id: profile.id },
        {
          $set: {
            averageRating: options.averageRating ?? 0,
            reviewCount: options.reviewCount ?? 0,
          },
        },
      );
    }
    return profile.id;
  }

  function localDateOffset(offsetDays: number, timeZone = 'Pacific/Kiritimati'): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = new Map(parts.map(({ type, value }) => [type, value]));
    const today = `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
    const result = new Date(`${today}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + offsetDays);
    return result.toISOString().slice(0, 10);
  }

  function localDateForWeekday(dayOfWeek: number, timeZone: string): string {
    const date = new Date(`${localDateOffset(1, timeZone)}T00:00:00.000Z`);
    while (date.getUTCDay() !== dayOfWeek) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return date.toISOString().slice(0, 10);
  }

  it('creates and reads a private draft profile, then updates it for its owner only', async () => {
    const owner = await createAccount();
    const stranger = await createAccount();

    const missing = await request(requestApp)
      .get('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(missing.status).toBe(404);

    const created = await createProfile(owner.token, { bio: '' });
    expect(created.response.status).toBe(201);
    expect(created.response.body).toMatchObject({
      id: expect.any(String),
      displayName: 'Tutor A',
      bio: '',
      subjectIds: [],
      status: 'DRAFT',
      universityId: null,
    });
    const storedProfile = await TutorProfile.findById(created.id).lean();
    expect(storedProfile?.averageRating).toBe(0);
    expect(storedProfile?.reviewCount).toBe(0);

    const ownRead = await request(requestApp)
      .get('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.id).toBe(created.id);

    const strangerRead = await request(requestApp)
      .get('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerRead.status).toBe(404);

    const attemptedOwnershipWrite = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({
        displayName: 'Impersonated',
        bio: 'private',
        userId: owner.userId,
      });
    expect(attemptedOwnershipWrite.status).toBe(422);

    const attemptedServerFieldWrite = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ displayName: 'Ada', bio: '', status: 'ACTIVE' });
    expect(attemptedServerFieldWrite.status).toBe(422);

    const updated = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ displayName: 'Ada Updated', bio: 'Updated bio' });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(created.id);
    expect(updated.body.displayName).toBe('Ada Updated');

    const strangerProfile = await createProfile(stranger.token);
    expect(strangerProfile.response.status).toBe(201);
    expect(strangerProfile.id).not.toBe(created.id);
    expect((await TutorProfile.findById(created.id))?.displayName).toBe('Ada Updated');
  });

  it('validates university assignments and applies changes only when explicitly supplied', async () => {
    const account = await createAccount();
    const invalidId = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ displayName: 'Tutor', bio: '', universityId: 'not-an-object-id' });
    expect(invalidId.status).toBe(422);

    const inactiveUniversity = await University.create({ name: 'Inactive University', isActive: false });
    const inactive = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        displayName: 'Tutor',
        bio: '',
        universityId: inactiveUniversity._id.toString(),
      });
    expect(inactive.status).toBe(422);

    const university = await University.create({ name: 'Université Exemple', isActive: true });
    const assigned = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        displayName: 'Tutor',
        bio: '',
        universityId: university._id.toString(),
      });
    expect(assigned.status).toBe(201);
    expect(assigned.body.universityId).toBe(university._id.toString());

    const omitted = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ displayName: 'Tutor', bio: '' });
    expect(omitted.status).toBe(200);
    expect(omitted.body.universityId).toBe(university._id.toString());

    const cleared = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ displayName: 'Tutor', bio: '', universityId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.universityId).toBeNull();
    expect((await User.findById(account.userId))?.universityId).toBeNull();
  });

  it('replaces only active in-scope subject associations and enforces normalized uniqueness', async () => {
    const account = await createAccount();
    const otherAccount = await createAccount();
    const university = await University.create({ name: 'University A' });
    const otherUniversity = await University.create({ name: 'University B' });
    const profile = await createProfile(account.token);
    expect(profile.response.status).toBe(201);

    const globalSubject = await createSubject({ name: '  Physics ' });
    const scopedSubject = await createSubject({
      name: 'Advanced Biology',
      universityId: university._id,
    });
    const inactiveSubject = await createSubject({ name: 'Inactive', isActive: false });
    const otherScopeSubject = await createSubject({
      name: 'Other University Subject',
      universityId: otherUniversity._id,
    });

    const global = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [globalSubject.toString()] });
    expect(global.status).toBe(200);

    const badIds = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [new Types.ObjectId().toString()] });
    expect(badIds.status).toBe(422);

    const inactive = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [inactiveSubject.toString()] });
    expect(inactive.status).toBe(422);

    const outOfScope = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [otherScopeSubject.toString()] });
    expect(outOfScope.status).toBe(422);

    const duplicate = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [globalSubject.toString(), globalSubject.toString()] });
    expect(duplicate.status).toBe(422);

    const scopeAssigned = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({
        displayName: 'Tutor A',
        bio: '',
        universityId: university._id.toString(),
      });
    expect(scopeAssigned.status).toBe(200);
    const scopedAssociation = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [globalSubject.toString(), scopedSubject.toString()] });
    expect(scopedAssociation.status).toBe(200);

    const duplicateScopedName = await Subject.create({
      name: 'Ａdvanced biology',
      universityId: university._id,
      isActive: true,
    }).then(() => null, (error: unknown) => error);
    expect(duplicateScopedName).toMatchObject({ code: 11000 });

    const cannotLeaveScope = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ displayName: 'Tutor A', bio: '', universityId: null });
    expect(cannotLeaveScope.status).toBe(422);

    const removeScopedSubject = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [globalSubject.toString()] });
    expect(removeScopedSubject.status).toBe(200);
    const leaveScope = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ displayName: 'Tutor A', bio: '', universityId: null });
    expect(leaveScope.status).toBe(200);
    expect(leaveScope.body.universityId).toBeNull();

    const empty = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ subjectIds: [] });
    expect(empty.status).toBe(200);
    expect(empty.body.subjectIds).toEqual([]);
    expect((await User.findById(otherAccount.userId))?.role).toBe('USER');
  });

  it('validates recurring availability, rejects overlaps, and supports owner edits/removal', async () => {
    const owner = await createAccount();
    const stranger = await createAccount();
    const { id: profileId, response: createdProfile } = await createProfile(owner.token);
    expect(createdProfile.status).toBe(201);

    for (const invalid of [
      { ...mondayWindow, dayOfWeek: 7 },
      { ...mondayWindow, startTime: '11:00', endTime: '11:00' },
      { ...mondayWindow, startTime: '22:00', endTime: '02:00' },
      { ...mondayWindow, timeZone: 'Not/A_Timezone' },
    ]) {
      const response = await addAvailability(owner.token, invalid);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const created = await addAvailability(owner.token);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...mondayWindow, id: expect.any(String) });

    const adjacent = await addAvailability(owner.token, {
      ...mondayWindow,
      startTime: '11:00',
      endTime: '12:00',
    });
    expect(adjacent.status).toBe(201);

    const overlap = await addAvailability(owner.token, {
      ...mondayWindow,
      startTime: '10:59',
      endTime: '12:00',
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('CONFLICT');

    const list = await request(requestApp)
      .get('/api/tutors/me/availabilities')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);

    const anotherOwner = await request(requestApp)
      .patch(`/api/tutors/me/availabilities/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ startTime: '13:00' });
    expect(anotherOwner.status).toBe(404);

    const updated = await request(requestApp)
      .patch(`/api/tutors/me/availabilities/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ startTime: '08:00' });
    expect(updated.status).toBe(200);
    expect(updated.body.startTime).toBe('08:00');

    const badUpdate = await request(requestApp)
      .patch(`/api/tutors/me/availabilities/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ endTime: '07:00' });
    expect(badUpdate.status).toBe(422);

    const removed = await request(requestApp)
      .delete(`/api/tutors/me/availabilities/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(removed.status).toBe(204);
    expect(await RecurringAvailability.countDocuments({ tutorProfileId: profileId })).toBe(1);
  });

  it('requires bio, valid subjects, and availability before publication', async () => {
    const owner = await createAccount();
    await createProfile(owner.token, { bio: '' });

    const noBio = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(noBio.status).toBe(422);
    expect(noBio.body.error.details[0].path).toBe('bio');

    await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ displayName: 'Tutor A', bio: 'A helpful tutor' });
    const subjectId = await createSubject({ name: 'Chemistry' });

    const noSubject = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(noSubject.status).toBe(422);
    expect(noSubject.body.error.details[0].path).toBe('subjectIds');

    await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ subjectIds: [subjectId.toString()] });

    const noAvailability = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(noAvailability.status).toBe(422);
    expect(noAvailability.body.error.details[0].path).toBe('availabilities');
  });

  it('publishes, unpublishes to DRAFT, permits republishing, and blocks suspended owners', async () => {
    const owner = await createAccount();
    const profileId = await preparePublishableProfile(owner.token);
    expect(await isTutorEligibleForRequests(owner.userId)).toBe(false);

    const published = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('ACTIVE');
    expect(await isTutorEligibleForRequests(owner.userId)).toBe(true);

    const repeatedPublish = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(repeatedPublish.status).toBe(409);

    const unpublished = await request(requestApp)
      .post('/api/tutors/me/unpublish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.status).toBe('DRAFT');
    expect(await isTutorEligibleForRequests(owner.userId)).toBe(false);

    const repeatedUnpublish = await request(requestApp)
      .post('/api/tutors/me/unpublish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(repeatedUnpublish.status).toBe(409);

    const republished = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(republished.status).toBe(200);
    expect(republished.body.status).toBe('ACTIVE');

    await TutorProfile.updateOne({ _id: profileId }, { $set: { status: 'SUSPENDED' } });
    const suspendedPublish = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    const suspendedUnpublish = await request(requestApp)
      .post('/api/tutors/me/unpublish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(suspendedPublish.status).toBe(409);
    expect(suspendedUnpublish.status).toBe(409);
    expect(await isTutorEligibleForRequests(owner.userId)).toBe(false);
  });

  it('returns only public fields for active in-scope profiles and hides draft/suspended/out-of-scope profiles', async () => {
    const universityA = await University.create({ name: 'University A' });
    const universityB = await University.create({ name: 'University B' });
    const owner = await createAccount();
    const sameScopeViewer = await createAccount();
    const otherScopeViewer = await createAccount();
    const globalViewer = await createAccount();
    const globalSubject = await createSubject({ name: 'Public Mathematics' });
    const universitySubject = await createSubject({
      name: 'University Mathematics',
      universityId: universityA._id,
      code: 'MAT-A',
    });
    const eventuallyInactiveSubject = await createSubject({ name: 'Hidden subject' });

    const { id: draftId } = await createProfile(owner.token, {
      displayName: 'Private Tutor Name',
      bio: 'Private draft text',
    });
    const draftPublicRead = await request(requestApp)
      .get(`/api/tutors/${draftId}`)
      .set('Authorization', `Bearer ${globalViewer.token}`);
    expect(draftPublicRead.status).toBe(404);

    const scopedProfile = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        displayName: 'Public Tutor',
        bio: 'Public tutoring biography',
        universityId: universityA._id.toString(),
      });
    expect(scopedProfile.status).toBe(200);
    const scopedProfileId = scopedProfile.body.id as string;
    const scopedUser = await User.findById(owner.userId);
    expect(scopedUser).not.toBeNull();
    const subjectUpdate = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        subjectIds: [
          globalSubject.toString(),
          universitySubject.toString(),
          eventuallyInactiveSubject.toString(),
        ],
      });
    expect(subjectUpdate.status).toBe(200);
    await addAvailability(owner.token);
    expect(
      (
        await request(requestApp)
          .post('/api/tutors/me/publish')
          .set('Authorization', `Bearer ${owner.token}`)
      ).status,
    ).toBe(200);
      await Subject.updateOne({ _id: eventuallyInactiveSubject }, { $set: { isActive: false } });

      for (const viewer of [sameScopeViewer, otherScopeViewer, globalViewer]) {
      const result = await request(requestApp)
        .get(`/api/tutors/${scopedProfileId}`)
        .set('Authorization', `Bearer ${viewer.token}`);
    expect(result.status).toBe(404);
    }

      const sameScopeProfile = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${sameScopeViewer.token}`)
      .send({
        displayName: 'Same University',
        bio: '',
        universityId: universityA._id.toString(),
      });
    expect(sameScopeProfile.status).toBe(201);
    const sameUniversityRead = await request(requestApp)
      .get(`/api/tutors/${scopedProfileId}`)
      .set('Authorization', `Bearer ${sameScopeViewer.token}`);
    expect(sameUniversityRead.status).toBe(200);
    expect(sameUniversityRead.body).toEqual({
      id: scopedProfileId,
      displayName: 'Public Tutor',
      bio: 'Public tutoring biography',
      universityId: universityA._id.toString(),
      subjects: expect.arrayContaining([
        { id: globalSubject.toString(), name: 'Public Mathematics' },
        { id: universitySubject.toString(), name: 'University Mathematics', code: 'MAT-A' },
      ]),
      availabilities: [expect.objectContaining(mondayWindow)],
    });
    expect(sameUniversityRead.body.subjects).toHaveLength(2);
    const serialized = JSON.stringify(sameUniversityRead.body);
    expect(serialized).not.toContain(owner.userId);
    expect(serialized).not.toContain(owner.email);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshToken');
    expect(serialized).not.toContain('accessToken');
    expect(await isTutorEligibleForRequests(owner.userId)).toBe(true);

    await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${otherScopeViewer.token}`)
      .send({
        displayName: 'Other University',
        bio: '',
        universityId: universityB._id.toString(),
      });
    const outOfScopeRead = await request(requestApp)
      .get(`/api/tutors/${scopedProfileId}`)
      .set('Authorization', `Bearer ${otherScopeViewer.token}`);
    expect(outOfScopeRead.status).toBe(404);

    await TutorProfile.updateOne({ _id: scopedProfileId }, { $set: { status: 'SUSPENDED' } });
    const suspendedRead = await request(requestApp)
      .get(`/api/tutors/${scopedProfileId}`)
      .set('Authorization', `Bearer ${sameScopeViewer.token}`);
    expect(suspendedRead.status).toBe(404);
    const ownerStillReadsSuspended = await request(requestApp)
      .get('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownerStillReadsSuspended.status).toBe(200);
    expect(ownerStillReadsSuspended.body.status).toBe('SUSPENDED');

    const globalOwner = await createAccount();
    const globalProfileId = await preparePublishableProfile(globalOwner.token);
    expect(
      (
        await request(requestApp)
          .post('/api/tutors/me/publish')
          .set('Authorization', `Bearer ${globalOwner.token}`)
      ).status,
    ).toBe(200);
    const globalVisibleToUniversity = await request(requestApp)
      .get(`/api/tutors/${globalProfileId}`)
      .set('Authorization', `Bearer ${otherScopeViewer.token}`);
    expect(globalVisibleToUniversity.status).toBe(200);
  });

  it('requires authentication and hides missing or malformed public profile IDs', async () => {
    const unauthenticated = await request(requestApp).get(`/api/tutors/${new Types.ObjectId()}`);
    expect(unauthenticated.status).toBe(401);

    const viewer = await createAccount();
    const missing = await request(requestApp)
      .get(`/api/tutors/${new Types.ObjectId()}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(missing.status).toBe(404);

    const malformed = await request(requestApp)
      .get('/api/tutors/not-an-object-id')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(malformed.status).toBe(422);
  });

  it('rejects admin tokens on owner-only tutor routes', async () => {
    const admin = await createAccount();
    await User.updateOne({ _id: admin.userId }, { $set: { role: 'ADMIN' } });
    const login = await request(requestApp)
      .post('/api/auth/login')
      .send({ email: admin.email, password });
    expect(login.status).toBe(200);

    const response = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ displayName: 'Admin tutor', bio: '' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('lists active subjects in the caller’s scope with validated pagination', async () => {
    const universityA = await University.create({ name: 'University A' });
    const universityB = await University.create({ name: 'University B' });
    const universityC = await University.create({ name: 'University C' });
    const viewer = await createAccount();
    const globalViewer = await createAccount();
    const emptyViewer = await createAccount();
    await setUserUniversity(viewer.userId, universityA._id);
    await setUserUniversity(emptyViewer.userId, universityC._id);

    await createSubject({ name: '  Algebra  ', code: 'ALG' });
    await createSubject({ name: 'Biology', universityId: universityA._id });
    await createSubject({ name: 'Biology' });
    await createSubject({ name: 'Chemistry', universityId: universityB._id });
    await createSubject({ name: 'Dormant', universityId: universityA._id, isActive: false });

    expect((await request(requestApp).get('/api/subjects')).status).toBe(401);
    const invalidCredential = await request(requestApp)
      .get('/api/subjects')
      .set('Authorization', 'Bearer invalid');
    expect(invalidCredential.status).toBe(401);

    const scoped = await request(requestApp)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(scoped.body.items).toEqual([
      expect.objectContaining({
        name: 'Algebra',
        code: 'ALG',
        universityId: null,
      }),
      expect.objectContaining({
        name: 'Biology',
        universityId: universityA._id.toString(),
      }),
      expect.objectContaining({
        name: 'Biology',
        universityId: null,
      }),
    ]);
    expect(scoped.body.items[0]).not.toHaveProperty('normalizedName');
    expect(scoped.body.items[0]).not.toHaveProperty('isActive');
    expect(
      scoped.body.items.slice(1).map((item: { id: string }) => item.id),
    ).toEqual(scoped.body.items.slice(1).map((item: { id: string }) => item.id).sort());

    const firstPage = await request(requestApp)
      .get('/api/subjects?page=1&limit=1')
      .set('Authorization', `Bearer ${viewer.token}`);
    const secondPage = await request(requestApp)
      .get('/api/subjects?page=2&limit=1')
      .set('Authorization', `Bearer ${viewer.token}`);
    const beyondLastPage = await request(requestApp)
      .get('/api/subjects?page=4&limit=1')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.total).toBe(3);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].name).toBe('Biology');
    expect(beyondLastPage.body).toMatchObject({ items: [], page: 4, limit: 1, total: 3 });

    const globalOnly = await request(requestApp)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${globalViewer.token}`);
    expect(globalOnly.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Algebra',
      'Biology',
    ]);
    await Subject.deleteMany({});
    const empty = await request(requestApp)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${emptyViewer.token}`);
    expect(empty.body).toMatchObject({ items: [], page: 1, limit: 20, total: 0 });

    for (const query of [
      '?page=0',
      '?page=not-a-number',
      '?page=9007199254740991',
      '?limit=0',
      '?limit=101',
      '?limit=1.5',
      '?sort=name_asc',
    ]) {
      const invalid = await request(requestApp)
        .get(`/api/subjects${query}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(invalid.status).toBe(422);
      expect(invalid.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }
  });

  it('searches public active tutors with scope, filters, ratings, pagination and allowlisted sorts', async () => {
    const universityA = await University.create({ name: 'University A' });
    const universityB = await University.create({ name: 'University B' });
    const viewer = await createAccount();
    await setUserUniversity(viewer.userId, universityA._id);
    const globalSubject = await createSubject({ name: 'Algebra', code: 'ALG' });
    const subjectA = await createSubject({ name: 'Biology', universityId: universityA._id });
    const subjectB = await createSubject({ name: 'Chemistry', universityId: universityB._id });
    const inactiveSubject = await createSubject({
      name: 'Dormant',
      universityId: universityA._id,
      isActive: false,
    });

    const ownTutorId = await createActiveTutor(viewer.token, {
      displayName: 'Own Tutor',
      subjectIds: [globalSubject, subjectA],
    });
    const globalTutor = await createAccount();
    const globalTutorId = await createActiveTutor(globalTutor.token, {
      displayName: 'Global Tutor',
      subjectIds: [globalSubject],
    });
    const universityTutor = await createAccount();
    await setUserUniversity(universityTutor.userId, universityA._id);
    const universityTutorId = await createActiveTutor(universityTutor.token, {
      displayName: 'Alpha Tutor',
      subjectIds: [globalSubject, subjectA],
      averageRating: 4.5,
      reviewCount: 2,
    });
    const tuesdayTutor = await createAccount();
    await setUserUniversity(tuesdayTutor.userId, universityA._id);
    const tuesdayTutorId = await createActiveTutor(tuesdayTutor.token, {
      displayName: 'Tuesday Tutor',
      subjectIds: [subjectA],
      daysOfWeek: [2],
    });
    const outsideTutor = await createAccount();
    await setUserUniversity(outsideTutor.userId, universityB._id);
    await createActiveTutor(outsideTutor.token, {
      displayName: 'Outside Tutor',
      subjectIds: [subjectB],
    });

    const draftTutor = await createAccount();
    await setUserUniversity(draftTutor.userId, universityA._id);
    const draftProfile = await createProfile(draftTutor.token, { displayName: 'Draft Tutor' });
    expect(draftProfile.response.status).toBe(201);

    const suspendedTutor = await createAccount();
    const suspendedId = await createActiveTutor(suspendedTutor.token, {
      displayName: 'Suspended Tutor',
      subjectIds: [globalSubject],
    });
    await TutorProfile.updateOne({ _id: suspendedId }, { $set: { status: 'SUSPENDED' } });
    await TutorProfile.updateOne(
      { _id: globalTutorId },
      { $unset: { averageRating: 1, reviewCount: 1 } },
    );

    const firstRatedAvailability = await addAvailability(universityTutor.token, {
      ...mondayWindow,
      startTime: '13:00',
      endTime: '14:00',
    });
    expect(firstRatedAvailability.status).toBe(201);
    const exception = await request(requestApp)
      .post('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${tuesdayTutor.token}`)
      .send({
        date: localDateForWeekday(2, 'Europe/Paris'),
        kind: 'BLOCK_DAY',
        timeZone: 'Europe/Paris',
      });
    expect(exception.status).toBe(201);

    const unauthorized = await request(requestApp).get('/api/tutors');
    expect(unauthorized.status).toBe(401);
    const invalidCredential = await request(requestApp)
      .get('/api/tutors')
      .set('Authorization', 'Bearer invalid');
    expect(invalidCredential.status).toBe(401);

    const result = await request(requestApp)
      .get('/api/tutors')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(result.body.items.map((item: { id: string }) => item.id)).toEqual([
      universityTutorId,
      ...[tuesdayTutorId, globalTutorId].sort(),
    ]);
    expect(result.body.items.map((item: { id: string }) => item.id)).not.toContain(ownTutorId);
    const card = result.body.items[0];
    expect(Object.keys(card).sort()).toEqual(
      ['id', 'displayName', 'bio', 'universityId', 'subjects', 'averageRating', 'reviewCount'].sort(),
    );
    expect(card.subjects).toEqual([
      expect.objectContaining({ id: globalSubject.toString(), name: 'Algebra', universityId: null }),
      expect.objectContaining({
        id: subjectA.toString(),
        name: 'Biology',
        universityId: universityA._id.toString(),
      }),
    ]);
    const serializedCards = JSON.stringify(result.body);
    for (const privateEmail of [
      viewer.email,
      globalTutor.email,
      universityTutor.email,
      tuesdayTutor.email,
      outsideTutor.email,
      draftTutor.email,
      suspendedTutor.email,
    ]) {
      expect(serializedCards).not.toContain(privateEmail);
    }
    expect(serializedCards).not.toContain('passwordHash');
    expect(serializedCards).not.toContain('userId');
    expect(serializedCards).not.toContain('accessToken');
    expect(serializedCards).not.toContain('refreshToken');
    expect(serializedCards).not.toContain('availabilityExceptions');
    expect(card).not.toHaveProperty('status');
    expect(card).not.toHaveProperty('availabilities');
    expect(card).not.toHaveProperty('exceptions');

    const noReviewsMinimumZero = await request(requestApp)
      .get('/api/tutors?minRating=0')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(noReviewsMinimumZero.body.total).toBe(3);
    expect(
      noReviewsMinimumZero.body.items.find((item: { id: string }) => item.id === globalTutorId),
    ).toMatchObject({ averageRating: 0, reviewCount: 0 });
    const positiveRating = await request(requestApp)
      .get('/api/tutors?minRating=0.1')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(positiveRating.body.items.map((item: { id: string }) => item.id)).toEqual([universityTutorId]);

    const subjectFilter = await request(requestApp)
      .get(`/api/tutors?subjectId=${subjectA.toString()}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(subjectFilter.body.total).toBe(2);
    const combinedFilter = await request(requestApp)
      .get(`/api/tutors?subjectId=${subjectA.toString()}&minRating=4&dayOfWeek=1`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(combinedFilter.body.items.map((item: { id: string }) => item.id)).toEqual([
      universityTutorId,
    ]);
    const weekdayFilter = await request(requestApp)
      .get('/api/tutors?dayOfWeek=2')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(weekdayFilter.body.items.map((item: { id: string }) => item.id)).toEqual([
      tuesdayTutorId,
    ]);
    const recurringDayIgnoresDateException = await request(requestApp)
      .get('/api/tutors?dayOfWeek=2')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(recurringDayIgnoresDateException.body.total).toBe(1);

    for (const unavailableSubjectId of [
      subjectB.toString(),
      inactiveSubject.toString(),
      new Types.ObjectId().toString(),
    ]) {
      const unavailable = await request(requestApp)
        .get(`/api/tutors?subjectId=${unavailableSubjectId}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(unavailable.status).toBe(200);
      expect(unavailable.body).toMatchObject({ items: [], total: 0 });
    }
    const noUniversityViewer = await createAccount();
    const globalOnly = await request(requestApp)
      .get('/api/tutors')
      .set('Authorization', `Bearer ${noUniversityViewer.token}`);
    expect(globalOnly.body.items.map((item: { id: string }) => item.id)).toEqual([globalTutorId]);

    const nameSorted = await request(requestApp)
      .get('/api/tutors?sort=name_asc')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(nameSorted.body.items.map((item: { id: string }) => item.id)).toEqual([
      universityTutorId,
      globalTutorId,
      tuesdayTutorId,
    ]);
    const newestSorted = await request(requestApp)
      .get('/api/tutors?sort=newest')
      .set('Authorization', `Bearer ${viewer.token}`);
    const expectedNewest = await TutorProfile.find({
      _id: { $in: [globalTutorId, universityTutorId, tuesdayTutorId] },
    })
      .sort({ createdAt: -1, _id: -1 })
      .select('_id')
      .lean();
    expect(newestSorted.body.items.map((item: { id: string }) => item.id)).toEqual(
      expectedNewest.map((profile) => profile._id.toString()),
    );

    const firstPage = await request(requestApp)
      .get('/api/tutors?page=1&limit=2')
      .set('Authorization', `Bearer ${viewer.token}`);
    const nextPage = await request(requestApp)
      .get('/api/tutors?page=2&limit=2')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(firstPage.body).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(firstPage.body.items).toHaveLength(2);
    expect(nextPage.body.items).toHaveLength(1);
    expect(
      (await TutorProfile.findById(ownTutorId))?.averageRating,
    ).toBe(0);

    const forgedRating = await request(requestApp)
      .put('/api/tutors/me/profile')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ displayName: 'Own Tutor', bio: 'forged', averageRating: 5, reviewCount: 100 });
    expect(forgedRating.status).toBe(422);
    expect(
      (await TutorProfile.findById(ownTutorId))?.reviewCount,
    ).toBe(0);

    for (const query of [
      '?subjectId=not-an-id',
      '?minRating=-1',
      '?minRating=5.1',
      '?minRating=not-a-number',
      '?dayOfWeek=7',
      '?dayOfWeek=1.5',
      '?page=0',
      '?page=9007199254740991',
      '?limit=0',
      '?limit=101',
      '?sort=private',
      '?unknown=value',
    ]) {
      const invalid = await request(requestApp)
        .get(`/api/tutors${query}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(invalid.status).toBe(422);
      expect(invalid.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }
  }, 20_000);

  it('creates, lists, updates and deletes only the authenticated tutor’s exceptions', async () => {
    const owner = await createAccount();
    const otherOwner = await createAccount();
    const ownerProfile = await createProfile(owner.token);
    const otherProfile = await createProfile(otherOwner.token);
    const date = localDateOffset(2);
    const blockDay = {
      date,
      kind: 'BLOCK_DAY',
      timeZone: 'Pacific/Kiritimati',
    };

    expect((await request(requestApp).get('/api/tutors/me/exceptions')).status).toBe(401);
    const empty = await request(requestApp)
      .get('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ items: [] });

    const created = await request(requestApp)
      .post('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(blockDay);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: expect.any(String),
      ...blockDay,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(created.body).not.toHaveProperty('startTime');
    expect(created.body).not.toHaveProperty('endTime');
    expect(created.body).not.toHaveProperty('tutorProfileId');
    expect(JSON.stringify(created.body)).not.toContain(owner.userId);
    expect((await AvailabilityException.findById(created.body.id))?.tutorProfileId.toString()).toBe(
      ownerProfile.id,
    );

    const otherList = await request(requestApp)
      .get('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${otherOwner.token}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body).toEqual({ items: [] });

    const otherCannotPatch = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${created.body.id as string}`)
      .set('Authorization', `Bearer ${otherOwner.token}`)
      .send({ date: localDateOffset(3) });
    expect(otherCannotPatch.status).toBe(404);
    expect(otherCannotPatch.body.error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      details: [],
    });
    const otherCannotDelete = await request(requestApp)
      .delete(`/api/tutors/me/exceptions/${created.body.id as string}`)
      .set('Authorization', `Bearer ${otherOwner.token}`);
    expect(otherCannotDelete.status).toBe(404);
    expect(otherProfile.id).not.toBe(ownerProfile.id);

    const updated = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${created.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: localDateOffset(3) });
    expect(updated.status).toBe(200);
    expect(updated.body.date).toBe(localDateOffset(3));

    const deleted = await request(requestApp)
      .delete(`/api/tutors/me/exceptions/${created.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);
    const repeatedDelete = await request(requestApp)
      .delete(`/api/tutors/me/exceptions/${created.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(repeatedDelete.status).toBe(404);
  });

  it('validates exception fields, merged updates and local dates while allowing overlapping blocks', async () => {
    const owner = await createAccount();
    await createProfile(owner.token);
    const date = localDateOffset(2);
    const timeZone = 'Pacific/Kiritimati';
    const invalidRequests = [
      { date, kind: 'BLOCK_DAY', timeZone, startTime: '09:00' },
      { date, kind: 'BLOCK_TIME', timeZone, startTime: '09:00' },
      { date, kind: 'BLOCK_TIME', timeZone, startTime: '11:00', endTime: '10:00' },
      { date, kind: 'BLOCK_TIME', timeZone, startTime: '23:00', endTime: '01:00' },
      { date, kind: 'BLOCK_TIME', timeZone, startTime: '9:00', endTime: '10:00' },
      { date, kind: 'BLOCK_TIME', timeZone: 'Not/A_Timezone', startTime: '09:00', endTime: '10:00' },
      { date: '2025-02-30', kind: 'BLOCK_DAY', timeZone },
      { date: 'not-a-date', kind: 'BLOCK_DAY', timeZone },
      { date: localDateOffset(-2, timeZone), kind: 'BLOCK_DAY', timeZone },
      { date: localDateOffset(-2, timeZone), kind: 'BLOCK_TIME', timeZone, startTime: '09:00', endTime: '10:00' },
      { date, kind: 'OTHER', timeZone },
      { ...{ date, kind: 'BLOCK_DAY', timeZone }, tutorProfileId: new Types.ObjectId().toString() },
    ];

    for (const body of invalidRequests) {
      const response = await request(requestApp)
        .post('/api/tutors/me/exceptions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(body);
      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const first = await request(requestApp)
      .post('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date, kind: 'BLOCK_TIME', timeZone, startTime: '09:00', endTime: '11:00' });
    const overlapping = await request(requestApp)
      .post('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date, kind: 'BLOCK_TIME', timeZone, startTime: '10:00', endTime: '12:00' });
    expect(first.status).toBe(201);
    expect(overlapping.status).toBe(201);

    const invalidMergedTime = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ endTime: '08:00' });
    expect(invalidMergedTime.status).toBe(422);
    const invalidMergedDate = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ date: localDateOffset(-2, timeZone) });
    expect(invalidMergedDate.status).toBe(422);

    const changedToDay = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ kind: 'BLOCK_DAY' });
    expect(changedToDay.status).toBe(200);
    expect(changedToDay.body.kind).toBe('BLOCK_DAY');
    expect(changedToDay.body).not.toHaveProperty('startTime');
    expect(changedToDay.body).not.toHaveProperty('endTime');

    const invalidDayTime = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ startTime: '09:00' });
    expect(invalidDayTime.status).toBe(422);
    const incompleteKindChange = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ kind: 'BLOCK_TIME' });
    expect(incompleteKindChange.status).toBe(422);

    const changedToTime = await request(requestApp)
      .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ kind: 'BLOCK_TIME', startTime: '12:00', endTime: '13:00' });
    expect(changedToTime.status).toBe(200);
    expect(changedToTime.body).toMatchObject({
      kind: 'BLOCK_TIME',
      startTime: '12:00',
      endTime: '13:00',
    });
    expect(
      (await request(requestApp)
        .patch(`/api/tutors/me/exceptions/${first.body.id as string}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({})).status,
    ).toBe(422);

    const list = await request(requestApp)
      .get('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.map((item: { id: string }) => item.id)).toEqual([
      overlapping.body.id,
      first.body.id,
    ]);
  });

  it('keeps exceptions separate from recurring availability and publication requirements', async () => {
    const owner = await createAccount();
    await createProfile(owner.token, { bio: 'A tutor biography' });
    const subjectId = await createSubject({ name: 'Algebra' });
    const subjects = await request(requestApp)
      .put('/api/tutors/me/subjects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ subjectIds: [subjectId.toString()] });
    expect(subjects.status).toBe(200);

    const date = localDateOffset(2);
    const exception = await request(requestApp)
      .post('/api/tutors/me/exceptions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        date,
        kind: 'BLOCK_TIME',
        timeZone: 'Pacific/Kiritimati',
        startTime: '09:00',
        endTime: '11:00',
      });
    expect(exception.status).toBe(201);

    const cannotPublishWithExceptionOnly = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(cannotPublishWithExceptionOnly.status).toBe(422);
    expect(cannotPublishWithExceptionOnly.body.error.details).toContainEqual(
      expect.objectContaining({ path: 'availabilities' }),
    );
    expect(await RecurringAvailability.countDocuments()).toBe(0);

    const recurring = await addAvailability(owner.token);
    expect(recurring.status).toBe(201);
    const published = await request(requestApp)
      .post('/api/tutors/me/publish')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(published.status).toBe(200);

    const availabilityList = await request(requestApp)
      .get('/api/tutors/me/availabilities')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(availabilityList.status).toBe(200);
    expect(availabilityList.body.items).toEqual([
      expect.objectContaining(mondayWindow),
    ]);
    expect(await RecurringAvailability.countDocuments()).toBe(1);
    expect(await AvailabilityException.countDocuments()).toBe(1);
  });
});
