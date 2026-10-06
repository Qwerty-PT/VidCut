// Transformação de clips visuais: posição, escala, rotação, espelho, recorte e opacidade.
import type React from 'react';
import type { Clip, ClipTransform, MediaItem } from './types';

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 50, y: 50, scale: 1, rotation: 0, flipH: false, flipV: false,
  crop: { top: 0, right: 0, bottom: 0, left: 0 }, opacity: 1, fit: 'contain',
};

export const getTransform = (clip: Clip): ClipTransform => ({
  ...DEFAULT_TRANSFORM,
  ...clip.transform,
  crop: { ...DEFAULT_TRANSFORM.crop, ...clip.transform?.crop },
});

export function isDefaultTransform(t: ClipTransform): boolean {
  const d = DEFAULT_TRANSFORM;
  return t.x === d.x && t.y === d.y && t.scale === d.scale && t.rotation === d.rotation && !t.flipH && !t.flipV &&
    t.opacity === 1 && t.fit === 'contain' && !t.crop.top && !t.crop.right && !t.crop.bottom && !t.crop.left;
}

/** Tamanho base (antes da escala) do clip no quadro, em px do projeto */
export function baseSize(media: MediaItem | undefined, W: number, H: number, fit: ClipTransform['fit']): { w: number; h: number } {
  const mw = media?.width || W;
  const mh = media?.height || H;
  const s = fit === 'cover' ? Math.max(W / mw, H / mh) : Math.min(W / mw, H / mh);
  return { w: mw * s, h: mh * s };
}

/** Estilo do elemento de media (img/video) dentro de um AbsoluteFill do tamanho do quadro */
export function mediaStyle(t: ClipTransform, box: { w: number; h: number }): React.CSSProperties {
  const sx = t.scale * (t.flipH ? -1 : 1);
  const sy = t.scale * (t.flipV ? -1 : 1);
  const c = t.crop;
  const cropped = c.top || c.right || c.bottom || c.left;
  return {
    position: 'absolute',
    left: `${t.x}%`,
    top: `${t.y}%`,
    width: box.w,
    height: box.h,
    maxWidth: 'none',
    objectFit: 'fill',
    transform: `translate(-50%, -50%) rotate(${t.rotation}deg) scale(${sx}, ${sy})`,
    clipPath: cropped ? `inset(${c.top}% ${c.right}% ${c.bottom}% ${c.left}%)` : undefined,
  };
}

export type LayoutPreset = 'full' | 'fill' | 'left' | 'right' | 'top' | 'bottom' | 'pip-br' | 'pip-bl' | 'pip-tr' | 'pip-tl';

export const LAYOUT_PRESETS: { preset: LayoutPreset; label: string }[] = [
  { preset: 'full', label: 'Inteiro' },
  { preset: 'fill', label: 'Preencher' },
  { preset: 'left', label: 'Metade esq.' },
  { preset: 'right', label: 'Metade dir.' },
  { preset: 'top', label: 'Metade cima' },
  { preset: 'bottom', label: 'Metade baixo' },
  { preset: 'pip-tl', label: 'Canto ↖' },
  { preset: 'pip-tr', label: 'Canto ↗' },
  { preset: 'pip-bl', label: 'Canto ↙' },
  { preset: 'pip-br', label: 'Canto ↘' },
];

/**
 * Faz o clip cobrir exatamente um retângulo do quadro (em px), recortando o que sobra.
 * Usado para ecrã dividido.
 */
function coverRect(media: MediaItem | undefined, W: number, H: number, rx: number, ry: number, rw: number, rh: number, keep: ClipTransform): ClipTransform {
  const box = baseSize(media, W, H, 'contain');
  const k = Math.max(rw / box.w, rh / box.h);
  const dw = box.w * k, dh = box.h * k;
  const cx = ((dw - rw) / dw / 2) * 100;
  const cy = ((dh - rh) / dh / 2) * 100;
  return {
    ...keep, fit: 'contain', scale: k, rotation: 0,
    x: ((rx + rw / 2) / W) * 100, y: ((ry + rh / 2) / H) * 100,
    crop: { top: cy, bottom: cy, left: cx, right: cx },
  };
}

export function applyLayoutPreset(preset: LayoutPreset, media: MediaItem | undefined, W: number, H: number, cur: ClipTransform): ClipTransform {
  const keep = { ...cur, flipH: cur.flipH, flipV: cur.flipV, opacity: cur.opacity };
  switch (preset) {
    case 'full': return { ...DEFAULT_TRANSFORM, flipH: cur.flipH, flipV: cur.flipV, opacity: cur.opacity };
    case 'fill': return { ...DEFAULT_TRANSFORM, fit: 'cover', flipH: cur.flipH, flipV: cur.flipV, opacity: cur.opacity };
    case 'left': return coverRect(media, W, H, 0, 0, W / 2, H, keep);
    case 'right': return coverRect(media, W, H, W / 2, 0, W / 2, H, keep);
    case 'top': return coverRect(media, W, H, 0, 0, W, H / 2, keep);
    case 'bottom': return coverRect(media, W, H, 0, H / 2, W, H / 2, keep);
    default: {
      // picture-in-picture: 30% do tamanho, com margem de 4% (grelha IBM)
      const s = 0.3;
      const box = baseSize(media, W, H, 'contain');
      const hw = ((box.w * s) / 2 / W) * 100, hh = ((box.h * s) / 2 / H) * 100;
      const m = 4;
      const right = preset === 'pip-br' || preset === 'pip-tr';
      const bottom = preset === 'pip-br' || preset === 'pip-bl';
      return {
        ...DEFAULT_TRANSFORM, flipH: cur.flipH, flipV: cur.flipV, opacity: cur.opacity, scale: s,
        x: right ? 100 - m - hw : m + hw,
        y: bottom ? 100 - m * (W / H) - hh : m * (W / H) + hh,
      };
    }
  }
}
