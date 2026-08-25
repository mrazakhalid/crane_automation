import { connectDb, closeDb } from '../src/config/db.js';
import { ensureLineIndexes } from '../src/repositories/line.repository.js';
import { ensurePlcConnectionIndexes } from '../src/repositories/plc-connection.repository.js';
import { listLines } from '../src/services/line.service.js';
import {
  createConnection,
  listConnections,
  updateConnection,
} from '../src/services/plc-config.service.js';

/**
 * Seeder: create the six plant PLC connections from the panel drawings and bind
 * each to its line + cranes. UPSERT by name — safe to re-run. Goes through the
 * validated plc-config service (enforces the crane-binding rules).
 *
 * Endpoints: PLC_N → 192.168.0.11N:4840 (the .11x NIC listed by the CPU; panels
 * 1/2/5 don't print an IP, so those follow the .11x pattern and should be
 * confirmed). Security seeded as None/None (app default) — a REAL S7-1500 only
 * advertises secured endpoints, so switch mode/policy per PLC before connecting.
 *
 * Run from the backend dir: `npx tsx scripts/seed-plcs.ts`
 */
interface PlcSpec {
  name: string;
  line: string;
  cranes: string[];
  endpoint: string;
}

const PLCS: PlcSpec[] = [
  { name: 'PLC_1', line: 'line1', cranes: ['1A', '1B'], endpoint: 'opc.tcp://192.168.0.111:4840' },
  { name: 'PLC_2', line: 'line2', cranes: ['2', '3'], endpoint: 'opc.tcp://192.168.0.112:4840' },
  { name: 'PLC_3', line: 'line3', cranes: ['4', '5'], endpoint: 'opc.tcp://192.168.0.113:4840' },
  { name: 'PLC_4', line: 'line4', cranes: ['6', '7A'], endpoint: 'opc.tcp://192.168.0.114:4840' },
  { name: 'PLC_6', line: 'line4', cranes: ['7B'], endpoint: 'opc.tcp://192.168.0.116:4840' },
  { name: 'PLC_5', line: 'line5', cranes: ['8', '9'], endpoint: 'opc.tcp://192.168.0.115:4840' },
];

async function main(): Promise<void> {
  await connectDb();
  await ensureLineIndexes();
  await ensurePlcConnectionIndexes();

  const lineIdByName = new Map((await listLines()).map((l) => [l.name, l.id]));
  const connIdByName = new Map((await listConnections()).map((c) => [c.name, c.id]));

  for (const plc of PLCS) {
    const lineId = lineIdByName.get(plc.line);
    if (!lineId) {
      console.warn(`⚠️  skip "${plc.name}" — line "${plc.line}" not found (seed lines first)`);
      continue;
    }
    const body = {
      name: plc.name,
      endpoint: plc.endpoint,
      securityMode: 'None' as const,
      securityPolicy: 'None' as const,
      lineId,
      cranes: plc.cranes,
    };
    try {
      const existingId = connIdByName.get(plc.name);
      if (existingId) {
        const c = await updateConnection(existingId, body);
        console.log(`♻️  updated "${c.name}" → ${plc.line} [${c.cranes.join(', ')}] ${c.endpoint}`);
      } else {
        const c = await createConnection(body);
        console.log(`✅ created "${c.name}" → ${plc.line} [${c.cranes.join(', ')}] ${c.endpoint}`);
      }
    } catch (err) {
      console.warn(`⚠️  could not upsert "${plc.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await closeDb();
}

main().catch((err: unknown) => {
  console.error('❌ seed-plcs failed:', err);
  process.exit(1);
});
