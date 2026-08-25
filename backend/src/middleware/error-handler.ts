import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

/**
 * Centralized error-handling middleware (registered last).
 *
 * Purpose: Convert thrown/forwarded errors into typed JSON responses, hiding
 *   internal detail in production.
 * Args: err, _req, res, _next — the Express error-handler signature.
 * Returns: A JSON `{ error }` payload with an appropriate status code.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.issues });
    return;
  }

  const status =
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';

  res.status(status).json({
    error: env.NODE_ENV === 'production' ? 'Internal Server Error' : message,
  });
}
