# Crane Automation

Monorepo: **React + Vite + TypeScript** frontend and **Express 5 + TypeScript** backend.
HTTP calls use **Axios**; validation uses **Zod** at the boundary.

## Stack (latest as of scaffold)

| Layer     | Tech                                                        |
| --------- | ---------------------------------------------------------- |
| Frontend  | React 19, Vite 7, TypeScript 5, Tailwind CSS 4, Axios 1, React Router 7 |
| Backend   | Express 5, TypeScript 5, Zod 4, MongoDB, JWT + bcrypt, Helmet, CORS, rate-limit |
| Tooling   | ESLint (lint), tsc (type-check), Vitest (test)             |

### First run

Sign in with the seeded super-admin **`admin / admin`**, then change it on the Account
tab. Leave `MONGODB_URI` empty locally to auto-start an in-memory MongoDB (zero setup);
set it to a real URI for production. See `docs/concepts/auth-rbac.md`.

## Layout

`backend/` and `frontend/` are **independent npm projects** — each has its own
`package.json`, lockfile, and `node_modules`. There is no root package.json and no
workspace hoisting, so the two apps can be built, versioned, and deployed on different
infrastructure. You just work inside each folder directly.

```
crane_automation/
├── backend/    # Express API (own node_modules) — routers → services → repositories → storage
├── frontend/   # React SPA (own node_modules) — Vite + Axios client
├── desktop/    # Electron shell + bundler for the offline desktop build
├── docs/       # architecture, product-spec, progress, dev-checklist, concepts
└── CLAUDE.md   # engineering charter (read before building)
```

## Web vs. offline desktop (one codebase)

The backend runs against either database via the **`STORAGE_DRIVER`** env var:

- `STORAGE_DRIVER=mongo` — web deployment (default; MongoDB).
- `STORAGE_DRIVER=sqlite` — offline desktop (embedded SQLite, no server).

Build the offline Windows app:

```bash
cd desktop
npm install       # first time (downloads Electron)
npm run bundle    # → desktop/release/<installer>.exe
```

See `docs/concepts/offline-desktop.md` for how it works and the one native-module gotcha.

## Getting started

Backend (one terminal):

```bash
cd backend
npm install
cp .env.example .env
npm run dev        # http://localhost:3000
```

Frontend (another terminal):

```bash
cd frontend
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

The frontend dev server proxies `/api` → `http://localhost:3000`.

## Per-app scripts

Run these from inside `backend/` or `frontend/`:

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` / `npm run typecheck` / `npm run test`
