import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/auth-context.js';

/**
 * Access the auth context.
 *
 * Returns: The `AuthContextValue` (user, status, login, logout, setUser).
 * Raises: Error if used outside an `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
