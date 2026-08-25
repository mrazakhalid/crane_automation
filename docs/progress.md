# Progress — resume-here log

## Done

- **Phase 0 — Scaffold:** monorepo (independent installs) with Express 5 + TS backend and
  React 19 + Vite + TS frontend. Security middleware (Helmet, CORS, rate-limit), Zod env
  validation, Axios client, layered folders, health endpoint + sample test, docs skeleton.
- **Phase 1 — Auth & RBAC:** MongoDB data layer (native driver + in-memory fallback for
  dev/test), unified JWT login, three roles (super_admin/manager/operator), bcrypt password
  hashing, seeded `admin / admin` super-admin. Endpoints: `POST /auth/login`, `GET /auth/me`,
  `PATCH /auth/me/credentials`, and super-admin-only `GET/POST /users`,
  `PATCH /users/:id/credentials`, `DELETE /users/:id`. Frontend: unified login, collapsible
  sidebar (Dashboard first, Logout last, signed-in indicator, role-gated Users tab),
  workspace placeholder showing the role in large type, super-admin user management
  (add with generated one-time credentials, rotate credentials, delete), Account
  self-service credential change. Toasts, optimistic updates + rollback, skeletons,
  spinners, responsive. All lint/typecheck/tests green (backend 13, frontend 9).
  See `docs/concepts/auth-rbac.md`.

- **Phase 2 — Lines & QR task generation:** `lines` collection (unique `name`, layered
  repo/service/controller/routes). Super-admin **Lines** tab saves the fixed **line4**
  layout (3 cranes 7A/7B/6, 17 tanks incl. two transfer tanks). Managers scan a QR recipe
  (`key=seconds;…`) on the dashboard → backend `task-generator` resolves each key to a tank
  (exact name, then A/B/C-normalized, lowest number wins), producing tasks
  `crane_name / tank_name / time / next_task / previous_task / status`; unresolved keys are
  kept in sequence and marked `missing`; `status` = 0. Endpoints: `GET/POST /api/lines`,
  `GET /api/lines/:id`, `POST /api/lines/:id/tasks` (create = super-admin; read + generate =
  any auth). Frontend: Lines tab (list + Add line preview/save), manager TaskGenerator
  (line picker + QR decode + task table), lazy-loaded. Lines are full CRUD: a reusable
  builder (`LineForm` + `TanksEditor`) adds custom lines (or prefills line4) and edits
  existing ones in a dialog; per-line **Edit**/**Delete** with optimistic update/rollback;
  backend `PATCH`/`DELETE /api/lines/:id` (super-admin, 409 on name clash, 404 on missing).
  All lint/typecheck/tests green (backend 33, frontend 20). See `docs/concepts/lines.md`.

- **Phase 3 — Web + offline packaging:** Pluggable `storage/` layer with `UserStore`/
  `LineStore` contracts and two drivers — `mongo/` and `sqlite/` (better-sqlite3, JSON
  columns for cranes/tanks). `STORAGE_DRIVER` env var selects one and only that driver is
  dynamically imported (SQLite is an optionalDependency). Repositories are now thin facades;
  services/routers/frontend unchanged. Express optionally serves the SPA (`CLIENT_DIR`).
  Electron desktop shell (`desktop/`) runs the compiled backend as a Node child in sqlite
  mode; `desktop/scripts/bundle.mjs` builds FE+BE, stages prod deps, rebuilds the native
  module for Electron, and packages a Windows installer. Verified: mongo + sqlite drivers
  pass the same API tests (backend 36), and the compiled backend serves SPA+API from a real
  sqlite file in production mode. See `docs/concepts/offline-desktop.md`.

- **Phase 4 — PLC communication over OPC UA (POC):** Two-way OPC UA link. A single
  **protocol-generic** OPC UA **client** (`services/plc/opcua-client.ts` + `plc.service.ts`,
  `node-opcua`) connects to a **runtime-chosen endpoint + NodeIds** — endpoints `GET /api/plc/state`,
  `GET /api/plc/read`, `POST /api/plc/connect|disconnect|command` (status/reads = any auth;
  connect/disconnect/write = super-admin). New super-admin **PLC** page (`pages/PlcPage.tsx` +
  `PlcConnectionPanel`/`PlcMonitor`/`PlcCommandForm`, `hooks/usePlc.ts`, 1 s live read poll,
  toasts). **OpenPLC v4 (Autonomy Edge) exposes OPC-UA natively**, so the client connects
  **directly** to it — no translation shim. Moving OpenPLC → the physical S7-1500 is a **config
  change only** (endpoint + NodeIds in the UI / `.env`), no code. *(An interim throwaway
  Modbus→OPC-UA bridge was built then removed once native OpenPLC v4 OPC-UA was confirmed; the
  OPC-UA round-trip — a counter read climbing + a BOOL write with read-back `true`, status Good —
  was verified against it.)* All lint/typecheck/tests green (backend 41, frontend 22). See
  `docs/concepts/plc-opcua.md` and ADR-006.

- **Phase 4.1 — OPC UA security (Sign/Encrypt + certificates):** The client can now open
  **secured** sessions, needed for a real PLC that exposes no `None` endpoint. New
  `services/plc/opcua-security.ts` maps `OPCUA_SECURITY_MODE` (None/Sign/SignAndEncrypt) +
  `OPCUA_SECURITY_POLICY` (Basic256Sha256, …) to node-opcua options and owns a persistent
  `pki/` store (own client cert + trusted server certs; gitignored). `connect` takes optional
  per-request overrides (schema + controller + service threaded); `plc/state` reports the
  security defaults; secured connect gives actionable 502s (cert-rejected → which cert to trust;
  mode/policy mismatch → what the server advertises). Verified against the real PLC at
  `opc.tcp://192.168.1.30:4840` (advertises Basic256Sha256 Sign/SignAndEncrypt only): our client
  cert is generated with the correct applicationUri and the channel reaches `OpenSecureChannel`.
  Full connect is now blocked only on **PLC-side** steps — trust our client cert + fix the PLC
  clock (it read 2012, making our cert look not-yet-valid). All lint/typecheck/tests green
  (backend 42, frontend 22). See the "secured endpoint" runbook in `docs/concepts/plc-opcua.md`.

- **Phase 4.2 — OpenPLC v4 live end-to-end + rate-limit fix (2026-08-02):** Verified the full
  two-way OPC UA link against **OpenPLC Runtime v4** (native OPC-UA plugin) on this machine —
  earlier note that the local runtime was "legacy Modbus-only" was wrong; it's v4. Enabled the
  runtime's `opcua` plugin (`plugins.conf`), mapped `opcua.json` to the loaded PLC program, and
  confirmed genuine **PLC→SW** (a counter the program increments each 20 ms scan, read climbing
  live over OPC UA) plus **SW→PLC** (BOOL write, read-back Good). Client security set to
  `None`/`None` to match OpenPLC. **Fix:** the global rate limiter (100 req/15 min) was tripped
  by the PLC page's 1 s live-read poll, 429-ing every route incl. `/login`. Reworked into
  `middleware/rate-limit.ts`: generous global cap (600/15 min) that **skips** the authenticated
  live-poll endpoints, plus a **strict login limiter** (20 failed/15 min, successes don't count)
  with a JSON error the UI surfaces. Added `__tests__/rate-limit.test.ts` (3 tests). Runbook:
  `docs/openplc_opcua/enable-opcua-plugin.md`. (Note: `storage-sqlite.test.ts` fails locally on a
  native better-sqlite3 binding issue — environmental, unrelated.)

- **Phase 5 — Cross-line recipes → task split → live Process page (2026-08-25, software only):**
  A recipe can now **span multiple lines**. New `recipes` store (Mongo + SQLite, unique name,
  saved with per-step line `overrides`) with full CRUD (`/api/recipes`, manager + super-admin).
  New `services/process/`: `resolver.resolveAcrossLines` (reuses `resolveTank` across **all** lines
  → resolved / missing / **ambiguous**), `planner.buildPlan/planProcess` (groups by **PLC → crane**
  via `plc_connections.lineId`+`cranes`, flags **unrouted**), and an in-memory **time-derived**
  `run-engine` (sequential within a crane, parallel across cranes; no timers). Routes
  `/api/process/{plan,start,:runId/status,:runId/stop}`. Frontend **Process** tab (**manager-only**
  UI — admins manage lines/PLCs/connections): recipe upload/paste/**saved-dropdown**, **Divide
  tasks** summary (PLC→crane groups,
  inline line-picker for ambiguous tanks, missing/unrouted badges), **Start/Stop** with live
  per-task `idle→in-progress→done` + progress bar. **No PLC contacted** — the run is a simulation;
  the OPC UA swap is localized to `run-engine.ts`. Green: backend 105 tests, frontend 29 tests.
  See `docs/concepts/process.md`.

## Remaining

- **Run the Electron packaging once** (`cd desktop && npm install && npm run bundle`) — the
  code + script are done and the offline backend path is verified, but the installer build
  itself hasn't been executed in-session (heavy download; native rebuild may need VS Build
  Tools if no Electron prebuilt is fetched). Then smoke-test the produced `.exe`.
- **PLC POC end-to-end with OpenPLC v4:** ✅ DONE (Phase 4.2 above) — two-way verified live
  against the local OpenPLC Runtime v4 native OPC-UA server. Later: swap to the physical
  **S7-1500** — repoint endpoint + Siemens NodeIds only, no app code change; and re-test the
  secured (Sign/Encrypt) path against OpenPLC (regenerate the client cert with a matching
  applicationUri to clear the harmless `NODE-OPCUA-W06` warning).
- Build the real crane-control panels inside the workspace (per role).
- Persist generated task lists / job runs (currently generated on demand, not stored).
- Optional: export/import to bridge the web (Mongo) and desktop (SQLite) stores.

## Held commits / pending deploys

- None. Nothing has been committed — the repo is not a git repository yet. Phases 2 (Lines &
  QR task generation) and 3 (web+offline packaging) are complete on disk. The Electron
  installer build is the one un-run step (see Remaining).
