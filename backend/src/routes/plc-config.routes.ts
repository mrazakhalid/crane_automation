import { Router } from 'express';
import {
  deleteConnectionById,
  deleteTagById,
  getConnections,
  getStatuses,
  getTags,
  patchConnection,
  patchTag,
  postActivate,
  postConnectConnection,
  postConnection,
  postDisconnectConnection,
  postTag,
} from '../controllers/plc-config.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  connectionIdParamSchema,
  createConnectionSchema,
  createTagSchema,
  listConnectionsQuerySchema,
  tagParamsSchema,
  updateConnectionSchema,
  updateTagSchema,
} from '../schemas/plc-config.schema.js';

/**
 * PLC Manager routes (all super-admin).
 *
 * Purpose: CRUD for saved OPC UA connections and their tag mappings, so all PLC
 *   configuration is managed in the UI (no `.env`/code change). `requireAuth` +
 *   `requireRole('super_admin')` gate the entire router.
 */
export const plcConfigRouter = Router();

plcConfigRouter.use(requireAuth, requireRole('super_admin'));

// Connections
plcConfigRouter.get('/', validate({ query: listConnectionsQuerySchema }), getConnections);
plcConfigRouter.get('/status', getStatuses); // live pool status (literal path, before /:id/*)
plcConfigRouter.post('/', validate({ body: createConnectionSchema }), postConnection);
plcConfigRouter.patch(
  '/:id',
  validate({ params: connectionIdParamSchema, body: updateConnectionSchema }),
  patchConnection,
);
plcConfigRouter.delete('/:id', validate({ params: connectionIdParamSchema }), deleteConnectionById);
plcConfigRouter.post('/:id/activate', validate({ params: connectionIdParamSchema }), postActivate);
plcConfigRouter.post(
  '/:id/connect',
  validate({ params: connectionIdParamSchema }),
  postConnectConnection,
);
plcConfigRouter.post(
  '/:id/disconnect',
  validate({ params: connectionIdParamSchema }),
  postDisconnectConnection,
);

// Tag mappings (nested under a connection)
plcConfigRouter.get('/:id/tags', validate({ params: connectionIdParamSchema }), getTags);
plcConfigRouter.post(
  '/:id/tags',
  validate({ params: connectionIdParamSchema, body: createTagSchema }),
  postTag,
);
plcConfigRouter.patch(
  '/:id/tags/:tagId',
  validate({ params: tagParamsSchema, body: updateTagSchema }),
  patchTag,
);
plcConfigRouter.delete('/:id/tags/:tagId', validate({ params: tagParamsSchema }), deleteTagById);
