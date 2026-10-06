// Keyframes: cada propriedade é interpolada entre os keyframes que a definem.
// A curva de cada segmento é a do keyframe onde o segmento começa (IBM: produtiva/expressiva).
import type { Clip, ClipTransform, Keyframe, KfEasing, KfProp } from './types';
import { easing } from './motion';
import { getTransform } from './transform';

export const KF_PROPS: KfProp[] = ['x', 'y', 'scale', 'rotation', 'opacity'];

export const KF_EASINGS: { value: KfEasing; label: string; title: string }[] = [
  { value: 'productive', label: 'Produtiva', title: 'IBM productive standard: movimento discreto' },
  { value: 'expressive', label: 'Expressiva', title: 'IBM expressive standard: movimento com presença' },
  { value: 'linear', label: 'Linear', title: 'Velocidade constante' },
  { value: 'hold', label: 'Parar', title: 'Mantém o valor até ao keyframe seguinte (salto)' },
];

const curves: Record<KfEasing, (t: number) => number> = {
  linear: (t) => t,
  productive: easing('productive-standard'),
  expressive: easing('expressive-standard'),
  hold: () => 0,
};

export type KfValues = Record<KfProp, number>;

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.frame - b.frame);
}

/** Valores das propriedades num frame (relativo ao clip), partindo dos valores base */
export function sampleKeyframes(kfs: Keyframe[] | undefined, frame: number, base: KfValues): KfValues {
  if (!kfs || !kfs.length) return base;
  const out = { ...base };
  const sorted = sortKeyframes(kfs);
  for (const prop of KF_PROPS) {
    const list = sorted.filter((k) => k.values[prop] !== undefined);
    if (!list.length) continue;
    if (frame <= list[0].frame) { out[prop] = list[0].values[prop]!; continue; }
    const last = list[list.length - 1];
    if (frame >= last.frame) { out[prop] = last.values[prop]!; continue; }
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (frame >= a.frame && frame < b.frame) {
        const t = curves[a.easing]((frame - a.frame) / (b.frame - a.frame));
        out[prop] = a.values[prop]! + (b.values[prop]! - a.values[prop]!) * t;
        break;
      }
    }
  }
  return out;
}

/** Valores base (sem keyframes) de um clip */
export function baseValues(clip: Clip): KfValues {
  const t = getTransform(clip);
  if (clip.text) return { x: clip.text.x, y: clip.text.y, scale: t.scale, rotation: t.rotation, opacity: t.opacity };
  return { x: t.x, y: t.y, scale: t.scale, rotation: t.rotation, opacity: t.opacity };
}

/** Valores efetivos num frame relativo ao clip */
export function valuesAt(clip: Clip, rel: number): KfValues {
  return sampleKeyframes(clip.keyframes, rel, baseValues(clip));
}

/** Transformação efetiva (com keyframes) para clips de vídeo/imagem */
export function animatedTransform(clip: Clip, rel: number): ClipTransform {
  const t = getTransform(clip);
  if (!clip.keyframes?.length) return t;
  return { ...t, ...valuesAt(clip, rel) };
}

export function keyframeAt(clip: Clip, rel: number): Keyframe | undefined {
  return clip.keyframes?.find((k) => k.frame === rel);
}

/** Desloca keyframes (ex.: ao aparar o início) — mantém-nos presos ao conteúdo */
export function shiftKeyframes(kfs: Keyframe[] | undefined, delta: number): Keyframe[] | undefined {
  if (!kfs?.length || !delta) return kfs;
  return kfs.map((k) => ({ ...k, frame: k.frame + delta }));
}

export function scaleKeyframes(kfs: Keyframe[] | undefined, k: number): Keyframe[] | undefined {
  if (!kfs?.length || k === 1) return kfs;
  return kfs.map((kf) => ({ ...kf, frame: Math.round(kf.frame * k) }));
}
