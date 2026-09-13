# PLC_3 (Line 3) — physical position map (cranes 4 & 5)

Direction is by **physical position** (`#d.pos[station]`), not station number — see
[`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl). Confirmed roles from the plant
picture: **Crane 4 = entry (LOAD, East)**, **Crane 5 = downstream (TRVL-3B, West)**.

## Line 3 physical order (East → West, 1…21)
```
 1 LOAD    2 1-16   3 1-15   4 1-14   5 1-13   6 1-12B  7 1-12A  8 TRVL-3A  9 15-2  10 P-4
11 DRY-3A 12 3-4A  13 INS-3A 14 6-2   15 6-1   16 3-3   17 3-2   18 3-1B   19 3-1A  20 TRVL-3B  21 P-5
```
Crane 4 owns 1–10 (LOAD + 1-16…15-2 + P-4); Crane 5 owns 11–21 (DRY-3A…3-1A + TRVL-3B + P-5).

## `Crane4Data.pos` (entry — LOAD East, tanks run West, Parking West of tanks)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-4) | **10** |
| 1 | Loading (LOAD) | **1** |
| 2 | 1-16 | **2** |
| 3 | 1-15 | **3** |
| 4 | 1-14 | **4** |
| 5 | 1-13 | **5** |
| 6 | 1-12B | **6** |
| 7 | 1-12A | **7** |
| 8 | TRVL-3A | **8** |
| 9 | 15-2 | **9** |
| 10…20 | (unused) | 0 |

## `Crane5Data.pos` (downstream — TRVL-3B West, tanks run East, Parking West-most)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-5) | **21** |
| 1 | Loading (TRVL-3B) | **20** |
| 10 | DRY-3A | **11** |
| 11 | 3-4A | **12** |
| 12 | INS-3A | **13** |
| 13 | 6-2 | **14** |
| 14 | 6-1 | **15** |
| 15 | 3-3 | **16** |
| 16 | 3-2 | **17** |
| 17 | 3-1B | **18** |
| 18 | 3-1A | **19** |
| 19 | TRVL-3B | **20** |
| others | (unused) | 0 |

## Direction check
| Move | by pos | physical | ok |
|---|---|---|---|
| C4 Parking→Loading | 1 < 10 → **East** | LOAD far East of P-4 | ✅ |
| C4 Loading→1-16 | 2 > 1 → **West** | tank West of LOAD | ✅ |
| C4 last tank→Parking | 10 > 9 → **West** | P-4 West of tanks | ✅ |
| C5 Parking→Loading | 20 < 21 → **East** | TRVL-3B East of P-5 | ✅ |
| C5 Loading→DRY-3A | 11 < 20 → **East** | tanks East of TRVL-3B | ✅ |
| C5 tank→tank (DRY-3A→3-4A) | 12 > 11 → **West** | West | ✅ |
| C5 last tank→Parking | 21 > 19 → **West** | P-5 West of tanks | ✅ |

> Panel gap: **Crane 4's LOAD-3A switch** wasn't in the extract — `IOMap.scl` uses `%I2.0` as a
> placeholder marked VERIFY. Confirm against the real Panel_3 drawing before hardware; on the sim,
> drive `%I2.0` from a watch table.
