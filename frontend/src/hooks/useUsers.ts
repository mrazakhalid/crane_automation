import { useCallback, useEffect, useState } from 'react';
import * as usersApi from '../api/users.js';
import { apiErrorMessage } from '../api/client.js';
import { useToast } from './useToast.js';
import type { Role, User } from '../types/auth.js';

/**
 * Managed-users data hook (super-admin screen).
 *
 * Purpose: Own the user list + CRUD actions with optimistic updates and
 *   rollback, surfacing failures as toasts. Keeps the Users page presentational.
 * Returns: The list, load state, and `create` / `update` / `remove` actions.
 */
export function useUsers() {
  const { notify } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await usersApi.listUsers());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Legitimate data-fetch-on-mount; the sync setLoading(true) inside load() is
    // intentional so the list shows skeletons immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Create a user with a supplied login; returns true on success. */
  const create = useCallback(
    async (input: { role: Role; username: string; password: string }): Promise<boolean> => {
      try {
        const user = await usersApi.createUser(input);
        setUsers((prev) => [user, ...prev]);
        notify(`${input.role} "${user.username}" created`, 'success');
        return true;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not create user'), 'error');
        return false;
      }
    },
    [notify],
  );

  /** Rotate a user's credentials; optimistically updates the row, rolls back on failure. */
  const update = useCallback(
    async (id: string, patch: { username?: string; password?: string }): Promise<boolean> => {
      const snapshot = users;
      if (patch.username) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, username: patch.username! } : u)),
        );
      }
      try {
        const updated = await usersApi.updateUserCredentials(id, patch);
        setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
        notify('Credentials updated', 'success');
        return true;
      } catch (err) {
        setUsers(snapshot);
        notify(apiErrorMessage(err, 'Update failed'), 'error');
        return false;
      }
    },
    [users, notify],
  );

  /** Delete a user; optimistically removes the row, restores it on failure. */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = users;
      setUsers((prev) => prev.filter((u) => u.id !== id));
      try {
        await usersApi.deleteUser(id);
        notify('User removed', 'success');
      } catch (err) {
        setUsers(snapshot);
        notify(apiErrorMessage(err, 'Delete failed'), 'error');
      }
    },
    [users, notify],
  );

  return { users, loading, error, reload: load, create, update, remove };
}
