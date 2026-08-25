import { useCallback, useEffect, useState } from 'react';
import * as linesApi from '../api/lines.js';
import { apiErrorMessage } from '../api/client.js';
import { useToast } from './useToast.js';
import type { Line, NewLine } from '../types/line.js';

/**
 * Lines data hook (shared by the super-admin Lines screen and the manager
 * task generator).
 *
 * Purpose: Own the line list + create action with optimistic insert and
 *   rollback, surfacing failures as toasts.
 * Returns: The list, load state, and `reload` / `create` actions.
 */
export function useLines() {
  const { notify } = useToast();
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLines(await linesApi.listLines());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load lines'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Create a line; optimistically inserts it, rolls back on failure. */
  const create = useCallback(
    async (input: NewLine): Promise<boolean> => {
      try {
        const line = await linesApi.createLine(input);
        setLines((prev) => [line, ...prev]);
        notify(`Line "${line.name}" saved`, 'success');
        return true;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not save line'), 'error');
        return false;
      }
    },
    [notify],
  );

  /** Edit a line; optimistically replaces the row, rolls back on failure. */
  const update = useCallback(
    async (id: string, patch: NewLine): Promise<boolean> => {
      const snapshot = lines;
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      try {
        const updated = await linesApi.updateLine(id, patch);
        setLines((prev) => prev.map((l) => (l.id === id ? updated : l)));
        notify(`Line "${updated.name}" updated`, 'success');
        return true;
      } catch (err) {
        setLines(snapshot);
        notify(apiErrorMessage(err, 'Could not update line'), 'error');
        return false;
      }
    },
    [lines, notify],
  );

  /** Delete a line; optimistically removes the row, restores it on failure. */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = lines;
      setLines((prev) => prev.filter((l) => l.id !== id));
      try {
        await linesApi.deleteLine(id);
        notify('Line removed', 'success');
      } catch (err) {
        setLines(snapshot);
        notify(apiErrorMessage(err, 'Could not delete line'), 'error');
      }
    },
    [lines, notify],
  );

  return { lines, loading, error, reload: load, create, update, remove };
}
