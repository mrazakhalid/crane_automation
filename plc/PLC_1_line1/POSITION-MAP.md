# PLC_1 (Line 1) — physical position map (cranes 1A & 1B)

Direction is by **physical position** (`#d.pos[station]`), not station number — see
[`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl). Roles here were already correct:
**Crane 1A = entry (LOAD, East)**, **Crane 1B = downstream (TRVL-1A pickup, West)**.

## Line 1 physical order (East → West, 1…17)
```
 1 LOAD    2 2-1A   3 2-1B   4 2-2    5 INS-1A  6 2-3   7 2-4A   8 2-4B   9 2-5   10 14-3  11 TRVL-1A  12 P-1A
13 7-1    14 7-2   15 14-2  16 14-1  17 P-1B
```
Crane 1A owns 1–12 (LOAD + 2-1A…TRVL-1A + P-1A); Crane 1B owns 13–17 (7-1…14-1 + P-1B).
Crane 1B picks up transferred parts at **TRVL-1A** (physical 11, East of its own zone).

## `Crane1AData.pos` (entry — LOAD East, tanks run West, Parking West of tanks)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-1A) | **12** |
| 1 | Loading (LOAD) | **1** |
| 2 | 2-1A | **2** |
| 3 | 2-1B | **3** |
| 4 | 2-2 | **4** |
| 5 | INS-1A | **5** |
| 6 | 2-3 | **6** |
| 7 | 2-4A | **7** |
| 8 | 2-4B | **8** |
| 9 | 2-5 | **9** |
| 10 | 14-3 | **10** |
| 11 | TRVL-1A | **11** |
| 12…20 | (unused) | 0 |

## `Crane1BData.pos` (downstream — pickup at TRVL-1A, tanks run West, Parking West-most)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-1B) | **17** |
| 1 | Loading (TRVL-1A pickup) | **11** |
| 12 | 7-1 | **13** |
| 13 | 7-2 | **14** |
| 14 | 14-2 | **15** |
| 15 | 14-1 | **16** |
| others | (unused) | 0 |

## Direction check
| Move | by pos | physical | ok |
|---|---|---|---|
| 1A Parking→Loading | 1 < 12 → **East** | LOAD far East of P-1A | ✅ |
| 1A Loading→2-1A | 2 > 1 → **West** | tank West of LOAD | ✅ |
| 1A last tank→Parking | 12 > 11 → **West** | P-1A West of tanks | ✅ |
| 1B Parking→Loading | 11 < 17 → **East** | TRVL-1A East of P-1B | ✅ |
| 1B Loading→7-1 | 13 > 11 → **West** | tanks West of TRVL-1A | ✅ |
| 1B tank→tank (7-1→7-2) | 14 > 13 → **West** | West | ✅ |
| 1B last tank→Parking | 17 > 16 → **West** | P-1B West of tanks | ✅ |

> Panel gaps (VERIFY on Panel_1): crane 1B's **TRVL-1A pickup** uses `%I5.7` as a placeholder
> (1A's TRVL-1A is `%I3.0`); parking switches `PRK-*` are cross-referenced. Drive them from a watch
> table on the sim.
