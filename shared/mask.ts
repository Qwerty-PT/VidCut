// Máscaras: uma forma (SVG) usada como máscara CSS na caixa do clip — igual na pré-visualização e no export.
import type { ClipMask, MaskShape } from './types';

export const MASK_SHAPES: { value: MaskShape; label: string }[] = [
  { value: 'rect', label: 'Retângulo' },
  { value: 'circle', label: 'Círculo' },
  { value: 'linear', label: 'Linear' },
  { value: 'band', label: 'Faixa' },
  { value: 'heart', label: 'Coração' },
  { value: 'star', label: 'Estrela' },
];

/** aspect = largura/altura da caixa do clip (para círculos e estrelas saírem redondos) */
export function defaultMask(shape: MaskShape, aspect = 16 / 9): ClipMask {
  const base = { x: 50, y: 50, rotation: 0, feather: 0, round: 0, invert: false };
  switch (shape) {
    case 'circle': return { ...base, shape, w: 50, h: Math.min(100, 50 * aspect), feather: 8 };
    case 'linear': return { ...base, shape, w: 100, h: 100, feather: 20 };
    case 'band': return { ...base, shape, w: 100, h: 40, feather: 10 };
    case 'heart': return { ...base, shape, w: 50, h: Math.min(100, 50 * aspect) };
    case 'star': return { ...base, shape, w: 55, h: Math.min(100, 55 * aspect) };
    default: return { ...base, shape, w: 70, h: 70, round: 10 };
  }
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

function shapeSvg(m: ClipMask, W: number, H: number, fill: string, extra: string): string {
  const cx = (m.x / 100) * W, cy = (m.y / 100) * H;
  const sw = Math.max(1, (m.w / 100) * W), sh = Math.max(1, (m.h / 100) * H);
  const L = (W + H) * 2; // "infinito" para as formas abertas
  const tf = `transform="rotate(${n(m.rotation)} ${n(cx)} ${n(cy)})"`;
  switch (m.shape) {
    case 'circle': return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(sw / 2)}" ry="${n(sh / 2)}" fill="${fill}" ${tf} ${extra}/>`;
    case 'linear': return `<rect x="${n(cx - L)}" y="${n(cy - L)}" width="${n(2 * L)}" height="${n(L)}" fill="${fill}" ${tf} ${extra}/>`;
    case 'band': return `<rect x="${n(cx - L)}" y="${n(cy - sh / 2)}" width="${n(2 * L)}" height="${n(sh)}" fill="${fill}" ${tf} ${extra}/>`;
    case 'heart': {
      // coração num quadrado 0..1, escalado para sw × sh
      const p = 'M0.5 0.95 C0.2 0.72 0 0.52 0 0.3 C0 0.12 0.14 0 0.29 0 C0.39 0 0.46 0.05 0.5 0.13 C0.54 0.05 0.61 0 0.71 0 C0.86 0 1 0.12 1 0.3 C1 0.52 0.8 0.72 0.5 0.95Z';
      return `<path d="${p}" fill="${fill}" transform="rotate(${n(m.rotation)} ${n(cx)} ${n(cy)}) translate(${n(cx - sw / 2)} ${n(cy - sh / 2)}) scale(${n(sw)} ${n(sh)})" ${extra}/>`;
    }
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.4 : 1;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${n(cx + (Math.cos(a) * r * sw) / 2)},${n(cy + (Math.sin(a) * r * sh) / 2)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" ${tf} ${extra}/>`;
    }
    default: {
      const r = (Math.min(sw, sh) / 2) * (m.round / 100);
      return `<rect x="${n(cx - sw / 2)}" y="${n(cy - sh / 2)}" width="${n(sw)}" height="${n(sh)}" rx="${n(r)}" fill="${fill}" ${tf} ${extra}/>`;
    }
  }
}

/** SVG da máscara para uma caixa de W × H (zona branca = visível) */
export function maskSvg(m: ClipMask, W: number, H: number): string {
  const blur = (m.feather / 100) * Math.min(W, H) * 0.12;
  const filt = blur > 0.3 ? `<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(blur)}"/></filter>` : '';
  const fx = filt ? 'filter="url(#f)"' : '';
  const body = m.invert
    ? `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${n(W)}" height="${n(H)}"><rect width="${n(W)}" height="${n(H)}" fill="#fff"/>${shapeSvg(m, W, H, '#000', fx)}</mask><rect width="${n(W)}" height="${n(H)}" fill="#fff" mask="url(#m)"/>`
    : shapeSvg(m, W, H, '#fff', fx);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(H)}" viewBox="0 0 ${n(W)} ${n(H)}"><defs>${filt}</defs>${body}</svg>`;
}

/** Estilo CSS de máscara para a caixa do clip */
export function maskStyle(m: ClipMask | undefined, W: number, H: number): Record<string, string> | undefined {
  if (!m) return undefined;
  const url = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(maskSvg(m, W, H))}")`;
  return { maskImage: url, WebkitMaskImage: url, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' };
}
