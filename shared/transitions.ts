// Transições entre clips encostados na mesma pista de vídeo.
// A transição fica centrada no corte: o clip A prolonga-se `post` frames depois do seu fim
// e o clip B começa `pre` frames antes do seu início. Se a fonte não tiver frames extra
// nesse lado, o primeiro/último frame fica congelado durante a transição.
import type React from 'react';
import type { Clip, Track, TransitionDir, TransitionType } from './types';
import { easing } from './motion';

export const TRANSITIONS: { type: TransitionType; label: string; hint: string }[] = [
  { type: 'dissolve', label: 'Dissolver', hint: 'Mistura suave entre os dois clips' },
  { type: 'dip', label: 'Fundido a preto', hint: 'Escurece e volta a aparecer' },
  { type: 'slide', label: 'Deslizar', hint: 'O novo clip entra por cima, vindo da direita' },
  { type: 'push', label: 'Empurrar', hint: 'O novo clip empurra o anterior para fora' },
  { type: 'wipe', label: 'Cortina', hint: 'O novo clip é revelado da esquerda para a direita' },
  { type: 'zoom', label: 'Zoom', hint: 'O novo clip aproxima-se e aparece' },
  { type: 'blur', label: 'Desfocar', hint: 'O clip desfoca-se e o novo aparece a ganhar foco' },
  { type: 'flash', label: 'Flash', hint: 'Clarão branco no corte' },
  { type: 'glitch', label: 'Glitch', hint: 'Interferência digital: cores separadas e tremor' },
  { type: 'circle', label: 'Círculo', hint: 'O novo clip abre num círculo a partir do centro' },
  { type: 'diamond', label: 'Losango', hint: 'O novo clip abre num losango a partir do centro' },
  { type: 'blinds', label: 'Persianas', hint: 'O novo clip aparece em faixas' },
  { type: 'whip', label: 'Chicote', hint: 'Movimento rápido com arrasto (whip pan)' },
];

/** Transições que aceitam direção, com a direção por omissão */
export const DIRECTIONAL: Partial<Record<TransitionType, TransitionDir>> = {
  slide: 'left', push: 'left', wipe: 'right', whip: 'left', blinds: 'down',
};

export const DIR_LABELS: { dir: TransitionDir; label: string; title: string }[] = [
  { dir: 'left', label: '←', title: 'Para a esquerda' },
  { dir: 'right', label: '→', title: 'Para a direita' },
  { dir: 'up', label: '↑', title: 'Para cima' },
  { dir: 'down', label: '↓', title: 'Para baixo' },
];

export const transitionLabel = (t: TransitionType) => TRANSITIONS.find((x) => x.type === t)?.label ?? t;

/** Divide a duração total em parte antes do corte (pre, mostra B) e depois (post, mostra A) */
export function splitDuration(d: number): { pre: number; post: number } {
  const pre = Math.floor(d / 2);
  return { pre, post: d - pre };
}

/** Clip anterior encostado (termina exatamente onde este começa) */
export function prevAdjacent(track: Track, clip: Clip): Clip | undefined {
  return track.clips.find((c) => c.id !== clip.id && c.start + c.duration === clip.start);
}

export function nextAdjacent(track: Track, clip: Clip): Clip | undefined {
  return track.clips.find((c) => c.id !== clip.id && c.start === clip.start + clip.duration);
}

/** Duração máxima permitida para uma transição entre A e B */
export function maxTransition(a: Clip, b: Clip): number {
  return Math.max(2, Math.min(a.duration, b.duration));
}

export interface ActiveTransitions {
  /** Transição de entrada ativa (este clip é o B) */
  inT?: { type: TransitionType; pre: number; post: number; dir?: TransitionDir; seed: number };
  /** Transição de saída ativa (este clip é o A) */
  outT?: { type: TransitionType; pre: number; post: number; dir?: TransitionDir; seed: number };
}

/** Transições que afetam um clip numa pista de vídeo */
export function activeTransitions(track: Track, clip: Clip): ActiveTransitions {
  const r: ActiveTransitions = {};
  if (track.kind !== 'video') return r;
  const prev = prevAdjacent(track, clip);
  if (clip.transition && clip.transition.duration > 1 && prev) {
    const d = Math.min(clip.transition.duration, maxTransition(prev, clip));
    r.inT = { type: clip.transition.type, ...splitDuration(d), dir: clip.transition.direction, seed: hashId(clip.id) };
  }
  const next = nextAdjacent(track, clip);
  if (next?.transition && next.transition.duration > 1) {
    const d = Math.min(next.transition.duration, maxTransition(clip, next));
    r.outT = { type: next.transition.type, ...splitDuration(d), dir: next.transition.direction, seed: hashId(next.id) };
  }
  return r;
}

const ease = easing('expressive-standard'); // IBM: momento de destaque
const easeIn = easing('expressive-exit');
const easeOut = easing('expressive-entrance');

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Pseudo-aleatório determinístico (0..1) — o export tem de dar igual à pré-visualização */
export function rand(seed: number, n: number): number {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export interface TransitionCtx { frame: number; H: number; dir?: TransitionDir; seed?: number }

export interface TransitionLook {
  opacity: number;
  style: React.CSSProperties;
  /** Véu branco por cima (0..1) */
  flash?: number;
  /** Separação de canais RGB em px (glitch) */
  rgb?: number;
}

/** Deslocamento de entrada (B) ou saída (A) em %, segundo a direção do movimento */
function offset(dir: TransitionDir, amount: number): string {
  switch (dir) {
    case 'left': return `translateX(${amount}%)`;
    case 'right': return `translateX(${-amount}%)`;
    case 'up': return `translateY(${amount}%)`;
    case 'down': return `translateY(${-amount}%)`;
  }
}

function wipeInset(dir: TransitionDir, k: number): string {
  const r = (1 - k) * 100;
  switch (dir) {
    case 'right': return `inset(0 ${r}% 0 0)`;
    case 'left': return `inset(0 0 0 ${r}%)`;
    case 'down': return `inset(0 0 ${r}% 0)`;
    case 'up': return `inset(${r}% 0 0 0)`;
  }
}

function blindsPolygon(dir: TransitionDir, k: number, n = 7): string {
  const pts: string[] = [];
  const band = 100 / n;
  const h = band * k;
  const vertical = dir === 'left' || dir === 'right';
  for (let i = 0; i < n; i++) {
    const a = i * band;
    const b = a + h;
    if (vertical) pts.push(`${a}% 0%`, `${b}% 0%`, `${b}% 100%`, `${a}% 100%`, `${a}% 0%`);
    else pts.push(`0% ${a}%`, `100% ${a}%`, `100% ${b}%`, `0% ${b}%`, `0% ${a}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

/**
 * Aspeto de um clip durante uma transição.
 * role 'in' = clip B a entrar; 'out' = clip A a sair. tRaw vai de 0 a 1 ao longo da transição.
 */
export function transitionStyle(type: TransitionType, role: 'in' | 'out', tRaw: number, ctx: TransitionCtx = { frame: 0, H: 1080 }): TransitionLook {
  const tc = Math.min(1, Math.max(0, tRaw));
  const t = ease(tc);
  const dir = ctx.dir ?? DIRECTIONAL[type] ?? 'left';
  const px = ctx.H / 1080;
  switch (type) {
    case 'dissolve':
      return role === 'in' ? { opacity: t, style: {} } : { opacity: 1, style: {} };
    case 'dip':
      if (role === 'out') return { opacity: Math.max(0, 1 - tc * 2), style: {} };
      return { opacity: Math.max(0, tc * 2 - 1), style: {} };
    case 'slide':
      return role === 'in' ? { opacity: 1, style: { transform: offset(dir, (1 - t) * 100) } } : { opacity: 1, style: {} };
    case 'push':
      return role === 'in'
        ? { opacity: 1, style: { transform: offset(dir, (1 - t) * 100) } }
        : { opacity: 1, style: { transform: offset(dir, -t * 100) } };
    case 'wipe':
      return role === 'in' ? { opacity: 1, style: { clipPath: wipeInset(dir, t) } } : { opacity: 1, style: {} };
    case 'zoom':
      return role === 'in' ? { opacity: t, style: { transform: `scale(${1.15 - 0.15 * t})` } } : { opacity: 1, style: {} };
    case 'blur': {
      // A desfoca-se e B aparece por cima a ganhar foco
      if (role === 'out') return { opacity: 1, style: { filter: `blur(${(easeIn(tc) * 28 * px).toFixed(2)}px)` } };
      return { opacity: t, style: { filter: `blur(${((1 - easeOut(tc)) * 28 * px).toFixed(2)}px)` } };
    }
    case 'flash': {
      // clarão que cresce até ao corte e se desfaz a seguir
      if (role === 'out') return { opacity: 1, style: {}, flash: tc < 0.5 ? easeIn(tc / 0.5) : 1 };
      return tc < 0.5 ? { opacity: 0, style: {} } : { opacity: 1, style: {}, flash: 1 - easeOut((tc - 0.5) / 0.5) };
    }
    case 'glitch': {
      const k = 1 - Math.abs(2 * tc - 1); // intensidade máxima no corte
      const seed = ctx.seed ?? 1;
      const r1 = rand(seed, ctx.frame), r2 = rand(seed, ctx.frame + 7919), r3 = rand(seed, ctx.frame + 104729);
      // corte no meio com alguns "piscares" antes e depois
      const flicker = tc > 0.3 && tc < 0.7 && r3 < 0.35;
      const showB = (tc >= 0.5) !== flicker;
      const dx = (r1 - 0.5) * 70 * k * px, skew = (r2 - 0.5) * 10 * k;
      const band = r3 < 0.6 && k > 0.25 ? `inset(${Math.round(r2 * 70)}% 0 ${Math.round((1 - r1) * 25)}% 0)` : undefined;
      const look: TransitionLook = {
        opacity: role === 'in' ? (showB ? 1 : 0) : 1,
        style: { transform: `translateX(${dx.toFixed(1)}px) skewX(${skew.toFixed(2)}deg)`, filter: `saturate(${1 + k * 1.6}) contrast(${1 + k * 0.35})` },
        rgb: (6 + r2 * 18) * k * px,
      };
      if (role === 'in' && showB && band && r1 > 0.5) look.style.clipPath = band;
      return look;
    }
    case 'circle':
      return role === 'in' ? { opacity: 1, style: { clipPath: `circle(${(t * 72).toFixed(2)}% at 50% 50%)` } } : { opacity: 1, style: {} };
    case 'diamond': {
      if (role === 'out') return { opacity: 1, style: {} };
      const r = t * 100;
      return { opacity: 1, style: { clipPath: `polygon(50% ${50 - r}%, ${50 + r}% 50%, 50% ${50 + r}%, ${50 - r}% 50%)` } };
    }
    case 'blinds':
      return role === 'in' ? { opacity: 1, style: { clipPath: blindsPolygon(dir, t) } } : { opacity: 1, style: {} };
    case 'whip': {
      // empurrar muito rápido com arrasto de movimento no meio
      const k = Math.sin(Math.PI * tc);
      const blur = (k * 34 * px).toFixed(2);
      const horiz = dir === 'left' || dir === 'right';
      const stretch = horiz ? `scaleX(${1 + k * 0.08})` : `scaleY(${1 + k * 0.08})`;
      const mv = ease(tc);
      return role === 'in'
        ? { opacity: 1, style: { transform: `${offset(dir, (1 - mv) * 100)} ${stretch}`, filter: `blur(${blur}px)` } }
        : { opacity: 1, style: { transform: `${offset(dir, -mv * 100)} ${stretch}`, filter: `blur(${blur}px)` } };
    }
    default:
      return { opacity: 1, style: {} };
  }
}

/** Volume (0..1) do som de um clip durante uma transição: cruzamento linear */
export function transitionVolume(role: 'in' | 'out', t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return role === 'in' ? x : 1 - x;
}
