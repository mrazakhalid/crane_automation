# PLC_6 (Line 4) — TIA Portal build steps (click-through) — SINGLE CRANE

**One operator, one sitting.** This is the **second PLC of Line 4** (line 4 = PLC_4 cranes 6/7A **+**
this PLC's crane 7B). Single crane, so the shortest of the six. Deep reference:
`../_shared/blocks.md`, `docs/line4/instructions.md`.

## At a glance

| | |
|---|---|
| **Line** | line4 (this PLC hosts only crane 7B) |
| **Crane** | **7B** (downstream, fed by transfer TRVL-4B) |
| **Endpoint** | `opc.tcp://192.168.0.116:4840` |
| **OPC UA namespace** | `3` |
| **CPU** | `6ES7511-1AK02` (S7-1500) |
| **Data DB to create** | `Crane7BData` |
| **Sequencer FB to create** | `Crane7B_Seq` |
| **IOMap** | `./IOMap.scl` |
| **OB1 order** | `IOMap` → `Crane7B_Seq` (`./OB1.md`) |

> **Reuse reality check.** Save-as of Line 4 + changing IP/cert gives a second *Line 4*, not PLC_6.
> The **FC/FB logic is reused unchanged**; the **DB** and **IOMap** are PLC-specific and must be
> created. IP + certs are Step 8 only.

---

## Step 0 — Prerequisites

TIA V18 (+ PLCSIM Advanced V5.0 to sim). Global library `CraneAutomation_Lib` with `typeTask`,
`TravelTo`, `CraneSequencer` (or create by hand from `../_shared/blocks.md`).

## Step 1 — Device + network + OPC UA server

1. Add CPU **`6ES7511-1AK02`**.
2. **Ethernet:** IP **`192.168.0.116`**, mask `255.255.255.0`.
3. **OPC UA → Server → Activate** → `opc.tcp://192.168.0.116:4840`.
4. **Add the exact I/O modules from Panel_6** — PLC_6 drives **one crane (7B)**, so **one** each:
   `DI 32x24VDC HF` = `6ES7521-1BL00-0AB0` (→ `%I0–%I3`) and `DQ 32x24VDC/0.5A HF` =
   `6ES7522-1BL01-0AB0` (→ `%Q0–%Q3`). Confirm the start byte **0** covers the `./IOMap.scl` `%I`/`%Q`.

## Step 2 — Bring in the shared blocks (once)

Drag `typeTask`, `TravelTo`, `CraneSequencer` from the library. **Never edit them.** Compile
`typeTask` first.

## Step 3 — Create the data DB (copy + rename) — one crane, one DB

| Create DB | For crane |
|---|---|
| `Crane7BData` | 7B |

Global DB, **Optimized ON**, rows per `../_shared/blocks.md §2`, tick ***Accessible* + *Writable from
HMI/OPC UA*** on `task_count`, `cmd_send`, `tasks[].station`, `tasks[].dwell_s`. Compile.

## Step 4 — Create the sequencer FB (copy + ONE find/replace)

| Copy `CraneSequencer` → rename | Find/replace inside it |
|---|---|
| `Crane7B_Seq` | `Line4Data` → `Crane7BData` |

DB rename is the **only** edit. Compile.

## Step 5 — Create the `IOMap` FC (real wiring)

1. **Add new block → Function (FC)**, SCL, **Return Void**, name **`IOMap`**.
2. Paste **`./IOMap.scl`**; confirm `%I`/`%Q` match your modules.
3. **Travel direction (already wired in the file):** West = forward = right (`R-West ← mv_fwd`),
   East = reverse = left (`R-East ← mv_rev`). The crane advances to higher stations by moving West.

**Open wiring TODOs for PLC_6 (mostly TODO — the panel extract for 7B lists only
control/hoist/pendant/motor tags).** Fill from the real drawings before running on hardware; on the
sim, drive every one of these from a watch table:
- `ls_at[0]` **Parking** — no PRK switch in the extract.
- `ls_at[1]` **Loading** — transfer pickup, likely the **TRVL-4B** switch (crane 7A/6 fill it).
- `ls_at[8]` `1-4C` (st 8) · `ls_at[9]` `1-5` (st 9) · `ls_at[10]` `1-6` (st 10) · `ls_at[11]`
  `TRVL-4B` (st 11).

Hoist (`I0.3/0.4/0.5`), pendant (`I2.1`), and motors (`Q0.4–0.7`, `Q1.0/1.1`) are already wired.

## Step 6 — Wire OB1

**Main [OB1]** (LAD): `IOMap` (Net 1) → `Crane7B_Seq` (inst `Crane7B_Seq_DB`). Single crane. Detail:
`./OB1.md`.

## Step 7 — Compile, download, RUN

1. PLCSIM only: project → Properties → Protection → **"Support simulation during block compilation"**.
2. **Compile → Software (rebuild all)** → 0 errors.
3. **Download** (fresh DB → "Delete and replace system data"). CPU → **RUN**.

## Step 8 — Real PLC only: IP, security, cert, clock

1. IP already `192.168.0.116`.
2. Set `securityMode`/`securityPolicy` on the PLC_6 connection to match the secured endpoint.
3. Move our client cert to the PLC's **trusted** store.
4. **Fix the PLC clock.** Root `CLAUDE.md` + `docs/tia_opcua/`.

## Step 9 — Sim verification

Per `docs/line4/monitoring-watch-table.md` on `Crane7BData`: seed a 1-task batch, set
`ls_at[0]`/`ls_up` TRUE, pulse `cmd_send`, walk switches 10→…→90, clear `cmd_send`. (Because 7B's
`ls_at[]` are TODO on hardware, you *must* drive them from the watch table on the sim.)

## App / PLC-Manager wiring (NodeIds)

Namespace **3**. Bind PLC_6 → line4 crane 7B, endpoint above.
```
ns=3;s="Crane7BData"."tasks"[0]."station"   Int   write   (OPC UA [0] = S7 tasks[1])
ns=3;s="Crane7BData"."tasks"[0]."dwell_s"   Int   write
ns=3;s="Crane7BData"."task_count"           Int   write
ns=3;s="Crane7BData"."cmd_send"             Bool  write
ns=3;s="Crane7BData"."sts_busy" / "sts_done" / "sts_step"   read
ns=3;s="Crane7BData"."tasks"[0]."status"    Int   read
```
Array bracket **outside** quotes, **0-based**; browse on `BadNodeIdUnknown`.

## Done when…

- [ ] `typeTask` + `Crane7BData` compile; *Writable* set on app-written rows.
- [ ] `TravelTo` + `Crane7B_Seq` compile; only edit was the DB rename.
- [ ] `IOMap` compiles; 7B TODOs (parking, loading, per-tank) filled or noted as sim-driven.
- [ ] OB1: `IOMap` → `Crane7B_Seq`; rebuild-all = 0 errors; CPU RUN.
- [ ] Sim reaches 90 and back to 0; NodeIds verified.
- [ ] Real PLC: security + cert + clock done; project saved as `PLC_6`.
