#!/usr/bin/env node
/**
 * Regenerate OpenPLC's opcua.json mapping from the compiled program, and make sure the
 * opcua plugin is enabled. Run this after downloading a new/changed program from the Editor.
 *
 * Why: a program download (a) rewrites plugins.conf and turns the opcua plugin OFF, and
 *   (b) renumbers every variable, so the OPC UA `index` values must be recomputed. This
 *   reads the authoritative `debug.c` and rewrites the mapping so you never hand-map indices.
 *
 * Usage:  node scripts/plc/sync-opcua-mapping.mjs
 *   Set OPENPLC_HOME to override the runtime path (default = the known local install).
 *   The runtime should be STOPPED when you run this (edits to plugins.conf revert on shutdown).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOME =
  process.env.OPENPLC_HOME || 'C:/Users/CEO/AppData/Local/OpenPLC Runtime/openplc-runtime';
const debugC = join(HOME, 'core/generated/debug.c');
const opcuaJson = join(HOME, 'core/src/drivers/plugins/python/opcua/opcua.json');
const pluginsConf = join(HOME, 'plugins.conf');

// 1) Parse debug_vars[] in order. Keep only located program variables — their enum ends
//    in `_O_ENUM` (e.g. BOOL_O_ENUM, INT_O_ENUM); function-block internals are plain `_ENUM`.
const src = readFileSync(debugC, 'utf8');
const re = /\{&\(RES0__INSTANCE0\.([A-Za-z0-9_.]+)\),\s*([A-Z0-9_]+)\}/g;
const vars = [];
let index = 0;
let m;
while ((m = re.exec(src)) !== null) {
  const [, name, en] = m;
  if (en.endsWith('_O_ENUM')) vars.push({ index, name: name.toLowerCase(), datatype: en.replace(/_O_ENUM$/, '') });
  index += 1;
}
if (vars.length === 0) {
  console.error(`No located (_O_ENUM) variables found in ${debugC}. Download a program first.`);
  process.exit(1);
}

// 2) Rewrite the opcua.json variables array (preserve server/security/users sections).
const cfg = JSON.parse(readFileSync(opcuaJson, 'utf8'));
cfg[0].config.address_space.variables = vars.map((v) => ({
  node_id: `PLC.${v.name}`,
  browse_name: v.name,
  display_name: v.name,
  datatype: v.datatype,
  initial_value: v.datatype === 'BOOL' ? false : 0,
  description: `Auto-mapped from PLC variable ${v.name} (debug.c index ${v.index}).`,
  index: v.index,
  permissions: { viewer: 'rw', operator: 'rw', engineer: 'rw' },
}));
writeFileSync(opcuaJson, `${JSON.stringify(cfg, null, 2)}\n`);

// 3) Ensure the opcua plugin enable flag (3rd CSV field) is 1.
const conf = readFileSync(pluginsConf, 'utf8').replace(/^(opcua,[^,]+,)\d(,.*)$/m, '$11$2');
writeFileSync(pluginsConf, conf);

// 4) Print the resulting NodeId map (NodeIds are ns=2;i=<n> in this order).
console.log('opcua plugin: ENABLED');
console.log('Mapped variables (NodeId = ns=2;i=<n>):');
vars.forEach((v, n) =>
  console.log(`  ns=2;i=${n + 1}  ${v.name.padEnd(14)} ${v.datatype.padEnd(6)} (debug.c index ${v.index})`),
);
console.log('\nRestart the runtime (StartOpenPLC.bat) for changes to take effect.');
