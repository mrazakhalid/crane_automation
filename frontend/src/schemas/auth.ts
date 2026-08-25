import * as z from 'zod';
import { ROLES } from '../types/auth.js';

/**
 * Frontend validation schemas (UX mirror only).
 *
 * Purpose: Give instant, friendly form feedback. The backend remains the source
 *   of truth — these bounds intentionally match `backend/src/schemas`.
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginForm = z.infer<typeof loginSchema>;

const username = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(32, 'At most 32 characters')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, underscore, hyphen only');

const password = z
  .string()
  .min(6, 'At least 6 characters')
  .max(128, 'At most 128 characters');

/**
 * Create-user form (super-admin supplies role + username + password + confirm).
 * Role has no default — a value must be picked, and the two passwords must match.
 */
export const createUserSchema = z
  .object({
    role: z.enum(ROLES, { error: 'Please select a role' }),
    username,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type CreateUserForm = z.infer<typeof createUserSchema>;

/**
 * Credential-change form. Fields are optional individually but at least one is
 * required; blank strings are treated as "leave unchanged". When a new password
 * is given, the confirmation must match.
 */
export const credentialsSchema = z
  .object({
    username: z.union([z.literal(''), username]),
    password: z.union([z.literal(''), password]),
    confirmPassword: z.string(),
  })
  .refine((v) => v.username !== '' || v.password !== '', {
    message: 'Enter a new username, a new password, or both',
    path: ['username'],
  })
  .refine((v) => v.password === '' || v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type CredentialsForm = z.infer<typeof credentialsSchema>;
