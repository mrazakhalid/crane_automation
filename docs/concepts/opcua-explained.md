# OPC UA explained (plain English)

A learning note for anyone on this project. It explains **what OPC UA is**, every
**technical term** we use, and how it all maps to **our** app. No prior automation
knowledge assumed. For the "why & how it's wired in code" see [`plc-opcua.md`](./plc-opcua.md);
for the OpenPLC runtime specifics see [`../openplc_opcua/enable-opcua-plugin.md`](../openplc_opcua/enable-opcua-plugin.md).

---

## 1. The big picture

A **PLC** (Programmable Logic Controller) is the small industrial computer that actually
drives machines — motors, valves, our cranes. Our web app needs to **read** values from it
(is the crane at tank 7?) and **send** commands to it (move to tank 3).

The problem: every PLC brand used to speak its own language. **OPC UA** is the modern,
vendor-neutral "common language" that lets any software talk to any PLC over the network,
securely. Think of it as **HTTP for industrial machines**.

Our promise in this project: *point the app at any OPC UA server and nothing in the code
changes* — only the address and a few names. That's why OPC UA is the whole strategy.

---

## 2. Client and Server — who is who

- **Server** = the PLC (or a PLC runtime like OpenPLC). It *holds* the data and *listens*.
- **Client** = our backend. It *connects* to the server and asks to read/write.

Our app is **always the client** (`backend/src/services/plc/`). OpenPLC v4 and the Siemens
S7-1500 are both **servers**. We never change which side we are — we just connect to a
different server.

Analogy: the PLC is a **website**, our app is the **browser**.

---

## 3. Endpoint — the address you connect to

An **endpoint** is the server's address. It always starts with `opc.tcp://`:

```
opc.tcp://localhost:4840/openplc/opcua
        └────┬────┘└─┬─┘└────┬─────┘
          host     port    path
```

- `opc.tcp://` — the OPC UA transport (like `https://` for the web).
- **host** — where the PLC is (`localhost` = this machine; later `192.168.1.30` = the Siemens).
- **port** — almost always **4840** (the standard OPC UA port). Only one server can use it at a time.
- **path** — an optional extra label some servers add.

In our UI this is the **Endpoint** field. It's the *first* thing that changes when we swap PLCs.

---

## 4. NodeId and Namespace — how you name one value

Everything inside a PLC server (every variable, folder, setting) is a **node**. To read or
write a specific value you need its unique name: the **NodeId**.

A NodeId has two parts: **which namespace** + **which identifier**.

```
ns=2;i=1
│    │
│    └── identifier: "item number 1"
└─────── namespace 2
```

### Namespace (`ns=`)
A **namespace** is just a grouping, like a folder or a "brand section", so names from
different vendors never collide. `ns=0` is OPC UA's own built-in stuff. Your PLC's own
variables live in a higher number — on our OpenPLC it's `ns=2`.

### Identifier — four flavours
The bit after the namespace tells you *how* the value is named:

| Form | Means | Example |
| --- | --- | --- |
| `i=` | a **number** (integer id) | `ns=2;i=1` |
| `s=` | a **string** (text name) | `ns=3;s=Crane7.Position` |
| `g=` | a GUID | `ns=1;g=09087e75-...` |
| `b=` | raw bytes (rare) | `ns=1;b=M/RbKB...` |

Most Siemens tags are **string** ids (`s=`), which read nicely. OpenPLC gives our example
variables **numeric** ids (`i=`). Same idea, different labelling — you must use whatever the
server actually advertises. If you guess wrong you get **`BadNodeIdUnknown`**.

> How to find the real NodeIds: **browse** the live server with a tool like *UaExpert* or
> `npx opcua-commander -e <endpoint>`. Never assume them.

---

## 5. Variable — what a node actually holds

A **variable** node is a single value plus some metadata. When we read one we get:

| Field | Plain meaning | Example |
| --- | --- | --- |
| **value** | the actual number/bool/text | `26895` |
| **data type** | what kind of value it is | `Int16`, `Boolean`, `Float` |
| **quality / status** | is the reading trustworthy? | `Good` (or `BadNodeIdUnknown`, …) |
| **server timestamp** | when the PLC produced it | `11:51:07` |

Those four are exactly what the **Live read** card shows. `Good` = the value is real.

### Data types you'll see
- **Boolean** — true/false (a coil, a switch, an output bit).
- **Int16 / UInt16 / Int32** — whole numbers (a counter, a position register).
- **Float / Double** — decimal numbers (a temperature, a weight).

When we **write**, we must pick the matching data type or the PLC rejects it.

---

## 6. Index — how an OPC UA node connects to PLC memory (OpenPLC-specific)

This one is specific to **OpenPLC**, and it's where we lost time, so read carefully.

Inside OpenPLC, a config file `opcua.json` decides which OPC UA nodes exist and **which slot
of PLC memory each one points at**. That slot is chosen by an `index` number.

- The PLC program has variables (e.g. `test_read`, an INT the program adds 1 to every scan).
- `opcua.json` says: "expose an OPC UA node whose value = PLC variable at **index 0**".
- The server then gives that node a NodeId (e.g. `ns=2;i=1`) for clients to use.

So there are **two different numbering systems** and they are off by one:

| `opcua.json` index (what we set) | PLC variable | The other file (`VARIABLES.csv`) line |
| --- | --- | --- |
| **0** | `test_read` (the counter) | 1 |
| **1** | `test_coil` | 2 |

**The `index` in `opcua.json` is the `debug.c` order (0-based, program variables only) — NOT
the `VARIABLES.csv` line number** (that file adds the program instance at line 0, shifting
everything by one). Get it wrong and a node reads a *plausible but wrong* variable — our INT
node once sat at `0` because it was secretly pointing at a boolean coil.

On a real Siemens PLC there is no such thing — you just use the tag's string NodeId directly.
Index is purely an OpenPLC wiring detail.

---

## 7. Reading and writing — the two directions

- **PLC → software (read):** we poll a NodeId once a second and show the value. Proven by
  the counter climbing on its own. This is the **Live read** card.
- **Software → PLC (write / command):** we send a NodeId + data type + value; the PLC applies
  it. We immediately read it back to confirm. This is the **Send command** card.

Together = two-way communication.

---

## 8. Security — Mode and Policy (and certificates)

OPC UA can run **plain** or **protected**. Two independent settings:

### Security **Mode** — *how much* protection
- **None** — plain text. Anyone on the network could read it. Fine for a local test.
- **Sign** — messages are signed, so they can't be secretly tampered with (but are still readable).
- **SignAndEncrypt** — signed *and* encrypted, so they can't be tampered with *or* read. Most secure.

### Security **Policy** — *which cipher* does the protecting
The algorithm suite, e.g. **`Basic256Sha256`** (the common modern one), or the newer
`Aes256_Sha256_RsaPss`. `None` means no cipher (only valid with mode None).

You must pick a **mode + policy pair that the server actually offers**. Ask for something it
doesn't advertise and you get:
`Cannot find an Endpoint matching security mode … policy …`.

### The two worlds we care about
| Server | What it offers | What to pick in our dropdown |
| --- | --- | --- |
| **OpenPLC v4** (our POC) | usually **None** only | Security **None**, Policy **None** |
| **Siemens S7-1500** | **only secured** (e.g. Basic256Sha256 Sign / SignAndEncrypt), **no None** | Security **SignAndEncrypt**, Policy **Basic256Sha256** |

That's why the PLC page now has a **Security** and **Policy** dropdown — so the same app
connects to either without code changes.

### Certificates (only for secured modes)
For Sign/SignAndEncrypt, each side proves who it is with a **certificate** (a digital ID card):
- Our client has its own cert (`pki/own/certs/client_certificate.pem`).
- **One-time Siemens step:** the PLC won't trust a stranger — in TIA Portal (or the PLC's web
  server) you move our client cert from its **rejected** list to its **trusted** list.
- **Also check the PLC's clock.** Certificates have a valid-from date; if the PLC's clock is
  wrong (we saw one set to 2012) it thinks our cert "isn't valid yet" and drops the connection.

None of this applies to OpenPLC with None security — that's why the POC is easy.

---

## 9. Glossary — every term, one line each

- **OPC UA** — the vendor-neutral protocol our app and PLCs speak. "HTTP for machines".
- **PLC** — the industrial controller running the machine logic.
- **Client / Server** — we're the client; the PLC is the server.
- **Endpoint** — the `opc.tcp://host:port/path` address you connect to.
- **Session** — one open connection between our client and the server.
- **Node** — any addressable thing on the server.
- **Variable** — a node that holds a value (what we read/write).
- **NodeId** — a node's unique name: `ns=<namespace>;<i|s|g|b>=<identifier>`.
- **Namespace (`ns=`)** — a grouping so names don't collide; the PLC's own tags sit above `ns=0`.
- **Identifier (`i=`/`s=`)** — numeric or string name within a namespace.
- **Browse** — asking the server to list its nodes so you learn the real NodeIds.
- **Data type** — Boolean / Int16 / Float / … — what kind of value a variable holds.
- **Quality / Status code** — `Good` means the value is trustworthy; `Bad…` codes explain failures.
- **Read / Write (command)** — PLC→software / software→PLC.
- **Index (OpenPLC)** — the `opcua.json` number linking a node to a PLC memory slot (`debug.c` order).
- **Security Mode** — None / Sign / SignAndEncrypt (how much protection).
- **Security Policy** — the cipher suite, e.g. Basic256Sha256 (which protection).
- **Certificate** — a digital ID each side presents in secured modes.
- **PKI** — the on-disk store of our own cert + the certs we trust (`pki/`, gitignored).

---

## 10. Our current setup at a glance

| Thing | Value today (OpenPLC v4 POC) |
| --- | --- |
| Endpoint | `opc.tcp://localhost:4840/openplc/opcua` |
| Security | None / None |
| Read (PLC→SW) | `ns=2;i=1` = `test_read`, an Int16 counter the PLC increments every 20 ms |
| Write (SW→PLC) | `ns=2;i=2` = `test_coil`, a Boolean |

Swapping to the Siemens S7-1500 later = change the **endpoint** to the PLC's IP, set
**Security = SignAndEncrypt / Basic256Sha256**, use the Siemens **string NodeIds**, and do the
one-time cert-trust + clock steps on the PLC. **No app code changes.**
