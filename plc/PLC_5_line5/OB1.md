# OB1 — PLC_5 call structure

OB1 (LAD) calls, in order: **1** `IOMap` (FC) → **2** `Crane8_Seq` (FB, inst `Crane8_Seq_DB`) →
**3** `Crane9_Seq` (FB, inst `Crane9_Seq_DB`). Both cranes advance every scan (parallel). Rationale:
`../PLC_4_line4/OB1.md`.
