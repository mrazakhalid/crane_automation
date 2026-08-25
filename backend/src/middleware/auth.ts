import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../models/user.model.js';
import { verifyToken } from '../services/token.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

/**
 * Authentication + authorization middleware.
 *
 * Purpose: Enforce that protected endpoints have a valid bearer token, and that
 *   role-gated endpoints are reached only by the allowed roles.
 */

/**
 * Require a valid `Authorization: Bearer <jwt>` header and attach `req.user`.
 *
 * Raises (via next): 401 when the header is missing/malformed or the token is
 *   invalid/expired.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(unauthorized('Missing or malformed Authorization header'));
    return;
  }
  try {
    const claims = verifyToken(token);
    req.user = { id: claims.sub, username: claims.username, role: claims.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

/**
 * Require the authenticated user to hold one of the given roles.
 *
 * Args: roles — the allowed roles.
 * Returns: Middleware that 403s when the role is not permitted. Must be chained
 *   after `requireAuth`.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized('Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}
