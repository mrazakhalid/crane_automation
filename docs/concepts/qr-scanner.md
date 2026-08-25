# Concept — QR image decoding (`decodeQrFromFile`)

> **Note:** The Manager dashboard now shows the **task generator** (scan a recipe → task
> list) rather than the raw decoder. That tool reuses the same `decodeQrFromFile` util
> described here — see `docs/concepts/lines.md`. `QrScanner.tsx` remains as a standalone
> decode-only component (and its unit test); this doc explains the shared decoding core.

## What it is

`decodeQrFromFile(file)` turns a QR-code image into its encoded string, fully in the
browser. The standalone `QrScanner.tsx` wraps it in an attach/preview/copy UI; the manager
`TaskGenerator` uses the same util to get the recipe text before generating tasks.

## Why we do it this way

- **Fully client-side.** Decoding uses `jsqr` in the browser (image → `<canvas>` →
  pixels → `jsQR`). The image never leaves the device — no upload endpoint, no server
  round-trip, nothing to secure on the backend.
- **Role-scoped + code-split.** The tool is manager-only and **lazy-loaded**
  (`React.lazy`), so `jsqr` ships in a separate chunk that only downloads when a manager
  actually opens the dashboard — the main bundle stays lean for everyone else.
- **Robust-ish decoding.** The image is down-scaled to ≤1600px for performance and jsQR
  runs with `inversionAttempts: 'attemptBoth'` so light-on-dark and dark-on-light codes
  both decode.

## How it fits together

- `utils/qr.ts` → `decodeQrFromFile(file)`: validates it's an image, draws it to a canvas,
  reads `ImageData`, runs jsQR, returns the string (throws on non-image / no-QR).
- `components/QrScanner.tsx`: the UI — attach button, preview, textarea, copy/clear, toasts,
  busy/error states. Pure UI; all decoding lives in the util.
- `pages/DashboardPage.tsx`: renders `<QrScanner/>` only when `user.role === 'manager'`.

## Runbook

1. Sign in as a manager → Dashboard.
2. Click **Attach image**, choose a QR-code image (png/jpg/…).
3. The decoded text appears in the **Decoded data** textarea; use **Copy** or edit it.
4. **Clear** resets the tool.

## Gotchas

- jsQR needs the QR reasonably legible; a tiny QR inside a large photo may not decode —
  crop closer and retry (the "No QR code found" error is expected there).
- Tests mock `decodeQrFromFile` because jsdom can't render an image to a canvas — the
  component's UI wiring is what's tested, not jsQR itself. See `__tests__/QrScanner.test.tsx`.
