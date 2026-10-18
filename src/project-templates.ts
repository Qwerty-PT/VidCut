// Modelos de projeto: projetos completos (texto, modelos, stickers, música, transições) com espaços
// para os teus vídeos e fotos. Os cortes caem nas batidas da música escolhida.
import type { Clip, ClipTransform, Project, StickerContent, TextContent, Track, TrackKind } from '../shared/types';
import { getTemplate } from '../shared/templates';
import { templateDefaults } from '../shared/template-api';
import { DEFAULT_TRANSFORM } from '../shared/transform';
import { defaultTextAnims } from '../shared/anim';
import { getSticker } from '../shared/stickers';
import { defaultText } from './ops';
import { uid } from './util';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  format: '9:16' | '16:9' | '1:1';
  /** Ficheiro da biblioteca de sons (sons/) usado como música */
  music?: { file: string; name: string; bpm: number; volume: number };
  build: () => Project;
}

const FPS = 30;
const fr = (sec: number) => Math.round(sec * FPS);
const dims = (f: ProjectTemplate['format']) => (f === '9:16' ? { width: 1080, height: 1920 } : f === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 });

const base = (start: number, duration: number): Clip => ({ id: uid('c'), mediaId: '', start, duration, trimStart: 0, volume: 1, fadeIn: 0, fadeOut: 0 });
function tpl(id: string, start: number, duration: number, props: Record<string, unknown> = {}, extra: Partial<Clip> = {}): Clip {
  const def = getTemplate(id);
  return { ...base(start, duration), template: { id, props: { ...(def ? templateDefaults(def) : {}), ...props } }, ...extra };
}
function ph(label: string, accept: 'video' | 'image' | 'any', start: number, duration: number, extra: Partial<Clip> = {}): Clip {
  return { ...base(start, duration), placeholder: { label, accept }, ...extra };
}
function txt(text: string, start: number, duration: number, patch: Partial<TextContent> = {}): Clip {
  return { ...base(start, duration), text: { ...defaultText(), text, ...patch }, ...defaultTextAnims(FPS) };
}
function stk(id: string, start: number, duration: number, tf: Partial<ClipTransform>, patch: Partial<StickerContent> = {}): Clip {
  const d = getSticker(id)!;
  const sticker: StickerContent = { id, name: d.name, anim: d.anim, ...(d.text !== undefined ? { text: d.text } : {}), ...(d.color ? { color: d.color } : {}), ...patch };
  return { ...base(start, duration), sticker, transform: { ...DEFAULT_TRANSFORM, scale: 0.35, ...tf } };
}
const track = (kind: TrackKind, name: string, clips: Clip[]): Track => ({ id: uid('t'), kind, name, muted: false, hidden: false, clips: [...clips].sort((a, b) => a.start - b.start) });
const project = (name: string, format: ProjectTemplate['format'], tracks: Track[], background = '#000000'): Project => ({
  version: 1, name, fps: FPS, ...dims(format), background, media: [], tracks,
});
/** Junta clips seguidos: cada um começa onde o anterior acaba */
function seq(clips: Clip[], from = 0): Clip[] {
  let t = from;
  return clips.map((c) => { const x = { ...c, start: t }; t += c.duration; return x; });
}
const beats = (bpm: number) => (n: number) => fr((n * 60) / bpm);

const DISSOLVE = (d = 12) => ({ transition: { type: 'dissolve' as const, duration: d } });

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'lancamento-app', name: 'Lançamento de app', format: '9:16',
    description: 'Título, a app num telemóvel, um vídeo dela a funcionar e um final com QR para descarregar.',
    music: { file: 'pulso.mp3', name: 'Pulso', bpm: 128, volume: 0.7 },
    build: () => {
      const b = beats(128);
      const end = b(34);
      return project('Lançamento de app', '9:16', [
        track('text', 'Texto', [
          txt('Faz em segundos o que\nantes levava horas', b(18) + 6, b(8) - 6, { y: 14, size: 42, maxWidth: 90, weight: 700, background: '#17191e', bgOpacity: 0.85 }),
        ]),
        track('video', 'Destaques', [
          stk('explosao', b(6) + 8, b(10), { x: 76, y: 16, scale: 0.3 }, { text: 'NOVO!' }),
          stk('seta-curva', b(20), b(6), { x: 70, y: 68, scale: 0.28, rotation: 160 }),
        ]),
        track('video', 'Vídeo 2', seq([
          tpl('titulo-dividido', 0, b(6), { linha1: 'A NOVA APP', linha2: 'CHEGOU', tamanho: 92 }),
          tpl('telemovel', 0, b(12), { lado: 'centro', comFundo: false, titulo: '', texto: '' }, { placeholder: { label: 'Captura do ecrã da app', accept: 'image', field: 'imagem' } }),
          ph('Vídeo da app a funcionar', 'video', 0, b(8)),
          tpl('final-qr', 0, end - b(26), { titulo: 'Descarrega já', texto: 'Grátis na App Store e no Google Play', link: 'https://exemplo.pt' }, DISSOLVE()),
        ])),
        track('video', 'Fundo', [tpl('fundo-gradiente', 0, end)]),
      ]);
    },
  },
  {
    id: 'oferta', name: 'Promoção / oferta', format: '9:16',
    description: 'Três produtos em foto com preço, etiqueta de desconto e um final com o contacto.',
    music: { file: 'dia-de-sol.mp3', name: 'Dia de sol', bpm: 118, volume: 0.8 },
    build: () => {
      const b = beats(118);
      const t0 = b(4), each = b(6);
      const prods = [0, 1, 2].map((i) => ph(`Foto do produto ${i + 1}`, 'image', t0 + i * each, each, { effects: [{ id: 'zoom-lento', intensity: 60 }], bgBlur: 50, ...(i ? DISSOLVE(10) : {}) }));
      return project('Promoção', '9:16', [
        track('text', 'Texto', prods.map((c, i) => txt(['Produto 1 · 19,90 €', 'Produto 2 · 24,90 €', 'Produto 3 · 9,90 €'][i], c.start + 6, c.duration - 8, { y: 82, size: 40, maxWidth: 90, weight: 700, background: '#e8473e', bgOpacity: 1 }))),
        track('video', 'Destaques', [stk('etiqueta', t0, each * 3, { x: 70, y: 12, scale: 0.42 }, { text: '−30%' })]),
        track('video', 'Vídeo 1', [
          tpl('titulo-dividido', 0, t0, { linha1: 'SÓ ESTA', linha2: 'SEMANA' }),
          ...prods,
          tpl('cartao-final', t0 + each * 3, b(8), { titulo: 'Encomenda já', contacto: 'www.exemplo.pt · 912 345 678' }, DISSOLVE()),
        ]),
      ]);
    },
  },
  {
    id: 'tutorial', name: 'Tutorial passo a passo', format: '16:9',
    description: 'Título, resumo dos passos, duas gravações do ecrã com legendas e um final com subscrever.',
    music: { file: 'ideias-em-movimento.mp3', name: 'Ideias em movimento', bpm: 100, volume: 0.22 },
    build: () => {
      const s1 = fr(10), s2 = fr(22), s3 = fr(34);
      return project('Tutorial', '16:9', [
        track('text', 'Texto', [
          txt('1. Abre a app e escolhe…', s1 + 10, fr(4), { y: 86, size: 56, background: '#17191e' }),
          txt('2. Depois carrega em…', s2 + 10, fr(4), { y: 86, size: 56, background: '#17191e' }),
        ]),
        track('video', 'Destaques', [tpl('subscrever', s3 - fr(6), fr(4))]),
        track('video', 'Vídeo 1', [
          tpl('titulo-cinema', 0, fr(4), { titulo: 'Como fazer…', subtitulo: 'em 2 passos' }),
          tpl('passo-a-passo', fr(4), fr(6), { titulo: 'Vais aprender', passos: 'Preparar\nFazer\nPartilhar' }, DISSOLVE()),
          ph('Passo 1 — gravação do ecrã', 'video', s1, s2 - s1, DISSOLVE()),
          ph('Passo 2 — gravação do ecrã', 'video', s2, s3 - s2, DISSOLVE()),
          tpl('cartao-final', s3, fr(5), { titulo: 'Obrigado por veres!', contacto: '@oteucanal' }, DISSOLVE()),
        ]),
      ]);
    },
  },
  {
    id: 'reel-ritmo', name: 'Reel ao ritmo', format: '9:16',
    description: 'Doze espaços para vídeos ou fotos que mudam na batida da música, a acelerar no fim.',
    music: { file: 'pulso.mp3', name: 'Pulso', bpm: 128, volume: 1 },
    build: () => {
      const b = beats(128);
      const slots: Clip[] = [];
      let t = b(4);
      for (let i = 0; i < 12; i++) {
        const d = i < 8 ? b(2) : b(1);
        slots.push(ph(`Vídeo ou foto ${i + 1}`, 'any', t, d, { bgBlur: 50, ...(i === 4 ? { transition: { type: 'flash' as const, duration: 8 } } : {}) }));
        t += d;
      }
      return project('Reel', '9:16', [
        track('video', 'Vídeo 1', [
          tpl('titulo-neon', 0, b(4), { titulo: 'O MEU DIA', subtitulo: '' }),
          ...slots,
          tpl('cartao-final', t, b(8), { titulo: 'Segue para mais', contacto: '@oteunome' }, { transition: { type: 'whip' as const, duration: 10, direction: 'left' as const } }),
        ]),
      ]);
    },
  },
  {
    id: 'vlog-viagem', name: 'Vlog de viagem', format: '16:9',
    description: 'Título de cinema, localização no primeiro plano, seis vídeos com transições suaves e créditos.',
    music: { file: 'estrada-fora.mp3', name: 'Estrada fora', bpm: 110, volume: 0.6 },
    build: () => {
      const b = beats(110);
      const t0 = b(8), each = b(8);
      const shots = Array.from({ length: 6 }, (_, i) => ph(`Vídeo ${i + 1} da viagem`, 'video', t0 + i * each, each, DISSOLVE(14)));
      return project('Vlog de viagem', '16:9', [
        track('video', 'Destaques', [tpl('localizacao', t0 + 10, fr(4), { local: 'Lisboa', extra: 'Portugal · outubro' })]),
        track('video', 'Vídeo 1', [
          tpl('titulo-cinema', 0, t0, { titulo: 'Viagem a…', subtitulo: 'três dias, muitas histórias' }),
          ...shots,
          tpl('creditos', t0 + 6 * each, b(12), { titulo: 'Obrigado por veres', texto: 'Filmado e montado por mim\nMúsica: VidCut' }, DISSOLVE()),
        ]),
      ]);
    },
  },
];

/** Espaços por preencher num projeto */
export const placeholdersLeft = (p: Project) => p.tracks.reduce((n, t) => n + t.clips.filter((c) => c.placeholder).length, 0);
