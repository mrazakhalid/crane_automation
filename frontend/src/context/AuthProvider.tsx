import { useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';
import { getStoredToken, setStoredToken } from '../api/client.js';
import type { User } from '../types/auth.js';
import { AuthContext, type AuthContextValue } from './auth-context.js';

/**
 * Auth provider.
 *
 * Purpose: Own the session lifecycle — restore it from a stored token on mount,
 *   expose login/logout, and keep the cached user fresh. Non-blocking: renders a
 *   `loading` status while the initial `/me` resolves.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  // Lazily derive the initial status so no synchronous setState is needed in the
  // effect: without a token we start already-unauthenticated.
  const [status, setStatus] = useState<AuthContextValue['status']>(() =>
    getStoredToken() ? 'loading' : 'unauthenticated',
  );

  // Restore session from a persisted token exactly once on mount.
  useEffect(() => {
    let active = true;
    const token = getStoredToken();
    if (!token) return;
    authApi
      .fetchMe()
      .then((me) => {
        if (!active) return;
        setUserState(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setStoredToken(null);
        setStatus('unauthenticated');
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: loggedIn } = await authApi.login(username, password);
    setStoredToken(token);
    setUserState(loggedIn);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUserState(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, setUser: setUserState }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
