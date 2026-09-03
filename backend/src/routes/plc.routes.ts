import { Router } from 'express';
import {
  deleteLogs,
  getBatch,
  getCrane,
  getLogs,
  getPlant,
  getRead,
  getState,
  postBatchAck,
  postCommand,
  postConnect,
  postDisconnect,
  postSendBatch,
} from '../controllers/plc.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  commandSchema,
  connectSchema,
  connectionQuerySchema,
  readQuerySchema,
  sendBatchSchema,
} from '../schemas/plc.schema.js';

/**
 * PLC / OPC UA routes.
 *
 * Purpose: Any authenticated user can read status/values (monitoring) and run a
 *   scanned recipe (send batch / poll status / acknowledge) — that's the manager's
 *   core action. Changing the connection or writing an arbitrary node is
 *   super-admin-only. `requireAuth` gates everything; `requireRole('super_admin')`
 *   gates the connection/raw-write actions.
 */
export const plcRouter = Router();

plcRouter.use(requireAuth);

plcRouter.get('/state', getState);
plcRouter.get('/read', validate({ query: readQuerySchema }), getRead);

// Crane batch flow (manager): send a recipe, poll the run, acknowledge on done.
// The read/ack endpoints take an optional ?connectionId= to target a specific PLC.
plcRouter.post('/send-batch', validate({ body: sendBatchSchema }), postSendBatch);
plcRouter.get('/batch-status', validate({ query: connectionQuerySchema }), getBatch);
plcRouter.post('/batch-ack', validate({ query: connectionQuerySchema }), postBatchAck);
plcRouter.get('/crane-view', validate({ query: connectionQuerySchema }), getCrane);
plcRouter.get('/plant-view', getPlant);
plcRouter.get('/logs', getLogs);
plcRouter.delete('/logs', deleteLogs);

plcRouter.post('/connect', requireRole('super_admin'), validate({ body: connectSchema }), postConnect);
plcRouter.post('/disconnect', requireRole('super_admin'), postDisconnect);
plcRouter.post('/command', requireRole('super_admin'), validate({ body: commandSchema }), postCommand);
