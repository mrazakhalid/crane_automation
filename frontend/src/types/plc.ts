/**
 * Shared PLC/OPC UA types (mirror of the backend contract).
 *
 * Purpose: One place for the connection + read/command shapes used by the PLC
 *   page, the hook and the API wrappers, kept in sync with `backend/src/schemas`
 *   and `services/plc`.
 */

/** Lifecycle of the single managed OPC UA connection. */
export type PlcConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Data types the write/command endpoint accepts. */
export const WRITE_DATA_TYPES = ['Boolean', 'Int16', 'UInt16', 'Int32', 'Float', 'Double'] as const;
export type WriteDataType = (typeof WRITE_DATA_TYPES)[number];

/** How much the link is protected. `None` = plain; Sign = tamper-proof; SignAndEncrypt = tamper-proof + private. */
export const SECURITY_MODES = ['None', 'Sign', 'SignAndEncrypt'] as const;
export type SecurityMode = (typeof SECURITY_MODES)[number];

/** The cipher suite used when the link is secured (must match one the PLC offers). */
export const SECURITY_POLICIES = [
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128_Sha256_RsaOaep',
  'Aes256_Sha256_RsaPss',
] as const;
export type SecurityPolicy = (typeof SECURITY_POLICIES)[number];

/** Current connection snapshot. */
export interface PlcConnection {
  state: PlcConnectionState;
  endpoint: string | null;
  security: string | null;
  lastError: string | null;
}

/** GET /plc/state — connection plus the active saved connection's defaults + tags. */
export interface PlcState {
  connection: PlcConnection;
  defaults: {
    endpoint: string;
    readNode: string;
    writeNode: string;
    securityMode: SecurityMode;
    securityPolicy: SecurityPolicy;
  };
  /** The active saved connection (from PLC Manager), or null if none configured. */
  active: import('./plc-config.js').PlcConnectionConfig | null;
  /** The active connection's tag mappings (friendly labels → NodeIds). */
  tags: import('./plc-config.js').PlcTagConfig[];
}

/** A single node read result. */
export interface ReadResult {
  value: boolean | number | string | null;
  dataType: string;
  statusCode: string;
  serverTimestamp: string | null;
}

/** One row in the live watch table — a NodeId the user wants polled, with a friendly label. */
export interface WatchTag {
  id: string;
  label: string;
  nodeId: string;
}

/** POST /plc/send-batch result — the loaded task count; `busy` is always true right after arming. */
export interface SendBatchResult {
  count: number;
  busy: boolean;
}

/** The crane run handshake the UI polls: is a batch running, has it finished, which step. */
export interface BatchStatus {
  busy: boolean;
  done: boolean;
  step: number;
}

/** Vertical hoist position for the visualizer. */
export type HoistPosition = 'up' | 'down' | 'moving' | 'mid';

/** GET /plc/crane-view — a live snapshot to animate the gantry crane. */
export interface CraneView {
  state: number;
  step: number;
  busy: boolean;
  done: boolean;
  taskCount: number;
  /** Station the crane is over, or null while travelling between stations. */
  station: number | null;
  /** Each station's limit switch (`ls_at[i]`); index = station number. */
  lsAt: boolean[];
  hoist: HoistPosition;
  moving: { fwd: boolean; rev: boolean; up: boolean; down: boolean };
}

/** Live snapshot for one crane on the plant overview (mirror of the backend). */
export interface CranePlantView {
  crane: string;
  connectionId: string;
  plcName: string;
  connected: boolean;
  view: CraneView | null;
  currentStation: number | null;
  currentTank: string | null;
  nextStation: number | null;
  nextTank: string | null;
  error: string | null;
}

/** One line's layout + the live views of the cranes on its PLC(s). */
export interface LinePlantView {
  lineId: string;
  lineName: string;
  cranes: string[];
  tanks: import('./line.js').Tank[];
  cranesView: CranePlantView[];
}

/** GET /plc/plant-view — every line with its tanks and live per-crane state. */
export interface PlantView {
  lines: LinePlantView[];
}
