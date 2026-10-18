// Formatos (proporções) do projeto. Ao mudar de formato mantém-se o lado menor (ex.: 1080),
// para a qualidade não mudar: 16:9 1920×1080 → 9:16 1080×1920.

export interface AspectDef { id: string; label: string; hint: string; rw: number; rh: number }

export const ASPECTS: AspectDef[] = [
  { id: '16:9', label: '16:9', hint: 'YouTube, ecrã', rw: 16, rh: 9 },
  { id: '9:16', label: '9:16', hint: 'Reels, TikTok, Shorts', rw: 9, rh: 16 },
  { id: '1:1', label: '1:1', hint: 'Quadrado', rw: 1, rh: 1 },
  { id: '4:5', label: '4:5', hint: 'Instagram (feed)', rw: 4, rh: 5 },
  { id: '4:3', label: '4:3', hint: 'Clássico', rw: 4, rh: 3 },
  { id: '21:9', label: '21:9', hint: 'Cinema', rw: 21, rh: 9 },
];

export const QUALITIES = [
  { short: 720, label: '720p' }, { short: 1080, label: '1080p' }, { short: 1440, label: '2K' }, { short: 2160, label: '4K' },
];

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Dimensões para uma proporção, com o lado menor dado */
export function sizeFor(a: Pick<AspectDef, 'rw' | 'rh'>, short: number): { w: number; h: number } {
  return a.rw >= a.rh ? { w: even((short * a.rw) / a.rh), h: even(short) } : { w: even(short), h: even((short * a.rh) / a.rw) };
}

/** Proporção conhecida de umas dimensões (ou null se for personalizada) */
export function aspectOf(w: number, h: number): AspectDef | null {
  return ASPECTS.find((a) => Math.abs(w / h - a.rw / a.rh) < 0.01) ?? null;
}

export function aspectLabel(w: number, h: number): string {
  const a = aspectOf(w, h);
  if (a) return a.label;
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
  const d = g(w, h);
  return `${w / d}:${h / d}`;
}
