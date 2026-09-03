import { useEffect, useRef, useState } from 'react';
import * as plcApi from '../api/plc.js';
import { apiErrorMessage } from '../api/client.js';
import type { PlantView } from '../types/plc.js';

/**
 * Live plant-view poll hook.
 *
 * Purpose: Poll `GET /plc/plant-view` on an interval and expose the latest
 *   whole-plant snapshot (all lines + live per-crane state) for the animated
 *   overview. Holds the last good snapshot on a transient error so the animation
 *   doesn't flicker; cleans up on unmount.
 * Args: intervalMs — poll period (default 1000 ms).
 * Returns: `{ plant, error, loading }`.
 */
export function usePlantView(intervalMs = 1000): {
  plant: PlantView | null;
  error: string | null;
  loading: boolean;
} {
  const [plant, setPlant] = useState<PlantView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const data = await plcApi.getPlantView();
        if (!alive) return;
        setPlant(data);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(apiErrorMessage(err, 'Could not load the plant view'));
      } finally {
        if (alive) setLoading(false);
      }
    };

    void tick();
    timer.current = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [intervalMs]);

  return { plant, error, loading };
}
