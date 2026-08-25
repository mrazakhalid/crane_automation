# Line 4 — Auto-moving crane in the sim (a virtual "PlantSim" block)

**Problem:** on the PLCSIM sim the crane doesn't move on its own — you have to toggle the limit
switches (`ls_at`, `ls_dip`, `ls_up`) by hand in the watch table. That's only a *sim* limitation:
on **real hardware** the `CraneSequencer` FB runs the motors (`mv_fwd`, `mv_up`, …), the crane
physically travels, and the limit switches trip themselves.

**Fix:** add one small **`PlantSim`** function block that plays the part of the physical crane in
the sim. It reads the motor outputs and moves a *simulated* position, then trips the limit
switches from that position. Result: when a batch arrives, the crane **auto-moves Parking →
Loading**, auto-lowers, waits for the operator's start button, then auto-runs every tank and
returns home — with **no manual switch toggling**.

> ⚠️ **SIM ONLY.** `PlantSim` is a stand-in for the real crane. On real hardware you **delete it
> (or don't call it)** — there the `ls_*` bits come from wired `%I` inputs, not from this block.

---

## How it works (the closed loop)

```
CraneSequencer  --mv_fwd/mv_rev/mv_up/mv_down-->  PlantSim
      ^                                              |
      |                                              v   moves a simulated position/height
      +-----------  ls_at[] / ls_dip / ls_up  -------+   and trips the switches
```

- Horizontal: `mv_fwd`/`mv_rev` move `sim_pos` (0.0 = Parking … 5.0). A station's `ls_at[i]`
  trips when the trolley is over it.
- Hoist: `mv_down`/`mv_up` move `sim_h` (0.0 = raised … 1.0 = fully down). `ls_dip` trips near the
  bottom, `ls_up` near the top.
- `btn_start` is **not** touched — that stays the operator's manual press (load material, hold 3 s).

At startup `sim_pos = 0`, `sim_h = 0` → `ls_at[0]` and `ls_up` are TRUE, i.e. **parked & raised**.
No reset needed.

---

## Part 1 — Create the `PlantSim` FB

1. Project tree → **Program blocks → Add new block → Function block (FB)** → name **`PlantSim`** →
   **Language SCL** → **OK**.
2. Declare the interface:

   | Section | Name | Data type | Start value |
   |---|---|---|---|
   | Static | `sim_pos` | `Real` | `0.0` |
   | Static | `sim_h` | `Real` | `0.0` |
   | Static | `tick` | `TON_TIME` | — |
   | Temp | `i` | `Int` | — |

3. Paste the code body:

```scl
// PlantSim — virtual crane for the PLCSIM sim. Turns the CraneSequencer's motor
// outputs (mv_*) into limit-switch inputs (ls_*), so the crane auto-moves with NO
// manual toggling. Call from OB1 AFTER CraneSequencer.
// SIM ONLY — do not run this on real hardware (there ls_* come from wired %I).

#i := 0;

// ~5 Hz motion tick (self-retriggering one-shot pulse).
#tick(IN := NOT #tick.Q, PT := T#200MS);

IF #tick.Q THEN
    IF "Line4Data".mv_fwd  THEN #sim_pos := #sim_pos + 0.2; END_IF;
    IF "Line4Data".mv_rev  THEN #sim_pos := #sim_pos - 0.2; END_IF;
    IF "Line4Data".mv_down THEN #sim_h   := #sim_h + 0.25; END_IF;
    IF "Line4Data".mv_up   THEN #sim_h   := #sim_h - 0.25; END_IF;
END_IF;

// Clamp to the physical range.
IF #sim_pos < 0.0 THEN #sim_pos := 0.0; END_IF;
IF #sim_pos > 9.0 THEN #sim_pos := 9.0; END_IF;
IF #sim_h   < 0.0 THEN #sim_h := 0.0; END_IF;
IF #sim_h   > 1.0 THEN #sim_h := 1.0; END_IF;

// Trip each station's limit switch when the trolley is over it.
FOR #i := 0 TO 9 DO
    "Line4Data".ls_at[#i] := ABS(#sim_pos - INT_TO_REAL(#i)) < 0.3;
END_FOR;

// Hoist limits: fully down = in tank (dip); fully up = raised.
"Line4Data".ls_dip := #sim_h > 0.9;
"Line4Data".ls_up  := #sim_h < 0.1;
```

4. **Compile** `PlantSim` → 0 errors.

## Part 2 — Call it from OB1 (AFTER CraneSequencer)

1. Open **Main [OB1]**.
2. Add a **second network** (right-click → Insert network) below the CraneSequencer call.
3. Drag **`PlantSim [FB…]`** onto the new rung → accept the instance DB `PlantSim_DB` → OK.
   - Order matters a little: `CraneSequencer` first (sets motors), then `PlantSim` (reacts). The
     drag-drop into a lower network gives this order.
4. **Compile → Software (rebuild all blocks)** → 0 errors → **Download** (Stop modules → Stop all,
   then Start module).

---

## Part 3 — Run it (now almost hands-free)

1. Make sure the watch table's `ls_*` bits are **not forced/held** — `PlantSim` now owns them.
   (If you Modified them earlier, that's fine; PlantSim overwrites them each scan.)
2. In the app: pick `line4`, recipe `1-1A=6;1-1B=3;1-2=5;`, **Generate → Send to PLC**.
3. Watch it go **by itself**:
   - `sts_state` 10 → the crane **auto-travels Parking → Loading**, `ls_at[1]` trips on its own.
   - 20 → auto-lowers, `ls_dip` trips → **30 WAIT_BTN** (motors stop).
4. **The one manual step:** modify **`btn_start` = TRUE** (hold ≥ 3 s), then set it FALSE.
   - From there it **auto-runs**: lift → tank 1-1A → dip/dwell → lift → 1-1B → 1-2 → back to
     Parking → **90 DONE**. The app toasts "Tasks done" and re-enables Send.
5. Open **Crane View** — the trolley and hoist now animate on their own.

> Want it 100% hands-free? You *could* also auto-press the button in `PlantSim` (e.g. set
> `btn_start := TRUE` when `sts_state = 30` after a short delay), but the button is deliberately
> the operator's "material loaded, go" step — keeping it manual matches the real process.

---

## Tuning

- **Speed:** the `0.2` (travel) and `0.25` (hoist) increments per 200 ms tick set the pace.
  Bigger = faster. `0.2` ≈ one station per second.
- **Arrival window:** `< 0.3` in the `ls_at` line is how close (in stations) the crane must be for
  a switch to trip. Keep it below 0.5 so two switches never trip at once.

## Removing it for real hardware

Delete the `PlantSim` call from OB1 (or the block), and add your real I/O mapping instead
(`"Line4Data".ls_dip := %I0.0;` … `%Q0.0 := "Line4Data".mv_up;`). The `CraneSequencer` logic and
the app are unchanged — see [`instructions.md`](./instructions.md) Part 9.
