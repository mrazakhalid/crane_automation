// @ts-nocheck
/**
 * Rasterize build/icon.svg -> build/icon-256.png using Electron's Chromium.
 *
 * Purpose: We have no ImageMagick/Inkscape/sharp on this machine, but Electron
 *   renders SVG natively. A hidden, transparent 256x256 window loads the SVG and
 *   capturePage() grabs it (with alpha) as a PNG. Python/Pillow then packs the
 *   multi-resolution .ico from that PNG.
 *
 * Run: npx --no-install electron scripts/rasterize-icon.cjs
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SIZE = 256;
const buildDir = path.join(__dirname, '..', 'build');
const svg = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf8');

const html =
  '<!doctype html><meta charset="utf-8">' +
  `<style>*{margin:0;padding:0}html,body{width:${SIZE}px;height:${SIZE}px;` +
  'background:transparent;overflow:hidden}' +
  `svg{display:block;width:${SIZE}px;height:${SIZE}px}</style>` +
  svg;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500)); // let it paint

  const image = await win.capturePage();
  fs.writeFileSync(path.join(buildDir, 'icon-256.png'), image.toPNG());
  console.log('wrote build/icon-256.png');
  app.quit();
});
