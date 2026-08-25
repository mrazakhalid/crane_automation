import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../api/client.js';
import { Spinner } from '../components/Spinner.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { loginSchema } from '../schemas/auth.js';

/**
 * Unified login page (all roles use the same form).
 *
 * Purpose: Validate on the client for UX, delegate to the auth context, and
 *   surface typed errors as toasts + inline messages. On success, routing to
 *   the app is handled by the authenticated redirect in the router.
 */
export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await login(parsed.data.username, parsed.data.password);
      notify('Welcome back', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      const message = apiErrorMessage(err, 'Login failed');
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={onSubmit} noValidate>
        <div className="login__brand">
          <img className="login__mark" src="/icon.svg" width={38} height={38} alt="" aria-hidden />
          <div>
            <h1>Crane Automation</h1>
            <p className="muted">Sign in to the control workspace</p>
          </div>
        </div>

        <label className="field">
          <span>Username</span>
          <input
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="enter username"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="enter password"
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? <Spinner label="Signing in" /> : 'Sign in'}
        </button>

        <p className="login__hint muted">
          First run seeds a super-admin — <code>admin / admin</code>. Change it after login.
        </p>
      </form>
    </div>
  );
}
