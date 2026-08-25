import { useCallback, useEffect, useRef, useState } from 'react';
import * as processApi from '../api/process.js';
import { apiErrorMessage } from '../api/client.js';
import { useToast } from './useToast.js';
import { decodeQrFromFile } from '../utils/qr.js';
import type { ProcessPlan, RunStatus, RunTaskState } from '../types/process.js';
import type { StepOverrides } from '../types/recipe.js';

/**
 * Process page hook.
 *
 * Purpose: Own the recipe → divide → run flow. `divide` posts the recipe to the
 *   backend which splits it across lines/PLCs; ambiguous steps are resolved by
 *   choosing a line (an override), which re-plans. `start` begins a live simulated
 *   run and polls its per-task status once a second until it finishes; `stop`
 *   resets. All failures surface as toasts.
 * Returns: recipe text + overrides, the plan, live run status, busy flags, and the
 *   `decode` / `setQr` / `resolveAmbiguity` / `divide` / `start` / `stop` actions.
 */
export function useProcess() {
  const { notify } = useToast();
  const [qr, setQr] = useState('');
  const [overrides, setOverrides] = useState<StepOverrides>({});
  const [plan, setPlan] = useState<ProcessPlan | null>(null);
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number | null>(null);

  /** Stop the status poll (idempotent). */
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Always clear the interval on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  /** Poll the run once a second; stop (keeping the final snapshot) when done. */
  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const s = await processApi.getRunStatus(id);
            setStatus(s);
            if (s.done) {
              stopPolling();
              notify('Process complete', 'success');
            }
          } catch (err) {
            stopPolling();
            notify(apiErrorMessage(err, 'Lost contact with the run'), 'error');
          }
        })();
      }, 1000);
    },
    [notify, stopPolling],
  );

  /** Decode a QR image file into its recipe text. */
  const decode = useCallback(
    async (file: File | undefined): Promise<void> => {
      if (!file) return;
      setDecoding(true);
      try {
        setQr(await decodeQrFromFile(file));
        notify('QR decoded', 'success');
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not decode the image'), 'error');
      } finally {
        setDecoding(false);
      }
    },
    [notify],
  );

  /** Divide the recipe across lines/PLCs (dry run). Uses the given overrides. */
  const divide = useCallback(
    async (ov: StepOverrides = overrides): Promise<void> => {
      if (!qr.trim()) {
        notify('Scan or paste a recipe first', 'error');
        return;
      }
      setPlanning(true);
      try {
        const p = await processApi.planProcess(qr.trim(), ov);
        setPlan(p);
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not divide the recipe'), 'error');
      } finally {
        setPlanning(false);
      }
    },
    [qr, overrides, notify],
  );

  /** Pick a line for an ambiguous step, then re-plan with the new override. */
  const resolveAmbiguity = useCallback(
    (step: number, lineId: string): void => {
      const next = { ...overrides, [String(step)]: lineId };
      setOverrides(next);
      void divide(next);
    },
    [overrides, divide],
  );

  /** Start a live simulated run of the current recipe + overrides. */
  const start = useCallback(async (): Promise<void> => {
    if (!qr.trim()) {
      notify('Scan or paste a recipe first', 'error');
      return;
    }
    setStarting(true);
    try {
      const { runId: id, plan: p } = await processApi.startProcess(qr.trim(), overrides);
      setPlan(p);
      setRunId(id);
      setStatus({ runId: id, done: false, progress: 0, steps: [] });
      startPolling(id);
      notify('Process started', 'success');
    } catch (err) {
      notify(apiErrorMessage(err, 'Could not start the process'), 'error');
    } finally {
      setStarting(false);
    }
  }, [qr, overrides, notify, startPolling]);

  /** Stop and reset the current run. */
  const stop = useCallback(async (): Promise<void> => {
    stopPolling();
    const id = runId;
    setRunId(null);
    setStatus(null);
    if (id) await processApi.stopProcess(id).catch(() => undefined);
  }, [runId, stopPolling]);

  /** Load a saved recipe's text + overrides into the workspace (clears any run). */
  const loadRecipe = useCallback(
    (recipeQr: string, recipeOverrides: StepOverrides): void => {
      stopPolling();
      setRunId(null);
      setStatus(null);
      setPlan(null);
      setOverrides(recipeOverrides);
      setQr(recipeQr);
    },
    [stopPolling],
  );

  /** The live state of a step (idle when there is no active run). */
  const stateForStep = useCallback(
    (step: number): RunTaskState => status?.steps.find((s) => s.step === step)?.state ?? 'idle',
    [status],
  );

  const running = runId !== null && !(status?.done ?? false);

  return {
    qr,
    setQr,
    overrides,
    plan,
    status,
    running,
    decoding,
    planning,
    starting,
    decode,
    divide,
    resolveAmbiguity,
    start,
    stop,
    loadRecipe,
    stateForStep,
  };
}
