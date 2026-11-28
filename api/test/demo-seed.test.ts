import argon2 from 'argon2';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetDemoRecords,
  runDemoSeed,
  seedDemoRecords,
  validateDemoSeedEnvironment,
  type DemoCredentials,
} from '../src/scripts/demo-seed.js';
import { AvailabilityException } from '../src/modules/availability/models/availability-exception.js';
import { RecurringAvailability } from '../src/modules/availability/models/recurring-availability.js';
import { User } from '../src/modules/auth/models/user.js';
import { Subject } from '../src/modules/subjects/models/subject.js';
import { TutorProfile } from '../src/modules/tutors/models/tutor-profile.js';
import { University } from '../src/modules/universities/models/university.js';

const credentials: DemoCredentials = {
  learnerEmail: 'demo-learner@example.test',
  learnerPassword: 'local-learner-password',
  tutorEmail: 'demo-tutor@example.test',
  tutorPassword: 'local-tutor-password',
  adminEmail: 'demo-admin@example.test',
  adminPassword: 'local-admin-password',
};

describe('demo seed', () => {
  let replicaSet: MongoMemoryReplSet | undefined;
  let mongoUri: string;

  beforeAll(async () => {
    const runningReplicaSet = new MongoMemoryReplSet({
      instanceOpts: [{ launchTimeout: 60_000 }],
      replSet: { count: 1 },
    });
    replicaSet = runningReplicaSet;
    await runningReplicaSet.start();
    mongoUri = runningReplicaSet.getUri('studybuddy_demo');
    await mongoose.connect(mongoUri);
    await Promise.all([
      University.init(),
      User.init(),
      Subject.init(),
      TutorProfile.init(),
      RecurringAvailability.init(),
      AvailabilityException.init(),
    ]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      AvailabilityException.deleteMany({}),
      RecurringAvailability.deleteMany({}),
      TutorProfile.deleteMany({}),
      Subject.deleteMany({}),
      User.deleteMany({}),
      University.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });

  it('is repeatable, hashes all demo passwords with Argon2id, and preserves unrelated data', async () => {
    const unrelatedUniversity = await University.create({ name: 'Unrelated University' });
    const unrelatedSubject = await Subject.create({
      name: 'Unrelated Subject',
      universityId: unrelatedUniversity._id,
    });
    const unrelatedUser = await User.create({
      email: 'unrelated@example.test',
      passwordHash: 'unrelated-test-hash',
      role: 'USER',
    });

    await seedDemoRecords(credentials);
    const initialCounts = await readCollectionCounts();
    await seedDemoRecords(credentials);

    expect(await readCollectionCounts()).toEqual(initialCounts);
    expect(await User.countDocuments()).toBe(4);
    expect(await TutorProfile.countDocuments()).toBe(1);
    expect(await RecurringAvailability.countDocuments()).toBe(1);
    expect(await AvailabilityException.countDocuments()).toBe(1);
    expect(await University.findById(unrelatedUniversity._id)).not.toBeNull();
    expect(await Subject.findById(unrelatedSubject._id)).not.toBeNull();
    expect(await User.findById(unrelatedUser._id)).not.toBeNull();

    const accounts = await User.find({
      email: { $in: [credentials.learnerEmail, credentials.tutorEmail, credentials.adminEmail] },
    })
      .select('+passwordHash')
      .sort({ role: 1, email: 1 })
      .lean();
    expect(accounts.map((account) => account.role).sort()).toEqual(['ADMIN', 'USER', 'USER']);
    const expectedPasswords = new Map([
      [credentials.learnerEmail, credentials.learnerPassword],
      [credentials.tutorEmail, credentials.tutorPassword],
      [credentials.adminEmail, credentials.adminPassword],
    ]);
    expect(
      await Promise.all(
        accounts.map((account) =>
          argon2.verify(account.passwordHash, expectedPasswords.get(account.email) ?? ''),
        ),
      ),
    ).toEqual([true, true, true]);
    expect(accounts.every((account) => account.passwordHash.startsWith('$argon2id$'))).toBe(true);

    const tutorAccount = accounts.find((account) => account.email === credentials.tutorEmail);
    if (!tutorAccount) throw new Error('Demo tutor account was not seeded.');
    const profile = await TutorProfile.findOne({ userId: tutorAccount._id });
    expect(profile).toMatchObject({
      status: 'ACTIVE',
      displayName: 'Alex Morgan',
      averageRating: 0,
      reviewCount: 0,
    });
    expect(profile?.subjectIds).toHaveLength(2);
    const exception = await AvailabilityException.findOne();
    expect(exception?.kind).toBe('BLOCK_TIME');
    expect(exception?.timeZone).toBe('Europe/Paris');
    expect(exception?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 20_000);

  it('removes only reserved demo records when reset is explicitly requested', async () => {
    const unrelatedUniversity = await University.create({ name: 'Unrelated University' });
    const unrelatedSubject = await Subject.create({
      name: 'Unrelated Subject',
      universityId: unrelatedUniversity._id,
    });
    const unrelatedUser = await User.create({
      email: 'unrelated@example.test',
      passwordHash: 'unrelated-test-hash',
      role: 'USER',
    });
    await seedDemoRecords(credentials);

    await resetDemoRecords(credentials);

    expect(await User.countDocuments()).toBe(1);
    expect(await Subject.countDocuments()).toBe(1);
    expect(await TutorProfile.countDocuments()).toBe(0);
    expect(await RecurringAvailability.countDocuments()).toBe(0);
    expect(await AvailabilityException.countDocuments()).toBe(0);
    expect(await University.countDocuments()).toBe(1);
    expect(await User.findById(unrelatedUser._id)).not.toBeNull();
    expect(await Subject.findById(unrelatedSubject._id)).not.toBeNull();
    expect(await University.findById(unrelatedUniversity._id)).not.toBeNull();
  });

  it('rejects unsafe configuration before connecting and gives actionable, non-secret errors', () => {
    const source = seedEnvironment(mongoUri);

    expect(() =>
      validateDemoSeedEnvironment({ ...source, NODE_ENV: 'production' }),
    ).toThrow('disabled when NODE_ENV is production');
    expect(() =>
      validateDemoSeedEnvironment({ ...source, DEMO_SEED_ENABLED: 'false' }),
    ).toThrow('Set DEMO_SEED_ENABLED=true');
    expect(() =>
      validateDemoSeedEnvironment({
        ...source,
        MONGODB_URI: 'mongodb://example.com/studybuddy_demo',
      }),
    ).toThrow('only connects to MongoDB on this computer');
    expect(() =>
      validateDemoSeedEnvironment({
        ...source,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/studybuddy',
      }),
    ).toThrow('must target the studybuddy_demo database');

    const missingPassword = validateSeedFailure({
      ...source,
      DEMO_ADMIN_PASSWORD: '',
    });
    expect(missingPassword).toContain('DEMO_ADMIN_PASSWORD');
    expect(missingPassword).not.toContain(credentials.adminPassword);
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('does not connect when the executable seed command is disabled or in production', async () => {
    const source = seedEnvironment(mongoUri);
    const connect = vi.spyOn(mongoose, 'connect');
    try {
      await expect(
        runDemoSeed({ ...source, NODE_ENV: 'production' }),
      ).rejects.toThrow('disabled when NODE_ENV is production');
      await expect(
        runDemoSeed({ ...source, DEMO_SEED_ENABLED: 'false' }),
      ).rejects.toThrow('Set DEMO_SEED_ENABLED=true');
      expect(connect).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
    }
  });
});

async function readCollectionCounts(): Promise<Record<string, number>> {
  const [
    universities,
    users,
    subjects,
    profiles,
    availabilities,
    exceptions,
  ] = await Promise.all([
    University.countDocuments(),
    User.countDocuments(),
    Subject.countDocuments(),
    TutorProfile.countDocuments(),
    RecurringAvailability.countDocuments(),
    AvailabilityException.countDocuments(),
  ]);
  return { universities, users, subjects, profiles, availabilities, exceptions };
}

function seedEnvironment(uri: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: uri,
    ACCESS_TOKEN_SECRET: 'demo-seed-test-secret-with-at-least-32-characters',
    DEMO_SEED_ENABLED: 'true',
    DEMO_LEARNER_EMAIL: credentials.learnerEmail,
    DEMO_LEARNER_PASSWORD: credentials.learnerPassword,
    DEMO_TUTOR_EMAIL: credentials.tutorEmail,
    DEMO_TUTOR_PASSWORD: credentials.tutorPassword,
    DEMO_ADMIN_EMAIL: credentials.adminEmail,
    DEMO_ADMIN_PASSWORD: credentials.adminPassword,
  };
}

function validateSeedFailure(source: NodeJS.ProcessEnv): string {
  try {
    validateDemoSeedEnvironment(source);
  } catch (error) {
    return error instanceof Error ? error.message : 'Unexpected validation error.';
  }
  throw new Error('Expected demo seed configuration validation to fail.');
}
