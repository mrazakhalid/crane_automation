import * as z from 'zod';
import { WRITE_DATA_TYPES } from '../types/plc.js';

/**
 * Frontend PLC validation (UX mirror only).
 *
 * Purpose: Instant, friendly feedback in the PLC page. The backend remains the
 *   source of truth — these bounds intentionally match `backend/src/schemas/plc.schema.ts`.
 */

/** An `opc.tcp://host:port[/path]` endpoint URL. */
export const endpointSchema = z
  .string()
  .trim()
  .min(1, 'Endpoint is required')
  .max(255, 'Endpoint is too long')
  .regex(/^opc\.tcp:\/\/[^\s]+$/i, 'Endpoint must start with "opc.tcp://"');

/** An OPC UA NodeId string, e.g. `ns=1;s=Coil0`. */
export const nodeIdSchema = z
  .string()
  .trim()
  .min(1, 'NodeId is required')
  .max(200, 'NodeId is too long')
  .regex(/^ns=\d+;[isgb]=.+$/i, 'NodeId must look like "ns=1;s=Coil0"');

/** A write command (node + type + value). */
export const commandSchema = z.object({
  nodeId: nodeIdSchema,
  dataType: z.enum(WRITE_DATA_TYPES),
  value: z.union([z.boolean(), z.number().finite()]),
});
export type CommandForm = z.infer<typeof commandSchema>;
