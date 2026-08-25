import type { ProcessPlan, RunStatus } from '../types/process.js';
import type { StepOverrides } from '../types/recipe.js';
import { apiClient } from './client.js';

/**
 * Process API wrappers.
 *
 * Purpose: Typed calls to the `/process` endpoints — divide a cross-line recipe
 *   into per-PLC task chains (`plan`), start a live simulated run, poll its
 *   status, and stop it.
 */

/** POST /process/plan — divide a recipe across lines/PLCs (dry run). */
export async function planProcess(qr: string, overrides?: StepOverrides): Promise<ProcessPlan> {
  const { data } = await apiClient.post<{ plan: ProcessPlan }>('/process/plan', { qr, overrides });
  return data.plan;
}

/** POST /process/start — plan the recipe and begin a live simulated run. */
export async function startProcess(
  qr: string,
  overrides?: StepOverrides,
): Promise<{ runId: string; plan: ProcessPlan }> {
  const { data } = await apiClient.post<{ runId: string; plan: ProcessPlan }>('/process/start', {
    qr,
    overrides,
  });
  return data;
}

/** GET /process/:runId/status — poll a run's live per-task status. */
export async function getRunStatus(runId: string): Promise<RunStatus> {
  const { data } = await apiClient.get<{ status: RunStatus }>(`/process/${runId}/status`);
  return data.status;
}

/** POST /process/:runId/stop — stop and reset a run. */
export async function stopProcess(runId: string): Promise<void> {
  await apiClient.post(`/process/${runId}/stop`);
}
