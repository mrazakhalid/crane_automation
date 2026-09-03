import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { ProcessProvider } from '../context/ProcessProvider.js';

const COLLAPSE_KEY = 'crane.sidebar.collapsed';

/**
 * Authenticated app shell: collapsible sidebar + workspace outlet.
 *
 * Purpose: Provide the persistent two-pane layout — navigation rail on the left,
 *   the active page's workspace on the right. Collapse state is remembered
 *   across reloads and, on small screens, defaults to collapsed.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="workspace">
        {/* ProcessProvider lives here (not inside a page) so the run survives page switches. */}
        <ProcessProvider>
          <Outlet />
        </ProcessProvider>
      </main>
    </div>
  );
}
