import { getStorage } from '../storage/index.js';
import type { Role, UserRecord } from '../models/user.model.js';

/**
 * User repository facade (data-access layer).
 *
 * Purpose: Stable entry point the services call. It forwards to the active
 *   storage driver's `UserStore` (Mongo or SQLite, chosen by `STORAGE_DRIVER`),
 *   so higher layers never know which backend is in use.
 */

/** Ensure a unique index/constraint on `username` (idempotent). */
export function ensureUserIndexes(): Promise<void> {
  return getStorage().users.ensureIndexes();
}

/** Find a user by username (used for login + uniqueness checks). */
export function findByUsername(username: string): Promise<UserRecord | null> {
  return getStorage().users.findByUsername(username);
}

/** Find a user by id. */
export function findById(id: string): Promise<UserRecord | null> {
  return getStorage().users.findById(id);
}

/** List users of the given roles, newest first. */
export function listByRoles(roles: Role[]): Promise<UserRecord[]> {
  return getStorage().users.listByRoles(roles);
}

/** Insert a new user record. */
export function insertUser(record: UserRecord): Promise<void> {
  return getStorage().users.insertUser(record);
}

/**
 * Apply a partial update by id and return the updated record.
 *
 * Args: id — target user id; patch — fields to set (already validated/hashed).
 * Returns: The updated `UserRecord`, or null if no user matched.
 */
export function updateUser(
  id: string,
  patch: Partial<Pick<UserRecord, 'username' | 'passwordHash'>> & { updatedAt: string },
): Promise<UserRecord | null> {
  return getStorage().users.updateUser(id, patch);
}

/** Delete a user by id. Returns true if a record was removed. */
export function deleteUser(id: string): Promise<boolean> {
  return getStorage().users.deleteUser(id);
}
