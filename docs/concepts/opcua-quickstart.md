# OPC UA — the short version

Plain-language cheat sheet. Want the full detail? See
[`opcua-explained.md`](./opcua-explained.md). Building the demo? See
[`../projects/project-01-cycle-ledger-opcua.md`](../projects/project-01-cycle-ledger-opcua.md).

## What / why (one line each)
- **OPC UA** — the common language our software uses to talk to any PLC. "HTTP for machines."
- **Our app is the client**, the **PLC is the server**. We connect to it, read values, write commands.
- **Why:** point the app at any OPC UA server and nothing in our code changes — only settings.

## The 4 words you need
- **Endpoint** — the PLC's address: `opc.tcp://host:4840/...`. *What you type in "Endpoint".*
- **NodeId** — the unique name of one value: `ns=2;i=1` (namespace 2, item 1). *What you read/write.*
- **Index** — OpenPLC's "locker number" for a variable in PLC memory (see below).
- **Security** — how protected the link is: **None** (plain) / **Sign** / **SignAndEncrypt**,
  with a **Policy** (cipher, e.g. `Basic256Sha256`). *Pick what the PLC offers.*

## Security: which to pick
| PLC | Security | Policy |
|---|---|---|
| OpenPLC v4 (our POC) | None | None |
| Siemens S7-1500 | SignAndEncrypt | Basic256Sha256 |
(Siemens also needs a one-time step on the PLC: trust our certificate + set its clock right.)

## The "index" locker analogy (why it's a big number)
PLC memory is a wall of **numbered lockers**; each variable sits in one. To read `cycle_count`
our config needs its **locker number**. Timer/counter blocks (TON, CTU) create lots of **hidden
helper variables** that grab the **first** lockers, so **your** variables land at the **end**
(e.g. lockers 27–32, not 0–5). The file `debug.c` lists the exact number for each — we read it
instead of guessing. Guess wrong → you read the wrong locker.

## Do I have to redo this every time?
OpenPLC **resets `plugins.conf` (opcua → off) on every shutdown**, so the plugin must be
re-enabled before each start. Two scripts handle it so you never hand-edit:

- **Every start (PC reboot, restart OpenPLC):** start with this instead of `StartOpenPLC.bat` —
  it re-enables the plugin, keeps your `opcua.json` mapping, and waits for the server:
  ```
  powershell -ExecutionPolicy Bypass -File scripts\plc\start-openplc.ps1
  ```
- **After you CHANGE the PLC program and re-download it:** variables get renumbered, so also
  re-map. This stops, re-maps `opcua.json` from `debug.c`, re-enables the plugin, restarts, and
  prints the new NodeId list:
  ```
  powershell -ExecutionPolicy Bypass -File scripts\plc\restart-openplc.ps1
  ```
  Then update your watch tags to the printed NodeIds.

`opcua.json` itself is **not** wiped on shutdown — only the plugin's on/off flag is — so a plain
start keeps your mapping.

## Seeing data + sending commands (in the app)
- **See data (PLC → software):** the **Live read** table polls your NodeIds every second. Add a
  row (label + NodeId) to watch any value; the list is saved.
- **Send command (software → PLC):** pick a NodeId + data type + value → Send. The app writes it
  and reads it back to confirm. (The PLC variable must be one the program reads but doesn't
  overwrite, and `opcua.json` must give `viewer: rw`.)
