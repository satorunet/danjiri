// だんじり疾走 Steam 版: web/ に置いたゲームを app://danjiri/ として開く（オンラインは本番の danjiri.satoru.net につなぐ）
const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const WEB = path.join(__dirname, 'web');

// Steam: 起動時に App ID が分かれば Steamworks をつなぐ（オーバーレイなど）。なくてもゲームは動く
function steamAppId() {
  if (process.env.SteamAppId) return Number(process.env.SteamAppId);
  for (const d of [path.dirname(process.execPath), __dirname, process.cwd()]) {
    try { const n = Number(fs.readFileSync(path.join(d, 'steam_appid.txt'), 'utf8').trim()); if (n) return n; } catch { }
  }
  return 0;
}
let steam = null;
try {
  const sw = require('steamworks.js');
  const id = steamAppId();
  if (id) {
    // 製品版では Steam 以外から直接起動されたら Steam 経由で起動し直す
    if (app.isPackaged && !process.env.SteamAppId && sw.restartAppIfNecessary(id)) { app.exit(0); }
    steam = sw.init(id);
    sw.electronEnableSteamOverlay();
    console.log('steam: ok', id, steam.localplayer.getName());
  }
} catch (e) { console.log('steam: off', e && e.message); }

// 実績（API 名は achievements.md と Steamworks の設定に合わせる）
const ACHIEVEMENTS = new Set(['FIRST_FINISH', 'WIN_SOLO', 'WIN_ONLINE', 'NIGHT_RUN', 'ALL_TOWNS', 'LAP_30', 'SPEED_150', 'DRIFT_4', 'AIR_2', 'SMASH_300', 'SMASH_1000', 'STUCK_1KT', 'STUCK_10KT', 'TODAY_CUP_1', 'ALL_TIME_RANKED']);
ipcMain.on('steam-ach', (e, names) => {
  if (!Array.isArray(names)) return;
  for (const n of names) {
    if (!ACHIEVEMENTS.has(n)) continue;
    if (!steam) { console.log('achievement (Steam なし):', n); continue; }
    try { if (!steam.achievement.isActivated(n)) { steam.achievement.activate(n); console.log('achievement:', n); } } catch (err) { console.log('achievement error', n, err && err.message); }
  }
});

// app:// を普通の https のサイトと同じように扱わせる（ES モジュール・localStorage・fetch が使える）
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);

function serveApp(req) {
  let p = decodeURIComponent(new URL(req.url).pathname);
  if (p === '/' || p === '') p = '/index.html';
  const f = path.join(WEB, path.normalize(p));
  if (!f.startsWith(WEB + path.sep) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
  return net.fetch(pathToFileURL(f).toString());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 450,
    fullscreen: true, backgroundColor: '#120c24', show: false,
    title: 'だんじり疾走 Danjiri Dash',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  // 外のリンク（X へのポスト・GitHub など）はいつものブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // F11 / Alt+Enter で全画面の切り替え、Ctrl+Shift+I で開発者ツール（製品版でも原因調べに使える）
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.key === 'F11' || (inp.alt && inp.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (inp.control && inp.shift && inp.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
  win.loadURL('app://danjiri/');
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  protocol.handle('app', serveApp);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
