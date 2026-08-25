# Concept — Recipes, cross-line splitting & the Process page

## What it is

A **recipe** is a QR-style task list (`key=seconds;key=seconds;…`) that can span **several
lines at once**. The **Process** page lives on the **manager** side (admins instead manage the
lines, PLCs, and connections that the split relies on). It takes a recipe — pasted, decoded
from a QR image, or loaded from a **saved recipe dropdown** — and **divides its tasks** across the
plant: it works out, per task, which **line** the tank belongs to, which **crane** services it, and
therefore which **PLC** would receive it. The result is a **process summary**: tasks grouped by
**PLC → crane**, each crane's tasks kept in run order. Pressing **Start process** runs a **live
simulation** — each task moves `idle → in-progress → done` at its dwell-second pace — so you can
watch the whole plant execute before any PLC is wired.

> **No PLC is contacted yet.** The run is a time-based simulation of the eventual flow; the same
> UI later binds to real PLC status with no rework (see "How it fits together").

## Why we do it this way

- **Backend is the source of truth.** Resolution and splitting run on the backend
  (`services/process/`), so the mapping logic is one testable place; the frontend only renders.
- **Auto-detect the line from the tank name.** A recipe is line-agnostic. For each key the planner
  runs the existing per-line matcher (`task-generator.resolveTank`) against **every** saved line
  (`services/process/resolver.ts`): 0 matches → **missing**, 1 → **resolved**, >1 → **ambiguous**
  (a tank name that exists on more than one line, e.g. `1-*` on both line3 and line4). Ambiguous
  steps are flagged and you pick the line inline; the choice is an **override** (`{ step: lineId }`)
  that re-plans and is saved with the recipe so re-loading remembers it.
- **Route by crane, not line — because a line can span multiple PLCs.** The owning PLC is derived
  from `tank.crane` → the `plc_connections` record whose `lineId` matches and whose `cranes`
  contains that crane (Line 4 = PLC_4 for cranes 6/7A **and** PLC_6 for crane 7B). A resolved task
  whose crane has **no** PLC assigned is **unrouted** — still shown (grouped under "PLC not
  assigned") so the split is useful even before PLC Manager is configured, never silently dropped.
- **Per-crane parallel chains.** Each crane runs **its** tasks strictly in order (a crane does one
  tank at a time); different cranes/PLCs run **in parallel**. That's the physical reality and it
  matches the existing PLC batch model (each PLC gets its own ordered `tasks[]` array). `station =
  tank.number + 1`, the same convention `batch.service` uses for the real PLC.
- **Recipes persist; runs are ephemeral.** New recipes are saved by name (unique, 409 on clash) in
  the `recipes` store (Mongo + SQLite, like `lines`). A run lives only in memory, keyed by `runId`,
  and its per-task state is **derived from elapsed time on every poll** (no background timers) —
  exactly how the real flow will poll the PLC handshake.

## How it fits together

- `models/process.model.ts` — `ResolvedStep`, `PlcGroup`/`CraneChain`, `ProcessPlan`, `RunStatus`.
- `models/recipe.model.ts` + `storage/{mongo,sqlite}/recipe.store.ts` + `repositories/recipe.repository.ts`
  — persistence, mirroring the Line entity.
- `services/process/resolver.ts` — `resolveAcrossLines` (reuses `resolveTank`).
- `services/process/planner.ts` — `buildPlan` (pure: lines + connections + qr → grouped plan) and
  `planProcess` (loads all lines + connections, then `buildPlan`).
- `services/process/run-engine.ts` — in-memory `startRun` / `getRunStatus` (time-derived) / `stopRun`.
- `services/recipe.service.ts` + controllers/routes — `GET/POST /api/recipes`,
  `GET/PATCH/DELETE /api/recipes/:id`; `POST /api/process/plan`, `POST /api/process/start`,
  `GET /api/process/:runId/status`, `POST /api/process/:runId/stop`. Backend allows manager +
  super-admin (super-admin is a superset), but the **Process UI/nav is gated to `manager` only** —
  admins own the Lines / PLC / PLC Manager screens, managers own recipes + the process.
- Frontend: `components/ProcessWorkspace.tsx` is the shared flow (owns `useRecipes` +
  `useProcess`, renders `RecipeInput` / `ProcessWarnings` / `ProcessSummary`), reused by **both**
  the **Process** page (`pages/ProcessPage.tsx`, `ListTree` nav, manager-only) **and the manager
  Dashboard** (`pages/DashboardPage.tsx`). There is **no line picker** — uploading a QR auto-divides
  across all lines. Hooks: `useRecipes` (dropdown + save/delete), `useProcess`
  (decode/divide/resolve/start/poll/stop); api `api/recipes.ts` + `api/process.ts`.
  (The legacy single-line `TaskGenerator` + `useTaskGenerator` — which held the real single-PLC
  "Send to PLC" batch send — are retired from the UI but kept in the tree for when PLCs are wired.)

## Runbook

1. Sign in as **manager** → **Process** (admins don't see this tab; they manage Lines/PLCs instead).
2. Paste a recipe (or **Attach QR image**, or pick a **saved recipe**), e.g. `1-1A=6;5-2=8;4-7=5`.
   Optionally type a name and **Save recipe** (it then appears in the dropdown).
3. **Divide tasks** → the summary groups tasks by PLC → crane. Fix any flags: pick a line for an
   **ambiguous** tank; **missing** = not on any line; **no PLC** = assign the crane in PLC Manager.
4. **Start process** → tasks animate `idle → in-progress → done`, cranes progressing in parallel,
   each crane strictly in order; the progress bar tracks the whole run. **Stop** resets.

## Gotchas

- A tank name on two lines is **ambiguous**, not an error — pick the line (saved as an override).
- **Unrouted** tasks (crane with no PLC) still appear and still simulate; they just show "PLC not
  assigned" until you bind the crane to a PLC in PLC Manager.
- Runs are in memory — a server restart drops an in-flight run (fine for the simulation). Recipes,
  being persisted, survive.
- Swapping the simulation for real PLC I/O is localized to `run-engine.ts` (replace the
  time-derivation with `batch.sendBatch` + `getBatchStatus`); nothing else changes.
