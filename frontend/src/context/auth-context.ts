import { createContext } from 'react';
import type { User } from '../types/auth.js';

/**
 * Auth context shape.
 *
 * Purpose: Expose the current session (user + status) and the auth actions to
 *   the whole app. The provider lives in `AuthProvider.tsx`; consume via
 *   `useAuth()`.
 */
export interface AuthContextValue {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Replace the cached user after a self-service credential change. */
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
