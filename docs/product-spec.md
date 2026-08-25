# Product Spec — Crane Automation

## What

An operator-facing control application for automated plating-line cranes. Access is
role-gated: a **super admin** administers accounts, while **managers** and **operators**
run the line. v1 delivers the access layer — a unified login, a role-aware workspace
shell, and super-admin account management — that the crane-control panels will build on.

## Why

The plating line is run by different people with different authority. We need a single,
secure entry point that (a) proves who you are, (b) shows only what your role permits,
and (c) lets an administrator provision and manage accounts without a separate tool.

## Scope (v0 → v1)

- [x] Project scaffold: React + Vite frontend, Express backend, shared conventions.
- [x] MongoDB data layer (native driver; in-memory fallback for local/test).
- [x] Unified JWT login for all roles; seeded super-admin (`admin / admin`).
- [x] RBAC: super_admin / manager / operator, enforced on every endpoint.
- [x] App shell: collapsible sidebar (Dashboard first, Logout last, signed-in indicator),
      workspace placeholder showing the role in large type.
- [x] Super-admin user management (Create / Managers / Operators subtabs): add
      manager/operator with a chosen username + password, rotate any managed user's
      username/password, delete users.
- [x] Self-service: any user can change their own username/password (Account).
- [ ] Real crane-control panels per role (recipes, tanks, crane moves).

## Non-goals (for now)

- Email/SMS invites or password-reset flows (credentials are generated + shown once).
- Fine-grained permissions beyond the three roles.
- Multi-tenant / multi-site separation.
