import { useState } from 'react';
import { Modal } from './Modal.js';
import { Spinner } from './Spinner.js';
import { credentialsSchema } from '../schemas/auth.js';
import type { User } from '../types/auth.js';

/**
 * Edit-credentials dialog for a managed user (super-admin action).
 *
 * Purpose: Change a user's username and/or password. Blank fields are left
 *   unchanged. Delegates the actual write to the caller's `onSave`.
 * Args: user — the target; onSave — persists the patch (returns success);
 *   onClose — dismiss.
 */
export function EditUserDialog({
  user,
  onSave,
  onClose,
}: {
  user: User;
  onSave: (patch: { username?: string; password?: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    const patch: { username?: string; password?: string } = {};
    if (parsed.data.username) patch.username = parsed.data.username;
    if (parsed.data.password) patch.password = parsed.data.password;
    const ok = await onSave(patch);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`Edit ${user.username}`} onClose={onClose}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>New username <em className="muted">(optional)</em></span>
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder={user.username}
            autoFocus
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
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner label="Saving" /> : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
