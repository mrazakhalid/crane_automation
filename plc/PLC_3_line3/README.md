# PLC_3 — Line 3 — cranes 4 & 5

Endpoint `opc.tcp://192.168.0.113:4840`, namespace **3**, CPU `6ES7511-1AK02`.

| Crane | Data DB | FB | Role |
|---|---|---|---|
| 4 | `Crane4Data` | `Crane4_Seq` | downstream (TRVL-3A pickup; no PRK in panel) |
| 5 | `Crane5Data` | `Crane5_Seq` | entry (LOAD-3A + TRVL-3B) |

**Build:** shared blocks once; copy DB + FB per crane (rename `Line4Data` → `Crane4Data`/
`Crane5Data`); paste [`IOMap.scl`](./IOMap.scl); wire OB1 ([`OB1.md`](./OB1.md)).

## Crane 4 — stations (Parking TODO)
1 Load=`I1.5` TRVL-3A (transfer pickup); 2 `1-16`=I0.7 · 3 `1-15`=I1.0 · 4 `1-14`=I1.1 ·
5 `1-13`=I1.2 · 6 `1-12B`=I1.3 · 7 `1-12A`=I1.4 · 8 `TRVL-3A`=I1.5 · 9 `15-2`=I1.6.
Hoist `I0.3/0.4/0.5`; motors `Q0.4/0.5/0.6/0.7`, hoist/trolley `Q1.0/1.1`.

## Crane 5 — stations (complete)
0 Park=`I5.7`, 1 Load=`I4.6`; 10 `DRY-3A`=I4.7 · 11 `3-4A`=I5.0 · 12 `INS-3A`=I5.1 · 13 `6-2`=I5.2 ·
14 `6-1`=I5.3 · 15 `3-3`=I5.4 · 16 `3-2`=I5.5 · 17 `3-1B`=I5.6 · 18 `3-1A`=I6.0 · 19 `TRVL-3B`=I7.0.
Hoist `I4.3/4.4/4.5`; motors `Q2.4/2.5/2.6/2.7`, hoist/trolley `Q3.0/3.1`.

## Notes
- **Crane 4 Parking (`ls_at[0]`) TODO** — no PRK switch in its panel; set the home sensor.
- `R-Hoist`/`R-Trolley` driven as enables. Real S7-1500: secure endpoint + trust cert + PLC clock.
