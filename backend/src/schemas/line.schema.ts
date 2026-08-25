import * as z from 'zod';

/**
 * Line + task-generation request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize every client body at the HTTP boundary. All use
 *   `strictObject` to reject unknown fields per the charter.
 */

/** A crane code like `7A`, `6`, `1B` — letters/digits only, short. */
const craneCode = z
  .string()
  .trim()
  .min(1, 'Crane code is required')
  .max(10, 'Crane code is too long')
  .regex(/^[A-Za-z0-9-]+$/, 'Crane code: letters, numbers, hyphen only');

/** A tank/position in the layout. */
const tankSchema = z.strictObject({
  number: z.int().min(1, 'Tank number must be ≥ 1').max(999, 'Tank number too large'),
  name: z.string().trim().min(1, 'Tank name is required').max(40, 'Tank name too long'),
  crane: craneCode,
  cranes: z.array(craneCode).min(1).max(6).optional(),
  transfer: z.boolean().optional(),
  note: z.string().trim().max(200, 'Note too long').optional(),
});

/** POST /api/lines — create a line (super-admin only). */
export const createLineSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(3, 'Line name must be at least 3 characters')
    .max(40, 'Line name must be at most 40 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Line name: letters, numbers, space, underscore, hyphen'),
  cranes: z.array(craneCode).min(1, 'At least one crane').max(20, 'Too many cranes'),
  tanks: z.array(tankSchema).min(1, 'At least one tank').max(200, 'Too many tanks'),
});
export type CreateLineInput = z.infer<typeof createLineSchema>;

/**
 * PATCH /api/lines/:id — edit a line (super-admin only). All fields optional,
 * but at least one must be present; unknown fields are still rejected.
 */
export const updateLineSchema = createLineSchema.partial().refine(
  (v) => v.name !== undefined || v.cranes !== undefined || v.tanks !== undefined,
  { message: 'Provide a name, cranes, or tanks to update' },
);
export type UpdateLineInput = z.infer<typeof updateLineSchema>;

/** Route param: line id (UUID). */
export const lineIdParamSchema = z.strictObject({
  id: z.uuid(),
});

/**
 * A raw decoded QR recipe string: `key=seconds;key=seconds;…`. Shared by the
 * task-generation route and the "send batch to PLC" route (same input, one rule).
 */
export const qrRecipe = z
  .string()
  .trim()
  .min(1, 'QR data is required')
  .max(5000, 'QR data is too long')
  .regex(
    /^[^=;]+=\d+(\s*;\s*[^=;]+=\d+)*\s*;?$/,
    'QR data must look like "1-1=60;1-2=30;…" (key=seconds)',
  );

/**
 * POST /api/lines/:id/tasks — decode a QR recipe into a task list.
 * The `qr` string is the raw decoded QR text: `key=seconds;key=seconds;…`.
 */
export const generateTasksSchema = z.strictObject({ qr: qrRecipe });
export type GenerateTasksInput = z.infer<typeof generateTasksSchema>;
