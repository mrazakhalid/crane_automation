# PLC_6 (Line 4) — physical position map for crane 7B

Direction is by **physical position** (`#d.pos[station]`), not station number — see
[`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl) and
[`../PLC_4_line4/POSITION-MAP.md`](../PLC_4_line4/POSITION-MAP.md) for the full explanation.

Crane 7B is **downstream**: its Loading is the transfer tank **TRVL-4B**, and its tanks
(`1-4C`, `1-5`, `1-6`) sit **East** of it. Parking (P-7B) is just **West** of TRVL-4B.

## Line 4 physical order (East → West, 1…21) — 7B's boxes
| # | Box | | # | Box |
|--:|---|---|--:|---|
| 9 | 1-4C | | 12 | TRVL-4B (7B loading) |
| 10 | 1-5 | | 13 | P-7B (7B parking) |
| 11 | 1-6 | | | |

## `Crane7BData.pos` (index = station number, value = physical position)

| station | is | pos value |
|--:|---|--:|
| 0 | Parking (P-7B) | **13** |
| 1 | Loading (TRVL-4B) | **12** |
| 8 | 1-4C | **9** |
| 9 | 1-5 | **10** |
| 10 | 1-6 | **11** |
| 11 | TRVL-4B (drop) | **12** |
| all others | (unused) | 0 |

## Direction check
| Move | by pos | physical | ok |
|---|---|---|---|
| Parking→Loading | 12 < 13 → **East** | Loading is East of Parking | ✅ |
| Loading→1-4C | 9 < 12 → **East** | tank is East of TRVL-4B | ✅ |
| 1-4C→1-5 | 10 > 9 → **West** | West | ✅ |
| last tank→Parking | 13 > 11 → **West** | Parking is West of tanks | ✅ |

> Real-panel gap (same as 7A): confirm 7B's parking + per-tank `%I` addresses against the actual
> drawings before hardware. On the sim, drive them from a watch table (the IOMap addresses are in
> [`./IOMap.scl`](./IOMap.scl)).
