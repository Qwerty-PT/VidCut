// Processo principal do VidCut (Electron).
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, session, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createMediaServer } = require('./media-server.cjs');
const { renderProject } = require('./render.cjs');
const { getPeaks, ffmpegPath } = require('./peaks.cjs');
const { createLottieLibrary } = require('./lottie-lib.cjs');
const { transcribeMedia, captionsStatus } = require('./captions.cjs');
const { createUpdater } = require('./updater.cjs');

const isDev = process.env.VIDCUT_DEV === '1';
const appRoot = path.join(__dirname, '..');

// Na app empacotada, o Chrome headless do Remotion é descarregado para a pasta de dados
// do utilizador (a pasta da app é só de leitura). Em dev fica em node_modules/.remotion.
// Versão portátil do Windows: os dados ficam ao lado do .exe (dá para levar numa pen)
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'VidCut-dados'));
}

if (app.isPackaged) {
  const fsSync = require('node:fs');
  const dataDir = app.getPath('userData');
  fsSync.mkdirSync(dataDir, { recursive: true });
  // O Remotion guarda o Chrome em <pasta com package.json>/node_modules/.remotion:
  // um package.json aqui garante que fica dentro da pasta de dados da app.
  const pkg = path.join(dataDir, 'package.json');
  if (!fsSync.existsSync(pkg)) fsSync.writeFileSync(pkg, '{ "name": "vidcut-data", "private": true }\n');
  process.chdir(dataDir);
}

const MEDIA_FILTERS = [
  { name: 'Media', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'png', 'jpg', 'jpeg', 'webp', 'gif'] },
  { name: 'Vídeo', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv'] },
  { name: 'Áudio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] },
  { name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
];
const PROJECT_FILTERS = [{ name: 'Projeto VidCut', extensions: ['vidcut', 'json'] }];

const mediaServer = createMediaServer();
let mediaBase = '';
let win = null;
let currentExport = null;
const updater = createUpdater({ send: (u) => win?.webContents.send('update:status', u) });

const autosavePath = () => path.join(app.getPath('userData'), 'autosave.vidcut');

function registerProjectMedia(project) {
  mediaServer.register((project?.media || []).map((m) => m.path));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#121316',
    title: 'VidCut',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(appRoot, 'dist', 'index.html'));
  }
  // Links externos abrem no browser do sistema
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function buildMenu() {
  const send = (cmd) => () => win?.webContents.send('menu', cmd);
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'Acerca do VidCut' },
        { label: 'Procurar atualizações…', click: () => updater.check({ manual: true }) },
        { type: 'separator' },
        { role: 'services', label: 'Serviços' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar VidCut' },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: 'Sair do VidCut' },
      ],
    }] : []),
    {
      label: 'Ficheiro',
      submenu: [
        { label: 'Novo projeto', accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: 'Abrir projeto…', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Guardar como…', accelerator: 'CmdOrCtrl+Shift+S', click: send('saveAs') },
        { label: 'Definições do projeto…', accelerator: 'CmdOrCtrl+,', click: send('projectSettings') },
        { type: 'separator' },
        { label: 'Importar media…', accelerator: 'CmdOrCtrl+I', click: send('import') },
        { label: 'Exportar vídeo…', accelerator: 'CmdOrCtrl+E', click: send('export') },
        { type: 'separator' },
        { label: 'Importar legendas (.srt)…', click: send('importSrt') },
        { label: 'Exportar legendas (.srt)…', click: send('exportSrt') },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Fechar' } : { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { label: 'Refazer', accelerator: 'CmdOrCtrl+Shift+Z', click: send('redo') },
        { type: 'separator' },
        // tratados pela app: clips na timeline, ou texto se estiver a escrever num campo
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', click: send('cut') },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', click: send('copy') },
        { label: 'Colar', accelerator: 'CmdOrCtrl+V', click: send('paste') },
        { label: 'Duplicar', accelerator: 'CmdOrCtrl+D', click: send('duplicate') },
        { label: 'Selecionar tudo', accelerator: 'CmdOrCtrl+A', click: send('selectAll') },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de programador' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Ecrã inteiro' },
      ],
    },
  ];
  template.push({
    label: 'Ajuda',
    submenu: [
      { label: 'Procurar atualizações…', click: () => updater.check({ manual: true }) },
      { label: 'Novidades e versões', click: () => shell.openExternal('https://github.com/Qwerty-PT/VidCut/releases') },
      { label: 'VidCut no GitHub', click: () => shell.openExternal('https://github.com/Qwerty-PT/VidCut') },
      { type: 'separator' },
      { label: `Versão ${app.getVersion()}`, enabled: false },
    ],
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC ----------
ipcMain.handle('app:info', () => ({ mediaBase, platform: process.platform, version: app.getVersion() }));

ipcMain.handle('media:pick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Importar media', properties: ['openFile', 'multiSelections'], filters: MEDIA_FILTERS });
  if (r.canceled) return [];
  mediaServer.register(r.filePaths);
  return r.filePaths;
});

ipcMain.handle('media:register', (_e, paths) => { mediaServer.register(paths || []); return true; });

ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Abrir projeto', properties: ['openFile'], filters: PROJECT_FILTERS });
  if (r.canceled || !r.filePaths[0]) return null;
  const file = r.filePaths[0];
  const project = JSON.parse(await fs.readFile(file, 'utf8'));
  registerProjectMedia(project);
  return { path: file, project };
});

ipcMain.handle('project:save', async (_e, { project, filePath, saveAs }) => {
  let target = filePath;
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Guardar projeto',
      defaultPath: `${(project.name || 'projeto').replace(/[\\/:*?"<>|]/g, '_')}.vidcut`,
      filters: PROJECT_FILTERS,
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  await fs.writeFile(target, JSON.stringify(project, null, 2), 'utf8');
  return target;
});

ipcMain.handle('autosave:write', async (_e, data) => {
  await fs.writeFile(autosavePath(), JSON.stringify(data), 'utf8');
  return true;
});

ipcMain.handle('autosave:read', async () => {
  try {
    const data = JSON.parse(await fs.readFile(autosavePath(), 'utf8'));
    registerProjectMedia(data.project);
    return data;
  } catch { return null; }
});

ipcMain.handle('export:start', async (_e, { project, spec }) => {
  if (currentExport) return { ok: false, error: 'Já há um export em curso.' };
  const ext = /^[a-z0-9]{2,4}$/.test(spec?.ext || '') ? spec.ext : 'mp4';
  const audioOnly = ext === 'mp3' || ext === 'wav';
  const r = await dialog.showSaveDialog(win, {
    title: audioOnly ? 'Exportar áudio' : 'Exportar vídeo',
    defaultPath: `${(project.name || 'video').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`,
    filters: [{ name: String(spec?.filter || ext.toUpperCase()), extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };

  registerProjectMedia(project);
  const job = renderProject({
    appRoot, project, mediaBase, outPath: r.filePath, spec,
    onProgress: (p) => win?.webContents.send('export:progress', p),
  });
  currentExport = job;
  try {
    const out = await job.promise;
    return { ok: true, path: out };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/cancel/i.test(msg)) return { ok: false, canceled: true };
    return { ok: false, error: msg };
  } finally {
    currentExport = null;
  }
});

ipcMain.handle('export:cancel', () => { currentExport?.cancel(); return true; });

// ---------- biblioteca de animações Lottie ----------
let lottieLib = null;
const lib = () => (lottieLib ??= createLottieLibrary(path.join(app.getPath('userData'), 'lotties')));
ipcMain.handle('lottie:list', () => lib().list());
ipcMain.handle('lottie:import', async (_e, paths) => {
  let files = Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : [];
  if (!files.length) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Adicionar animações Lottie', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Animações Lottie', extensions: ['json', 'lottie'] }],
    });
    if (r.canceled) return { added: [], errors: [] };
    files = r.filePaths;
  }
  return lib().import(files);
});
ipcMain.handle('lottie:remove', (_e, id) => lib().remove(String(id)));
ipcMain.handle('lottie:rename', (_e, id, name) => lib().rename(String(id), String(name)));

// ---------- legendas automáticas (whisper.cpp local) ----------
let currentCaptions = null;
ipcMain.handle('captions:status', () => captionsStatus(app.getPath('userData')));
ipcMain.handle('captions:start', async (_e, o) => {
  if (currentCaptions) return { ok: false, error: 'Já há uma transcrição em curso.' };
  if (!o || typeof o.file !== 'string' || !require('node:fs').existsSync(o.file)) return { ok: false, error: 'Ficheiro não encontrado.' };
  const job = transcribeMedia({
    dataDir: app.getPath('userData'), file: o.file,
    startSec: Math.max(0, Number(o.startSec) || 0), durSec: Math.max(0, Number(o.durSec) || 0),
    model: String(o.model || 'small'), language: o.language ? String(o.language) : null,
  }, (p) => win?.webContents.send('captions:progress', p));
  currentCaptions = job;
  try { return { ok: true, ...(await job.promise) }; }
  catch (err) {
    const msg = String(err?.message || err);
    if (/abort|cancel/i.test(msg)) return { ok: false, canceled: true };
    const hint = /spawn (git|make)|ENOENT/.test(msg)
      ? (process.platform === 'darwin' ? '\n\nFalta o git/make: instala as ferramentas de linha de comandos da Apple (no Terminal: xcode-select --install) e tenta outra vez.' : '\n\nFalta o git ou o make (ferramentas de compilação).')
      : '';
    return { ok: false, error: msg + hint };
  } finally { currentCaptions = null; }
});
ipcMain.handle('captions:cancel', () => { currentCaptions?.cancel(); return true; });
ipcMain.handle('captions:saveSrt', async (_e, text, name) => {
  const r = await dialog.showSaveDialog(win, { title: 'Exportar legendas', defaultPath: `${String(name || 'legendas').replace(/[\\/:*?"<>|]/g, '_')}.srt`, filters: [{ name: 'Legendas SRT', extensions: ['srt'] }] });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, '\uFEFF' + String(text), 'utf8');
  return r.filePath;
});
ipcMain.handle('captions:openSrt', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Importar legendas', properties: ['openFile'], filters: [{ name: 'Legendas SRT', extensions: ['srt'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { name: path.basename(r.filePaths[0]), text: await fs.readFile(r.filePaths[0], 'utf8') };
});

ipcMain.handle('media:peaks', async (_e, file) => {
  try { return new Uint8Array(await getPeaks(file, path.join(app.getPath('userData'), 'peaks'))); }
  catch { return new Uint8Array(0); }
});

// edição nativa de texto (quando o foco está num campo)
ipcMain.handle('edit:native', (_e, action) => {
  const wc = win?.webContents;
  if (!wc) return false;
  if (['cut', 'copy', 'paste', 'selectAll', 'undo', 'redo'].includes(action)) wc[action]();
  return true;
});

ipcMain.handle('shell:showItem', (_e, p) => { shell.showItemInFolder(p); return true; });

// ---------- Congelar imagem: extrai um fotograma para PNG ----------
ipcMain.handle('frame:extract', async (_e, { file, timeSec }) => {
  const { spawn } = require('node:child_process');
  const dir = path.join(app.getPath('userData'), 'fotogramas');
  await fs.mkdir(dir, { recursive: true });
  const base = path.basename(file).replace(/\.[^.]+$/, '').replace(/[^\w\-À-ÿ ]+/g, '_').slice(0, 60);
  const out = path.join(dir, `${base}-${Math.round(timeSec * 1000)}ms-${Date.now().toString(36)}.png`);
  const { bin, env } = ffmpegPath();
  const t = Math.max(0, Number(timeSec) || 0);
  const run = (args) => new Promise((resolve) => {
    const pr = spawn(bin, args, { env });
    let err = '';
    pr.stderr.on('data', (d) => { err += d; });
    pr.on('close', (code) => resolve({ code, err }));
    pr.on('error', (e) => resolve({ code: -1, err: e.message }));
  });
  // -ss antes do -i é rápido; muito perto do fim pode não haver fotograma → recua um pouco
  let r = await run(['-v', 'error', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-y', out]);
  if (r.code !== 0 || !(await fs.stat(out).catch(() => null))) r = await run(['-v', 'error', '-ss', Math.max(0, t - 0.1).toFixed(3), '-i', file, '-frames:v', '1', '-y', out]);
  if (!(await fs.stat(out).catch(() => null))) return { error: (r.err || 'Não foi possível extrair o fotograma.').trim().slice(0, 300) };
  mediaServer.register([out]);
  return { path: out };
});

// ---------- Narração: microfone e gravação ----------
ipcMain.handle('mic:access', async () => {
  if (process.platform !== 'darwin') return true;
  const st = systemPreferences.getMediaAccessStatus('microphone');
  if (st === 'granted') return true;
  if (st === 'denied' || st === 'restricted') return false;
  return systemPreferences.askForMediaAccess('microphone');
});
ipcMain.handle('recording:save', async (_e, { bytes, mime }) => {
  const { spawn } = require('node:child_process');
  const dir = path.join(app.getPath('userData'), 'gravacoes');
  await fs.mkdir(dir, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}`;
  const raw = path.join(dir, `Narração ${stamp}.${/mp4/.test(mime || '') ? 'm4a' : 'webm'}`);
  await fs.writeFile(raw, Buffer.from(bytes));
  // WAV: duração exata e lido em todo o lado (o webm do gravador não traz duração)
  const wav = raw.replace(/\.[^.]+$/, '.wav');
  const { bin, env } = ffmpegPath();
  const ok = await new Promise((resolve) => {
    const pr = spawn(bin, ['-v', 'error', '-i', raw, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', '-y', wav], { env });
    pr.on('close', (code) => resolve(code === 0));
    pr.on('error', () => resolve(false));
  });
  const out = ok ? wav : raw;
  if (ok) await fs.rm(raw, { force: true });
  mediaServer.register([out]);
  return { path: out };
});

// ---------- Fontes próprias ----------
ipcMain.handle('fonts:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importar fonte',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Fontes', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
  });
  if (r.canceled) return [];
  const out = [];
  for (const f of r.filePaths) {
    const buf = await fs.readFile(f);
    out.push({ name: path.basename(f).replace(/\.[^.]+$/, ''), file: path.basename(f), size: buf.length, data: buf.toString('base64') });
  }
  return out;
});

// ---------- Atualizações ----------
ipcMain.handle('update:check', () => updater.check({ manual: true }));
ipcMain.handle('update:download', () => updater.downloadUpdate());
ipcMain.handle('update:cancel', () => updater.cancel());
ipcMain.handle('update:skip', (_e, v) => updater.skip(String(v)));
ipcMain.handle('update:openPage', () => updater.openPage());
ipcMain.handle('update:install', async () => {
  try { return await updater.install(); } catch (e) { return { error: e.message || String(e) }; }
});

// ---------- Arranque ----------
app.setName('VidCut');
app.whenReady().then(async () => {
  mediaBase = await mediaServer.listen();
  // Permissões pedidas pela interface: microfone (narração) e fontes do sistema (texto). Mais nada.
  const ALLOWED = new Set(['media', 'local-fonts']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    if (process.env.VIDCUT_DEBUG_PERMS) console.log('[permissão]', permission, JSON.stringify(details?.mediaTypes || ''));
    cb(ALLOWED.has(permission) && (permission !== 'media' || !(details?.mediaTypes || []).includes('video')));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  buildMenu();
  createWindow();
  // procura atualizações uns segundos depois de abrir (no máximo uma vez por dia)
  win.webContents.once('did-finish-load', () => setTimeout(() => updater.autoCheck(), 8000));
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  mediaServer.close();
  if (process.platform !== 'darwin') app.quit();
});
