// Animações de entrada/saída de clips (texto, imagem, vídeo) com as regras IBM:
// um eixo de cada vez, sem ressaltos, texto revelado no sentido da leitura,
// e ritmo com pequenos desfasamentos (stagger) entre palavras/linhas.
import type React from 'react';
import type { AnimPreset, ClipAnim } from './types';
import { easing } from './motion';

export const ANIM_PRESETS: { preset: AnimPreset; label: string; textOnly?: boolean }[] = [
  { preset: 'none', label: 'Nenhuma' },
  { preset: 'fade', label: 'Aparecer' },
  { preset: 'slide-up', label: 'Subir' },
  { preset: 'slide-down', label: 'Descer' },
  { preset: 'slide-left', label: 'Da direita' },
  { preset: 'slide-right', label: 'Da esquerda' },
  { preset: 'scale', label: 'Escala' },
  { preset: 'reveal', label: 'Revelar' },
  { preset: 'typewriter', label: 'Máquina de escrever', textOnly: true },
  { preset: 'words', label: 'Palavra a palavra', textOnly: true },
  { preset: 'lines', label: 'Linha a linha', textOnly: true },
];

export const animLabel = (p: AnimPreset) => ANIM_PRESETS.find((x) => x.preset === p)?.label ?? p;

/** Progresso 0..1 com a curva IBM certa: entrada usa "entrance", saída usa "exit" */
export function animEase(anim: ClipAnim, phase: 'in' | 'out', t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return easing(`${anim.style}-${phase === 'in' ? 'entrance' : 'exit'}`)(x);
}

/**
 * Estado de um clip num frame (relativo ao início do clip).
 * Devolve `p`: 1 = totalmente visível; 0 = escondido; e qual a fase ativa.
 */
export function animState(animIn: ClipAnim | undefined, animOut: ClipAnim | undefined, frame: number, duration: number) {
  const inD = animIn && animIn.preset !== 'none' ? Math.min(animIn.duration, duration) : 0;
  const outD = animOut && animOut.preset !== 'none' ? Math.min(animOut.duration, duration - inD) : 0;
  if (inD > 0 && frame < inD) return { phase: 'in' as const, anim: animIn!, raw: frame / inD, p: animEase(animIn!, 'in', frame / inD) };
  if (outD > 0 && frame >= duration - outD) {
    const raw = (duration - frame) / outD; // 1 → 0
    return { phase: 'out' as const, anim: animOut!, raw, p: 1 - animEase(animOut!, 'out', 1 - raw) };
  }
  return { phase: 'idle' as const, anim: undefined, raw: 1, p: 1 };
}

/** Estilo do bloco inteiro para um preset (p = 1 visível, 0 escondido). distPx = distância de deslize */
export function blockStyle(preset: AnimPreset, p: number, distPx: number): { opacity: number; style: React.CSSProperties } {
  const q = 1 - p;
  switch (preset) {
    case 'fade': return { opacity: p, style: {} };
    case 'slide-up': return { opacity: p, style: { transform: `translateY(${q * distPx}px)` } };
    case 'slide-down': return { opacity: p, style: { transform: `translateY(${-q * distPx}px)` } };
    case 'slide-left': return { opacity: p, style: { transform: `translateX(${q * distPx}px)` } };
    case 'slide-right': return { opacity: p, style: { transform: `translateX(${-q * distPx}px)` } };
    case 'scale': return { opacity: p, style: { transform: `scale(${0.9 + 0.1 * p})` } };
    case 'reveal': return { opacity: 1, style: { clipPath: `inset(0 ${q * 100}% 0 0)` } };
    default: return { opacity: 1, style: {} };
  }
}

/**
 * Progresso de cada parte (palavra/linha) com desfasamento.
 * Cada parte anima em 60% do tempo total; as restantes começam escalonadas.
 */
export function staggerProgress(i: number, n: number, rawT: number, anim: ClipAnim, phase: 'in' | 'out'): number {
  if (n <= 1) return phase === 'in' ? animEase(anim, 'in', rawT) : 1 - animEase(anim, 'out', 1 - rawT);
  const win = 0.6;
  const delay = (1 - win) / (n - 1);
  if (phase === 'in') {
    const local = (rawT - i * delay) / win;
    return animEase(anim, 'in', local);
  }
  // saída: a última parte sai primeiro? IBM: manter ordem de leitura — sai pela mesma ordem
  const outT = 1 - rawT; // 0 → 1 ao longo da saída
  const local = (outT - i * delay) / win;
  return 1 - animEase(anim, 'out', local);
}

export function defaultTextAnims(fps: number): { animIn: ClipAnim; animOut: ClipAnim } {
  return {
    animIn: { preset: 'slide-up', duration: Math.round(0.4 * fps), style: 'expressive' }, // IBM slow-01
    animOut: { preset: 'fade', duration: Math.round(0.24 * fps), style: 'productive' }, // IBM moderate-02
  };
}
