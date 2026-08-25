// @ts-nocheck
'use strict';

/**
 * Crane Automation — Electron main process (offline desktop shell).
 *
 * Purpose: Boot the bundled Express backend as a child process (reusing
 *   Electron's Node via ELECTRON_RUN_AS_NODE) configured for the **sqlite**
 *   storage driver, wait until it's healthy, then open a window pointing at it.
 *   One local HTTP server serves both the API and the built SPA — fully offline,
 *   no MongoDB, no external services.
 */
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

/** Resolve where the backend build + client assets live (packaged vs. dev). */
function resolvePaths() {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  return {
    backendEntry: app.isPackaged
      ? path.join(process.resourcesPath, 'backend', 'dist', 'index.js')
      : path.join(base, 'backend', 'dist', 'index.js'),
    backendCwd: app.isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.join(base, 'backend'),
    clientDir: app.isPackaged
      ? path.join(process.resourcesPath, 'frontend')
      : path.join(base, 'frontend', 'dist'),
  };
}

/** Read (or generate + persist) a per-install JWT secret in the user-data dir. */
function loadOrCreateSecret() {
  const file = path.join(app.getPath('userData'), 'jwt-secret.txt');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

/** Find a free TCP port on localhost. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Poll the health endpoint until the backend answers 200 (or time out). */
function waitForHealth(port, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error('Backend did not start in time'));
      setTimeout(tick, 250);
    };
    tick();
  });
}

let backend = null;

/** Spawn the Express backend as a Node child, configured for offline/sqlite. */
async function startBackend() {
  const { backendEntry, backendCwd, clientDir } = resolvePaths();
  const port = await getFreePort();
  const dbPath = path.join(app.getPath('userData'), 'crane.db');

  backend = spawn(process.execPath, [backendEntry], {
    cwd: backendCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      STORAGE_DRIVER: 'sqlite',
      SQLITE_PATH: dbPath,
      CLIENT_DIR: clientDir,
      PORT: String(port),
      CORS_ORIGIN: `http://localhost:${port}`,
      JWT_SECRET: loadOrCreateSecret(),
    },
    stdio: 'inherit',
  });
  backend.on('exit', (code) => {
    if (code && !app.isQuitting) {
      console.error(`Backend exited with code ${code}`);
      app.quit();
    }
  });

  await waitForHealth(port);
  return port;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  try {
    const port = await startBackend();
    await win.loadURL(`http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    app.quit();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  backend?.kill();
});
