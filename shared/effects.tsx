// Biblioteca de efeitos dos clips (vídeo, imagem, modelo, animação).
// Cada efeito é uma função pura do tempo → mesma imagem na pré-visualização, nas miniaturas e no export.
// Devolve transformações/filtros para a caixa do clip e camadas por cima (sem hooks: serve também fora do Remotion).
import React from 'react';

export type EffectCategory = 'Movimento' | 'Retro' | 'Luz' | 'Partículas' | 'Distorção';

export interface ClipEffect {
  id: string;
  /** 0..100 */
  intensity: number;
}

export interface EffectCtx {
  /** frame relativo ao início do clip */
  t: number;
  fps: number;
  /** duração do clip em frames */
  dur: number;
  /** tamanho da caixa do clip em px */
  w: number;
  h: number;
  /** escala relativa a 1080 px de altura do quadro */
  k: number;
  /** intensidade 0..1 */
  i: number;
  seed: number;
  /** id único para filtros SVG */
  fid: string;
}

export interface EffectOut {
  transform?: string;
  filter?: string;
  /** camadas por cima da imagem, dentro da caixa do clip */
  overlay?: React.ReactNode;
  /** definições SVG (filtros referidos em `filter` por url(#fid…)) */
  svg?: React.ReactNode;
}

export interface EffectDef {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  intensity: number;
  render: (c: EffectCtx) => EffectOut;
}

// ---------- utilitários determinísticos ----------
const fract = (x: number) => x - Math.floor(x);
export const rand = (seed: number, n: number) => fract(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453);
/** ruído suave 1D (interpolação de valores aleatórios) */
function noise(seed: number, x: number) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return rand(seed, i) * (1 - u) + rand(seed, i + 1) * u;
}
const sn = (seed: number, x: number) => noise(seed, x) * 2 - 1; // −1..1
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000;
}
const abs: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

// ---------- efeitos ----------
export const EFFECTS: EffectDef[] = [
  // Movimento
  {
    id: 'tremor', name: 'Tremor', category: 'Movimento', intensity: 50,
    description: 'Abanão rápido, como um impacto ou um baixo forte',
    render: ({ t, fps, i, k, seed }) => {
      const a = 22 * k * i, s = (t / fps) * 18;
      return { transform: `translate(${sn(seed, s) * a}px, ${sn(seed + 7, s) * a}px) rotate(${sn(seed + 3, s) * 1.6 * i}deg) scale(${1 + 0.05 * i})` };
    },
  },
  {
    id: 'camara-mao', name: 'Câmara na mão', category: 'Movimento', intensity: 50,
    description: 'Deriva lenta e orgânica, como filmado sem tripé',
    render: ({ t, fps, i, k, seed }) => {
      const s = (t / fps) * 0.9, a = 26 * k * i;
      return { transform: `translate(${sn(seed, s) * a}px, ${sn(seed + 11, s * 0.8) * a * 0.7}px) rotate(${sn(seed + 5, s * 0.6) * 1.2 * i}deg) scale(${1 + 0.06 * i})` };
    },
  },
  {
    id: 'pulsar', name: 'Pulsar', category: 'Movimento', intensity: 45,
    description: 'Respira: aproxima e afasta suavemente',
    render: ({ t, fps, i }) => ({ transform: `scale(${1 + 0.07 * i * (0.5 - 0.5 * Math.cos((t / fps) * Math.PI * 1.6))})` }),
  },
  {
    id: 'batida', name: 'Batida', category: 'Movimento', intensity: 55,
    description: 'Empurrão rápido em cada tempo (120 bpm), com clarão',
    render: ({ t, fps, i }) => {
      const beat = fps / 2, ph = (t % beat) / beat;
      const p = Math.exp(-ph * 9);
      return { transform: `scale(${1 + 0.09 * i * p})`, filter: `brightness(${1 + 0.35 * i * p})` };
    },
  },
  {
    id: 'zoom-lento', name: 'Zoom lento', category: 'Movimento', intensity: 50,
    description: 'Aproxima devagar ao longo do clip (estilo Ken Burns)',
    render: ({ t, dur, i }) => ({ transform: `scale(${1 + 0.25 * i * Math.min(1, t / Math.max(1, dur - 1))})` }),
  },
  {
    id: 'balancar', name: 'Balançar', category: 'Movimento', intensity: 40,
    description: 'Inclina para um lado e para o outro',
    render: ({ t, fps, i }) => ({ transform: `rotate(${Math.sin((t / fps) * Math.PI * 1.2) * 5 * i}deg) scale(${1 + 0.1 * i})` }),
  },
  // Retro
  {
    id: 'vhs', name: 'VHS', category: 'Retro', intensity: 60,
    description: 'Cassete antiga: linhas, cores a escorrer e tremidos',
    render: ({ t, i, k, seed, fid, h }) => {
      const jit = rand(seed, t) > 0.9 ? (rand(seed + 1, t) - 0.5) * 18 * k * i : 0;
      const off = 3 * k * i + 2 * k * i * Math.sin(t * 0.7);
      const band = ((t * 7) % (h * 1.4)) - h * 0.2;
      return {
        transform: `translateX(${jit}px)`,
        filter: `url(#${fid}) saturate(${1 + 0.35 * i}) contrast(${1 + 0.12 * i})`,
        svg: (
          <filter id={fid} x="-2%" y="0" width="104%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={off} result="ro" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
            <feOffset in="gb" dx={-off} result="gbo" />
            <feBlend in="ro" in2="gbo" mode="screen" />
          </filter>
        ),
        overlay: (
          <>
            <div style={{ ...abs, background: `repeating-linear-gradient(0deg, rgba(0,0,0,${0.22 * i}) 0 ${2 * k}px, transparent ${2 * k}px ${4 * k}px)` }} />
            <div style={{ ...abs, top: band, bottom: 'auto', height: 26 * k, background: `linear-gradient(transparent, rgba(255,255,255,${0.1 * i}), transparent)` }} />
          </>
        ),
      };
    },
  },
  {
    id: 'pelicula', name: 'Película antiga', category: 'Retro', intensity: 60,
    description: 'Grão, riscos, tremer de luz e tom sépia',
    render: ({ t, i, seed, fid, k }) => {
      const flick = 1 + (rand(seed, t) - 0.5) * 0.16 * i;
      const scratches = [0, 1, 2].filter((n) => rand(seed + n * 3, Math.floor(t / 3)) > 0.55).map((n) => rand(seed + n * 5, Math.floor(t / 3)));
      return {
        filter: `sepia(${0.65 * i}) contrast(${1 + 0.1 * i}) brightness(${flick})`,
        svg: (
          <filter id={fid} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={t % 97} result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
          </filter>
        ),
        overlay: (
          <>
            <div style={{ ...abs, filter: `url(#${fid})`, opacity: 0.22 * i, mixBlendMode: 'overlay', background: '#808080' }} />
            {scratches.map((x, n) => <div key={n} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x * 100}%`, width: Math.max(1, 1.5 * k), background: `rgba(255,255,240,${0.35 * i})` }} />)}
            <div style={{ ...abs, background: `radial-gradient(ellipse at center, transparent 50%, rgba(30,15,0,${0.6 * i}) 100%)` }} />
          </>
        ),
      };
    },
  },
  {
    id: 'glitch', name: 'Glitch', category: 'Retro', intensity: 60,
    description: 'Falhas digitais em rajadas: saltos, cores trocadas e barras',
    render: ({ t, fps, i, k, seed, w }) => {
      const cycle = Math.round(fps * 1.1), ph = t % cycle, n = Math.floor(t / cycle);
      const on = ph < 7 && rand(seed, n) < 0.85;
      if (!on) return {};
      const dx = (rand(seed + 2, t) - 0.5) * 60 * k * i;
      const bars = [0, 1, 2, 3].map((b) => ({ y: rand(seed + b, t) * 100, hgt: 2 + rand(seed + b + 9, t) * 9, x: (rand(seed + b + 4, t) - 0.5) * w * 0.12 * i }));
      return {
        transform: `translateX(${dx}px) skewX(${(rand(seed + 6, t) - 0.5) * 8 * i}deg)`,
        filter: `hue-rotate(${(rand(seed + 8, t) - 0.5) * 140 * i}deg) saturate(${1 + i})`,
        overlay: <>{bars.map((b, j) => <div key={j} style={{ position: 'absolute', left: 0, right: 0, top: `${b.y}%`, height: `${b.hgt}%`, transform: `translateX(${b.x}px)`, background: j % 2 ? 'rgba(0,255,230,0.35)' : 'rgba(255,0,90,0.35)', mixBlendMode: 'screen', opacity: i }} />)}</>,
      };
    },
  },
  {
    id: 'duotone', name: 'Duotone', category: 'Retro', intensity: 80,
    description: 'Duas cores (rosa e azul) em vez das cores originais',
    render: ({ i, fid }) => ({
      filter: `url(#${fid})`,
      svg: (
        <filter id={fid} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" result="g" />
          <feComponentTransfer in="g" result="d">
            <feFuncR type="table" tableValues="0.13 1" />
            <feFuncG type="table" tableValues="0.1 0.36" />
            <feFuncB type="table" tableValues="0.55 0.64" />
          </feComponentTransfer>
          <feComposite in="d" in2="SourceGraphic" operator="arithmetic" k2={i} k3={1 - i} />
        </filter>
      ),
    }),
  },
  // Luz
  {
    id: 'brilho', name: 'Brilho suave', category: 'Luz', intensity: 50,
    description: 'Halo luminoso nas zonas claras (bloom)',
    render: ({ i, fid, k }) => ({
      filter: `url(#${fid})`,
      svg: (
        <filter id={fid} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={18 * k * (0.4 + i)} result="b" />
          <feComponentTransfer in="b" result="bb"><feFuncR type="linear" slope={0.9 * i} /><feFuncG type="linear" slope={0.9 * i} /><feFuncB type="linear" slope={0.9 * i} /></feComponentTransfer>
          <feBlend in="SourceGraphic" in2="bb" mode="screen" />
        </filter>
      ),
    }),
  },
  {
    id: 'fugas-luz', name: 'Fugas de luz', category: 'Luz', intensity: 55,
    description: 'Manchas de luz quente a passar, como em película',
    render: ({ t, fps, i, seed }) => {
      const s = t / fps;
      const x1 = 50 + sn(seed, s * 0.25) * 60, y1 = 30 + sn(seed + 2, s * 0.2) * 40;
      const x2 = 50 + sn(seed + 4, s * 0.18) * 70, y2 = 70 + sn(seed + 6, s * 0.22) * 40;
      return {
        overlay: (
          <div style={{ ...abs, mixBlendMode: 'screen', opacity: i, background: `radial-gradient(circle at ${x1}% ${y1}%, rgba(255,140,40,0.75), transparent 45%), radial-gradient(circle at ${x2}% ${y2}%, rgba(255,60,110,0.55), transparent 40%)` }} />
        ),
      };
    },
  },
  {
    id: 'reflexo', name: 'Reflexo a passar', category: 'Luz', intensity: 60,
    description: 'Faixa de luz diagonal a atravessar a imagem de 2 em 2 s',
    render: ({ t, fps, i }) => {
      const per = fps * 2, p = (t % per) / per;
      const x = -40 + p * 180;
      return { overlay: <div style={{ ...abs, mixBlendMode: 'soft-light', background: `linear-gradient(115deg, transparent ${x - 12}%, rgba(255,255,255,${0.9 * i}) ${x}%, transparent ${x + 12}%)` }} /> };
    },
  },
  {
    id: 'arco-iris', name: 'Arco-íris', category: 'Luz', intensity: 50,
    description: 'As cores rodam continuamente',
    render: ({ t, fps, i }) => ({ filter: `hue-rotate(${((t / fps) * 120 * i) % 360}deg) saturate(${1 + 0.4 * i})` }),
  },
  {
    id: 'estrobo', name: 'Estroboscópio', category: 'Luz', intensity: 45,
    description: 'Clarões brancos rápidos a cada tempo',
    render: ({ t, fps, i }) => {
      const beat = Math.round(fps / 2), ph = t % beat;
      return { overlay: ph < 2 ? <div style={{ ...abs, background: '#ffffff', opacity: (ph === 0 ? 0.75 : 0.35) * i }} /> : null };
    },
  },
  // Partículas
  {
    id: 'neve', name: 'Neve', category: 'Partículas', intensity: 55,
    description: 'Flocos a cair devagar',
    render: ({ t, fps, i, w, h, k, seed }) => {
      const n = Math.round(20 + 70 * i), s = t / fps;
      return {
        overlay: (
          <div style={{ ...abs, overflow: 'hidden' }}>
            {Array.from({ length: n }, (_, j) => {
              const r = (2 + rand(seed, j) * 5) * k, sp = 0.05 + rand(seed + 1, j) * 0.12;
              const y = fract(rand(seed + 2, j) + s * sp) * (h + 20) - 10;
              const x = rand(seed + 3, j) * w + Math.sin(s * (0.6 + rand(seed + 4, j)) + j) * 18 * k;
              return <div key={j} style={{ position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: '50%', background: '#ffffff', opacity: 0.55 + rand(seed + 5, j) * 0.45, filter: `blur(${r * 0.3}px)` }} />;
            })}
          </div>
        ),
      };
    },
  },
  {
    id: 'cintilar', name: 'Brilhos', category: 'Partículas', intensity: 55,
    description: 'Estrelinhas que piscam espalhadas pela imagem',
    render: ({ t, fps, i, w, h, k, seed }) => {
      const n = Math.round(8 + 30 * i), s = t / fps;
      return {
        overlay: (
          <div style={{ ...abs, overflow: 'hidden' }}>
            {Array.from({ length: n }, (_, j) => {
              const a = Math.max(0, Math.sin(s * (2 + rand(seed, j) * 3) + rand(seed + 1, j) * 6.28));
              const sz = (10 + rand(seed + 2, j) * 22) * k * a;
              return <div key={j} style={{ position: 'absolute', left: rand(seed + 3, j) * w - sz / 2, top: rand(seed + 4, j) * h - sz / 2, width: sz, height: sz, opacity: a, background: 'radial-gradient(circle, #fff 0 12%, rgba(255,240,200,0.0) 13%), linear-gradient(0deg, transparent 46%, #fff 50%, transparent 54%), linear-gradient(90deg, transparent 46%, #fff 50%, transparent 54%)' }} />;
            })}
          </div>
        ),
      };
    },
  },
  {
    id: 'bokeh', name: 'Bokeh', category: 'Partículas', intensity: 50,
    description: 'Círculos de luz desfocados a flutuar',
    render: ({ t, fps, i, w, h, k, seed }) => {
      const n = Math.round(6 + 16 * i), s = t / fps;
      const cols = ['255,210,120', '255,140,170', '140,200,255', '255,255,255'];
      return {
        overlay: (
          <div style={{ ...abs, overflow: 'hidden', mixBlendMode: 'screen' }}>
            {Array.from({ length: n }, (_, j) => {
              const r = (30 + rand(seed, j) * 90) * k;
              const x = fract(rand(seed + 1, j) + s * (0.01 + rand(seed + 2, j) * 0.03)) * (w + 2 * r) - r;
              const y = rand(seed + 3, j) * h + Math.sin(s * 0.5 + j) * 20 * k;
              return <div key={j} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, rgba(${cols[j % 4]},${0.5 * i}) 0 55%, rgba(${cols[j % 4]},0) 70%)`, filter: `blur(${r * 0.12}px)` }} />;
            })}
          </div>
        ),
      };
    },
  },
  // Distorção
  {
    id: 'ondulacao', name: 'Ondulação', category: 'Distorção', intensity: 45,
    description: 'Imagem a ondular, como calor ou debaixo de água',
    render: ({ t, fps, i, fid, k }) => {
      const s = t / fps;
      return {
        filter: `url(#${fid})`,
        transform: `scale(${1 + 0.07 * i})`,
        svg: (
          <filter id={fid} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="turbulence" baseFrequency={`${0.008 + 0.002 * Math.sin(s * 1.3)} ${0.02 + 0.006 * Math.cos(s * 1.1)}`} numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={28 * k * i} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ),
      };
    },
  },
  {
    id: 'desfoque-pulsar', name: 'Foco a pulsar', category: 'Distorção', intensity: 45,
    description: 'Perde e recupera o foco ritmicamente',
    render: ({ t, fps, i, k }) => ({ filter: `blur(${(0.5 - 0.5 * Math.cos((t / fps) * Math.PI * 1.2)) * 9 * k * i}px)` }),
  },
];

export const EFFECT_CATEGORIES: EffectCategory[] = ['Movimento', 'Luz', 'Retro', 'Partículas', 'Distorção'];
export const getEffect = (id: string) => EFFECTS.find((e) => e.id === id);

/** Junta vários efeitos de um clip */
export function combineEffects(list: ClipEffect[] | undefined, base: Omit<EffectCtx, 'i' | 'fid' | 'seed'> & { clipId: string }): EffectOut | null {
  if (!list?.length) return null;
  const transforms: string[] = [], filters: string[] = [];
  const overlays: React.ReactNode[] = [], svgs: React.ReactNode[] = [];
  const safe = base.clipId.replace(/[^a-zA-Z0-9_-]/g, '');
  list.forEach((e, n) => {
    const def = getEffect(e.id);
    if (!def || e.intensity <= 0) return;
    const out = def.render({ ...base, i: Math.min(1, e.intensity / 100), seed: hashStr(base.clipId) + n * 101, fid: `fx-${safe}-${n}` });
    if (out.transform) transforms.push(out.transform);
    if (out.filter) filters.push(out.filter);
    if (out.overlay) overlays.push(<React.Fragment key={n}>{out.overlay}</React.Fragment>);
    if (out.svg) svgs.push(<React.Fragment key={n}>{out.svg}</React.Fragment>);
  });
  return {
    transform: transforms.join(' ') || undefined,
    filter: filters.join(' ') || undefined,
    overlay: overlays.length ? <>{overlays}</> : undefined,
    svg: svgs.length ? <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>{svgs}</svg> : undefined,
  };
}
