// Stickers: emojis (SVG guardado no projeto) e stickers desenhados para o VidCut (texto e cor editáveis),
// com animações em loop. Funções puras do frame: a pré-visualização e o export dão o mesmo resultado.
import React from 'react';
import { Img } from 'remotion';
import type { MediaItem, StickerAnim, StickerContent } from './types';

export interface StickerDef {
  id: string;
  name: string;
  category: 'Destaques' | 'Setas e formas' | 'Redes sociais' | 'Reações';
  /** Tamanho do desenho (viewBox) */
  w: number;
  h: number;
  text?: string;
  color?: string;
  anim: StickerAnim;
  svg: (o: { text: string; color: string }) => string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = `font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-weight="700"`;
/** Tamanho de letra que cabe em `maxW` (aprox. 0,6 em por letra em maiúsculas) */
const fit = (text: string, base: number, maxW: number) => Math.min(base, maxW / Math.max(1, text.length * 0.62));
/** Texto (pode ter várias linhas com \n) centrado em (cx, cy) */
function textBlock(text: string, cx: number, cy: number, base: number, maxW: number, fill: string, extra = '') {
  const lines = text.split('\n').slice(0, 3);
  const size = Math.min(...lines.map((l) => fit(l, base, maxW)));
  const lh = size * 1.12;
  const y0 = cy - ((lines.length - 1) * lh) / 2;
  return lines.map((l, i) => `<text x="${cx}" y="${y0 + i * lh}" ${FONT} font-size="${size.toFixed(1)}" fill="${fill}" text-anchor="middle" dominant-baseline="central" ${extra}>${esc(l)}</text>`).join('');
}
/** Contraste: texto escuro em fundos claros */
function ink(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? '#17191e' : '#ffffff';
}
const svgWrap = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" overflow="visible">${body}</svg>`;
/** Traço que se desenha (animação "draw"): pathLength=1 e o deslocamento vem da variável --vc-draw */
const drawn = (d: string, color: string, width: number, extra = '') => `<path d="${d}" pathLength="1" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:1 1;stroke-dashoffset:var(--vc-draw,0)" ${extra}/>`;

function star(cx: number, cy: number, r1: number, r2: number, n: number, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const sparkle = (cx: number, cy: number, r: number, fill: string) =>
  `<path d="M${cx} ${cy - r} C${cx + r * 0.12} ${cy - r * 0.12} ${cx + r * 0.12} ${cy - r * 0.12} ${cx + r} ${cy} C${cx + r * 0.12} ${cy + r * 0.12} ${cx + r * 0.12} ${cy + r * 0.12} ${cx} ${cy + r} C${cx - r * 0.12} ${cy + r * 0.12} ${cx - r * 0.12} ${cy + r * 0.12} ${cx - r} ${cy} C${cx - r * 0.12} ${cy - r * 0.12} ${cx - r * 0.12} ${cy - r * 0.12} ${cx} ${cy - r}Z" fill="${fill}"/>`;
const heart = (cx: number, cy: number, s: number, fill: string) =>
  `<path transform="translate(${cx - 12 * s} ${cy - 11 * s}) scale(${s})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${fill}"/>`;

export const STICKERS: StickerDef[] = [
  // ---------- Destaques ----------
  {
    id: 'balao', name: 'Balão de fala', category: 'Destaques', w: 320, h: 240, text: 'Olá!', color: '#ffffff', anim: 'pop',
    svg: ({ text, color }) => svgWrap(320, 240, `<path d="M40 20h240a30 30 0 0 1 30 30v110a30 30 0 0 1-30 30H130l-62 42 12-42H40a30 30 0 0 1-30-30V50a30 30 0 0 1 30-30z" fill="${color}" stroke="#17191e" stroke-width="8" stroke-linejoin="round"/>${textBlock(text, 160, 105, 72, 250, ink(color))}`),
  },
  {
    id: 'pensamento', name: 'Balão de pensamento', category: 'Destaques', w: 320, h: 260, text: 'Hmm…', color: '#ffffff', anim: 'float',
    svg: ({ text, color }) => svgWrap(320, 260, `<g fill="${color}" stroke="#17191e" stroke-width="7"><ellipse cx="160" cy="100" rx="145" ry="88"/><circle cx="80" cy="205" r="20"/><circle cx="50" cy="240" r="11"/></g>${textBlock(text, 160, 100, 64, 220, ink(color))}`),
  },
  {
    id: 'explosao', name: 'Explosão', category: 'Destaques', w: 300, h: 300, text: 'NOVO!', color: '#f2b33d', anim: 'pulse',
    svg: ({ text, color }) => svgWrap(300, 300, `<polygon points="${star(150, 150, 145, 108, 16)}" fill="${color}" stroke="#17191e" stroke-width="7" stroke-linejoin="round"/>${textBlock(text, 150, 152, 72, 190, ink(color), 'transform="rotate(-8 150 150)"')}`),
  },
  {
    id: 'etiqueta', name: 'Etiqueta', category: 'Destaques', w: 360, h: 150, text: 'OFERTA', color: '#e8473e', anim: 'swing',
    svg: ({ text, color }) => svgWrap(360, 150, `<path d="M70 15h270a10 10 0 0 1 10 10v100a10 10 0 0 1-10 10H70L10 75z" fill="${color}"/><circle cx="62" cy="75" r="12" fill="#fff"/>${textBlock(text, 205, 76, 64, 240, ink(color))}`),
  },
  {
    id: 'carimbo', name: 'Carimbo', category: 'Destaques', w: 340, h: 180, text: 'APROVADO', color: '#3f9284', anim: 'pop',
    svg: ({ text, color }) => svgWrap(340, 180, `<g transform="rotate(-10 170 90)"><rect x="14" y="26" width="312" height="128" rx="16" fill="none" stroke="${color}" stroke-width="10"/><rect x="30" y="42" width="280" height="96" rx="8" fill="none" stroke="${color}" stroke-width="4"/>${textBlock(text, 170, 91, 56, 215, color, 'letter-spacing="3"')}</g>`),
  },
  {
    id: 'faixa', name: 'Faixa', category: 'Destaques', w: 420, h: 140, text: 'Imperdível', color: '#4f6fa3', anim: 'pop',
    svg: ({ text, color }) => svgWrap(420, 140, `<path d="M10 40h50v80H10l22-40z" fill="${color}" opacity=".7"/><path d="M410 40h-50v80h50l-22-40z" fill="${color}" opacity=".7"/><rect x="45" y="20" width="330" height="86" rx="6" fill="${color}"/>${textBlock(text, 210, 63, 56, 290, ink(color))}`),
  },
  // ---------- Setas e formas ----------
  {
    id: 'seta-curva', name: 'Seta desenhada', category: 'Setas e formas', w: 300, h: 220, color: '#f2b33d', anim: 'draw',
    svg: ({ color }) => svgWrap(300, 220, drawn('M24 190 C 50 80, 160 40, 250 70', color, 14) + drawn('M205 30 L 255 70 L 200 108', color, 14)),
  },
  {
    id: 'seta', name: 'Seta', category: 'Setas e formas', w: 300, h: 160, color: '#ffffff', anim: 'bounce',
    svg: ({ color }) => svgWrap(300, 160, `<path d="M14 58h170V18l102 62-102 62v-40H14z" fill="${color}" stroke="#17191e" stroke-width="7" stroke-linejoin="round"/>`),
  },
  {
    id: 'circulo', name: 'Círculo à mão', category: 'Setas e formas', w: 340, h: 220, color: '#e8473e', anim: 'draw',
    svg: ({ color }) => svgWrap(340, 220, drawn('M190 22 C 90 14, 18 50, 20 110 C 22 175, 120 205, 210 196 C 300 186, 330 140, 320 96 C 308 44, 230 18, 150 28', color, 11)),
  },
  {
    id: 'sublinhado', name: 'Sublinhado', category: 'Setas e formas', w: 400, h: 90, color: '#f2b33d', anim: 'draw',
    svg: ({ color }) => svgWrap(400, 90, drawn('M14 50 C 90 30, 200 28, 386 36 M40 72 C 140 58, 260 56, 360 62', color, 12)),
  },
  {
    id: 'visto', name: 'Visto', category: 'Setas e formas', w: 220, h: 200, color: '#3fbf6f', anim: 'draw',
    svg: ({ color }) => svgWrap(220, 200, drawn('M24 108 L 84 166 L 198 30', color, 26)),
  },
  {
    id: 'cruz', name: 'Cruz', category: 'Setas e formas', w: 200, h: 200, color: '#e8473e', anim: 'draw',
    svg: ({ color }) => svgWrap(200, 200, drawn('M30 30 L 170 170', color, 26) + drawn('M170 30 L 30 170', color, 26)),
  },
  {
    id: 'raio', name: 'Raio', category: 'Setas e formas', w: 160, h: 260, color: '#f2d13d', anim: 'shake',
    svg: ({ color }) => svgWrap(160, 260, `<path d="M98 8L16 150h56l-22 102 94-150H86z" fill="${color}" stroke="#17191e" stroke-width="7" stroke-linejoin="round"/>`),
  },
  {
    id: 'faiscas', name: 'Brilhos', category: 'Setas e formas', w: 240, h: 240, color: '#ffffff', anim: 'pulse',
    svg: ({ color }) => svgWrap(240, 240, sparkle(100, 120, 90, color) + sparkle(195, 50, 38, color) + sparkle(200, 190, 26, color)),
  },
  // ---------- Redes sociais ----------
  {
    id: 'subscrever', name: 'Subscrever', category: 'Redes sociais', w: 420, h: 130, text: 'SUBSCREVER', color: '#e8473e', anim: 'pop',
    svg: ({ text, color }) => svgWrap(420, 130, `<rect x="6" y="10" width="408" height="110" rx="55" fill="${color}"/><g transform="translate(46 33)" fill="${ink(color)}"><path d="M32 60a8 8 0 0 0 8-8H24a8 8 0 0 0 8 8zm24-14V30c0-12-6.4-21.6-18-24.4V4a6 6 0 0 0-12 0v1.6C14.4 8.4 8 18 8 30v16l-6 6v3h60v-3z"/></g>${textBlock(text, 250, 66, 50, 270, ink(color))}`),
  },
  {
    id: 'gosto', name: 'Gosto', category: 'Redes sociais', w: 220, h: 220, color: '#ff4d6d', anim: 'heartbeat',
    svg: ({ color }) => svgWrap(220, 220, `<circle cx="110" cy="110" r="100" fill="#ffffff"/>${heart(110, 114, 6.2, color)}`),
  },
  {
    id: 'direto', name: 'Em direto', category: 'Redes sociais', w: 300, h: 110, text: 'EM DIRETO', color: '#e8473e', anim: 'pulse',
    svg: ({ text, color }) => svgWrap(300, 110, `<rect x="4" y="10" width="292" height="90" rx="14" fill="${color}"/><circle cx="46" cy="55" r="14" fill="#fff"/>${textBlock(text, 168, 56, 44, 200, ink(color), 'letter-spacing="2"')}`),
  },
  {
    id: 'seguir', name: 'Segue-me', category: 'Redes sociais', w: 360, h: 120, text: '@oteunome', color: '#17191e', anim: 'float',
    svg: ({ text, color }) => svgWrap(360, 120, `<rect x="4" y="8" width="352" height="104" rx="52" fill="${color}" stroke="#ffffff" stroke-width="6"/><circle cx="60" cy="60" r="34" fill="#ffffff"/><path d="M60 42v36M42 60h36" stroke="${color}" stroke-width="9" stroke-linecap="round"/>${textBlock(text, 220, 61, 44, 240, ink(color))}`),
  },
  {
    id: 'cursor', name: 'Cursor a clicar', category: 'Redes sociais', w: 200, h: 220, color: '#ffffff', anim: 'bounce',
    svg: ({ color }) => svgWrap(200, 220, `<g fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" opacity=".85"><path d="M40 34l-18-18M70 22V2M28 66H8"/></g><path d="M62 56l112 52-48 12 30 54-24 13-30-54-36 34z" fill="${color}" stroke="#17191e" stroke-width="8" stroke-linejoin="round"/>`),
  },
  // ---------- Reações ----------
  {
    id: 'coracoes', name: 'Corações', category: 'Reações', w: 240, h: 240, color: '#ff4d6d', anim: 'float',
    svg: ({ color }) => svgWrap(240, 240, heart(95, 140, 5, color) + heart(185, 70, 2.6, color) + heart(190, 175, 1.8, color)),
  },
  {
    id: 'estrelas', name: 'Estrelas', category: 'Reações', w: 360, h: 120, color: '#f2b33d', anim: 'pop',
    svg: ({ color }) => svgWrap(360, 120, [60, 180, 300].map((x) => `<polygon points="${star(x, 62, 54, 24, 5)}" fill="${color}" stroke="#17191e" stroke-width="6" stroke-linejoin="round"/>`).join('')),
  },
  {
    id: 'exclamacao', name: 'Exclamação', category: 'Reações', w: 200, h: 200, color: '#f2b33d', anim: 'shake',
    svg: ({ color }) => svgWrap(200, 200, `<polygon points="${star(100, 100, 96, 70, 12)}" fill="${color}" stroke="#17191e" stroke-width="7" stroke-linejoin="round"/><rect x="88" y="44" width="24" height="74" rx="12" fill="${ink(color)}"/><circle cx="100" cy="146" r="14" fill="${ink(color)}"/>`),
  },
  {
    id: 'onomatopeia', name: 'Uau!', category: 'Reações', w: 320, h: 200, text: 'UAU!', color: '#ff4d6d', anim: 'wobble',
    svg: ({ text, color }) => svgWrap(320, 200, textBlock(text, 160, 100, 120, 290, color, 'stroke="#17191e" stroke-width="10" paint-order="stroke" stroke-linejoin="round" transform="rotate(-6 160 100)"')),
  },
];

export const STICKER_CATEGORIES = ['Destaques', 'Setas e formas', 'Redes sociais', 'Reações'] as const;
export const getSticker = (id: string) => STICKERS.find((s) => s.id === id);

export const STICKER_ANIMS: { value: StickerAnim; label: string }[] = [
  { value: 'none', label: 'Parado' },
  { value: 'pop', label: 'Pop' },
  { value: 'bounce', label: 'Saltar' },
  { value: 'float', label: 'Flutuar' },
  { value: 'pulse', label: 'Pulsar' },
  { value: 'heartbeat', label: 'Coração' },
  { value: 'wobble', label: 'Abanar' },
  { value: 'swing', label: 'Baloiçar' },
  { value: 'shake', label: 'Tremer' },
  { value: 'spin', label: 'Rodar' },
  { value: 'draw', label: 'Desenhar' },
];

/** Tamanho (proporção) do desenho de um sticker */
export function stickerSize(s: StickerContent): { w: number; h: number } {
  if (s.svg) {
    const m = /viewBox="[\d.\s-]*?\s([\d.]+)\s([\d.]+)"/.exec(s.svg);
    return m ? { w: Number(m[1]) * 16, h: Number(m[2]) * 16 } : { w: 512, h: 512 };
  }
  const d = getSticker(s.id);
  return d ? { w: d.w * 2, h: d.h * 2 } : { w: 512, h: 512 };
}

/** Os stickers comportam-se como uma imagem do seu tamanho (enquadrar, cor, keyframes) */
export function stickerMedia(s: StickerContent): MediaItem {
  const z = stickerSize(s);
  return { id: '', path: '', name: s.name, kind: 'image', durationSec: 0, width: z.w, height: z.h };
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
/** Pop: cresce com um pequeno ressalto */
// começa já visível (35%) para se ver o sticker ao pô-lo na agulha
const popScale = (t: number) => (t >= 1 ? 1 : t < 0.6 ? 0.35 + 0.8 * ease(t / 0.6) : 1.15 - 0.15 * ease((t - 0.6) / 0.4));

/** Transformação da animação no frame `rel` (relativo ao início do clip) */
export function stickerMotion(anim: StickerAnim, rel: number, fps: number): { transform: string; origin: string; draw: number } {
  const s = rel / fps;
  const TAU = Math.PI * 2;
  switch (anim) {
    case 'pop': return { transform: `scale(${popScale(s / 0.45)})`, origin: '50% 50%', draw: 0 };
    case 'bounce': {
      const p = (s % 0.9) / 0.9;
      return { transform: `translateY(${(-Math.abs(Math.sin(p * Math.PI)) * 12).toFixed(2)}%) scale(${(1 + (p < 0.08 || p > 0.92 ? 0.04 : 0)).toFixed(3)}, ${(1 - (p < 0.08 || p > 0.92 ? 0.05 : 0)).toFixed(3)})`, origin: '50% 100%', draw: 0 };
    }
    case 'float': return { transform: `translateY(${(Math.sin(s * TAU / 2.6) * 5).toFixed(2)}%) rotate(${(Math.sin(s * TAU / 3.4) * 3).toFixed(2)}deg)`, origin: '50% 50%', draw: 0 };
    case 'pulse': return { transform: `scale(${(1 + 0.07 * Math.sin(s * TAU / 1.1)).toFixed(4)})`, origin: '50% 50%', draw: 0 };
    case 'heartbeat': {
      const p = s % 1.2;
      const k = Math.max(0, 1 - Math.abs(p - 0.1) / 0.1) * 0.14 + Math.max(0, 1 - Math.abs(p - 0.32) / 0.1) * 0.1;
      return { transform: `scale(${(1 + k).toFixed(4)})`, origin: '50% 50%', draw: 0 };
    }
    case 'wobble': return { transform: `rotate(${(Math.sin(s * TAU / 0.9) * 7).toFixed(2)}deg) scale(${(1 + 0.03 * Math.sin(s * TAU / 0.45)).toFixed(4)})`, origin: '50% 50%', draw: 0 };
    case 'swing': return { transform: `rotate(${(Math.sin(s * TAU / 1.6) * 12).toFixed(2)}deg)`, origin: '50% 0%', draw: 0 };
    case 'shake': {
      const burst = s % 1.6 < 0.5 ? 1 : 0;
      return { transform: `translate(${(Math.sin(s * 70) * 2.5 * burst).toFixed(2)}%, ${(Math.cos(s * 53) * 1.5 * burst).toFixed(2)}%) rotate(${(Math.sin(s * 61) * 3 * burst).toFixed(2)}deg)`, origin: '50% 50%', draw: 0 };
    }
    case 'spin': return { transform: `rotate(${((s / 3) * 360) % 360}deg)`, origin: '50% 50%', draw: 0 };
    case 'draw': return { transform: 'none', origin: '50% 50%', draw: 1 - ease(s / 0.8) };
    default: return { transform: 'none', origin: '50% 50%', draw: 0 };
  }
}

const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Desenho do sticker a encher a caixa, com a animação aplicada */
export const StickerArt: React.FC<{ sticker: StickerContent; rel: number; fps: number }> = ({ sticker, rel, fps }) => {
  const def = sticker.svg ? undefined : getSticker(sticker.id);
  // emojis não têm traços para desenhar: "desenhar" passa a "pop"
  const anim: StickerAnim = sticker.anim === 'draw' && !def ? 'pop' : sticker.anim;
  const m = stickerMotion(anim, rel, fps);
  const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  const wrap: React.CSSProperties = { ...fill, transform: m.transform, transformOrigin: m.origin, ['--vc-draw' as string]: m.draw.toFixed(4) };
  if (sticker.svg) return <div style={wrap}><Img src={svgDataUri(sticker.svg)} style={{ ...fill, objectFit: 'contain' }} /></div>;
  if (!def) return null;
  const html = def.svg({ text: sticker.text ?? def.text ?? '', color: sticker.color ?? def.color ?? '#ffffff' });
  return <div style={wrap} dangerouslySetInnerHTML={{ __html: html }} />;
};

/** Miniatura estática (galeria) */
export function stickerPreviewSvg(def: StickerDef): string {
  return def.svg({ text: def.text ?? '', color: def.color ?? '#ffffff' });
}
