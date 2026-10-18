// Utilitários para animações Lottie (JSON do bodymovin).
import type { Clip, LottieAsset, MediaItem, Project } from './types';

export interface LottieInfo { w: number; h: number; fr: number; frames: number; durationSec: number }

/** É um JSON Lottie válido (o mínimo para o lottie-web o abrir)? */
export function isLottieJson(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.w === 'number' && typeof o.h === 'number' && typeof o.fr === 'number'
    && typeof o.ip === 'number' && typeof o.op === 'number' && Array.isArray(o.layers);
}

export function lottieInfo(data: Record<string, unknown>): LottieInfo {
  const w = Number(data.w) || 512, h = Number(data.h) || 512, fr = Number(data.fr) || 30;
  const frames = Math.max(1, Number(data.op) - Number(data.ip) || 1);
  return { w, h, fr, frames, durationSec: frames / fr };
}

/** Asset Lottie usado por um clip (ou undefined se estiver em falta) */
export function clipLottie(p: Project, clip: Clip): LottieAsset | undefined {
  return clip.lottie ? p.lotties?.[clip.lottie.assetId] : undefined;
}

/** Os Lotties comportam-se como uma imagem do seu tamanho (enquadrar, cor, keyframes) */
export function lottieMedia(asset: LottieAsset | undefined, name = 'Animação'): MediaItem {
  const i = asset ? lottieInfo(asset.data) : { w: 512, h: 512 };
  return { id: '', path: '', name: asset?.name ?? name, kind: 'image', durationSec: 0, width: i.w, height: i.h };
}

/** Remove do projeto as animações que já nenhum clip usa */
export function pruneLotties(p: Project): Project {
  if (!p.lotties) return p;
  const used = new Set<string>();
  for (const t of p.tracks) for (const c of t.clips) if (c.lottie) used.add(c.lottie.assetId);
  const keys = Object.keys(p.lotties);
  if (keys.every((k) => used.has(k))) return p;
  const lotties: Record<string, LottieAsset> = {};
  for (const k of keys) if (used.has(k)) lotties[k] = p.lotties[k];
  return { ...p, lotties };
}
