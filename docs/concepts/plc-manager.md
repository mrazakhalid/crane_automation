# PLC Manager — OPC UA config lives in the app, not in code

**Why this exists.** We talk to a PLC over OPC UA (see [`plc-opcua.md`](./plc-opcua.md)). Early on,
the endpoint and NodeIds came from the backend `.env` file and were typed by hand on the PLC page.
That works for one developer and one PLC, but it means **editing a file and redeploying to add or
switch a PLC** — wrong for a plant with a fleet of Siemens controllers. The PLC Manager fixes that:
**a super-admin manages every PLC and every tag in the UI; nothing about a PLC is in code or
`.env`.** (Decision record: ADR-007 in `architecture.md`.)

## The two things you manage

1. **Connections** — one per PLC/server:
   - `name` (friendly), `endpoint` (`opc.tcp://host:port`), `securityMode` + `securityPolicy`.
   - `lineId` + `cranes[]` — **which plant line this PLC serves and which of that line's cranes
     it controls** (see "Crane binding" below).
   - Exactly **one is Active**. The app auto-connects to the Active one at boot, and you can switch
     which is active with one click. (The Active flag is the legacy single-PLC default; the engine
     is now a *pool* that can hold many live sessions — one per PLC — see [`plc-opcua.md`](./plc-opcua.md).)

### Crane binding — how a PLC maps to a line's tanks

The physical hierarchy in the plant is **PLC → crane(s) → tanks** (fixed layout; see
[`../plc/plant-panel-layout.md`](../plc/plant-panel-layout.md)). A single PLC panel controls 1–3
cranes, and each crane owns a fixed group of tanks. Crucially, **a line can be served by more than
one PLC** — real example: Line 4's cranes are split across PLC_4 (cranes 6 + 7A) and PLC_6 (crane
7B). So the assignment unit is the **crane**, not the line:

- A connection carries `lineId` + `cranes[]` (e.g. `["6","7A"]`, a subset of that line's cranes).
- **A crane maps to exactly one PLC within its line** — assigning a crane already owned by another
  connection on the same line is a 409.
- **Tank → PLC is derived, never entered by hand:** `tank.crane` → the connection on that line whose
  `cranes[]` contains it. Layout is fixed, so this is stable. (Batch/crane routing by PLC lands in a
  later phase.)
- Deleting a line **unassigns** (does not delete) its PLCs: `lineId` → null, `cranes` → `[]`.
- Rules enforced in `plc-config.service.ts` `resolveAssignment()`: cranes require a line; cranes must
  be members of the line; no cross-PLC crane double-claim.
2. **Tag mappings** — belong to a connection:
   - a friendly `label` (e.g. `cycle_count`) → the raw `nodeId` (e.g. `ns=3;s="PlcData"."run"`),
     plus its `dataType` and `direction` (**read** = monitor PLC→software, **write** = command
     software→PLC). Labels are unique per connection.

Operators then work with **labels**, never raw NodeIds. The PLC page's live-read table seeds
itself from the Active connection's read tags.

## How a value flows (unchanged engine, new source of truth)

```
PLC Manager (DB)                     PLC page / API
  plc_connections.isActive ──┐
  plc_tags (labels→NodeIds) ─┤
                             ▼
  boot: auto-connect active   GET /api/plc/state → { connection, defaults, active, tags }
  the generic OPC UA client (services/plc/, node-opcua) reads/writes those NodeIds
```

`.env` is now only a **seed + fallback**: on first boot, if no connections exist, we create one
Active connection (and monitor/command tags) from the old `OPCUA_*` values so the running setup
keeps working. After that, everything is edited in the UI.

## Where the code lives

- **Backend:** `models/plc-connection.model.ts` + `plc-tag.model.ts`; stores in
  `storage/mongo/*` **and** `storage/sqlite/*` (both drivers, per ADR-005); `repositories/plc-*`;
  `schemas/plc-config.schema.ts` (Zod, bounded, strict); `services/plc-config.service.ts` (CRUD +
  `seedConnectionFromEnv`); `services/plc/plc.service.ts` (`getPlcState` + `autoConnectActivePlc`);
  routes `routes/plc-config.routes.ts` under `/api/plc-connections` (all super-admin).
- **Frontend:** `pages/PlcManagerPage.tsx` (Connections list + New/Edit modal + Tags panel),
  `components/ConnectionForm|ConnectionList|TagsPanel`, `hooks/usePlcConnections|usePlcTags`,
  `api/plc-connections.ts`, `types/plc-config.ts`, `schemas/plc-config.ts`; sidebar item + route
  `"/plc-manager"`.

## Endpoints (all super-admin)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/plc-connections/status` | live pool status for every connection (per-row chips) |
| POST | `/api/plc-connections/:id/connect` \| `/disconnect` | open / close a live session to one PLC |
| GET/POST | `/api/plc-connections` | list (optional `?lineId=` filter) / create a connection |
| PATCH/DELETE | `/api/plc-connections/:id` | edit / delete (delete cascades its tags) |
| POST | `/api/plc-connections/:id/activate` | make it the Active connection |
| GET/POST | `/api/plc-connections/:id/tags` | list / add a tag mapping |
| PATCH/DELETE | `/api/plc-connections/:id/tags/:tagId` | edit / delete a tag |

## Not yet (deliberate)

- **OPC UA user/password auth** isn't stored — v1 connects **anonymously** (matches the sim + the
  POC's guest access). Credentialed servers are a later add (secrets handling to design first).
- The single-Active rule is enforced in the service, not a DB constraint.

## Adding the real S7-1200 later

No code change: in PLC Manager, **add a connection** with the 1200's endpoint + security, **add its
tags**, and **Activate** it. See the sim bring-up (with the S7-1200 hardware notes) in
[`../tia_opcua/tia-plcsim-opcua-setup.md`](../tia_opcua/tia-plcsim-opcua-setup.md).
