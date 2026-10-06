// Teste de export sem Electron: gera um projeto com cortes, fades, sobreposição e música
// usando os ficheiros de test-media/ e renderiza para test-media/saida.mp4.
// Uso: node scripts/test-render.cjs
const path = require('node:path');
const { createMediaServer } = require('../electron/media-server.cjs');
const { renderProject } = require('../electron/render.cjs');

const root = path.join(__dirname, '..');
const m = (f) => path.join(root, 'test-media', f);

const project = {
  version: 1, name: 'Teste', fps: 30, width: 1280, height: 720, background: '#000000',
  media: [
    { id: 'mA', path: m('clipA.mp4'), name: 'clipA.mp4', kind: 'video', durationSec: 6 },
    { id: 'mB', path: m('clipB.mp4'), name: 'clipB.mp4', kind: 'video', durationSec: 5 },
    { id: 'mM', path: m('musica.mp3'), name: 'musica.mp3', kind: 'audio', durationSec: 10 },
    { id: 'mL', path: m('logo.png'), name: 'logo.png', kind: 'image', durationSec: 0 },
  ],
  tracks: [
    { id: 'v2', kind: 'video', name: 'Vídeo 2', muted: false, hidden: false, clips: [
      { id: 'c4', mediaId: 'mL', start: 30, duration: 60, trimStart: 0, volume: 1, fadeIn: 15, fadeOut: 15 },
    ] },
    { id: 'v1', kind: 'video', name: 'Vídeo 1', muted: false, hidden: false, clips: [
      { id: 'c1', mediaId: 'mA', start: 0, duration: 90, trimStart: 30, volume: 1, fadeIn: 15, fadeOut: 0 },
      { id: 'c2', mediaId: 'mB', start: 90, duration: 90, trimStart: 0, volume: 1, fadeIn: 0, fadeOut: 30 },
    ] },
    { id: 'a1', kind: 'audio', name: 'Áudio 1', muted: false, hidden: false, clips: [
      { id: 'c3', mediaId: 'mM', start: 0, duration: 180, trimStart: 0, volume: 0.5, fadeIn: 30, fadeOut: 45 },
    ] },
  ],
};

(async () => {
  const server = createMediaServer();
  server.register(project.media.map((x) => x.path));
  const mediaBase = await server.listen();
  const out = m('saida.mp4');
  let last = -1;
  const t = Date.now();
  const job = renderProject({
    appRoot: root, project, mediaBase, outPath: out,
    onProgress: (p) => {
      const pct = Math.floor(p.progress * 100);
      if (p.stage !== 'render' || pct >= last + 20) { console.log(`[${p.stage}] ${pct}% ${p.message ?? ''}`); last = pct; }
    },
  });
  try {
    await job.promise;
    console.log(`OK → ${out} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  } catch (e) {
    console.error('FALHOU:', e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
})();
