import { useEffect, useRef, useState } from 'react';
import * as plcApi from '../api/plc.js';
import { apiErrorMessage } from '../api/client.js';
import type { CraneView } from '../types/plc.js';

/**
 * Live crane-view poll hook.
 *
 * Purpose: Poll `GET /plc/crane-view` on an interval and expose the latest
 *   snapshot for the visualizer, plus a connection flag and a friendly error
 *   (e.g. "not connected"). Keeps the last good snapshot on a transient blip so
 *   the animation doesn't flicker; cleans up on unmount.
 * Args: intervalMs — poll period (default 500 ms).
 * Returns: `{ view, connected, error }`.
 */
export function useCraneView(intervalMs = 500): {
  view: CraneView | null;
  connected: boolean;
  error: string | null;
} {
  const [view, setView] = useState<CraneView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  // Last station a limit switch confirmed — used to hold the trolley in place
  // while travelling (station === null), so it glides instead of snapping home.
  const lastStation = useRef(0);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const v = await plcApi.getCraneView();
        if (!alive) return;
        if (v.station === null) {
          v.station = lastStation.current; // hold last known while travelling
        } else {
          lastStation.current = v.station;
        }
        setView(v);
        setConnected(true);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setConnected(false);
        setError(apiErrorMessage(err, 'Not connected to a PLC'));
      }
    };

    void tick();
    timer.current = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { view, connected, error };
}
