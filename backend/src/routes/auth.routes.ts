import { Router } from 'express';
import { getMe, patchMyCredentials, postLogin } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, updateCredentialsSchema } from '../schemas/auth.schema.js';

/**
 * Auth routes (HTTP wiring only: path → middleware → controller).
 *
 * Purpose: Unified login for all roles, plus self-service session endpoints.
 */
export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), postLogin);
authRouter.get('/me', requireAuth, getMe);
authRouter.patch(
  '/me/credentials',
  requireAuth,
  validate({ body: updateCredentialsSchema }),
  patchMyCredentials,
);
