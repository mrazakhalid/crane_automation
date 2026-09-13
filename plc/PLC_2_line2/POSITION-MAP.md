# PLC_2 (Line 2) — physical position map (cranes 2 & 3)

Direction is by **physical position** (`#d.pos[station]`), not station number — see
[`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl). Confirmed roles from the plant
picture: **Crane 2 = entry (LOAD, East)**, **Crane 3 = downstream (TRVL-2A, West)**.

## Line 2 physical order (East → West, 1…20)
```
 1 LOAD    2 15-3   3 4-7    4 4-9    5 INS-2A  6 4-10   7 4-6A   8 P-2
 9 DRY-2A 10 4-8   11 4-1   12 4-2   13 4-3    14 4-4   15 4-5   16 INS-2B  17 4-11  18 4-6B  19 TRVL-2A  20 P-3
```
Crane 2 owns 1–8 (LOAD + 15-3…4-6A + P-2); Crane 3 owns 9–20 (DRY-2A…4-6B + TRVL-2A + P-3).

## `Crane2Data.pos` (entry — LOAD East, tanks run West, Parking West of tanks)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-2) | **8** |
| 1 | Loading (LOAD) | **1** |
| 2 | 15-3 | **2** |
| 3 | 4-7 | **3** |
| 4 | 4-9 | **4** |
| 5 | INS-2A | **5** |
| 6 | 4-10 | **6** |
| 7 | 4-6A | **7** |
| 8…20 | (unused) | 0 |

## `Crane3Data.pos` (downstream — TRVL-2A West, tanks run East, Parking West-most)
| station | is | pos |
|--:|---|--:|
| 0 | Parking (P-3) | **20** |
| 1 | Loading (TRVL-2A) | **19** |
| 8 | DRY-2A | **9** |
| 9 | 4-8 | **10** |
| 10 | 4-1 | **11** |
| 11 | 4-2 | **12** |
| 12 | 4-3 | **13** |
| 13 | 4-4 | **14** |
| 14 | 4-5 | **15** |
| 15 | INS-2B | **16** |
| 16 | 4-11 | **17** |
| 17 | 4-6B | **18** |
| 18 | TRVL-2A | **19** |
| others | (unused) | 0 |

## Direction check
| Move | by pos | physical | ok |
|---|---|---|---|
| C2 Parking→Loading | 1 < 8 → **East** | LOAD East of P-2 | ✅ |
| C2 Loading→15-3 | 2 > 1 → **West** | tank West of LOAD | ✅ |
| C2 last tank→Parking | 8 > 7 → **West** | P-2 West of tanks | ✅ |
| C3 Parking→Loading | 19 < 20 → **East** | TRVL-2A East of P-3 | ✅ |
| C3 Loading→DRY-2A | 9 < 19 → **East** | tanks East of TRVL-2A | ✅ |
| C3 tank→tank (DRY-2A→4-8) | 10 > 9 → **West** | West | ✅ |
| C3 last tank→Parking | 20 > 18 → **West** | P-3 West of tanks | ✅ |

> Panel gap: **Crane 2's LOAD-2A switch** wasn't in the extract — `IOMap.scl` uses `%I6.1` as a
> placeholder marked VERIFY. Confirm against the real Panel_2 drawing before hardware; on the sim,
> drive `%I6.1` from a watch table.
