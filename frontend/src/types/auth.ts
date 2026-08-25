/**
 * Shared auth/user types (mirror of the backend contract).
 *
 * Purpose: One place for the role union and user/credential shapes used across
 *   the UI, so components and API wrappers stay in sync with the API.
 */
export const ROLES = ['super_admin', 'manager', 'operator'] as const;
export type Role = (typeof ROLES)[number];

export const MANAGEABLE_ROLES = ['manager', 'operator'] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Credentials {
  username: string;
  password: string;
}

/** Human-friendly label for a role (e.g. for the workspace heading). */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  operator: 'Operator',
};
