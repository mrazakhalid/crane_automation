# PLC_4 — Line 4 — cranes 6 & 7A

The **reference** PLC (it matches the S7-1500 sim you already run). Endpoint
`opc.tcp://192.168.0.114:4840`, OPC UA namespace **3**, CPU `6ES7511-1AK02`.

Two cranes, each an **independent copy** of the proven Line 4 sequencer against its own DB, running
in parallel. The app writes/reads each crane by name — crane 6 → `Crane6Data`, crane 7A →
`Crane7AData` (`backend/src/services/plc/batch.service.ts` → `craneDbName`).

| Crane | Data DB | FB (copy) | App sends to | App reads |
|---|---|---|---|---|
| 6 | `Crane6Data` | `Crane6_Seq` | `ns=3;s="Crane6Data"."tasks"[i]."station"` … `cmd_send` | `sts_busy`/`sts_done`/`sts_step` |
| 7A | `Crane7AData` | `Crane7A_Seq` | `ns=3;s="Crane7AData"…` | same |

## Build steps (TIA Portal)

1. **Shared blocks** (`../_shared/blocks.md`): create the `typeTask` UDT and `TravelTo` FC once.
2. **Per crane** (do this twice — for 6 and 7A):
   - Copy the DB layout → name it `Crane6Data` / `Crane7AData` (Optimized access ON; tick
     *Accessible* + *Writable from HMI/OPC UA* on the app-written rows).
   - Copy the `CraneSequencer` FB → name it `Crane6_Seq` / `Crane7A_Seq`, paste the body, then
     **find/replace `Line4Data` → `Crane6Data`** (resp. `Crane7AData`).
3. **`IOMap` FC** — add a Function (FC, SCL, return **Void**, no params) named `IOMap`, paste
   [`IOMap.scl`](./IOMap.scl). Make sure the `%I`/`%Q` addresses match your I/O module config.
4. **OB1** — see [`OB1.md`](./OB1.md): call `IOMap`, then `Crane6_Seq`, then `Crane7A_Seq`.
5. **Enable simulation support** (project → Properties → Protection) if using PLCSIM Advanced;
   rebuild all; download (hardware + software); set the CPU to **RUN**.

## Crane 6 wiring (complete — all switches in the panel)

Tanks → stations (`station = tank.number + 1`) and their inputs:

| Station | Tank | Input `%I` | | Motor | Output `%Q` |
|:---:|---|---|---|---|---|
| 0 (Park) | PRK-4A | `I0.7` | | `mv_up` → R-Up-1 | `Q0.4` |
| 1 (Load) | TRVL-4A* | `I1.6` | | `mv_down` → R-Down-1 | `Q0.5` |
| 12 | 1-7B | `I1.0` | | `mv_rev` → R-East-1 (East/rev) | `Q0.6` |
| 13 | 1-8 | `I1.1` | | `mv_fwd` → R-West-1 (West/fwd) | `Q0.7` |
| 14 | 1-9 | `I1.2` | | **Hoist** | |
| 15 | 1-10A | `I1.3` | | `ls_up` ← LS_Up | `I0.4` |
| 16 | 1-10B | `I1.4` | | `ls_dip` ← LS_Down | `I0.5` |
| 17 | 1-11 | `I1.5` | | `ls_mid` ← LS_Mid | `I0.3` |
| 18 | TRVL-4A | `I1.6` | | `btn_start` ← UP_Pendant | `I2.1` |

\* Crane 6 is **downstream** — no loading bay. Loading (station 1) is mapped to its transfer-tank
switch (`TRVL-4A`) so it "loads" by picking up at the transfer tank. The two-crane handoff timing
(7A/7B fill TRVL-4A, then 6 collects) is a **plant-specific follow-up**.

## Crane 7A wiring (complete — from Panel_4, Rev 081426)

Fully wired from the drawing: hoist (`I4.3/4.4/4.5`), mode (`E-Stop I4.0`, `Auto I4.1`), start
(`UP_Pendant I6.1`), **Parking** (`PRK-4C-C7A I4.7`), **Loading** (`LOAD-4A-C7A I4.6`;
`LOAD-4B/4C/4D = I6.3/6.4/6.5` are extra bays), the six entry-tank switches
`1-1A`(st 2)=`I5.0`, `1-1B`(3)=`I5.1`, `1-2`(4)=`I5.2`, `1-3`(5)=`I5.3`, `1-4A`(6)=`I5.4`,
`1-4B`(7)=`I5.5`, and motors (`R-Up/Down/East/West = Q2.4/2.5/2.6/2.7`). No TODOs remain — both
cranes 6 and 7A run fully on hardware from this panel.

## Sim verification (no real crane)

Follow `docs/line4/monitoring-watch-table.md` per crane: seed a batch on `Crane6Data`
(`tasks[1].station=12,dwell_s=6; task_count=1`), set `ls_at[0]=TRUE`/`ls_up=TRUE`, pulse
`cmd_send`, then flip the `ls_at`/`ls_dip`/`ls_up` switches to walk `sts_state` 10→…→90 and back.
Repeat on `Crane7AData` independently — both cranes advance in parallel from one OB1.

## Before the real PLC
Real S7-1500 → set `securityMode`/`securityPolicy` on the PLC_4 connection, trust our client cert,
fix the PLC clock (see `CLAUDE.md` gotchas + `docs/tia_opcua/`). Confirm which NIC (`.114` vs
`.214`) runs the OPC UA server.
