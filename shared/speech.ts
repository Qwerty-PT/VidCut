// Fala e silêncio a partir de um envelope de energia (dB por bloco): cortar silêncios e baixar a música (ducking).

export interface SpeechOpts {
  /** 0 (só silêncio absoluto) … 1 (corta também partes baixas) */
  sensitivity: number;
  /** Pausa mínima a cortar, em segundos */
  minSilence: number;
  /** Margem que fica antes/depois da fala, em segundos */
  pad: number;
}

export const DEFAULT_SPEECH: SpeechOpts = { sensitivity: 0.5, minSilence: 0.5, pad: 0.12 };

const pct = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

/** Limiar (dB) entre silêncio e fala: entre o ruído de fundo e o nível típico da voz */
export function speechThreshold(db: number[], sensitivity: number): number {
  if (!db.length) return -60;
  const floor = pct(db, 0.1), voice = pct(db, 0.9);
  const k = 0.18 + 0.32 * Math.min(1, Math.max(0, sensitivity)); // 18% … 50% do caminho
  return Math.max(floor + 3, floor + (voice - floor) * k);
}

/** Intervalos de silêncio (segundos, relativos ao início do envelope) que se podem cortar */
export function silenceRanges(db: number[], hop: number, o: SpeechOpts): [number, number][] {
  const thr = speechThreshold(db, o.sensitivity);
  const out: [number, number][] = [];
  const total = db.length * hop;
  let i = 0;
  while (i < db.length) {
    if (db[i] >= thr) { i++; continue; }
    let j = i;
    while (j < db.length && db[j] < thr) j++;
    // margem: deixa um bocadinho antes e depois (não come o início/fim das palavras); nas pontas do clip não precisa
    const a = i === 0 ? 0 : i * hop + o.pad;
    const b = j >= db.length ? total : j * hop - o.pad;
    if (b - a >= o.minSilence) out.push([round3(a), round3(b)]);
    i = j;
  }
  return out;
}

/** Intervalos com voz (segundos), com pausas curtas juntas — para o ducking */
export function voiceRanges(db: number[], hop: number, sensitivity = 0.5, joinGap = 0.6): [number, number][] {
  const thr = speechThreshold(db, sensitivity);
  // um envelope sem voz nenhuma (só ruído) fica com o limiar muito perto do ruído: exige 12 dB de contraste
  if (pct(db, 0.9) - pct(db, 0.1) < 12) return [];
  const raw: [number, number][] = [];
  let i = 0;
  while (i < db.length) {
    if (db[i] < thr) { i++; continue; }
    let j = i;
    while (j < db.length && db[j] >= thr) j++;
    raw.push([i * hop, j * hop]);
    i = j;
  }
  const out: [number, number][] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r[0] - last[1] < joinGap) last[1] = r[1];
    else out.push([r[0], r[1]]);
  }
  // ignora estalidos isolados
  return out.filter(([a, b]) => b - a >= 0.15).map(([a, b]) => [round3(a), round3(b)]);
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Junta intervalos sobrepostos (ordenados) */
export function mergeRanges(r: [number, number][], gap = 0): [number, number][] {
  const s = [...r].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1] + gap) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}
