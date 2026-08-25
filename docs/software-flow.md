# Software flow + build log

Two things live here:
1. **Software flow** — how a request travels through the app, so anyone can trace a feature.
2. **Build log** — a short dated entry appended **every time we build/change something**, so
   we always know what has been done and what's next. (The deeper phase history is in
   [`progress.md`](./progress.md); this is the running "what changed" ledger.)

---

## Software flow

### Layers (the charter rule: HTTP → logic → data, each ignorant of the one above)

```
Browser (React 19 + Vite)
  page/component → hook → api wrapper (axios)         frontend/src/{pages,components,hooks,api}
        │  HTTP (JWT bearer)
        ▼
Express 5 router → middleware (auth, validate, rate-limit) → controller   backend/src/{routes,middleware,controllers}
        │
        ▼
service (business logic)                                    backend/src/services
        │
        ▼
repository / external client (data or protocol)            backend/src/repositories, services/plc
        │
        ▼
MongoDB / SQLite            or            OPC UA server (PLC)
```

### Example: the PLC live read (PLC → software)

```
PlcMonitor (shows value)
  → usePlc hook: setInterval 1s
    → api/plc.ts readNode(nodeId)         GET /api/plc/read?nodeId=ns=2;i=1
      → rate-limit (skips this poll path) → requireAuth → validate(readQuerySchema)
        → plc.controller.getRead
          → plc.service.readNode
            → opcua-client.readValue → node-opcua session.read
              → OpenPLC OPC UA server → PLC memory (test_read)
  ← { value, dataType, statusCode, serverTimestamp } bubbles back up and renders
```

### Example: a command (software → PLC)

```
PlcCommandForm (NodeId + data type + value)
  → usePlc.write → api/plc.ts sendCommand    POST /api/plc/command
    → rate-limit → requireAuth → requireRole(super_admin) → validate(commandSchema)
      → plc.controller.postCommand → plc.service.sendCommand
        → opcua-client.writeValue (session.write) THEN readValue (read-back confirm)
  ← read-back result → toast "Sent … (read-back …)"
```

### Example: connecting (with security)

```
PlcConnectionPanel (endpoint + Security mode + Policy)
  → usePlc.connect → api/plc.ts connect(endpoint, mode, policy)   POST /api/plc/connect
    → validate(connectSchema: endpoint + optional securityMode/securityPolicy)
      → plc.service.connectPlc → opcua-client.connect
        → opcua-security.securityOptions(mode, policy)  (None → no cert; secured → PKI cert)
        → node-opcua OPCUAClient.connect + createSession
  ← { connection: { state, endpoint, security, lastError } }
```

**Security is generic:** the mode/policy come from the request (UI dropdown) or fall back to
`OPCUA_SECURITY_*` in `backend/.env`. None for OpenPLC, SignAndEncrypt/Basic256Sha256 for
Siemens — no code change. See [`concepts/opcua-explained.md`](./concepts/opcua-explained.md).

---

## Build log (newest first)

### 2026-08-25 — Manager Dashboard drops the line picker → auto-divides across all lines
- Per request, the manager's **Dashboard** QR tool no longer asks you to pick a line. Extracted the
  recipe → divide → run flow into `components/ProcessWorkspace.tsx` (owns `useRecipes` +
  `useProcess`) and reused it in **both** `ProcessPage` and the manager `DashboardPage` — uploading a
  QR now auto-detects every line and splits tasks by line → crane → PLC automatically.
- The legacy line-scoped `TaskGenerator` + `useTaskGenerator` (single-line real "Send to PLC") are
  no longer rendered anywhere; kept in the tree (no git history to recover from) for the future
  real-PLC wiring. `DashboardPage.test` updated to assert the new auto-dividing tool + absence of a
  line picker. Frontend lint/typecheck + 29 tests green.

### 2026-08-25 — Cross-line recipes → task split → live Process page (software only, no PLC)
- **New capability:** a recipe can span **multiple lines**. Upload/paste/pick a recipe → **divide
  tasks** → the app auto-detects each tank's **line → crane → PLC** and shows a **process summary**
  grouped by **PLC → crane**, then runs a **live simulation** (`idle → in-progress → done`).
- **Recipe persistence** (mirrors the Line entity): `recipe.model` + `storage/{mongo,sqlite}/
  recipe.store` (unique `name`, `overrides` as JSON) + `recipe.repository` + `recipe.service`
  (409 dup) + controller/routes. `GET/POST /api/recipes`, `GET/PATCH/DELETE /api/recipes/:id`
  (manager + super-admin). New `recipes` SQLite table + `ensureRecipeIndexes` at boot.
- **Cross-line resolver + planner** (`services/process/`): `resolver.resolveAcrossLines` reuses the
  per-line `task-generator.resolveTank` across **all** lines → resolved / missing / **ambiguous**
  (tank name on >1 line; a per-step `{step: lineId}` **override** picks one). `planner.buildPlan`
  (pure) groups resolved tasks by **PLC → crane** (owner derived from `plc_connections.lineId` +
  `cranes`), flags **unrouted** (crane with no PLC), `station = tank.number + 1`. `planProcess`
  loads lines + connections then `buildPlan`.
- **Run engine** (`services/process/run-engine.ts`): in-memory, **time-derived** status (no
  background timers) — a poll computes each task's state from elapsed vs a per-crane cumulative
  schedule (sequential within a crane, parallel across cranes). `POST /api/process/plan` |
  `/start` | `GET /:runId/status` | `POST /:runId/stop`.
- **Frontend Process page** (`pages/ProcessPage.tsx` + `RecipeInput` / `ProcessWarnings` /
  `ProcessSummary`, hooks `useRecipes` + `useProcess`, api `recipes.ts` + `process.ts`): saved-recipe
  dropdown, QR decode/paste + save-by-name, **Divide tasks** summary with inline line-pickers for
  ambiguous tanks and badges for missing/unrouted, **Start/Stop** with live per-task states and a
  progress bar. New nav tab **Process** (`ListTree`), **UI gated to `manager` only** (recipes +
  process are the manager's side; admins manage lines/PLCs/connections). Backend routes allow
  manager + super-admin (super-admin superset).
- **Swap-later note:** replacing the simulation with real OPC UA is localized to `run-engine.ts`
  (use `batch.sendBatch` + `getBatchStatus`). No PLC is contacted in this build.
- **Green:** backend lint/typecheck + 105 tests (new: `process-planner`, `process-run`, `recipes`,
  `process`); frontend lint/typecheck + 29 tests (new: `ProcessPage`; hardened a flaky lazy-load
  wait in `DashboardPage.test`). See `docs/concepts/process.md`.

### 2026-08-18 — Field fix: real PLC `ECONNREFUSED` on `:4840` (server wouldn't start)
- **No code change** — a **field/PLC-side** troubleshoot on two real S7-1500s (same program,
  different IPs). `192.168.0.114` connected; `192.168.0.113` gave
  `connect ECONNREFUSED 192.168.0.113:4840` **despite a healthy ping** (`TTL=255`).
- **Diagnosis:** ping is ICMP (host up); the client needs a **TCP listener on `:4840`**, which
  only exists when the OPC UA server has **started**. `Test-NetConnection … -Port 4840` showed
  `PingSucceeded:True` but `TcpTestSucceeded:False` on .113 — server not listening. TIA
  **Diagnostics → OPC UA → Server** confirmed **Server status: Unknown** (not running).
- **Root cause:** .113's CPU **clock was stuck in 2012** → its OPC UA **application certificate
  was cached bad** → server refused to start. Config was **identical** to the working PLC
  (activation, `S7-1500 small` license, "No security" endpoint) — so it was runtime/cert state,
  not config.
- **Fix:** *Set time of day (Take from PG/PC)* → **Reset to factory settings** (keep IP) →
  full **Download → "Delete and replace system data in target"** (hardware, not software-only) →
  **power-cycle**. Compile log showed *"Certificate … renewed"* → **Server status: Running** →
  `TcpTestSucceeded:True` → app connected on `opc.tcp://192.168.0.113:4840` (Security None).
- **Why quick fixes failed:** STOP→RUN doesn't regenerate the cert; software-only download
  reports "up-to-date" and skips it; fixing the clock alone doesn't re-create an already-cached
  bad cert. Only a wipe + **hardware** download does.
- **New doc:** [`docs/tia_opcua/opcua-server-wont-start-econnrefused.md`](./tia_opcua/opcua-server-wont-start-econnrefused.md)
  (full runbook + the one-command diagnosis). Referenced from CLAUDE.md (gotchas + doc map).

### 2026-08-14 — "Add new PLC" UI + per-connection connect/status endpoints (Phases 4 & 5)
- **API (Phase 4):** `GET /api/plc-connections/status` (whole-pool live status), `POST
  /api/plc-connections/:id/connect` + `.../disconnect` (open/close ONE saved PLC's session, pooled
  by its `_id`). `plc.service.connectPlc/disconnectPlc` take a `connectionId`; `getPoolStatuses`
  exposes `opcua.getAllStatuses()`. Orchestrated in `plc-config.service` (`connectConnection`/
  `disconnectConnection`/`connectionStatuses`). All super-admin.
- **UI (Phase 5):** PLC Manager's connection form now has a **Line dropdown + crane multi-select**
  (chips) — picking cranes binds them to that PLC (cranes disabled until a line is chosen; UX guard
  mirrors the backend rule). Each connection row shows a **live status chip** (connected/connecting/
  error-with-tooltip/disconnected, polled every 4 s) and a **Connect / Disconnect** button, plus its
  line + crane tags. `usePlcConnections` gained `statuses`, `pendingId`, `connect`, `disconnect`
  with polling; `ConnectionForm`/`ConnectionList`/`PlcManagerPage` wired to `useLines`. New CSS:
  `status-chip*`, `crane-picker*`, `chip`, `crane-tag*`, `conn-card__meta`.
- **Flow:** click **New connection** → name + endpoint (connection string) + security + line + cranes
  → **Create**, then **Connect** on the row → the pool opens a session to that PLC's IP and the chip
  goes green — exactly the "add a PLC by typing its endpoint and connecting" ask, now per-PLC.
- **Tests:** backend +3 (status array + RBAC, connect/disconnect 404, idempotent disconnect) →
  **86 green**; frontend page test updated for the new fields/pickers → **26 green**; tsc + lint +
  vite build clean on both.
- **This completes the multi-line, multi-PLC feature (Phases 1–5).** Deferred niceties: per-line PLC
  selector on the batch/crane-view pages, tag bulk-import from the panel layout, per-connection
  NodeId namespace/DB override.

### 2026-08-14 — Multi-PLC routing: connect all PLCs at boot + split a recipe per PLC (Phase 3)
- **Boot:** `plc.service.autoConnectAllPlcs()` opens **every line-assigned PLC** into the pool keyed
  by its `_id` (Promise.allSettled, per-PLC log, a down PLC is non-fatal). `index.ts` calls it after
  the legacy `autoConnectActivePlc()` (which still fills the `DEFAULT` slot for the manual PLC page).
- **Connection-aware I/O:** `plc.service` `readNode/writeNode/sendCommand` take an optional
  `connectionId` (default = `DEFAULT` slot) so callers can target a specific PLC session.
- **Batch routing (`batch.service`):** extracted pure `buildTaskWrites` (renumbers a PLC's tasks
  1..k); new **`planBatchByConnection`** splits a recipe by **tank → crane → owning PLC**, renumbers
  each PLC's slice from 1, and collects `missing` (no tank) + `unrouted` (tank's crane has no PLC).
  `sendBatch(lineId, qr)` now: resolves the line's bound PLCs → if none, **legacy single-array path**
  on the active PLC (keeps the sim working); else **dispatches each PLC only its own tasks** on its
  own session (data first, `cmd_send` last), returning per-PLC `dispatched[]`. `getBatchStatus` /
  `ackBatch` / `getCraneView` take an optional `connectionId` (per-PLC).
- **API:** `?connectionId=` (uuid, optional) on `GET /batch-status`, `POST /batch-ack`,
  `GET /crane-view` (Zod strict). `send-batch` response gains `dispatched` (per-PLC counts).
- **Per-PLC NodeId namespace/DB** still comes from `OPCUA_BATCH_*` env (every PLC runs the same
  program template) — per-connection override is a later add.
- **Tests:** +5 `planBatchByConnection` unit tests (split+renumber, unrouted, missing, per-PLC
  >20 cap, empty). Backend **83 green** (3 skipped), tsc + lint clean.
- **Next:** Phase 4/5 — the "Add new PLC" admin UI (endpoint + line + crane multi-select + per-row
  connect/live status) and a per-line PLC/crane selector on the batch + crane-view pages.

### 2026-08-14 — Multi-PLC data model: PLC ↔ line + crane binding (Phase 2 of multi-line)
- **Domain fact captured first.** Parsed `Panel_Drawings_081426.xlsx` → the plant is **6 PLCs /
  5 lines / 10 cranes**, hierarchy **PLC → crane(s) → tanks** (fixed). A **line can span multiple
  PLCs** — Line 4 = PLC_4 (cranes 6+7A) **and** PLC_6 (crane 7B). Full parse in
  `docs/plc/plant-panel-layout.md`; memory `plant-plc-crane-layout`. So the PLC-assignment unit is
  the **crane**, not the line.
- **Model:** `plc_connections` gains `lineId` (nullable) + `cranes[]`. Tank→PLC is **derived**
  (`tank.crane` → the line's connection whose `cranes[]` contains it) — never hand-entered.
- **Validation (`plc-config.service.resolveAssignment`)**: cranes require a line (400); cranes must
  be members of the line (400); a crane maps to exactly one PLC per line — double-claim is 409.
  Deleting a line **unassigns** (not deletes) its PLCs (`lineId`→null, `cranes`→[]) via
  `connRepo.unassignLine` (called from `line.service.deleteLine`).
- **Storage:** both drivers — SQLite adds `lineId`/`cranes` columns (idempotent `ALTER` +
  `idx_plc_connections_lineId`; `cranes` stored as JSON text), Mongo passthrough + `lineId` index;
  new `listByLine` + `unassignLine` on the `PlcConnectionStore` contract.
- **API:** `GET /api/plc-connections?lineId=` filter; create/update accept `lineId` + `cranes`
  (Zod, bounded, strict, de-duped). Tag **bulk-import from the panel layout deferred** to a later
  phase (manual tag entry stays for v1).
- **Tests:** +6 crane-binding integration tests (assign subset, non-member crane 400, cranes-without-
  line 400, line-spans-two-PLCs with double-claim 409, `?lineId` filter + bad-uuid 400, line-delete
  unassigns). Backend **78 green** (3 skipped), tsc + lint clean.
- **Next:** Phase 3 — auto-connect all line-assigned PLCs at boot + route batch/crane ops by
  connectionId (group a recipe's tasks by tank→crane→PLC, send each PLC only its own tasks); Phase
  4/5 endpoints + the "Add new PLC" UI (endpoint + line + crane pick + per-row connect/status).

### 2026-08-14 — Multi-PLC engine: OPC UA client singleton → connection pool (Phase 1 of multi-line)
- **Why:** the plant has multiple lines, each with its own PLC (its own OPC UA server + IP). The
  DB already stored many connections, but the engine (`services/plc/opcua-client.ts`) held **one**
  live session — `connect()` killed any existing one. Confirmed feasible (OPC UA is client→server;
  `node-opcua` can hold N independent sessions to N IPs; the `:4840 EADDRINUSE` rule is a *server*
  bind concern, irrelevant to us as a client).
- **Change:** `opcua-client.ts` is now a **pool** keyed by a caller-chosen `connectionId`
  (`Map<id, PoolEntry>`). Every fn takes an id: `connect/disconnect/readValue/writeValue/
  getConnectionStatus`, plus new `getAllStatuses()` (whole-pool snapshot) and `disconnectAll()`.
  `connect(id,…)` replaces only that id's entry — other PLCs stay live. Failed connects leave the
  entry in `error` state with `lastError` (so the UI can show per-PLC status).
- **Back-compat (kept green, zero API/route/schema/test churn):** the legacy single-PLC flows
  (manual PLC page + boot auto-connect of the active saved connection) all route through a reserved
  `DEFAULT_CONNECTION_ID = 'default'` inside `plc.service.ts`. Controllers, routes, schemas and the
  existing PLC tests are untouched.
- **Tests:** new `__tests__/plc-pool.test.ts` (7 tests, node-opcua + PKI mocked) proves two
  endpoints stay isolated, disconnect-one-keeps-others, reconnect-replaces-one, unknown-id refusal,
  and error-state capture. Backend **72 green** (3 skipped), tsc + lint clean.
- **Next (per plan):** Phase 2 add `lineId` to the connection record (many PLCs per line); Phase 3
  auto-connect *all* line-assigned PLCs at boot + route batch/crane ops by connectionId; Phase 4/5
  endpoints + "Add new PLC" UI (endpoint field + line dropdown + per-row Connect/status).

### 2026-08-06 — Crane View: live animated gantry visualizer (manager)
- **New manager page `/crane`** (also super-admin) — a live picture of the crane driven by the
  PLC. The trolley glides station→station and the hoist raises/lowers as a batch runs; station
  limit-switch dots light from `ls_at[]`, and a status chip shows the state name + step/count.
- Backend: `batch.service.getCraneView()` reads the run tags in one parallel round (whole `ls_at`
  array in a single node read) and derives `{ state, step, busy, done, station, lsAt, hoist,
  moving }`; route `GET /api/plc/crane-view` (added to the rate-limit poll-skip set). Verified the
  derived snapshot live against the sim.
- Frontend: `useCraneView` (polls 500 ms, holds last confirmed station so the trolley glides
  during travel), `CraneVisualizer` (CSS-animated SVG-less gantry using theme tokens),
  `CraneViewPage`, route gated to `manager`+`super_admin`, sidebar nav (lucide `Container`).
  New crane-viz CSS block in `index.css`. Backend 65 green, FE 26 green, both tsc+lint clean.
- **NodeId gotcha resolved along the way:** S7-1500 array elements are `"tasks"[i]."station"`
  (bracket outside quotes) and **0-based** over OPC UA (OPC UA `[0]` = S7 `tasks[1]`); app writes
  `taskNo−1`. Also: a new DB reads `BadNodeIdUnknown` until downloaded, and PLCSIM's Load preview
  defaults "Stop modules" to "No action" (blocks Load → set "Stop all"). Recorded in CLAUDE.md.

### 2026-08-05 — Line 4 crane batch: TIA program + "Send to PLC" handshake
- **TIA program (Line 4):** built the crane batch runner on the `CraneSim` S7-1500 —
  `typeTask` UDT, `Line4Data` global DB (`tasks Array[1..20] of typeTask` + handshake bits
  `cmd_send/sts_busy/sts_done/sts_step/sts_state` + I/O mirror `ls_at[]/ls_dip/ls_up/btn_start/
  mv_*`), a `TravelTo` FC (direction picker, reverses for non-sequential recipes), and a
  `CraneSequencer` FB state machine (IDLE→GO_LOAD→LOWER→WAIT_BTN(3 s)→LIFT→per-task
  GO_TANK→LOWER→DWELL→LIFT→GO_PARK→DONE) called from OB1. Full runbook + SCL:
  [`line4/instructions.md`](./line4/instructions.md).
- **Software "Send to PLC" (app→PLC batch + done handshake).** New flow layered on the existing
  generic OPC UA client — no PLC-specific protocol code:
  - Backend: `services/plc/batch.service.ts` (`planBatch` pure station-mapper — `station =
    tank.number + 1`, writes ordered `tasks[i].station/dwell_s` then `task_count`, arms
    `cmd_send` last; `sendBatch`/`getBatchStatus`/`ackBatch`), `plc.service.writeNode`
    (write-no-readback), routes `POST /api/plc/send-batch`, `GET /api/plc/batch-status`,
    `POST /api/plc/batch-ack` (manager-allowed under `requireAuth`), `sendBatchSchema`
    (`{lineId uuid, qr}` strict), shared `qrRecipe` field, env `OPCUA_BATCH_NAMESPACE`/`_DB`.
    `batch-status` added to the rate-limit poll-skip set.
  - Frontend: `useTaskGenerator` now sends the batch, polls `batch-status` 1/s, acks on `done`;
    `TaskGenerator` shows a **Send to PLC** button that disables + reads "Tasks in progress"
    while `batchBusy`, then toasts "Tasks done" and re-enables. `api/plc.ts` + `types/plc.ts`
    mirrors.
  - Tests: `plc-batch.test.ts` (planBatch station mapping/order/NodeId/missing/bound) +
    `plc.test.ts` batch cases (validation, manager-not-403→404, 409 no-connection). Backend
    59→65 green, FE tsc+lint clean.
  - **Data contract:** app writes `tasks[1..N]` in step order; the crane runs array order and
    reverses when a next station is lower (non-sequential recipes just work). `prev`/`next` are
    traceability only.

### 2026-08-03 — Siemens sim bring-up + DB-backed PLC Manager (config out of `.env`)
- **Siemens OPC UA sim proven end-to-end:** built a TIA V18 + PLCSIM Advanced V5.0 S7-1500
  (`CraneSim`: `PlcData` DB + SCL FC counter), enabled the OPC UA server, and verified live
  read+write from the app at `opc.tcp://192.168.50.1:4840` — a `.env`-only swap from OpenPLC.
  Runbook: [`tia_opcua/tia-plcsim-opcua-setup.md`](./tia_opcua/tia-plcsim-opcua-setup.md); new
  CLAUDE.md gotchas (run PLCSIM as admin; `netcfg` fix for the `plcsimlwf` virtual switch; the
  `PLCSIM↔TCP/IP` toggle; OB1 can't be SCL → use an FC; "Support simulation during block
  compilation" is required to download). Real target is an **S7-1200 (CPU 1212C)**; sim uses a
  1500 because PLCSIM Advanced can't simulate the 1200.
- **PLC Manager (super-admin, DB-backed) — ADR-007.** All OPC UA config now lives in the DB, not
  `.env`/code. Backend: `plc_connections` + `plc_tags` models/stores (Mongo **and** SQLite),
  repos, Zod schemas (bounds + strictObject), services, controllers, and super-admin routes under
  `/api/plc-connections` (CRUD + `/:id/activate` + nested `/:id/tags`). Boot seeds an Active
  connection from `.env` and **auto-connects** it; `GET /api/plc/state` now returns the active
  connection + tags. Frontend: `PlcManagerPage` (Connections list + New/Edit modal + per-connection
  Tags panel), `usePlcConnections`/`usePlcTags` hooks, api/types/schemas, sidebar nav + route; the
  PLC page's live-read table seeds from the active connection's mapped read tags (friendly labels).
- **Green:** backend **56 tests** (8 new PLC-Manager integration tests: CRUD, RBAC 403, strict-400,
  single-active, tag uniqueness, cascade delete, state reflection); frontend **26 tests** (3 new
  PlcManagerPage tests). tsc + eslint clean both sides. Rebuilt `better-sqlite3` for Node 22.

### 2026-08-02 — New doc: PLC/OPC UA connectivity architecture
- Added [`architecture-connectivity.md`](./architecture-connectivity.md): the end-to-end map of how
  the software talks to a PLC and everything attached to that process — the three tiers
  (frontend / backend / external PLC), the `services/plc/` client trio, the 5 HTTP endpoints +
  middleware (auth/RBAC, Zod validation, rate-limit poll-skip), config swap points, PKI/security,
  the OpenPLC server + `scripts/plc/*`, and full read/command/connect flow diagrams (Cycle Ledger
  NodeIds). Cross-linked from `architecture.md` (ADR-006) and `concepts/plc-opcua.md`. Docs-only.
- Discovered the plugin disable isn't only on program-download — OpenPLC resets `plugins.conf`
  (opcua→0) on **every shutdown**. Corrected the earlier "restart is safe" note everywhere.
- Added `scripts/plc/start-openplc.ps1`: everyday start that re-enables the plugin (keeps
  `opcua.json` mapping) then launches + waits for :4840. Use instead of `StartOpenPLC.bat`.
  `restart-openplc.ps1` stays for program changes (also re-maps). Re-enabled + verified all 6
  ledger nodes read Good.

### 2026-08-02 — Multi-tag watch table + one-command OPC UA sync + concise docs
- **Multi-tag watch table:** the PLC page's Live read is now a persistent, editable **table**
  that polls many NodeIds at once (`PlcWatchTable.tsx`, `usePlc` refactor, localStorage). Replaced
  the single-node `PlcMonitor`. FE lint/tsc/**23 tests**/build green.
- **One-command sync (kills the "redo every time" pain):** `scripts/plc/restart-openplc.ps1` +
  `scripts/plc/sync-opcua-mapping.mjs` — after a program download, stop → re-map `opcua.json`
  from `debug.c` (auto-detects located `_O_ENUM` vars + indices) → re-enable opcua plugin →
  restart → wait for :4840. Answers: PC/OpenPLC **restart needs no re-fix** (files persist); only a
  **program re-download** does, and that's now one command.
- **Concise docs:** `docs/concepts/opcua-quickstart.md` (1-page plain-language cheat: the 4 words,
  security table, locker analogy for `index`, "redo it?" answer).

### 2026-08-02 — Cycle Ledger program LIVE end-to-end
- User authored the Cycle Ledger ST program in OpenPLC Editor v4 (run/reset/target/cycle_count/
  running/done + TON/R_TRIG/CTU) and downloaded it. Mapped it over OPC UA and verified both
  directions live: wrote `target=5` + `run=true` → `cycle_count` climbed 0→4, `running` true;
  `reset=true` → 0.
- **Two gotchas hit & fixed:** (1) re-downloading a program **disabled the opcua plugin**
  (`plugins.conf` reset to `0`) → app timeout; re-enabled while stopped. (2) FB internals take the
  low `debug.c` indices, so the six real tags sit at **27–32**, not 0–5 — read `debug.c` for truth.
- `opcua.json` rewritten for the ledger; NodeIds `ns=2;i=1..6` = cycle_count/running/done/run/
  reset/target. `backend/.env` READ=`ns=2;i=1`, WRITE=`ns=2;i=4`. Docs + CLAUDE.md gotchas updated.

### 2026-08-02 — Project 1 doc: Cycle Ledger over OPC UA
- Wrote [`projects/project-01-cycle-ledger-opcua.md`](./projects/project-01-cycle-ledger-opcua.md):
  a follow-along build for a PLC "ledger" (self-driving cycle counter with software start/stop/
  reset/target), then read it + push commands from our app over OPC UA. Includes the tag table,
  ladder + Structured Text, the `opcua.json` index-mapping steps, and a glossary. **No app code
  change needed** — the PLC page already reads/writes any NodeId; optional follow-up = a
  multi-tag watch table. Docs-only change.

### 2026-08-02 — Generic security selector + PLC page redesign + docs
- **Security dropdown (generic PLCs):** the PLC page now has **Security** (None / Sign /
  SignAndEncrypt) and **Policy** (None / Basic256Sha256 / …) selectors, sent on connect so the
  same app reaches OpenPLC (None) or a Siemens S7-1500 (SignAndEncrypt/Basic256Sha256) with no
  code change. Backend already supported the per-request override; wired the frontend
  (`types/plc.ts`, `api/plc.ts`, `usePlc.ts`, `PlcConnectionPanel.tsx`) + a cert/clock hint.
- **PLC page redesign:** split into distinct sections — a full-width **Connection** card, then
  a two-column **Live read | Send command** grid (`.plc-layout`/`.plc-io`), responsive to 1
  column on md/sm. Connection shows the active security as a chip.
- **Docs:** new plain-English [`concepts/opcua-explained.md`](./concepts/opcua-explained.md)
  (NodeId, namespace, index, security, full glossary); this software-flow doc created.
- Verified: frontend lint + tsc + 22 tests + production build all green.

### 2026-08-02 — OpenPLC v4 live end-to-end + rate-limit fix
- Enabled OpenPLC v4 `opcua` plugin, mapped `opcua.json` to the loaded PLC program, confirmed
  genuine PLC→SW counter + SW→PLC write live over OPC UA.
- Fixed the login 429: reworked rate limiting into `middleware/rate-limit.ts` (generous global
  cap that skips the 1s poll endpoints + strict login limiter). See
  [`openplc_opcua/enable-opcua-plugin.md`](./openplc_opcua/enable-opcua-plugin.md) and `progress.md`.

### Earlier
- See [`progress.md`](./progress.md) for Phases 0–4.1 (scaffold, auth/RBAC, lines/QR, offline
  packaging, OPC UA client + security).

---

## How to update this log

At the end of any build/change, add a dated bullet block at the top of the Build log:
**what changed**, **which files/areas**, and **verification** (lint/tsc/tests). Keep it short —
detail belongs in the concept doc for that feature.
