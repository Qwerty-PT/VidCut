// Análise de som e imagem com o ffmpeg do Remotion (que não tem os filtros "select"/"ebur128"):
// sonoridade (LUFS) para normalizar, batidas para cortar ao ritmo e mudanças de cena.
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let ffmpegPath = () => ({ bin: 'ffmpeg', env: process.env });
function setFfmpeg(fn) { ffmpegPath = fn; }

function run(args, { onStdout } = {}) {
  return new Promise((resolve, reject) => {
    const { bin, env } = ffmpegPath();
    const p = spawn(bin, args, { env });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    if (onStdout) p.stdout.on('data', onStdout);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(err.trim().split('\n').slice(-3).join('\n') || `ffmpeg saiu com ${code}`))));
  });
}

const seekArgs = (start, dur) => [...(start > 0 ? ['-ss', start.toFixed(3)] : []), ...(dur > 0 ? ['-t', dur.toFixed(3)] : [])];

/** Som em mono como Float32Array (via WAV 16 bits: o ffmpeg do Remotion não tem o formato cru) */
async function decodePcm(file, rate, start = 0, dur = 0, onProgress) {
  const chunks = [];
  let header = Buffer.alloc(0), inData = false, got = 0, lastP = 0;
  const expected = dur > 0 ? dur * rate * 2 : 0;
  await run(['-v', 'error', ...seekArgs(start, dur), '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-acodec', 'pcm_s16le', '-bitexact', '-map_metadata', '-1', '-f', 'wav', '-'], {
    onStdout: (c) => {
      if (inData) {
        chunks.push(c); got += c.length;
        if (onProgress && expected && got - lastP > expected / 100) { lastP = got; onProgress(Math.min(0.99, got / expected)); }
        return;
      }
      header = Buffer.concat([header, c]);
      const i = header.indexOf('data');
      if (i < 0 || header.length < i + 8) return;
      inData = true;
      chunks.push(header.subarray(i + 8));
    },
  });
  const buf = Buffer.concat(chunks);
  const n = Math.floor(buf.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

// ---------------------------------------------------------------------------
// Sonoridade (EBU R128) — filtro loudnorm em modo de medição
// ---------------------------------------------------------------------------
async function loudness(file, start = 0, dur = 0) {
  const err = await run(['-hide_banner', '-nostats', ...seekArgs(start, dur), '-i', file, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
  const m = err.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!m) throw new Error('Não foi possível medir o volume.');
  const j = JSON.parse(m[0]);
  return { lufs: Number(j.input_i), peakDb: Number(j.input_tp), lra: Number(j.input_lra) };
}

// ---------------------------------------------------------------------------
// FFT (radix 2, no lugar)
// ---------------------------------------------------------------------------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Batidas: força dos ataques (fluxo espectral) → andamento (autocorrelação) → batidas (programação dinâmica, Ellis 2007)
// ---------------------------------------------------------------------------
const SR = 11025, NFFT = 1024, HOP = 128;

function onsetEnvelope(x) {
  const frames = Math.max(0, Math.floor((x.length - NFFT) / HOP) + 1);
  const win = new Float32Array(NFFT);
  for (let i = 0; i < NFFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NFFT);
  // bandas de ~40 Hz a ~5 kHz, em escala logarítmica (parecido com mel)
  const NB = 40;
  const edges = [];
  for (let b = 0; b <= NB; b++) edges.push(Math.round((40 * Math.pow(5000 / 40, b / NB)) / (SR / NFFT)));
  const prev = new Float32Array(NB);
  const env = new Float32Array(frames);
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < NFFT; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let flux = 0;
    for (let b = 0; b < NB; b++) {
      let s = 0;
      const lo = Math.max(1, edges[b]), hi = Math.max(lo + 1, edges[b + 1]);
      for (let k = lo; k < hi; k++) s += Math.hypot(re[k], im[k]);
      const v = Math.log1p(100 * (s / (hi - lo)));
      const d = v - prev[b];
      if (d > 0) flux += d;
      prev[b] = v;
    }
    env[f] = flux;
  }
  // tira a tendência lenta e normaliza
  const W = Math.round(SR / HOP); // ~1 s
  const out = new Float32Array(frames);
  let acc = 0;
  const csum = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) csum[i + 1] = csum[i] + env[i];
  for (let i = 0; i < frames; i++) {
    const a = Math.max(0, i - W), b = Math.min(frames, i + W + 1);
    out[i] = Math.max(0, env[i] - (csum[b] - csum[a]) / (b - a));
    acc += out[i] * out[i];
  }
  const sd = Math.sqrt(acc / Math.max(1, frames)) || 1;
  for (let i = 0; i < frames; i++) out[i] /= sd;
  return out;
}

const FPS_ENV = SR / HOP;

function estimateTempo(env) {
  const minLag = Math.floor((60 / 200) * FPS_ENV), maxLag = Math.ceil((60 / 50) * FPS_ENV);
  const n = env.length;
  const top = Math.min(n - 1, 4 * maxLag + 2);
  const ac = new Float64Array(4 * maxLag + 3);
  for (let lag = 1; lag <= top; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += env[i] * env[i - lag];
    ac[lag] = s / (n - lag);
  }
  // preferência suave por ~100 BPM (evita o dobro/metade) e reforço com os múltiplos (a batida repete-se a 2× e no compasso)
  const score = (lag) => {
    const bpm = (60 * FPS_ENV) / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100) / 0.9, 2));
    return w * (ac[lag] + ac[2 * lag] + 0.5 * ac[4 * lag]);
  };
  let best = minLag, bestV = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) { const v = score(lag); if (v > bestV) { bestV = v; best = lag; } }
  // refinamento parabólico
  const a = score(best - 1), b = bestV, c = score(best + 1);
  const d = a - 2 * b + c;
  const lag = d < 0 ? best + (0.5 * (a - c)) / d : best;
  return { lag, bpm: (60 * FPS_ENV) / lag };
}

function trackBeats(env, period) {
  const n = env.length;
  const score = new Float64Array(n), back = new Int32Array(n).fill(-1);
  const alpha = 100;
  const lo = Math.round(period / 2), hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0, arg = -1;
    for (let tau = t - hi; tau <= t - lo; tau++) {
      if (tau < 0) continue;
      const pen = Math.log((t - tau) / period);
      const v = score[tau] - alpha * pen * pen;
      if (arg < 0 || v > best) { best = v; arg = tau; }
    }
    score[t] = env[t] + (arg >= 0 ? Math.max(0, best) : 0);
    back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  // última batida: o melhor resultado no último período
  let end = n - 1;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > score[end]) end = t;
  const beats = [];
  for (let t = end; t >= 0; t = back[t]) beats.push(t);
  beats.reverse();
  return beats;
}

/** Batidas de um excerto: devolve tempos em segundos da fonte */
async function detectBeats(file, cacheDir) {
  const st = await fs.promises.stat(file);
  const key = crypto.createHash('sha1').update(`beats3|${path.resolve(file)}|${st.size}|${st.mtimeMs}`).digest('hex');
  const cached = cacheDir && path.join(cacheDir, `${key}.json`);
  if (cached) { try { return JSON.parse(await fs.promises.readFile(cached, 'utf8')); } catch { /* calcular */ } }
  const x = await decodePcm(file, SR);
  if (x.length < SR * 2) throw new Error('O som é demasiado curto para encontrar o ritmo.');
  const env = onsetEnvelope(x);
  const { lag, bpm } = estimateTempo(env);
  const idx = trackBeats(env, lag);
  const off = NFFT / 2 / SR; // centro da janela
  let beats = idx.map((i) => Math.round((i / FPS_ENV + off) * 1000) / 1000);
  // ignora o silêncio inicial/final (batidas onde não há ataques)
  const strength = idx.map((i) => Math.max(env[i - 1] ?? 0, env[i], env[i + 1] ?? 0));
  const thr = 0.15;
  let a = 0, b = beats.length - 1;
  while (a < b && strength[a] < thr) a++;
  while (b > a && strength[b] < thr) b--;
  beats = beats.slice(a, b + 1);
  const res = { bpm: Math.round(bpm * 10) / 10, beats };
  if (cached) { try { await fs.promises.mkdir(cacheDir, { recursive: true }); await fs.promises.writeFile(cached, JSON.stringify(res)); } catch { /* sem cache */ } }
  return res;
}

// ---------------------------------------------------------------------------
// Mudanças de cena: imagens pequenas em tons de cinza, diferença de histograma + diferença de píxeis
// ---------------------------------------------------------------------------
const SW = 64, SH = 36;

async function detectScenes(file, { start = 0, dur = 0, fps = 30, sensitivity = 0.5 } = {}) {
  const size = SW * SH;
  const scores = [];
  let prev = null, prevHist = null, rest = Buffer.alloc(0);
  const hist = () => new Float32Array(32);
  const consume = (frame) => {
    const h = hist();
    for (let i = 0; i < size; i++) h[frame[i] >> 3]++;
    if (prev) {
      let sad = 0;
      for (let i = 0; i < size; i++) sad += Math.abs(frame[i] - prev[i]);
      let hd = 0;
      for (let k = 0; k < 32; k++) hd += Math.abs(h[k] - prevHist[k]);
      scores.push(0.5 * (sad / size / 255) + 0.5 * (hd / (2 * size)));
    } else scores.push(0);
    prev = frame; prevHist = h;
  };
  await run(['-v', 'error', ...seekArgs(start, dur), '-i', file, '-an', '-sn', '-r', String(fps), '-vf', `scale=${SW}:${SH}:flags=area,format=gray`, '-c:v', 'rawvideo', '-f', 'image2pipe', '-'], {
    onStdout: (c) => {
      let buf = rest.length ? Buffer.concat([rest, c]) : c;
      let o = 0;
      for (; o + size <= buf.length; o += size) consume(Uint8Array.from(buf.subarray(o, o + size)));
      rest = Buffer.from(buf.subarray(o));
    },
  });
  // corte = pico claramente acima da vizinhança e de um mínimo absoluto
  const minAbs = 0.32 - 0.22 * Math.min(1, Math.max(0, sensitivity)); // 0,10 (sensível) … 0,32
  const cuts = [];
  const R = Math.max(3, Math.round(fps * 0.4));
  const minGap = Math.round(fps * 0.5);
  for (let i = 1; i < scores.length; i++) {
    const s = scores[i];
    if (s < minAbs) continue;
    let localMax = true, around = [];
    for (let j = i - R; j <= i + R; j++) {
      if (j === i || j < 1 || j >= scores.length) continue;
      if (scores[j] > s) { localMax = false; break; }
      around.push(scores[j]);
    }
    if (!localMax) continue;
    around.sort((a, b) => a - b);
    const med = around.length ? around[Math.floor(around.length / 2)] : 0;
    if (s < med * 3 + 0.04) continue; // movimento rápido (sobe tudo à volta) não é corte
    if (cuts.length && i - cuts[cuts.length - 1] < minGap) continue;
    cuts.push(i);
  }
  return { frames: scores.length, cuts: cuts.map((i) => Math.round((start + i / fps) * 1000) / 1000) };
}

// ---------------------------------------------------------------------------
// Envelope de energia (para cortar silêncios e detetar voz): dB por bloco de 20 ms
// ---------------------------------------------------------------------------
const ENV_HOP = 0.02;
async function energyEnvelope(file, start = 0, dur = 0, onProgress) {
  const rate = 16000;
  const x = await decodePcm(file, rate, start, dur, onProgress);
  const n = Math.round(rate * ENV_HOP);
  const frames = Math.floor(x.length / n);
  const db = new Array(frames);
  // filtro passa-alto simples (tira roncos de vento/ar condicionado que enganam a deteção de fala)
  let prevIn = 0, prevOut = 0;
  for (let f = 0; f < frames; f++) {
    let acc = 0;
    for (let i = f * n; i < (f + 1) * n; i++) {
      const y = 0.97 * (prevOut + x[i] - prevIn); prevIn = x[i]; prevOut = y;
      acc += y * y;
    }
    db[f] = Math.round(Math.max(-100, 10 * Math.log10(acc / n + 1e-12)) * 10) / 10;
  }
  return { hop: ENV_HOP, db };
}

// ---------------------------------------------------------------------------
// Redução de ruído: "spectral gating" — mede o ruído nas partes mais calmas e tira-o de todo o som
// ---------------------------------------------------------------------------
function writeWav(path, samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return fs.promises.writeFile(path, buf);
}

/** strength 0..1 (0,5 = normal). Devolve o caminho do WAV limpo (mono 48 kHz, mesma duração) */
async function denoise(file, outPath, strength = 0.5, onProgress) {
  const rate = 48000, N = 2048, H = 512, B = N / 2 + 1;
  const x = await decodePcm(file, rate);
  if (x.length < N * 4) throw new Error('O som é demasiado curto.');
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); // raiz de Hann (análise e síntese)
  const frames = Math.floor((x.length - N) / H) + 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  // 1) energia por fotograma, para escolher os mais calmos como amostra de ruído
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let a = 0; for (let i = 0; i < N; i += 4) a += x[f * H + i] ** 2; energy[f] = a; }
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
  const quiet = order.slice(0, Math.max(8, Math.floor(frames * 0.1)));
  const noise = new Float64Array(B);
  const mags = [];
  for (const f of quiet) {
    for (let i = 0; i < N; i++) { re[i] = x[f * H + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float64Array(B);
    for (let k = 0; k < B; k++) m[k] = Math.hypot(re[k], im[k]);
    mags.push(m);
  }
  for (let k = 0; k < B; k++) { const col = mags.map((m) => m[k]).sort((a, b) => a - b); noise[k] = col[Math.floor(col.length * 0.6)]; }
  // 2) ganho por bin: tira o ruído, com chão (evita o som "aquático") e suavização no tempo
  const alpha = 1.0 + 1.5 * strength; // quanto acima do ruído é preciso estar para passar
  const floor = Math.pow(10, -(8 + 16 * strength) / 20); // −8 dB (suave) a −24 dB (forte)
  const out = new Float64Array(x.length + N);
  const norm = new Float64Array(x.length + N);
  let prevG = new Float64Array(B).fill(1);
  const g = new Float64Array(B), gs = new Float64Array(B);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < B; k++) {
      const mag = Math.hypot(re[k], im[k]) + 1e-12;
      const r = (alpha * noise[k]) / mag;
      g[k] = Math.max(floor, Math.sqrt(Math.max(0, 1 - r * r)));
    }
    // suavizar na frequência (3 bins) e no tempo (sobe depressa, desce devagar)
    for (let k = 0; k < B; k++) {
      const v = (g[Math.max(0, k - 1)] + 2 * g[k] + g[Math.min(B - 1, k + 1)]) / 4;
      gs[k] = v > prevG[k] ? v : prevG[k] * 0.6 + v * 0.4;
    }
    prevG = Float64Array.from(gs);
    for (let k = 0; k < B; k++) {
      re[k] *= gs[k]; im[k] *= gs[k];
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    // FFT inversa via conjugado
    for (let i = 0; i < N; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < N; i++) { out[o + i] += (re[i] / N) * win[i]; norm[o + i] += win[i] * win[i]; }
    if (onProgress && f % 2000 === 0) onProgress(f / frames);
  }
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  await writeWav(outPath, y, rate);
  return outPath;
}

module.exports = { setFfmpeg, decodePcm, loudness, detectBeats, detectScenes, onsetEnvelope, estimateTempo, trackBeats, energyEnvelope, denoise, writeWav };
