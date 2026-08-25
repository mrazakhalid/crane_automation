# PLC_1 — Line 1 — cranes 1A & 1B

Endpoint `opc.tcp://192.168.0.111:4840`, OPC UA namespace **3**, CPU `6ES7511-1AK02`.
Two cranes, each an independent copy of the proven Line 4 sequencer on its own DB.

| Crane | Data DB | FB | Role |
|---|---|---|---|
| 1A | `Crane1AData` | `Crane1A_Seq` | entry (has LOAD bays) |
| 1B | `Crane1BData` | `Crane1B_Seq` | downstream (fed by transfer TRVL-1A) |

**Build:** create the shared blocks (`../_shared/blocks.md`) once; copy the DB + FB per crane
(rename `Line4Data` → `Crane1AData` / `Crane1BData`); paste [`IOMap.scl`](./IOMap.scl) into an
`IOMap` FC; wire OB1 per [`OB1.md`](./OB1.md).

## Crane 1A — stations (complete)
`station = tank.number + 1`. 0 Park=`I2.6` PRK-1B, 1 Load=`I1.2` LOAD-1A, then:
2 `2-1A`=I1.6 · 3 `2-1B`=I1.7 · 4 `2-2`=I2.0 · 5 `INS-1A`=I2.1 · 6 `2-3`=I2.2 · 7 `2-4A`=I2.3 ·
8 `2-4B`=I2.4 · 9 `2-5`=I2.5 · 10 `14-3`=I2.7 · 11 `TRVL-1A`=I3.0.
Hoist `I0.3/0.4/0.5`; motors R-Up/Down/East/West = `Q0.4/0.5/0.6/0.7`, R-Hoist/Trolley `Q1.0/1.1`.

## Crane 1B — stations (Loading TODO)
0 Park=`I5.2` PRK-1A; 12 `7-1`=I5.3 · 13 `7-2`=I5.4 · 14 `14-2`=I5.5 · 15 `14-1`=I5.6.
Hoist `I4.3/4.4/4.5`; motors `Q1.6/1.7/2.0/2.1`, R-Hoist/Trolley `Q2.2/2.3`.

## Notes / gaps
- **1B Loading (`ls_at[1]`) TODO** — 1B is downstream with no LOAD/TRVL switch in its panel; set the
  transfer-pickup switch and fill it in `IOMap.scl`.
- Parking (`PRK-*`) addresses are **cross-referenced** in the drawings (1A's panel carries PRK-1B,
  1B's carries PRK-1A) — verify each crane's own home sensor.
- `R-Hoist`/`R-Trolley` are driven as enables (`mv_up|mv_down` / `mv_fwd|mv_rev`).
- Real S7-1500: set security + trust cert + PLC clock first (see repo `CLAUDE.md`).
