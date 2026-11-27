import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ObjectId.');

export const profileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    bio: z.string().trim().max(5000),
    universityId: objectIdSchema.nullable().optional(),
  })
  .strict();

export const subjectIdsInputSchema = z
  .object({
    subjectIds: z.array(objectIdSchema).max(100),
  })
  .strict()
  .refine(({ subjectIds }) => new Set(subjectIds).size === subjectIds.length, {
    message: 'Subject IDs must not contain duplicates.',
    path: ['subjectIds'],
  });

const dayOfWeekSchema = z.number().int().min(0).max(6);
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch (error) {
      if (error instanceof RangeError) return false;
      throw error;
    }
  }, 'Expected a valid IANA time zone.');

export const availabilityInputSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    startTime: localTimeSchema,
    endTime: localTimeSchema,
    timeZone: timeZoneSchema,
  })
  .strict()
  .refine(({ startTime, endTime }) => startTime < endTime, {
    message: 'endTime must be later than startTime on the same weekday.',
    path: ['endTime'],
  });

export const availabilityPatchSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema.optional(),
    startTime: localTimeSchema.optional(),
    endTime: localTimeSchema.optional(),
    timeZone: timeZoneSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one availability field is required.',
  });

export const tutorProfileIdSchema = objectIdSchema;
export const availabilityIdSchema = objectIdSchema;

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type SubjectIdsInput = z.infer<typeof subjectIdsInputSchema>;
export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;
export type AvailabilityPatch = z.infer<typeof availabilityPatchSchema>;
