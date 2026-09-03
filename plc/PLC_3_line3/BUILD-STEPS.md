# PLC_3 (Line 3) — TIA Portal build steps (click-through)

**One operator, one sitting.** Follow top to bottom. Deep reference: `../_shared/blocks.md`,
`docs/line4/instructions.md`.

## At a glance

| | |
|---|---|
| **Line** | line3 |
| **Cranes** | **4** (downstream, TRVL-3A pickup, no PRK in panel) + **5** (entry, LOAD-3A + TRVL-3B) |
| **Endpoint** | `opc.tcp://192.168.0.113:4840` |
| **OPC UA namespace** | `3` |
| **CPU** | `6ES7511-1AK02` (S7-1500) |
| **Data DBs to create** | `Crane4Data`, `Crane5Data` |
| **Sequencer FBs to create** | `Crane4_Seq`, `Crane5_Seq` |
| **IOMap** | `./IOMap.scl` |
| **OB1 order** | `IOMap` → `Crane4_Seq` → `Crane5_Seq` (`./OB1.md`) |

> **Reuse reality check.** Save-as of Line 4 + changing IP/cert gives a second *Line 4*, not PLC_3.
> The **FC/FB logic is reused unchanged**; the **per-crane DBs** and **IOMap** are PLC-specific and
> must be created. IP + certs are Step 8 only.

---

## Step 0 — Prerequisites

TIA V18 (+ PLCSIM Advanced V5.0 to sim). Global library `CraneAutomation_Lib` with `typeTask`,
`TravelTo`, `CraneSequencer` master copies (or create by hand from `../_shared/blocks.md`).

## Step 1 — Device + network + OPC UA server

1. Add CPU **`6ES7511-1AK02`**.
2. **Ethernet:** IP **`192.168.0.113`**, mask `255.255.255.0`.
3. **OPC UA → Server → Activate** → `opc.tcp://192.168.0.113:4840`.
4. **Add the exact I/O modules from Panel_3** — not BA/16-ch: **two** `DI 32x24VDC HF` =
   `6ES7521-1BL00-0AB0` (→ `%I0–%I3` crane 4, `%I4–%I7` crane 5) and one `DQ 32x24VDC/0.5A HF` =
   `6ES7522-1BL01-0AB0` (→ `%Q0–%Q3`). Confirm start bytes **0 / 4 / 0** cover the `./IOMap.scl` `%I`/`%Q`.

## Step 2 — Bring in the shared blocks (once)

Drag `typeTask`, `TravelTo`, `CraneSequencer` from the library. **Never edit them.** Compile
`typeTask` first.

## Step 3 — Create this PLC's two data DBs (copy + rename)

| Create DB | For crane |
|---|---|
| `Crane4Data` | 4 |
| `Crane5Data` | 5 |

Each: Global DB, **Optimized ON**, rows per `../_shared/blocks.md §2`, tick ***Accessible* +
*Writable from HMI/OPC UA*** on `task_count`, `cmd_send`, `tasks[].station`, `tasks[].dwell_s`.
Compile.

## Step 4 — Create this PLC's two sequencer FBs (copy + ONE find/replace)

| Copy `CraneSequencer` → rename | Find/replace inside it |
|---|---|
| `Crane4_Seq` | `Line4Data` → `Crane4Data` |
| `Crane5_Seq` | `Line4Data` → `Crane5Data` |

DB rename is the **only** edit. Compile each.

## Step 5 — Create the `IOMap` FC (real wiring)

1. **Add new block → Function (FC)**, SCL, **Return Void**, name **`IOMap`**.
2. Paste **`./IOMap.scl`**; confirm `%I`/`%Q` match your modules.
3. **Travel direction (already wired in the file):** West = forward = right (`R-West ← mv_fwd`),
   East = reverse = left (`R-East ← mv_rev`). The crane advances to higher stations by moving West.

**Open wiring TODO for PLC_3** (fill from drawings before hardware; sim-drive from a watch table
meanwhile):
- **Crane 4 Parking `ls_at[0]`** — crane 4 has no PRK switch in its panel; set its home sensor.
  (Note crane 4's Loading `ls_at[1]` is the TRVL-3A transfer pickup — already wired.)

Crane 5 is otherwise fully wired.

## Step 6 — Wire OB1

**Main [OB1]** (LAD): `IOMap` (Net 1) → `Crane4_Seq` (inst `Crane4_Seq_DB`) → `Crane5_Seq` (inst
`Crane5_Seq_DB`). Parallel every scan. Detail: `./OB1.md`.

## Step 7 — Compile, download, RUN

1. PLCSIM only: project → Properties → Protection → **"Support simulation during block compilation"**.
2. **Compile → Software (rebuild all)** → 0 errors.
3. **Download** (fresh DB → "Delete and replace system data"). CPU → **RUN**.

## Step 8 — Real PLC only: IP, security, cert, clock

1. IP already `192.168.0.113`.
2. Set `securityMode`/`securityPolicy` on the PLC_3 connection to match the secured endpoint.
3. Move our client cert to the PLC's **trusted** store.
4. **Fix the PLC clock.** Root `CLAUDE.md` + `docs/tia_opcua/`.

## Step 9 — Sim verification

Per `docs/line4/monitoring-watch-table.md`, per crane (`Crane4Data`, then `Crane5Data`): seed a
1-task batch, set `ls_at[0]`/`ls_up` TRUE, pulse `cmd_send`, walk switches 10→…→90, clear `cmd_send`.
Both reach 90 independently → parallel.

## App / PLC-Manager wiring (NodeIds)

Namespace **3**. Bind PLC_3 → line3 cranes 4/5, endpoint above. Example (crane 4 — crane 5 identical
with `Crane5Data`):
```
ns=3;s="Crane4Data"."tasks"[0]."station"   Int   write   (OPC UA [0] = S7 tasks[1])
ns=3;s="Crane4Data"."tasks"[0]."dwell_s"   Int   write
ns=3;s="Crane4Data"."task_count"           Int   write
ns=3;s="Crane4Data"."cmd_send"             Bool  write
ns=3;s="Crane4Data"."sts_busy" / "sts_done" / "sts_step"   read
ns=3;s="Crane4Data"."tasks"[0]."status"    Int   read
```
Array bracket **outside** quotes, **0-based**; browse on `BadNodeIdUnknown`.

## Done when…

- [ ] `typeTask` + `Crane4Data` + `Crane5Data` compile; *Writable* set on app-written rows.
- [ ] `TravelTo` + `Crane4_Seq` + `Crane5_Seq` compile; only edit was the DB rename.
- [ ] `IOMap` compiles; crane 4 Parking TODO filled or noted as sim-driven.
- [ ] OB1: `IOMap` → `Crane4_Seq` → `Crane5_Seq`; rebuild-all = 0 errors; CPU RUN.
- [ ] Sim reaches 90 and back to 0 on both cranes; NodeIds verified.
- [ ] Real PLC: security + cert + clock done; project saved as `PLC_3`.
