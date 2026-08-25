import type { Request, Response } from 'express';

/**
 * 404 handler for unmatched routes.
 *
 * Purpose: Return a consistent JSON 404 instead of Express's default HTML.
 * Args: req — Express request; res — Express response.
 * Returns: 404 with `{ error }`.
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.originalUrl}` });
}
