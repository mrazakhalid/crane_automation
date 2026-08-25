# Crane Automation — Engineering Charter

Read this before starting a feature; verify against it after.

## Stack

- **Frontend:** React 19 + Vite 7 + TypeScript, Axios for HTTP.
- **Backend:** Express 5 + TypeScript (ESM), Zod for schema validation.
- **Tooling:** ESLint = linter, `tsc` = type-checker, Vitest = tests.

## Core principles

- **Separation of concerns:** routers (HTTP) → services (logic) → repositories/models (data).
  Keep each layer ignorant of the layers above it.
- **DRY + KISS:** files ≤ ~100 LOC — split oversized ones into cohesive modules.
- **Validate & sanitize all input at the boundary.** Backend = source of truth: schema
  validation with bounds (min/max length, ≤/≥ ranges, regex, reject unknown fields via
  `z.strictObject`). Frontend mirrors it with a schema validator for UX only — never trust it.
- **Security-first, no cut corners:** authz + resource-ownership check on every endpoint
  (no IDOR), parameterized queries only, rate limiting, security headers (Helmet), least
  privilege, and secrets kept in a single gitignored `.env` file — never in code.

## Per-change Definition of Done

- [ ] Linter + type-checker + tests pass on both backend and frontend (add e2e for UI flows).
- [ ] New/changed logic has unit + integration tests; user flows have e2e; backfill tests for code you touched.
- [ ] Inputs validated on FE (schema, UX) and BE (schema with bounds + reject-unknown); authz + ownership enforced (no IDOR).
- [ ] Non-blocking (async) on both sides; typed error handling with specific, actionable messages.
- [ ] FE UX polish: toasts, optimistic updates with rollback, skeletons, spinners.
- [ ] Every endpoint/function has an AI-tool-ready docstring (Purpose / Args / Returns / Raises).
- [ ] New IDs use UUID v7 (`uuid` → `v7`); no secrets in code (`.env`/config only).
- [ ] Responsive: lg / md / sm verified; md/sm should feel native-mobile.
- [ ] Check latest library docs (via Context7) before using a library; prefer latest stable syntax.
- [ ] Update the matching concept/learning doc + its runbook in the same pass whenever you build, change, or wire something up.

## Documentation discipline

- Keep `docs/concepts/` plain-English "why & how" learning notes, updated alongside code — not just after.
- Keep `docs/progress.md` as a resume-here log: phases done/remaining, held commits, pending deploys.
- Keep `docs/software-flow.md` current: append a dated **build-log** entry on every build/change.
- Keep `docs/architecture.md` (with ADRs) + `docs/product-spec.md` (what & why).
- Keep `docs/dev-checklist.md` as the charter — read before a feature, verify after.
- Record gotchas ("do not relearn these") below so hard-won lessons aren't repeated.

### Documentation map — where to look

- `docs/software-flow.md` — how a request flows FE→API→service→data/PLC, **+ the build log** (what we've done, newest first).
- `docs/progress.md` — phase-by-phase resume-here log (done / remaining / held).
- `docs/architecture.md` — architecture + ADRs. `docs/product-spec.md` — what & why. `docs/dev-checklist.md` — the DoD charter.
- `docs/concepts/opcua-quickstart.md` — **1-page plain-language cheat** (the 4 words, security table, locker analogy, "redo it every time?"). Start here.
- `docs/concepts/opcua-explained.md` — the **full** plain-English OPC UA guide (deep reference + glossary).
- `scripts/plc/start-openplc.ps1` — **everyday OpenPLC start** (re-enables opcua plugin, keeps mapping); use instead of `StartOpenPLC.bat`. `scripts/plc/restart-openplc.ps1` — after a **program change** (also re-maps `opcua.json` from `debug.c`). `sync-opcua-mapping.mjs` does the mapping file-work.
- `docs/concepts/plc-opcua.md` — how the OPC UA client is wired in code (+ secured-endpoint runbook). `+ ADR-006`.
- `docs/concepts/plc-manager.md` — **super-admin PLC Manager**: OPC UA connections + tag mappings live in the DB (not `.env`/code); active-connection auto-connect; endpoints; `+ ADR-007`.
- `docs/concepts/process.md` — **cross-line recipes → task split → live Process page**: a recipe spans many lines; the planner resolves each tank to its line/crane/PLC (flags ambiguous/missing/unrouted), groups by **PLC→crane**, and a **time-derived simulation** runs it (no PLC contacted). `+ recipes store`, `services/process/`.
- `docs/openplc_opcua/enable-opcua-plugin.md` — OpenPLC Runtime v4 runbook: enable the OPC-UA plugin, real NodeIds, the `index` gotcha, load a program.
- `docs/openplc_opcua/plc-opcua-openplc-setup.md` — end-to-end bring-up runbook (Editor-GUI variant).
- `docs/tia_opcua/tia-plcsim-opcua-setup.md` — **Siemens** bring-up runbook: TIA Portal V18 + PLCSIM Advanced V5.0 simulated S7-1500 OPC UA server (enable server, Virtual Eth. Adapter IP, NodeIds `ns=3;s="DB"."tag"`, POC `None` → secured Basic256Sha256). App = `.env`-only swap.
- `docs/tia_opcua/opcua-server-wont-start-econnrefused.md` — **troubleshooting runbook**: real PLC pings OK but app gets `ECONNREFUSED` on `:4840` (OPC UA server didn't start — wrong CPU clock → stale cert; fix = set clock + reset-to-factory + full hardware download + power-cycle). Quick PowerShell diagnostics + expected output in `docs/commands/plc-opcua-check.md`.
- `docs/line4/instructions.md` — **Line 4 crane batch runbook**: build the TIA program (UDT →
  DB → `TravelTo` FC → `CraneSequencer` FB → OB1) + the app's "Send to PLC" batch/handshake +
  the **verified array NodeId format** (`"tasks"[i]."station"`, 0-based). `docs/line4/monitoring-watch-table.md`
  — watch-table guide to monitor + drive the sim (Modify switches, full run-to-DONE sequence).
- `docs/projects/` — hands-on follow-along builds. `project-01-cycle-ledger-opcua.md` = write a ladder "ledger" counter, read it + push commands over OPC UA (no app code change).
- `docs/concepts/` others — `auth-rbac.md`, `lines.md`, `qr-scanner.md`, `offline-desktop.md`, `desktop-data-storage.md`, `styling-tailwind.md`.

## Workflow rules

- Routers → services → models: HTTP concerns never leak into business logic; data access never leaks into routers.
- Backend is always the source of truth for validation; the frontend only mirrors it for UX.
- Commit/push only when asked; branch off main first if needed.

## Gotchas — do not relearn these

- **`better-sqlite3` native ABI: Electron vs Node are mutually exclusive.** The compiled
  `better_sqlite3.node` targets ONE ABI. The desktop app (Electron 33 = `NODE_MODULE_VERSION 130`)
  and the backend tests (system Node 22 = `127`) need different ones, so you switch per use:
  - **Desktop:** `cd desktop && npm run rebuild` (= `electron-rebuild -f -m ../backend -o
    better-sqlite3`). The **`-f` is required** — without it electron-rebuild sees a cached build and
    silently skips, leaving the wrong ABI. Verify: `node -e "require('better-sqlite3')"` should
    THROW under Node (proving it's built for Electron).
  - **Node tests:** `cd backend && npm rebuild better-sqlite3`. The `storage-sqlite.test.ts` suite
    **auto-skips** (ABI probe) when the binary is built for the other runtime, so `npm test` stays
    green either way — a skipped sqlite suite just means "binary is currently on the Electron ABI."
- **Desktop (Electron) + node-opcua: pin `hexy` to CommonJS.** Electron bundles **Node 20**, whose
  `require()` cannot load an ESM module. `node-opcua-debug` does `require('hexy')`, and `hexy@0.4.0`
  is **ESM-only** → the desktop backend crashes at load with `ERR_REQUIRE_ESM` (works under `npm run
  dev` only because system **Node 22** allows `require()` of ESM). Fix = backend `package.json`
  `"overrides": { "hexy": "0.3.5" }` (last CJS release; still exports `.hexy`, API-compatible), then
  `npm install`. Verify: `node -e "require('node-opcua-debug')"` loads clean.
- **Backend is ESM + NodeNext:** relative imports in `.ts` source must use the `.js`
  extension (e.g. `import { env } from './config/env.js'`). This is correct for Node ESM.
- **Express 5 `req.query` / `req.params` are getter-only** — do not reassign them. Mutate
  in place (e.g. `Object.assign(req.query, parsed)`) inside validation middleware.
- **Zod v4** import style is `import * as z from 'zod'`; use `z.treeifyError(err)` for
  readable validation output and `z.strictObject({...})` to reject unknown fields.
- **Never validate `process.env` with `z.strictObject`** — it carries hundreds of OS/npm
  keys and will fail with "Unrecognized keys". Use `z.object` (strips extras). The
  reject-unknown rule is for client request bodies, not the environment.
- **Vite env vars** are exposed to the client only when prefixed `VITE_`; anything secret
  stays on the backend `.env`.
- **PLC comms = one generic OPC UA client.** The app is an OPC UA *client* (`services/plc/`,
  `node-opcua`); the live **endpoint + NodeIds** are chosen at runtime on the PLC page (defaults
  in `.env`). Nothing about a specific PLC is hard-coded — OpenPLC v4 and the Siemens S7-1500
  both expose native OPC-UA servers, so switching between them is a **config change only, no
  code**. Two OpenPLC lineages: **OpenPLC Editor v4 / Autonomy Edge** serves OPC-UA; the legacy
  msys64 `openplc.com` Runtime is **Modbus-only** (no OPC-UA). Only **one** OPC UA server can
  bind `:4840` at a time (else `EADDRINUSE`). `node-opcua` imports fine as ESM named imports
  under NodeNext. Security is config: `OPCUA_SECURITY_MODE`/`OPCUA_SECURITY_POLICY` (+ optional
per-connect override) drive `services/plc/opcua-security.ts`; the persistent `pki/` store
(gitignored) holds our own client cert + trusted server certs.
- **A real PLC exposes NO `None` OPC UA endpoint.** It advertises only secured ones (e.g.
  `Basic256Sha256` Sign/SignAndEncrypt). Requesting `None` fails with `End point must exist …
  securityMode = None` **even though TCP `:4840` is reachable** — it's a *security* mismatch, not
  connectivity. Match the server's advertised mode/policy. Then two one-time **PLC-side** steps
  are required: (1) move our client cert (`pki/own/certs/client_certificate.pem`) from the PLC's
  *rejected* to *trusted* store; (2) **fix the PLC clock** — OPC UA validates cert validity
  against the *server* clock, so a wrong PLC clock makes our cert look "not yet valid" and drops
  the secure channel even after trusting.
- **`ECONNREFUSED` on `:4840` while `ping` succeeds = the OPC UA server didn't START, not a
  network fault.** `ping` is ICMP (host up); the client needs a **TCP listener on 4840**, which
  exists only once the server has started. `ECONNREFUSED` means the packet **reached** the PLC
  and it answered "nothing listening on 4840" (a firewall/cable fault **times out** instead).
  On a real S7-1500 a **wrong CPU clock** (we saw 2012) leaves a **stale/invalid OPC UA
  certificate** cached, so the server **refuses to start** and `:4840` stays closed — even
  though config (activation, `S7-1500 small` license, "No security" endpoint) is identical to a
  working PLC. Diagnose from the PLC network with `Test-NetConnection <ip> -Port 4840`: read
  **`TcpTestSucceeded`** (not `PingSucceeded`) — `PingSucceeded:True` + `TcpTestSucceeded:False`
  = host up, server down. In TIA, **Diagnostics → OPC UA → Server → Server status: Unknown**
  confirms it's not running. **Fix (STOP→RUN and software-only downloads do NOT work — TIA
  reports "up-to-date" and never regenerates the cert):** *Set time of day (Take from PG/PC)* →
  **Reset to factory settings** (keep IP) → full **Download → "Delete and replace system data in
  target"** (hardware, not software-only; the compile log shows *"Certificate … renewed"*) →
  **power-cycle**. Port opens, no app/network change. Ports are **per-device** — two PLCs each
  own their `:4840`; one working says nothing about the other (`EADDRINUSE` is only two servers
  on the *same PC*). Runbook: `docs/tia_opcua/opcua-server-wont-start-econnrefused.md`; the
  PowerShell checks + expected output live in `docs/commands/plc-opcua-check.md`.
- **Rate limiting vs the live-poll UI.** The PLC page polls `GET /api/plc/read` every 1 s, so a
  small global cap (the old 100/15 min) gets exhausted in ~100 s and 429s *every* route including
  `/login`. `middleware/rate-limit.ts` fixes this: a generous global limiter (600/15 min) that
  **skips** the authenticated poll paths (`/api/plc/read`, `/api/plc/state`), plus a **strict
  login limiter** (20 *failed*/15 min, `skipSuccessfulRequests`). Limiters are **factories**
  (fresh store per `createApp()`) so tests stay isolated. `express-rate-limit` v8; a `message`
  object is sent as JSON (the FE reads `response.data.error`).
- **OpenPLC v4 is plugin-based & headless here.** The local install (`…/OpenPLC Runtime/
  openplc-runtime`) is **Runtime v4** (native OPC-UA), *not* the legacy Modbus-only runtime.
  Enable OPC-UA by flipping the `opcua` line's 3rd field `0→1` in `plugins.conf` + restart.
  `opcua.json` maps each OPC UA node to PLC memory by an `index` = **`debug.c`/`get_var_addr`
  order (0-based, program vars only)**, NOT the `VARIABLES.csv` line number (off by one — csv
  prepends the FB instance). Anonymous sessions get the read-only `viewer` role → give `viewer`
  `"rw"` for POC writes. Full runbook: `docs/openplc_opcua/enable-opcua-plugin.md`.
- **OpenPLC Editor v4 ST: variables go in the variable TABLE, not the code body.** Pasting a
  `VAR … END_VAR` block into the ST code editor makes compile fail with `xml2st process exited
  with code 1` / `'NoneType' object has no attribute 'upper'`. Declare each var (Name/Class/Type/
  Location/Initial) in the grid; the code editor holds only statements. See
  `docs/projects/project-01-cycle-ledger-opcua.md`.
- **OpenPLC resets `plugins.conf` (opcua → `0`) on EVERY shutdown** (not just on program
  download) → OPC UA server gone on next start → app **times out**. `opcua.json` (the NodeId
  mapping) is NOT wiped, only the plugin on/off flag. Fixes (never hand-edit):
  - Everyday start: `scripts/plc/start-openplc.ps1` (re-enables plugin, keeps mapping) instead of
    `StartOpenPLC.bat`.
  - After changing the PLC program (variables renumber): `scripts/plc/restart-openplc.ps1`
    (re-maps `opcua.json` from `debug.c` + re-enables + restarts + prints NodeIds).
- **Siemens sim = TIA V18 + PLCSIM Advanced V5.0 (version-locked; V6↔V19).** Real target is an
  **S7-1200 (CPU 1212C)** but **PLCSIM Advanced only simulates S7-1500** (regular PLCSIM does 1200
  but exposes no OPC UA endpoint) → sim uses an **S7-1500** stand-in; moving to the real 1200 is a
  `.env`-only change (1200 needs firmware ≥ V4.4 + a SIMATIC OPC UA S7-1200 license). Runbook:
  `docs/tia_opcua/tia-plcsim-opcua-setup.md`. Sim net: PLC `192.168.50.1`, Windows PLCSIM adapter
  `192.168.50.100`, endpoint `opc.tcp://192.168.50.1:4840`. NodeIds are `ns=3;s="PlcData"."tag"`.
- **PLCSIM Advanced gotchas (hard-won).** (1) **Run it as Administrator** — always. (2) The
  `PLCSIM Fatal Error: Virtual Switch service is not running … plcsimlwf` means the `plcsimlwf`
  NDIS filter (ComponentID `plcsim_ndislwf`, FriendlyName "S7-PLCSIM Advanced Virtual Switch") is
  **not bound to any adapter** (driver STOPPED / exit code 31). Fix from an **Admin PowerShell**:
  `netcfg -l "C:\Program Files\Common Files\Siemens\PLCSIMADV\Drivers\plcsimlwf.inf" -c s -i
  plcsim_ndislwf` → binds the filter, driver goes RUNNING. (3) The V5.0 **Online Access** toggle
  is labelled **`PLCSIM` ↔ `TCP/IP`**; **TCP/IP** *is* the Virtual-Eth-Adapter mode our app needs
  (the `PLCSIM` softbus side is unreachable from external OPC UA clients). (4) Give the Windows
  "Siemens PLCSIM Virtual Ethernet Adapter" (`Get-NetAdapter … PLCSIM Virtual Ethernet`) a static
  IP in the PLC subnet (`New-NetIPAddress`, needs Admin).
- **TIA→PLCSIM download needs "Support simulation during block compilation".** A fresh project has
  it OFF, so downloading to PLCSIM Advanced aborts with *"'Main [OB1]' cannot be simulated"* /
  *"Error downloading to module CPUcommon"*. Fix: project node → Properties → **Protection** → tick
  **"Support simulation during block compilation (e.g. S7-PLCSIM)"**, **rebuild all blocks**,
  re-download, and set the **Start modules** action to **"Start module"** so the CPU goes RUN.
  On the PLCSIM panel: **Single Adapter**; "TCP/IP communication with" = the Siemens virtual
  adapter (shows as Windows name e.g. `Ethernet 3`), which may display `<Local>` after start
  (fine for a same-PC client). `:4840` only opens once the CPU is RUN.
- **TIA V18: OB1 cannot be switched to SCL** — its language dropdown only offers LAD/FBD. Put SCL
  in a **Function (FC)** (Add new block → Function → Language SCL) and **call the FC from OB1**
  (drag it onto the rung). Global state (the `PlcData` DB, `Clock_1Hz`) is reachable from the FC.
- **Firmware V3.0 CPUs trigger a "PLC security settings" wizard** on add (confidential-data
  protection / PG-PC comm mode / access protection). For a POC pick the least-restrictive on each
  page (no confidential-data password, **permit non-secure** comm, no access protection). Or use
  firmware **V2.9** to skip the wizard.
- **Siemens OPC UA array NodeIds: bracket OUTSIDE the quotes + 0-based re-index.** For a DB
  struct-array like `Line4Data.tasks : Array[1..20] of typeTask`, the element-member NodeId is
  `ns=3;s="Line4Data"."tasks"[0]."station"` — the array bracket is **outside** the quoted segment
  (`"tasks"[0]."station"`, NOT `"tasks[0]"."station"`, which returns **`BadNodeIdUnknown`**). And
  the S7-1500 **re-bases arrays to 0** over OPC UA: a declared `Array[1..20]` exposes indices
  **`[0..19]`**, so **OPC UA `[0]` = S7 `tasks[1]`** — write index `taskNo − 1` or every element
  lands one slot late (`[20]` → `BadNodeIdInvalid`). Scalars keep the plain `"DB"."tag"` shape
  (same as `PlcData`). When unsure, **browse the live server** (`session.browse('ns=3;s="DB"."arr"')`
  lists `"arr"[0]`, `"arr"[1]`, …) — don't trust the declared bounds. See `docs/line4/instructions.md`
  Part 6; the app builds these in `backend/src/services/plc/batch.service.ts` `taskFieldNode()`.
- **A new global DB is invisible over OPC UA until it's actually downloaded — and PLCSIM won't
  stop to load unless you tell it.** `BadNodeIdUnknown` on *every* tag of a DB (even scalars),
  while an older DB still reads fine, means that DB isn't in the running program. In the TIA
  **Load preview**, the **"Stop modules"** row defaults to **"No action"**, which makes
  "preconditions are not met" and greys out **Load** — change it to **"Stop all"**, then Load +
  Start module. Orange sync markers in the project tree = blocks differ from the PLC (not loaded).
- **Function-block internals occupy the LOW `debug.c` indices; located vars come last.** A program
  using TON/R_TRIG/CTU puts every FB field (EN, ENO, Q, CV, …) at indices 0..N first, so the real
  tags land at HIGH indices (e.g. the Cycle Ledger's `run`/`cycle_count` are 27/30, not 0/3).
  Always read `core/generated/debug.c` `debug_vars[]` for the true index — never assume 0-based
  by declaration order.
