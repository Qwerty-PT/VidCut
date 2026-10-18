// Gravar ecrã e câmara: escolha do ecrã/janela, permissões, mini-janela com "Parar" e gravação dos ficheiros.
const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen, session, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

const STOP_SHORTCUT = 'CommandOrControl+Shift+2';

function setupScreenRecording({ getWin, ffmpegPath, registerMedia }) {
  let chosen = null;          // id da fonte escolhida
  let wantSystemAudio = false;
  let mini = null;
  let hidMain = false;

  // getDisplayMedia() da interface recebe a fonte escolhida na nossa janela (sem o seletor do sistema)
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      const src = sources.find((s) => s.id === chosen) || sources.find((s) => s.id.startsWith('screen'));
      if (!src) return cb({});
      // som do sistema: só o Windows o dá de forma fiável ("loopback")
      cb({ video: src, ...(wantSystemAudio && process.platform === 'win32' ? { audio: 'loopback' } : {}) });
    } catch { cb({}); }
  }, { useSystemPicker: false });

  ipcMain.handle('rec:status', async () => {
    const st = (k) => (process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus(k) : 'granted');
    return { platform: process.platform, screen: st('screen'), camera: st('camera'), microphone: st('microphone'), systemAudio: process.platform === 'win32', shortcut: STOP_SHORTCUT.replace('CommandOrControl', process.platform === 'darwin' ? '⌘' : 'Ctrl').replace(/\+/g, '+') };
  });

  ipcMain.handle('rec:askCamera', async () => {
    if (process.platform !== 'darwin') return true;
    const st = systemPreferences.getMediaAccessStatus('camera');
    if (st === 'granted') return true;
    if (st === 'denied' || st === 'restricted') return false;
    return systemPreferences.askForMediaAccess('camera');
  });

  ipcMain.handle('rec:sources', async () => {
    const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
    // ecrãs e janelas em pedidos separados: se a lista de janelas falhar, os ecrãs aparecem na mesma
    const get = (types) => desktopCapturer.getSources({ types, thumbnailSize: { width: 320, height: 200 }, fetchWindowIcons: false }).catch(() => []);
    const [scr, wins] = await Promise.all([get(['screen']), get(['window'])]);
    const sources = [...scr, ...wins];
    const screens = sources.filter((s) => s.id.startsWith('screen'));
    return sources
      .filter((s) => !own.has(s.id) && (s.id.startsWith('screen') || s.name))
      .map((s) => {
        const isScreen = s.id.startsWith('screen');
        const name = isScreen ? (screens.length > 1 ? `Ecrã ${screens.indexOf(s) + 1}` : 'Ecrã inteiro') : s.name;
        return { id: s.id, name, type: isScreen ? 'screen' : 'window', thumb: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL() };
      });
  });

  ipcMain.handle('rec:choose', (_e, { id, systemAudio }) => { chosen = id; wantSystemAudio = !!systemAudio; return true; });

  /** Começou a gravar: mini-janela por cima de tudo (não aparece na gravação), atalho para parar, esconder o VidCut */
  ipcMain.handle('rec:started', (_e, { hide }) => {
    const win = getWin();
    const area = screen.getPrimaryDisplay().workArea;
    mini = new BrowserWindow({
      width: 250, height: 52, x: Math.round(area.x + area.width / 2 - 125), y: area.y + 12,
      frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true,
      skipTaskbar: true, transparent: true, hasShadow: true, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'rec-mini-preload.cjs'), contextIsolation: true, sandbox: true },
    });
    mini.setContentProtection(true); // não sai nas gravações (Mac e Windows)
    mini.setAlwaysOnTop(true, 'screen-saver');
    mini.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mini.loadFile(path.join(__dirname, 'rec-mini.html'));
    globalShortcut.register(STOP_SHORTCUT, () => win?.webContents.send('rec:stop-request'));
    hidMain = !!hide && !!win;
    if (hidMain) win.minimize();
    return true;
  });

  ipcMain.on('rec:tick', (_e, text) => { if (mini && !mini.isDestroyed()) mini.webContents.send('rec:tick', text); });
  ipcMain.on('rec:mini-stop', () => getWin()?.webContents.send('rec:stop-request'));

  function finishUi() {
    globalShortcut.unregister(STOP_SHORTCUT);
    if (mini && !mini.isDestroyed()) mini.close();
    mini = null;
    const win = getWin();
    if (win && hidMain) { win.restore(); win.show(); win.focus(); }
    hidMain = false;
  }
  ipcMain.handle('rec:ended', () => { finishUi(); return true; });

  /** Guarda um ficheiro gravado e arranja-o (o gravador do browser não escreve a duração) */
  ipcMain.handle('rec:save', async (_e, { bytes, mime, kind }) => {
    const dir = path.join(app.getPath('userData'), 'gravacoes');
    await fs.mkdir(dir, { recursive: true });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}`;
    const ext = /mp4/.test(mime || '') ? 'mp4' : 'webm';
    const label = kind === 'camara' ? 'Câmara' : 'Ecrã';
    const raw = path.join(dir, `${label} ${stamp}.raw.${ext}`);
    const out = path.join(dir, `${label} ${stamp}.${ext}`);
    await fs.writeFile(raw, Buffer.from(bytes));
    const { bin, env } = ffmpegPath();
    const args = ['-v', 'error', '-fflags', '+genpts', '-i', raw, '-c', 'copy', ...(ext === 'mp4' ? ['-movflags', '+faststart'] : []), '-y', out];
    const ok = await new Promise((resolve) => {
      const pr = spawn(bin, args, { env });
      pr.on('close', (code) => resolve(code === 0));
      pr.on('error', () => resolve(false));
    });
    if (ok) await fs.rm(raw, { force: true }); else await fs.rename(raw, out);
    registerMedia([out]);
    return { path: out };
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
}

module.exports = { setupScreenRecording, STOP_SHORTCUT };
