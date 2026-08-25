import type { Role, User } from '../types/auth.js';
import { apiClient } from './client.js';

/**
 * User-management API wrappers (super-admin only endpoints).
 */

/** GET /users — list managers and operators. */
export async function listUsers(): Promise<User[]> {
  const { data } = await apiClient.get<{ users: User[] }>('/users');
  return data.users;
}

/** POST /users — create any user (incl. super-admin) with a supplied login. */
export async function createUser(input: {
  role: Role;
  username: string;
  password: string;
}): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>('/users', input);
  return data.user;
}

/** PATCH /users/:id/credentials — rotate a managed user's username/password. */
export async function updateUserCredentials(
  id: string,
  patch: { username?: string; password?: string },
): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>(`/users/${id}/credentials`, patch);
  return data.user;
}

/** DELETE /users/:id — remove a managed user. */
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
