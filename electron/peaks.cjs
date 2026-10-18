// Picos de áudio (forma de onda) calculados com o ffmpeg do Remotion, com cache em disco.
// 100 picos por segundo, 0–255 (raiz quadrada para realçar sons baixos).
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { binariesDirectory } = require('./render.cjs');

const PER_SEC = 100;
const RATE = 8000; // amostras/s pedidas ao ffmpeg (chega para a forma de onda)
const inflight = new Map();

function ffmpegPath() {
  const dir = binariesDirectory();
  if (!dir) return { bin: 'ffmpeg', env: process.env };
  const bin = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const env = { ...process.env };
  if (process.platform === 'linux') env.LD_LIBRARY_PATH = [dir, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  if (process.platform === 'darwin') env.DYLD_LIBRARY_PATH = [dir, env.DYLD_LIBRARY_PATH].filter(Boolean).join(':');
  return { bin, env };
}

function compute(file) {
  return new Promise((resolve) => {
    const { bin, env } = ffmpegPath();
    // o ffmpeg do Remotion não tem o formato "s16le" cru: pede-se WAV (PCM 16 bits) e salta-se o cabeçalho
    const p = spawn(bin, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-acodec', 'pcm_s16le', '-bitexact', '-map_metadata', '-1', '-f', 'wav', '-'], { env });
    const bucket = RATE / PER_SEC;
    const peaks = [];
    let cur = 0, n = 0, rest = null;
    let header = Buffer.alloc(0), inData = false;
    p.stdout.on('data', (chunk0) => {
      let chunk = chunk0;
      if (!inData) {
        header = Buffer.concat([header, chunk0]);
        const i = header.indexOf('data');
        if (i < 0 || header.length < i + 8) return;
        inData = true;
        chunk = header.subarray(i + 8);
      }
      let buf = rest ? Buffer.concat([rest, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const v = Math.abs(buf.readInt16LE(i));
        if (v > cur) cur = v;
        if (++n >= bucket) { peaks.push(Math.round(Math.sqrt(cur / 32768) * 255)); cur = 0; n = 0; }
      }
      rest = usable < buf.length ? buf.subarray(usable) : null;
    });
    p.on('error', () => resolve(Buffer.alloc(0)));
    p.on('close', () => { if (n > 0) peaks.push(Math.round(Math.sqrt(cur / 32768) * 255)); resolve(Buffer.from(peaks)); });
  });
}

/** Devolve os picos (Buffer) de um ficheiro; vazio se não tiver áudio */
async function getPeaks(file, cacheDir) {
  const st = await fs.promises.stat(file);
  const key = crypto.createHash('sha1').update(`${path.resolve(file)}|${st.size}|${st.mtimeMs}|${PER_SEC}`).digest('hex');
  const cached = path.join(cacheDir, `${key}.peaks`);
  try { return await fs.promises.readFile(cached); } catch { /* calcular */ }
  if (!inflight.has(key)) {
    inflight.set(key, compute(file).then(async (buf) => {
      try { await fs.promises.mkdir(cacheDir, { recursive: true }); await fs.promises.writeFile(cached, buf); } catch { /* sem cache */ }
      inflight.delete(key);
      return buf;
    }));
  }
  return inflight.get(key);
}

module.exports = { getPeaks, PER_SEC, ffmpegPath };
