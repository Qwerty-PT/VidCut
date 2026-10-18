// Biblioteca de animações Lottie do utilizador (pasta de dados da app → lotties/).
// Aceita .json (Lottie/bodymovin) e .lottie (dotLottie: zip com manifest.json + animations/*.json).
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { unzipSync, strFromU8 } = require('fflate');

const MAX_BYTES = 15 * 1024 * 1024;

function isLottieJson(o) {
  return !!o && typeof o === 'object' && typeof o.w === 'number' && typeof o.h === 'number'
    && typeof o.fr === 'number' && typeof o.ip === 'number' && typeof o.op === 'number' && Array.isArray(o.layers);
}

/** Extrai as animações de um ficheiro (.json ou .lottie) → [{ name, data }] */
async function readAnimations(file) {
  const st = await fs.stat(file);
  if (st.size > MAX_BYTES) throw new Error('ficheiro demasiado grande (máx. 15 MB)');
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  if (ext === '.lottie') {
    const files = unzipSync(new Uint8Array(await fs.readFile(file)));
    const names = Object.keys(files);
    let ids = [];
    if (files['manifest.json']) {
      try { ids = (JSON.parse(strFromU8(files['manifest.json'])).animations || []).map((a) => a.id).filter(Boolean); } catch { /* sem manifest válido */ }
    }
    const jsonFiles = ids.length
      ? ids.map((id) => names.find((n) => n === `animations/${id}.json` || n === `a/${id}.json`)).filter(Boolean)
      : names.filter((n) => /^(animations|a)\/[^/]+\.json$/.test(n));
    const out = [];
    for (const n of jsonFiles) {
      const data = JSON.parse(strFromU8(files[n]));
      if (data.assets?.some((a) => a.p && !String(a.p).startsWith('data:') && a.e !== 1)) {
        // imagens externas dentro do .lottie: embutir como data URI
        for (const a of data.assets) {
          if (!a.p || String(a.p).startsWith('data:')) continue;
          const key = names.find((x) => x.endsWith('/' + a.p) || x === `images/${a.p}` || x === `i/${a.p}`);
          if (key) { const mime = /\.png$/i.test(a.p) ? 'image/png' : /\.webp$/i.test(a.p) ? 'image/webp' : 'image/jpeg'; a.p = `data:${mime};base64,${Buffer.from(files[key]).toString('base64')}`; a.u = ''; a.e = 1; }
        }
      }
      if (isLottieJson(data)) out.push({ name: jsonFiles.length > 1 ? `${base} ${out.length + 1}` : base, data });
    }
    if (!out.length) throw new Error('não encontrei nenhuma animação dentro do .lottie');
    return out;
  }
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!isLottieJson(data)) throw new Error('não é uma animação Lottie (JSON do bodymovin)');
  return [{ name: base, data }];
}

function createLottieLibrary(dir) {
  const ensure = () => fs.mkdir(dir, { recursive: true });
  return {
    async list() {
      await ensure();
      const out = [];
      for (const f of (await fs.readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
        try {
          const w = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
          if (w && isLottieJson(w.data)) out.push({ id: path.basename(f, '.json'), name: String(w.name || f), data: w.data });
        } catch { /* ficheiro estragado: ignora */ }
      }
      return out;
    },
    async import(files) {
      await ensure();
      const added = [], errors = [];
      for (const file of files) {
        try {
          for (const a of await readAnimations(file)) {
            const json = JSON.stringify(a.data);
            const id = 'user-' + crypto.createHash('sha1').update(json).digest('hex').slice(0, 12);
            const name = (typeof a.data.nm === 'string' && a.data.nm.trim() && a.data.nm.length < 60 ? a.data.nm.trim() : a.name);
            await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify({ name, data: a.data }));
            added.push({ id, name, data: a.data });
          }
        } catch (e) {
          errors.push(`${path.basename(file)}: ${e.message || e}`);
        }
      }
      return { added, errors };
    },
    async remove(id) {
      if (!/^user-[a-f0-9]{12}$/.test(id)) return false;
      await fs.rm(path.join(dir, `${id}.json`), { force: true });
      return true;
    },
    async rename(id, name) {
      if (!/^user-[a-f0-9]{12}$/.test(id)) return false;
      const f = path.join(dir, `${id}.json`);
      const w = JSON.parse(await fs.readFile(f, 'utf8'));
      w.name = String(name).slice(0, 80);
      await fs.writeFile(f, JSON.stringify(w));
      return true;
    },
  };
}

module.exports = { createLottieLibrary, readAnimations, isLottieJson };
