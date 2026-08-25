import {
  ROLES,
  toPublicUser,
  type PublicUser,
  type UserRecord,
} from '../models/user.model.js';
import * as userRepo from '../repositories/user.repository.js';
import type { CreateUserInput, UpdateCredentialsInput } from '../schemas/auth.schema.js';
import { newId } from '../utils/id.js';
import { conflict, forbidden, notFoundError } from '../utils/http-error.js';
import { hashPassword } from './password.js';

/**
 * User-management service (super-admin only — business logic layer).
 *
 * Purpose: Create managed users with generated credentials, rotate their
 *   credentials, list them, and remove them. Guards ensure only managers and
 *   operators are ever touched here — super-admins are never created or edited
 *   through this path (that closes the privilege-escalation / IDOR hole).
 */

/**
 * List every user (super-admins, managers, operators) for the super-admin view.
 *
 * Note: listing includes super-admins so they can be seen, but the mutation
 *   helpers below still refuse to edit/delete a super-admin (no IDOR).
 */
export async function listUsers(): Promise<PublicUser[]> {
  const records = await userRepo.listByRoles([...ROLES]);
  return records.map(toPublicUser);
}

/**
 * Create a user (manager, operator, or another super-admin) with a
 * super-admin-supplied username + password.
 *
 * Args: input — validated `{ role, username, password }`.
 * Returns: The created `PublicUser` (never the password).
 * Raises: 409 if the username is already taken.
 */
export async function createManagedUser(input: CreateUserInput): Promise<PublicUser> {
  if (await userRepo.findByUsername(input.username)) {
    throw conflict('Username already taken');
  }

  const now = new Date().toISOString();
  const record: UserRecord = {
    _id: newId(),
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    createdAt: now,
    updatedAt: now,
  };
  await userRepo.insertUser(record);
  return toPublicUser(record);
}

/** Load a managed (non-super-admin) user or throw. Shared guard for edits. */
async function requireManagedUser(id: string): Promise<UserRecord> {
  const record = await userRepo.findById(id);
  if (!record) throw notFoundError('User not found');
  if (record.role === 'super_admin') throw forbidden('Cannot modify a super-admin here');
  return record;
}

/**
 * Change a managed user's username and/or password.
 *
 * Args: id — target user id; input — validated partial credentials.
 * Returns: The updated `PublicUser`.
 * Raises: 404 if absent, 403 if the target is a super-admin, 409 if the new
 *   username is taken.
 */
export async function changeUserCredentials(
  id: string,
  input: UpdateCredentialsInput,
): Promise<PublicUser> {
  await requireManagedUser(id);

  const patch: { username?: string; passwordHash?: string; updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };
  if (input.username !== undefined) {
    const existing = await userRepo.findByUsername(input.username);
    if (existing && existing._id !== id) throw conflict('Username already taken');
    patch.username = input.username;
  }
  if (input.password !== undefined) {
    patch.passwordHash = await hashPassword(input.password);
  }

  const updated = await userRepo.updateUser(id, patch);
  if (!updated) throw notFoundError('User not found');
  return toPublicUser(updated);
}

/**
 * Delete a managed user.
 *
 * Args: id — target user id.
 * Raises: 404 if absent, 403 if the target is a super-admin.
 */
export async function removeManagedUser(id: string): Promise<void> {
  await requireManagedUser(id);
  await userRepo.deleteUser(id);
}
