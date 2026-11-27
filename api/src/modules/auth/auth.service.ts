import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { SignJWT } from 'jose';
import { ApiError } from '../../common/api-error.js';
import type { AuthClaims, AuthConfig, AuthResponse } from './auth.types.js';
import type { Credentials } from './auth.schemas.js';
import { AuthSession } from './models/auth-session.js';
import { User, type UserFields } from './models/user.js';

const dummyPasswordHash = argon2.hash(randomBytes(32).toString('base64url'), {
  type: argon2.argon2id,
});

export async function registerUser(
  credentials: Credentials,
  config: AuthConfig,
): Promise<AuthResponse> {
  await Promise.all([User.init(), AuthSession.init()]);
  const passwordHash = await argon2.hash(credentials.password, { type: argon2.argon2id });
  const user = new User({
    email: credentials.email,
    passwordHash,
    role: 'USER',
  });
  const sessionId = new Types.ObjectId();
  const refreshToken = createRefreshToken();
  const expiresAt = refreshTokenExpiry(config);
  const accessToken = await createAccessToken(user, sessionId, config);

  try {
    await mongoose.connection.transaction(async (session) => {
      await user.save({ session });
      await new AuthSession({
        _id: sessionId,
        userId: user._id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
      }).save({ session });
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, 'CONFLICT', 'An account with this email already exists.');
    }
    throw error;
  }

  return makeAuthResponse(user, accessToken, refreshToken);
}

export async function loginUser(
  credentials: Credentials,
  config: AuthConfig,
): Promise<AuthResponse> {
  await Promise.all([User.init(), AuthSession.init()]);
  const user = await User.findOne({ email: credentials.email }).select('+passwordHash');
  const hash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordMatches = await argon2.verify(hash, credentials.password);

  if (!user || !passwordMatches) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password.');
  }

  const sessionId = new Types.ObjectId();
  const refreshToken = createRefreshToken();
  const accessToken = await createAccessToken(user, sessionId, config);
  const session = new AuthSession({
    _id: sessionId,
    userId: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiry(config),
  });

  await session.save();
  return makeAuthResponse(user, accessToken, refreshToken);
}

export async function refreshTokens(
  token: string,
  config: AuthConfig,
): Promise<AuthResponse> {
  const now = new Date();
  const oldHash = hashRefreshToken(token);
  const currentSession = await AuthSession.findOne({
    refreshTokenHash: oldHash,
    expiresAt: { $gt: now },
    revokedAt: null,
  });

  if (!currentSession) {
    throw invalidRefreshToken();
  }

  const user = await User.findById(currentSession.userId);
  if (!user) {
    throw invalidRefreshToken();
  }

  const nextToken = createRefreshToken();
  const nextHash = hashRefreshToken(nextToken);
  const nextExpiresAt = refreshTokenExpiry(config, now);
  const accessToken = await createAccessToken(user, currentSession._id, config);
  const updatedSession = await AuthSession.findOneAndUpdate(
    {
      _id: currentSession._id,
      refreshTokenHash: oldHash,
      expiresAt: { $gt: now },
      revokedAt: null,
    },
    {
      $set: {
        refreshTokenHash: nextHash,
        expiresAt: nextExpiresAt,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedSession) {
    throw invalidRefreshToken();
  }

  return makeAuthResponse(user, accessToken, nextToken);
}

export async function revokeSession(claims: AuthClaims): Promise<void> {
  await AuthSession.updateOne(
    {
      _id: new Types.ObjectId(claims.sid),
      userId: new Types.ObjectId(claims.sub),
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } },
  );
}

async function createAccessToken(
  user: Pick<UserFields, 'role'> & { _id: Types.ObjectId },
  sessionId: Types.ObjectId,
  config: AuthConfig,
): Promise<string> {
  return new SignJWT({ sid: sessionId.toString(), role: user.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user._id.toString())
    .setIssuedAt()
    .setExpirationTime(config.ACCESS_TOKEN_TTL)
    .sign(new TextEncoder().encode(config.ACCESS_TOKEN_SECRET));
}

function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshTokenExpiry(config: AuthConfig, from = new Date()): Date {
  return new Date(from.getTime() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function makeAuthResponse(
  user: Pick<UserFields, 'email' | 'role'> & { _id: Types.ObjectId },
  accessToken: string,
  refreshToken: string,
): AuthResponse {
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

function invalidRefreshToken(): ApiError {
  return new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired refresh token.');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000 &&
    'keyPattern' in error &&
    typeof error.keyPattern === 'object' &&
    error.keyPattern !== null &&
    'email' in error.keyPattern
  );
}
