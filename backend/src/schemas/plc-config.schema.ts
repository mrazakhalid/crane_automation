import * as z from 'zod';
import { SECURITY_MODES, SECURITY_POLICIES } from '../models/plc-connection.model.js';
import { TAG_DATA_TYPES, TAG_DIRECTIONS } from '../models/plc-tag.model.js';

/**
 * PLC Manager request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize every super-admin body/param for saved OPC UA
 *   connections and tag mappings. All bodies use `strictObject` to reject unknown
 *   fields per the charter; enums are derived from the domain models so the API
 *   and DB never drift.
 */

/** A friendly connection name (shown in the UI). */
const connectionName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name must be at most 60 characters')
  .regex(/^[A-Za-z0-9 _-]+$/, 'Name: letters, numbers, space, underscore, hyphen');

/** An `opc.tcp://host:port[/path]` endpoint URL. */
const endpoint = z
  .string()
  .trim()
  .min(1, 'Endpoint is required')
  .max(255, 'Endpoint is too long')
  .regex(/^opc\.tcp:\/\/[^\s]+$/i, 'Endpoint must start with "opc.tcp://"');

const securityMode = z.enum(SECURITY_MODES);
const securityPolicy = z.enum(SECURITY_POLICIES);

/** The plant line this PLC serves (UUID), or null to leave it unassigned. */
const lineId = z.uuid().nullable();

/**
 * The cranes this PLC controls (by name, e.g. `6`, `7A`). Bounded and
 * de-duplicated; membership in the chosen line's cranes is enforced in the
 * service (the line is the source of truth for which crane codes are valid).
 */
const craneName = z
  .string()
  .trim()
  .min(1, 'Crane name is required')
  .max(20, 'Crane name is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Crane name: letters, numbers, underscore, hyphen');
const cranes = z
  .array(craneName)
  .max(20, 'At most 20 cranes per PLC')
  .refine((list) => new Set(list).size === list.length, 'Duplicate crane in the list');

/** A friendly tag label (e.g. "cycle_count"). */
const tagLabel = z
  .string()
  .trim()
  .min(1, 'Label is required')
  .max(60, 'Label is too long')
  .regex(/^[A-Za-z0-9 _.-]+$/, 'Label: letters, numbers, space, underscore, dot, hyphen');

/** An OPC UA NodeId string, e.g. `ns=3;s="PlcData"."run"` or `ns=2;i=1`. */
const nodeId = z
  .string()
  .trim()
  .min(1, 'NodeId is required')
  .max(200, 'NodeId is too long')
  .regex(/^ns=\d+;[isgb]=.+$/i, 'NodeId must look like "ns=1;s=Coil0"');

const dataType = z.enum(TAG_DATA_TYPES);
const direction = z.enum(TAG_DIRECTIONS);

/** An optional human note; empty string is normalized to null in the service. */
const description = z.string().trim().max(200, 'Description is too long').optional();

/* ------------------------------- Connections ------------------------------ */

/** POST /api/plc-connections — create a saved connection (super-admin). */
export const createConnectionSchema = z.strictObject({
  name: connectionName,
  endpoint,
  securityMode,
  securityPolicy,
  lineId: lineId.optional(),
  cranes: cranes.optional(),
});
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

/** PATCH /api/plc-connections/:id — edit a connection; at least one field. */
export const updateConnectionSchema = z
  .strictObject({
    name: connectionName.optional(),
    endpoint: endpoint.optional(),
    securityMode: securityMode.optional(),
    securityPolicy: securityPolicy.optional(),
    lineId: lineId.optional(),
    cranes: cranes.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.endpoint !== undefined ||
      v.securityMode !== undefined ||
      v.securityPolicy !== undefined ||
      v.lineId !== undefined ||
      v.cranes !== undefined,
    { message: 'Provide at least one field to update' },
  );
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;

/** Route param: connection id (UUID). */
export const connectionIdParamSchema = z.strictObject({ id: z.uuid() });

/** GET /api/plc-connections?lineId=… — optional filter by line. */
export const listConnectionsQuerySchema = z.strictObject({ lineId: z.uuid().optional() });
export type ListConnectionsQuery = z.infer<typeof listConnectionsQuerySchema>;

/* ---------------------------------- Tags ---------------------------------- */

/** POST /api/plc-connections/:id/tags — add a tag mapping (super-admin). */
export const createTagSchema = z.strictObject({
  label: tagLabel,
  nodeId,
  dataType,
  direction,
  description,
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

/** PATCH /api/plc-connections/:id/tags/:tagId — edit a tag; at least one field. */
export const updateTagSchema = z
  .strictObject({
    label: tagLabel.optional(),
    nodeId: nodeId.optional(),
    dataType: dataType.optional(),
    direction: direction.optional(),
    description,
  })
  .refine(
    (v) =>
      v.label !== undefined ||
      v.nodeId !== undefined ||
      v.dataType !== undefined ||
      v.direction !== undefined ||
      v.description !== undefined,
    { message: 'Provide at least one field to update' },
  );
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

/** Route params: connection id + tag id (both UUID). */
export const tagParamsSchema = z.strictObject({ id: z.uuid(), tagId: z.uuid() });
