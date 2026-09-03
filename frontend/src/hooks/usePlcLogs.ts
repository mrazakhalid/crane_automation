import { useCallback, useEffect, useRef, useState } from 'react';
import * as plcApi from '../api/plc.js';
import { apiErrorMessage } from '../api/client.js';
import type { PlcLogRow } from '../api/plc.js';

/** Cap the rows held client-side (matches the server ring buffer's usefulness). */
const MAX_ROWS = 500;

/**
 * PLC I/O log poll hook.
 *
 * Purpose: Poll `GET /plc/logs` and accumulate the OPC UA writes/reads (per PLC)
 *   so the Logs page can show, live, what the app sent to each PLC and what came
 *   back. Uses `after=<lastSeq>` so each poll only transfers new rows. `clear`
 *   wipes both server + client.
 * Returns: `{ entries, error, clear }`.
 */
export function usePlcLogs(intervalMs = 1000): {
  entries: PlcLogRow[];
  error: string | null;
  clear: () => Promise<void>;
} {
  const [entries, setEntries] = useState<PlcLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastSeq = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await plcApi.getPlcLogs(lastSeq.current);
        if (!alive) return;
        lastSeq.current = res.lastSeq;
        if (res.entries.length) setEntries((prev) => [...prev, ...res.entries].slice(-MAX_ROWS));
        setError(null);
      } catch (err) {
        if (alive) setError(apiErrorMessage(err, 'Could not load the PLC log'));
      }
    };
    void tick();
    timer.current = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  const clear = useCallback(async (): Promise<void> => {
    await plcApi.clearPlcLogs().catch(() => undefined);
    lastSeq.current = 0;
    setEntries([]);
  }, []);

  return { entries, error, clear };
}
