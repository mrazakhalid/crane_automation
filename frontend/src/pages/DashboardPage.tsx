import { ProcessWorkspace } from '../components/ProcessWorkspace.js';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Dashboard workspace.
 *
 * Purpose: The right-hand workspace, centered in the free space. For **managers**
 *   it surfaces the recipe → divide → run tool (the same `ProcessWorkspace` as the
 *   Process tab): upload/paste/pick a QR recipe and it auto-divides across ALL
 *   lines/PLCs — no line selection. Other roles see placeholder panels for now.
 */
export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isManager = user.role === 'manager';

  return (
    <div className="page">
      <div className="page-body">
        <div
          className={`page-body__inner ${isManager ? 'page-body__inner--wide process-page' : 'dashboard'}`}
        >
          <p className="eyebrow">Workspace</p>

          {isManager ? (
            <ProcessWorkspace />
          ) : (
            <div className="placeholder-grid" aria-hidden>
              <div className="placeholder-card" />
              <div className="placeholder-card" />
              <div className="placeholder-card" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
