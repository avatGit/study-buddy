import type { Environment } from '../../config/env.js';
import type { UserRole } from './models/user.js';

export type AuthConfig = Pick<
  Environment,
  'ACCESS_TOKEN_SECRET' | 'ACCESS_TOKEN_TTL' | 'REFRESH_TOKEN_TTL_DAYS'
>;

export interface AuthClaims {
  sub: string;
  sid: string;
  role: UserRole;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  fullName: string | null;
  email: string;
  role: UserRole;
  universityId: string | null;
}
