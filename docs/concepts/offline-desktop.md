# Concept — One codebase, two homes (web + offline desktop)

## What it is

The **same** backend + frontend run in two ways:

- **Web** — Express API + MongoDB, React SPA served separately (as today).
- **Offline desktop** — an **Electron** app that bundles the built frontend, the Node
  backend, and an embedded **SQLite** database into a single installable Windows app that
  runs with no internet, no MongoDB, and no Node install on the target machine.

The switch is one backend environment variable: **`STORAGE_DRIVER`**.

## Why we do it this way

- **The layered architecture pays off (ADR-001).** All data access lives behind the
  repository layer, so supporting a second database means adding one more *driver* — not
  touching routers, services, schemas, or any frontend code.
- **`STORAGE_DRIVER` picks the driver, and only that driver loads.** `storage/index.ts`
  dynamically imports `storage/mongo/` **or** `storage/sqlite/` at boot. So a web deploy
  never needs the SQLite native module, and the offline build never needs MongoDB. (SQLite
  is an `optionalDependency` for exactly this reason.)
- **SQLite = embedded, no server process.** The whole DB is a single file in the OS
  user-data folder — trivial to back up (copy one file) and nothing to install or manage.
  Cranes/tanks (nested arrays) are stored as JSON text columns, preserving the document
  shape without extra tables.
- **One process serves everything offline.** With `CLIENT_DIR` set, Express also serves the
  built SPA (with a deep-link fallback to `index.html`), so the desktop app talks to a
  single `http://localhost:<port>` for both UI and API.

## How it fits together

```
STORAGE_DRIVER = mongo | sqlite
        │
storage/index.ts  connectStorage() ──► dynamic import of the chosen driver
        ├─ storage/mongo/   (client + user.store + line.store)   ← web
        └─ storage/sqlite/  (client + user.store + line.store)   ← offline
repositories/*.repository.ts  → thin facades over getStorage().users / .lines
```

- `storage/types.ts` — the `UserStore` / `LineStore` contracts both drivers implement.
- `config/db.ts` — compat shim: `connectDb`/`closeDb` → `connectStorage`/`closeStorage`.
- **Desktop shell** (`desktop/`): `main.js` spawns the compiled backend as a Node child
  (reusing Electron's Node via `ELECTRON_RUN_AS_NODE`) with `STORAGE_DRIVER=sqlite`,
  `SQLITE_PATH`/`CLIENT_DIR` under the user-data dir, a free port, and a per-install
  generated `JWT_SECRET`; it waits for `/api/health`, then opens the window.
- **Bundler** (`desktop/scripts/bundle.mjs`): builds FE+BE → stages the backend with
  production deps → rebuilds `better-sqlite3` for Electron's ABI → runs electron-builder.

## Runbook

**Web (unchanged):** run backend + frontend as before; `STORAGE_DRIVER=mongo` (default).

**Build the offline app (Windows):**
```bash
cd desktop
npm install            # first time only (downloads Electron)
npm run bundle         # → desktop/release/<installer>.exe
```
Then run the installer; the app stores its SQLite DB + JWT secret under
`%APPDATA%/Crane Automation`. First login is the seeded `admin / admin`.

**Try the offline backend without Electron (sanity check):**
```bash
cd backend && npm run build
STORAGE_DRIVER=sqlite SQLITE_PATH=./data/crane.db \
  CLIENT_DIR=../frontend/dist PORT=43117 NODE_ENV=production \
  JWT_SECRET=local-offline-secret-please-change node dist/index.js
# → http://localhost:43117 serves the SPA + API from one sqlite file
```

## Gotchas

- **Native module ABI is the one real snag.** `better-sqlite3` is compiled; when the backend
  runs under Electron (`ELECTRON_RUN_AS_NODE`) it needs Electron's ABI, not system Node's.
  The bundler runs `electron-rebuild` on the staged backend to handle this — if a prebuilt
  Electron binary isn't fetched, that step compiles from source and needs VS Build Tools.
- Helmet's default CSP is **disabled only when `CLIENT_DIR` is set**, because the built
  `index.html` uses a small inline theme script. The web deploy keeps full CSP.
- The SQLite `-wal`/`-shm` sidecar files next to `crane.db` are normal (WAL mode).
- Data does **not** sync between the web (Mongo) and desktop (SQLite) instances — they're
  independent stores by design. A future export/import could bridge them if needed.
