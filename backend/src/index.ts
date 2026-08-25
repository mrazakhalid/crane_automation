import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { ensureLineIndexes } from './repositories/line.repository.js';
import { ensurePlcConnectionIndexes } from './repositories/plc-connection.repository.js';
import { ensurePlcTagIndexes } from './repositories/plc-tag.repository.js';
import { ensureRecipeIndexes } from './repositories/recipe.repository.js';
import { ensureUserIndexes } from './repositories/user.repository.js';
import { seedConnectionFromEnv } from './services/plc-config.service.js';
import { autoConnectActivePlc, autoConnectAllPlcs } from './services/plc/plc.service.js';
import { seedSuperAdmin } from './services/seed.js';

/**
 * Server entry point.
 *
 * Purpose: Connect to MongoDB, ensure indexes, seed the bootstrap super-admin,
 *   then boot the HTTP listener. Fails fast (exit 1) if startup cannot complete.
 * Returns: Nothing — keeps the process alive listening on `env.PORT`.
 */
async function main(): Promise<void> {
  await connectDb();
  await ensureUserIndexes();
  await ensureLineIndexes();
  await ensureRecipeIndexes();
  await ensurePlcConnectionIndexes();
  await ensurePlcTagIndexes();
  const created = await seedSuperAdmin();
  if (created) {
    console.log(`👑 Seeded super-admin "${env.SEED_ADMIN_USERNAME}" (change the password!)`);
  }
  if (await seedConnectionFromEnv()) {
    console.log('🔧 Seeded active PLC connection from .env defaults (edit it in PLC Manager)');
  }
  // Start the HTTP listener FIRST so login/API work immediately. PLC auto-connect
  // must never block boot: an unreachable PLC can take ~40 s to time out (ETIMEDOUT),
  // and during that window the server would refuse every request. Both helpers are
  // best-effort and swallow their own errors, so fire them in the background.
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    // Connect the active saved PLC (legacy slot for the manual PLC page) plus every
    // line-assigned PLC (the multi-line pool). A down PLC is logged, not fatal.
    void autoConnectActivePlc();
    void autoConnectAllPlcs();
  });
}

main().catch((err: unknown) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
