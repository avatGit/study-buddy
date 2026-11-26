import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).max(128),
});

export const registerSchema = credentialsSchema;
export const loginSchema = credentialsSchema;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const logoutSchema = z.undefined();

export type Credentials = z.infer<typeof credentialsSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
