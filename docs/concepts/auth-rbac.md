# Concept — Authentication & Role-Based Access Control (RBAC)

## What it is

A unified login backed by MongoDB. Every user has one of three roles —
**super_admin**, **manager**, **operator** — and a single login form serves all of
them. Login returns a **JWT** (JSON Web Token) that the frontend stores and sends on
every request. The backend re-checks the token (and the role) on every protected
endpoint.

- **super_admin** — can create **any** user, including another super-admin (choosing the
  role — no default — and typing the username + password twice to re-verify), rotate any
  managed user's username/password, and delete them. The Users screen uses a top page-nav
  bar with **Create user / Managers / Operators / Super Admins**. Super-admins appear in
  their list **read-only** (the backend refuses to edit/delete them — a super-admin changes
  their own login on the Account page).
- **manager / operator** — sign in and see their workspace; they cannot manage users.
- Everyone can change **their own** username/password (the Account page). This is how
  the seeded super-admin moves off the default `admin / admin`.

## Why we do it this way

- **JWT, not server sessions** — the API stays stateless and horizontally scalable
  (matches the "two apps on different infra" architecture). The claim set is tiny:
  `sub` (user id), `username`, `role`.
- **Passwords are hashed with bcrypt** — we never store or return a plaintext password.
  The super-admin sets a new user's username + password at creation; a forgotten password
  is reset (rotated), never recovered.
- **Backend is the source of truth** — every body is validated with a Zod
  `strictObject` (rejects unknown fields, enforces bounds). The frontend mirrors those
  rules only for instant UX feedback.
- **No IDOR / privilege escalation** — user-management routes are gated by
  `requireAuth` + `requireRole('super_admin')`, *and* the service layer refuses to touch
  any `super_admin` record. So even a crafted request can't edit/delete a super-admin
  through the management API.
- **Unique username index** — enforced at the database, not just in code.

## How it fits together (layers)

```
Login form ─▶ POST /api/auth/login ─▶ auth.service (verify bcrypt) ─▶ signToken ─▶ JWT
JWT ─▶ requireAuth (verify) ─▶ requireRole('super_admin') ─▶ user.controller ─▶ user.service ─▶ user.repository ─▶ MongoDB
```

- `config/db.ts` owns the MongoClient. If `MONGODB_URI` is empty in dev/test it starts
  an **in-memory MongoDB** automatically, so the app runs with zero setup. Production
  **requires** a real `MONGODB_URI`.
- `services/seed.ts` guarantees a super-admin exists on first boot (default
  `admin / admin`, configurable via `SEED_ADMIN_*`).

## Runbook

1. **Configure (optional):** `cd backend && cp .env.example .env`. Leave `MONGODB_URI`
   empty to use the in-memory DB, or point it at `mongodb://localhost:27017` / Atlas.
   Set a strong `JWT_SECRET` for anything non-local.
2. **Run:** `npm run dev` in `backend/` and in `frontend/` (see `docs/commands/run.txt`).
3. **Log in:** open the frontend, sign in with `admin / admin`.
4. **Change the admin password immediately:** Account tab → set a new password.
5. **Add a manager/operator:** Users tab (super-admin only) → **Create user** subtab →
   pick the role, type a username + password, Create. Find them under the **Managers** /
   **Operators** subtabs.
6. **Rotate someone's credentials:** Users tab → Managers/Operators → Edit on their row.
7. **Test:** `npm test` in each app. `backend/vitest.config.ts` blanks `MONGODB_URI` so the
   suite always spins up an isolated in-memory MongoDB — it never touches your real dev DB.
   Tests cover login, RBAC (403s), duplicate-username (409), bounds (400), rotation, delete.

## Gotchas

- Passwords are never shown after creation. If one is lost, use Edit to set a new one.
- `JWT_SECRET` must be ≥16 chars (enforced by env validation). Changing it invalidates
  all existing tokens (everyone must log in again).
- Tokens expire per `JWT_EXPIRES_IN` (default `12h`); a 401 clears the stored token and
  bounces the user to `/login`.
