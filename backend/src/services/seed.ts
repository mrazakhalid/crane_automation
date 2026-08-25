import type { UserRecord } from '../models/user.model.js';
import * as userRepo from '../repositories/user.repository.js';
import { env } from '../config/env.js';
import { newId } from '../utils/id.js';
import { hashPassword } from './password.js';

/**
 * Bootstrap seed (idempotent).
 *
 * Purpose: Guarantee a super-admin exists so the app is usable on first run.
 *   Uses the configured seed credentials (default "admin / admin"). Runs on
 *   every boot but only inserts when the account is absent.
 * Returns: `true` if the super-admin was created, `false` if it already existed.
 */
export async function seedSuperAdmin(): Promise<boolean> {
  const existing = await userRepo.findByUsername(env.SEED_ADMIN_USERNAME);
  if (existing) return false;

  const now = new Date().toISOString();
  const record: UserRecord = {
    _id: newId(),
    username: env.SEED_ADMIN_USERNAME,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    role: 'super_admin',
    createdAt: now,
    updatedAt: now,
  };
  await userRepo.insertUser(record);
  return true;
}
