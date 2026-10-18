// Curvas de velocidade (speed ramp): a velocidade muda ao longo do clip.
// A curva define a velocidade em função da posição na FONTE (u = 0..1 do excerto usado);
// o tempo na timeline é o integral de 1/velocidade. Para desenhar, o clip é partido em troços de velocidade constante.
import type { Clip, RampPoint, SpeedRamp } from './types';

export const RAMP_MIN = 0.1;
export const RAMP_MAX = 10;
const M = 256; // amostras da tabela

export const RAMP_PRESETS: { id: string; name: string; hint: string; points: RampPoint[] }[] = [
  { id: 'montagem', name: 'Montagem', hint: 'Acelera, abranda a meio e volta a acelerar', points: [{ u: 0, s: 1 }, { u: 0.2, s: 3 }, { u: 0.5, s: 0.5 }, { u: 0.8, s: 3 }, { u: 1, s: 1 }] },
  { id: 'heroi', name: 'Herói', hint: 'Câmara lenta no momento principal', points: [{ u: 0, s: 1.5 }, { u: 0.35, s: 1.5 }, { u: 0.5, s: 0.25 }, { u: 0.65, s: 1.5 }, { u: 1, s: 1.5 }] },
  { id: 'bala', name: 'Bala', hint: 'Muito rápido, quase parado a meio, muito rápido', points: [{ u: 0, s: 3 }, { u: 0.4, s: 3 }, { u: 0.5, s: 0.12 }, { u: 0.6, s: 3 }, { u: 1, s: 3 }] },
  { id: 'salto', name: 'Salto', hint: 'Lento e depois dispara', points: [{ u: 0, s: 0.5 }, { u: 0.45, s: 0.5 }, { u: 0.55, s: 4 }, { u: 1, s: 4 }] },
  { id: 'entrada', name: 'Entrada rápida', hint: 'Começa muito rápido e assenta na velocidade normal', points: [{ u: 0, s: 6 }, { u: 0.35, s: 1 }, { u: 1, s: 1 }] },
  { id: 'saida', name: 'Saída rápida', hint: 'Normal e acelera no fim', points: [{ u: 0, s: 1 }, { u: 0.65, s: 1 }, { u: 1, s: 6 }] },
  { id: 'lento-fim', name: 'Abrandar no fim', hint: 'Termina em câmara lenta', points: [{ u: 0, s: 1 }, { u: 0.55, s: 1 }, { u: 1, s: 0.3 }] },
];

const clampS = (s: number) => Math.min(RAMP_MAX, Math.max(RAMP_MIN, s));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Velocidade na posição u (interpolação suave em escala logarítmica entre pontos) */
export function speedAtU(points: RampPoint[], u: number): number {
  if (!points.length) return 1;
  if (u <= points[0].u) return clampS(points[0].s);
  const last = points[points.length - 1];
  if (u >= last.u) return clampS(last.s);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (u >= a.u && u <= b.u) {
      const t = b.u > a.u ? smooth((u - a.u) / (b.u - a.u)) : 1;
      return clampS(Math.exp(Math.log(clampS(a.s)) + (Math.log(clampS(b.s)) - Math.log(clampS(a.s))) * t));
    }
  }
  return clampS(last.s);
}

const tables = new WeakMap<SpeedRamp, Float64Array>();
/** Tempo acumulado (frames de timeline, sem normalizar) em cada uma das M+1 amostras de u */
function table(r: SpeedRamp): Float64Array {
  let t = tables.get(r);
  if (t) return t;
  t = new Float64Array(M + 1);
  const du = 1 / M;
  for (let i = 1; i <= M; i++) t[i] = t[i - 1] + (r.src * du) / speedAtU(r.points, (i - 0.5) * du);
  tables.set(r, t);
  return t;
}

/** Duração natural na timeline (frames) */
export const rampDuration = (r: SpeedRamp) => Math.max(1, Math.round(table(r)[M]));

/** Posição u (0..1) mostrada no frame `rel` de um clip com `duration` frames (normaliza arredondamentos) */
export function uAtRel(r: SpeedRamp, duration: number, rel: number): number {
  const t = table(r);
  const target = (Math.min(duration, Math.max(0, rel)) / Math.max(1, duration)) * t[M];
  let lo = 0, hi = M;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= target) lo = mid; else hi = mid; }
  const span = t[hi] - t[lo];
  return (lo + (span > 0 ? (target - t[lo]) / span : 0)) / M;
}

/** Frame da timeline (relativo) onde aparece a posição u */
export function relAtU(r: SpeedRamp, duration: number, u: number): number {
  const t = table(r);
  const x = Math.min(1, Math.max(0, u)) * M;
  const i = Math.min(M - 1, Math.floor(x));
  return ((t[i] + (t[i + 1] - t[i]) * (x - i)) / t[M]) * duration;
}

/** Frames da fonte (desde trimStart) mostrados no frame relativo `rel` */
export const srcAtRel = (r: SpeedRamp, duration: number, rel: number) => uAtRel(r, duration, rel) * r.src;

export interface RampSegment { from: number; dur: number; srcStart: number; rate: number }

/** Troços de velocidade (quase) constante, para o leitor de vídeo */
export function rampSegments(r: SpeedRamp, duration: number): RampSegment[] {
  const segs: RampSegment[] = [];
  let a = 0;
  while (a < duration) {
    const s0 = speedAtU(r.points, uAtRel(r, duration, a));
    let b = a + 1;
    while (b < duration && b - a < 24) {
      const s = speedAtU(r.points, uAtRel(r, duration, b));
      if (Math.abs(Math.log(s / s0)) > 0.12) break;
      b++;
    }
    const src0 = srcAtRel(r, duration, a), src1 = srcAtRel(r, duration, b);
    segs.push({ from: a, dur: b - a, srcStart: src0, rate: Math.max(0.05, (src1 - src0) / (b - a)) });
    a = b;
  }
  return segs;
}

/** Parte da curva entre u0 e u1 (renormalizada), com o excerto da fonte correspondente */
export function subRamp(r: SpeedRamp, u0: number, u1: number): SpeedRamp {
  const span = Math.max(1e-6, u1 - u0);
  const inner = r.points.filter((p) => p.u > u0 && p.u < u1).map((p) => ({ u: (p.u - u0) / span, s: p.s }));
  return {
    preset: r.preset,
    src: Math.max(1, Math.round(r.src * span)),
    points: [{ u: 0, s: speedAtU(r.points, u0) }, ...inner, { u: 1, s: speedAtU(r.points, u1) }],
  };
}

export function presetRamp(id: string, src: number): SpeedRamp {
  const pr = RAMP_PRESETS.find((x) => x.id === id) ?? RAMP_PRESETS[0];
  return { preset: pr.id, src: Math.max(1, Math.round(src)), points: pr.points.map((p) => ({ ...p })) };
}

/** Frames da fonte que o clip usa (com ou sem curva) */
export const clipSourceSpan = (c: Clip) => (c.speedRamp ? c.speedRamp.src : c.duration * (c.speed ?? 1));

/** Frame relativo do clip onde aparece o frame da fonte `srcFrame` (absoluto); null se fora */
export function relForSource(c: Clip, srcFrame: number): number | null {
  const off = srcFrame - c.trimStart;
  if (off < 0 || off > clipSourceSpan(c)) return null;
  if (c.speedRamp) return relAtU(c.speedRamp, c.duration, off / c.speedRamp.src);
  return off / (c.speed ?? 1);
}
