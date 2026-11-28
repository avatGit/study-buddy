import { z } from 'zod';

const positiveIntegerQuery = z
  .string()
  .regex(/^\d+$/, 'Expected a positive integer.')
  .transform(Number)
  .pipe(z.number().int().safe().min(1));

export const universityListQuerySchema = z
  .object({
    page: positiveIntegerQuery.optional(),
    limit: positiveIntegerQuery.pipe(z.number().max(100)).optional(),
  })
  .strict()
  .superRefine((query, context) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (!Number.isSafeInteger((page - 1) * limit)) {
      context.addIssue({
        code: 'custom',
        path: ['page'],
        message: 'The requested page offset is too large.',
      });
    }
  })
  .transform(({ page, limit }) => ({
    page: page ?? 1,
    limit: limit ?? 20,
  }));

export type UniversityListQuery = z.infer<typeof universityListQuerySchema>;
