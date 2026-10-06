// Tokens de animação IBM / Carbon — base de todos os presets do VidCut.
// Productive = movimentos de interface, rápidos e discretos.
// Expressive = momentos de destaque (entradas de título, revelações).
import { Easing } from 'remotion';

type Curve = [number, number, number, number];

export const CURVES: Record<string, Curve> = {
  'productive-standard': [0.2, 0, 0.38, 0.9],
  'productive-entrance': [0, 0, 0.38, 0.9],
  'productive-exit': [0.2, 0, 1, 0.9],
  'expressive-standard': [0.4, 0.14, 0.3, 1],
  'expressive-entrance': [0, 0, 0.3, 1],
  'expressive-exit': [0.4, 0.14, 1, 1],
};

export type CurveName = keyof typeof CURVES;

/** Durações IBM em milissegundos */
export const DURATIONS_MS = {
  'fast-01': 70,
  'fast-02': 110,
  'moderate-01': 150,
  'moderate-02': 240,
  'slow-01': 400,
  'slow-02': 700,
} as const;

export type DurationToken = keyof typeof DURATIONS_MS;

export function easing(name: CurveName): (t: number) => number {
  const [a, b, c, d] = CURVES[name];
  return Easing.bezier(a, b, c, d);
}

export function msToFrames(ms: number, fps: number): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

export function tokenFrames(token: DurationToken, fps: number): number {
  return msToFrames(DURATIONS_MS[token], fps);
}

/** Fator 0..1 de um fade in/out linear dentro de um clip */
export function fadeFactor(frame: number, duration: number, fadeIn: number, fadeOut: number): number {
  const fin = fadeIn > 0 ? Math.min(1, Math.max(0, frame / fadeIn)) : 1;
  const fout = fadeOut > 0 ? Math.min(1, Math.max(0, (duration - frame) / fadeOut)) : 1;
  return Math.min(fin, fout);
}
