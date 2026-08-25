import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '../components/ToastProvider.js';
import { AuthContext, type AuthContextValue } from '../context/auth-context.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import type { Role, User } from '../types/auth.js';

// The manager workspace loads saved recipes on mount — stub the API so the
// component renders without a live backend.
vi.mock('../api/recipes.js', () => ({
  listRecipes: vi.fn().mockResolvedValue([]),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('../api/process.js', () => ({
  planProcess: vi.fn(),
  startProcess: vi.fn(),
  getRunStatus: vi.fn(),
  stopProcess: vi.fn(),
}));

vi.mock('../utils/qr.js', () => ({ decodeQrFromFile: vi.fn() }));

function renderDashboard(role: Role) {
  const user: User = { id: 'u1', username: `${role}_user`, role, createdAt: '', updatedAt: '' };
  const value: AuthContextValue = {
    user,
    status: 'authenticated',
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  };
  render(
    <ToastProvider>
      <AuthContext.Provider value={value}>
        <DashboardPage />
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('DashboardPage', () => {
  it('shows the auto-dividing recipe tool (no line picker) for managers', async () => {
    renderDashboard('manager');
    expect(
      await screen.findByRole('heading', { name: /upload a recipe/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
    // The saved-recipe dropdown is present; there is NO "Line" picker anymore.
    expect(screen.getByText('Saved recipe')).toBeInTheDocument();
    expect(screen.queryByText('Line')).not.toBeInTheDocument();
  });

  it('does not show the recipe tool for operators', () => {
    renderDashboard('operator');
    expect(screen.queryByRole('heading', { name: /upload a recipe/i })).not.toBeInTheDocument();
  });
});
