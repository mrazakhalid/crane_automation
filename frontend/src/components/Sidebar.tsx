import {
  ChevronsLeft,
  ChevronsRight,
  Container,
  Cpu,
  Factory,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Server,
  Sun,
  UserCog,
  Users,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useTheme } from '../hooks/useTheme.js';
import { ROLE_LABELS, type Role } from '../types/auth.js';

/** Nav item definition; `roles` limits visibility (undefined = everyone). */
interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/plant', label: 'Plant', Icon: Factory, roles: ['manager', 'super_admin'] },
  { to: '/crane', label: 'Crane View', Icon: Container, roles: ['manager', 'super_admin'] },
  { to: '/logs', label: 'Logs', Icon: ScrollText, roles: ['manager', 'super_admin'] },
  // Process tab hidden for now — the recipe → divide → run workspace lives on the manager Dashboard.
  // { to: '/process', label: 'Process', Icon: ListTree, roles: ['manager'] },
  { to: '/lines', label: 'Lines', Icon: Waypoints, roles: ['super_admin'] },
  { to: '/plc', label: 'PLC', Icon: Cpu, roles: ['super_admin'] },
  { to: '/plc-manager', label: 'PLC Manager', Icon: Server, roles: ['super_admin'] },
  { to: '/users', label: 'Users', Icon: Users, roles: ['super_admin'] },
  { to: '/account', label: 'Account', Icon: UserCog },
];

const ICON_SIZE = 18;

/**
 * Collapsible left sidebar.
 *
 * Purpose: Primary navigation + "who is signed in" indicator. Dashboard is the
 *   first tab and Logout is pinned last, per spec. Role-gated tabs (e.g. Users)
 *   only render for permitted roles. Icons come from lucide-react (no emojis).
 * Args: collapsed — whether the rail is narrowed; onToggle — collapse handler.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const visible = NAV_ITEMS.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__top">
        <img className="sidebar__logo" src="/icon.svg" width={24} height={24} alt="" aria-hidden />
        {!collapsed && <span className="sidebar__title">Crane</span>}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronsRight size={16} aria-hidden /> : <ChevronsLeft size={16} aria-hidden />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `navitem${isActive ? ' navitem--active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <item.Icon className="navitem__icon" size={ICON_SIZE} aria-hidden />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__foot">
        <button
          type="button"
          className="navitem"
          onClick={toggle}
          title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="navitem__icon" size={ICON_SIZE} aria-hidden />
          ) : (
            <Moon className="navitem__icon" size={ICON_SIZE} aria-hidden />
          )}
          {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {user && (
          <div className="whoami" title={`${user.username} — ${ROLE_LABELS[user.role]}`}>
            <span className={`avatar avatar--${user.role}`} aria-hidden>
              {user.username.charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <span className="whoami__meta">
                <span className="whoami__name">{user.username}</span>
                <span className={`badge badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          className="navitem navitem--logout"
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="navitem__icon" size={ICON_SIZE} aria-hidden />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
