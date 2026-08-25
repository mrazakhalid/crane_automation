/**
 * Health service (business-logic layer — ignorant of HTTP).
 *
 * Purpose: Produce the service liveness payload.
 * Returns: `{ status, uptime, timestamp }`.
 */
export function checkHealth(): {
  status: 'ok';
  uptime: number;
  timestamp: string;
} {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
