import type { User } from '../types/auth.js';
import { apiClient } from './client.js';

/**
 * Auth API wrappers (typed thin layer over the shared Axios client).
 */

/** POST /auth/login — returns the token + user on success. */
export async function login(
  username: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', {
    username,
    password,
  });
  return data;
}

/** GET /auth/me — resolve the current session's user. */
export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}

/** PATCH /auth/me/credentials — change the caller's own username/password. */
export async function updateMyCredentials(patch: {
  username?: string;
  password?: string;
}): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>('/auth/me/credentials', patch);
  return data.user;
}
