import type { NextFunction, Request, Response } from 'express';
import {
  changeUserCredentials,
  createManagedUser,
  listUsers,
  removeManagedUser,
} from '../services/user.service.js';
import { badRequest } from '../utils/http-error.js';

/** Read the validated `:id` route param (guards the index-signature type). */
function requireIdParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0) throw badRequest('Missing user id');
  return id;
}

/**
 * User-management controllers (super-admin only; wired behind role middleware).
 */

/** GET /api/users — list all users (super-admins, managers, operators). Returns 200 `{ users }`. */
export async function getUsers(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({ users: await listUsers() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users — create a manager/operator with a supplied username/password.
 * Returns: 201 `{ user }`.
 */
export async function postUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await createManagedUser(req.body);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/users/:id/credentials — rotate a managed user's credentials.
 * Returns: 200 `{ user }`.
 */
export async function patchUserCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await changeUserCredentials(requireIdParam(req), req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/users/:id — remove a managed user. Returns 204. */
export async function deleteUserById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await removeManagedUser(requireIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
