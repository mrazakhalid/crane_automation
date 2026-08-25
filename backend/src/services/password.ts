import bcrypt from 'bcryptjs';

/**
 * Password hashing helpers (pure logic — no HTTP, no DB).
 *
 * Purpose: Centralize hashing so the algorithm/cost lives in one place.
 */
const SALT_ROUNDS = 10;

/** Hash a plaintext password with bcrypt. Returns the hash string. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify a plaintext password against a stored hash. Returns a boolean. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
