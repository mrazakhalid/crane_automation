# PLC_5 — Line 5 — cranes 8 & 9

Endpoint `opc.tcp://192.168.0.115:4840`, namespace **3**, CPU `6ES7511-1AK02`.

| Crane | Data DB | FB | Role |
|---|---|---|---|
| 8 | `Crane8Data` | (generic `CraneSequencer`, inst `Crane8_Seq_DB`) | **entry** — loads at LOAD (East), runs 5-2…5-5, parks P-8 |
| 9 | `Crane9Data` | (generic `CraneSequencer`, inst `Crane9_Seq_DB`) | **downstream** — picks up at TRVL-5A (West), runs DRY-5A…5-6, parks P-9 |

> **Roles corrected 2026-09-13** (were reversed in the first draft). Confirmed from the plant
> picture + physics: two cranes share one rail and can't cross, so the East crane (8) owns LOAD and
> the West crane (9) owns TRVL-5A. Direction is by physical position — see
> [`./POSITION-MAP.md`](./POSITION-MAP.md). Build with the generic library blocks (`typeCraneData` +
> `CraneSequencer`), a DB *of type* `typeCraneData` per crane, `pos[]` set per the position map, and
> `CraneSequencer(d := "Crane8Data")` / `(d := "Crane9Data")` in OB1.

**Build:** shared blocks once; copy DB + FB per crane (rename `Line4Data` → `Crane8Data`/
`Crane9Data`); paste [`IOMap.scl`](./IOMap.scl); wire OB1 ([`OB1.md`](./OB1.md)).

## Crane 8 — stations (Loading TODO)
0 Park=`I5.2`; 2 `5-2`=I5.3 · 3 `INS-5A`=I5.4 · 4 `5-3`=I5.5 · 5 `INS-5B`=I5.6 · 6 `5-1`=I5.7 ·
7 `INS-5C`=I6.0 · 8 `5-4`=I6.1 · 9 `5-5`=I6.2. Hoist `I4.3/4.4/4.5`; motors `Q1.6/1.7/2.0/2.1`,
hoist/trolley `Q2.2/2.3`.

## Crane 9 — stations (complete)
0 Park=`I2.7`, 1 Load=`I1.2`; 10 `DRY-5A`=I1.6 · 11 `5-12`=I1.7 · 12 `INS-5E`=I2.0 · 13 `5-11`=I2.1 ·
14 `5-10`=I2.2 · 15 `5-9`=I2.3 · 16 `INS-5D`=I2.4 · 17 `5-8`=I2.5 · 18 `5-7`=I2.6 · 19 `5-6`=I3.0 ·
20 `TRVL-5A`=I3.1. Hoist `I0.3/0.4/0.5`; motors `Q0.4/0.5/0.6/0.7`, hoist/trolley `Q1.0/1.1`.

## Notes
- **Crane 8 Loading (`ls_at[1]`) TODO** — downstream, no LOAD/TRVL switch; set the pickup switch.
- `R-Hoist`/`R-Trolley` driven as enables. Real S7-1500: secure endpoint + trust cert + PLC clock.
