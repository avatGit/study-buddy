import { paginatedList, paginationOffset } from '../../common/pagination.js';
import { University } from './models/university.js';
import type { UniversityListQuery } from './university.schemas.js';

export async function listUniversities(
  query: UniversityListQuery,
): Promise<Record<string, unknown>> {
  const filter = { isActive: true };
  const [total, universities] = await Promise.all([
    University.countDocuments(filter),
    University.find(filter)
      .select('name')
      .sort({ name: 1, _id: 1 })
      .skip(paginationOffset(query))
      .limit(query.limit)
      .lean(),
  ]);

  return paginatedList(
    universities.map((university) => ({
      id: university._id.toString(),
      name: university.name,
    })),
    query,
    total,
  );
}
