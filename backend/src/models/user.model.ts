/**
 * User domain model + role definitions (data shapes only — no logic).
 *
 * Purpose: Single source of truth for what a user record looks like across the
 *   repository/service layers, and for the fixed set of RBAC roles.
 */

/** The three roles in the system, ordered by privilege (high → low). */
export const ROLES = ['super_admin', 'manager', 'operator'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a super-admin is allowed to create/manage. */
export const MANAGEABLE_ROLES = ['manager', 'operator'] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

/** Stored user record (as persisted in MongoDB). `_id` mirrors our UUID v7 id. */
export interface UserRecord {
  _id: string;
  username: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/** Safe user shape returned to clients — never includes the password hash. */
export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strip a stored record down to its client-safe fields.
 *
 * Args: record — a full `UserRecord`.
 * Returns: A `PublicUser` (no password hash).
 */
export function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record._id,
    username: record.username,
    role: record.role,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
