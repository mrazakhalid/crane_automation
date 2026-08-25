import * as z from 'zod';
import { qrRecipe } from './line.schema.js';

/**
 * PLC / OPC UA request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize every client body/query at the HTTP boundary.
 *   All bodies use `strictObject` to reject unknown fields per the charter.
 */

/** An OPC UA NodeId string, e.g. `ns=1;s=Coil0` or `ns=0;i=2258`. */
const nodeId = z
  .string()
  .trim()
  .min(1, 'NodeId is required')
  .max(200, 'NodeId is too long')
  .regex(/^ns=\d+;[isgb]=.+$/i, 'NodeId must look like "ns=1;s=Coil0"');

/** An `opc.tcp://host:port[/path]` endpoint URL. */
const endpoint = z
  .string()
  .trim()
  .min(1, 'Endpoint is required')
  .max(255, 'Endpoint is too long')
  .regex(/^opc\.tcp:\/\/[^\s]+$/i, 'Endpoint must start with "opc.tcp://"');

/** The subset of OPC UA data types the write endpoint accepts. */
const writeDataType = z.enum(['Boolean', 'Int16', 'UInt16', 'Int32', 'Float', 'Double']);

/** OPC UA security mode/policy (must match one the target server advertises). */
const securityMode = z.enum(['None', 'Sign', 'SignAndEncrypt']);
const securityPolicy = z.enum([
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128_Sha256_RsaOaep',
  'Aes256_Sha256_RsaPss',
]);

/**
 * POST /api/plc/connect — open a session to an endpoint (super-admin).
 * `securityMode`/`securityPolicy` are optional per-request overrides; when omitted
 * the server falls back to the `OPCUA_SECURITY_*` deployment defaults.
 */
export const connectSchema = z.strictObject({
  endpoint,
  securityMode: securityMode.optional(),
  securityPolicy: securityPolicy.optional(),
});
export type ConnectInput = z.infer<typeof connectSchema>;

/** GET /api/plc/read?nodeId=… — read a single node value. */
export const readQuerySchema = z.strictObject({ nodeId });
export type ReadQuery = z.infer<typeof readQuerySchema>;

/**
 * POST /api/plc/command — write a value to the PLC (super-admin).
 * `value` is a boolean (for coils/bits) or a finite number (for registers);
 * the service coerces it against `dataType`.
 */
export const commandSchema = z.strictObject({
  nodeId,
  dataType: writeDataType,
  value: z.union([z.boolean(), z.number().finite()]),
});
export type CommandInput = z.infer<typeof commandSchema>;

/**
 * POST /api/plc/send-batch — push a QR recipe's task list to the PLC.
 * The backend re-generates the tasks from `lineId` + `qr` (source of truth),
 * maps each tank to a station, writes the batch, and arms `cmd_send`.
 */
export const sendBatchSchema = z.strictObject({
  lineId: z.uuid(),
  qr: qrRecipe,
});
export type SendBatchInput = z.infer<typeof sendBatchSchema>;

/**
 * Optional `?connectionId=` on the per-PLC read/ack endpoints (batch-status,
 * batch-ack, crane-view). Omitted → the legacy active slot; a UUID → that PLC.
 */
export const connectionQuerySchema = z.strictObject({ connectionId: z.uuid().optional() });
export type ConnectionQuery = z.infer<typeof connectionQuerySchema>;
