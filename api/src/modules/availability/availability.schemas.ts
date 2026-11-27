import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format.')
  .refine(isCalendarDate, 'Expected a valid calendar date.');

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

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const dateAndZone = {
  date: dateSchema,
  timeZone: timeZoneSchema,
};

const blockDaySchema = z
  .object({
    ...dateAndZone,
    kind: z.literal('BLOCK_DAY'),
  })
  .strict()
  .refine(({ date, timeZone }) => !isPastLocalDate(date, timeZone), {
    message: 'date must be today or later in the supplied time zone.',
    path: ['date'],
  });

const blockTimeSchema = z
  .object({
    ...dateAndZone,
    kind: z.literal('BLOCK_TIME'),
    startTime: localTimeSchema,
    endTime: localTimeSchema,
  })
  .strict()
  .refine(({ date, timeZone }) => !isPastLocalDate(date, timeZone), {
    message: 'date must be today or later in the supplied time zone.',
    path: ['date'],
  })
  .refine(({ startTime, endTime }) => startTime < endTime, {
    message: 'endTime must be later than startTime on the same local date.',
    path: ['endTime'],
  });

export const availabilityExceptionInputSchema = z.discriminatedUnion('kind', [
  blockDaySchema,
  blockTimeSchema,
]);

export const availabilityExceptionPatchSchema = z
  .object({
    date: dateSchema.optional(),
    kind: z.enum(['BLOCK_DAY', 'BLOCK_TIME']).optional(),
    timeZone: timeZoneSchema.optional(),
    startTime: localTimeSchema.optional(),
    endTime: localTimeSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one exception field is required.',
  });

export const availabilityExceptionIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ObjectId.');

export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionInputSchema>;
export type AvailabilityExceptionPatch = z.infer<typeof availabilityExceptionPatchSchema>;

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isPastLocalDate(date: string, timeZone: string): boolean {
  let today: string;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = new Map(parts.map(({ type, value }) => [type, value]));
    today = `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
  return date < today;
}
