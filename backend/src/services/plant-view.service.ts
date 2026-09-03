import { toPublicLine, type PublicLine, type Tank } from '../models/line.model.js';
import * as connRepo from '../repositories/plc-connection.repository.js';
import * as lineRepo from '../repositories/line.repository.js';
import { getCraneView, readTaskStation, type CraneView } from './plc/batch.service.js';
import * as plc from './plc/plc.service.js';

/**
 * Plant-view aggregation service (HTTP-ignorant).
 *
 * Purpose: One call that returns EVERY line with its ordered tanks plus a live
 *   per-crane snapshot (position, hoist, state, step) for the animated plant
 *   overview. Cranes whose PLC is not connected come back with `connected:false`
 *   and a null view (the UI shows a "no signal" state) — we never block on an
 *   unreachable PLC. For connected cranes we also resolve the current/next tank
 *   from the loaded task list so the UI can show "doing X → next Y" per recipe.
 */

/** Live snapshot for one crane on the plant overview. */
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

/** One line with its layout + the live views of the cranes bound to its PLCs. */
export interface LinePlantView {
  lineId: string;
  lineName: string;
  cranes: string[];
  tanks: Tank[];
  cranesView: CranePlantView[];
}

export interface PlantView {
  lines: LinePlantView[];
}

/** Resolve a station number (`tank.number + 1`) back to its tank name. */
function tankNameAt(line: PublicLine, station: number | null): string | null {
  if (station == null || station <= 0) return null;
  return line.tanks.find((t) => t.number + 1 === station)?.name ?? null;
}

/** Build the live view for one crane, reading the PLC only when it is connected. */
async function readCrane(
  line: PublicLine,
  connectionId: string,
  plcName: string,
  crane: string,
  connected: boolean,
): Promise<CranePlantView> {
  const idle: CranePlantView = {
    crane,
    connectionId,
    plcName,
    connected: false,
    view: null,
    currentStation: null,
    currentTank: null,
    nextStation: null,
    nextTank: null,
    error: null,
  };
  if (!connected) return { ...idle, error: 'PLC offline' };

  try {
    const view = await getCraneView(connectionId, crane);
    const inRange = (n: number): boolean => n >= 1 && n <= view.taskCount;
    const currentStation = inRange(view.step) ? await readTaskStation(connectionId, crane, view.step) : null;
    const nextStation = inRange(view.step + 1) ? await readTaskStation(connectionId, crane, view.step + 1) : null;
    return {
      ...idle,
      connected: true,
      view,
      currentStation,
      currentTank: tankNameAt(line, currentStation),
      nextStation,
      nextTank: tankNameAt(line, nextStation),
    };
  } catch (err) {
    return { ...idle, error: err instanceof Error ? err.message : 'read failed' };
  }
}

/**
 * Aggregate the live plant view across all lines.
 *
 * Returns: `{ lines }` — every line with its tanks and the live views of the
 *   cranes on its bound PLCs (cranes fan out in parallel; disconnected → null view).
 */
export async function getPlantView(): Promise<PlantView> {
  const [lineRecords, conns] = await Promise.all([lineRepo.listAll(), connRepo.listAll()]);
  const connectedIds = new Set(
    plc.getPoolStatuses().filter((s) => s.state === 'connected').map((s) => s.connectionId),
  );

  const lines = await Promise.all(
    lineRecords.map(async (record) => {
      const line = toPublicLine(record);
      const owners = conns.filter((c) => c.lineId === line.id && c.cranes.length > 0);
      const jobs = owners.flatMap((conn) =>
        conn.cranes.map((crane) => readCrane(line, conn._id, conn.name, crane, connectedIds.has(conn._id))),
      );
      const cranesView = await Promise.all(jobs);
      return { lineId: line.id, lineName: line.name, cranes: line.cranes, tanks: line.tanks, cranesView };
    }),
  );

  return { lines };
}
