# Concept — Lines & QR task generation

## What it is

A **line** is a plating line's physical layout: its cranes and the ordered tank
positions each crane services. Super-admins **build, edit, and delete** lines from the
**Lines** tab — from scratch or by loading the fixed **line4** template (3 cranes
`7A/7B/6`, 17 tanks including two shared transfer tanks). Managers then scan a **QR
recipe** on their dashboard; the app decodes it against a chosen line and produces an
ordered **task list** in the format `crane_name / tank_name / time / next_task /
previous_task / status`.

## Why we do it this way

- **Backend is the source of truth.** The layout is validated (Zod `strictObject`, bounds,
  reject-unknown) and stored in the `lines` collection with a unique `name`. Task
  generation also runs on the backend (`services/task-generator.ts`) so the mapping logic
  is one testable place — the frontend only renders the result.
- **The QR carries a recipe, not a layout.** A QR is `key=seconds;key=seconds;…` (e.g.
  `1-1=60;1-2=30;…`). `key` is a tank/station id and the number is dwell time **in
  seconds**. The same tank can repeat; a recipe usually has more steps than the line has
  tanks.
- **Resolution is name-based with a normalized fallback.** For a key we first match a tank
  whose `name` equals it exactly; otherwise we normalize (lowercase, drop a trailing
  `A/B/C…` after a digit) and take the **lowest-numbered** match — so `1-1` → tank 1
  (`1-1A`), `1-7` → tank 11 (`1-7b`). This is deterministic and matches the shop's numbering.
- **Nothing is silently dropped.** A key that resolves to no tank still produces a task in
  sequence, with `crane_name`/`tank_name` = **`missing`**. `previous_task`/`next_task`
  hold the *tank number* of the neighbouring step (`0` at the ends, `missing` when that
  neighbour is itself unresolved). `status` is always `0` for now.

Worked example (`…;1-1=60;1-2=30;1-3=5;…`): the task for `1-2` is tank `1-2` (#3),
`previous_task = 1`, `next_task = 4` — exactly the shop's expectation.

## How it fits together

- `models/line.model.ts` — `Line`/`Tank`/`GeneratedTask` shapes + `MISSING` sentinel.
- `schemas/line.schema.ts` — create-line, line-id param, and `generateTasks` (QR regex) schemas.
- `repositories/line.repository.ts` — Mongo CRUD + unique `name` index (`ensureLineIndexes`).
- `services/task-generator.ts` — pure `parseQr` / `resolveTank` / `generateTasks`.
- `services/line.service.ts` + `controllers` + `routes/line.routes.ts` — `GET/POST /api/lines`,
  `GET /api/lines/:id`, `PATCH /api/lines/:id`, `DELETE /api/lines/:id`,
  `POST /api/lines/:id/tasks`. Create/edit/delete are super-admin-only; read + generate need
  only auth (managers). Rename onto an existing name → 409; missing id → 404.
- Frontend: `pages/LinesPage.tsx` (+ `LineList`/`LineCard`, `hooks/useLines` with optimistic
  create/update/delete). The **builder** is `LineForm` (+ `TanksEditor`, `hooks/useLineForm`,
  `schemas/line.ts`), reused inline on **Add line** (`CreateLinePanel`, with a "Load line4
  template" prefill) and inside `EditLineDialog`. The manager scan → task list is
  `components/TaskGenerator.tsx` (+ `TaskList`, `hooks/useTaskGenerator`). The line4 layout
  lives in `data/line4.ts`.

## Runbook

1. Sign in as **super-admin** → **Lines** → **Add line**. Either **Load line4 template** or
   build from scratch: type a name, **Add crane** codes, **Add tank** rows (name + crane, tick
   *shared* for a transfer tank and pick the second crane), then **Save line**.
2. On the **Lines** tab, use **Edit** (opens the builder in a dialog) or **Delete** (confirms
   first) on any saved line.
3. Sign in as a **manager** → Dashboard → pick the line, **Attach QR image** (or paste the
   recipe text), **Generate tasks** → the ordered task list renders (missing keys badged).

## Gotchas

- Keys for stations that aren't part of the chosen line (e.g. a recipe spanning cranes 8/9
  against line4) resolve to `missing` — that's expected, not an error.
- `next_task`/`previous_task` are **tank numbers**, not step indices; when a tank repeats in
  a recipe the number can appear more than once. Change the generator if step-linking is
  needed later.
- The QR regex rejects anything not shaped like `key=seconds;…` at the boundary (400).
