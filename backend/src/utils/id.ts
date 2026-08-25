import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a new UUID v7 identifier.
 *
 * Purpose: Central helper so all new IDs use time-ordered UUID v7 (per charter).
 * Returns: A UUID v7 string.
 */
export function newId(): string {
  return uuidv7();
}
