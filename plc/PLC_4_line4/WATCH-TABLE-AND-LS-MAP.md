# PLC_4 — watch table + how to drive a crane by hand

Send the recipe from the **software** (Send to PLC), then **press the limit switches in this watch
table** to tell the crane it has arrived. The software Plant / Crane view updates as you press.

## Golden rule
`IOMap` copies `%I → ls_at` every scan. So **press the `%I` ADDRESS** (not the `ls_at` mirror).
At every step, press the switch of the place the crane is **heading to**. Watch `sts_state` climb.

## If it's NOT moving — read this first
1. **`sts_state` stuck at 0** even though `cmd_send=TRUE` and `task_count>0`? The sequencer only
   starts on a **rising edge** of `cmd_send`. If a previous send left it TRUE, there's no new edge.
   **Fix:** modify `cmd_send = FALSE`, then `= TRUE` again (a clean FALSE→TRUE edge) → it goes to 10.
2. **Crane won't appear to move on the software?** Only **ONE** position switch may be TRUE at a
   time. The app draws the crane at the **first** TRUE `ls_at`, so if Parking (`ls_at[0]`) is still
   TRUE it wins. **Turn OFF the switch you're leaving before turning ON the next.**
3. Start every run from a clean slate: set **all `%I` = FALSE** and `cmd_send = FALSE` first, then
   Parking + ls_up = TRUE, then `cmd_send = TRUE`.

---

## 1) Watch table — CRANE 7A (paste these)

Type the DB tags in the **Name** column; type the `%I` in the **Address** column.

**Watch (read only):**
```
"Crane7AData".sts_state
"Crane7AData".sts_step
"Crane7AData".cmd_send
"Crane7AData".task_count
"Crane7AData".mv_fwd
"Crane7AData".mv_rev
"Crane7AData".mv_up
"Crane7AData".mv_down
```
**Press (modify these `%I`):**
```
%I4.7     Parking      (ls_at[0])
%I4.6     Loading      (ls_at[1])
%I4.4     ls_up  (hoist raised)
%I4.5     ls_dip (hoist in tank)
%I6.1     btn_start
%I5.0     1-1A  (station 2)
%I5.1     1-1B  (station 3)
%I5.2     1-2   (station 4)
%I5.3     1-3   (station 5)
%I5.4     1-4A  (station 6)
%I5.5     1-4B  (station 7)
```

---

## 1b) Watch table — CRANE 6 (paste these)

**Watch (read only):**
```
"Crane6Data".sts_state
"Crane6Data".sts_step
"Crane6Data".cmd_send
"Crane6Data".task_count
"Crane6Data".mv_fwd
"Crane6Data".mv_rev
"Crane6Data".mv_up
"Crane6Data".mv_down
```
**Press (modify these `%I`):**
```
%I0.7     Parking      (ls_at[0])
%I1.6     Loading      (ls_at[1] & ls_at[18], TRVL-4A)
%I0.4     ls_up  (hoist raised)
%I0.5     ls_dip (hoist in tank)
%I2.1     btn_start
%I1.0     1-7B   (station 12)
%I1.1     1-8    (station 13)
%I1.2     1-9    (station 14)
%I1.3     1-10A  (station 15)
%I1.4     1-10B  (station 16)
%I1.5     1-11   (station 17)
```

---

## 2) Run the recipe `1-3=5 ; 1-4A=3` on crane 7A — press order

**Before you send:** press (Modify → TRUE) `%I4.7` (Parking) and `%I4.4` (ls_up) — crane starts parked,
hoist up. Then in the software hit **Send to PLC**.

| `sts_state` shows | Press (Modify → value) | Crane is doing | goes to |
|---|---|---|---|
| **10** GO_LOAD | `%I4.6` = TRUE | drove West to Loading | 20 |
| **20** LOWER_LOAD | `%I4.5` = TRUE | hoist down at Loading | 30 |
| **30** WAIT_BTN | `%I6.1` = TRUE (hold ~3 s) then FALSE | operator loads part | 40 |
| **40** LIFT_LOAD | `%I4.5` = FALSE, `%I4.4` = TRUE | hoist up | 50 |
| **50** GO_TANK (task 1) | `%I4.6` = FALSE, `%I5.3` = TRUE | drove to **1-3** | 60 |
| **60** LOWER_TANK | `%I4.4` = FALSE, `%I4.5` = TRUE | dips into 1-3 | 70 |
| **70** DWELL (5 s) | *(wait 5 s)* | soaking in 1-3 | 80 |
| **80** LIFT_TANK | `%I4.5` = FALSE, `%I4.4` = TRUE | lifts out, task 1 done | 50 |
| **50** GO_TANK (task 2) | `%I5.3` = FALSE, `%I5.4` = TRUE | drove to **1-4A** | 60 |
| **60** LOWER_TANK | `%I4.4` = FALSE, `%I4.5` = TRUE | dips into 1-4A | 70 |
| **70** DWELL (3 s) | *(wait 3 s)* | soaking in 1-4A | 80 |
| **80** LIFT_TANK | `%I4.5` = FALSE, `%I4.4` = TRUE | lifts out, all tasks done | 85 |
| **85** GO_PARK | `%I5.4` = FALSE, `%I4.7` = TRUE | drove East back to Parking | 90 |
| **90** DONE | *(software auto-acks)* | finished | 0 |

Pattern: **turn OFF the switch you just left, turn ON the switch you're arriving at.** Only one tank
switch TRUE at a time. As you flip them, the crane marker moves on the software Plant/Crane view.

> Tip: if a `%I` modify won't stick while running, use the **Force table** (same addresses) — PLCSIM
> holds forced inputs solidly.

---

## 3) Full switch reference (both cranes)

**Station = tank number + 1** · `ls_at[]` index = station · press the `%I`.

### Crane 7A — `Crane7AData` (entry crane; stations 0,1,2–7)
| Tank / where | Station | `ls_at[]` | `%I` |
|---|---|---|---|
| Parking | 0 | `ls_at[0]` | `%I4.7` |
| Loading (LOAD-4A) | 1 | `ls_at[1]` | `%I4.6` |
| 1-1A | 2 | `ls_at[2]` | `%I5.0` |
| 1-1B | 3 | `ls_at[3]` | `%I5.1` |
| 1-2 | 4 | `ls_at[4]` | `%I5.2` |
| 1-3 | 5 | `ls_at[5]` | `%I5.3` |
| 1-4A | 6 | `ls_at[6]` | `%I5.4` |
| 1-4B | 7 | `ls_at[7]` | `%I5.5` |
| hoist up | — | `ls_up` | `%I4.4` |
| hoist in tank | — | `ls_dip` | `%I4.5` |
| start button | — | `btn_start` | `%I6.1` |

Outputs (read): `mv_up`=`%Q2.4` `mv_down`=`%Q2.5` `mv_rev`(East)=`%Q2.6` `mv_fwd`(West)=`%Q2.7`.

### Crane 6 — `Crane6Data` (downstream crane; stations 0,1,12–18)
| Tank / where | Station | `ls_at[]` | `%I` |
|---|---|---|---|
| Parking | 0 | `ls_at[0]` | `%I0.7` |
| Loading (TRVL-4A) | 1 | `ls_at[1]` | `%I1.6` |
| 1-7B | 12 | `ls_at[12]` | `%I1.0` |
| 1-8 | 13 | `ls_at[13]` | `%I1.1` |
| 1-9 | 14 | `ls_at[14]` | `%I1.2` |
| 1-10A | 15 | `ls_at[15]` | `%I1.3` |
| 1-10B | 16 | `ls_at[16]` | `%I1.4` |
| 1-11 | 17 | `ls_at[17]` | `%I1.5` |
| TRVL-4A (drop) | 18 | `ls_at[18]` | `%I1.6` *(same as Loading)* |
| hoist up | — | `ls_up` | `%I0.4` |
| hoist in tank | — | `ls_dip` | `%I0.5` |
| start button | — | `btn_start` | `%I2.1` |

Outputs (read): `mv_up`=`%Q0.4` `mv_down`=`%Q0.5` `mv_rev`(East)=`%Q0.6` `mv_fwd`(West)=`%Q0.7`.

Direction: `mv_fwd` = **West** = toward higher station; `mv_rev` = **East** = toward lower station.
Source of truth = [`./IOMap.scl`](./IOMap.scl).
