# Concepts — plain-English learning layer

One file per concept. Explain the **why & how** in plain English, updated alongside the
code that introduces or changes it (not after the fact).

Suggested shape per note:

- **What it is** — one paragraph.
- **Why we do it this way** — the reasoning / trade-offs.
- **Runbook** — the concrete steps to work with it locally.

## Concepts

- [Authentication & RBAC](./auth-rbac.md) — unified JWT login, three roles, MongoDB,
  super-admin user management (Create / Managers / Operators).
- [Styling with Tailwind CSS v4](./styling-tailwind.md) — `@theme` tokens, `@apply`
  component layer, no config file.
- [Manager QR image decoder](./qr-scanner.md) — client-side jsqr QR decode, lazy-loaded,
  manager-only.
- [PLC communication over OPC UA](./plc-opcua.md) — one protocol-generic OPC UA client,
  runtime-chosen endpoint + NodeIds; connects directly to OpenPLC v4 (native OPC-UA) or the S7-1500.
