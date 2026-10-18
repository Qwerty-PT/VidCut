// Volume ao longo do clip: valor fixo (`clip.volume`) ou keyframes de volume (interpolação linear).
import type { Clip, VolKey } from './types';

/** Máximo de volume (400% = +12 dB) */
export const VOL_MAX = 4;

export const sortVol = (keys: VolKey[]) => [...keys].sort((a, b) => a.f - b.f);

/** Volume (multiplicador) num frame relativo ao clip */
export function volumeAt(clip: Pick<Clip, 'volume' | 'volKeys'>, rel: number): number {
  const k = clip.volKeys;
  if (!k || !k.length) return clip.volume;
  if (rel <= k[0].f) return k[0].v;
  const last = k[k.length - 1];
  if (rel >= last.f) return last.v;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (rel >= a.f && rel < b.f) return a.v + (b.v - a.v) * ((rel - a.f) / (b.f - a.f));
  }
  return last.v;
}

/** Desloca os keyframes (ao dividir/aparar à esquerda). Mantém um ponto em cada ponta para conservar a curva. */
export function shiftVolKeys(keys: VolKey[] | undefined, delta: number, duration: number, clip?: Pick<Clip, 'volume' | 'volKeys'>): VolKey[] | undefined {
  if (!keys?.length) return keys;
  const src = clip ?? { volume: 1, volKeys: keys };
  const moved = keys.map((k) => ({ f: k.f + delta, v: k.v }));
  const inside = moved.filter((k) => k.f >= 0 && k.f <= duration);
  // valores nas pontas (antes de deslocar: frame -delta e duration-delta)
  const startV = volumeAt(src, -delta), endV = volumeAt(src, duration - delta);
  const out = [...inside];
  if (!out.some((k) => k.f === 0) && moved.some((k) => k.f < 0)) out.unshift({ f: 0, v: startV });
  if (!out.some((k) => k.f === duration) && moved.some((k) => k.f > duration)) out.push({ f: duration, v: endV });
  return out.length ? sortVol(out) : [{ f: 0, v: startV }];
}

export const scaleVolKeys = (keys: VolKey[] | undefined, k: number) => keys?.map((x) => ({ f: Math.round(x.f * k), v: x.v }));

/** Ganho em dB, para mostrar */
export const toDb = (v: number) => (v <= 0.0001 ? '−∞ dB' : `${v >= 1 ? '+' : '−'}${Math.abs(20 * Math.log10(v)).toFixed(1).replace('.', ',')} dB`);
