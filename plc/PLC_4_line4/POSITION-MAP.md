# PLC_4 (Line 4) — physical position map (direction fix)

**Why this exists:** travel direction must be decided by each station's **physical left→right
position**, not its station number — because the plant is NOT laid out in station-number order
(Parking sits West of Loading; Crane 6's Loading is the TRVL-4A transfer tank at the far West end).
The sequencer now reads `#d.pos[station]` for direction (higher pos = further West = `mv_fwd`/R-West;
lower pos = East = `mv_rev`/R-East). See [`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl).

## Physical order of Line 4 (East → West, 1…21)

From the plant drawing (LOAD is East-most / left; positions increase going West / right):

| # | Box | Owner | | # | Box | Owner |
|--:|---|---|---|--:|---|---|
| 1 | LOAD | 7A (loading) | | 12 | TRVL-4B | 7B (loading) |
| 2 | P-7A | 7A (parking) | | 13 | P-7B | 7B (parking) |
| 3 | 1-1A | 7A | | 14 | 1-7B | 6 |
| 4 | 1-1B | 7A | | 15 | 1-8 | 6 |
| 5 | 1-2 | 7A | | 16 | 1-9 | 6 |
| 6 | 1-3 | 7A | | 17 | 1-10A | 6 |
| 7 | 1-4A | 7A | | 18 | 1-10B | 6 |
| 8 | 1-4B | 7A | | 19 | 1-11 | 6 |
| 9 | 1-4C | 7B | | 20 | TRVL-4A | 6 (loading) |
| 10 | 1-5 | 7B | | 21 | P-6 | 6 (parking) |
| 11 | 1-6 | 7B | | | | |

*(Crane 7B is on PLC_6 — fixed later. This PLC_4 folder covers cranes 6 & 7A.)*

## `pos[]` values to enter in each crane DB

`pos` is `Array[0..20] of Int` inside `typeCraneData`. The **index = station number**; the **value =
physical position** from the table above. Unused stations stay `0` (never targeted).

### `Crane7AData.pos` (entry crane; Loading=LOAD is East, tanks run West)
| station | is | pos value |
|--:|---|--:|
| 0 | Parking (P-7A) | **2** |
| 1 | Loading (LOAD) | **1** |
| 2 | 1-1A | **3** |
| 3 | 1-1B | **4** |
| 4 | 1-2 | **5** |
| 5 | 1-3 | **6** |
| 6 | 1-4A | **7** |
| 7 | 1-4B | **8** |
| 8…20 | (unused) | 0 |

### `Crane6Data.pos` (downstream crane; Loading=TRVL-4A is West, tanks are East of it)
| station | is | pos value |
|--:|---|--:|
| 0 | Parking (P-6) | **21** |
| 1 | Loading (TRVL-4A) | **20** |
| 12 | 1-7B | **14** |
| 13 | 1-8 | **15** |
| 14 | 1-9 | **16** |
| 15 | 1-10A | **17** |
| 16 | 1-10B | **18** |
| 17 | 1-11 | **19** |
| 18 | TRVL-4A (drop) | **20** |
| others | (unused) | 0 |

## Direction check (why this is now correct)

| Move | old (by station #) | now (by pos) | physical | fixed? |
|---|---|---|---|---|
| 7A Parking→Loading | 1>0 → West ✗ | pos 1<2 → **East** | Load is East of park | ✅ |
| 7A Loading→1-1A | 2>1 → West | pos 3>1 → **West** | tank is West | ✅ |
| 7A last tank→Park | 0<7 → East | pos 2<8 → **East** | park is East of tanks | ✅ |
| 6 Parking→Loading | 1>0 → West ✗ | pos 20<21 → **East** | Load is East of park | ✅ |
| 6 Loading→1-8 | 13>1 → West ✗ | pos 15<20 → **East** | tank is East of TRVL-4A | ✅ |
| 6 tank→tank (1-8→1-9) | 14>13 → West | pos 16>15 → **West** | West | ✅ |
| 6 last tank→Park | 0<13 → East ✗ | pos 21>15 → **West** | park is West of tanks | ✅ |

## TIA steps (mirror the repo changes)

1. **`typeCraneData` UDT** → add one row: **`pos`**, type **`Array[0..20] of Int`**. Compile.
   (Accessible = on is fine; Writable can stay off — it's config, not app-written.)
2. **`CraneSequencer` FB** → paste the updated [`../_shared/CraneSequencer.scl`](../_shared/CraneSequencer.scl).
   The only change is the 3 `TravelTo` calls now pass `#d.pos[#target]` / `#d.pos[#cur]` for
   direction (arrival switch is still `#d.ls_at[#target]`). `TravelTo` itself is unchanged.
3. **`Crane7AData`** → set the `pos[]` start values from the 7A table above.
   **`Crane6Data`** → set the `pos[]` start values from the 6 table above.
4. **Library** → update the `typeCraneData` and `CraneSequencer` master copies, save.
5. Compile all → 0 errors → download → RUN. Re-test: crane now leaves Parking toward Loading
   **East** (reverse), and Crane 6 goes to its tanks the correct way.

> If TIA won't let you edit the `pos` start values on a type-DB, tell me — we'll instead put `pos`
> in a small per-crane regular DB (`Crane6Pos`/`Crane7APos`) and pass it as an FB input. Same result.
