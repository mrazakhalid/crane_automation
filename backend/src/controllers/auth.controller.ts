import type { NextFunction, Request, Response } from 'express';
import { changeOwnCredentials, login } from '../services/auth.service.js';
import { findById } from '../repositories/user.repository.js';
import { toPublicUser } from '../models/user.model.js';
import { unauthorized } from '../utils/http-error.js';

/**
 * Auth controllers (translate HTTP ⇄ service calls; no business logic here).
 */

/**
 * POST /api/auth/login — exchange credentials for a JWT.
 * Returns: 200 `{ token, user }`; 401 on bad credentials (via error handler).
 */
export async function postLogin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json(await login(req.body));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me — return the current authenticated user's profile.
 * Returns: 200 `{ user }`; 401 if the token's user no longer exists.
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const record = req.user ? await findById(req.user.id) : null;
    if (!record) throw unauthorized('Session user no longer exists');
    res.status(200).json({ user: toPublicUser(record) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/auth/me/credentials — change the caller's own username/password.
 * Returns: 200 `{ user }`; 409 if the new username is taken.
 */
export async function patchMyCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw unauthorized('Not authenticated');
    const user = await changeOwnCredentials(req.user.id, req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
