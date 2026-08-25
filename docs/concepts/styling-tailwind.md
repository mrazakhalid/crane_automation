# Concept — Styling with Tailwind CSS v4

## What it is

The frontend is styled with **Tailwind CSS v4** (utility-first CSS). Setup is minimal and
lives entirely in code — there is **no `tailwind.config.js`** and **no PostCSS config** in
v4:

- `@tailwindcss/vite` plugin in `frontend/vite.config.ts`.
- `frontend/src/index.css` starts with `@import "tailwindcss";`.
- Design tokens are defined with the **`@theme`** directive (colors, radius, fonts,
  shadow). Each token also generates utilities — e.g. `--color-panel` → `bg-panel`,
  `text-panel`, `border-panel`.

## Why we do it this way

- **One source of truth for the design system.** The industrial dark palette (slate
  surfaces, safety-amber primary, per-role accents) lives in `@theme`, so both the
  hand-written component classes *and* any inline utilities pull from the same tokens.
- **Semantic component classes, Tailwind-powered.** Reusable primitives (`.btn`,
  `.navitem`, `.badge`, `.card`, `.modal`, `.toast`, …) are composed in
  `@layer components` with `@apply`. This keeps the JSX readable and the repeated
  15-utility strings out of markup, while still being real Tailwind.
- **Utilities available everywhere.** New JSX can drop `class="flex gap-4 bg-panel …"`
  directly — no import, no config change.

## Page layout convention

Every workspace page follows one shape: **page options live in a top full-width nav bar,
and content is centered (both axes) in the free space below.**

```
.page (flex col, h-full)
 ├─ <PageTabs/>        ← optional top nav bar (.page-tabs); scrolls x on small screens
 └─ .page-body (flex, overflow-y-auto)
     └─ .page-body__inner (margin:auto, max-width)   ← centered H+V, stays scrollable when tall
```

`margin:auto` on a single flex child is what centers it on both axes without clipping tall
content. See `pages/UsersPage.tsx` for the canonical use (tabs + centered body). This is the
standing pattern — new pages with section switches should put them in a `PageTabs` bar, not
inline.

## Icons

UI icons come from **`lucide-react`** — never emojis or unicode glyphs (they render
inconsistently and look unpolished). Import a named icon and render it as a component,
marking decorative ones `aria-hidden`:

```tsx
import { Users } from 'lucide-react';
<Users size={18} aria-hidden />
```

Icons inherit `currentColor`, so they pick up the surrounding text color and adapt to
light/dark automatically. Icon-only buttons still need an `aria-label` on the button.

## Light / dark theme

Dark is the default; light is opt-in and remembered. It works purely by swapping CSS
variables — no duplicated rules:

- Every color is a `@theme` token (dark values). A `:root[data-theme='light'] { … }` block
  overrides those same `--color-*` variables (plus role accents) with light values. Higher
  specificity than `:root` means the override wins.
- `<html data-theme="…">` is set two ways: an inline script in `index.html` sets it before
  first paint (no flash), and `ThemeProvider` keeps it in sync + persists to
  `localStorage` (`crane.theme`). Initial value falls back to `prefers-color-scheme`.
- The toggle lives in the sidebar (`useTheme().toggle`).
- Accent-on-surface bits that can't be a single token — avatar text, danger button/error,
  skeleton shimmer, spinner ring, the role-hero gradient — use `color-mix(…)` or the
  `--color-on-role` / `--color-ink` tokens so they adapt to both themes automatically.

## How to work with it

- **Add a color/token:** add `--color-foo: #…;` inside `@theme` in `index.css`. It's now
  usable as `bg-foo` / `text-foo` and via `var(--color-foo)` in custom CSS.
- **Style a new component:** prefer inline utilities in the JSX for one-offs; if a pattern
  repeats, promote it to a class in `@layer components` with `@apply`.
- **Advanced CSS** (gradients, `@keyframes`, `::after`, media queries) is written as plain
  CSS alongside — Tailwind v4 is just CSS with extra at-rules.
- **Role accents** (`--role-super_admin`, etc.) are plain `:root` variables (not `@theme`)
  because they're only referenced by dynamic class names in custom CSS, not as utilities.

## Runbook

- Dev: `npm run dev` in `frontend/` — the Vite plugin compiles Tailwind on the fly (HMR).
- Build: `npm run build` — Tailwind scans the source and emits only the used utilities.
- Tests don't process CSS (`css: false` in the Vitest config), so component tests query by
  role/text, never by class — restyling never breaks them.

## Gotchas

- `@theme` must be **top-level** — it can't be nested under a selector or media query.
- Tailwind's **preflight** reset is included by the `@import`. It strips default margins,
  heading sizes, list styles, and button chrome — our component classes set what they need,
  so style explicitly rather than relying on browser defaults.
- Color tokens with underscores (e.g. a role name) make awkward utility names; keep those
  as `:root` vars instead. See [[auth-rbac]] for where roles are used.
