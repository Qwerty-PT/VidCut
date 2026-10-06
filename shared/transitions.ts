// Transições entre clips encostados na mesma pista de vídeo.
// A transição fica centrada no corte: o clip A prolonga-se `post` frames depois do seu fim
// e o clip B começa `pre` frames antes do seu início. Se a fonte não tiver frames extra
// nesse lado, o primeiro/último frame fica congelado durante a transição.
import type React from 'react';
import type { Clip, Track, TransitionType } from './types';
import { easing } from './motion';

export const TRANSITIONS: { type: TransitionType; label: string; hint: string }[] = [
  { type: 'dissolve', label: 'Dissolver', hint: 'Mistura suave entre os dois clips' },
  { type: 'dip', label: 'Fundido a preto', hint: 'Escurece e volta a aparecer' },
  { type: 'slide', label: 'Deslizar', hint: 'O novo clip entra por cima, vindo da direita' },
  { type: 'push', label: 'Empurrar', hint: 'O novo clip empurra o anterior para fora' },
  { type: 'wipe', label: 'Cortina', hint: 'O novo clip é revelado da esquerda para a direita' },
  { type: 'zoom', label: 'Zoom', hint: 'O novo clip aproxima-se e aparece' },
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
  inT?: { type: TransitionType; pre: number; post: number };
  /** Transição de saída ativa (este clip é o A) */
  outT?: { type: TransitionType; pre: number; post: number };
}

/** Transições que afetam um clip numa pista de vídeo */
export function activeTransitions(track: Track, clip: Clip): ActiveTransitions {
  const r: ActiveTransitions = {};
  if (track.kind !== 'video') return r;
  const prev = prevAdjacent(track, clip);
  if (clip.transition && clip.transition.duration > 1 && prev) {
    const d = Math.min(clip.transition.duration, maxTransition(prev, clip));
    r.inT = { type: clip.transition.type, ...splitDuration(d) };
  }
  const next = nextAdjacent(track, clip);
  if (next?.transition && next.transition.duration > 1) {
    const d = Math.min(next.transition.duration, maxTransition(clip, next));
    r.outT = { type: next.transition.type, ...splitDuration(d) };
  }
  return r;
}

const ease = easing('expressive-standard'); // IBM: momento de destaque

/**
 * Estilo visual de um clip num dado frame global.
 * role 'in' = clip B a entrar; 'out' = clip A a sair. t vai de 0 a 1 ao longo da transição.
 */
export function transitionStyle(type: TransitionType, role: 'in' | 'out', tRaw: number): { opacity: number; style: React.CSSProperties } {
  const t = ease(Math.min(1, Math.max(0, tRaw)));
  switch (type) {
    case 'dissolve':
      // B por cima a aparecer; A fica igual por baixo
      return role === 'in' ? { opacity: t, style: {} } : { opacity: 1, style: {} };
    case 'dip': {
      // A desaparece na 1.ª metade, B aparece na 2.ª
      if (role === 'out') return { opacity: Math.max(0, 1 - tRaw * 2), style: {} };
      return { opacity: Math.max(0, tRaw * 2 - 1), style: {} };
    }
    case 'slide':
      return role === 'in' ? { opacity: 1, style: { transform: `translateX(${(1 - t) * 100}%)` } } : { opacity: 1, style: {} };
    case 'push':
      return role === 'in'
        ? { opacity: 1, style: { transform: `translateX(${(1 - t) * 100}%)` } }
        : { opacity: 1, style: { transform: `translateX(${-t * 100}%)` } };
    case 'wipe':
      return role === 'in' ? { opacity: 1, style: { clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` } } : { opacity: 1, style: {} };
    case 'zoom':
      return role === 'in' ? { opacity: t, style: { transform: `scale(${1.15 - 0.15 * t})` } } : { opacity: 1, style: {} };
    default:
      return { opacity: 1, style: {} };
  }
}

/** Volume (0..1) do som de um clip durante uma transição: cruzamento linear */
export function transitionVolume(role: 'in' | 'out', t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return role === 'in' ? x : 1 - x;
}
