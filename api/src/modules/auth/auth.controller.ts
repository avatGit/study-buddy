import type { RequestHandler } from 'express';
import { ApiError } from '../../common/api-error.js';
import type { AuthConfig } from './auth.types.js';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from './auth.schemas.js';
import { loginUser, refreshTokens, registerUser, revokeSession } from './auth.service.js';

export function createAuthController(config: AuthConfig): {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
} {
  return {
    register: async (req, res) => {
      const input = registerSchema.parse(req.body);
      const result = await registerUser(input, config);
      res.status(201).json(result);
    },
    login: async (req, res) => {
      const credentials = loginSchema.parse(req.body);
      const result = await loginUser(credentials, config);
      res.status(200).json(result);
    },
    refresh: async (req, res) => {
      const input = refreshSchema.parse(req.body);
      const result = await refreshTokens(input.refreshToken, config);
      res.status(200).json(result);
    },
    logout: async (req, res) => {
      if (hasRequestBody(req)) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Logout does not accept a request body.', [
          { path: 'body', message: 'A request body is not allowed.' },
        ]);
      }
      logoutSchema.parse(req.body);
      if (!req.auth) {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }

      await revokeSession(req.auth);
      res.status(204).end();
    },
  };
}

function hasRequestBody(req: Parameters<RequestHandler>[0]): boolean {
  const contentLength = Number(req.get('content-length') ?? 0);
  return contentLength > 0 || req.get('transfer-encoding') !== undefined;
}
