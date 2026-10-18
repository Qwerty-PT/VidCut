// Projetos portáteis: caminhos relativos, reencontrar ficheiros em falta e empacotar o projeto com a media.
const fs = require('node:fs');
const path = require('node:path');

const exists = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };
/** Nome do ficheiro, venha o caminho do Windows, Mac ou Linux */
const baseName = (p) => String(p || '').split(/[\\/]/).pop() || '';
const toPosix = (p) => p.split(path.sep).join('/');

async function addRelativePaths(project, dir) {
  const media = await Promise.all((project.media || []).map(async (m) => {
    const st = await fs.promises.stat(m.path).catch(() => null);
    return { ...m, rel: toPosix(path.relative(dir, m.path)), ...(st ? { size: st.size } : {}) };
  }));
  return { ...project, media };
}

/**
 * Confirma os caminhos da media; o que não existir procura-se pelo caminho relativo ao projeto,
 * ao lado do projeto e em media/ (pacotes). Devolve o projeto corrigido e o que continua em falta.
 */
async function resolveMedia(project, baseDir) {
  const missing = [];
  let moved = 0;
  const media = (project.media || []).map((m) => {
    if (exists(m.path)) return m;
    const cands = [];
    if (baseDir) {
      if (m.rel) cands.push(path.resolve(baseDir, ...m.rel.split('/')));
      cands.push(path.join(baseDir, baseName(m.path)), path.join(baseDir, 'media', baseName(m.path)));
    }
    const hit = cands.find(exists);
    if (hit) { moved++; return { ...m, path: hit }; }
    missing.push({ id: m.id, name: m.name, file: baseName(m.path), size: m.size ?? null, path: m.path });
    return m;
  });
  return { project: { ...project, media }, missing, moved };
}

/** Procura numa pasta (e subpastas) os ficheiros em falta, pelo nome (e tamanho, quando se sabe) */
async function searchFolder(root, missing) {
  const want = new Map();
  for (const m of missing) {
    const k = String(m.file || '').toLowerCase();
    if (!k) continue;
    if (!want.has(k)) want.set(k, []);
    want.get(k).push(m);
  }
  const found = {};
  let seen = 0;
  const walk = async (dir, depth) => {
    if (depth > 7 || seen > 40000 || Object.keys(found).length === missing.length) return;
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      seen++;
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(full, depth + 1); continue; }
      const list = want.get(e.name.toLowerCase());
      if (!list) continue;
      const st = await fs.promises.stat(full).catch(() => null);
      for (const m of list) {
        if (found[m.id]) continue;
        if (m.size && st && st.size !== m.size) continue; // mesmo nome, outro ficheiro
        found[m.id] = full;
      }
    }
  };
  await walk(root, 0);
  // segunda passagem sem exigir o tamanho (ficheiro reexportado com o mesmo nome)
  const rest = missing.filter((m) => !found[m.id] && m.size);
  if (rest.length) {
    const loose = await searchFolder(root, rest.map((m) => ({ ...m, size: null })));
    Object.assign(found, loose);
  }
  return found;
}

/** Ids de media usados pelos clips (inclui imagens dentro de modelos e o original de clips invertidos) */
function usedMediaIds(project) {
  const ids = new Set();
  const all = new Set((project.media || []).map((m) => m.id));
  for (const t of project.tracks || []) for (const c of t.clips || []) {
    if (c.mediaId) ids.add(c.mediaId);
    if (c.reversed?.mediaId) ids.add(c.reversed.mediaId);
    if (c.template?.props) for (const v of Object.values(c.template.props)) if (typeof v === 'string' && all.has(v)) ids.add(v);
  }
  return ids;
}

/** Copia o projeto e a media que usa para uma pasta nova "<nome> (pacote)" com media/ e projeto.vidcut */
async function packProject(project, parent, onProgress) {
  const safe = String(project.name || 'Projeto').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Projeto';
  let dir = path.join(parent, `${safe} (pacote)`);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(parent, `${safe} (pacote ${i})`);
  const mdir = path.join(dir, 'media');
  await fs.promises.mkdir(mdir, { recursive: true });
  const used = usedMediaIds(project);
  const items = (project.media || []).filter((m) => used.has(m.id));
  const sizes = await Promise.all(items.map((m) => fs.promises.stat(m.path).then((s) => s.size).catch(() => 0)));
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  const names = new Set();
  const missing = [];
  let copied = 0;
  const media = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    if (!exists(m.path)) { missing.push(m.name); media.push(m); continue; }
    let name = baseName(m.path);
    const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
    for (let k = 2; names.has(name.toLowerCase()); k++) name = `${stem} (${k})${ext}`;
    names.add(name.toLowerCase());
    const dest = path.join(mdir, name);
    await fs.promises.copyFile(m.path, dest);
    copied += sizes[i];
    onProgress?.(copied / total);
    media.push({ ...m, path: dest, rel: `media/${name}`, size: sizes[i] });
  }
  const out = { ...project, media };
  const file = path.join(dir, `${safe}.vidcut`);
  await fs.promises.writeFile(file, JSON.stringify(out, null, 2), 'utf8');
  return { dir, file, count: items.length - missing.length, bytes: copied, missing };
}

module.exports = { addRelativePaths, resolveMedia, searchFolder, packProject, usedMediaIds, baseName };
