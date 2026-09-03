import type {
  BatchStatus,
  CraneView,
  PlantView,
  PlcConnection,
  PlcState,
  ReadResult,
  SecurityMode,
  SecurityPolicy,
  SendBatchResult,
  WriteDataType,
} from '../types/plc.js';
import { apiClient } from './client.js';

/**
 * PLC / OPC UA API wrappers.
 *
 * Purpose: Typed calls to the `/plc` endpoints — read connection status, open or
 *   close a session, read a node, and send a write command to the PLC.
 */

/** GET /plc/state — connection status + configured default endpoint/nodes. */
export async function getState(): Promise<PlcState> {
  const { data } = await apiClient.get<PlcState>('/plc/state');
  return data;
}

/** POST /plc/connect — open a session to an OPC UA endpoint (super-admin). */
export async function connect(
  endpoint: string,
  securityMode: SecurityMode,
  securityPolicy: SecurityPolicy,
): Promise<PlcConnection> {
  const { data } = await apiClient.post<{ connection: PlcConnection }>('/plc/connect', {
    endpoint,
    securityMode,
    securityPolicy,
  });
  return data.connection;
}

/** POST /plc/disconnect — close the session (super-admin). */
export async function disconnect(): Promise<PlcConnection> {
  const { data } = await apiClient.post<{ connection: PlcConnection }>('/plc/disconnect');
  return data.connection;
}

/** GET /plc/read?nodeId=… — read a single node value. */
export async function readNode(nodeId: string): Promise<ReadResult> {
  const { data } = await apiClient.get<ReadResult>('/plc/read', { params: { nodeId } });
  return data;
}

/** POST /plc/command — write a value to the PLC and get the read-back (super-admin). */
export async function sendCommand(
  nodeId: string,
  dataType: WriteDataType,
  value: boolean | number,
): Promise<ReadResult> {
  const { data } = await apiClient.post<ReadResult>('/plc/command', { nodeId, dataType, value });
  return data;
}

/** POST /plc/send-batch — load a QR recipe's task list into the PLC and arm the run. */
export async function sendBatch(lineId: string, qr: string): Promise<SendBatchResult> {
  const { data } = await apiClient.post<SendBatchResult>('/plc/send-batch', { lineId, qr });
  return data;
}

/** GET /plc/batch-status — read the crane run handshake (busy / done / step). */
export async function getBatchStatus(): Promise<BatchStatus> {
  const { data } = await apiClient.get<BatchStatus>('/plc/batch-status');
  return data;
}

/** POST /plc/batch-ack — clear `cmd_send` after a completed batch; returns fresh status. */
export async function ackBatch(): Promise<BatchStatus> {
  const { data } = await apiClient.post<BatchStatus>('/plc/batch-ack');
  return data;
}

/** GET /plc/crane-view — a live crane snapshot for the visualizer (polled). */
export async function getCraneView(): Promise<CraneView> {
  const { data } = await apiClient.get<CraneView>('/plc/crane-view');
  return data;
}

/** GET /plc/plant-view — every line + live per-crane state for the plant overview (polled). */
export async function getPlantView(): Promise<PlantView> {
  const { data } = await apiClient.get<PlantView>('/plc/plant-view');
  return data;
}

/** One OPC UA I/O log row (write or read), resolved to its PLC name. */
export interface PlcLogRow {
  seq: number;
  ts: number;
  dir: 'write' | 'read';
  plc: string;
  variable: string;
  value: unknown;
  ok: boolean;
  error: string | null;
}

/** GET /plc/logs — the PLC I/O log; `after` returns only entries newer than that seq. */
export async function getPlcLogs(after = 0): Promise<{ entries: PlcLogRow[]; lastSeq: number }> {
  const { data } = await apiClient.get<{ entries: PlcLogRow[]; lastSeq: number }>('/plc/logs', {
    params: { after },
  });
  return data;
}

/** DELETE /plc/logs — clear the in-memory PLC I/O log. */
export async function clearPlcLogs(): Promise<void> {
  await apiClient.delete('/plc/logs');
}
