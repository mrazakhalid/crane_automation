# OB1 — PLC_4 call structure

OB1 (`Main`) runs every scan. Per the TIA V18 gotcha, OB1 is **LAD/FBD** (it can't be SCL), so the
SCL logic lives in the FCs/FBs and OB1 just **calls** them, in this order:

| Network | Call | Instance DB |
|---|---|---|
| 1 | `IOMap` (FC) | — |
| 2 | `Crane6_Seq` (FB) | `Crane6_Seq_DB` (auto-created on drop) |
| 3 | `Crane7A_Seq` (FB) | `Crane7A_Seq_DB` (auto-created on drop) |

**Why this order:** `IOMap` first copies `%I` → the DB mirrors so the sequencers read fresh inputs;
each `Crane<ID>_Seq` then advances its own state machine and writes `mv_*` into its DB; because
`IOMap` also copies mirror → `%Q`, the motor outputs it wrote **last scan** are already driven —
i.e. inputs are read at the top of the scan and outputs flushed at the top of the next, one scan of
latency (standard for a mirror pattern). If you prefer zero-latency outputs, split `IOMap` into
`IOMapIn` (call in Network 1) and `IOMapOut` (call in the **last** network, after both sequencers).

**Steps:** open **Program blocks → Main [OB1]**, drag `IOMap` onto Network 1, then drag
`Crane6_Seq` and `Crane7A_Seq` onto Networks 2 and 3 (accept the instance-DB name prompts).
Compile (rebuild all) → 0 errors → download.

Adding a crane later = one more network calling its `Crane<ID>_Seq`. A PLC with three cranes has
three sequencer networks; they all run every scan, in parallel.
