import { Router } from 'express';
import { getStatus, postPlan, postStart, postStop } from '../controllers/process.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { processInputSchema, runIdParamSchema } from '../schemas/process.schema.js';

/**
 * Process routes.
 *
 * Purpose: Managers (and super-admins) divide a cross-line recipe into per-PLC
 *   task chains and run it as a live simulation. `requireAuth` gates everything;
 *   the manager/super-admin roles gate the plan/run actions (same audience as
 *   task generation and recipe management).
 */
export const processRouter = Router();

const canRun = requireRole('manager', 'super_admin');

processRouter.use(requireAuth);

processRouter.post('/plan', canRun, validate({ body: processInputSchema }), postPlan);
processRouter.post('/start', canRun, validate({ body: processInputSchema }), postStart);
processRouter.get('/:runId/status', validate({ params: runIdParamSchema }), getStatus);
processRouter.post('/:runId/stop', canRun, validate({ params: runIdParamSchema }), postStop);
