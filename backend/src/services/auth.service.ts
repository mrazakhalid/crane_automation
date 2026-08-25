import { toPublicUser, type PublicUser } from '../models/user.model.js';
import * as userRepo from '../repositories/user.repository.js';
import type { LoginInput, UpdateCredentialsInput } from '../schemas/auth.schema.js';
import { badRequest, conflict, unauthorized } from '../utils/http-error.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './token.js';

/**
 * Auth service (business logic — ignorant of HTTP and of the driver).
 *
 * Purpose: Own login and self-service credential changes.
 */

/**
 * Authenticate a user and issue a JWT.
 *
 * Args: input — validated `{ username, password }`.
 * Returns: `{ token, user }` on success.
 * Raises: 401 when the username is unknown or the password is wrong (same
 *   message for both, to avoid leaking which usernames exist).
 */
export async function login(
  input: LoginInput,
): Promise<{ token: string; user: PublicUser }> {
  const record = await userRepo.findByUsername(input.username);
  const ok = record ? await verifyPassword(input.password, record.passwordHash) : false;
  if (!record || !ok) throw unauthorized('Invalid username or password');

  const token = signToken({ sub: record._id, username: record.username, role: record.role });
  return { token, user: toPublicUser(record) };
}

/**
 * Change the calling user's own username and/or password.
 *
 * Args: userId — the authenticated user's id; input — validated partial creds.
 * Returns: The updated `PublicUser`.
 * Raises: 400 if the user vanished; 409 if the new username is taken.
 */
export async function changeOwnCredentials(
  userId: string,
  input: UpdateCredentialsInput,
): Promise<PublicUser> {
  const patch: { username?: string; passwordHash?: string; updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };

  if (input.username !== undefined) {
    const existing = await userRepo.findByUsername(input.username);
    if (existing && existing._id !== userId) throw conflict('Username already taken');
    patch.username = input.username;
  }
  if (input.password !== undefined) {
    patch.passwordHash = await hashPassword(input.password);
  }

  const updated = await userRepo.updateUser(userId, patch);
  if (!updated) throw badRequest('User no longer exists');
  return toPublicUser(updated);
}
