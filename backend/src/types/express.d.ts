import type { Role } from '../models/user.model.js';

/**
 * Express request augmentation.
 *
 * Purpose: Let the auth middleware attach the authenticated principal to the
 *   request in a typed way, so controllers can read `req.user` safely.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: Role;
      };
    }
  }
}

export {};
