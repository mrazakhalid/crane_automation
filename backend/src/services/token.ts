import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../models/user.model.js';

/**
 * JWT sign/verify helpers (pure logic — no HTTP, no DB).
 *
 * Purpose: Issue and validate stateless auth tokens in one place so the secret
 *   and claim shape never leak into controllers.
 */
export interface TokenClaims {
  sub: string; // user id
  username: string;
  role: Role;
}

/** Sign a signed JWT for the given principal. Returns the token string. */
export function signToken(claims: TokenClaims): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(claims, env.JWT_SECRET, options);
}

/**
 * Verify a token and return its claims.
 *
 * Args: token — the raw JWT string.
 * Returns: The decoded `TokenClaims`.
 * Raises: `jwt.JsonWebTokenError`/`TokenExpiredError` when invalid or expired.
 */
export function verifyToken(token: string): TokenClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') throw new Error('Malformed token payload');
  const { sub, username, role } = decoded as jwt.JwtPayload & Partial<TokenClaims>;
  if (!sub || !username || !role) throw new Error('Malformed token payload');
  return { sub, username, role };
}
