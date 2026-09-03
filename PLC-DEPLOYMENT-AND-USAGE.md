# Crane Automation — PLC deployment & usage runbook

How the software and the plant's PLCs work together, end to end: prepare the app → load each PLC's
code into the right PLC → connect the PLCs in the app → run a recipe. Read top to bottom the first
time; after that, the tables are the quick reference.

> **Detailed references** (this doc points to them, doesn't duplicate):
> `plc/README.md` + `plc/_shared/blocks.md` (the blocks), `plc/PLC_*/README.md` (per-PLC wiring),
> `docs/concepts/plc-per-crane.md` (the why), `docs/line4/instructions.md` +
> `docs/line4/monitoring-watch-table.md` (the proven build + sim drive),
> `docs/tia_opcua/…` (Siemens bring-up + security), `docs/plc/plant-panel-layout.md` (the I/O map).

---

## 0. The big picture

```
Manager (browser)                          Super-admin (browser)
  Process page: scan QR recipe               PLC Manager: define + connect PLCs
        │  divide across all lines                 │  (OPC UA endpoints, line+crane bindings)
        ▼                                           ▼
   Backend (Express)  ── OPC UA client (node-opcua) ──►  6 × S7-1500 PLCs
   per-crane batch: writes Crane<ID>Data.tasks[]                 │
   reads sts_busy / sts_done / sts_step                          ▼
                                                    each crane runs its own copy of the
                                                    CraneSequencer FB  →  motors / limit switches
```

- **One PLC drives 1–3 cranes.** Each crane runs an **independent** program against its **own data
  block** `Crane<ID>Data`, so cranes on the same PLC run in parallel.
- **The app is a generic OPC UA client.** Which PLC/endpoint/cranes are used is **configuration**
  (PLC Manager + the seed script), never code.

### Which PLC code folder goes into which PLC

| PLC folder (in the repo) | Physical PLC | Line | Cranes | OPC UA endpoint |
|---|---|---|---|---|
| `plc/PLC_1_line1/` | PLC_1 | line1 | 1A, 1B | `opc.tcp://192.168.0.111:4840` |
| `plc/PLC_2_line2/` | PLC_2 | line2 | 2, 3 | `opc.tcp://192.168.0.112:4840` |
| `plc/PLC_3_line3/` | PLC_3 | line3 | 4, 5 | `opc.tcp://192.168.0.113:4840` |
| `plc/PLC_4_line4/` | PLC_4 | line4 | 6, 7A | `opc.tcp://192.168.0.114:4840` |
| `plc/PLC_5_line5/` | PLC_5 | line5 | 8, 9 | `opc.tcp://192.168.0.115:4840` |
| `plc/PLC_6_line4/` | PLC_6 | line4 | 7B | `opc.tcp://192.168.0.116:4840` |

*(Line 4 spans two PLCs. Which NIC — `.11x` vs `.21x` — runs the OPC UA server is per-PLC; confirm
on site.)*

---

## 1. Prepare the app (once)

1. **Database** — the backend uses MongoDB (default) or SQLite. Copy `backend/.env.example` →
   `backend/.env` and set `MONGODB_URI`/`MONGODB_DB` (or `STORAGE_DRIVER=sqlite`). Secrets stay in
   `.env` (gitignored) — never in code.
2. **Install + run**
   ```
   cd backend  && npm install && npm run dev      # API on http://localhost:4000
   cd frontend && npm install && npm run dev       # UI  on http://localhost:5173
   ```
3. **Seed the plant layout** (from the backend dir):
   ```
   npx tsx scripts/seed-lines.ts     # the 5 lines (cranes + ordered tanks) from lines-seed.json
   npx tsx scripts/seed-plcs.ts      # the 6 PLC connections, each bound to its line + cranes
   ```
   These give you the lines and the six PLC_1…PLC_6 connections already bound to the right
   cranes/endpoints. (You can also do this by hand in **Lines** and **PLC Manager**.)
4. **Sign in** — a super-admin `admin / admin` is seeded on first boot (change the password).
   Create **manager** accounts in **Users** (managers run recipes; super-admins manage
   lines/PLCs/connections).

---

## 2. Load the PLC code into each PLC (TIA Portal)

Do this **once per PLC**, using that PLC's folder. Same steps on the **PLCSIM Advanced sim** or the
**real S7-1500** — the code is identical (that's the point). Start with **PLC_4** (it matches the
sim you already run), verify, then repeat for the others.

For **PLC_N** (e.g. `plc/PLC_4_line4/`):

1. **Shared blocks** (`plc/_shared/blocks.md`) — create once in the project:
   - UDT **`typeTask`** (the task-row type).
   - FC **`TravelTo`** (SCL, the direction picker).
2. **Per crane on this PLC** (e.g. 6 and 7A — do it twice):
   - **Data block** — copy the `Crane<ID>Data` layout → name it `Crane6Data` / `Crane7AData`.
     Optimized access ON. Tick **Accessible + Writable from HMI/OPC UA** on the app-written rows
     (`task_count`, `cmd_send`, `tasks[].station`/`.dwell_s`).
   - **Function block** — copy the `CraneSequencer` FB → name it `Crane6_Seq` / `Crane7A_Seq`,
     paste the body, then **find/replace `Line4Data` → `Crane6Data`** (resp. `Crane7AData`).
     *(This is the whole "one program per crane" — only the DB name changes.)*
3. **`IOMap` FC** — add a Function (SCL, return **Void**, no params) named `IOMap`; paste that
   folder's **`IOMap.scl`**. This is the **real wiring**: it copies physical `%I` → the DB mirror
   and the DB mirror → physical `%Q`, using the panel-drawing addresses. Make the `%I`/`%Q`
   addresses match the PLC's I/O module config.
4. **OB1** — per that folder's `OB1.md`: Network 1 calls `IOMap`, then one network per crane calls
   its `Crane<ID>_Seq` FB (accept the instance-DB prompt). All cranes run every scan, in parallel.
5. **Compile → download → RUN.** (Sim: enable *Support simulation during block compilation* first;
   download hardware+software; set the CPU to RUN — `:4840` only opens in RUN.)

> **Fill the TODOs first for cranes 7A, 7B (and downstream loading on 2/4/8/1B).** The panel extract
> was incomplete for those — each missing address is a clear `TODO %I?.?` in that folder's
> `IOMap.scl`, tagged with the exact tank/station. Fill from the real drawings, or (on the sim)
> drive those `ls_at[]` bits from a watch table. Fully-wired cranes: 6, 3, 5, 9, 1A.

---

## 3. Connect each PLC in the app (PLC Manager, super-admin)

If you ran `seed-plcs.ts` the six connections already exist. Otherwise, in **PLC Manager** → **Add
connection** for each PLC:

1. **Name** `PLC_N`, **Endpoint** `opc.tcp://192.168.0.11N:4840`.
2. **Security** — *sim*: `None`/`None`. *Real S7-1500*: it advertises **only secured** endpoints —
   pick the mode/policy it offers (e.g. `SignAndEncrypt` / `Basic256Sha256`). See §5.
3. **Bind** the connection to its **line** and tick the **cranes** it controls (PLC_4 → line4,
   cranes 6 & 7A). This is what routes each crane's tasks to the right PLC + DB.
4. **Connect** (and optionally **Activate** the one used by the legacy PLC page). A green status =
   the OPC UA session is open. The app also auto-connects line-bound PLCs at boot.

**Networking:** the PC running the backend must reach `192.168.0.11x` (same subnet / routed). On
the sim, that's the PLCSIM Advanced virtual Ethernet adapter (see `docs/tia_opcua/…`).

---

## 4. Run a recipe (manager)

1. Sign in as **manager** → **Process** (or the Dashboard — same tool). Managers don't manage PLCs;
   they run jobs.
2. **Upload / paste / pick a recipe** — a QR image, `1-1A=60;5-2=30;4-7=15;…` text, or a saved
   recipe from the dropdown. A recipe may span **several lines**.
3. **Divide tasks** — the summary shows, per **PLC → crane**, exactly which tasks each crane gets
   (auto-detected: tank → line → crane → PLC). Resolve any flags: **ambiguous** (pick the line),
   **missing** (not on any line), **no PLC** (bind the crane in PLC Manager).
4. **Run:**
   - **Now (simulation):** **Start process** walks the plan by dwell time — each task goes idle →
     in-progress → done, cranes in parallel — so you can rehearse the whole job without a PLC.
   - **On real/sim PLCs (per-crane send):** the backend writes each crane's `Crane<ID>Data.tasks[]`
     + `task_count`, then arms `cmd_send`; each crane's sequencer runs and raises `sts_busy` →
     `sts_done`; the app polls `sts_done` and clears `cmd_send` to acknowledge.
     *(The real "Send to PLC" path is `POST /api/plc/send-batch` + per-crane
     `GET /api/plc/batch-status?connectionId=…&crane=…`. Backend is per-crane and ready; wiring
     the Process **Start** button to it instead of the simulation is the final integration step.)*

### The signal contract (per crane, OPC UA namespace 3, DB `Crane<ID>Data`)

| Direction | Tags | Example NodeId |
|---|---|---|
| app → PLC | `tasks[i].station`, `tasks[i].dwell_s`, `task_count`, `cmd_send` | `ns=3;s="Crane6Data"."tasks"[0]."station"` |
| PLC → app | `sts_busy`, `sts_done`, `sts_step`, `sts_state`, `tasks[i].status` | `ns=3;s="Crane6Data"."sts_busy"` |

`station = tank.number + 1` (0 = Parking, 1 = Loading). OPC UA array index is 0-based:
app `tasks[1]` → NodeId `"tasks"[0]`.

---

## 5. Before connecting a REAL S7-1500 (one-time, per PLC)

A real PLC won't accept a `None` endpoint and validates our certificate against its own clock:

1. **Endpoint security** — set the connection's `securityMode`/`securityPolicy` to one the PLC
   advertises (not `None`).
2. **Trust our client cert** — on the PLC, move `pki/own/certs/client_certificate.pem` from
   *rejected* to *trusted*.
3. **Set the PLC clock** — a wrong CPU clock makes our cert look "not yet valid" and drops the
   channel. *Set time of day (from PG/PC)*.
4. If `:4840` is closed while `ping` works, the **OPC UA server didn't start** (often a stale cert
   from a wrong clock) — see `docs/tia_opcua/opcua-server-wont-start-econnrefused.md`.

Full runbooks: `docs/tia_opcua/tia-plcsim-opcua-setup.md` (sim) and the CLAUDE.md "Gotchas".

---

## 6. Verify on the sim (no real crane)

Per crane, follow `docs/line4/monitoring-watch-table.md`:
1. In TIA, watch `Crane6Data`. Seed a batch by hand: `tasks[1].station=12, dwell_s=6; task_count=1`.
2. Set `ls_at[0]=TRUE`, `ls_up=TRUE` (parked & raised). Pulse `cmd_send`.
3. Flip the `ls_at` / `ls_dip` / `ls_up` switches the state machine waits for → watch `sts_state`
   step 10 → … → 90, then clear `cmd_send` → back to 0. Repeat on `Crane7AData` — both advance in
   parallel from one OB1.
4. Then drive it from the **app** instead of by hand (Process → send) to prove the full loop.

---

## 7. Quick troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Task shows **"no PLC"** in the summary | The crane isn't bound to a PLC — PLC Manager → tick the crane on its connection. |
| Task shows **"missing"** | The tank isn't on any saved line — fix the recipe or the line layout. |
| Connect fails, `None … securityMode` error | Real PLC has no `None` endpoint — set a secured mode/policy (§5). |
| `ECONNREFUSED :4840` but `ping` works | OPC UA server not started (RUN + clock/cert) — `docs/tia_opcua/opcua-server-wont-start-econnrefused.md`. |
| `BadUserAccessDenied` on write | DB row missing **Writable from HMI/OPC UA** (step 2). |
| Sequencer stuck at state 10/50 | The target's `ls_at[station]` isn't set — check the `IOMap` address / fill a TODO / toggle on the sim. |
| Crane 7A/7B won't reach a tank | Its per-tank switches are `TODO` in `IOMap.scl` — fill from the drawings. |

---

## 8. Current status & the one remaining integration step

- ✅ App: cross-line recipe → per-crane split, PLC Manager bindings, per-crane batch send +
  busy/done signals (`backend/src/services/plc/batch.service.ts`).
- ✅ PLC: all 6 folders (`plc/`) — per-crane copies + real `%I`/`%Q` wiring; fully-wired cranes 6,
  3, 5, 9, 1A; the rest have clearly-marked `TODO` addresses to fill from the drawings.
- ⏭️ **Next:** wire the Process **Start** button to the real per-crane send (`sendBatch`) so a job
  drives the PLCs directly (today Start runs the simulation; the send path exists and is per-crane).
  Then: transfer-tank two-crane handoff timing, and safety interlocks (E-Stop/Auto gating) — both
  flagged in the PLC READMEs.
