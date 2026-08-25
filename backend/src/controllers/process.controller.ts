import type { NextFunction, Request, Response } from 'express';
import { planProcess } from '../services/process/planner.js';
import { getRunStatus, startRun, stopRun } from '../services/process/run-engine.js';
import { badRequest } from '../utils/http-error.js';

/**
 * Process controllers — plan a cross-line recipe, then run it as a live simulation.
 * Wired behind auth/role middleware (managers + super-admins).
 */

/** Read the validated `:runId` route param (guards the index-signature type). */
function requireRunIdParam(req: Request): string {
  const runId = req.params.runId;
  if (typeof runId !== 'string' || runId.length === 0) throw badRequest('Missing run id');
  return runId;
}

/**
 * POST /api/process/plan — divide a recipe across lines/PLCs (dry run, no run started).
 * Returns: 200 `{ plan }`.
 */
export async function postPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { qr, overrides } = req.body as { qr: string; overrides?: Record<string, string> };
    res.status(200).json({ plan: await planProcess(qr, overrides) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/process/start — plan a recipe and begin a live simulated run.
 * Returns: 201 `{ runId, plan }`.
 */
export async function postStart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { qr, overrides } = req.body as { qr: string; overrides?: Record<string, string> };
    const plan = await planProcess(qr, overrides);
    const runId = startRun(plan);
    res.status(201).json({ runId, plan });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/process/:runId/status — poll a run's live per-task status.
 * Returns: 200 `{ status }`.
 */
export function getStatus(req: Request, res: Response, next: NextFunction): void {
  try {
    res.status(200).json({ status: getRunStatus(requireRunIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/process/:runId/stop — stop and reset a run.
 * Returns: 204.
 */
export function postStop(req: Request, res: Response, next: NextFunction): void {
  try {
    stopRun(requireRunIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
