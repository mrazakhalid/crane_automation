# PLC_2 (Line 2) — TIA Portal build steps (click-through)

**One operator, one sitting.** Follow top to bottom. Everything specific to this PLC is spelled out
here. Deep reference: `../_shared/blocks.md`, `docs/line4/instructions.md`.

## At a glance

| | |
|---|---|
| **Line** | line2 |
| **Cranes** | **2** (downstream, no LOAD bay) + **3** (entry, LOAD + TRVL-2A) |
| **Endpoint** | `opc.tcp://192.168.0.112:4840` |
| **OPC UA namespace** | `3` |
| **CPU** | `6ES7511-1AK02` (S7-1500) |
| **Data DBs to create** | `Crane2Data`, `Crane3Data` |
| **Sequencer FBs to create** | `Crane2_Seq`, `Crane3_Seq` |
| **IOMap** | `./IOMap.scl` |
| **OB1 order** | `IOMap` → `Crane2_Seq` → `Crane3_Seq` (`./OB1.md`) |

> **Reuse reality check.** Copying the Line 4 project and only changing IP + cert gives you a second
> *Line 4*, not PLC_2. The **logic (FC/FB) is 100% reused unchanged**, but the **per-crane DBs** and
> the **IOMap** are specific to this PLC and must be created (below). IP + certs are Step 8 only.

---

## Step 0 — Prerequisites

- TIA Portal V18. PLCSIM Advanced V5.0 if simming first.
- The global library `CraneAutomation_Lib` with master copies of `typeTask`, `TravelTo`,
  `CraneSequencer`. No library yet? Open `CraneSim.ap18` (repo root — already has all three) and
  library-ize them, or create them by hand from `../_shared/blocks.md`.

## Step 1 — Device + network + OPC UA server

1. New project (or add a device). Add CPU **`6ES7511-1AK02`**.
2. **Ethernet addresses:** IP **`192.168.0.112`**, mask `255.255.255.0`.
3. **OPC UA → Server:** tick **Activate OPC UA server** → `opc.tcp://192.168.0.112:4840`.
4. **Add the exact I/O modules from Panel_2** (`raza_docs/Panel_Drawings_081426 (1).xlsx`) — not the
   BA or 16-ch variants: **two** `DI 32x24VDC HF` = `6ES7521-1BL00-0AB0` (→ `%I0–%I3` crane 3, `%I4–%I7`
   crane 2) and one `DQ 32x24VDC/0.5A HF` = `6ES7522-1BL01-0AB0` (→ `%Q0–%Q3`). Confirm the module
   **start bytes = 0 / 4 / 0** so the ranges cover the `%I`/`%Q` in `./IOMap.scl`.

## Step 2 — Bring in the shared blocks (once)

Drag `typeTask` (→ PLC data types), `TravelTo` + `CraneSequencer` (→ Program blocks) from
`CraneAutomation_Lib`. **Never edit them.** Compile `typeTask` first.

## Step 3 — Create this PLC's two data DBs (copy + rename)

| Create DB | For crane |
|---|---|
| `Crane2Data` | 2 |
| `Crane3Data` | 3 |

For **each**: Global DB, **Optimized access ON**, rows per `../_shared/blocks.md §2`, then tick
***Accessible* + *Writable from HMI/OPC UA*** on `task_count`, `cmd_send`, `tasks[].station`,
`tasks[].dwell_s` (the `sts_*`/`status` rows need *Accessible* only). Compile.

## Step 4 — Create this PLC's two sequencer FBs (copy + ONE find/replace)

| Copy `CraneSequencer` → rename | Find/replace inside it |
|---|---|
| `Crane2_Seq` | `Line4Data` → `Crane2Data` |
| `Crane3_Seq` | `Line4Data` → `Crane3Data` |

The DB rename is the **only** edit. Compile each.

## Step 5 — Create the `IOMap` FC (real wiring)

1. **Add new block → Function (FC)**, SCL, **Return Void**, name **`IOMap`**.
2. Paste **`./IOMap.scl`** and confirm the `%I`/`%Q` match your modules.
3. **Travel direction (already wired in the file):** West = forward = right (`R-West ← mv_fwd`),
   East = reverse = left (`R-East ← mv_rev`). The crane advances to higher stations by moving West.

**Open wiring TODO for PLC_2** (fill from drawings before hardware; sim-drive from a watch table
meanwhile):
- **Crane 2 Loading `ls_at[1]`** — crane 2 is downstream with no LOAD/TRVL switch; set the
  transfer-pickup switch it stops at.
- Verify `PRK-*` parking addresses (cross-referenced in the drawings).

Crane 3 is otherwise fully wired.

## Step 6 — Wire OB1

**Main [OB1]** (LAD), drag in order: `IOMap` (Net 1) → `Crane2_Seq` (inst `Crane2_Seq_DB`) →
`Crane3_Seq` (inst `Crane3_Seq_DB`). Both run every scan → parallel. Detail: `./OB1.md`.

## Step 7 — Compile, download, RUN

1. PLCSIM only: project → Properties → Protection → **"Support simulation during block compilation"**.
2. **Compile → Software (rebuild all)** → 0 errors.
3. **Download** (fresh DB → "Delete and replace system data"). Set CPU **RUN**.

## Step 8 — Real PLC only: IP, security, cert, clock

1. IP already `192.168.0.112`.
2. Set `securityMode`/`securityPolicy` on the PLC_2 connection to match the PLC's secured endpoint.
3. Move our client cert to the PLC's **trusted** store.
4. **Fix the PLC clock.** See root `CLAUDE.md` + `docs/tia_opcua/`.

## Step 9 — Sim verification

Per `docs/line4/monitoring-watch-table.md`, per crane (`Crane2Data`, then `Crane3Data`): seed a
1-task batch, set `ls_at[0]`/`ls_up` TRUE, pulse `cmd_send`, walk the switches 10→…→90, clear
`cmd_send`. Both cranes reach 90 independently → parallel confirmed.

## App / PLC-Manager wiring (NodeIds)

Namespace **3**. Bind PLC_2 → line2 cranes 2/3, endpoint above. Example (crane 2 — crane 3 identical
with `Crane3Data`):
```
ns=3;s="Crane2Data"."tasks"[0]."station"   Int   write   (OPC UA [0] = S7 tasks[1])
ns=3;s="Crane2Data"."tasks"[0]."dwell_s"   Int   write
ns=3;s="Crane2Data"."task_count"           Int   write
ns=3;s="Crane2Data"."cmd_send"             Bool  write
ns=3;s="Crane2Data"."sts_busy" / "sts_done" / "sts_step"   read
ns=3;s="Crane2Data"."tasks"[0]."status"    Int   read
```
Array bracket **outside** the quotes and **0-based**; browse the live server on `BadNodeIdUnknown`.

## Done when…

- [ ] `typeTask` + `Crane2Data` + `Crane3Data` compile; OPC UA *Writable* set on app-written rows.
- [ ] `TravelTo` + `Crane2_Seq` + `Crane3_Seq` compile; only edit was the DB rename.
- [ ] `IOMap` compiles; crane 2 Loading TODO filled or noted as sim-driven.
- [ ] OB1: `IOMap` → `Crane2_Seq` → `Crane3_Seq`; rebuild-all = 0 errors; CPU RUN.
- [ ] Sim reaches 90 and back to 0 on both cranes; NodeIds verified.
- [ ] Real PLC: security + cert + clock done; project saved as `PLC_2`.
