// Cache de picos de áudio por ficheiro (pedidos ao processo principal, uma vez por ficheiro)
import { useEffect, useState } from 'react';

export const PEAKS_PER_SEC = 100;
const cache = new Map<string, Uint8Array>();
const pending = new Map<string, Promise<Uint8Array>>();

function load(path: string): Promise<Uint8Array> {
  if (cache.has(path)) return Promise.resolve(cache.get(path)!);
  if (!pending.has(path)) {
    const pr = (window.vidcut?.peaks(path) ?? Promise.resolve(new Uint8Array(0)))
      .catch(() => new Uint8Array(0))
      .then((p) => { cache.set(path, p); pending.delete(path); return p; });
    pending.set(path, pr);
  }
  return pending.get(path)!;
}

export function usePeaks(path: string | undefined): Uint8Array | undefined {
  const [peaks, setPeaks] = useState<Uint8Array | undefined>(path ? cache.get(path) : undefined);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    if (cache.has(path)) setPeaks(cache.get(path));
    else load(path).then((p) => { if (alive) setPeaks(p); });
    return () => { alive = false; };
  }, [path]);
  return peaks;
}

/** Caminho SVG (viewBox 0 0 N 100) da forma de onda de um excerto da fonte */
export function wavePath(peaks: Uint8Array, fromSec: number, toSec: number, maxPoints: number, mirrored: boolean): { d: string; n: number } {
  const a = Math.max(0, Math.floor(fromSec * PEAKS_PER_SEC));
  const b = Math.min(peaks.length, Math.ceil(toSec * PEAKS_PER_SEC));
  const span = b - a;
  if (span <= 0) return { d: '', n: 1 };
  const n = Math.max(1, Math.min(span, maxPoints));
  const step = span / n;
  const vals: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    const s = a + Math.floor(i * step), e = Math.max(s + 1, a + Math.floor((i + 1) * step));
    for (let j = s; j < e; j++) if (peaks[j] > m) m = peaks[j];
    vals.push(m / 255);
  }
  if (mirrored) {
    const top = vals.map((v, i) => `${i},${50 - v * 48}`).join(' L');
    const bot = vals.map((_, i) => `${n - 1 - i},${50 + vals[n - 1 - i] * 48}`).join(" L");
    return { d: `M0,50 L${top} L${bot} Z`, n };
  }
  const top = vals.map((v, i) => `${i},${100 - v * 96}`).join(' L');
  return { d: `M0,100 L${top} L${n - 1},100 Z`, n };
}
