/**
 * Storage lifecycle (compat shim).
 *
 * Purpose: Preserve the `connectDb` / `closeDb` names the app boot and tests
 *   already use, now backed by the pluggable storage layer. The actual driver
 *   (Mongo or SQLite) is chosen by `STORAGE_DRIVER` — see `storage/index.ts`.
 */
export { connectStorage as connectDb, closeStorage as closeDb } from '../storage/index.js';
