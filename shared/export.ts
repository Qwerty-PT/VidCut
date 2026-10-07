// Opções de exportação: o que o utilizador escolhe e a tradução para o @remotion/renderer.
import type { Project } from './types';
import { projectDuration } from './types';

export type ExportFormat = 'mp4' | 'hevc' | 'webm' | 'prores' | 'gif' | 'mp3' | 'wav';
export type ExportQuality = 'alta' | 'media' | 'leve';
export type ExportRange = 'all' | 'selection' | 'custom';

export interface ExportOptions {
  format: ExportFormat;
  /** Lado menor em px (0 = resolução do projeto) */
  resolution: number;
  quality: ExportQuality;
  /** 0 = fps do projeto */
  fps: number;
  audio: boolean;
  range: ExportRange;
  /** Intervalo personalizado, em segundos */
  fromSec: number;
  toSec: number;
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: 'mp4', resolution: 0, quality: 'alta', fps: 0, audio: true, range: 'all', fromSec: 0, toSec: 0,
};

export interface FormatInfo {
  label: string;
  hint: string;
  ext: string;
  filter: string;
  video: boolean;
  audioOnly?: boolean;
  hasQuality: boolean;
}

export const FORMATS: Record<ExportFormat, FormatInfo> = {
  mp4: { label: 'MP4', hint: 'H.264 — funciona em todo o lado', ext: 'mp4', filter: 'Vídeo MP4', video: true, hasQuality: true },
  hevc: { label: 'HEVC', hint: 'H.265 — ficheiros ~40% mais leves', ext: 'mp4', filter: 'Vídeo MP4 (HEVC)', video: true, hasQuality: true },
  webm: { label: 'WebM', hint: 'VP9 — para a web', ext: 'webm', filter: 'Vídeo WebM', video: true, hasQuality: true },
  prores: { label: 'ProRes', hint: 'ProRes 422 HQ — para outro editor, ficheiros grandes', ext: 'mov', filter: 'QuickTime ProRes', video: true, hasQuality: false },
  gif: { label: 'GIF', hint: 'Animação sem som, em loop', ext: 'gif', filter: 'GIF animado', video: true, hasQuality: true },
  mp3: { label: 'MP3', hint: 'Só o áudio', ext: 'mp3', filter: 'Áudio MP3', video: false, audioOnly: true, hasQuality: true },
  wav: { label: 'WAV', hint: 'Só o áudio, sem compressão', ext: 'wav', filter: 'Áudio WAV', video: false, audioOnly: true, hasQuality: false },
};

/** Especificação final enviada ao processo principal */
export interface RenderSpec {
  codec: 'h264' | 'h265' | 'vp9' | 'prores' | 'gif' | 'mp3' | 'wav';
  crf: number | null;
  audioBitrate: string | null;
  scale: number;
  frameRange: [number, number] | null;
  everyNthFrame: number;
  muted: boolean;
  ext: string;
  filter: string;
}

const CRF: Record<'h264' | 'h265' | 'vp9', Record<ExportQuality, number>> = {
  h264: { alta: 17, media: 22, leve: 27 },
  h265: { alta: 20, media: 25, leve: 30 },
  vp9: { alta: 24, media: 32, leve: 40 },
};
const AUDIO_KBPS: Record<ExportQuality, number> = { alta: 320, media: 192, leve: 128 };
/** fps alvo do GIF por qualidade */
const GIF_FPS: Record<ExportQuality, number> = { alta: 25, media: 15, leve: 10 };

const CODEC: Record<ExportFormat, RenderSpec['codec']> = {
  mp4: 'h264', hevc: 'h265', webm: 'vp9', prores: 'prores', gif: 'gif', mp3: 'mp3', wav: 'wav',
};

/** Dimensões finais (pares, como exige o H.264) para uma resolução escolhida */
export function outputSize(p: Project, resolution: number, even = true): { width: number; height: number; scale: number } {
  const short = Math.min(p.width, p.height);
  if (!resolution || resolution === short) return { width: p.width, height: p.height, scale: 1 };
  const scale = resolution / short;
  const fit = (n: number) => (even ? Math.max(2, Math.round(n / 2) * 2) : Math.max(1, Math.round(n)));
  return { width: fit(p.width * scale), height: fit(p.height * scale), scale };
}

/** Resoluções a oferecer para este projeto (lado menor) */
export function resolutionChoices(p: Project): { value: number; label: string }[] {
  const short = Math.min(p.width, p.height);
  const opts = [2160, 1440, 1080, 720, 480].filter((r) => r !== short);
  const name = (r: number) => (r === 2160 ? '4K' : r === 1440 ? '2K' : `${r}p`);
  return [
    { value: 0, label: `Projeto (${p.width}×${p.height})` },
    ...opts.map((r) => ({ value: r, label: name(r) })),
  ];
}

export function exportFps(p: Project, o: ExportOptions): number {
  return o.fps > 0 && o.format !== 'gif' && FORMATS[o.format].video ? o.fps : p.fps;
}

/** Intervalo em frames do projeto (inclusivo) ou null = tudo */
export function rangeFrames(p: Project, o: ExportOptions, selectionRange: [number, number] | null): [number, number] | null {
  const total = projectDuration(p);
  if (o.range === 'selection' && selectionRange) {
    const [a, b] = selectionRange;
    return [Math.max(0, a), Math.min(total - 1, Math.max(a, b - 1))];
  }
  if (o.range === 'custom') {
    const a = Math.max(0, Math.round(o.fromSec * p.fps));
    const b = Math.min(total, Math.round(o.toSec * p.fps));
    if (b - a < 1) return null;
    return [a, b - 1];
  }
  return null;
}

/**
 * Constrói a especificação de render.
 * `range` vem em frames do projeto já convertido para o fps final.
 */
export function buildSpec(p: Project, o: ExportOptions, range: [number, number] | null): RenderSpec {
  const f = FORMATS[o.format];
  const codec = CODEC[o.format];
  const crf = codec === 'h264' || codec === 'h265' || codec === 'vp9' ? CRF[codec][o.quality] : null;
  const audioBitrate = codec === 'wav' || codec === 'gif' || codec === 'prores' ? null : `${AUDIO_KBPS[o.quality]}k`;
  const scale = f.video ? outputSize(p, o.resolution).scale : 1;
  const everyNthFrame = codec === 'gif' ? Math.max(1, Math.round(p.fps / GIF_FPS[o.quality])) : 1;
  return {
    codec, crf, audioBitrate, scale, frameRange: range, everyNthFrame,
    muted: f.audioOnly ? false : codec === 'gif' ? true : !o.audio,
    ext: f.ext, filter: f.filter,
  };
}

/** Estimativa grosseira do tamanho (bytes); null quando não dá para prever */
export function estimateBytes(p: Project, o: ExportOptions, frames: number): number | null {
  const fps = exportFps(p, o);
  const sec = frames / fps;
  const f = FORMATS[o.format];
  const audioKbps = f.audioOnly
    ? (o.format === 'wav' ? 1536 : AUDIO_KBPS[o.quality])
    : (o.audio && o.format !== 'gif' ? (o.format === 'prores' ? 1536 : AUDIO_KBPS[o.quality]) : 0);
  if (o.format === 'gif') return null;
  let videoKbps = 0;
  if (f.video) {
    const { width, height } = outputSize(p, o.resolution);
    const k = (width * height * fps) / (1920 * 1080 * 30); // relativo a 1080p30
    const base: Record<string, Record<ExportQuality, number>> = {
      mp4: { alta: 14000, media: 7000, leve: 3500 },
      hevc: { alta: 8000, media: 4000, leve: 2000 },
      webm: { alta: 9000, media: 4500, leve: 2200 },
      prores: { alta: 176000, media: 176000, leve: 176000 },
    };
    videoKbps = base[o.format][o.quality] * Math.pow(k, 0.85);
  }
  return ((videoKbps + audioKbps) * 1000 / 8) * sec;
}

/** fps real do GIF (Remotion salta fotogramas com everyNthFrame) */
export function gifFps(p: Project, q: ExportQuality): number {
  return p.fps / Math.max(1, Math.round(p.fps / GIF_FPS[q]));
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
