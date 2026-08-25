import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, closeDb } from '../src/config/db.js';
import { ensureLineIndexes } from '../src/repositories/line.repository.js';
import { createLine, listLines, updateLine } from '../src/services/line.service.js';
import type { CreateLineInput } from '../src/schemas/line.schema.js';

/**
 * Seeder: make the plant's plating lines match the panel drawings (source of
 * truth), going through the validated line service. UPSERT — an existing line is
 * UPDATED to the panel-derived cranes/tanks (replacing any contradicting layout),
 * a new one is created. Safe to re-run.
 *
 * Run from the backend dir: `npx tsx scripts/seed-lines.ts`
 */
const here = dirname(fileURLToPath(import.meta.url));
const lines = JSON.parse(readFileSync(resolve(here, 'lines-seed.json'), 'utf-8')) as CreateLineInput[];

async function main(): Promise<void> {
  await connectDb();
  await ensureLineIndexes();
  const existing = new Map((await listLines()).map((l) => [l.name, l.id]));

  for (const line of lines) {
    const id = existing.get(line.name);
    try {
      if (id) {
        const updated = await updateLine(id, { cranes: line.cranes, tanks: line.tanks });
        console.log(`♻️  updated "${updated.name}" → ${updated.cranes.length} cranes, ${updated.tanks.length} tanks`);
      } else {
        const created = await createLine(line);
        console.log(`✅ created "${created.name}" — ${created.cranes.length} cranes, ${created.tanks.length} tanks`);
      }
    } catch (err) {
      console.warn(`⚠️  could not upsert "${line.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await closeDb();
}

main().catch((err: unknown) => {
  console.error('❌ seed-lines failed:', err);
  process.exit(1);
});
