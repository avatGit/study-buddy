import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

export const loginSchema = credentialsSchema;

export const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1).max(120),
  universityId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Expected a valid university ID.')
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const logoutSchema = z.undefined();

export type Credentials = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
