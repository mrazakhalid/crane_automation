import * as z from 'zod';
import { ROLES } from '../models/user.model.js';

/**
 * Auth + user-management request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize every client body at the HTTP boundary. All use
 *   `strictObject` to reject unknown fields per the charter.
 */

// Shared field rules — reused by both create and update flows.
const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Only letters, numbers, dot, underscore, hyphen');

const password = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters');

/** POST /api/auth/login */
export const loginSchema = z.strictObject({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * POST /api/users — super-admin supplies the role, username, and password.
 * Any role may be created, including another super_admin.
 */
export const createUserSchema = z.strictObject({
  role: z.enum(ROLES),
  username,
  password,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * PATCH credentials (self or a managed user). At least one field must be present
 * — refined so an empty body is rejected with an actionable message.
 */
export const updateCredentialsSchema = z
  .strictObject({
    username: username.optional(),
    password: password.optional(),
  })
  .refine((v) => v.username !== undefined || v.password !== undefined, {
    message: 'Provide a new username, a new password, or both',
  });
export type UpdateCredentialsInput = z.infer<typeof updateCredentialsSchema>;

/** Route param: user id (UUID). */
export const userIdParamSchema = z.strictObject({
  id: z.uuid(),
});
