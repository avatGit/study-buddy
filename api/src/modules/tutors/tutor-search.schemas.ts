import { z } from 'zod';

const positiveIntegerQuery = z
  .string()
  .regex(/^\d+$/, 'Expected a positive integer.')
  .transform(Number)
  .pipe(z.number().int().safe().min(1));

const objectIdQuery = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ObjectId.');

const ratingQuery = z
  .string()
  .regex(/^(?:\d+(?:\.\d+)?|\.\d+)$/, 'Expected a number from 0 through 5.')
  .transform(Number)
  .pipe(z.number().min(0).max(5));

export const tutorSearchQuerySchema = z
  .object({
    subjectId: objectIdQuery.optional(),
    minRating: ratingQuery.optional(),
    dayOfWeek: z
      .string()
      .regex(/^\d+$/, 'Expected a weekday from 0 through 6.')
      .transform(Number)
      .pipe(z.number().int().min(0).max(6))
      .optional(),
    page: positiveIntegerQuery.optional(),
    limit: positiveIntegerQuery.pipe(z.number().max(100)).optional(),
    sort: z.enum(['rating_desc', 'newest', 'name_asc']).optional(),
  })
  .strict()
  .superRefine(({ page, limit }, context) => {
    const currentPage = page ?? 1;
    const currentLimit = limit ?? 20;
    if (!Number.isSafeInteger((currentPage - 1) * currentLimit)) {
      context.addIssue({
        code: 'custom',
        path: ['page'],
        message: 'The requested page offset is too large.',
      });
    }
  })
  .transform((query) => ({
    ...query,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sort: query.sort ?? 'rating_desc',
  }));

export type TutorSearchQuery = z.infer<typeof tutorSearchQuerySchema>;
export type TutorSearchSort = TutorSearchQuery['sort'];
