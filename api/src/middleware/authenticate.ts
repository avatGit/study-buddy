import { errors as joseErrors, jwtVerify } from 'jose';
import { Types } from 'mongoose';
import type { RequestHandler } from 'express';
import { ApiError } from '../common/api-error.js';
import type { AuthConfig, AuthClaims } from '../modules/auth/auth.types.js';

const unauthorized = (): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');

export function authenticate(config: AuthConfig): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer\s+([^\s]+)$/i.exec(req.get('authorization') ?? '');
    if (!match?.[1]) {
      next(unauthorized());
      return;
    }

    try {
      const { payload } = await jwtVerify(
        match[1],
        new TextEncoder().encode(config.ACCESS_TOKEN_SECRET),
        { algorithms: ['HS256'] },
      );
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        !Types.ObjectId.isValid(payload.sub) ||
        !Types.ObjectId.isValid(payload.sid) ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        payload.exp <= payload.iat ||
        (payload.role !== 'USER' && payload.role !== 'ADMIN')
      ) {
        next(unauthorized());
        return;
      }

      const claims: AuthClaims = {
        sub: payload.sub,
        sid: payload.sid,
        role: payload.role,
      };
      req.auth = claims;
      next();
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        next(unauthorized());
        return;
      }
      next(error);
    }
  };
}
