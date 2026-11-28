import { ApiError } from '../../common/api-error.js';
import type { AuthClaims, PublicUser } from '../auth/auth.types.js';
import { serializeUser } from '../auth/auth.service.js';
import { User } from '../auth/models/user.js';

export async function getCurrentUser(claims: AuthClaims): Promise<PublicUser> {
  const user = await User.findById(claims.sub)
    .select('fullName email role universityId')
    .lean();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');

  return serializeUser(user);
}
