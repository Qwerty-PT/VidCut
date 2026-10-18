// Legendas: agrupar palavras em frases curtas, criar clips de texto, retemporizar ao editar, SRT.
import type { CaptionData, CaptionStyle, CaptionWord, Clip, TextContent } from './types';

export interface TimedWord { text: string; startMs: number; endMs: number }
export interface CaptionPage { words: TimedWord[]; startMs: number; endMs: number }

export const CAPTION_STYLES: { style: CaptionStyle; label: string; hint: string }[] = [
  { style: 'classic', label: 'Clássico', hint: 'Frase inteira em baixo, com fundo' },
  { style: 'karaoke', label: 'Karaoke', hint: 'A palavra dita fica colorida' },
  { style: 'box', label: 'Caixa', hint: 'A palavra atual ganha uma caixa de cor (estilo Reels/TikTok)' },
  { style: 'pop', label: 'Palavra', hint: 'Uma palavra de cada vez, grande e ao centro' },
];

export const DEFAULT_HIGHLIGHT = '#F2B33D';

/** Agrupa palavras em "páginas" legíveis: até ~7 palavras / 38 caracteres, quebra em pausas e pontuação */
export function groupIntoPages(words: TimedWord[], opts: { maxWords?: number; maxChars?: number; maxGapMs?: number; maxMs?: number } = {}): CaptionPage[] {
  const maxWords = opts.maxWords ?? 7, maxChars = opts.maxChars ?? 38, maxGap = opts.maxGapMs ?? 700, maxMs = opts.maxMs ?? 3500;
  const pages: CaptionPage[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length) pages.push({ words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs });
    cur = [];
  };
  for (const w0 of words) {
    const text = w0.text.trim();
    if (!text) continue;
    const w = { ...w0, text };
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const chars = cur.map((x) => x.text).join(' ').length + 1 + text.length;
      if (cur.length >= maxWords || chars > maxChars || w.startMs - prev.endMs > maxGap || w.endMs - cur[0].startMs > maxMs || /[.!?…]$/.test(prev.text)) flush();
    }
    cur.push(w);
  }
  flush();
  return pages;
}

export function captionText(style: CaptionStyle): TextContent {
  return {
    text: '', font: 'sans', size: style === 'pop' ? 96 : 60, weight: 700, color: '#ffffff', align: 'center',
    x: 50, y: style === 'pop' ? 72 : 84, maxWidth: 76,
    background: style === 'classic' ? '#000000' : null, bgOpacity: 0.55, shadow: true,
  };
}

/** Converte páginas (ms no excerto transcrito) em clips de texto na timeline */
export function pagesToClips(
  pages: CaptionPage[],
  o: { fps: number; startFrame: number; speed?: number; style: CaptionStyle; highlight?: string; idPrefix?: string; endFrame?: number },
): Clip[] {
  const sp = o.speed ?? 1;
  const toFrame = (ms: number) => o.startFrame + Math.round(((ms / 1000) * o.fps) / sp);
  const clips: Clip[] = [];
  pages.forEach((pg, i) => {
    const start = Math.max(i ? clips[clips.length - 1].start + clips[clips.length - 1].duration : 0, toFrame(pg.startMs));
    const next = pages[i + 1] ? toFrame(pages[i + 1].startMs) : Infinity;
    // fica no ecrã até à frase seguinte (no máx. +0,6 s depois da última palavra)
    let end = Math.min(next, toFrame(pg.endMs) + Math.round(o.fps * 0.6));
    if (o.endFrame !== undefined) end = Math.min(end, o.endFrame);
    if (end - start < 2) end = start + 2;
    const words: CaptionWord[] = pg.words.map((w) => ({ t: w.text, s: Math.max(0, toFrame(w.startMs) - start), e: Math.max(1, toFrame(w.endMs) - start) }));
    const text = { ...captionText(o.style), text: pg.words.map((w) => w.text).join(' ') };
    clips.push({
      id: `${o.idPrefix ?? 'cap'}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      mediaId: '', start, duration: end - start, trimStart: 0, volume: 1, fadeIn: 0, fadeOut: 0, text,
      caption: { words, style: o.style, highlight: o.highlight ?? DEFAULT_HIGHLIGHT },
      ...(o.style === 'classic' ? { animIn: { preset: 'fade' as const, duration: Math.min(5, end - start), style: 'productive' as const } } : {}),
    });
  });
  return clips;
}

/** Ao editar o texto de uma legenda: mantém os tempos se o nº de palavras for igual; senão distribui pelo clip */
export function retimeWords(cap: CaptionData, newText: string, duration: number): CaptionData {
  const toks = newText.split(/\s+/).filter(Boolean);
  if (toks.length === cap.words.length) return { ...cap, words: cap.words.map((w, i) => ({ ...w, t: toks[i] })) };
  const total = toks.reduce((a, t) => a + t.length + 1, 0) || 1;
  let acc = 0;
  const words = toks.map((t) => {
    const s = Math.round((acc / total) * duration);
    acc += t.length + 1;
    return { t, s, e: Math.max(s + 1, Math.round((acc / total) * duration)) };
  });
  return { ...cap, words };
}

/** Índice da palavra a ser dita no frame (relativo ao clip); -1 antes da primeira */
export function activeWord(words: CaptionWord[], f: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i++) if (f >= words[i].s) idx = i;
  return idx;
}

// ---------- SRT ----------
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function srtTime(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)},${pad(t % 1000, 3)}`;
}

export function toSrt(clips: Clip[], fps: number): string {
  return clips
    .filter((c) => c.text && c.text.text.trim())
    .sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${srtTime((c.start / fps) * 1000)} --> ${srtTime(((c.start + c.duration) / fps) * 1000)}\n${c.text!.text.trim()}\n`)
    .join('\n');
}

export function parseSrt(src: string): { startMs: number; endMs: number; text: string }[] {
  const out: { startMs: number; endMs: number; text: string }[] = [];
  const toMs = (s: string) => {
    const m = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/.exec(s);
    return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4].padEnd(3, '0') : NaN;
  };
  for (const block of src.replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    const startMs = toMs(a), endMs = toMs(b);
    const text = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && text) out.push({ startMs, endMs, text });
  }
  return out;
}

/** Legendas importadas de SRT: cada bloco vira uma página, palavras distribuídas pelo tempo */
export function srtToPages(items: { startMs: number; endMs: number; text: string }[]): CaptionPage[] {
  return items.map((it) => {
    const toks = it.text.split(/\s+/).filter(Boolean);
    const total = toks.reduce((a, t) => a + t.length + 1, 0) || 1;
    let acc = 0;
    const words = toks.map((t) => {
      const s = it.startMs + (acc / total) * (it.endMs - it.startMs);
      acc += t.length + 1;
      return { text: t, startMs: Math.round(s), endMs: Math.round(it.startMs + (acc / total) * (it.endMs - it.startMs)) };
    });
    return { words, startMs: it.startMs, endMs: it.endMs };
  });
}

/** Parte de uma legenda entre os frames [from, to) do clip original (para dividir/aparar) */
export function sliceCaption(clip: Clip, from: number, to: number): Partial<Clip> {
  if (!clip.caption || !clip.text) return {};
  const words = clip.caption.words
    .filter((w) => w.e > from && w.s < to)
    .map((w) => ({ ...w, s: Math.max(0, w.s - from), e: Math.max(1, w.e - from) }));
  if (!words.length) return { caption: { ...clip.caption, words: [] } };
  return { caption: { ...clip.caption, words }, text: { ...clip.text, text: words.map((w) => w.t).join(' ') } };
}
