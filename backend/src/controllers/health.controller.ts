import type { Request, Response } from 'express';
import { checkHealth } from '../services/health.service.js';

/**
 * GET /api/health controller.
 *
 * Purpose: Translate the HTTP request into a service call and shape the
 *   response, keeping HTTP concerns out of the service layer.
 * Args: _req — unused Express request; res — Express response.
 * Returns: 200 with the service's health payload.
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json(checkHealth());
}
