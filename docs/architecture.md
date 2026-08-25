# Architecture

## Overview

Two-app monorepo with **independent installs** — `backend/` and `frontend/` each own their
`package.json`, lockfile, and `node_modules` (no workspace hoisting), so they can run on
different infrastructure. The root `package.json` only forwards scripts via `npm --prefix`.

- `frontend/` — React 19 SPA (Vite). Talks to the backend only through the shared
  Axios client (`src/api/client.ts`).
- `backend/` — Express 5 API. Layered: **routes → controllers → services → repositories/models**.

```
Browser ──HTTP──▶ Vite dev server ──/api proxy──▶ Express API
                                                    │
                        routes ─▶ controllers ─▶ services ─▶ repositories ─▶ (data)
```

## Backend layers

| Layer          | Folder                | Responsibility                                        |
| -------------- | --------------------- | ----------------------------------------------------- |
| Routes         | `src/routes`          | HTTP wiring only: path → middleware → controller.     |
| Controllers    | `src/controllers`     | Translate HTTP ⇄ service calls; shape responses.      |
| Services       | `src/services`        | Business logic. Ignorant of HTTP and of the DB driver.|
| Repositories   | `src/repositories`    | Facades over the active storage driver (no driver code). |
| Storage        | `src/storage`         | Pluggable data drivers (`mongo/`, `sqlite/`) + selection. |
| Models         | `src/models`          | Data shapes / entities.                               |
| Schemas        | `src/schemas`         | Zod schemas — the validation source of truth.         |
| Middleware     | `src/middleware`      | Cross-cutting: validation, errors, 404, auth.         |
| Config         | `src/config`          | Env parsing/validation (`env.ts`).                    |

**Rule:** HTTP concerns never leak below controllers; data access never leaks above repositories.

## Frontend structure

| Folder            | Responsibility                              |
| ----------------- | ------------------------------------------- |
| `src/api`         | Axios instance + typed API call wrappers.   |
| `src/pages`       | Route-level views.                          |
| `src/components`  | Reusable presentational components.         |
| `src/hooks`       | Reusable stateful logic.                    |
| `src/types`       | Shared TypeScript types.                    |

## Architecture Decision Records (ADRs)

Record notable decisions here as `ADR-NNN: <title>` with Context / Decision / Consequences.

### ADR-001: MongoDB via the native driver, with an in-memory fallback for dev/test

- **Context:** We need a data store for users (and future crane/recipe data). Zod is
  already our validation source of truth, and the target machine has no local MongoDB.
- **Decision:** Use the official `mongodb` native driver behind the repository layer
  (no ODM). `config/db.ts` owns a single MongoClient; when `MONGODB_URI` is empty in
  dev/test it starts `mongodb-memory-server` automatically. Production requires a real URI.
- **Consequences:** Zero-setup local runs and hermetic tests; one connection pool shared
  by all repositories; validation stays in Zod (not a schema library). Trade-off: we hand-
  write mappings instead of getting an ODM's model layer — acceptable given small schemas.

### ADR-002: Stateless JWT auth + RBAC enforced at the boundary

- **Context:** Unified login for three roles; the two apps may run on different infra.
- **Decision:** Login issues a short-lived JWT (`sub`/`username`/`role`). `requireAuth`
  verifies it and `requireRole(...)` gates role-specific routes. Passwords are bcrypt-
  hashed; the service layer additionally refuses to mutate `super_admin` records via the
  management API (defense-in-depth against IDOR).
- **Consequences:** No server-side session store; horizontal scale is easy. Token
  revocation is coarse (expiry / secret rotation). The frontend persists the token in
  `localStorage` and attaches it via an Axios interceptor; a 401 clears it.

### ADR-005: Dual storage drivers (`STORAGE_DRIVER`) for web + offline desktop

- **Context:** We want the same app to run as a web deployment (MongoDB) **and** as a fully
  offline desktop app (no server, no internet, no Node install on the target). MongoDB is a
  server process, not embeddable.
- **Decision:** Introduce a `storage/` layer with `UserStore`/`LineStore` contracts and two
  drivers — `storage/mongo/` and `storage/sqlite/` (better-sqlite3). `connectStorage()`
  picks one from `STORAGE_DRIVER` and **dynamically imports only that driver**, so neither
  build pulls the other's dependency (SQLite is an `optionalDependency`). Repositories become
  thin facades over the active store, so services/routers/frontend are untouched. The desktop
  app is an Electron shell (`desktop/`) that runs the compiled backend as a Node child with
  `STORAGE_DRIVER=sqlite` + `CLIENT_DIR` (Express also serves the SPA), packaged by
  `desktop/scripts/bundle.mjs`.
- **Consequences:** One codebase, two homes; the switch is a single env var. SQLite is a
  single file (trivial backup) with cranes/tanks stored as JSON columns. Trade-offs: the
  native `better-sqlite3` module must be rebuilt for Electron's ABI at bundle time (handled
  by the script); the two stores don't sync (independent by design); CSP is relaxed only in
  the desktop bundle (inline theme script in the built HTML).

### ADR-004: QR keys resolve to tanks by name; unresolved keys are kept as `missing`

- **Context:** A saved line stores tank positions with names (`1-1A`, `1-4B`, …). A scanned
  QR recipe is `key=seconds;…` where `key` is a station id (`1-1`, `1-7`, `20-1`). The keys
  don't always match tank names 1:1 (suffix differences like `1-1`↔`1-1A`; and recipes may
  reference stations on cranes outside the line).
- **Decision:** Resolve each key on the **backend** (`services/task-generator.ts`): exact
  case-insensitive name match first, else a normalized match (drop a trailing `A/B/C…` after
  a digit) taking the lowest-numbered tank — so `1-1` → tank 1. Unresolved keys still emit a
  task **in sequence** with `crane_name`/`tank_name` = `missing`; `previous_task`/`next_task`
  carry the neighbour's tank number (`0` at the ends, `missing` if that neighbour is
  unresolved). `status` is always `0` for now.
- **Consequences:** Deterministic, unit-testable mapping with no data loss and no silent
  truncation; the frontend just renders. Trade-off: tanks are matched by name, so if a QR's
  keys ever diverge from tank names we'll add an explicit per-tank station `code` field
  (the model already leaves room for it). Task lists are generated on demand, not persisted.

### ADR-006: PLC communication over a generic OPC UA client (direct to OpenPLC v4 / S7-1500)

- **Context:** The app must talk two-way to a PLC. The plant PLC is a **Siemens S7-1500**
  (native OPC UA server); OPC UA is also the right strategic protocol — secure, vendor-neutral,
  and viable on both the intranet (`opc.tcp`) and the cloud (pub/sub) later. The POC controller,
  **OpenPLC v4** (Autonomy Logic's Editor/Edge), also exposes a **native OPC-UA server**, so no
  protocol translation is needed. *(An earlier iteration added a throwaway Modbus→OPC-UA bridge
  under `tools/plc-bridge/` for the legacy Modbus-only OpenPLC; it was removed once we confirmed
  OpenPLC v4 speaks OPC UA natively.)*
- **Decision:** Standardize the application on a single **protocol-generic OPC UA client**
  (`services/plc/`, `node-opcua`) that connects to a **runtime-chosen endpoint + NodeIds** (the
  PLC page's input fields, defaulted from `.env`). Nothing about OpenPLC or Siemens is hard-coded.
  Moving between servers (OpenPLC v4 → S7-1500 → any OPC UA PLC) is a **config change only — no
  code change**. Mutating actions (connect/disconnect/command) are super-admin-only; status/reads
  need only auth.
- **Consequences:** One client, any server; the swap is two fields (endpoint + NodeIds). Fewer
  moving parts than a bridge, and the POC exercises a real OPC-UA server→client path end to end.
  Trade-offs: the POC uses the **None** security policy (certificate hardening is a later step,
  shared with the Siemens rollout); the S7-1500 side still needs its server config validated on
  the hardware (tag exposure, OPC UA runtime license). Only one OPC UA server may bind `:4840`.
  Caveat: native OPC-UA requires **OpenPLC v4/Edge** — the legacy msys64 Runtime is Modbus-only.
- **See also:** the full FE→API→client→server connectivity map in
  [`architecture-connectivity.md`](./architecture-connectivity.md).

### ADR-007: PLC configuration is data (DB-backed PLC Manager), not `.env`/code

- **Context:** ADR-006 made the app a generic OPC UA client whose endpoint/NodeIds default from
  `.env`. That still meant a developer edited `.env` (and NodeIds were typed ad-hoc on the PLC
  page, unsaved). Adding or switching a PLC — especially the eventual fleet of Siemens
  controllers — should be an operator task in the UI, not a redeploy.
- **Decision:** Move all OPC UA configuration into the database as two collections managed by a
  super-admin **PLC Manager** screen: `plc_connections` (name, endpoint, securityMode/Policy,
  `isActive`) and `plc_tags` (friendly `label` → `nodeId` + `dataType` + `direction`, unique per
  connection). Exactly one connection is **active**; the backend **auto-connects** to it at boot
  and `GET /api/plc/state` serves its defaults + tags. On first boot we **seed** one active
  connection from the existing `.env` values so nothing breaks. All PLC-Manager endpoints are
  super-admin-only; `.env` remains only a seed/fallback. Stores are implemented for **both**
  storage drivers (Mongo + SQLite) per ADR-005.
- **Consequences:** Adding/switching a PLC (incl. the real S7-1200) is now a UI action — no code,
  no `.env`, no redeploy — and operators use friendly tag labels instead of raw NodeIds (the PLC
  page's live-read table seeds from the active connection's read tags). Trade-offs: OPC UA
  user/password auth is **not** stored yet (v1 is anonymous, matching the sim/POC); credentialed
  servers are a later add. The active-connection singleton is enforced in the service
  (`clearActive()` then set) rather than a DB constraint.

### ADR-003: Super-admin sets credentials at creation (no email/invite flow yet)

- **Context:** Super-admins onboard managers/operators without an email/invite flow. An
  earlier iteration generated show-once credentials server-side; the team preferred the
  super-admin choosing the username/password directly.
- **Decision:** `POST /users` accepts `{ role, username, password }` (validated + bounded,
  username uniqueness enforced), stores only the bcrypt hash, and returns the user (never a
  password). The Users UI is split into Create / Managers / Operators subtabs. Lost
  passwords are reset (rotate), never recovered.
- **Consequences:** Simple onboarding with no email dependency and no one-time-secret UI to
  babysit. The super-admin is responsible for choosing/communicating strong passwords.
  Future work: invite links / forced first-login reset.
