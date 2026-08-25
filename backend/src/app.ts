import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { createGlobalLimiter, createLoginLimiter } from './middleware/rate-limit.js';
import { apiRouter } from './routes/index.js';

/**
 * Build and configure the Express application.
 *
 * Purpose: Wire security middleware, body parsing, feature routes, and error
 *   handling in the correct order. Exported separately from the server
 *   listener so tests (supertest) can import the app without opening a port.
 * Returns: A configured `Express` instance (not yet listening).
 */
export function createApp(): Express {
  const app = express();

  // Security-first defaults: headers, CORS allow-list, and rate limiting. When
  // the desktop bundle serves the SPA (CLIENT_DIR set), the default CSP is
  // relaxed because the built index.html uses a small inline theme script.
  app.use(helmet({ contentSecurityPolicy: env.CLIENT_DIR ? false : undefined }));
  app.use(cors({ origin: env.CORS_ORIGIN }));
  // Generous global cap (skips the authenticated ~1/s PLC poll), plus a strict
  // limiter on login so brute-force guessing is bounded without locking out users.
  app.use(createGlobalLimiter());
  app.use('/api/auth/login', createLoginLimiter());

  // Body parsing with sane size bounds.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Feature routes are mounted under /api.
  app.use('/api', apiRouter);

  // Desktop bundle: also serve the built frontend so one process serves UI + API.
  // The SPA fallback returns index.html for any non-/api GET route.
  if (env.CLIENT_DIR) {
    app.use(express.static(env.CLIENT_DIR));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(env.CLIENT_DIR, 'index.html'));
    });
  }

  // 404 + centralized error handling — must be registered last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
