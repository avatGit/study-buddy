import mongoose, { Types, type PipelineStage } from 'mongoose';
import { ApiError } from '../../common/api-error.js';
import { paginatedList, paginationOffset } from '../../common/pagination.js';
import type { AuthClaims } from '../auth/auth.types.js';
import { User } from '../auth/models/user.js';
import { Subject } from '../subjects/models/subject.js';
import type { TutorSearchQuery, TutorSearchSort } from './tutor-search.schemas.js';
import { TutorProfile } from './models/tutor-profile.js';

type TutorCardSource = {
  _id: Types.ObjectId;
  displayName: string;
  bio: string;
  subjectIds: Types.ObjectId[];
  averageRating: number;
  reviewCount: number;
  universityId: Types.ObjectId | null;
};

type TutorSearchAggregation = {
  metadata: { total: number }[];
  items: TutorCardSource[];
};

const tutorSorts = {
  rating_desc: { averageRating: -1, reviewCount: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  name_asc: { displayName: 1, _id: 1 },
} satisfies Record<TutorSearchSort, Record<string, 1 | -1>>;

export async function searchTutors(
  claims: AuthClaims,
  query: TutorSearchQuery,
): Promise<Record<string, unknown>> {
  const viewer = await User.findById(claims.sub).select('universityId').lean();
  if (!viewer) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const universityIds = viewer.universityId ? [null, viewer.universityId] : [null];

  const subjectId = query.subjectId ? new Types.ObjectId(query.subjectId) : undefined;
  if (
    subjectId &&
    !(await Subject.exists({
      _id: subjectId,
      isActive: true,
      universityId: { $in: universityIds },
    }))
  ) {
    return paginatedList([], query, 0);
  }

  const match: mongoose.FilterQuery<InstanceType<typeof TutorProfile>> = {
    status: 'ACTIVE',
    userId: { $ne: new Types.ObjectId(claims.sub) },
    ...(subjectId ? { subjectIds: subjectId } : {}),
    ...(query.minRating === undefined || query.minRating === 0
      ? {}
      : { averageRating: { $gte: query.minRating } }),
  };
  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        let: { ownerId: '$userId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$ownerId'] } } },
          { $project: { universityId: 1 } },
        ],
        as: 'owner',
      },
    },
    { $unwind: '$owner' },
    { $match: { 'owner.universityId': { $in: universityIds } } },
  ];

  if (query.dayOfWeek !== undefined) {
    pipeline.push(
      {
        $lookup: {
          from: 'recurringAvailabilities',
          let: { profileId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$tutorProfileId', '$$profileId'] },
                    { $eq: ['$dayOfWeek', query.dayOfWeek] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'matchingAvailability',
        },
      },
      { $match: { 'matchingAvailability.0': { $exists: true } } },
    );
  }

  pipeline.push({
    $addFields: {
      averageRating: { $ifNull: ['$averageRating', 0] },
      reviewCount: { $ifNull: ['$reviewCount', 0] },
    },
  });
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      items: [
        { $sort: tutorSorts[query.sort] },
        { $skip: paginationOffset(query) },
        { $limit: query.limit },
        {
          $project: {
            _id: 1,
            displayName: 1,
            bio: 1,
            subjectIds: 1,
            averageRating: 1,
            reviewCount: 1,
            universityId: { $ifNull: ['$owner.universityId', null] },
          },
        },
      ],
    },
  });

  const [result] = await TutorProfile.aggregate<TutorSearchAggregation>(pipeline);
  const profiles = result?.items ?? [];
  const subjectIds = [...new Set(profiles.flatMap(({ subjectIds }) => subjectIds))];
  const subjects = subjectIds.length
    ? await Subject.find({
        _id: { $in: subjectIds },
        isActive: true,
        universityId: { $in: universityIds },
      })
        .select('name normalizedName code universityId')
        .sort({ normalizedName: 1, _id: 1 })
        .lean()
    : [];
  const subjectsById = new Map(subjects.map((subject) => [subject._id.toString(), subject]));
  const subjectOrder = new Map(
    subjects.map((subject, index) => [subject._id.toString(), index]),
  );
  const items = profiles.map((profile) => ({
    id: profile._id.toString(),
    displayName: profile.displayName,
    bio: profile.bio,
    universityId: profile.universityId?.toString() ?? null,
    subjects: profile.subjectIds
      .map((id) => subjectsById.get(id.toString()))
      .filter((subject) => subject !== undefined)
      .sort(
        (left, right) =>
          (subjectOrder.get(left._id.toString()) ?? 0) -
          (subjectOrder.get(right._id.toString()) ?? 0),
      )
      .map((subject) => ({
        id: subject._id.toString(),
        name: subject.name,
        ...(subject.code === undefined ? {} : { code: subject.code }),
        universityId: subject.universityId?.toString() ?? null,
      })),
    averageRating: profile.averageRating,
    reviewCount: profile.reviewCount,
  }));

  return paginatedList(items, query, result?.metadata[0]?.total ?? 0);
}
