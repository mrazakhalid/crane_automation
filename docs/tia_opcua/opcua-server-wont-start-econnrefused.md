# Real PLC connects on one IP but not another — `ECONNREFUSED` on `:4840`

**Symptom (the exact case we hit):** two real S7-1500 PLCs running the "same" program,
different IPs. `192.168.0.114` connects from the app; `192.168.0.113` does **not**. Both
**ping fine** (`Reply … TTL=255`). The app shows:

```
The connection cannot be established with server opc.tcp://192.168.0.113:4840.
Err = (connect ECONNREFUSED 192.168.0.113:4840)
```

**Root cause (what it actually was):** `192.168.0.113`'s CPU **clock was stuck in 2012**. Its
OPC UA **application certificate was cached in a bad state**, so the OPC UA server **failed to
start** — nothing was listening on `:4840`. STOP→RUN and software-only downloads did **not**
fix it (TIA saw everything "up-to-date" and never regenerated the cert). A **Reset to factory
settings + full "Hardware and software (all)" download** forced a **fresh certificate against
the corrected clock**, the server started, and the port opened.

---

## The one idea to internalise

**Ping proves the wire, not the server.** `ping` is ICMP (host is powered on and reachable).
The OPC UA client needs a **TCP listener on `:4840`**, which only exists when the server has
**successfully started**. On an S7-1500 the server silently refuses to start if its clock/cert
are wrong — so you get a reachable host with a **closed** port.

`ECONNREFUSED` ≠ network problem. It means the packet **reached** the PLC and the PLC
**actively answered "nothing is listening on 4840."** A firewall/cable/routing fault would
**time out** instead. So `ECONNREFUSED` + successful `ping` = **host up, server not listening**.

> Port `:4840` is **per-device**. `192.168.0.113:4840` and `192.168.0.114:4840` are two
> independent sockets on two machines — they never conflict, and one PLC working says nothing
> about the other. (The `EADDRINUSE` "only one server on 4840" rule is about **two servers on
> the same PC**, not two PLCs.)

---

## Diagnose in one command (run on the machine on the PLC network)

```powershell
Test-NetConnection -ComputerName 192.168.0.113 -Port 4840
Test-NetConnection -ComputerName 192.168.0.114 -Port 4840
```

Read **`TcpTestSucceeded`**, not `PingSucceeded`:

| Field | Meaning | Broken .113 | Working .114 |
|---|---|---|---|
| `PingSucceeded` | host reachable (ICMP) | **True** | True |
| `TcpTestSucceeded` | **server listening on 4840** | **False** ← the problem | **True** |

`PingSucceeded: True` + `TcpTestSucceeded: False` = the PLC is up but its OPC UA server isn't
listening. The fix is entirely **PLC-side**; the app and network are fine.

---

## Confirm the server is down (in TIA)

Go online to the PLC → **Online & diagnostics → Diagnostics → OPC UA → Server**. A **not
running** server shows:
- **Server status: `Unknown`** (a running one says *Running* with a real **Start time**)
- **Start time of server:** *(empty)*, **Number of sessions: `0`**

---

## Rule out the usual suspects (in order)

1. **CPU in STOP?** `:4840` only opens in **RUN**. Check the CPU operator panel / RUN-STOP LED.
   *(Ours was in RUN — not the cause here, but always check first.)*
2. **OPC UA server activated?** CPU → **Properties → OPC UA → Server → General → ✅ Activate
   OPC UA server**. *(Ours was ticked.)*
3. **Runtime license assigned?** CPU → **Properties → Runtime licenses → OPC UA** →
   *Type of required license* must **not** be `None` (e.g. `SIMATIC OPC UA S7-1500 small`). It's
   honor-based (no key file). *(Ours matched the working PLC — not the cause.)*
4. **A usable endpoint offered?** CPU → **OPC UA → Server → Security → Security policies** →
   **"No security"** must be **activated** if the app connects with `None`; and **User
   authentication → guest/anonymous** must be permitted. *(Ours matched — not the cause.)*
5. **Clock correct?** **Online & diagnostics → Functions → Set time of day** → *Take from
   PG/PC*. **← This was wrong (2012) and is the trigger for the cert failure below.**

> **Compare against the working PLC.** When two "identical" PLCs behave differently, open both
> projects and diff exactly these pages (license, security). Whatever differs is the answer. In
> our case **every config page matched** — which pointed away from config and toward the CPU's
> **runtime/cert state**.

---

## The fix that worked — clean re-download from scratch

Config was identical to the working PLC, yet the server wouldn't start → the CPU was in a
**stuck state** (bad cached OPC UA certificate from the 2012 clock). A software-only download
won't cure it because TIA reports "up-to-date" and skips regenerating the cert. You must wipe
and full-load:

1. **Fix the clock first:** *Online & diagnostics → Functions → Set time of day → Take from
   PG/PC → Apply.*
2. **Reset to factory settings:** *Online & diagnostics → Functions → Reset to factory
   settings* → **leave "Delete IP address" UNCHECKED** (keep `192.168.0.113`) → **Reset PLC**
   (confirm STOP). This erases the program **and the cached certificate store**.
3. **Full download:** right-click **PLC_1 → Download to device**. In the **Load preview** the
   **Device configuration** row must read **"Delete and replace system data in target"** (=
   real *hardware* download, not software-only) → **Load** → **Start module** → **Finish**.
   - If a **"Software synchronization"** dialog appears (online tags differ), choose **Continue
     without synchronization** to push the offline project onto the CPU.
   - The compile log should show: *"Certificate ID … was renewed due to changes"*, *"OPC UA
     server: activated"*, *"Unsecured communication is permitted ('No security')"* — that
     renewed certificate is the actual fix.
4. **Power-cycle** the CPU (physically off ~10 s, on) so it re-inits the server with the fresh
   cert against the correct clock.
5. **Verify:**
   - TIA: **Diagnostics → OPC UA → Server** → **Server status = Running** (with a Start time).
   - `Test-NetConnection 192.168.0.113 -Port 4840` → **`TcpTestSucceeded : True`**.
   - App: endpoint `opc.tcp://192.168.0.113:4840`, Security **None** → **Connect** ✅.

---

## Why the quicker fixes did **not** work (so you don't waste time on them)

- **STOP → RUN** — doesn't regenerate the OPC UA certificate; it's cached across mode changes.
- **Software-only download** — TIA reports *"software … up-to-date"* and loads nothing; the
  bad cert stays. The OPC UA activation is **hardware** config and needs a hardware download.
- **Just fixing the clock** — necessary but not sufficient: the already-cached bad cert isn't
  re-created until you wipe + full-load (or power-cycle after a hardware download).

**Bottom line:** on a real S7-1500, a wrong clock or stale certificate keeps the OPC UA server
from starting and leaves `:4840` closed → `ECONNREFUSED` despite a healthy ping. Reset to
factory + full hardware download + power-cycle regenerates the cert and opens the port. **No
app or network change was needed.**
