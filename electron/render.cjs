// Export do projeto (MP4, HEVC, WebM, ProRes, GIF, MP3, WAV) com @remotion/renderer.
// Funciona dentro do Electron e também em Node puro (scripts/test-render.cjs).
const path = require('node:path');
const {
  ensureBrowser, selectComposition, renderMedia, makeCancelSignal,
} = require('@remotion/renderer');

/** Pasta dos binários nativos do Remotion (compositor + ffmpeg), corrigida para app.asar.unpacked */
function binariesDirectory() {
  const p = process.platform, a = process.arch;
  const candidates = {
    win32: { x64: ['@remotion/compositor-win32-x64-msvc'] },
    darwin: { x64: ['@remotion/compositor-darwin-x64'], arm64: ['@remotion/compositor-darwin-arm64'] },
    linux: {
      x64: ['@remotion/compositor-linux-x64-gnu', '@remotion/compositor-linux-x64-musl'],
      arm64: ['@remotion/compositor-linux-arm64-gnu', '@remotion/compositor-linux-arm64-musl'],
    },
  }[p]?.[a] || [];
  for (const name of candidates) {
    try {
      const dir = require(name).dir;
      return dir.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    } catch { /* tenta o seguinte */ }
  }
  return null; // deixa o Remotion decidir
}

/** Pasta do bundle Remotion pré-compilado */
function bundleDir(appRoot) {
  return path.join(appRoot, 'remotion-bundle').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

let browserReady = null;
function prepareBrowser(onStatus) {
  if (!browserReady) {
    onStatus?.('A preparar o motor de render (só na primeira vez pode demorar)…');
    browserReady = ensureBrowser({ logLevel: 'warn' }).catch((e) => { browserReady = null; throw e; });
  }
  return browserReady;
}

/**
 * @param {object} o
 * @param {string} o.appRoot   raiz da app (onde está remotion-bundle/)
 * @param {object} o.project   projeto VidCut
 * @param {string} o.mediaBase URL do servidor de media
 * @param {string} o.outPath   ficheiro .mp4 de saída
 * @param {(p:{stage:string, progress:number, message?:string})=>void} [o.onProgress]
 * @returns {{promise: Promise<string>, cancel: () => void}}
 */
const CODECS = new Set(['h264', 'h265', 'vp9', 'prores', 'gif', 'mp3', 'wav']);

/** Valida e normaliza a especificação vinda da interface */
function normalizeSpec(spec) {
  const s = spec || {};
  const codec = CODECS.has(s.codec) ? s.codec : 'h264';
  const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const out = {
    codec,
    crf: s.crf == null ? null : num(s.crf, 0, 63, null),
    audioBitrate: typeof s.audioBitrate === 'string' && /^\d{2,3}k$/.test(s.audioBitrate) ? s.audioBitrate : null,
    scale: num(s.scale, 0.1, 4, 1),
    frameRange: Array.isArray(s.frameRange) && s.frameRange.length === 2 && s.frameRange.every(Number.isInteger) && s.frameRange[1] >= s.frameRange[0]
      ? [Math.max(0, s.frameRange[0]), s.frameRange[1]] : null,
    everyNthFrame: codec === 'gif' ? Math.round(num(s.everyNthFrame, 1, 30, 1)) : 1,
    muted: !!s.muted,
  };
  return out;
}

function codecOptions(spec) {
  const c = spec.codec;
  const o = { codec: c };
  if (c === 'h264' || c === 'h265') { o.pixelFormat = 'yuv420p'; o.audioCodec = 'aac'; }
  if (c === 'vp9') { o.pixelFormat = 'yuv420p'; o.audioCodec = 'opus'; }
  if (c === 'prores') { o.proResProfile = 'hq'; o.audioCodec = 'pcm-16'; }
  if (c === 'mp3') o.audioCodec = 'mp3';
  if (c === 'wav') o.audioCodec = 'pcm-16';
  if (spec.crf != null && (c === 'h264' || c === 'h265' || c === 'vp9')) o.crf = spec.crf;
  if (spec.audioBitrate && c !== 'wav' && c !== 'prores' && c !== 'gif') o.audioBitrate = spec.audioBitrate;
  if (c === 'gif') { o.everyNthFrame = spec.everyNthFrame; o.numberOfGifLoops = null; }
  if (spec.muted && c !== 'mp3' && c !== 'wav') o.muted = true;
  if (spec.frameRange) o.frameRange = spec.frameRange;
  if (spec.scale !== 1 && c !== 'mp3' && c !== 'wav') o.scale = spec.scale;
  // HEVC com etiqueta hvc1: sem isto o QuickTime/Fotos do Mac não abrem o ficheiro
  if (c === 'h265') {
    o.ffmpegOverride = ({ type, args }) => {
      if (type !== 'stitcher' || args.includes('hvc1')) return args;
      const out = args.slice();
      out.splice(out.length - 1, 0, '-tag:v', 'hvc1');
      return out;
    };
  }
  return o;
}

function renderProject({ appRoot, project, mediaBase, outPath, onProgress, spec: rawSpec }) {
  const spec = normalizeSpec(rawSpec);
  const { cancelSignal, cancel } = makeCancelSignal();
  const serveUrl = bundleDir(appRoot);
  const binDir = binariesDirectory();
  const inputProps = { project, mediaBase };

  const promise = (async () => {
    await prepareBrowser((message) => onProgress?.({ stage: 'browser', progress: 0, message }));
    onProgress?.({ stage: 'prepare', progress: 0, message: 'A preparar a composição…' });
    const composition = await selectComposition({
      serveUrl, id: 'VidCut', inputProps, binariesDirectory: binDir, logLevel: 'warn',
    });
    await renderMedia({
      composition,
      serveUrl,
      ...codecOptions(spec),
      outputLocation: outPath,
      inputProps,
      binariesDirectory: binDir,
      cancelSignal,
      overwrite: true,
      logLevel: 'warn',
      onProgress: ({ progress, stitchStage }) => {
        onProgress?.({
          stage: stitchStage === 'muxing' ? 'muxing' : 'render',
          progress,
          message: stitchStage === 'muxing' ? 'A finalizar o ficheiro…' : (spec.codec === 'mp3' || spec.codec === 'wav') ? 'A misturar o áudio…' : 'A renderizar…',
        });
      },
    });
    onProgress?.({ stage: 'done', progress: 1, message: 'Concluído' });
    return outPath;
  })();

  return { promise, cancel };
}

module.exports = { renderProject, binariesDirectory, normalizeSpec, codecOptions };
