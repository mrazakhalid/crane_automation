# Project Starter — Engineering Charter & Boilerplate

> **What this is.** A portable, project-agnostic starter kit distilled from the Crane Automation
> codebase. Drop this file at the root of a **new** project (or paste it into a `CLAUDE.md`) and an
> AI agent — or a human — can scaffold a full-stack TypeScript app that follows the same
> architecture, security posture, code style, tooling, and workflow rules.
>
> **How to use it.** Read the *Principles* + *Definition of Done* before writing any feature; verify
> against them after. Copy the *Boilerplate* snippets verbatim to bootstrap the skeleton. Everything
> here is generic — swap the domain nouns (`line`, `plc`, `user`) for your own.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | React 19 + Vite 7 + TypeScript | Axios for HTTP, React Router 7, Tailwind 4 |
| **Backend** | Express 5 + TypeScript (**ESM**) | Zod for validation, layered architecture |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | Bearer tokens, RBAC roles |
| **Data** | Pluggable driver (Mongo default / SQLite offline) | Repository pattern hides the driver |
| **Linter** | ESLint (flat config) | `tsc` does type-checking, not ESLint |
| **Types** | `tsc --noEmit` / `tsc -b` | `strict: true`, NodeNext modules |
| **Tests** | Vitest (+ Supertest BE, Testing Library FE) | hermetic in-memory DB for BE tests |
| **IDs** | `uuid` → `v7` | time-ordered, never auto-increment |
| **Icons** | `lucide-react` | **never emoji** as UI icons |
| **Desktop (optional)** | Electron + `better-sqlite3` | one process serves SPA + API offline |

### Exact dependency set (proven-compatible versions)

**Backend `package.json`:**
```jsonc
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^5.1.0",
    "express-rate-limit": "^8.0.1",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.3",
    "mongodb": "^7.5.0",
    "uuid": "^11.1.0",
    "zod": "^4.0.5"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.3",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^22.15.0",
    "@types/supertest": "^6.0.3",
    "eslint": "^10.8.0",
    "globals": "^17.8.0",
    "mongodb-memory-server": "^11.2.0",
    "supertest": "^7.1.1",
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.65.0",
    "vitest": "^3.2.4"
  }
}
```

**Frontend `package.json`:**
```jsonc
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "axios": "^1.11.0",
    "lucide-react": "^1.28.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-router-dom": "^7.11.0",
    "tailwindcss": "^4.3.3",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^10.8.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "globals": "^17.8.0",
    "jsdom": "^29.1.1",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.65.0",
    "vite": "^7.0.6",
    "vitest": "^3.2.4"
  }
}
```

> **Always check latest library docs (Context7 or official docs) before adding a library** and prefer
> the latest stable syntax. Pin nothing you can't justify.

---

## 2. Core principles

- **Separation of concerns.** `routers (HTTP) → services (logic) → repositories/models (data)`.
  Each layer is **ignorant of the layers above it**. HTTP concerns never leak into business logic;
  data-access never leaks into routers.
- **DRY + KISS.** Files ≤ **~100 LOC**. Split an oversized file into cohesive modules. One reason to
  change per file. Prefer the boring, obvious solution.
- **Validate & sanitize all input at the boundary.** The **backend is the source of truth**: Zod
  schema validation with real bounds (min/max length, ≤/≥ ranges, regex, and **reject unknown fields
  via `z.strictObject`**). The frontend mirrors the same schema **for UX only** — never trust it.
- **Security-first, no cut corners.** Authz + resource-ownership check on **every** endpoint (no
  IDOR), parameterized queries only, rate limiting, security headers (Helmet), least privilege, and
  secrets in a single gitignored `.env` — never in code.
- **Backend is always the source of truth for validation;** the frontend only mirrors it for UX.
- **Async everywhere.** Non-blocking on both sides; typed error handling with specific, actionable
  messages.

---

## 3. Project structure

Monorepo with independent `backend/` and `frontend/` packages (+ optional `desktop/`).

```
project-root/
├─ CLAUDE.md / PROJECT-STARTER.md   # this charter
├─ README.md
├─ .gitignore                       # node_modules, dist, .env, coverage, *.tsbuildinfo …
├─ start-<app>.bat                  # one-click dev launcher (see §11)
├─ docs/                            # concepts/, architecture.md, progress.md, software-flow.md …
├─ scripts/                         # ops scripts (ps1/mjs)
├─ backend/
│  ├─ eslint.config.js  tsconfig.json  vitest.config.ts  package.json
│  └─ src/
│     ├─ index.ts                   # boot: connect storage → seed → listen
│     ├─ app.ts                     # createApp(): wires middleware + routes (no listen)
│     ├─ config/                    # env.ts (Zod-validated), db.ts
│     ├─ routes/                    # *.routes.ts + index.ts (aggregator) — HTTP wiring only
│     ├─ controllers/               # thin: parse req → call service → shape res
│     ├─ services/                  # business logic; ignorant of HTTP + driver
│     ├─ repositories/              # data-access facade → active storage driver
│     ├─ storage/                   # types.ts (contracts) + mongo/ + sqlite/ drivers
│     ├─ models/                    # domain shapes + toPublicX() mappers (no logic)
│     ├─ schemas/                   # Zod request schemas (validation source of truth)
│     ├─ middleware/                # auth, validate, error-handler, not-found, rate-limit
│     ├─ utils/                     # http-error.ts, id.ts (small, pure)
│     ├─ types/                     # express.d.ts (augment Request), shared types
│     └─ __tests__/                 # *.test.ts (unit + integration via supertest)
└─ frontend/
   ├─ eslint.config.js  vite.config.ts  tsconfig*.json  index.html  package.json
   └─ src/
      ├─ main.tsx  App.tsx          # providers + route tree
      ├─ api/                       # client.ts (axios instance) + one file per feature
      ├─ pages/                     # route-level screens
      ├─ components/                # reusable UI (Modal, Spinner, Toast, guards…)
      ├─ hooks/                     # data hooks (useX) — own fetch + optimistic state
      ├─ context/                   # providers + context objects (auth, theme, toast)
      ├─ schemas/                   # Zod mirrors of backend schemas (UX only)
      ├─ types/                     # TS types shared across the app
      ├─ utils/                     # pure helpers
      └─ __tests__/                 # *.test.tsx (Testing Library)
```

**Layering rule of thumb — a request flows one way:**
`route → validate middleware → auth/role middleware → controller → service → repository → storage`.
Add a new feature by creating one file in each layer (schema, controller, service, repository,
routes) and registering the router in `routes/index.ts`.

---

## 4. Backend conventions

### 4.1 ESM + NodeNext (non-negotiable)
- `"type": "module"`, `tsconfig` `module`/`moduleResolution` = **`NodeNext`**.
- **Relative imports in `.ts` source MUST use the `.js` extension**: `import { env } from './config/env.js'`.
- `verbatimModuleSyntax: true` → use `import type { … }` for type-only imports.

### 4.2 Validated environment (`config/env.ts`)
Single source of truth for runtime config; **fails fast at boot** if anything is missing/malformed.
```ts
import 'dotenv/config';
import * as z from 'zod';

// Use z.object (NOT strictObject): process.env carries hundreds of OS/npm keys.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('dev-only-insecure-secret-change-me'),
  JWT_EXPIRES_IN: z.string().min(1).default('12h'),
  // …app-specific keys with bounds + sensible dev defaults…
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', z.treeifyError(parsed.error));
  process.exit(1);
}
export const env = Object.freeze(parsed.data);
```

### 4.3 App assembly (`app.ts`) — export the app, not the listener
`createApp()` wires middleware in the correct order and returns the Express app **without listening**,
so tests import it via Supertest without opening a port. Order matters:
```ts
export function createApp(): Express {
  const app = express();
  app.use(helmet());                       // security headers first
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(createGlobalLimiter());          // rate limiting
  app.use('/api/auth/login', createLoginLimiter());
  app.use(express.json({ limit: '1mb' })); // body parsing with bounds
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', apiRouter);              // feature routes
  app.use(notFound);                       // 404 …
  app.use(errorHandler);                   // …then centralized error handler LAST
  return app;
}
```
`index.ts` is the only place that connects storage, seeds, and calls `app.listen()`.

### 4.4 Validation middleware (`middleware/validate.ts`)
One factory validates `body`/`query`/`params` at the boundary and forwards `ZodError` to the handler.
> **Express 5 gotcha:** `req.query` and `req.params` are **getter-only** — mutate in place with
> `Object.assign`, never reassign.
```ts
export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) { next(err); }
  };
}
```

### 4.5 Typed errors + central handler
Services throw domain errors with a status + actionable message; the handler shapes the response and
hides detail in production.
```ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = 'HttpError'; this.status = status; }
}
export const badRequest    = (m: string) => new HttpError(400, m);
export const unauthorized  = (m: string) => new HttpError(401, m);
export const forbidden     = (m: string) => new HttpError(403, m);
export const notFoundError = (m: string) => new HttpError(404, m);
export const conflict      = (m: string) => new HttpError(409, m);
```
```ts
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) return void res.status(400).json({ error: 'Validation failed', issues: err.issues });
  const status  = typeof err?.status === 'number' ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(status).json({ error: env.NODE_ENV === 'production' ? 'Internal Server Error' : message });
}
```
Controllers stay thin and always `try/catch → next(err)`:
```ts
export async function postThing(req, res, next) {
  try { res.status(201).json({ thing: await createThing(req.body) }); }
  catch (err) { next(err); }
}
```

### 4.6 Zod request schemas (`schemas/*.ts`) — the validation source of truth
- Always `z.strictObject({...})` for request bodies (reject unknown fields).
- Real bounds on every field: `.trim().min().max()`, `.regex()`, numeric `.int().min().max()`.
- Route params validated too (`z.strictObject({ id: z.uuid() })`).
- Export `z.infer<>` types so services are typed from the schema.
```ts
import * as z from 'zod';                         // Zod v4 import style
export const createLineSchema = z.strictObject({
  name: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9 _-]+$/, 'letters, numbers, space, _ , -'),
  cranes: z.array(z.string().trim().min(1).max(10)).min(1).max(20),
});
export type CreateLineInput = z.infer<typeof createLineSchema>;
```

### 4.7 Auth + RBAC (`middleware/auth.ts`, `models/user.model.ts`)
- Roles are a fixed, ordered `const` tuple → derive the type from it:
  ```ts
  export const ROLES = ['super_admin', 'manager', 'operator'] as const;
  export type Role = (typeof ROLES)[number];
  ```
- `requireAuth` verifies `Authorization: Bearer <jwt>` and attaches `req.user`.
- `requireRole(...roles)` chains **after** `requireAuth` and 403s otherwise.
- **Every endpoint gets an ownership/authz check** — never trust an id from the client without
  confirming the caller may touch that resource (no IDOR).
- Passwords hashed with `bcryptjs`; **never return the hash** — models expose a `toPublicX()` mapper
  that strips sensitive fields.
```ts
router.use(requireAuth);
router.post('/', requireRole('super_admin'), validate({ body: createLineSchema }), postLine);
router.get('/:id', validate({ params: idParamSchema }), getLineById);
```

### 4.8 Data access — repository facade over swappable drivers
- `storage/types.ts` defines a `Storage` interface (one `*Store` per entity). Everything above the
  repo depends only on these interfaces.
- `storage/index.ts` picks the driver from `STORAGE_DRIVER` at connect time and **dynamically
  imports only the chosen one** (so a web build never loads the SQLite native module, and vice-versa).
- `repositories/*.ts` are thin forwarders: `getStorage().lines.findById(id)`.
- Services never see the driver. Swapping Mongo↔SQLite is config, not code.
- **Parameterized queries only.** New IDs via the `newId()` (UUID v7) helper.

---

## 5. Frontend conventions

### 5.1 Central Axios client (`api/client.ts`)
One instance; a request interceptor attaches the bearer token, a response interceptor drops a dead
session on 401, and `apiErrorMessage()` normalizes errors so UI reads `response.data.error`.
```ts
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});
apiClient.interceptors.request.use((c) => {
  const t = getStoredToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c;
});
```
> **Vite env vars** reach the client only when prefixed `VITE_`. Anything secret stays on the backend.

### 5.2 One API module per feature (`api/*.ts`)
Typed thin wrappers returning the payload, e.g. `listLines(): Promise<Line[]>`. No React in here.

### 5.3 Data hooks (`hooks/useX.ts`) own state + UX
Each hook owns list/loading/error, exposes `reload`/`create`/`update`/`remove`, and does
**optimistic updates with rollback** + toasts on failure:
```ts
const remove = useCallback(async (id: string) => {
  const snapshot = items;
  setItems((prev) => prev.filter((i) => i.id !== id));   // optimistic
  try { await api.remove(id); notify('Removed', 'success'); }
  catch (err) { setItems(snapshot); notify(apiErrorMessage(err), 'error'); } // rollback
}, [items, notify]);
```

### 5.4 Schemas mirror the backend (`schemas/*.ts`) — UX only
Same bounds as the backend, `z.object` (not strict) is fine here since it's just for friendly
instant feedback. **Never the source of truth.**

### 5.5 Routing + guards (`App.tsx`)
Compose global providers (Theme → Toast → Auth → Router), then a public `/login` and an
authenticated shell whose branches are gated by `<RequireAuth>` / `<RequireRole roles={[...]}>`.
Unknown paths redirect home.

### 5.6 UX polish (required, not optional)
Toasts, optimistic updates with rollback, skeletons, spinners, loading/empty/error states.
Responsive at **lg / md / sm**; md and sm must feel native-mobile.

### 5.7 UI conventions (from project memory)
- **No emoji as icons — use `lucide-react`.**
- Page options live in a **top nav/tab bar**; content is **centered in the free workspace**.

---

## 6. Security checklist (every endpoint)

- [ ] Authenticated (`requireAuth`) unless deliberately public.
- [ ] Authorized (`requireRole`) + **resource-ownership** check (no IDOR).
- [ ] Body/query/params validated with Zod **bounds + `strictObject`** (reject unknown fields).
- [ ] Parameterized queries only; no string-built queries.
- [ ] Rate limited (generous global; strict on login — count only failed attempts).
- [ ] Helmet security headers on; CORS locked to an allow-list origin.
- [ ] Body size bounded (`express.json({ limit: '1mb' })`).
- [ ] Secrets only in gitignored `.env`; `JWT_SECRET` long/random in prod.
- [ ] Errors are typed + actionable; internal detail hidden in production.
- [ ] Passwords hashed (`bcryptjs`); sensitive fields stripped via `toPublicX()`.

**Rate-limit pattern** (factories, not singletons, so tests are isolated; skip high-frequency
authenticated poll paths so live UIs don't 429 themselves):
```ts
export const createGlobalLimiter = () => rateLimit({
  windowMs: 15*60*1000, limit: 600, standardHeaders: true, legacyHeaders: false,
  skip: (req) => POLL_PATHS.has(req.path),
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
export const createLoginLimiter = () => rateLimit({
  windowMs: 15*60*1000, limit: 20, skipSuccessfulRequests: true,   // only failed logins count
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});
```

---

## 7. Code style & file-length rules

- **Files ≤ ~100 LOC.** Split oversized files into cohesive modules.
- Every exported function/endpoint has an **AI-tool-ready docstring**: `Purpose / Args / Returns /
  Raises`. (See any snippet above for the house style.)
- Match the surrounding code's naming, comment density, and idiom.
- Naming: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`,
  `*.model.ts`, `*.store.ts`; hooks `useThing.ts`; API modules match the feature noun.
- Prefer `const` + pure helpers; keep controllers thin and services logic-only.
- New IDs use **UUID v7** (`uuid` → `v7`). No secrets in code.

---

## 8. Testing

- **Vitest** on both sides. Backend: unit (services) + integration (Supertest against `createApp()`).
  Frontend: Testing Library for components/pages; add e2e for user flows.
- Backfill tests for any code you touch. New/changed logic → unit + integration; user flows → e2e.
- **Hermetic backend tests:** force an isolated in-memory DB in `vitest.config.ts` so the suite never
  reads/writes a developer's real database:
  ```ts
  export default defineConfig({ test: { env: { MONGODB_URI: '', MONGODB_DB: 'app_test' } } });
  ```
- Both `lint`, `typecheck`, and `test` must pass on backend **and** frontend before "done".

---

## 9. Tooling configs (copy verbatim)

**`backend/tsconfig.json`:**
```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "lib": ["ES2022"], "outDir": "dist", "rootDir": "src",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true, "resolveJsonModule": true,
    "declaration": true, "sourceMap": true,
    "noUncheckedIndexedAccess": true, "noImplicitOverride": true, "verbatimModuleSyntax": true
  },
  "include": ["src/**/*"], "exclude": ["node_modules", "dist"]
}
```

**`backend/eslint.config.js` (flat):**
```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
);
```
(Frontend eslint is the same plus `eslint-plugin-react-hooks` with `globals.browser`.)

**`frontend/vite.config.ts`:**
```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } }, // proxy API in dev
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts', css: false },
});
```

**`.gitignore` essentials:** `node_modules/`, `dist/`, `build/`, `.env`, `.env.*.local`, `*.log`,
`coverage/`, `.vite/`, `*.tsbuildinfo`, `.DS_Store`, `Thumbs.db`.

---

## 10. Definition of Done (per change)

- [ ] Lint + type-check + tests pass on **both** backend and frontend (e2e for UI flows).
- [ ] New/changed logic has unit + integration tests; user flows have e2e; backfill tests for touched code.
- [ ] Inputs validated on FE (schema, UX) **and** BE (schema with bounds + reject-unknown); authz + ownership enforced (no IDOR).
- [ ] Non-blocking (async) on both sides; typed error handling with specific, actionable messages.
- [ ] FE UX polish: toasts, optimistic updates with rollback, skeletons, spinners.
- [ ] Every endpoint/function has an AI-tool-ready docstring (Purpose / Args / Returns / Raises).
- [ ] New IDs use UUID v7; no secrets in code (`.env`/config only).
- [ ] Responsive: lg / md / sm verified; md/sm feel native-mobile.
- [ ] Checked latest library docs before using a library; prefer latest stable syntax.
- [ ] Updated the matching concept/learning doc + runbook in the same pass.

---

## 11. One-click dev launcher (`.bat` auto-run)

A double-click launcher opens the editor and starts every dev process in split terminals, so a fresh
machine is running in one click. Keep the *keystroke timing* in a separate PowerShell script so it's
tunable without touching the `.bat`.

**`start-<app>.bat`:**
```bat
@echo off
REM One-click dev launcher: opens the project in VS Code and starts
REM   Terminal 1 -> the AI CLI
REM   Terminal 2 -> split: left = frontend `npm run dev`, right = backend `npm run dev`
REM   Terminal 3 -> optional build/menu task
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch-terminals.ps1"
```

**`open-app.bat`** (open the running UI in the browser):
```bat
@echo off
start msedge "http://localhost:5173/"
```

`tools/launch-terminals.ps1` opens VS Code (`code .`), then drives the integrated terminal via
`WScript.Shell` `SendKeys` with tunable delays: `Ctrl+J` (terminal 1), `Ctrl+Shift+\`` (new
terminal), `Ctrl+Shift+5` (split), `Alt+Left`/`Alt+Right` (focus pane), typing `cd backend & npm run
dev` etc. Raise the delays at the top of the script if a command lands in the wrong pane. Optionally
ship a `.lnk` shortcut pointing at the `.bat` so it gets a custom icon.

---

## 12. Documentation discipline

Keep docs alongside code, not after:
- `docs/concepts/` — plain-English "why & how" learning notes, one per subsystem.
- `docs/architecture.md` — architecture + ADRs. `docs/product-spec.md` — what & why.
- `docs/progress.md` — resume-here log: phases done/remaining, held commits, pending deploys.
- `docs/software-flow.md` — how a request flows FE→API→service→data, **+ a dated build-log** entry
  on every build/change (newest first).
- `docs/dev-checklist.md` — the DoD charter (read before a feature, verify after).
- Record **gotchas** ("do not relearn these") so hard-won lessons aren't repeated.

---

## 13. Generic gotchas (do not relearn these)

- **Backend is ESM + NodeNext:** relative imports in `.ts` must use the `.js` extension.
- **Express 5 `req.query`/`req.params` are getter-only** — mutate in place (`Object.assign`), don't reassign.
- **Zod v4:** import as `import * as z from 'zod'`; use `z.treeifyError(err)` for readable output and
  `z.strictObject({...})` to reject unknown fields on request bodies.
- **Never validate `process.env` with `z.strictObject`** — it carries hundreds of OS/npm keys and
  will fail with "Unrecognized keys". Use `z.object` (strips extras). Reject-unknown is for client
  bodies, not the environment.
- **Vite env vars** are exposed to the client only when prefixed `VITE_`; secrets stay on the backend.
- **Rate limiting vs live-poll UIs:** a small global cap gets exhausted by a 1/s poll and 429s every
  route including `/login`. Use a generous global limiter that **skips** authenticated poll paths,
  plus a strict **login** limiter with `skipSuccessfulRequests`. Make limiters **factories** (fresh
  store per `createApp()`) so tests stay isolated.
- **If you add a native module (e.g. `better-sqlite3`) for both Node and Electron**, remember the
  compiled binary targets ONE ABI — rebuild per runtime (`electron-rebuild -f …` for the desktop,
  `npm rebuild` for Node tests). Make the affected test suite auto-skip via an ABI probe so `npm
  test` stays green under either runtime.

---

### TL;DR for the agent picking this up
Scaffold the two packages with the exact deps above. Follow the **routers → services →
repositories/models** layering, validate every input with Zod (`strictObject` + bounds) on the
backend and mirror it on the frontend for UX, enforce auth + role + ownership on every endpoint, keep
files ≤ ~100 LOC with `Purpose/Args/Returns/Raises` docstrings, use UUID v7 and `.env`-only secrets,
ship optimistic UX with toasts/spinners, and make `lint` + `typecheck` + `test` green on both sides
before calling anything done.
