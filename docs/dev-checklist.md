# Dev Checklist (charter)

Read before a feature. Verify after. Mirrors the Definition of Done in `CLAUDE.md`.

- [ ] Linter + type-checker + tests pass on backend and frontend (e2e for UI flows).
- [ ] New/changed logic has unit + integration tests; user flows have e2e.
- [ ] Inputs validated on FE (schema, UX) and BE (schema + bounds + reject-unknown).
- [ ] Authorization + resource ownership enforced on every endpoint (no IDOR).
- [ ] Async / non-blocking on both sides; typed, actionable error handling.
- [ ] FE polish: toasts, optimistic updates + rollback, skeletons, spinners.
- [ ] AI-tool-ready docstring on every endpoint/function (Purpose / Args / Returns / Raises).
- [ ] New IDs use UUID v7; no secrets in code (`.env`/config only).
- [ ] Responsive lg / md / sm; md/sm feels native-mobile.
- [ ] Checked latest library docs (Context7) before using a library.
- [ ] Updated the matching concept doc + runbook in the same pass.
