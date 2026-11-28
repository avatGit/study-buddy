import { z } from 'zod';

const positiveIntegerQuery = z
  .string()
  .regex(/^\d+$/, 'Expected a positive integer.')
  .transform(Number)
  .pipe(z.number().int().safe().min(1));

export const subjectListQuerySchema = z
  .object({
    page: positiveIntegerQuery.optional(),
    limit: positiveIntegerQuery.pipe(z.number().max(100)).optional(),
  })
  .strict()
  .superRefine(validatePageOffset)
  .transform(({ page, limit }) => ({
    page: page ?? 1,
    limit: limit ?? 20,
  }));

export type SubjectListQuery = z.infer<typeof subjectListQuerySchema>;

function validatePageOffset(
  query: { page?: number | undefined; limit?: number | undefined },
  context: z.RefinementCtx,
): void {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  if (!Number.isSafeInteger((page - 1) * limit)) {
    context.addIssue({
      code: 'custom',
      path: ['page'],
      message: 'The requested page offset is too large.',
    });
  }
}
