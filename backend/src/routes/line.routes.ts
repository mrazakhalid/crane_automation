import { Router } from 'express';
import {
  deleteLineById,
  getLineById,
  getLines,
  patchLine,
  postLine,
  postLineTasks,
} from '../controllers/line.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createLineSchema,
  generateTasksSchema,
  lineIdParamSchema,
  updateLineSchema,
} from '../schemas/line.schema.js';

/**
 * Line routes.
 *
 * Purpose: Super-admins create lines; any authenticated user reads them and
 *   generates a task list from a scanned QR (managers on the dashboard).
 *   `requireAuth` gates everything; `requireRole('super_admin')` gates creation.
 */
export const lineRouter = Router();

lineRouter.use(requireAuth);

lineRouter.get('/', getLines);
lineRouter.post('/', requireRole('super_admin'), validate({ body: createLineSchema }), postLine);
lineRouter.get('/:id', validate({ params: lineIdParamSchema }), getLineById);
lineRouter.patch(
  '/:id',
  requireRole('super_admin'),
  validate({ params: lineIdParamSchema, body: updateLineSchema }),
  patchLine,
);
lineRouter.delete(
  '/:id',
  requireRole('super_admin'),
  validate({ params: lineIdParamSchema }),
  deleteLineById,
);
lineRouter.post(
  '/:id/tasks',
  validate({ params: lineIdParamSchema, body: generateTasksSchema }),
  postLineTasks,
);
