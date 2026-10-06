// Leitura de metadados (duração, dimensões) e miniaturas dos ficheiros importados.
import type { MediaItem } from '../shared/types';
import { mediaUrl } from '../shared/types';
import { fileName, kindFromPath, uid } from './util';

const thumbs = new Map<string, string>(); // path → dataURL
const listeners = new Set<() => void>();

export const getThumb = (path: string) => thumbs.get(path);
export function onThumbsChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function setThumb(path: string, url: string) { thumbs.set(path, url); listeners.forEach((l) => l()); }

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Tempo esgotado a ler ${what}`)), ms))]);
}

function drawThumb(source: CanvasImageSource, w: number, h: number): string {
  const W = 192, H = 108;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const k = Math.min(W / w, H / h);
  ctx.drawImage(source, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k);
  try { return c.toDataURL('image/jpeg', 0.7); } catch { return ''; }
}

function probeVideo(url: string, path: string): Promise<Partial<MediaItem>> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    v.muted = true;
    v.onloadedmetadata = () => {
      const info = { durationSec: v.duration, width: v.videoWidth, height: v.videoHeight };
      resolve(info);
      v.currentTime = Math.min(0.5, v.duration / 2);
    };
    v.onseeked = () => {
      const t = drawThumb(v, v.videoWidth || 16, v.videoHeight || 9);
      if (t) setThumb(path, t);
      v.removeAttribute('src');
      v.load();
    };
    v.onerror = () => reject(new Error('Formato de vídeo não suportado'));
    v.src = url;
  });
}

function probeAudio(url: string): Promise<Partial<MediaItem>> {
  return new Promise((resolve, reject) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve({ durationSec: a.duration });
    a.onerror = () => reject(new Error('Formato de áudio não suportado'));
    a.src = url;
  });
}

function probeImage(url: string, path: string): Promise<Partial<MediaItem>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const t = drawThumb(img, img.naturalWidth, img.naturalHeight);
      if (t) setThumb(path, t);
      resolve({ durationSec: 0, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = url;
  });
}

export async function probeMedia(path: string, mediaBase: string): Promise<MediaItem> {
  const kind = kindFromPath(path);
  if (!kind) throw new Error(`Tipo de ficheiro não suportado: ${fileName(path)}`);
  const url = mediaUrl(mediaBase, path);
  const info =
    kind === 'video' ? await withTimeout(probeVideo(url, path), 20000, fileName(path))
    : kind === 'audio' ? await withTimeout(probeAudio(url), 20000, fileName(path))
    : await withTimeout(probeImage(url, path), 20000, fileName(path));
  if (kind !== 'image' && !(info.durationSec && Number.isFinite(info.durationSec))) {
    throw new Error(`Não foi possível ler a duração de ${fileName(path)}`);
  }
  return { id: uid('m'), path, name: fileName(path), kind, durationSec: 0, ...info };
}

/** Recria miniaturas de um projeto aberto (não são guardadas no ficheiro) */
export function refreshThumbs(items: MediaItem[], mediaBase: string) {
  for (const m of items) {
    if (thumbs.has(m.path) || m.kind === 'audio') continue;
    const url = mediaUrl(mediaBase, m.path);
    (m.kind === 'video' ? probeVideo(url, m.path) : probeImage(url, m.path)).catch(() => {});
  }
}
