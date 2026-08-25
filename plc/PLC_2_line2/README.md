# PLC_2 — Line 2 — cranes 2 & 3

Endpoint `opc.tcp://192.168.0.112:4840`, namespace **3**, CPU `6ES7511-1AK02`.

| Crane | Data DB | FB | Role |
|---|---|---|---|
| 2 | `Crane2Data` | `Crane2_Seq` | downstream (no LOAD bay) |
| 3 | `Crane3Data` | `Crane3_Seq` | entry (LOAD + TRVL-2A) |

**Build:** shared blocks (`../_shared/blocks.md`) once; copy DB + FB per crane (rename `Line4Data`
→ `Crane2Data`/`Crane3Data`); paste [`IOMap.scl`](./IOMap.scl); wire OB1 ([`OB1.md`](./OB1.md)).

## Crane 2 — stations (Loading TODO)
0 Park=`I5.2`; 2 `15-3`=I5.3 · 3 `4-7`=I5.4 · 4 `4-9`=I5.5 · 5 `INS-2A`=I5.6 · 6 `4-10`=I5.7 ·
7 `4-6A`=I6.0. Hoist `I4.3/4.4/4.5`; motors `Q1.6/1.7/2.0/2.1`, hoist/trolley `Q2.2/2.3`.

## Crane 3 — stations (complete)
0 Park=`I2.7`, 1 Load=`I1.2` LOAD-2A; 8 `DRY-2A`=I1.6 · 9 `4-8`=I1.7 · 10 `4-1`=I2.0 ·
11 `4-2`=I2.1 · 12 `4-3`=I2.2 · 13 `4-4`=I2.3 · 14 `4-5`=I2.4 · 15 `INS-2B`=I2.5 · 16 `4-11`=I2.6 ·
17 `4-6B`=I3.0 · 18 `TRVL-2A`=I3.1. Hoist `I0.3/0.4/0.5`; motors `Q0.4/0.5/0.6/0.7`, `Q1.0/1.1`.

## Notes
- **Crane 2 Loading (`ls_at[1]`) TODO** — downstream, no LOAD/TRVL switch; set the pickup switch.
- `R-Hoist`/`R-Trolley` driven as enables. Verify `PRK-*` (cross-referenced). Real S7-1500: secure
  the endpoint + trust cert + PLC clock first.
