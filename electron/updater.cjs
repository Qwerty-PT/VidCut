// Atualizações a partir das Releases do GitHub (repositório público, sem chaves).
// Fluxo: procurar → descarregar (com progresso) → instalar ao reiniciar.
//  - macOS: .zip da app → substitui a VidCut.app e volta a abrir (funciona sem assinatura Apple)
//  - Windows: instalador NSIS em modo silencioso (--updated /S), reabre no fim
//  - Linux: AppImage substitui o próprio ficheiro; .deb abre a página da versão
// Sem dependências: GitHub API + https do Node.
const { app, shell } = require('electron');
const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');

const REPO = 'Qwerty-PT/VidCut';
// VIDCUT_UPDATE_API: só para testes (servidor local que imita a API do GitHub)
const API = process.env.VIDCUT_UPDATE_API || `https://api.github.com/repos/${REPO}/releases/latest`;
const client = (u) => (u.startsWith('http:') ? http : https);
const DAY = 24 * 60 * 60 * 1000;

/** "0.18.0" > "0.17.3"? (ignora o "v" e sufixos -beta) */
function newer(a, b) {
  const p = (v) => String(v).replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = client(url).get(url, { headers: { 'User-Agent': 'VidCut-updater', Accept: 'application/vnd.github+json' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(getJson(res.headers.location)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 404) return reject(new Error('Ainda não há nenhuma versão publicada.'));
        if (res.statusCode === 403) return reject(new Error('O GitHub limitou os pedidos; tenta daqui a uma hora.'));
        if (res.statusCode !== 200) return reject(new Error(`GitHub respondeu ${res.statusCode}.`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Resposta inválida do GitHub.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Sem resposta do GitHub (verifica a ligação à internet).')));
    req.on('error', (e) => reject(e.code === 'ENOTFOUND' ? new Error('Sem ligação à internet.') : e));
  });
}

function download(url, dest, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const go = (u, hops) => {
      const req = client(u).get(u, { headers: { 'User-Agent': 'VidCut-updater', Accept: 'application/octet-stream' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 6) { res.resume(); return go(res.headers.location, hops + 1); }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Falha ao descarregar (${res.statusCode}).`)); }
        const total = Number(res.headers['content-length']) || 0;
        let got = 0;
        const out = fs.createWriteStream(dest);
        const hash = crypto.createHash('sha256');
        res.on('data', (c) => { got += c.length; hash.update(c); onProgress(total ? got / total : 0, got, total); });
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve({ bytes: got, sha256: hash.digest('hex') })));
        out.on('error', reject);
        res.on('error', reject);
      });
      req.on('error', reject);
      if (signal) signal.addEventListener('abort', () => req.destroy(new Error('Cancelado.')), { once: true });
    };
    go(url, 0);
  });
}

/** Que tipo de instalação é esta (decide o ficheiro a descarregar e como instalar) */
function installKind() {
  if (!app.isPackaged) return 'dev';
  if (process.platform === 'darwin') return 'mac-zip';
  if (process.platform === 'win32') return process.env.PORTABLE_EXECUTABLE_DIR ? 'win-portable' : 'win-nsis';
  if (process.platform === 'linux') return process.env.APPIMAGE ? 'appimage' : 'linux-other';
  return 'other';
}

function pickAsset(assets, version) {
  const v = String(version).replace(/^v/, '');
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const find = (re) => assets.find((a) => re.test(a.name));
  switch (installKind()) {
    case 'mac-zip': return find(new RegExp(`-${v}-${arch}(-mac)?\\.zip$`)) || null;
    case 'win-nsis': return find(new RegExp(`-${v}-Setup\\.exe$`)) || null;
    case 'appimage': return find(new RegExp(`-${v}-x86_64\\.AppImage$`)) || null;
    default: return null;
  }
}

function createUpdater({ send }) {
  const stateFile = () => path.join(app.getPath('userData'), 'updates.json');
  const dir = () => path.join(app.getPath('userData'), 'updates');
  let latest = null;     // { version, notes, url, publishedAt, asset }
  let ready = null;      // { file, version }
  let abort = null;

  const emit = (status, extra = {}) => send({ status, current: app.getVersion(), kind: installKind(), ...extra });

  async function readState() { try { return JSON.parse(await fsp.readFile(stateFile(), 'utf8')); } catch { return {}; } }
  async function writeState(s) { try { await fsp.writeFile(stateFile(), JSON.stringify(s)); } catch { /* ignora */ } }

  async function check({ manual = false } = {}) {
    try {
      emit('checking', { manual });
      const r = await getJson(API);
      const version = String(r.tag_name || '').replace(/^v/, '');
      await writeState({ ...(await readState()), lastCheck: Date.now() });
      if (!version || !newer(version, app.getVersion())) { emit('none', { manual, latest: version }); return; }
      const asset = pickAsset(r.assets || [], version);
      latest = { version, notes: String(r.body || '').slice(0, 4000), url: r.html_url, publishedAt: r.published_at, asset: asset && { name: asset.name, size: asset.size, url: asset.browser_download_url, digest: asset.digest || null } };
      const skipped = (await readState()).skip === version;
      if (skipped && !manual) return;
      emit('available', { manual, version, notes: latest.notes, url: latest.url, canInstall: !!latest.asset, size: latest.asset?.size || 0 });
    } catch (e) {
      emit('error', { manual, message: e.message || String(e) });
    }
  }

  /** Verificação automática: no arranque, no máximo uma vez por dia */
  async function autoCheck() {
    if (!app.isPackaged) return;
    const s = await readState();
    if (s.lastCheck && Date.now() - s.lastCheck < DAY) return;
    await check({ manual: false });
  }

  async function downloadUpdate() {
    if (!latest?.asset) { if (latest?.url) shell.openExternal(latest.url); return; }
    const a = latest.asset;
    await fsp.mkdir(dir(), { recursive: true });
    const file = path.join(dir(), a.name);
    abort = new AbortController();
    let last = 0;
    try {
      emit('downloading', { version: latest.version, progress: 0 });
      const res = await download(a.url, file + '.part', (p, got, total) => {
        const now = Date.now();
        if (now - last > 150 || p >= 1) { last = now; emit('downloading', { version: latest.version, progress: p, got, total }); }
      }, abort.signal);
      if (a.size && res.bytes !== a.size) throw new Error('O ficheiro descarregado está incompleto.');
      if (a.digest && /^sha256:/.test(a.digest) && a.digest.slice(7) !== res.sha256) throw new Error('O ficheiro descarregado não confere (assinatura SHA-256).');
      await fsp.rename(file + '.part', file);
      ready = { file, version: latest.version };
      emit('ready', { version: latest.version });
    } catch (e) {
      await fsp.rm(file + '.part', { force: true });
      emit('error', { message: e.message || String(e) });
    } finally { abort = null; }
  }

  function cancel() { abort?.abort(); }

  async function skip(version) { await writeState({ ...(await readState()), skip: version }); }

  /** Instala e reinicia. Devolve false se não houver nada pronto. */
  async function install() {
    if (!ready) return false;
    const kind = installKind();
    const { file } = ready;
    if (kind === 'mac-zip') {
      // .../VidCut.app/Contents/MacOS/VidCut → .../VidCut.app
      const appPath = path.resolve(process.execPath, '..', '..', '..');
      const work = path.join(dir(), 'novo');
      await fsp.rm(work, { recursive: true, force: true });
      await fsp.mkdir(work, { recursive: true });
      await new Promise((res, rej) => execFile('/usr/bin/ditto', ['-x', '-k', file, work], (e) => (e ? rej(e) : res())));
      const name = (await fsp.readdir(work)).find((n) => n.endsWith('.app'));
      if (!name) throw new Error('O pacote da atualização não tem a app.');
      const newApp = path.join(work, name);
      const script = path.join(dir(), 'instalar.sh');
      await fsp.writeFile(script, [
        '#!/bin/bash',
        `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done`,
        `rm -rf "${appPath}.antigo"`,
        `mv "${appPath}" "${appPath}.antigo" && mv "${newApp}" "${appPath}" || { mv "${appPath}.antigo" "${appPath}"; open "${appPath}"; exit 1; }`,
        `xattr -cr "${appPath}" 2>/dev/null`,
        `rm -rf "${appPath}.antigo" "${file}"`,
        `open "${appPath}"`,
      ].join('\n'), { mode: 0o755 });
      spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
      return true;
    }
    if (kind === 'win-nsis') {
      spawn(file, ['--updated', '/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
      return true;
    }
    if (kind === 'appimage') {
      const target = process.env.APPIMAGE;
      const tmp = target + '.novo';
      await fsp.copyFile(file, tmp);
      await fsp.chmod(tmp, 0o755);
      await fsp.rename(tmp, target);
      await fsp.rm(file, { force: true });
      // o processo novo não pode herdar as variáveis do AppImage antigo (apontam para a pasta montada que vai desaparecer)
      const env = { ...process.env };
      for (const k of ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD']) delete env[k];
      spawn(target, process.argv.slice(1).filter((a) => a !== '.'), { detached: true, stdio: 'ignore', env }).unref();
      app.quit();
      return true;
    }
    return false;
  }

  return { check, autoCheck, downloadUpdate, cancel, install, skip, openPage: () => latest?.url && shell.openExternal(latest.url) };
}

module.exports = { createUpdater, newer, installKind };
