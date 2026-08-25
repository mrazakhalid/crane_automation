# Enabling the OPC UA plugin in OpenPLC Runtime v4 (headless)

This machine runs the **headless OpenPLC Runtime v4** (Autonomy-Logic), not the Editor
GUI. In this runtime the OPC UA server is a **plugin** that is **off by default**. You do
**not** enable it from a menu — you edit one config file and restart the runtime.

> Symptom that sends you here: the runtime console prints
> `[INFO] Skipping disabled plugin during start: opcua` and nothing is listening on `:4840`.

---

## 1. Where things live

Install root:

```
C:\Users\CEO\AppData\Local\OpenPLC Runtime\
```

| What | Exact path |
| --- | --- |
| Startup script | `C:\Users\CEO\AppData\Local\OpenPLC Runtime\StartOpenPLC.bat` |
| Runtime folder | `C:\Users\CEO\AppData\Local\OpenPLC Runtime\openplc-runtime\` |
| **Plugin config (edit this)** | `C:\Users\CEO\AppData\Local\OpenPLC Runtime\openplc-runtime\plugins.conf` |
| Core executable (binds :4840) | `...\openplc-runtime\build\plc_main.exe` |
| Web server | msys64 bash → `python -m webserver.app` |
| OPC UA plugin code | `...\openplc-runtime\core\src\drivers\plugins\python\opcua\` |
| OPC UA plugin config | `...\openplc-runtime\core\src\drivers\plugins\python\opcua\opcua.json` |
| OPC UA plugin venv | `...\openplc-runtime\venvs\opcua\` |

---

## 2. The file to change — `plugins.conf`

One CSV line per plugin. Fields:

```
name , path , enabled , type , config_json_path , venv_path
```

| Field | Meaning |
| --- | --- |
| `name` | plugin id (e.g. `opcua`) |
| `path` | plugin entry file (`.py` Python, `.so` native) |
| **`enabled`** | **`1` = active, `0` = skipped** ← the flag to flip |
| `type` | `0` = Python, `1` = native C/C++ |
| `config_json_path` | plugin's own config file |
| `venv_path` | Python virtual environment (Python plugins only) |

### What to change

Find the `opcua` line and change the **3rd field** from `0` to `1`.

**Before (disabled):**

```
opcua,./core/src/drivers/plugins/python/opcua/plugin.py,0,0,./core/src/drivers/plugins/python/opcua/opcua.json,./venvs/opcua
```

**After (enabled):**

```
opcua,./core/src/drivers/plugins/python/opcua/plugin.py,1,0,./core/src/drivers/plugins/python/opcua/opcua.json,./venvs/opcua
```

> `modbus_slave`, `modbus_master`, and `s7comm` use the same mechanism — flip their 3rd
> field to `1` to enable them too.

---

## 3. Restart the runtime (config is read only at startup)

Editing `plugins.conf` does nothing until the runtime restarts.

1. **Stop** the running runtime: close its console window, or kill the process tree —
   `plc_main.exe`, the `python3 -m webserver.app` process, its msys64 `bash.exe`, and the
   parent `cmd.exe` running `StartOpenPLC.bat`.
2. **Start** it again by running `StartOpenPLC.bat` (or the desktop shortcut).

---

## 4. Verify it worked

- Console log now **starts** the plugin instead of `Skipping disabled plugin ... opcua`.
- `plc_main.exe` is **LISTENING on port 4840**:

  ```powershell
  netstat -ano | findstr 4840
  # TCP  127.0.0.1:4840  ...  LISTENING  <pid>
  # the <pid> is plc_main.exe
  ```

- Endpoint is up: **`opc.tcp://localhost:4840/openplc/opcua`**

---

## 5. The plugin's OPC UA config — `opcua.json`

Path: `...\core\src\drivers\plugins\python\opcua\opcua.json`. Current POC settings:

| Setting | Value |
| --- | --- |
| Endpoint | `opc.tcp://localhost:4840/openplc/opcua` |
| Security policy | **None** |
| Security mode | **None** |
| Auth | **Anonymous** |
| Cycle time | 100 ms |

So our backend `node-opcua` client must connect with `OPCUA_SECURITY_MODE=None`,
`OPCUA_SECURITY_POLICY=None`. (Unlike a real Siemens S7-1500, which advertises **no** `None`
endpoint — see the concept note.)

To harden later: add a Sign/Encrypt entry to `security_profiles`, list our client cert
under `trusted_client_certificates`, then restart the runtime.

---

## 6. Real NodeIds + two-way test

NodeIds are assigned **numerically in namespace 2, in the order variables appear in
`opcua.json`** (`ns=2;i=1` = first variable, `ns=2;i=2` = second, …). String ids
(`ns=…;s=Name`) do **not** exist here — browse the live server to confirm
(`node backend/_browse_tmp.mjs`-style, or UaExpert).

**Mapped to the loaded PLC program** (`test_read` counter + `test_coil`):

| opcua.json var | NodeId | OPC UA type | Direction |
| --- | --- | --- | --- |
| `test_read` (index 0) | `ns=2;i=1` | Int16 | **PLC → software** — counter the program increments each 20 ms scan |
| `test_coil` (index 1) | `ns=2;i=2` | Boolean | **software → PLC** — write target |

These are the values for the app's `OPCUA_READ_NODE` / `OPCUA_WRITE_NODE` in `backend/.env`.

### The `index` numbering gotcha (critical)

Each `opcua.json` variable has an `index` that selects a PLC memory slot. **That index is
the `debug.c` / `get_var_addr()` order (0-based, program variables only) — NOT the
`VARIABLES.csv` line number** (which prepends the FB/program instance at line 0, so it is
off by one). For the loaded program:

| `debug.c` index (use THIS in opcua.json) | Variable | `VARIABLES.csv` line |
| --- | --- | --- |
| **0** | `TEST_READ` (INT) | 1 |
| **1** | `TEST_COIL` (BOOL) | 2 |
| 2 | `_TMP_..._ENO` (BOOL) | 3 |
| 3 | `_TMP_..._OUT` (INT) | 4 |

Symptom of getting this wrong: a variable reads a plausible-but-wrong value or the wrong
type (e.g. an INT node stuck at `0` because it was actually pointing at a BOOL coil). Verify
by browsing the exact NodeId → value/type, and confirm the counter *changes* over time.

### Where the PLC program lives

The running program is in `...\openplc-runtime\core\generated\` (`program.st` +
generated C). `program.st` currently does `test_read := test_read + 1;` each scan (20 ms
task). The compiled artifact is `build/libplc_<timestamp>.so`, loaded by `plc_main.exe`
at startup. To change the program: use OpenPLC Editor v4 → upload via the web dashboard
(**https://localhost:8443**, endpoints `/api/upload-file` → auto-compile → `/api/start-plc`),
which recompiles `core/generated` and restarts the PLC. Editing `opcua.json` only remaps
OPC UA nodes onto existing program variables — it does not change the program.

**Write permission gotcha:** an OPC UA session with **Anonymous** auth maps to the
`viewer` role (`user_manager.py` — "Anonymous users get viewer role"). If a variable's
`permissions` gives `viewer` only `"r"`, **writes fail with `BadInternalError`** even though
the read works. Fix for the POC: set `"viewer": "rw"` on the variables in `opcua.json` and
restart the runtime. (Alternative: add a user + connect with Username auth as operator/
engineer — but our client uses Anonymous/None, so the permission edit is simpler.)

**Genuine PLC → software:** each variable's `index` field maps it to a slot in the PLC
memory image. The example vars aren't driven by a PLC program, so the live read only moves
when the client writes. To see a self-changing value, load an OpenPLC program whose located
variable maps to that index.

## Gotchas

- **Only one OPC UA server can bind `:4840`.** If a Siemens server or a second OpenPLC
  instance is up, you get `EADDRINUSE`. Free the port first.
- **`plugins.conf` is read at startup only** — always restart after editing.
- If a Python plugin is enabled but its `venv_path` is missing/broken, it fails to load
  even with `enabled=1`. The opcua venv (`./venvs/opcua`) is present and has a Python
  interpreter, so this one is fine.
- This is the **Runtime v4 plugin** path. The Editor-GUI toggle described in
  `plc-opcua-openplc-setup.md` §2.3 applies to the Editor build, not this headless runtime.
