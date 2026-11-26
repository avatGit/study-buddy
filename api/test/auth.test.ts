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

const email = 'learner@example.test';
const password = 'correct horse battery staple';
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
    await Promise.all([User.init(), AuthSession.init()]);
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AuthSession.deleteMany({})]);
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
      .send({ email: ' Learner@Example.Test ', password, role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email,
        role: 'USER',
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
      .send({ email: 'not-an-email', password: 'short' });

    expect(invalid.status).toBe(422);
    expect(invalid.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });

    const first = await request(app)
      .post('/api/auth/register')
      .send({ email, password });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatchObject({
      code: 'CONFLICT',
      status: 409,
    });
  });

  it('logs in with the stored role and uses the same generic error for invalid credentials', async () => {
    await request(app).post('/api/auth/register').send({ email, password, role: 'ADMIN' });
    expect((await User.findOne({ email }))?.role).toBe('USER');
    await User.updateOne({ email }, { $set: { role: 'ADMIN' } });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ email, role: 'ADMIN' });
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
    const registration = await request(app).post('/api/auth/register').send({ email, password });
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
    const registration = await request(app).post('/api/auth/register').send({ email, password });
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
    const registration = await request(app).post('/api/auth/register').send({ email, password });
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
    const registration = await request(app).post('/api/auth/register').send({ email, password });
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
