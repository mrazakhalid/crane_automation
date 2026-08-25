import axios, { AxiosError, type AxiosInstance } from 'axios';

/** localStorage key holding the JWT. Single source so token access stays in one place. */
export const TOKEN_STORAGE_KEY = 'crane.token';

/** Read the persisted token (or null). */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/** Persist or clear the token. */
export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Shared Axios instance for all backend calls.
 *
 * Purpose: Central HTTP client. A request interceptor attaches the bearer token;
 *   the response interceptor clears a dead session on 401 and normalizes errors.
 * Returns: A pre-configured `AxiosInstance`.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // On an expired/invalid session, drop the stale token so the app can redirect.
    if (error.response?.status === 401 && getStoredToken()) {
      setStoredToken(null);
    }
    return Promise.reject(error);
  },
);

/**
 * Extract a human-readable message from an Axios/API error.
 *
 * Args: err — an unknown thrown value.
 * Returns: The backend's `error` message when present, else a sensible default.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
