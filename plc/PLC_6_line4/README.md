# PLC_6 — Line 4 — crane 7B

Endpoint `opc.tcp://192.168.0.116:4840`, namespace **3**, CPU `6ES7511-1AK02`. **Single crane** (the
second PLC of Line 4 — line 4 spans PLC_4 cranes 6/7A **and** PLC_6 crane 7B).

| Crane | Data DB | FB | Role |
|---|---|---|---|
| 7B | `Crane7BData` | `Crane7B_Seq` | downstream (fed by transfer TRVL-4B) |

**Build:** shared blocks once (`../_shared/blocks.md`); copy DB + FB (rename `Line4Data` →
`Crane7BData`); paste [`IOMap.scl`](./IOMap.scl); wire OB1 ([`OB1.md`](./OB1.md)).

## Crane 7B — stations (mostly TODO)
Tanks: `1-4C`(st 8), `1-5`(9), `1-6`(10), `TRVL-4B`(11). Hoist `I0.3/0.4/0.5`; start `UP_Pendant
I2.1`; motors R-Up/Down/East/West = `Q0.4/0.5/0.6/0.7`, R-Hoist/Trolley `Q1.0/1.1`.

## Notes / gaps
- **Panel extract is incomplete for 7B** (like 7A): it lists only control/hoist/pendant/motor tags —
  **no parking and no per-tank switches**. Fill the `ls_at[]` TODOs in `IOMap.scl` from the real
  drawings. On the sim, drive those bits from a watch table.
- 7B is downstream — Loading (`ls_at[1]`) is the **transfer pickup** at TRVL-4B (crane 7A/6 fill it).
- `R-Hoist`/`R-Trolley` driven as enables. Real S7-1500: secure endpoint + trust cert + PLC clock.
