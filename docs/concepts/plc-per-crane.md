# Concept — Per-crane PLC code + real I/O wiring

## What it is

The plant is **6 PLCs, each driving 1–3 cranes** that must run **in parallel**. The PLC-side program
lives in [`plc/`](../../plc/), **one folder per PLC**. Every crane runs an **independent copy** of
the proven Line 4 sequencer against its **own data block** `Crane<ID>Data` (e.g. `Crane6Data`,
`Crane7AData`). Each folder also carries the **real `%I`/`%Q` wiring** (`IOMap.scl`) — the piece the
original Line 4 program lacked, which is what lets it drive real hardware instead of hand-toggled
sim bits.

## Why we do it this way

- **Duplicate, don't refactor.** The Line 4 `CraneSequencer` FB + `Line4Data` DB are proven on both
  the sim and real S7-1500. We copy them per crane and only **rename the DB** (`Line4Data` →
  `Crane<ID>Data`) — zero change to the tested state machine. A 2-crane PLC has two DBs + two FB
  copies, both called each scan from OB1, so the cranes run in parallel.
- **Per-crane DBs match the software.** The app splits a recipe into **per-crane** chains and now
  addresses each crane's own DB: `batch.service.craneDbName(crane)` → `Crane<ID>Data`,
  `planBatchByCrane` groups by crane, `sendBatch` writes each crane's `tasks[]`+`task_count` then
  arms `cmd_send`, and `getBatchStatus`/`getCraneView` read `sts_*` per crane (optional `?crane=`).
  So busy/processing/done line up one-to-one with the PLC blocks.
- **Real I/O via an `IOMap` FC.** The proven FB works on a DB "mirror" (`ls_at[]`, `mv_*`,
  `btn_start`) that the sim toggles by hand. `IOMap` (SCL, called first in OB1) copies `%I` → the
  mirror and the mirror → `%Q`, using the exact addresses from `docs/plc/plant-panel-layout.md`
  (`LS_Up`, `<tank>_C<crane>`, `R-Up/Down/East/West`, …). That's the bridge to real switches/motors.

## How it fits together

- `plc/README.md` — the 6-PLC map + the app↔PLC signal contract.
- `plc/_shared/blocks.md` — the create-once-per-crane blocks (UDT `typeTask`, FC `TravelTo`, FB
  `CraneSequencer` template, DB `Crane<ID>Data` layout) = the proven Line 4 SCL.
- `plc/PLC_<n>_<line>/` — per PLC: `IOMap.scl` (real addresses), `OB1.md` (call order:
  `IOMap` → each `Crane<ID>_Seq`), and a README with per-crane station↔tank↔`%I` + motor↔`%Q` tables.
- Software: `backend/src/services/plc/batch.service.ts` (`craneDbName`, `planBatchByCrane`,
  per-crane `sendBatch`/`getBatchStatus`/`getCraneView`), `schemas/plc.schema.ts` (`?crane=`).

`PLC_4_line4/` (cranes 6 + 7A) is the **reference** — it matches the existing sim.

## Runbook (sim)

1. In TIA: create the shared blocks, then per crane copy the DB + FB (rename `Line4Data`), add the
   `IOMap` FC, and wire OB1 (`plc/PLC_4_line4/README.md` + `OB1.md`).
2. Download to PLCSIM Advanced, RUN. Drive `Crane6Data` and `Crane7AData` independently from watch
   tables (`docs/line4/monitoring-watch-table.md`) — both reach state 90 in parallel.
3. From the app: bind PLC_4 to line4 cranes 6/7A in PLC Manager, send a batch — each crane's DB
   gets only its own tasks; poll `sts_busy`/`sts_done` per crane.

## Gotchas

- **Downstream cranes** (fed by a transfer tank, e.g. crane 6, 7B) have **no loading bay** — their
  `ls_at[1]` (Loading) is mapped to the transfer-tank switch so states 10–40 complete. The two-crane
  handoff timing is a plant-specific follow-up.
- **Incomplete panel data.** The extract in `plant-panel-layout.md` is light for some cranes
  (crane 7A has no per-tank/parking switches listed) → those `ls_at[]` are `TODO %I?.?` in
  `IOMap.scl`, to fill from the drawings. Crane 6 is fully wired.
- Multiple LOAD bays (`LOAD-4B/4C/4D`) collapse to the app's single Loading station 1.
- **Real S7-1500** advertises only secured OPC UA endpoints — set mode/policy, trust the client
  cert, fix the PLC clock before connecting (`CLAUDE.md` gotchas, `docs/tia_opcua/`).
