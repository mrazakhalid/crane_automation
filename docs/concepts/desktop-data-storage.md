# Desktop data storage — where SQLite lives & uninstall behavior

Plain-English note on where the packaged Electron app keeps its data, and what
happens to that data when the app is uninstalled.

## Where the data is stored

The desktop app runs the bundled Express backend with the **sqlite** storage
driver and points it at a database file inside Electron's per-user data dir
(`app.getPath('userData')`). See `desktop/main.js` (`startBackend`,
`loadOrCreateSecret`).

On **Windows** that folder is:

```
%APPDATA%\Roaming\crane-desktop\
├── crane.db          ← the SQLite database (users, lines, everything)
├── crane.db-wal      ← write-ahead log (recent changes not yet merged in)
├── crane.db-shm      ← shared-memory index for the WAL
└── jwt-secret.txt    ← per-install secret used to sign login tokens
```

(e.g. `C:\Users\<you>\AppData\Roaming\crane-desktop\`.)

The folder is named after the package `name` (`crane-desktop`), **not** the
display name "Crane Automation". Everything else in that folder (`Cache`,
`GPUCache`, `Local Storage`, `Network`, …) is Electron/Chromium runtime cache —
not app data.

> Platform note: `userData` maps to `~/Library/Application Support/crane-desktop`
> on macOS and `~/.config/crane-desktop` on Linux.

## WAL mode — copy all three files together

SQLite runs in **WAL (write-ahead log) mode**, so the newest writes may live in
`crane.db-wal` and not yet be inside `crane.db`. When backing up or moving the
database, copy **all three** files (`crane.db`, `crane.db-wal`, `crane.db-shm`)
together. Copying `crane.db` alone can silently lose the most recent changes.

## Does uninstalling delete the data?

**No — the database survives an uninstall.**

- **SQLite is not a separate install.** The engine ships bundled inside the app
  (in the backend's `node_modules`). There is nothing standalone to uninstall;
  it is removed along with the program files at `C:\Program Files\Crane Automation`.
- **User data is left untouched.** The NSIS uninstaller (electron-builder)
  removes program files, the Start-menu shortcut, and registry entries only. It
  does **not** delete `%APPDATA%\Roaming\crane-desktop`. Reinstalling picks the
  existing `crane.db` back up, so accounts and lines persist.

This is the default because `desktop/package.json` → `build.nsis` does **not**
set `deleteAppDataOnUninstall`. To make uninstall wipe the data instead, add:

```jsonc
"nsis": { "deleteAppDataOnUninstall": true }
```

## Common operations

- **Back up:** copy the whole `crane-desktop` folder (or at least the three
  `crane.db*` files) somewhere safe.
- **Full wipe / fresh start:** uninstall, then manually delete the
  `crane-desktop` folder.
- **Move to another PC:** install + launch once (creates the folder), quit, then
  drop your `crane.db*` files into that machine's `%APPDATA%\Roaming\crane-desktop`.
- **Deleting `jwt-secret.txt` only** invalidates existing login sessions (forces
  re-login). It does **not** delete any accounts or data.
