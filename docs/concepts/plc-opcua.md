# Concept — PLC communication over OPC UA

## What it is

A two-way link between this software and a PLC, spoken in **OPC UA** — the modern,
secure, vendor-neutral industrial protocol. The app runs an OPC UA **client** in the
backend; it connects to an OPC UA **server**, reads node values (PLC → software) and
writes node values (software → PLC). The **PLC** page drives it: type an endpoint,
**Connect**, watch a value stream in, and **Send** a command.

This phase is a **proof of concept**: prove the pipe works end to end. The real crane
control logic comes later on top of this link.

## Why OPC UA — and why it's fully generic

- **OPC UA is the target** because the plant PLC is a **Siemens S7-1500**, which has a
  built-in OPC UA server. OPC UA also fits both deployments we care about: `opc.tcp` on the
  **intranet** (offline) and pub/sub over MQTT for the **cloud** later — with real security
  (certificates, auth, encryption) that Modbus lacks.
- **OpenPLC v4 speaks OPC UA natively.** The current OpenPLC line (Autonomy Logic's *OpenPLC
  Editor v4* / Autonomy Edge) can expose its global variables over an **OPC-UA server**
  directly — so for the POC our client connects **straight to OpenPLC**. No translation shim.
- **The client is protocol-generic.** It targets a **runtime-chosen endpoint + NodeIds** (the
  PLC page's input fields, defaulted from `.env`). Nothing about OpenPLC or Siemens is
  hard-coded. Moving from OpenPLC → the S7-1500 (or any OPC UA PLC) is a **config change, not
  a code change**.

## What changes between OpenPLC and the real S7-1500

| Thing | Where | Changes? |
| --- | --- | --- |
| **Endpoint URL** (`opc.tcp://…`) | PLC page field / `.env` `OPCUA_ENDPOINT` | ✅ type the new server |
| **Read / write NodeIds** | PLC page fields / `.env` `OPCUA_READ_NODE`,`OPCUA_WRITE_NODE` | ✅ the PLC's tag NodeIds |
| **Security** (None / Sign / SignAndEncrypt + policy) | `.env` `OPCUA_SECURITY_MODE`,`OPCUA_SECURITY_POLICY` (or per-connect override) | ✅ match what the server advertises |
| **Everything else** (client, service, routes, page/hook/api) | source code | ❌ unchanged |

> ⚠️ **Two OpenPLC lineages — pick the right one.** Native OPC-UA is in **OpenPLC Editor v4 /
> Autonomy Edge** (autonomylogic.com). The **legacy `openplc.com` Runtime** (the msys64 Python
> `webserver.app`) is **Modbus/DNP3/EtherNet-IP only** — it does **not** serve OPC UA. If the
> installed runtime is the legacy one, install the v4 Editor/Edge for the native OPC-UA server.

## How it fits together

**Backend:**
- `services/plc/opcua-client.ts` — the OPC UA connection manager (single client/session):
  `connect` / `disconnect` / `getConnectionStatus` / `readValue` / `writeValue`. Protocol-only,
  knows nothing about the server on the other end (`node-opcua`).
- `services/plc/opcua-security.ts` — maps our security mode/policy strings to node-opcua
  client options and owns the persistent **PKI** store (`pki/`: our own client certificate +
  the server certs we trust). `None` needs no certificate; secured modes present our cert.
- `services/plc/plc.service.ts` — business logic; maps low-level errors to typed HTTP errors
  and exposes the configured default endpoint/nodes for UI pre-fill.
- `schemas/plc.schema.ts` — Zod bounds (endpoint + NodeId regex, `strictObject`, write-type enum).
- `controllers/plc.controller.ts` + `routes/plc.routes.ts` — endpoints:
  - `GET  /api/plc/state` — connection status + default endpoint/nodes (any auth).
  - `GET  /api/plc/read?nodeId=…` — read one node (any auth).
  - `POST /api/plc/connect` — open a session (super-admin).
  - `POST /api/plc/disconnect` — close it (super-admin).
  - `POST /api/plc/command` — write a value, returns the read-back (super-admin).
- `config/env.ts` — `OPCUA_ENDPOINT` / `OPCUA_READ_NODE` / `OPCUA_WRITE_NODE` defaults, plus
  `OPCUA_SECURITY_MODE` / `OPCUA_SECURITY_POLICY` / `OPCUA_PKI_DIR` for secured connections.

**Frontend:** `pages/PlcPage.tsx` with `PlcConnectionPanel` (the endpoint field + status pill),
`PlcMonitor` (live 1 s read — PLC → software) and `PlcCommandForm` (write — software → PLC),
driven by `hooks/usePlc.ts` (+ `api/plc.ts`, `schemas/plc.ts`, `types/plc.ts`). Nav item + route
are super-admin-gated.

## Enable the OPC-UA server in OpenPLC Editor v4

1. Open your program in **OpenPLC Editor v4**. In the variables/global list, add a couple of
   **global variables** to exercise the link — e.g. a `BOOL` (write target, like a coil) and an
   `INT`/`REAL` (read source). Give them clear names.
2. In the device / communications settings, **enable the OPC-UA server**. Note the **endpoint
   URL + port** it reports (OPC UA defaults to `:4840`; the path may be appended).
3. For each variable, set it as an OPC-UA **address-space node** with **read** and/or **write**
   permission. Note each variable's **NodeId** (typically `ns=<n>;s=<VariableName>`).
4. For the POC, use the **"None" security** endpoint (no certificate) — our client connects
   without security by default. Certificates are a later hardening step (same client, same as
   the Siemens hardening).
5. Download/run the program so the server is live.

## Runbook (POC)

> Full step-by-step (start the app + configure OpenPLC + verify): **`docs/plc-opcua-openplc-setup.md`**.

1. Start OpenPLC v4 with the OPC-UA server enabled (above).
2. Run the app, sign in as **super-admin**, open **PLC**.
3. **Connect** to OpenPLC's endpoint (e.g. `opc.tcp://localhost:4840`). Put your read variable's
   NodeId in **Live read** and watch it update = PLC → software. In **Send command**, write your
   `BOOL` variable's NodeId = `true` and see the read-back flip = software → PLC. Two-way proven.

## Runbook — connecting to a **secured** endpoint (Basic256Sha256)

A real PLC (Siemens S7-1500, hardened OpenPLC) usually exposes **only secured** endpoints and
**no `None`** endpoint. Asking for `None` then fails with `End point must exist … securityMode =
None`. To connect:

1. **Discover what the server offers.** The server advertises its endpoints; match one. Our test
   PLC at `opc.tcp://192.168.1.30:4840` offers only `Basic256Sha256` with `Sign` and
   `SignAndEncrypt` (Anonymous user). Network reachability alone (`Test-NetConnection … -Port
   4840` = success) does **not** mean the security settings match.
2. **Set the security** — pick it right on the **PLC page**: the **Security** dropdown
   (None / Sign / SignAndEncrypt) + **Policy** dropdown (Basic256Sha256, …) are sent with the
   connect request. (Or set the deployment default in `.env`:
   `OPCUA_SECURITY_MODE=SignAndEncrypt`, `OPCUA_SECURITY_POLICY=Basic256Sha256`.) New terms here?
   See [`opcua-explained.md`](./opcua-explained.md) §8.
3. **First connect generates our client certificate** at `pki/own/certs/client_certificate.pem`
   and the PLC **rejects** it (it's untrusted) — the secure channel is dropped / times out.
4. **Trust our certificate on the PLC.** Move our cert from the PLC's **rejected** store to its
   **trusted** store (Siemens: *OPC UA → Security → client certificates*; OpenPLC: the server's
   PKI `rejected` → `trusted` folder). You can also import `pki/own/certs/client_certificate.pem`
   directly.
5. **Fix the PLC clock.** OPC UA validates certificate validity against the **server's** clock. If
   the PLC clock is wrong (ours reported year **2012**), our cert's `notBefore` (this year) looks
   "not yet valid" and the channel is rejected **even after trusting**. Set the PLC clock to real
   time.
6. **Reconnect.** With the cert trusted and the clock correct, `Connect` succeeds; read/write work
   unchanged. The client trusts the PLC's cert automatically on first sight (trust-on-first-use).

## Runbook (real Siemens S7-1500, later)

1. In TIA Portal enable **OPC UA → Server** on the CPU and expose the tags/DBs you need
   (needs the OPC UA runtime license on the CPU). Download to the PLC.
2. On the **PLC** page, connect to the CPU (`opc.tcp://<plc-ip>:4840`) and use the Siemens
   NodeIds. **No app code changes** — only the endpoint + NodeIds.

> Tip: to develop against Siemens **without** the physical PLC, you'd need **S7-PLCSIM Advanced**
> (a separate paid product — basic PLCSIM bundled with TIA Portal does **not** expose an OPC UA
> server). It embeds real S7-1500 firmware and serves OPC UA on `:4840`.

## Gotchas

- **Legacy OpenPLC Runtime ≠ OPC UA.** Only OpenPLC Editor **v4 / Autonomy Edge** serves OPC-UA;
  the old msys64 `webserver.app` runtime is Modbus-only.
- **NodeId format matters.** Endpoints must start `opc.tcp://`; NodeIds look like `ns=1;s=MyVar`
  (namespace + identifier). Both are validated on the backend and mirrored on the frontend.
- **A real PLC has no `None` endpoint.** It exposes only secured ones (e.g. `Basic256Sha256`
  Sign/SignAndEncrypt). Requesting `None` fails with `End point must exist … securityMode = None`
  even though TCP `:4840` is reachable. Match the server's advertised mode/policy (see the secured
  runbook above). The two failures look identical from the network but are a **security**, not a
  connectivity, problem.
- **The server must trust our client cert (one-time).** First secured connect drops/times out at
  `OpenSecureChannel` because our cert is untrusted — move it from the PLC's rejected → trusted
  store, then reconnect. Our cert lives at `pki/own/certs/client_certificate.pem` (path is also
  printed in the connect error).
- **PLC clock skew invalidates certs.** OPC UA checks cert validity against the **server** clock.
  A wrong PLC clock (ours read 2012) makes our cert look "not yet valid" and rejects the channel
  even after trusting. Set the PLC clock correctly.
- **The endpoint + NodeIds are deliberately the only swap points.** Never hard-code them in
  code — keep them in the UI / `.env` so OpenPLC → S7-1500 stays code-free.
- **OPC UA server license on the physical S7-1500.** The CPU's integrated server needs a
  *SIMATIC OPC UA S7-1500* runtime license; verify it's loaded before blaming the client.
- **One server per port.** Only one OPC UA server can bind `:4840` at a time.
