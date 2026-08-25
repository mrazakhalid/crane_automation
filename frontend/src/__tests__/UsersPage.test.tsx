import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the users API so the page renders against controlled data.
vi.mock('../api/users.js', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserCredentials: vi.fn(),
  deleteUser: vi.fn(),
}));

import * as usersApi from '../api/users.js';
import { ToastProvider } from '../components/ToastProvider.js';
import { UsersPage } from '../pages/UsersPage.js';
import type { User } from '../types/auth.js';

function renderUsers() {
  render(
    <ToastProvider>
      <UsersPage />
    </ToastProvider>,
  );
}

const manager: User = {
  id: 'm1',
  username: 'line1_manager',
  role: 'manager',
  createdAt: '',
  updatedAt: '',
};

describe('UsersPage (super-admin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Create / Managers / Operators / Super Admins in the top nav bar', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);
    renderUsers();
    expect(screen.getByRole('tab', { name: /create user/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /managers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /operators/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /super admins/i })).toBeInTheDocument();
  });

  it('starts with no role selected and requires re-verified password', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);
    renderUsers();
    // No role preselected -> the placeholder option is current.
    expect(screen.getByRole('combobox')).toHaveValue('');

    await userEvent.type(screen.getByPlaceholderText(/line1_manager/i), 'line1_manager');
    await userEvent.type(screen.getByPlaceholderText(/at least 6 characters/i), 'secretpass');
    await userEvent.type(screen.getByPlaceholderText(/re-enter password/i), 'MISMATCH');
    await userEvent.click(screen.getByRole('button', { name: /create user/i }));

    // Role not chosen -> blocked, API not called.
    expect(usersApi.createUser).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('creates a user when role is chosen and passwords match', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);
    vi.mocked(usersApi.createUser).mockResolvedValue(manager);
    renderUsers();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'manager');
    await userEvent.type(screen.getByPlaceholderText(/line1_manager/i), 'line1_manager');
    await userEvent.type(screen.getByPlaceholderText(/at least 6 characters/i), 'secretpass');
    await userEvent.type(screen.getByPlaceholderText(/re-enter password/i), 'secretpass');
    await userEvent.click(screen.getByRole('button', { name: /create manager/i }));

    expect(usersApi.createUser).toHaveBeenCalledWith({
      role: 'manager',
      username: 'line1_manager',
      password: 'secretpass',
    });
  });

  it('lists managers by role and shows super-admins as protected', async () => {
    const admin: User = {
      id: 'a1',
      username: 'admin',
      role: 'super_admin',
      createdAt: '',
      updatedAt: '',
    };
    vi.mocked(usersApi.listUsers).mockResolvedValue([admin, manager]);
    renderUsers();

    await userEvent.click(screen.getByRole('tab', { name: /managers/i }));
    await waitFor(() => expect(screen.getByText('line1_manager')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: /super admins/i }));
    expect(screen.getByText('admin')).toBeInTheDocument();
    // Super-admins are read-only: no Delete action on their row.
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByText(/protected/i)).toBeInTheDocument();
  });
});
