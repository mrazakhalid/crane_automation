import { useState } from 'react';
import { updateMyCredentials } from '../api/auth.js';
import { apiErrorMessage } from '../api/client.js';
import { Spinner } from '../components/Spinner.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { credentialsSchema } from '../schemas/auth.js';
import { ROLE_LABELS } from '../types/auth.js';

/**
 * Account page — change the signed-in user's own username and/or password.
 *
 * Purpose: Self-service credential rotation for every role (this is how the
 *   seeded super-admin moves off "admin / admin"). Leaving a field blank keeps
 *   it unchanged; on success the cached session user is refreshed.
 */
export function AccountPage() {
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const patch: { username?: string; password?: string } = {};
      if (parsed.data.username) patch.username = parsed.data.username;
      if (parsed.data.password) patch.password = parsed.data.password;
      const updated = await updateMyCredentials(patch);
      setUser(updated);
      setForm({ username: '', password: '', confirmPassword: '' });
      notify('Credentials updated', 'success');
    } catch (err) {
      const message = apiErrorMessage(err, 'Update failed');
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner">
          <form className="card form" onSubmit={onSubmit} noValidate>
            <h2 className="form__title">Your credentials</h2>
            <p className="muted form__sub">
              Signed in as <strong>{user.username}</strong> ·{' '}
              <span className={`badge badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
            </p>
            <label className="field">
              <span>New username <em className="muted">(optional)</em></span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={user.username}
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>New password <em className="muted">(optional)</em></span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span>Re-verify password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? <Spinner label="Saving" /> : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
