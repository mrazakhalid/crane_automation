import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the auth API so no network happens; the provider still drives state.
vi.mock('../api/auth.js', () => ({
  login: vi.fn(),
  fetchMe: vi.fn(),
  updateMyCredentials: vi.fn(),
}));

import * as authApi from '../api/auth.js';
import { AuthProvider } from '../context/AuthProvider.js';
import { ToastProvider } from '../components/ToastProvider.js';
import { LoginPage } from '../pages/LoginPage.js';

function renderLogin() {
  render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a validation error when submitting empty fields', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/username is required/i);
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('calls the auth API with entered credentials on a valid submit', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'jwt',
      user: { id: 'u1', username: 'admin', role: 'super_admin', createdAt: '', updatedAt: '' },
    });
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText('enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('enter password'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(authApi.login).toHaveBeenCalledWith('admin', 'admin');
  });
});
