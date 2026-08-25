import { useState } from 'react';
import { Spinner } from './Spinner.js';
import { createUserSchema } from '../schemas/auth.js';
import { ROLES, ROLE_LABELS, type Role } from '../types/auth.js';

/**
 * Create-user form (super-admin).
 *
 * Purpose: Provision any user — manager, operator, or another super-admin. The
 *   super-admin picks the role (nothing is preselected), types a username, and
 *   enters the password twice (re-verify) so typos are caught before creation.
 * Args: onCreate — persists the new user (returns success); the form resets on
 *   success so several users can be added in a row.
 */
export function CreateUserForm({
  onCreate,
}: {
  onCreate: (input: { role: Role; username: string; password: string }) => Promise<boolean>;
}) {
  const [role, setRole] = useState<Role | ''>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createUserSchema.safeParse({ role, username, password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    const { role: r, username: u, password: p } = parsed.data;
    const ok = await onCreate({ role: r, username: u, password: p });
    setBusy(false);
    if (ok) {
      setRole('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2 className="form__title">Create user</h2>
      <label className="field">
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
          <option value="" disabled>
            Select a role…
          </option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. line1_manager"
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        <span>Re-verify password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? <Spinner label="Creating" /> : role ? `Create ${ROLE_LABELS[role].toLowerCase()}` : 'Create user'}
      </button>
    </form>
  );
}
