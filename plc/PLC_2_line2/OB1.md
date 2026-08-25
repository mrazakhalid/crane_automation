# OB1 — PLC_2 call structure

OB1 (LAD) calls, in order: **1** `IOMap` (FC) → **2** `Crane2_Seq` (FB, inst `Crane2_Seq_DB`) →
**3** `Crane3_Seq` (FB, inst `Crane3_Seq_DB`). Both cranes advance every scan (parallel). Rationale
+ zero-latency-output variant: `../PLC_4_line4/OB1.md`.
