import argon2 from 'argon2';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { SignJWT, jwtVerify } from 'jose';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnvironment, type Environment } from '../src/config/env.js';
import { AuthSession } from '../src/modules/auth/models/auth-session.js';
import { User } from '../src/modules/auth/models/user.js';
import { University } from '../src/modules/universities/models/university.js';

const email = 'learner@example.test';
const password = 'correct horse battery staple';
const fullName = 'Learner Example';
const tokenSecret = 'integration-test-secret-not-for-production-32';

describe('authentication API', () => {
  let replicaSet: MongoMemoryReplSet | undefined;
  let app: Express;
  let config: Environment;

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
    await Promise.all([User.init(), AuthSession.init(), University.init()]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      AuthSession.deleteMany({}),
      University.deleteMany({}),
    ]);
    app = createApp(config);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) {
      await replicaSet.stop();
    }
  });

  it('registers a USER and returns tokens without storing or returning the password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ fullName: ` ${fullName} `, email: ' Learner@Example.Test ', password, role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        fullName,
        email,
        role: 'USER',
        universityId: null,
      },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain(password);

    const publicUser = await User.findById(response.body.user.id);
    expect(publicUser?.passwordHash).toBeUndefined();
    const storedUser = await User.findById(response.body.user.id).select('+passwordHash');
    expect(storedUser?.passwordHash).not.toBe(password);
    expect(await argon2.verify(storedUser?.passwordHash ?? '', password)).toBe(true);

    const storedSession = await AuthSession.findOne({ userId: response.body.user.id }).select(
      '+refreshTokenHash',
    );
    expect(storedSession?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedSession?.refreshTokenHash).not.toBe(response.body.refreshToken);

    const { payload } = await jwtVerify(
      response.body.accessToken,
      new TextEncoder().encode(tokenSecret),
      { algorithms: ['HS256'] },
    );
    expect(payload).toMatchObject({
      sub: response.body.user.id,
      sid: storedSession?._id.toString(),
      role: 'USER',
    });
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it('returns 422 for invalid registration fields and 409 for duplicate email', async () => {
    const invalid = await request(app)
      .post('/api/auth/register')
      .send({ fullName, email: 'not-an-email', password: 'short' });

    expect(invalid.status).toBe(422);
    expect(invalid.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });

    const first = await request(app)
      .post('/api/auth/register')
      .send({ fullName, email, password });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ fullName, email: email.toUpperCase(), password });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatchObject({
      code: 'CONFLICT',
      status: 409,
    });

  });

  it('requires and trims a sensible full name while allowing an optional active university', async () => {
    const university = await University.create({ name: 'Example University' });
    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: '  Zoë 李  ',
        email,
        password,
        universityId: university._id.toString(),
      });

    expect(registration.status).toBe(201);
    expect(registration.body.user).toMatchObject({
      fullName: 'Zoë 李',
      universityId: university._id.toString(),
    });
    expect((await User.findById(registration.body.user.id))?.fullName).toBe('Zoë 李');

    for (const [index, invalidFullName] of [undefined, '   ', 'x'.repeat(121)].entries()) {
      const invalid = await request(app)
        .post('/api/auth/register')
        .send({
          fullName: invalidFullName,
          email: `invalid-name-${index}@example.test`,
          password,
        });
      expect(invalid.status).toBe(422);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    }

    const inactive = await University.create({ name: 'Inactive University', isActive: false });
    const inactiveResult = await request(app)
      .post('/api/auth/register')
      .send({ fullName, email: 'inactive@example.test', password, universityId: inactive._id });
    const missingResult = await request(app)
      .post('/api/auth/register')
      .send({
        fullName,
        email: 'missing@example.test',
        password,
        universityId: '0123456789abcdef01234567',
      });
    const malformedResult = await request(app)
      .post('/api/auth/register')
      .send({
        fullName,
        email: 'malformed@example.test',
        password,
        universityId: 'not-an-object-id',
      });

    expect(inactiveResult.status).toBe(422);
    expect(missingResult.status).toBe(422);
    expect(malformedResult.status).toBe(422);
    expect(inactiveResult.body.error.code).toBe('VALIDATION_ERROR');
    expect(missingResult.body.error.code).toBe('VALIDATION_ERROR');
    expect(malformedResult.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists only active universities with deterministic paginated results', async () => {
    await University.create([
      { name: 'Zulu University' },
      { name: 'Alpha University' },
      { name: 'Hidden University', isActive: false },
    ]);

    const first = await request(app).get('/api/universities?limit=1');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      items: [{ name: 'Alpha University' }],
      page: 1,
      limit: 1,
      total: 2,
    });
    expect(first.body.items[0]).toEqual({
      id: expect.any(String),
      name: 'Alpha University',
    });

    const second = await request(app).get('/api/universities?page=2&limit=1');
    expect(second.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Zulu University',
    ]);

    await University.deleteMany({});
    const empty = await request(app).get('/api/universities');
    expect(empty.body).toMatchObject({ items: [], page: 1, limit: 20, total: 0 });

    for (const query of ['?page=0', '?limit=101', '?unexpected=1']) {
      const invalid = await request(app).get(`/api/universities${query}`);
      expect(invalid.status).toBe(422);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns a public current-user profile and requires authentication', async () => {
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ fullName, email, password });
    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(registration.body.user.id) },
      { $set: { internalNote: 'must not be returned' } },
    );

    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: registration.body.user });
    expect(JSON.stringify(response.body)).not.toContain('internalNote');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('refreshToken');

    for (const authorization of [undefined, 'Bearer invalid']) {
      const unauthorized = await request(app)
        .get('/api/users/me')
        .set('Authorization', authorization ?? '');
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('serializes legacy users with a null fullName on login and refresh', async () => {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const legacyUser = await User.create({ email, passwordHash, role: 'USER' });
    const login = await request(app).post('/api/auth/login').send({ email, password });

    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      id: legacyUser._id.toString(),
      fullName: null,
      email,
      role: 'USER',
      universityId: null,
    });

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.user).toEqual(login.body.user);
  });

  it('logs in with the stored role and uses the same generic error for invalid credentials', async () => {
    await request(app).post('/api/auth/register').send({ fullName, email, password, role: 'ADMIN' });
    expect((await User.findOne({ email }))?.role).toBe('USER');
    await User.updateOne({ email }, { $set: { role: 'ADMIN' } });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      id: expect.any(String),
      fullName,
      email,
      role: 'ADMIN',
      universityId: null,
    });
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.test', password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects missing, malformed, invalid-signature, and expired access tokens', async () => {
    const registration = await request(app).post('/api/auth/register').send({ fullName, email, password });
    const userId = registration.body.user.id as string;
    const sessionId = (
      await AuthSession.findOne({ userId }).select('_id')
    )?._id.toString();
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({ sid: sessionId, role: 'USER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt(now - 60)
      .setExpirationTime(now - 30)
      .sign(new TextEncoder().encode(tokenSecret));
    const invalidSignature = await new SignJWT({
      sid: sessionId,
      role: 'USER',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('1m')
      .sign(new TextEncoder().encode('different-test-secret-with-32-chars'));

    const missing = await request(app).post('/api/auth/logout');
    const malformed = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not-a-jwt');
    const invalid = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${invalidSignature}`);
    const expired = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`);

    for (const response of [missing, malformed, invalid, expired]) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rotates refresh tokens atomically and invalidates the previous token', async () => {
    const registration = await request(app).post('/api/auth/register').send({ fullName, email, password });
    const oldToken = registration.body.refreshToken as string;

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).not.toBe(oldToken);
    expect(refresh.body.user).toEqual(registration.body.user);

    const oldTokenReplay = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldToken });
    expect(oldTokenReplay.status).toBe(401);
    expect(oldTokenReplay.body.error.code).toBe('UNAUTHENTICATED');

    const latestTokenWorks = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh.body.refreshToken });
    expect(latestTokenWorks.status).toBe(200);
  });

  it('allows only one concurrent refresh and rejects invalid refresh tokens', async () => {
    const registration = await request(app).post('/api/auth/register').send({ fullName, email, password });
    const token = registration.body.refreshToken as string;

    const attempts = await Promise.all([
      request(app).post('/api/auth/refresh').send({ refreshToken: token }),
      request(app).post('/api/auth/refresh').send({ refreshToken: token }),
    ]);

    expect(attempts.map(({ status }) => status).sort()).toEqual([200, 401]);
    const invalid = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-random-token' });
    expect(invalid.status).toBe(401);

    const missing = await request(app).post('/api/auth/refresh').send({});
    expect(missing.status).toBe(422);
  });

  it('revokes refresh tokens on logout, accepts repeated logout, and rejects request bodies', async () => {
    const registration = await request(app).post('/api/auth/register').send({ fullName, email, password });
    const authorization = `Bearer ${registration.body.accessToken as string}`;

    const logoutWithBody = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', authorization)
      .send({});
    expect(logoutWithBody.status).toBe(422);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', authorization);
    expect(logout.status).toBe(204);
    expect(logout.text).toBe('');

    const refreshAfterLogout = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: registration.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);

    const repeatedLogout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', authorization);
    expect(repeatedLogout.status).toBe(204);
  });
});
