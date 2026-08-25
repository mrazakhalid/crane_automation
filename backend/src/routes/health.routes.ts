import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

/**
 * Health-check routes.
 *
 * Purpose: HTTP wiring only (path → controller). No business logic here.
 */
export const healthRouter = Router();

healthRouter.get('/', getHealth);
