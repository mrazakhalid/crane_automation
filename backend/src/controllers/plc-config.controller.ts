import type { NextFunction, Request, Response } from 'express';
import {
  activateConnection,
  connectConnection,
  connectionStatuses,
  createConnection,
  createTag,
  deleteConnection,
  disconnectConnection,
  deleteTag,
  listConnections,
  listTags,
  updateConnection,
  updateTag,
} from '../services/plc-config.service.js';
import { badRequest } from '../utils/http-error.js';

/**
 * PLC Manager controllers (wired behind auth + super-admin middleware).
 *
 * Purpose: Translate HTTP ⇄ service calls for saved OPC UA connections and their
 *   tag mappings; no business logic or DB detail leaks in here.
 */

/** Read the validated connection `:id` param. */
function connIdParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0) throw badRequest('Missing connection id');
  return id;
}

/** Read the validated `:tagId` param. */
function tagIdParam(req: Request): string {
  const tagId = req.params.tagId;
  if (typeof tagId !== 'string' || tagId.length === 0) throw badRequest('Missing tag id');
  return tagId;
}

/* ------------------------------- Connections ------------------------------ */

/** GET /api/plc-connections[?lineId=…] — list saved connections. Returns 200 `{ connections }`. */
export async function getConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lineId = typeof req.query.lineId === 'string' ? req.query.lineId : undefined;
    res.status(200).json({ connections: await listConnections(lineId) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc-connections — create a connection. Returns 201 `{ connection }`. */
export async function postConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json({ connection: await createConnection(req.body) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/plc-connections/:id — edit a connection. Returns 200 `{ connection }`. */
export async function patchConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ connection: await updateConnection(connIdParam(req), req.body) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/plc-connections/:id — remove a connection + its tags. Returns 204. */
export async function deleteConnectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteConnection(connIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc-connections/:id/activate — make it the active connection. Returns 200 `{ connection }`. */
export async function postActivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ connection: await activateConnection(connIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/plc-connections/status — live pool status for every connection. Returns 200 `{ statuses }`. */
export function getStatuses(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.status(200).json({ statuses: connectionStatuses() });
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc-connections/:id/connect — open a live session to this PLC. Returns 200 `{ status }`. */
export async function postConnectConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ status: await connectConnection(connIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc-connections/:id/disconnect — close this PLC's session. Returns 200 `{ status }`. */
export async function postDisconnectConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ status: await disconnectConnection(connIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/* ---------------------------------- Tags ---------------------------------- */

/** GET /api/plc-connections/:id/tags — list a connection's tags. Returns 200 `{ tags }`. */
export async function getTags(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ tags: await listTags(connIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc-connections/:id/tags — add a tag. Returns 201 `{ tag }`. */
export async function postTag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json({ tag: await createTag(connIdParam(req), req.body) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/plc-connections/:id/tags/:tagId — edit a tag. Returns 200 `{ tag }`. */
export async function patchTag(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ tag: await updateTag(connIdParam(req), tagIdParam(req), req.body) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/plc-connections/:id/tags/:tagId — remove a tag. Returns 204. */
export async function deleteTagById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteTag(connIdParam(req), tagIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
