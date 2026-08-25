import { useCallback, useEffect, useRef, useState } from 'react';
import * as linesApi from '../api/lines.js';
import * as plcApi from '../api/plc.js';
import { apiErrorMessage } from '../api/client.js';
import { useLines } from './useLines.js';
import { useToast } from './useToast.js';
import { decodeQrFromFile } from '../utils/qr.js';
import type { GeneratedTask } from '../types/line.js';

/**
 * Manager task-generation hook.
 *
 * Purpose: Own the scan → decode → generate flow (load lines, decode a QR image
 *   to recipe text, generate the task list) and the "Send to PLC" flow (push the
 *   batch, poll the crane run's handshake, acknowledge on done). While a batch
 *   runs, `batchBusy` disables the Send button; it re-enables when the PLC reports
 *   done. Failures surface as toasts.
 * Returns: The lines + selection, QR text, generated tasks, busy flags, and the
 *   `decode` / `generate` / `sendToPlc` actions.
 */
export function useTaskGenerator() {
  const { notify } = useToast();
  const { lines, loading } = useLines();
  const [lineId, setLineId] = useState('');
  const [qr, setQr] = useState('');
  const [result, setResult] = useState<{ tasks: GeneratedTask[]; lineName: string } | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Effective selection: an explicit pick, else the first line (no effect needed
  // so there's no cascading-render lint warning and no flash before selection).
  const selectedId = lineId || (lines[0]?.id ?? '');

  /** Stop the batch-status poll (idempotent). */
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Poll the crane run once a second: on `done` → toast, acknowledge, re-enable Send. */
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const s = await plcApi.getBatchStatus();
          if (s.done) {
            stopPolling();
            setBatchBusy(false);
            await plcApi.ackBatch().catch(() => undefined);
            notify('Tasks done', 'success');
          } else {
            setBatchBusy(s.busy);
          }
        } catch (err) {
          stopPolling();
          setBatchBusy(false);
          notify(apiErrorMessage(err, 'Lost contact with the PLC while running'), 'error');
        }
      })();
    }, 1000);
  }, [notify, stopPolling]);

  // Resume a run already in progress (e.g. after a page reload) and always clean
  // up the interval on unmount. A 409 (not connected) is swallowed.
  useEffect(() => {
    let alive = true;
    plcApi
      .getBatchStatus()
      .then((s) => {
        if (alive && (s.busy || s.done)) {
          setBatchBusy(true);
          startPolling();
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  /** Decode a QR image file into its recipe text. */
  async function decode(file: File | undefined): Promise<void> {
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
  }

  /** Generate the task list for the selected line + current QR text. */
  async function generate(): Promise<void> {
    if (!selectedId) return notify('Pick a line first', 'error');
    if (!qr.trim()) return notify('Scan or paste QR data first', 'error');
    setGenerating(true);
    try {
      const { line, tasks } = await linesApi.generateTasks(selectedId, qr.trim());
      setResult({ tasks, lineName: line.name });
      notify(`Generated ${tasks.length} tasks`, 'success');
    } catch (err) {
      notify(apiErrorMessage(err, 'Could not generate tasks'), 'error');
    } finally {
      setGenerating(false);
    }
  }

  /** Push the current recipe to the PLC, then poll until the crane run reports done. */
  async function sendToPlc(): Promise<void> {
    if (!selectedId) return notify('Pick a line first', 'error');
    if (!qr.trim()) return notify('Scan or paste QR data first', 'error');
    setSending(true);
    try {
      const r = await plcApi.sendBatch(selectedId, qr.trim());
      setBatchBusy(true);
      notify(`Sent ${r.count} tasks — in progress`, 'success');
      startPolling();
    } catch (err) {
      notify(apiErrorMessage(err, 'Could not send tasks to the PLC'), 'error');
    } finally {
      setSending(false);
    }
  }

  return {
    lines,
    loading,
    lineId: selectedId,
    setLineId,
    qr,
    setQr,
    result,
    decoding,
    generating,
    sending,
    batchBusy,
    decode,
    generate,
    sendToPlc,
  };
}
