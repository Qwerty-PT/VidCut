// Cópias de media geradas com o ffmpeg do Remotion: clip invertido e proxies (cópias leves para a pré-visualização).
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let ffmpegPath = () => ({ bin: 'ffmpeg', env: process.env });
function setFfmpeg(fn) { ffmpegPath = fn; }

function spawnFf(args) {
  const { bin, env } = ffmpegPath();
  return spawn(bin, args, { env });
}
function run(args, { onStdout, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawnFf(args);
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 100000) err = err.slice(-50000); onStderr?.(String(d)); });
    if (onStdout) p.stdout.on('data', onStdout);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-3).join('\n') || `ffmpeg saiu com ${code}`))));
  });
}

const fileKey = async (file, extra) => {
  const st = await fs.promises.stat(file);
  return crypto.createHash('sha1').update(`${path.resolve(file)}|${st.size}|${st.mtimeMs}|${extra}`).digest('hex').slice(0, 16);
};
const safeBase = (file) => path.basename(file).replace(/\.[^.]+$/, '').replace(/[^\w\-À-ÿ ]+/g, '_').slice(0, 50);

// ---------------------------------------------------------------------------
// Inverter: o vídeo é lido em blocos de 1 s (JPEG de alta qualidade), do fim para o início, e cada bloco
// é escrito ao contrário num codificador H.264; o som é invertido amostra a amostra.
// ---------------------------------------------------------------------------
function splitJpegs(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length - 1) {
    const s = buf.indexOf(Buffer.from([0xff, 0xd8]), i);
    if (s < 0) break;
    const e = buf.indexOf(Buffer.from([0xff, 0xd9]), s + 2);
    if (e < 0) break;
    out.push(buf.subarray(s, e + 2));
    i = e + 2;
  }
  return out;
}

async function decodeStereo(file, rate, start, dur) {
  const chunks = [];
  let header = Buffer.alloc(0), inData = false;
  await run(['-v', 'error', '-ss', start.toFixed(3), '-t', dur.toFixed(3), '-i', file, '-vn', '-ac', '2', '-ar', String(rate), '-acodec', 'pcm_s16le', '-f', 'wav', '-'], {
    onStdout: (c) => {
      if (inData) { chunks.push(c); return; }
      header = Buffer.concat([header, c]);
      const i = header.indexOf('data');
      if (i < 0 || header.length < i + 8) return;
      inData = true; chunks.push(header.subarray(i + 8));
    },
  });
  return Buffer.concat(chunks);
}

function wavHeader(bytes, rate, ch) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40);
  return h;
}

/**
 * Gera a cópia invertida do excerto [start, start+dur] (segundos) de `file`.
 * kind: 'video' | 'audio'. Devolve o caminho do ficheiro (mp4 ou wav).
 */
async function reverseMedia({ file, start, dur, fps, kind, hasAudio, outDir, onProgress }) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const key = await fileKey(file, `rev2|${start.toFixed(3)}|${dur.toFixed(3)}|${fps}|${kind}`);
  const out = path.join(outDir, `${safeBase(file)} (invertido ${key.slice(0, 6)}).${kind === 'audio' ? 'wav' : 'mp4'}`);
  if (await fs.promises.stat(out).catch(() => null)) return out;
  const tmp = out + '.tmp';
  const rate = 48000;
  let wav = null;
  if (kind === 'audio' || hasAudio) {
    const pcm = await decodeStereo(file, rate, start, dur);
    const n = Math.floor(pcm.length / 4);
    const rev = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) rev.writeUInt32LE(pcm.readUInt32LE((n - 1 - i) * 4), i * 4); // 2 canais × 16 bits juntos
    wav = Buffer.concat([wavHeader(rev.length, rate, 2), rev]);
    if (kind === 'audio') { await fs.promises.writeFile(tmp, wav); await fs.promises.rename(tmp, out); return out; }
  }
  const total = Math.max(1, Math.round(dur * fps));
  const audioTmp = wav ? out + '.a.wav' : null;
  if (audioTmp) await fs.promises.writeFile(audioTmp, wav);
  const enc = spawnFf([
    '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    ...(audioTmp ? ['-i', audioTmp] : []),
    '-map', '0:v', ...(audioTmp ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '192k'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-shortest', '-f', 'mp4', '-y', tmp,
  ]);
  let encErr = '';
  enc.stderr.on('data', (d) => { encErr += d; });
  const encDone = new Promise((resolve, reject) => { enc.on('close', (c) => (c === 0 ? resolve() : reject(new Error(encErr.trim().slice(-400) || 'Erro ao codificar.')))); enc.on('error', reject); });
  const write = (b) => new Promise((resolve) => { if (enc.stdin.write(b)) resolve(); else enc.stdin.once('drain', resolve); });
  const CH = Math.max(1, Math.round(fps)); // 1 s por bloco
  let done = 0;
  try {
    for (let end = total; end > 0; end -= CH) {
      const a = Math.max(0, end - CH);
      const chunks = [];
      await run(['-v', 'error', '-ss', (start + a / fps).toFixed(4), '-i', file, '-an', '-sn', '-r', String(fps), '-frames:v', String(end - a), '-c:v', 'mjpeg', '-q:v', '2', '-pix_fmt', 'yuvj420p', '-f', 'image2pipe', '-'], { onStdout: (c) => chunks.push(c) });
      const frames = splitJpegs(Buffer.concat(chunks));
      // se o ficheiro acabou antes do esperado, repete o último fotograma para manter a duração
      while (frames.length && frames.length < end - a) frames.push(frames[frames.length - 1]);
      for (let i = frames.length - 1; i >= 0; i--) await write(frames[i]);
      done += end - a;
      onProgress?.(Math.min(0.99, done / total));
    }
    enc.stdin.end();
    await encDone;
  } catch (e) { try { enc.kill(); } catch { /* */ } throw e; }
  finally { if (audioTmp) await fs.promises.rm(audioTmp, { force: true }); }
  await fs.promises.rename(tmp, out);
  return out;
}

// ---------------------------------------------------------------------------
// Proxies: H.264 com GOP curto, 540p (ou o lado menor original se for menor), em cache por ficheiro
// ---------------------------------------------------------------------------
async function proxyPath(file, dir) {
  try { return path.join(dir, `${safeBase(file)}-${await fileKey(file, 'proxy540')}.mp4`); } catch { return null; }
}

async function makeProxy(file, dir, durationSec, onProgress, signal) {
  await fs.promises.mkdir(dir, { recursive: true });
  const out = await proxyPath(file, dir);
  if (!out) throw new Error('Ficheiro não encontrado.');
  if (await fs.promises.stat(out).catch(() => null)) return out;
  const tmp = out + '.tmp.mp4';
  await new Promise((resolve, reject) => {
    const p = spawnFf(['-v', 'error', '-nostats', '-progress', 'pipe:1', '-i', file,
      '-vf', "scale='trunc(oh*a/2)*2':'min(540,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-g', '15', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-y', tmp]);
    let err = '', buf = '';
    p.stdout.on('data', (d) => {
      buf += d;
      const m = [...buf.matchAll(/out_time_(?:ms|us)=(\d+)/g)].pop();
      if (m && durationSec > 0) onProgress?.(Math.min(0.99, Number(m[1]) / 1e6 / durationSec));
      if (buf.length > 4000) buf = buf.slice(-1000);
    });
    p.stderr.on('data', (d) => { err += d; });
    const abort = () => { try { p.kill(); } catch { /* */ } };
    signal?.addEventListener('abort', abort);
    p.on('error', reject);
    p.on('close', (c) => { signal?.removeEventListener('abort', abort); c === 0 ? resolve() : reject(new Error(signal?.aborted ? 'cancelado' : err.trim().slice(-300) || 'Erro no proxy.')); });
  }).catch(async (e) => { await fs.promises.rm(tmp, { force: true }); throw e; });
  await fs.promises.rename(tmp, out);
  return out;
}

module.exports = { setFfmpeg, reverseMedia, makeProxy, proxyPath, splitJpegs };
