# PLC OPC UA connectivity — PowerShell checks + expected output

Run these on the **Windows machine that is on the PLC network** (the one that can ping the
PLCs). Start → type `powershell` → **Windows PowerShell** → paste. These are **read-only**
diagnostics — they change nothing on the PLC.

Full explanation of what the results mean: see
[`../tia_opcua/opcua-server-wont-start-econnrefused.md`](../tia_opcua/opcua-server-wont-start-econnrefused.md).

---

## 1. Is the OPC UA server actually listening on `:4840`?

This is **the** test. `ping` only proves the host is powered on; the app needs a **TCP
listener on 4840**, which exists only when the OPC UA server has **started**.

```powershell
Test-NetConnection -ComputerName 192.168.0.113 -Port 4840
```

**Expected when the server is UP (good):**
```
ComputerName     : 192.168.0.113
RemoteAddress    : 192.168.0.113
RemotePort       : 4840
InterfaceAlias   : Ethernet
SourceAddress    : 192.168.0.241
TcpTestSucceeded : True          <-- server is listening; the app will connect
```

**Expected when the server is DOWN (the bug we hit):**
```
WARNING: TCP connect to (192.168.0.113 : 4840) failed
ComputerName           : 192.168.0.113
RemoteAddress          : 192.168.0.113
RemotePort             : 4840
PingSucceeded          : True    <-- host is up (wire is fine)
TcpTestSucceeded       : False   <-- server NOT listening -> app gets ECONNREFUSED
```

> **Read `TcpTestSucceeded`, not `PingSucceeded`.** `PingSucceeded:True` +
> `TcpTestSucceeded:False` = host up but server not started → the fix is **PLC-side**, not the
> app or network. See the runbook for the reset-to-factory + full-download cure.

---

## 2. Compare two PLCs in one line

Handy when one IP works and another doesn't (our `.114` worked, `.113` didn't).

```powershell
"113","114" | ForEach-Object {
  $r = Test-NetConnection -ComputerName "192.168.0.$_" -Port 4840 -WarningAction SilentlyContinue
  "192.168.0.$_ : 4840 open = $($r.TcpTestSucceeded)"
}
```

**Expected (one down, one up):**
```
192.168.0.113 : 4840 open = False
192.168.0.114 : 4840 open = True
```

---

## 3. Plain reachability (ICMP) — proves the wire only

```powershell
ping 192.168.0.113 -t          # Ctrl+C to stop
```

**Expected (host reachable):**
```
Reply from 192.168.0.113: bytes=32 time<1ms TTL=255
```

> A good `ping` here does **not** mean OPC UA works — it only means the machine answers ICMP.
> `TTL=255` is typical of an S7-1500. If ping itself **times out**, that's a real network/cable
> problem (different from `ECONNREFUSED`, which means "reached the PLC, but port 4840 is
> closed").

---

## Quick decision table

| `ping` | `Test-NetConnection :4840` | Meaning | Where to fix |
|---|---|---|---|
| Reply | `TcpTestSucceeded: True` | Server up | Nothing — app should connect (check NodeIds) |
| Reply | `TcpTestSucceeded: False` | **Host up, OPC UA server not started** | **PLC-side** — clock/cert/activation (see runbook) |
| Timeout | `TcpTestSucceeded: False` | Host unreachable | Network — cable / IP / subnet / adapter |
