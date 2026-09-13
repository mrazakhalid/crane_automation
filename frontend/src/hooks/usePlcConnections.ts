import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/client.js';
import * as api from '../api/plc-connections.js';
import { useToast } from './useToast.js';
import type { ConnectionInput, PlcConnectionConfig, PlcStatus } from '../types/plc-config.js';

/** How often to refresh the live per-PLC connection status (ms). */
const STATUS_POLL_MS = 4000;

/**
 * Saved-connections data hook (PLC Manager, super-admin).
 *
 * Purpose: Own the connection list + CRUD/activate actions with optimistic
 *   updates and rollback, surfacing failures as toasts. Keeps the page
 *   presentational.
 * Returns: the list, load state, and create/update/remove/activate actions.
 */
export function usePlcConnections() {
  const { notify } = useToast();
  const [connections, setConnections] = useState<PlcConnectionConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PlcStatus>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await api.listConnections());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load connections'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatuses = useCallback(async () => {
    try {
      const list = await api.getConnectionStatuses();
      setStatuses(Object.fromEntries(list.map((s) => [s.connectionId, s])));
    } catch {
      /* transient — keep the last known statuses */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Poll live per-PLC status so each row's chip stays current.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshStatuses();
    const t = setInterval(() => void refreshStatuses(), STATUS_POLL_MS);
    return () => clearInterval(t);
  }, [refreshStatuses]);

  const connect = useCallback(
    async (id: string): Promise<void> => {
      setPendingId(id);
      try {
        const status = await api.connectConnection(id);
        setStatuses((prev) => ({ ...prev, [id]: status }));
        notify('Connected to PLC', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not connect to the PLC'), 'error');
        void refreshStatuses();
      } finally {
        setPendingId(null);
      }
    },
    [notify, refreshStatuses],
  );

  const disconnect = useCallback(
    async (id: string): Promise<void> => {
      setPendingId(id);
      try {
        const status = await api.disconnectConnection(id);
        setStatuses((prev) => ({ ...prev, [id]: status }));
        notify('Disconnected from PLC', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not disconnect'), 'error');
      } finally {
        setPendingId(null);
      }
    },
    [notify],
  );

  const stop = useCallback(
    async (id: string): Promise<void> => {
      setPendingId(id);
      try {
        await api.stopConnection(id);
        notify('Stop sent — crane(s) halted', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not stop the crane(s)'), 'error');
      } finally {
        setPendingId(null);
      }
    },
    [notify],
  );

  const clean = useCallback(
    async (id: string): Promise<void> => {
      setPendingId(id);
      try {
        await api.cleanConnection(id);
        notify('Clean sent — crane(s) homing to Parking, recipe cleared', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not clean the PLC'), 'error');
      } finally {
        setPendingId(null);
      }
    },
    [notify],
  );

  const create = useCallback(
    async (input: ConnectionInput): Promise<boolean> => {
      try {
        const conn = await api.createConnection(input);
        setConnections((prev) => [conn, ...prev]);
        notify(`Connection "${conn.name}" created`, 'success');
        return true;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not create connection'), 'error');
        return false;
      }
    },
    [notify],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ConnectionInput>): Promise<boolean> => {
      const snapshot = connections;
      setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      try {
        const updated = await api.updateConnection(id, patch);
        setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
        notify('Connection updated', 'success');
        return true;
      } catch (err) {
        setConnections(snapshot);
        notify(apiErrorMessage(err, 'Update failed'), 'error');
        return false;
      }
    },
    [connections, notify],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = connections;
      setConnections((prev) => prev.filter((c) => c.id !== id));
      try {
        await api.deleteConnection(id);
        notify('Connection removed', 'success');
      } catch (err) {
        setConnections(snapshot);
        notify(apiErrorMessage(err, 'Delete failed'), 'error');
      }
    },
    [connections, notify],
  );

  const activate = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = connections;
      // Optimistic: exactly one active.
      setConnections((prev) => prev.map((c) => ({ ...c, isActive: c.id === id })));
      try {
        await api.activateConnection(id);
        notify('Active PLC switched', 'success');
      } catch (err) {
        setConnections(snapshot);
        notify(apiErrorMessage(err, 'Could not switch active PLC'), 'error');
      }
    },
    [connections, notify],
  );

  return {
    connections,
    statuses,
    pendingId,
    loading,
    error,
    reload: load,
    create,
    update,
    remove,
    activate,
    connect,
    disconnect,
    stop,
    clean,
  };
}
