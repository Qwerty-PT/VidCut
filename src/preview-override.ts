// Pré-visualização temporária no ecrã principal (fora do histórico):
// mostra uma cópia do projeto com uma alteração (transição, modelo, animação) e repete um intervalo.
import { useSyncExternalStore } from 'react';
import type { Project } from '../shared/types';

export interface PreviewOverride {
  /** Projeto a mostrar (com a alteração aplicada) */
  project: Project;
  /** Projeto real quando a pré-visualização começou — se mudar, a pré-visualização termina */
  base: Project;
  from: number;
  to: number;
  label: string;
  /** Chave de quem pediu (para não reiniciar se for o mesmo) */
  key: string;
  /** Pedida por clique: só termina com Esc, clique fora ou edição (não ao tirar o rato) */
  sticky?: boolean;
}

let current: PreviewOverride | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function setPreview(o: PreviewOverride) {
  if (current && current.key === o.key && current.project === o.project) return;
  current = o; emit();
}
export function clearPreview(key?: string) {
  if (!current || (key && current.key !== key)) return;
  current = null; emit();
}
/** Termina só uma pré-visualização de "passar o rato" (não a pedida por clique) */
export function clearHoverPreview(key: string) {
  if (current && current.key === key && !current.sticky) { current = null; emit(); }
}
export const getPreview = () => current;
export const usePreviewOverride = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current);

/** Agenda uma pré-visualização ao passar o rato (evita piscar ao atravessar grelhas) */
let timer: ReturnType<typeof setTimeout> | null = null;
export function hoverPreview(build: () => PreviewOverride | null, delay = 260) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; const o = build(); if (o) setPreview(o); }, delay);
}
export function cancelHover() { if (timer) { clearTimeout(timer); timer = null; } }

// ---------- construtores ----------
import { addLottieClip, addTemplateClip, setTransition, findClip } from './ops';
import { getTemplate } from '../shared/templates';
import { maxTransition, prevAdjacent, splitDuration } from '../shared/transitions';
import { projectDuration, type LottieAsset, type Transition } from '../shared/types';

/** Transição aplicada entre os dois clips, a repetir à volta do corte (+0,5 s de cada lado) */
export function transitionPreview(p: Project, clipId: string, tr: Transition, label: string, base: Project = p): PreviewOverride | null {
  const f = findClip(p, clipId);
  const prev = f ? prevAdjacent(f.track, f.clip) : undefined;
  if (!f || !prev) return null;
  const next = setTransition(p, clipId, tr);
  const d = Math.min(tr.duration, maxTransition(prev, f.clip));
  const { pre, post } = splitDuration(d);
  const pad = Math.round(p.fps * 0.5);
  const cut = f.clip.start;
  return { project: next, base, from: Math.max(0, cut - pre - pad), to: Math.min(projectDuration(next) - 1, cut + post + pad), label, key: `tr:${clipId}` };
}

/** Modelo numa pista temporária no topo, a partir da cabeça de leitura */
export function templatePreview(p: Project, templateId: string, at: number): PreviewOverride | null {
  const r = addTemplateClip(p, templateId, at, { newTrack: true });
  const c = r.clipId ? findClip(r.project, r.clipId)?.clip : undefined;
  if (!c) return null;
  return { project: r.project, base: p, from: c.start, to: c.start + c.duration - 1, label: `${getTemplate(templateId)?.name ?? 'Modelo'} — duplo clique para adicionar`, key: `tpl:${templateId}` };
}

/** Animação Lottie numa pista temporária no topo, a partir da cabeça de leitura */
export function lottiePreview(p: Project, asset: LottieAsset, at: number): PreviewOverride | null {
  const r = addLottieClip(p, asset, at, { newTrack: true });
  const c = r.clipId ? findClip(r.project, r.clipId)?.clip : undefined;
  if (!c) return null;
  return { project: r.project, base: p, from: c.start, to: c.start + c.duration - 1, label: `${asset.name} — duplo clique para adicionar`, key: `lot:${asset.id}` };
}
