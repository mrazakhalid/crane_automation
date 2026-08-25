# Architecture — PLC / OPC UA connectivity

**What this doc is:** the end-to-end map of *how this software talks to a PLC* and every part
attached to that process — the browser UI, the Express API, the OPC UA client, security/PKI,
validation, auth/RBAC, rate limiting, config, and the OpenPLC server on the other end.

- For **why** OPC UA (and why it's generic) see [`architecture.md` ADR-006](./architecture.md) and
  [`concepts/plc-opcua.md`](./concepts/plc-opcua.md).
- For **request-trace snippets** and the running change ledger see
  [`software-flow.md`](./software-flow.md).
- For **OPC UA vocabulary** (NodeId, namespace, security modes) see
  [`concepts/opcua-explained.md`](./concepts/opcua-explained.md) /
  [`concepts/opcua-quickstart.md`](./concepts/opcua-quickstart.md).

---

## 1. The big picture

The app is an OPC UA **client**. It never embeds a PLC protocol stack of its own — it opens a
session to whatever OPC UA **server** the operator points it at (OpenPLC v4 for the POC, a Siemens
S7-1500 later) and reads/writes **NodeIds**. Everything server-specific (endpoint, NodeIds,
security) is chosen at runtime; the code is protocol-generic.

```
┌───────────────────────────── OUR SOFTWARE ─────────────────────────────┐        ┌──────────── THE PLC ────────────┐
│                                                                         │        │                                 │
│  Browser (React 19 + Vite)          Express 5 API (backend/src)         │        │  OpenPLC v4 runtime             │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │        │  ┌───────────────────────────┐  │
│  │ PlcPage               │          │ routes → controller → service │  │        │  │ OPC UA server plugin      │  │
│  │  ├ PlcConnectionPanel │  HTTPS   │        ↓                      │  │ opc.tcp│  │  (binds :4840)            │  │
│  │  ├ PlcWatchTable  ────┼─(JWT)────┼─▶ plc.service ─▶ opcua-client │──┼────────┼─▶│   ↕ opcua.json mapping     │  │
│  │  └ PlcCommandForm     │  /api/plc│        │        (node-opcua)  │  │ :4840  │  │  ┌───────────────────────┐│  │
│  │      ↑ usePlc (1s poll)│         │        ▼                      │  │secure  │  │  │ PLC memory / tags     ││  │
│  └───────────────────────┘          │   opcua-security ─▶ pki/      │  │channel │  │  │ (compiled .st program)││  │
│         axios (api/plc.ts)          └───────────────────────────────┘  │        │  │  └───────────────────────┘│  │
│                                                                         │        │  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘        └─────────────────────────────────┘
        FRONTEND                             BACKEND                                        EXTERNAL (config, not code)
```

**The only things that change to point at a different PLC** are three runtime values — the
**endpoint**, the **NodeIds**, and the **security mode/policy**. No code change. See the swap
table in [`concepts/plc-opcua.md`](./concepts/plc-opcua.md).

---

## 2. The three tiers

| Tier | Lives in | Owns | Ignorant of |
| --- | --- | --- | --- |
| **Frontend** | `frontend/src/{pages,components,hooks,api}` | UI, 1 s polling, optimistic toasts, UX-only validation | how OPC UA works |
| **Backend** | `backend/src/{routes,controllers,services,schemas,middleware,config}` | auth, validation (source of truth), business logic, the OPC UA session, security/PKI | which physical PLC |
| **PLC (external)** | OpenPLC v4 install + `scripts/plc/` | the OPC UA server, the address space (`opcua.json`), PLC memory | our app entirely |

**Rule:** HTTP concerns never leak below the controller; OPC UA concerns never leak above
`plc.service`. `opcua-client.ts` knows nothing about the server on the other end.

---

## 3. Backend components attached to the process

### 3.1 The OPC UA client — `services/plc/`

| File | Role | Key exports |
| --- | --- | --- |
| `opcua-client.ts` | Single connection/session manager (protocol only, `node-opcua`) | `connect` · `disconnect` · `readValue` · `writeValue` · `getConnectionStatus` |
| `opcua-security.ts` | Maps security mode/policy → `node-opcua` options; owns the PKI store | `securityOptions` · certificate-manager init |
| `plc.service.ts` | Business logic; turns low-level failures into typed, actionable HTTP errors; exposes env defaults for UI pre-fill | `connectPlc` · `disconnectPlc` · `readNode` · `sendCommand` · `getPlcState` |

- **One client, one session** held in module state — lifecycle
  `disconnected → connecting → connected / error`.
- `readValue` → `session.read({ nodeId, attributeId: Value })`, flattened to a JSON-safe
  `{ value, dataType, statusCode, serverTimestamp }`.
- `writeValue` → `session.write(...)`, coercing the value against the requested `DataType`.
- `sendCommand` **writes then reads the same node back** so the UI can show a confirmed value.

### 3.2 The HTTP surface — routes → controller → schema

`routes/plc.routes.ts` wires five endpoints through a middleware stack, then into
`controllers/plc.controller.ts`, which is the only layer that touches `req`/`res`.

| Method · Route | Auth | Role | Body/Query schema | Purpose |
| --- | --- | --- | --- | --- |
| `GET /api/plc/state` | ✅ | any | — | connection status + env defaults (UI pre-fill) |
| `GET /api/plc/read?nodeId=…` | ✅ | any | `readQuerySchema` | read one node (PLC → SW) |
| `POST /api/plc/connect` | ✅ | **super_admin** | `connectSchema` | open a session (endpoint + optional mode/policy) |
| `POST /api/plc/disconnect` | ✅ | **super_admin** | — | close the session |
| `POST /api/plc/command` | ✅ | **super_admin** | `commandSchema` | write a value, return the read-back (SW → PLC) |

**Read/status need only auth; every mutating action is super-admin-only** (no IDOR into PLC
control).

### 3.3 Everything else attached to a request

- **`middleware/auth.ts`** — `requireAuth` verifies the JWT bearer → `req.user`; `requireRole('super_admin')` gates the mutating routes.
- **`middleware/validate.ts` + `schemas/plc.schema.ts`** — Zod is the **source of truth**. Bounds enforced: NodeId `^ns=\d+;[isgb]=.+$`, endpoint `^opc\.tcp://…`, `writeDataType` enum (`Boolean/Int16/UInt16/Int32/Float/Double`), `securityMode`/`securityPolicy` enums, unknown keys rejected.
- **`middleware/rate-limit.ts`** — a generous global limiter that **skips the 1 s poll paths** (`/api/plc/read`, `/api/plc/state`) so the live UI can't 429 itself, plus a strict login limiter. (See the rate-limit gotcha in `CLAUDE.md`.)
- **`config/env.ts`** — Zod-validated at boot; supplies the OPC UA defaults below.

### 3.4 Config — the swap points

| Env var | Default | Meaning |
| --- | --- | --- |
| `OPCUA_ENDPOINT` | `opc.tcp://localhost:4840` | server URL (UI pre-fill; overridable per connect) |
| `OPCUA_READ_NODE` | `ns=1;s=ReadVar` | default read NodeId (watch-table seed) |
| `OPCUA_WRITE_NODE` | `ns=1;s=WriteVar` | default write NodeId (command-form seed) |
| `OPCUA_SECURITY_MODE` | `None` | `None` / `Sign` / `SignAndEncrypt` fallback |
| `OPCUA_SECURITY_POLICY` | `None` | e.g. `Basic256Sha256` fallback |
| `OPCUA_PKI_DIR` | `pki/` | persistent certificate store (gitignored) |

Per-connect values from the UI dropdowns **override** the env fallback. None of these live in code.

---

## 4. Frontend components attached to the process

```
PlcPage.tsx
 ├─ PlcConnectionPanel.tsx   endpoint field · Security + Policy dropdowns · status pill · Connect/Disconnect
 ├─ PlcWatchTable.tsx        editable multi-tag table; rows persisted in localStorage['crane.plc.watch']
 └─ PlcCommandForm.tsx       NodeId · DataType select · Value (toggle for Boolean, numeric else)
        ▲
   usePlc.ts   connection state + watch list; runs the 1 s poll while connected
        ▲
   api/plc.ts  typed axios wrappers → getState / connect / disconnect / readNode / sendCommand
   schemas/plc.ts (UX-only mirror of the backend Zod)   types/plc.ts (shared shapes)
```

- **Live polling:** while connected, `usePlc` runs a `setInterval(1s)` that reads **all watched
  NodeIds** in parallel (`Promise.all`) and updates the table. That path is the one the rate
  limiter deliberately skips.
- **Frontend validation is UX-only** — the backend re-validates everything. The Security dropdown
  drives the connect payload so the same UI reaches OpenPLC (`None`) or an S7-1500
  (`SignAndEncrypt` / `Basic256Sha256`) with no code change.

The PLC nav item + route are **super-admin gated**.

---

## 5. Security & PKI attached to the process

Security is entirely config. `opcua-security.ts` translates the requested mode/policy:

- **`None`** → no certificate; the session opens plain. (OpenPLC POC default.)
- **`Sign` / `SignAndEncrypt`** → lazily initialize a persistent certificate manager rooted at
  `OPCUA_PKI_DIR`, presenting our client cert.

```
pki/                                  (gitignored; created on first secured connect)
 ├─ own/
 │   ├─ certs/client_certificate.pem  ← OUR cert — must be trusted on the PLC
 │   └─ private/private_key.pem       ← OUR private key
 ├─ trusted/                          ← server certs we trust (trust-on-first-use)
 └─ rejected/                         ← server certs seen but not yet trusted
```

**A real PLC advertises no `None` endpoint.** Connecting to a secured server is a one-time
PLC-side handshake — move our cert from the PLC's *rejected* → *trusted* store, and fix the PLC
clock (OPC UA validates cert validity against the *server* clock). Full runbook + the exact error
strings: [`concepts/plc-opcua.md`](./concepts/plc-opcua.md) "secured endpoint" section.

---

## 6. The PLC side attached to the process

The OPC UA server is **OpenPLC v4** (Autonomy Logic) — native OPC UA, plugin-based, headless here.
The legacy `openplc.com` msys64 runtime is Modbus-only and does **not** apply.

| File on the OpenPLC install | Role |
| --- | --- |
| `plugins.conf` | flips the `opcua` plugin on (3rd field `0→1`). **Reset to `0` on every shutdown.** |
| `core/generated/debug.c` (`debug_vars[]`) | authoritative variable **index** order (FB internals first, located tags last) |
| `…/plugins/python/opcua/opcua.json` | maps each OPC UA NodeId `ns=2;i=<index>` → a `debug.c` index |

**Helper scripts** (never hand-edit those files):

| Script | When |
| --- | --- |
| `scripts/plc/start-openplc.ps1` | everyday start — re-enable the plugin, keep the mapping, wait for `:4840` |
| `scripts/plc/restart-openplc.ps1` | after a **program change** — stop → re-map `opcua.json` from `debug.c` → re-enable → restart → print NodeIds |
| `scripts/plc/sync-opcua-mapping.mjs` | the mapping worker `restart-openplc.ps1` calls |

Only **one** OPC UA server can bind `:4840` at a time (`EADDRINUSE` otherwise).

---

## 7. Full request flows

Concrete example uses the live **Cycle Ledger** program: `ns=2;i=1` = `cycle_count` (read),
`ns=2;i=4` = `run` (write). (See `software-flow.md` build log for how these NodeIds were mapped.)

### 7.1 Read (PLC → software), once per second

```
PlcWatchTable row (ns=2;i=1)
 → usePlc 1 s poll → api/plc.ts readNode("ns=2;i=1")     GET /api/plc/read?nodeId=ns=2;i=1
   → rate-limit (SKIPS this poll path) → requireAuth → validate(readQuerySchema)
     → plc.controller.getRead → plc.service.readNode
       → opcua-client.readValue → node-opcua session.read({nodeId, attributeId: Value})
         → [secure channel] → OpenPLC OPC UA server → opcua.json → debug.c index → PLC memory
 ← { value: 4, dataType: "Int16", statusCode: "Good", serverTimestamp } → table cell updates
```

### 7.2 Command (software → PLC), write-then-read-back

```
PlcCommandForm (ns=2;i=4, Boolean, true)
 → usePlc.write → api/plc.ts sendCommand                 POST /api/plc/command
   → rate-limit → requireAuth → requireRole(super_admin) → validate(commandSchema)
     → plc.controller.postCommand → plc.service.sendCommand
       → opcua-client.writeValue (session.write)   THEN   readValue (read-back confirm)
         → OpenPLC updates PLC memory at the mapped index
 ← read-back { value: true, … } → toast "Sent ns=2;i=4 = true (read-back true)"
```

### 7.3 Connect (with security negotiation)

```
PlcConnectionPanel (endpoint + Security mode + Policy)
 → usePlc.connect → api/plc.ts connect                   POST /api/plc/connect
   → rate-limit → requireAuth → requireRole(super_admin) → validate(connectSchema)
     → plc.controller.postConnect → plc.service.connectPlc
       (mode/policy from request, else env OPCUA_SECURITY_*)
       → opcua-security.securityOptions(mode, policy)
           None → no cert;  secured → init PKI, present pki/own/certs/client_certificate.pem
       → node-opcua OPCUAClient.create → client.connect → createSession (Anonymous)
           secured + untrusted cert → OpenSecureChannel fails → typed error
             "move cert to the PLC's trusted store + check PLC clock" (see §5)
 ← { connection: { state, endpoint, security, lastError } } → status pill; poll loop starts
```

---

## 8. Where each concern lives (quick index)

| Concern | Frontend | Backend |
| --- | --- | --- |
| Endpoint / NodeIds / security choice | `PlcConnectionPanel`, `PlcWatchTable`, `PlcCommandForm` | `config/env.ts` defaults + per-request override |
| Validation | `schemas/plc.ts` (UX) | `schemas/plc.schema.ts` (**truth**) + `middleware/validate.ts` |
| Auth / RBAC | route gate + token in axios | `middleware/auth.ts` (`requireAuth`, `requireRole`) |
| Abuse control | — | `middleware/rate-limit.ts` (skips poll paths) |
| OPC UA session | — | `services/plc/opcua-client.ts` |
| Security / certificates | dropdown + hint | `services/plc/opcua-security.ts` + `pki/` |
| Error → operator message | toasts | `services/plc/plc.service.ts` (typed `HttpError`) |
| The server itself | — | external: OpenPLC v4 + `scripts/plc/*` |

---

## 9. Related decisions & docs

- **ADR-006** (generic OPC UA client) — [`architecture.md`](./architecture.md).
- **Concept** (why OPC UA, swap table, runbooks) — [`concepts/plc-opcua.md`](./concepts/plc-opcua.md).
- **Vocabulary** — [`concepts/opcua-explained.md`](./concepts/opcua-explained.md), [`concepts/opcua-quickstart.md`](./concepts/opcua-quickstart.md).
- **OpenPLC server bring-up** — [`openplc_opcua/enable-opcua-plugin.md`](./openplc_opcua/enable-opcua-plugin.md), [`openplc_opcua/plc-opcua-openplc-setup.md`](./openplc_opcua/plc-opcua-openplc-setup.md).
- **Hands-on build** — [`projects/project-01-cycle-ledger-opcua.md`](./projects/project-01-cycle-ledger-opcua.md).
- **Request traces + change ledger** — [`software-flow.md`](./software-flow.md).
