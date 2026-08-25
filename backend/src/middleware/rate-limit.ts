import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Rate limiters.
 *
 * Purpose: Bound abuse without throttling the control UI's legitimate ~1/s live
 *   polling. Exposed as factories (not shared singletons) so every `createApp()`
 *   gets isolated counters — important for deterministic tests.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Authenticated, high-frequency poll endpoints. The PLC page reads the live node
 * once a second; counting these would exhaust any sane global cap in minutes and
 * 429 every other route (including /login). They require auth, so excluding them
 * from the global cap does not widen the abuse surface meaningfully.
 */
const POLL_PATHS = new Set([
  '/api/plc/read',
  '/api/plc/state',
  '/api/plc/batch-status',
  '/api/plc/crane-view',
]);

/**
 * Global safety-net limiter for all routes except the live-poll endpoints.
 *
 * Returns: A fresh rate-limit middleware (own in-memory store).
 */
export function createGlobalLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => POLL_PATHS.has(req.path),
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
  });
}

/**
 * Strict limiter for the login endpoint: only failed attempts count
 * (`skipSuccessfulRequests`), so a legitimate user is never locked out while
 * brute-force guessing is capped.
 *
 * Returns: A fresh rate-limit middleware (own in-memory store).
 */
export function createLoginLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
  });
}
