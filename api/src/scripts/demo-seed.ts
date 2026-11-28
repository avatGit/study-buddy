import argon2 from 'argon2';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import { loadEnvironment, type Environment } from '../config/env.js';
import { AvailabilityException } from '../modules/availability/models/availability-exception.js';
import { RecurringAvailability } from '../modules/availability/models/recurring-availability.js';
import { User, type UserRole } from '../modules/auth/models/user.js';
import { Subject, normalizeSubjectNameValue } from '../modules/subjects/models/subject.js';
import { TutorProfile } from '../modules/tutors/models/tutor-profile.js';
import { University } from '../modules/universities/models/university.js';

const DEMO_DATABASE_NAME = 'studybuddy_demo';
const UNIVERSITY_NAME = 'Northbridge University';
const TUTOR_DISPLAY_NAME = 'Alex Morgan';
const TUTOR_BIO = 'Peer tutor offering friendly mathematics and physics support.';
const TIME_ZONE = 'Europe/Paris';

const recordIds = {
  university: new Types.ObjectId('670000000000000000000001'),
  globalSubject: new Types.ObjectId('670000000000000000000002'),
  universitySubject: new Types.ObjectId('670000000000000000000003'),
  learner: new Types.ObjectId('670000000000000000000011'),
  tutor: new Types.ObjectId('670000000000000000000012'),
  admin: new Types.ObjectId('670000000000000000000013'),
  tutorProfile: new Types.ObjectId('670000000000000000000021'),
  recurringAvailability: new Types.ObjectId('670000000000000000000031'),
  availabilityException: new Types.ObjectId('670000000000000000000041'),
};

const demoCredentialsSchema = z
  .object({
    DEMO_LEARNER_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    DEMO_LEARNER_PASSWORD: z.string().min(8).max(128),
    DEMO_TUTOR_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    DEMO_TUTOR_PASSWORD: z.string().min(8).max(128),
    DEMO_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    DEMO_ADMIN_PASSWORD: z.string().min(8).max(128),
  })
  .superRefine((credentials, context) => {
    const emails = [
      credentials.DEMO_LEARNER_EMAIL,
      credentials.DEMO_TUTOR_EMAIL,
      credentials.DEMO_ADMIN_EMAIL,
    ];
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: 'custom',
        path: ['DEMO_LEARNER_EMAIL', 'DEMO_TUTOR_EMAIL', 'DEMO_ADMIN_EMAIL'],
        message: 'Demo account emails must be different.',
      });
    }
  });

export interface DemoCredentials {
  learnerEmail: string;
  learnerPassword: string;
  tutorEmail: string;
  tutorPassword: string;
  adminEmail: string;
  adminPassword: string;
}

export interface DemoSeedConfiguration {
  environment: Environment;
  credentials: DemoCredentials;
}

export class DemoSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoSeedError';
  }
}

export function validateDemoSeedEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): DemoSeedConfiguration {
  if (source.NODE_ENV === 'production') {
    throw new DemoSeedError('Demo seeding is disabled when NODE_ENV is production.');
  }
  if (source.DEMO_SEED_ENABLED !== 'true') {
    throw new DemoSeedError('Set DEMO_SEED_ENABLED=true in the local .env to opt in.');
  }

  let environment: Environment;
  try {
    environment = loadEnvironment(source);
  } catch {
    throw new DemoSeedError(
      'The API environment is invalid. Check the required settings in .env against .env.example.',
    );
  }

  const credentialsResult = demoCredentialsSchema.safeParse(source);
  if (!credentialsResult.success) {
    const fields = new Set(
      credentialsResult.error.issues.flatMap((issue) => issue.path.map(String)),
    );
    throw new DemoSeedError(
      `Set valid demo account values in .env for: ${[...fields].join(', ')}.`,
    );
  }

  validateLocalDemoDatabase(environment.MONGODB_URI);
  const credentials = credentialsResult.data;
  return {
    environment,
    credentials: {
      learnerEmail: credentials.DEMO_LEARNER_EMAIL,
      learnerPassword: credentials.DEMO_LEARNER_PASSWORD,
      tutorEmail: credentials.DEMO_TUTOR_EMAIL,
      tutorPassword: credentials.DEMO_TUTOR_PASSWORD,
      adminEmail: credentials.DEMO_ADMIN_EMAIL,
      adminPassword: credentials.DEMO_ADMIN_PASSWORD,
    },
  };
}

export async function runDemoSeed(
  source: NodeJS.ProcessEnv = process.env,
  operation: 'seed' | 'reset' = 'seed',
): Promise<void> {
  const configuration = validateDemoSeedEnvironment(source);
  try {
    await mongoose.connect(configuration.environment.MONGODB_URI);
    if (mongoose.connection.db?.databaseName !== DEMO_DATABASE_NAME) {
      throw new DemoSeedError(`The connected database must be named ${DEMO_DATABASE_NAME}.`);
    }

    if (operation === 'reset') {
      await resetDemoRecords(configuration.credentials);
    } else {
      await seedDemoRecords(configuration.credentials);
    }
  } catch (error) {
    if (error instanceof DemoSeedError) throw error;
    if (isDuplicateKeyError(error)) {
      throw new DemoSeedError(
        'Demo seeding found a uniqueness conflict. Check the demo emails and existing records in the dedicated demo database.',
      );
    }
    throw new DemoSeedError(
      'Demo seeding failed while connecting to or writing the local demo database. Check MongoDB availability and the existing demo records.',
    );
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

export async function seedDemoRecords(credentials: DemoCredentials): Promise<void> {
  await initializeModels();
  await assertSeedRecordsAreSafe(credentials);

  const accounts = accountSeeds(credentials);
  const passwordHashes = await Promise.all(
    accounts.map(async (account) => {
      const existing = await User.findById(account.id).select('+passwordHash').lean();
      if (
        existing?.passwordHash &&
        (await argon2.verify(existing.passwordHash, account.password))
      ) {
        return existing.passwordHash;
      }
      return argon2.hash(account.password, { type: argon2.argon2id });
    }),
  );

  await University.updateOne(
    { _id: recordIds.university },
    { $set: { name: UNIVERSITY_NAME, isActive: true } },
    { upsert: true, runValidators: true },
  );

  await Promise.all([
    upsertSubject({
      id: recordIds.globalSubject,
      name: 'Mathematics',
      code: 'MATH',
      universityId: null,
    }),
    upsertSubject({
      id: recordIds.universitySubject,
      name: 'Physics',
      code: 'PHYS',
      universityId: recordIds.university,
    }),
  ]);

  await Promise.all(
    accounts.map((account, index) =>
      User.updateOne(
        { _id: account.id },
        {
          $set: {
            email: account.email,
            passwordHash: passwordHashes[index],
            role: account.role,
            universityId: account.universityId,
          },
        },
        { upsert: true, runValidators: true },
      ),
    ),
  );

  await TutorProfile.updateOne(
    { _id: recordIds.tutorProfile },
    {
      $set: {
        userId: recordIds.tutor,
        displayName: TUTOR_DISPLAY_NAME,
        bio: TUTOR_BIO,
        subjectIds: [recordIds.globalSubject, recordIds.universitySubject],
        status: 'ACTIVE',
        averageRating: 0,
        reviewCount: 0,
      },
    },
    { upsert: true, runValidators: true },
  );

  await RecurringAvailability.updateOne(
    { _id: recordIds.recurringAvailability },
    {
      $set: {
        tutorProfileId: recordIds.tutorProfile,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        timeZone: TIME_ZONE,
      },
    },
    { upsert: true, runValidators: true },
  );

  await AvailabilityException.updateOne(
    { _id: recordIds.availabilityException },
    {
      $set: {
        tutorProfileId: recordIds.tutorProfile,
        date: dateOffsetInTimeZone(TIME_ZONE, 7),
        kind: 'BLOCK_TIME',
        timeZone: TIME_ZONE,
        startTime: '10:00',
        endTime: '11:00',
      },
    },
    { upsert: true, runValidators: true },
  );
}

export async function resetDemoRecords(credentials: DemoCredentials): Promise<void> {
  await initializeModels();
  await assertSeedRecordsAreSafe(credentials);

  await Promise.all([
    AvailabilityException.deleteOne({ _id: recordIds.availabilityException }),
    RecurringAvailability.deleteOne({ _id: recordIds.recurringAvailability }),
  ]);
  await TutorProfile.deleteOne({ _id: recordIds.tutorProfile });
  await User.deleteMany({
    _id: { $in: [recordIds.learner, recordIds.tutor, recordIds.admin] },
  });
  await Subject.deleteMany({
    _id: { $in: [recordIds.globalSubject, recordIds.universitySubject] },
  });
  await University.deleteOne({ _id: recordIds.university });
}

async function initializeModels(): Promise<void> {
  await Promise.all([
    University.init(),
    User.init(),
    Subject.init(),
    TutorProfile.init(),
    RecurringAvailability.init(),
    AvailabilityException.init(),
  ]);
}

async function assertSeedRecordsAreSafe(credentials: DemoCredentials): Promise<void> {
  const existingUniversity = await University.findById(recordIds.university).lean();
  if (existingUniversity && existingUniversity.name !== UNIVERSITY_NAME) {
    throw new DemoSeedError('A reserved demo university ID is already used by another record.');
  }
  if (
    await University.exists({
      _id: { $ne: recordIds.university },
      name: UNIVERSITY_NAME,
    })
  ) {
    throw new DemoSeedError('A university with the reserved demo name already exists.');
  }

  await assertSubjectCanBeSeeded({
    id: recordIds.globalSubject,
    name: 'Mathematics',
    universityId: null,
  });
  await assertSubjectCanBeSeeded({
    id: recordIds.universitySubject,
    name: 'Physics',
    universityId: recordIds.university,
  });

  const accounts = accountSeeds(credentials);
  for (const account of accounts) {
    const existing = await User.findById(account.id).select('email role universityId').lean();
    if (
      existing &&
      (existing.email !== account.email ||
        existing.role !== account.role ||
        objectIdOrNull(existing.universityId) !== objectIdOrNull(account.universityId))
    ) {
      throw new DemoSeedError(`A reserved demo ${account.label} account ID is already in use.`);
    }

    const accountWithEmail = await User.findOne({ email: account.email }).select('_id').lean();
    if (accountWithEmail && !accountWithEmail._id.equals(account.id)) {
      throw new DemoSeedError(
        `The demo ${account.label} email is already used by another account. Choose a different email.`,
      );
    }
  }

  const existingProfile = await TutorProfile.findById(recordIds.tutorProfile)
    .select('userId')
    .lean();
  if (existingProfile && !existingProfile.userId.equals(recordIds.tutor)) {
    throw new DemoSeedError('A reserved demo tutor profile ID is already used by another record.');
  }
  const profileForTutor = await TutorProfile.findOne({ userId: recordIds.tutor })
    .select('_id')
    .lean();
  if (profileForTutor && !profileForTutor._id.equals(recordIds.tutorProfile)) {
    throw new DemoSeedError('The demo tutor account already has a different tutor profile.');
  }

  const existingAvailability = await RecurringAvailability.findById(
    recordIds.recurringAvailability,
  )
    .select('tutorProfileId')
    .lean();
  if (
    existingAvailability &&
    !existingAvailability.tutorProfileId.equals(recordIds.tutorProfile)
  ) {
    throw new DemoSeedError('A reserved demo availability ID is already used by another record.');
  }
  const overlappingAvailability = await RecurringAvailability.exists({
    tutorProfileId: recordIds.tutorProfile,
    dayOfWeek: 1,
    startTime: { $lt: '12:00' },
    endTime: { $gt: '09:00' },
    _id: { $ne: recordIds.recurringAvailability },
  });
  if (overlappingAvailability) {
    throw new DemoSeedError(
      'An existing availability overlaps the reserved demo window; resolve it before seeding.',
    );
  }

  const existingException = await AvailabilityException.findById(
    recordIds.availabilityException,
  )
    .select('tutorProfileId')
    .lean();
  if (existingException && !existingException.tutorProfileId.equals(recordIds.tutorProfile)) {
    throw new DemoSeedError('A reserved demo exception ID is already used by another record.');
  }
}

async function assertSubjectCanBeSeeded(subject: {
  id: Types.ObjectId;
  name: string;
  universityId: Types.ObjectId | null;
}): Promise<void> {
  const existing = await Subject.findById(subject.id).select('name universityId').lean();
  if (
    existing &&
    (existing.name !== subject.name ||
      objectIdOrNull(existing.universityId) !== objectIdOrNull(subject.universityId))
  ) {
    throw new DemoSeedError('A reserved demo subject ID is already used by another record.');
  }

  const duplicate = await Subject.findOne({
    _id: { $ne: subject.id },
    universityId: subject.universityId,
    normalizedName: normalizeSubjectNameValue(subject.name),
  })
    .select('_id')
    .lean();
  if (duplicate) {
    throw new DemoSeedError(
      `A subject with the reserved demo name already exists in its scope: ${subject.name}.`,
    );
  }
}

async function upsertSubject(input: {
  id: Types.ObjectId;
  name: string;
  code: string;
  universityId: Types.ObjectId | null;
}): Promise<void> {
  await Subject.updateOne(
    { _id: input.id },
    {
      $set: {
        name: input.name,
        normalizedName: normalizeSubjectNameValue(input.name),
        code: input.code,
        universityId: input.universityId,
        isActive: true,
      },
    },
    { upsert: true, runValidators: true },
  );
}

function accountSeeds(credentials: DemoCredentials): {
  id: Types.ObjectId;
  email: string;
  password: string;
  role: UserRole;
  universityId: Types.ObjectId | null;
  label: string;
}[] {
  return [
    {
      id: recordIds.learner,
      email: credentials.learnerEmail,
      password: credentials.learnerPassword,
      role: 'USER',
      universityId: recordIds.university,
      label: 'learner',
    },
    {
      id: recordIds.tutor,
      email: credentials.tutorEmail,
      password: credentials.tutorPassword,
      role: 'USER',
      universityId: recordIds.university,
      label: 'tutor',
    },
    {
      id: recordIds.admin,
      email: credentials.adminEmail,
      password: credentials.adminPassword,
      role: 'ADMIN',
      universityId: null,
      label: 'admin',
    },
  ];
}

function validateLocalDemoDatabase(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new DemoSeedError('MONGODB_URI must point to a local studybuddy_demo database.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(host)
  ) {
    throw new DemoSeedError('Demo seeding only connects to MongoDB on this computer.');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    throw new DemoSeedError('MONGODB_URI must point to a local studybuddy_demo database.');
  }
  if (databaseName !== DEMO_DATABASE_NAME) {
    throw new DemoSeedError(`MONGODB_URI must target the ${DEMO_DATABASE_NAME} database.`);
  }
}

function objectIdOrNull(value: Types.ObjectId | null | undefined): string | null {
  return value?.toString() ?? null;
}

function dateOffsetInTimeZone(timeZone: string, offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const date = new Date(
    `${values.get('year')}-${values.get('month')}-${values.get('day')}T00:00:00.000Z`,
  );
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
