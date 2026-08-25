import * as z from 'zod';

/**
 * Frontend line-builder validation (UX mirror only).
 *
 * Purpose: Instant, friendly feedback in the line form. The backend remains the
 *   source of truth — these bounds intentionally match `backend/src/schemas`.
 */
const craneCode = z
  .string()
  .trim()
  .min(1, 'Crane code is required')
  .max(10, 'Crane code is too long')
  .regex(/^[A-Za-z0-9-]+$/, 'Crane code: letters, numbers, hyphen only');

const tank = z.object({
  number: z.number().int('Tank number must be a whole number').min(1, 'Tank number must be ≥ 1'),
  name: z.string().trim().min(1, 'Tank name is required').max(40, 'Tank name too long'),
  crane: craneCode,
  cranes: z.array(craneCode).optional(),
  transfer: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

/** A full line layout as edited in the builder. */
export const lineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Line name must be at least 3 characters')
    .max(40, 'Line name must be at most 40 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Line name: letters, numbers, space, underscore, hyphen'),
  cranes: z.array(craneCode).min(1, 'Add at least one crane'),
  tanks: z.array(tank).min(1, 'Add at least one tank'),
});
export type LineForm = z.infer<typeof lineSchema>;
