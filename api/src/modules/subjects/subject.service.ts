import { ApiError } from '../../common/api-error.js';
import { paginatedList, paginationOffset } from '../../common/pagination.js';
import type { AuthClaims } from '../auth/auth.types.js';
import { User } from '../auth/models/user.js';
import { Subject } from './models/subject.js';
import type { SubjectListQuery } from './subject.schemas.js';

export async function listSubjects(
  claims: AuthClaims,
  query: SubjectListQuery,
): Promise<Record<string, unknown>> {
  const user = await User.findById(claims.sub).select('universityId').lean();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');

  const universityIds = user.universityId ? [null, user.universityId] : [null];
  const filter = {
    isActive: true,
    universityId: { $in: universityIds },
  };
  const [total, subjects] = await Promise.all([
    Subject.countDocuments(filter),
    Subject.find(filter)
      .select('name code universityId')
      .sort({ normalizedName: 1, _id: 1 })
      .skip(paginationOffset(query))
      .limit(query.limit)
      .lean(),
  ]);

  return paginatedList(
    subjects.map((subject) => ({
      id: subject._id.toString(),
      name: subject.name,
      ...(subject.code === undefined ? {} : { code: subject.code }),
      universityId: subject.universityId?.toString() ?? null,
    })),
    query,
    total,
  );
}
