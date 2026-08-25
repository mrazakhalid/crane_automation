import * as z from 'zod';
import { SECURITY_MODES, SECURITY_POLICIES } from '../types/plc.js';
import { TAG_DATA_TYPES, TAG_DIRECTIONS } from '../types/plc-config.js';

/**
 * PLC Manager form schemas (frontend UX mirror of the backend contract).
 *
 * Purpose: Give instant, friendly validation in the connection/tag forms. The
 *   backend re-validates (source of truth); these only improve UX.
 */

export const connectionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name must be at most 60 characters')
      .regex(/^[A-Za-z0-9 _-]+$/, 'Name: letters, numbers, space, underscore, hyphen'),
    endpoint: z
      .string()
      .trim()
      .min(1, 'Endpoint is required')
      .max(255, 'Endpoint is too long')
      .regex(/^opc\.tcp:\/\/[^\s]+$/i, 'Endpoint must start with "opc.tcp://"'),
    securityMode: z.enum(SECURITY_MODES),
    securityPolicy: z.enum(SECURITY_POLICIES),
    lineId: z.uuid().nullable().optional(),
    cranes: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  // Cranes are meaningless without a line (mirrors the backend rule) — UX guard.
  .refine((v) => !(v.cranes && v.cranes.length > 0) || !!v.lineId, {
    message: 'Choose a line before selecting cranes',
    path: ['cranes'],
  });
export type ConnectionForm = z.infer<typeof connectionSchema>;

export const tagSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(60, 'Label is too long')
    .regex(/^[A-Za-z0-9 _.-]+$/, 'Label: letters, numbers, space, underscore, dot, hyphen'),
  nodeId: z
    .string()
    .trim()
    .min(1, 'NodeId is required')
    .max(200, 'NodeId is too long')
    .regex(/^ns=\d+;[isgb]=.+$/i, 'NodeId must look like "ns=1;s=Coil0"'),
  dataType: z.enum(TAG_DATA_TYPES),
  direction: z.enum(TAG_DIRECTIONS),
  description: z.string().trim().max(200, 'Description is too long').optional(),
});
export type TagForm = z.infer<typeof tagSchema>;
