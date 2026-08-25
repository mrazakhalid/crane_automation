import { Router } from 'express';
import {
  deleteUserById,
  getUsers,
  patchUserCredentials,
  postUser,
} from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  updateCredentialsSchema,
  userIdParamSchema,
} from '../schemas/auth.schema.js';

/**
 * User-management routes — super-admin only.
 *
 * Purpose: Create/list/edit/remove managers and operators. Every route is gated
 *   by `requireAuth` + `requireRole('super_admin')` (no IDOR: the service layer
 *   additionally refuses to touch super-admin records).
 */
export const userRouter = Router();

userRouter.use(requireAuth, requireRole('super_admin'));

userRouter.get('/', getUsers);
userRouter.post('/', validate({ body: createUserSchema }), postUser);
userRouter.patch(
  '/:id/credentials',
  validate({ params: userIdParamSchema, body: updateCredentialsSchema }),
  patchUserCredentials,
);
userRouter.delete('/:id', validate({ params: userIdParamSchema }), deleteUserById);
