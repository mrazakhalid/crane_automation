# `plc/` — per-PLC crane code (Siemens S7-1500, TIA Portal)

This folder holds the **PLC-side** program for the plant, organised **one folder per PLC**. Each
PLC drives 1–3 cranes; **every crane runs its own copy** of the proven Line 4 sequencer against its
**own data block** (`Crane<ID>Data`), so cranes on the same PLC run **in parallel**. The app writes
each crane's task list to that crane's DB and reads its busy/done signals back — see
`backend/src/services/plc/batch.service.ts` (`craneDbName`, `planBatchByCrane`).

## The 6 PLCs (from the panel drawings)

| Folder | PLC | Line | Cranes | Endpoint |
|---|---|---|---|---|
| `PLC_1_line1/` | PLC_1 | line1 | 1A, 1B | `opc.tcp://192.168.0.111:4840` |
| `PLC_2_line2/` | PLC_2 | line2 | 2, 3 | `opc.tcp://192.168.0.112:4840` |
| `PLC_3_line3/` | PLC_3 | line3 | 4, 5 | `opc.tcp://192.168.0.113:4840` |
| `PLC_4_line4/` | PLC_4 | line4 | 6, 7A | `opc.tcp://192.168.0.114:4840` |
| `PLC_5_line5/` | PLC_5 | line5 | 8, 9 | `opc.tcp://192.168.0.115:4840` |
| `PLC_6_line4/` | PLC_6 | line4 | 7B | `opc.tcp://192.168.0.116:4840` |

*(Line 4 spans two PLCs. Which NIC — `.11x` vs `.21x` — runs OPC UA is per-PLC; confirm on site.)*

## What's shared vs per-PLC

- **`_shared/blocks.md`** — the blocks that are **identical for every crane**: the `typeTask` UDT,
  the `TravelTo` FC, the `CraneSequencer` FB (the proven Line 4 code), and the `Crane<ID>Data` DB
  layout. You create these **once per crane** by copying (this is the "duplicate program per crane"
  approach — the state machine is never edited, only the DB name it references).
- **`PLC_<n>_<line>/`** — the parts that are **genuinely custom to that PLC**: the real
  `%I`/`%Q` **wiring** (`IOMap.scl`), the per-crane **station↔tank↔switch** tables, the OB1 call
  structure, and a README with build steps. **This is the new piece the Line 4 program lacked** —
  it maps the DB "mirror" bits to physical inputs/outputs so it drives real hardware.

## How the app and PLC line up (the signal contract)

Per crane, in DB `Crane<ID>Data` (OPC UA namespace 3):

| Direction | Tags | NodeId example |
|---|---|---|
| app → PLC | `tasks[i].station`, `tasks[i].dwell_s`, `task_count`, `cmd_send` | `ns=3;s="Crane6Data"."tasks"[0]."station"` |
| PLC → app | `sts_busy`, `sts_done`, `sts_step`, `sts_state`, `tasks[i].status` | `ns=3;s="Crane6Data"."sts_busy"` |

Handshake (unchanged from Line 4): app writes the tasks + `task_count`, then arms `cmd_send`
**last**; PLC runs, sets `sts_busy`, then `sts_done`; app reads `sts_done`, clears `cmd_send` to ack.

## Start here

`PLC_4_line4/` is the **reference** (it matches the sim you already have running). Build it, verify
on PLCSIM, then the other PLCs follow the same pattern. See `PLC_4_line4/README.md`.

> **Before connecting a real S7-1500:** it advertises only **secured** OPC UA endpoints — set the
> connection's `securityMode`/`securityPolicy`, move our client cert to the PLC's *trusted* store,
> and set the PLC clock. See the gotchas in the repo root `CLAUDE.md` and `docs/tia_opcua/`.
