import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Spinner } from './Spinner.js';
import type { Role } from '../types/auth.js';

/**
 * Gate that requires an authenticated session.
 *
 * Purpose: Redirect unauthenticated users to /login; show a full-page spinner
 *   while the session is still resolving (avoids a login flash on reload).
 */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <div className="page-center">
        <Spinner label="Loading session" size={28} />
      </div>
    );
  }
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
}

/**
 * Gate that requires one of the given roles.
 *
 * Args: roles — allowed roles.
 * Purpose: Protect role-specific routes (e.g. Users → super_admin). Sends
 *   unauthorized users back to the dashboard.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}
