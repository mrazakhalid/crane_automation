# PLC_5 (Line 5) — TIA Portal build steps (click-through)

**One operator, one sitting.** Follow top to bottom. Deep reference: `../_shared/blocks.md`,
`docs/line4/instructions.md`.

## At a glance

| | |
|---|---|
| **Line** | line5 |
| **Cranes** | **8** (downstream, no LOAD bay) + **9** (entry, LOAD-5A + TRVL-5A) |
| **Endpoint** | `opc.tcp://192.168.0.115:4840` |
| **OPC UA namespace** | `3` |
| **CPU** | `6ES7511-1AK02` (S7-1500) |
| **Data DBs to create** | `Crane8Data`, `Crane9Data` |
| **Sequencer FBs to create** | `Crane8_Seq`, `Crane9_Seq` |
| **IOMap** | `./IOMap.scl` |
| **OB1 order** | `IOMap` → `Crane8_Seq` → `Crane9_Seq` (`./OB1.md`) |

> **Reuse reality check.** Save-as of Line 4 + changing IP/cert gives a second *Line 4*, not PLC_5.
> The **FC/FB logic is reused unchanged**; the **per-crane DBs** and **IOMap** are PLC-specific and
> must be created. IP + certs are Step 8 only.

---

## Step 0 — Prerequisites

TIA V18 (+ PLCSIM Advanced V5.0 to sim). Global library `CraneAutomation_Lib` with `typeTask`,
`TravelTo`, `CraneSequencer` (or create by hand from `../_shared/blocks.md`).

## Step 1 — Device + network + OPC UA server

1. Add CPU **`6ES7511-1AK02`**.
2. **Ethernet:** IP **`192.168.0.115`**, mask `255.255.255.0`.
3. **OPC UA → Server → Activate** → `opc.tcp://192.168.0.115:4840`.
4. **Add the exact I/O modules from Panel_5** — not BA/16-ch: **two** `DI 32x24VDC HF` =
   `6ES7521-1BL00-0AB0` (→ `%I0–%I3` crane 9, `%I4–%I7` crane 8) and one `DQ 32x24VDC/0.5A HF` =
   `6ES7522-1BL01-0AB0` (→ `%Q0–%Q3`). Confirm start bytes **0 / 4 / 0** cover the `./IOMap.scl` `%I`/`%Q`.

## Step 2 — Bring in the shared blocks (once)

Drag `typeTask`, `TravelTo`, `CraneSequencer` from the library. **Never edit them.** Compile
`typeTask` first.

## Step 3 — Create this PLC's two data DBs (copy + rename)

| Create DB | For crane |
|---|---|
| `Crane8Data` | 8 |
| `Crane9Data` | 9 |

Each: Global DB, **Optimized ON**, rows per `../_shared/blocks.md §2`, tick ***Accessible* +
*Writable from HMI/OPC UA*** on `task_count`, `cmd_send`, `tasks[].station`, `tasks[].dwell_s`.
Compile.

## Step 4 — Create this PLC's two sequencer FBs (copy + ONE find/replace)

| Copy `CraneSequencer` → rename | Find/replace inside it |
|---|---|
| `Crane8_Seq` | `Line4Data` → `Crane8Data` |
| `Crane9_Seq` | `Line4Data` → `Crane9Data` |

DB rename is the **only** edit. Compile each.

## Step 5 — Create the `IOMap` FC (real wiring)

1. **Add new block → Function (FC)**, SCL, **Return Void**, name **`IOMap`**.
2. Paste **`./IOMap.scl`**; confirm `%I`/`%Q` match your modules.
3. **Travel direction (already wired in the file):** West = forward = right (`R-West ← mv_fwd`),
   East = reverse = left (`R-East ← mv_rev`). The crane advances to higher stations by moving West.

**Open wiring TODO for PLC_5** (fill from drawings before hardware; sim-drive from a watch table
meanwhile):
- **Crane 8 Loading `ls_at[1]`** — crane 8 is downstream with no LOAD/TRVL switch; set the
  transfer-pickup switch it stops at.

Crane 9 is otherwise fully wired.

## Step 6 — Wire OB1

**Main [OB1]** (LAD): `IOMap` (Net 1) → `Crane8_Seq` (inst `Crane8_Seq_DB`) → `Crane9_Seq` (inst
`Crane9_Seq_DB`). Parallel every scan. Detail: `./OB1.md`.

## Step 7 — Compile, download, RUN

1. PLCSIM only: project → Properties → Protection → **"Support simulation during block compilation"**.
2. **Compile → Software (rebuild all)** → 0 errors.
3. **Download** (fresh DB → "Delete and replace system data"). CPU → **RUN**.

## Step 8 — Real PLC only: IP, security, cert, clock

1. IP already `192.168.0.115`.
2. Set `securityMode`/`securityPolicy` on the PLC_5 connection to match the secured endpoint.
3. Move our client cert to the PLC's **trusted** store.
4. **Fix the PLC clock.** Root `CLAUDE.md` + `docs/tia_opcua/`.

## Step 9 — Sim verification

Per `docs/line4/monitoring-watch-table.md`, per crane (`Crane8Data`, then `Crane9Data`): seed a
1-task batch, set `ls_at[0]`/`ls_up` TRUE, pulse `cmd_send`, walk switches 10→…→90, clear `cmd_send`.
Both reach 90 independently → parallel.

## App / PLC-Manager wiring (NodeIds)

Namespace **3**. Bind PLC_5 → line5 cranes 8/9, endpoint above. Example (crane 8 — crane 9 identical
with `Crane9Data`):
```
ns=3;s="Crane8Data"."tasks"[0]."station"   Int   write   (OPC UA [0] = S7 tasks[1])
ns=3;s="Crane8Data"."tasks"[0]."dwell_s"   Int   write
ns=3;s="Crane8Data"."task_count"           Int   write
ns=3;s="Crane8Data"."cmd_send"             Bool  write
ns=3;s="Crane8Data"."sts_busy" / "sts_done" / "sts_step"   read
ns=3;s="Crane8Data"."tasks"[0]."status"    Int   read
```
Array bracket **outside** quotes, **0-based**; browse on `BadNodeIdUnknown`.

## Done when…

- [ ] `typeTask` + `Crane8Data` + `Crane9Data` compile; *Writable* set on app-written rows.
- [ ] `TravelTo` + `Crane8_Seq` + `Crane9_Seq` compile; only edit was the DB rename.
- [ ] `IOMap` compiles; crane 8 Loading TODO filled or noted as sim-driven.
- [ ] OB1: `IOMap` → `Crane8_Seq` → `Crane9_Seq`; rebuild-all = 0 errors; CPU RUN.
- [ ] Sim reaches 90 and back to 0 on both cranes; NodeIds verified.
- [ ] Real PLC: security + cert + clock done; project saved as `PLC_5`.
