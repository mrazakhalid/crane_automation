import type { NextFunction, Request, Response } from 'express';
import {
  connectPlc,
  disconnectPlc,
  getPlcState,
  readNode,
  sendCommand,
} from '../services/plc/plc.service.js';
import { ackBatch, getBatchStatus, getCraneView, sendBatch } from '../services/plc/batch.service.js';
import type { CommandInput, ConnectInput, ReadQuery, SendBatchInput } from '../schemas/plc.schema.js';

/**
 * PLC controllers (wired behind auth/role middleware).
 *
 * Purpose: Translate HTTP ⇄ service calls for the OPC UA connection; no
 *   business logic or protocol detail leaks in here.
 */

/** GET /api/plc/state — connection status + active connection defaults/tags. */
export async function getState(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getPlcState());
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc/connect — open a session (super-admin). Returns 200 `{ connection }`. */
export async function postConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { endpoint, securityMode, securityPolicy } = req.body as ConnectInput;
    res.status(200).json({ connection: await connectPlc(endpoint, securityMode, securityPolicy) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc/disconnect — close the session (super-admin). Returns 200 `{ connection }`. */
export async function postDisconnect(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ connection: await disconnectPlc() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/plc/read?nodeId=… — read a node value. Returns 200 with the read result. */
export async function getRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nodeId } = req.query as unknown as ReadQuery;
    res.status(200).json(await readNode(nodeId));
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc/command — write a value to the PLC (super-admin). Returns 200 with the read-back. */
export async function postCommand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nodeId, dataType, value } = req.body as CommandInput;
    res.status(200).json(await sendCommand(nodeId, dataType, value));
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc/send-batch — push a QR recipe's task list to the PLC. Returns 200 `{ count, busy }`. */
export async function postSendBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { lineId, qr } = req.body as SendBatchInput;
    res.status(200).json(await sendBatch(lineId, qr));
  } catch (err) {
    next(err);
  }
}

/** Read the optional `?connectionId=` query (a specific PLC), or undefined for the legacy slot. */
function connectionIdQuery(req: Request): string | undefined {
  return typeof req.query.connectionId === 'string' ? req.query.connectionId : undefined;
}

/** GET /api/plc/batch-status[?connectionId=] — read one PLC's run handshake. Returns 200 `{ busy, done, step }`. */
export async function getBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getBatchStatus(connectionIdQuery(req)));
  } catch (err) {
    next(err);
  }
}

/** POST /api/plc/batch-ack[?connectionId=] — clear `cmd_send` on one PLC. Returns 200 with fresh status. */
export async function postBatchAck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await ackBatch(connectionIdQuery(req)));
  } catch (err) {
    next(err);
  }
}

/** GET /api/plc/crane-view[?connectionId=] — live crane snapshot for the visualizer. Returns 200 `CraneView`. */
export async function getCrane(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getCraneView(connectionIdQuery(req)));
  } catch (err) {
    next(err);
  }
}
