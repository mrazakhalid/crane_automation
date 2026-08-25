# OB1 — PLC_1 call structure

OB1 (LAD) calls, in order: **1** `IOMap` (FC) → **2** `Crane1A_Seq` (FB, inst `Crane1A_Seq_DB`) →
**3** `Crane1B_Seq` (FB, inst `Crane1B_Seq_DB`). `IOMap` copies `%I`→mirror and mirror→`%Q`; each
sequencer advances its own state machine every scan, so both cranes run in parallel. See
`../PLC_4_line4/OB1.md` for the rationale (one-scan mirror latency; split IOMap in/out if you want
zero-latency outputs).
