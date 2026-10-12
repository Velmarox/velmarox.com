// Clack Arena for Windows. A frameless window: no Windows title bar or menu bar. The shell page (www/shell/) draws
// its own title bar, window buttons and menu bar, and runs the game in a frame below them.
//
// The game is served from inside the app on app://arena/, laid out like velmarox.com, so its paths
// (/games/clack-arena/play/, /tools/clack-attack/play/Table/...) work unchanged and it runs with no internet.
const { app, BrowserWindow, protocol, net, ipcMain, shell, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const WWW = path.join(__dirname, 'www');
const HOME = 'app://arena/shell/index.html';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

// If the graphics driver is blocked (old or broken GPUs), still draw the tray in software instead of failing.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// ---------- window size and place, kept between runs ----------
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s).workArea;   // still on a screen that exists?
    if (s.x + 100 > area.x + area.width || s.y + 50 > area.y + area.height || s.x + s.width < area.x + 100) return { width: s.width, height: s.height, maximized: s.maximized };
    return s;
  } catch { return { width: 1280, height: 820 }; }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* not worth failing over */ }
}

let win = null;
function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1280, height: st.height || 820, minWidth: 900, minHeight: 600,
    frame: false,                 // no Windows title bar or menu bar
    thickFrame: true,             // keeps resizing from the edges, Aero snap and the shadow
    backgroundColor: '#0b0b0d',
    title: 'Clack Arena',
    icon: path.join(__dirname, 'www', 'shell', 'icon.png'),
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadURL(HOME);

  const tell = () => win.webContents.send('win:state', { maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused() });
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur'].forEach((e) => win.on(e, tell));
  win.on('close', () => saveState(win));

  // Links out (velmarox.com) open in the browser; nothing else opens a window.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://arena/')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

// ---------- what the title bar and menu bar can ask for ----------
ipcMain.on('win', (e, cmd, arg) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (cmd === 'min') w.minimize();
  else if (cmd === 'max') (w.isMaximized() ? w.unmaximize() : w.maximize());
  else if (cmd === 'close') w.close();
  else if (cmd === 'fullscreen') w.setFullScreen(!w.isFullScreen());
  else if (cmd === 'zoom') { const z = w.webContents.getZoomLevel(); w.webContents.setZoomLevel(arg === 0 ? 0 : Math.max(-3, Math.min(3, z + arg * 0.5))); }
  else if (cmd === 'reload') w.webContents.reloadIgnoringCache();
  else if (cmd === 'devtools') w.webContents.toggleDevTools();
  else if (cmd === 'open' && /^https:\/\//.test(arg)) shell.openExternal(arg);
});
ipcMain.handle('win:info', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  return { version: app.getVersion(), maximized: !!w?.isMaximized(), fullscreen: !!w?.isFullScreen(), electron: process.versions.electron, chrome: process.versions.chrome };
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  // app://arena/<path> -> www/<path>, and nothing outside www.
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(WWW, decodeURIComponent(pathname)));
    if (!file.startsWith(WWW) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());
