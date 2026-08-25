import { defineConfig } from 'vitest/config';

/**
 * Vitest config (backend).
 *
 * Purpose: Force tests onto an ISOLATED in-memory MongoDB by blanking
 *   MONGODB_URI for the test process — even when a real `.env` points the dev
 *   server at a local MongoDB. This keeps the suite hermetic and prevents tests
 *   from ever reading or writing the developer's real database.
 */
export default defineConfig({
  test: {
    env: {
      MONGODB_URI: '',
      MONGODB_DB: 'crane_automation_test',
    },
  },
});
