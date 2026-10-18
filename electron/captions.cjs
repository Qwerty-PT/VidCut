// Legendas automáticas locais: whisper.cpp (via @remotion/install-whisper-cpp), sem internet depois da 1.ª vez.
// Passos: instalar o whisper.cpp (só a 1.ª vez) → descarregar o modelo (só a 1.ª vez por modelo)
//         → extrair o áudio do excerto (16 kHz mono) → transcrever com tempo por palavra.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } = require('@remotion/install-whisper-cpp');
const { ffmpegPath } = require('./peaks.cjs');

const WHISPER_VERSION = '1.5.5';
const MODELS = { base: 142, small: 466, medium: 1500 }; // MB aproximados

function dirs(dataDir) {
  const root = path.join(dataDir, 'whisper');
  return { root, bin: path.join(root, `whisper.cpp-${WHISPER_VERSION}`), models: path.join(root, 'models') };
}

const modelFile = (d, model) => path.join(d.models, `ggml-${model}.bin`);

function status(dataDir) {
  const d = dirs(dataDir);
  const exe = path.join(d.bin, process.platform === 'win32' ? 'main.exe' : 'main');
  return {
    installed: fs.existsSync(exe),
    models: Object.fromEntries(Object.keys(MODELS).map((m) => [m, fs.existsSync(modelFile(d, m))])),
    sizes: MODELS,
  };
}

function extractAudio(file, startSec, durSec, out, signal) {
  return new Promise((resolve, reject) => {
    const { bin, env } = ffmpegPath();
    const args = ['-v', 'error', '-y'];
    if (startSec > 0) args.push('-ss', startSec.toFixed(3));
    args.push('-i', file);
    if (durSec > 0) args.push('-t', durSec.toFixed(3));
    args.push('-vn', '-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'wav', out);
    const p = spawn(bin, args, { env });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    const onAbort = () => p.kill('SIGKILL');
    signal?.addEventListener('abort', onAbort);
    p.on('error', reject);
    p.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(new Error('cancelado'));
      code === 0 ? resolve(out) : reject(new Error(`ffmpeg falhou (${code}): ${err.slice(-300)}`));
    });
  });
}

/**
 * @param {{ dataDir: string, file: string, startSec: number, durSec: number, model: keyof MODELS, language: string|null }} o
 * @param {(p: {stage: string, progress: number, message: string}) => void} onProgress
 */
function transcribeMedia(o, onProgress) {
  const ctrl = new AbortController();
  const signal = ctrl.signal;
  const d = dirs(o.dataDir);
  const model = MODELS[o.model] ? o.model : 'small';
  const promise = (async () => {
    fs.mkdirSync(d.models, { recursive: true });
    const st = status(o.dataDir);
    if (!st.installed) {
      onProgress({ stage: 'install', progress: 0, message: 'A preparar o motor de transcrição (só na primeira vez, 1–3 min)…' });
      if (fs.existsSync(d.bin)) fs.rmSync(d.bin, { recursive: true, force: true }); // instalação incompleta anterior
      await installWhisperCpp({ version: WHISPER_VERSION, to: d.bin, printOutput: false, signal });
    }
    if (!st.models[model]) {
      onProgress({ stage: 'download', progress: 0, message: `A descarregar o modelo "${model}" (~${MODELS[model]} MB, só na primeira vez)…` });
      await downloadWhisperModel({
        model, folder: d.models, printOutput: false, signal,
        onProgress: (done, total) => onProgress({ stage: 'download', progress: total ? done / total : 0, message: `A descarregar o modelo "${model}"… ${Math.round(done / 1048576)} / ${Math.round(total / 1048576)} MB` }),
      });
    }
    onProgress({ stage: 'audio', progress: 0, message: 'A extrair o áudio…' });
    const wav = path.join(os.tmpdir(), `vidcut-legendas-${process.pid}-${Date.now()}.wav`);
    await extractAudio(o.file, o.startSec, o.durSec, wav, signal);
    try {
      onProgress({ stage: 'transcribe', progress: 0, message: 'A transcrever…' });
      const out = await transcribe({
        inputPath: wav, whisperPath: d.bin, whisperCppVersion: WHISPER_VERSION, model, modelFolder: d.models,
        tokenLevelTimestamps: true, language: o.language || null, printOutput: false, signal, splitOnWord: true,
        onProgress: (p) => onProgress({ stage: 'transcribe', progress: p, message: `A transcrever… ${Math.round(p * 100)}%` }),
      });
      const { captions } = toCaptions({ whisperCppOutput: out });
      onProgress({ stage: 'done', progress: 1, message: 'Concluído' });
      return { captions, language: out.result?.language ?? o.language ?? '' };
    } finally {
      fs.rm(wav, { force: true }, () => {});
    }
  })();
  return { promise, cancel: () => ctrl.abort() };
}

module.exports = { transcribeMedia, captionsStatus: status, WHISPER_VERSION, MODELS };
