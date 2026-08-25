import type { NextFunction, Request, Response } from 'express';
import {
  createLine,
  deleteLine,
  generateTasksForLine,
  getLine,
  listLines,
  updateLine,
} from '../services/line.service.js';
import { badRequest } from '../utils/http-error.js';

/** Read the validated `:id` route param (guards the index-signature type). */
function requireIdParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0) throw badRequest('Missing line id');
  return id;
}

/**
 * Line controllers (wired behind auth/role middleware).
 */

/** GET /api/lines — list all lines. Returns 200 `{ lines }`. */
export async function getLines(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({ lines: await listLines() });
  } catch (err) {
    next(err);
  }
}

/** POST /api/lines — create a line (super-admin). Returns 201 `{ line }`. */
export async function postLine(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(201).json({ line: await createLine(req.body) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/lines/:id — fetch one line. Returns 200 `{ line }`. */
export async function getLineById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({ line: await getLine(requireIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/lines/:id — edit a line (super-admin). Returns 200 `{ line }`. */
export async function patchLine(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({ line: await updateLine(requireIdParam(req), req.body) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/lines/:id — remove a line (super-admin). Returns 204. */
export async function deleteLineById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteLine(requireIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/lines/:id/tasks — decode a QR recipe into a task list.
 * Returns: 200 `{ line, tasks }`.
 */
export async function postLineTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { qr } = req.body as { qr: string };
    res.status(200).json(await generateTasksForLine(requireIdParam(req), qr));
  } catch (err) {
    next(err);
  }
}
