import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '../api/client.js';
import * as plcApi from '../api/plc.js';
import { useToast } from './useToast.js';
import type {
  PlcState,
  ReadResult,
  SecurityMode,
  SecurityPolicy,
  WatchTag,
  WriteDataType,
} from '../types/plc.js';

/** localStorage key for the user's watch list (survives reloads). */
const WATCH_KEY = 'crane.plc.watch';

function loadWatch(): WatchTag[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (raw) return JSON.parse(raw) as WatchTag[];
  } catch {
    /* ignore malformed storage */
  }
  return [];
}

/**
 * PLC/OPC UA data hook.
 *
 * Purpose: Own the connection status, connect/disconnect/write actions, and a 1 s
 *   poll of a **list** of watched NodeIds (the live table) while connected. The
 *   watch list is user-editable and persisted, so the same page drives any PLC.
 * Returns: connection state, the watch list + latest readings, and all actions.
 */
export function usePlc() {
  const { notify } = useToast();
  const [state, setState] = useState<PlcState | null>(null);
  const [watch, setWatch] = useState<WatchTag[]>(loadWatch);
  const [readings, setReadings] = useState<Record<string, ReadResult | null>>({});
  const [busy, setBusy] = useState(false);

  const connected = state?.connection.state === 'connected';

  // Persist the watch list whenever it changes.
  useEffect(() => {
    localStorage.setItem(WATCH_KEY, JSON.stringify(watch));
  }, [watch]);

  const loadState = useCallback(async () => {
    try {
      const s = await plcApi.getState();
      setState(s);
      // First run (empty watch list): seed it from the active connection's mapped
      // READ tags (friendly labels from the PLC Manager), falling back to the
      // single configured default node when no tags are mapped yet.
      setWatch((prev) => {
        if (prev.length) return prev;
        const readTags = (s.tags ?? []).filter((t) => t.direction === 'read');
        if (readTags.length) {
          return readTags.map((t) => ({ id: crypto.randomUUID(), label: t.label, nodeId: t.nodeId }));
        }
        return [{ id: crypto.randomUUID(), label: 'Read 1', nodeId: s.defaults.readNode }];
      });
    } catch (err) {
      notify(apiErrorMessage(err, 'Failed to load PLC status'), 'error');
    }
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState();
  }, [loadState]);

  const addWatch = useCallback((label: string, nodeId: string) => {
    setWatch((prev) => [...prev, { id: crypto.randomUUID(), label, nodeId }]);
  }, []);

  const removeWatch = useCallback((id: string) => {
    setWatch((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const connect = useCallback(
    async (
      endpoint: string,
      securityMode: SecurityMode,
      securityPolicy: SecurityPolicy,
    ): Promise<void> => {
      setBusy(true);
      try {
        const connection = await plcApi.connect(endpoint, securityMode, securityPolicy);
        setState((s) => (s ? { ...s, connection } : s));
        notify('Connected to PLC', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not connect to the PLC'), 'error');
        await loadState();
      } finally {
        setBusy(false);
      }
    },
    [notify, loadState],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const connection = await plcApi.disconnect();
      setState((s) => (s ? { ...s, connection } : s));
      setReadings({});
      notify('Disconnected from PLC', 'info');
    } catch (err) {
      notify(apiErrorMessage(err, 'Could not disconnect'), 'error');
    } finally {
      setBusy(false);
    }
  }, [notify]);

  const write = useCallback(
    async (nodeId: string, dataType: WriteDataType, value: boolean | number): Promise<boolean> => {
      try {
        const result = await plcApi.sendCommand(nodeId, dataType, value);
        setReadings((prev) => (nodeId in prev ? { ...prev, [nodeId]: result } : prev));
        notify(`Sent ${nodeId} = ${String(value)} (read-back ${String(result.value)})`, 'success');
        return true;
      } catch (err) {
        notify(apiErrorMessage(err, 'Command failed'), 'error');
        return false;
      }
    },
    [notify],
  );

  // Poll every watched node once per second while connected.
  useEffect(() => {
    if (!connected || watch.length === 0) return;
    let active = true;
    const tick = async () => {
      const entries = await Promise.all(
        watch.map(async (t) => {
          try {
            return [t.nodeId, await plcApi.readNode(t.nodeId)] as const;
          } catch {
            return [t.nodeId, null] as const;
          }
        }),
      );
      if (!active) return;
      setReadings((prev) => {
        const next = { ...prev };
        for (const [id, r] of entries) if (r) next[id] = r;
        return next;
      });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [connected, watch]);

  return { state, connected, watch, readings, addWatch, removeWatch, busy, connect, disconnect, write };
}
