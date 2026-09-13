# PLC_5 (Line 5) — physical position map (cranes 8 & 9)

Direction is by **physical position** (`#d.pos[station]`), not station number — see
[`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl). Confirmed roles from the plant
picture: **Crane 8 = entry (LOAD, East)**, **Crane 9 = downstream (TRVL-5A, West)**.

## Line 5 physical order (East → West, 1…22)
```
 1 LOAD     2 5-2    3 INS-5A  4 5-3   5 INS-5B  6 5-1   7 INS-5C  8 5-4   9 5-5   10 P-8
11 DRY-5A  12 5-12  13 INS-5E 14 5-11 15 5-10   16 5-9  17 INS-5D 18 5-8  19 5-7  20 5-6  21 TRVL-5A  22 P-9
```
Crane 8 owns 1–10 (LOAD + 5-2…5-5 + P-8); Crane 9 owns 11–22 (DRY-5A…5-6 + TRVL-5A + P-9).

## `Crane8Data.pos` (entry — LOAD is East, tanks run West, Parking West of tanks)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-8) | **10** |
| 1 | Loading (LOAD) | **1** |
| 2 | 5-2 | **2** |
| 3 | INS-5A | **3** |
| 4 | 5-3 | **4** |
| 5 | INS-5B | **5** |
| 6 | 5-1 | **6** |
| 7 | INS-5C | **7** |
| 8 | 5-4 | **8** |
| 9 | 5-5 | **9** |
| 10…20 | (unused) | 0 |

## `Crane9Data.pos` (downstream — TRVL-5A is West, tanks run East, Parking West-most)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-9) | **22** |
| 1 | Loading (TRVL-5A) | **21** |
| 10 | DRY-5A | **11** |
| 11 | 5-12 | **12** |
| 12 | INS-5E | **13** |
| 13 | 5-11 | **14** |
| 14 | 5-10 | **15** |
| 15 | 5-9 | **16** |
| 16 | INS-5D | **17** |
| 17 | 5-8 | **18** |
| 18 | 5-7 | **19** |
| 19 | 5-6 | **20** |
| 20 | TRVL-5A | **21** |
| others | (unused) | 0 |

## Direction check
| Move | by pos | physical | ok |
|---|---|---|---|
| C8 Parking→Loading | 1 < 10 → **East** | LOAD is far East of P-8 | ✅ |
| C8 Loading→5-2 | 2 > 1 → **West** | tank West of LOAD | ✅ |
| C8 last tank→Parking | 10 > 9 → **West** | P-8 West of tanks | ✅ |
| C9 Parking→Loading | 21 < 22 → **East** | TRVL-5A East of P-9 | ✅ |
| C9 Loading→DRY-5A | 11 < 21 → **East** | tanks East of TRVL-5A | ✅ |
| C9 tank→tank (DRY-5A→5-12) | 12 > 11 → **West** | West | ✅ |
| C9 last tank→Parking | 22 > 20 → **West** | P-9 West of tanks | ✅ |

> Panel gap: **Crane 8's LOAD-5A switch** wasn't in the extract — `IOMap.scl` uses `%I6.3` as a
> placeholder marked VERIFY. Confirm against the real Panel_5 drawing before hardware; on the sim,
> drive `%I6.3` from a watch table.
