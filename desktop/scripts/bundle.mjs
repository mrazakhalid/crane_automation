// @ts-nocheck
/**
 * One-command offline bundler for Crane Automation.
 *
 * Purpose: Produce the offline desktop installer from the two source apps with a
 *   single command (`npm run bundle`). Steps:
 *     1. Build the frontend (Vite) and backend (tsc).
 *     2. Stage the backend with production-only dependencies.
 *     3. Rebuild the SQLite native module for Electron's ABI (the one gotcha).
 *     4. Package everything with electron-builder → Windows installer in release/.
 *
 * The backend is configured for STORAGE_DRIVER=sqlite at runtime by main.js, so
 * the packaged app is fully offline (no MongoDB, no Node install required).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(here, '..');
const repoRoot = path.resolve(desktopDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'frontend');
const stageBackend = path.join(desktopDir, 'build-stage', 'backend');

/** Run a command, streaming its output, failing the build on error. */
function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${path.relative(repoRoot, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

console.log('📦 Bundling Crane Automation (offline desktop)…');

// 1) Build both apps.
run('npm run build', frontendDir);
run('npm run build', backendDir);

// 2) Stage the backend with production-only dependencies.
rmSync(path.join(desktopDir, 'build-stage'), { recursive: true, force: true });
mkdirSync(stageBackend, { recursive: true });
cpSync(path.join(backendDir, 'dist'), path.join(stageBackend, 'dist'), { recursive: true });
cpSync(path.join(backendDir, 'package.json'), path.join(stageBackend, 'package.json'));
const lock = path.join(backendDir, 'package-lock.json');
if (existsSync(lock)) cpSync(lock, path.join(stageBackend, 'package-lock.json'));
run(existsSync(lock) ? 'npm ci --omit=dev' : 'npm install --omit=dev', stageBackend);

// 3) Rebuild the SQLite native module for Electron's ABI.
const electronVersion = JSON.parse(
  readFileSync(path.join(desktopDir, 'node_modules', 'electron', 'package.json'), 'utf8'),
).version;
console.log(`\n🔧 Rebuilding better-sqlite3 for Electron ${electronVersion}…`);
run(`npx --no-install electron-rebuild -v ${electronVersion} -m "${stageBackend}" -o better-sqlite3 -f`, desktopDir);

// 4) Package the installer.
run('npx --no-install electron-builder --win', desktopDir);

console.log('\n✅ Done — installer written to desktop/release/');
