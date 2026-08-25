import type { ProcessPlan, RunStatus, RunStep, RunTaskState } from '../../models/process.model.js';
import { notFoundError } from '../../utils/http-error.js';
import { newId } from '../../utils/id.js';

/**
 * Simulated process run engine (in-memory, time-derived — no background timers).
 *
 * Purpose: Bring a `ProcessPlan` "to life" without any PLC. Each crane chain runs
 *   its tasks strictly in order; different cranes run in PARALLEL. Status is not
 *   ticked by a timer — every poll DERIVES each task's state from the wall-clock
 *   elapsed since the run started versus that task's scheduled window. This is
 *   exactly the shape the real flow will take (poll the PLC's handshake), so the
 *   later swap to OPC UA is localized to this file.
 *
 * Runs are ephemeral (a `Map` keyed by runId); a server restart drops in-flight
 * runs, which is acceptable for this simulation. Recipes, by contrast, persist.
 */

/** Floor on a task's visible duration (s) so zero-dwell steps still animate. */
const MIN_TASK_SECONDS = 1;

/** A scheduled task window within a run (offsets from `startedAt`, in ms). */
interface Slot {
  start: number;
  end: number;
}

/** A live (simulated) run. */
interface Run {
  runId: string;
  startedAt: number;
  /** step number → its scheduled window. Only resolved (grouped) steps are here. */
  schedule: Map<number, Slot>;
  totalDurationMs: number;
}

/** In-memory registry of active runs. */
const runs = new Map<string, Run>();

/**
 * Start simulating a plan.
 *
 * Args: plan — a `ProcessPlan`; its `groups` carry the crane chains to run.
 * Returns: the new `runId`.
 *
 * Scheduling: within each crane chain, task `k` starts when task `k-1` ends
 * (sequential); chains start together at t=0 (parallel). A task's duration is
 * `max(dwell, MIN_TASK_SECONDS)` seconds.
 */
export function startRun(plan: ProcessPlan): string {
  const schedule = new Map<number, Slot>();
  let totalDurationMs = 0;

  for (const group of plan.groups) {
    for (const chain of group.cranes) {
      let cursor = 0; // ms offset within this crane's chain
      for (const task of chain.tasks) {
        const durationMs = Math.max(task.time, MIN_TASK_SECONDS) * 1000;
        const slot: Slot = { start: cursor, end: cursor + durationMs };
        schedule.set(task.step, slot);
        cursor = slot.end;
      }
      totalDurationMs = Math.max(totalDurationMs, cursor);
    }
  }

  const runId = newId();
  runs.set(runId, { runId, startedAt: Date.now(), schedule, totalDurationMs });
  return runId;
}

/** Derive a single task's state from the elapsed time versus its window. */
function stateOf(slot: Slot, elapsed: number): RunTaskState {
  if (elapsed >= slot.end) return 'done';
  if (elapsed >= slot.start) return 'in_progress';
  return 'idle';
}

/**
 * Read a run's live status (computed from elapsed time — safe to poll every second).
 *
 * Args: runId — the run to read.
 * Returns: `{ runId, done, progress, steps }` — per-step live state.
 * Raises: 404 if the run is unknown (e.g. after `stopRun` or a server restart).
 */
export function getRunStatus(runId: string): RunStatus {
  const run = runs.get(runId);
  if (!run) throw notFoundError('Run not found');

  const elapsed = Date.now() - run.startedAt;
  const steps: RunStep[] = [];
  let doneCount = 0;
  for (const [step, slot] of run.schedule) {
    const state = stateOf(slot, elapsed);
    if (state === 'done') doneCount += 1;
    steps.push({ step, state });
  }
  steps.sort((a, b) => a.step - b.step);

  const total = run.schedule.size;
  const done = elapsed >= run.totalDurationMs;
  return {
    runId,
    done,
    progress: total === 0 ? 1 : doneCount / total,
    steps,
  };
}

/**
 * Stop and discard a run (the "Stop / reset" action).
 *
 * Args: runId — the run to remove.
 * Returns: true if a run was removed, false if it was already gone.
 */
export function stopRun(runId: string): boolean {
  return runs.delete(runId);
}

/** Test helper: clear every in-memory run. */
export function _clearRuns(): void {
  runs.clear();
}
