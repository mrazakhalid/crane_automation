# OB1 — PLC_3 call structure

OB1 (LAD) calls, in order: **1** `IOMap` (FC) → **2** `Crane4_Seq` (FB, inst `Crane4_Seq_DB`) →
**3** `Crane5_Seq` (FB, inst `Crane5_Seq_DB`). Both cranes advance every scan (parallel). Rationale:
`../PLC_4_line4/OB1.md`.
