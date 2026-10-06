// Export do projeto para MP4 com @remotion/renderer.
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
function renderProject({ appRoot, project, mediaBase, outPath, onProgress }) {
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
      codec: 'h264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
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
          message: stitchStage === 'muxing' ? 'A juntar áudio e vídeo…' : 'A renderizar…',
        });
      },
    });
    onProgress?.({ stage: 'done', progress: 1, message: 'Concluído' });
    return outPath;
  })();

  return { promise, cancel };
}

module.exports = { renderProject, binariesDirectory };
