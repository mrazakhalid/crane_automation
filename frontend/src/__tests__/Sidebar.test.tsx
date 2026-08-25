import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar.js';
import { ThemeProvider } from '../components/ThemeProvider.js';
import { AuthContext, type AuthContextValue } from '../context/auth-context.js';
import type { Role, User } from '../types/auth.js';

/** Render the Sidebar with a fake authenticated session of the given role. */
function renderSidebar(role: Role, onToggle = vi.fn(), collapsed = false) {
  const user: User = {
    id: 'u1',
    username: `${role}_user`,
    role,
    createdAt: '',
    updatedAt: '',
  };
  const value: AuthContextValue = {
    user,
    status: 'authenticated',
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  };
  render(
    <ThemeProvider>
      <AuthContext.Provider value={value}>
        <MemoryRouter>
          <Sidebar collapsed={collapsed} onToggle={onToggle} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>,
  );
  return value;
}

describe('Sidebar', () => {
  it('always shows Dashboard first and Logout last', () => {
    renderSidebar('operator');
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('shows the Users tab only for super_admin', () => {
    renderSidebar('super_admin');
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
  });

  it('hides the Users tab from non-super-admins', () => {
    renderSidebar('manager');
    expect(screen.queryByRole('link', { name: /users/i })).not.toBeInTheDocument();
  });

  it('indicates who is signed in', () => {
    renderSidebar('manager');
    expect(screen.getByText('manager_user')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('calls onToggle when the collapse control is clicked', async () => {
    const onToggle = vi.fn();
    renderSidebar('operator', onToggle);
    await userEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('toggles the theme between dark and light', async () => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'dark';
    renderSidebar('operator');
    const toggle = screen.getByRole('button', { name: /switch to light mode/i });
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
