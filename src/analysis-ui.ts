// Ações que analisam o som/imagem no processo principal: normalizar volume, detetar batidas e cenas.
import { api } from './api';
import type { Project } from '../shared/types';
import { clipSpeed } from '../shared/types';
import { LOUDNESS_TARGET, applyGain, beatSync, clipBeatFrames, findClip, hasSound, normalizedGain, rhythmSource, rhythmTargets, setMediaBeats, sourceTimesToFrames, splitAtFrames, updateClip } from './ops';
import { toDb } from '../shared/volume';

export interface Ctx {
  project: Project;
  commit: (fn: (p: Project) => Project | { project: Project; select?: string[] }, select?: string[]) => void;
  notify: (msg: string, kind?: 'info' | 'error') => void;
}

const busy = new Set<string>();

/** Normaliza o volume dos clips (com som) para −14 LUFS, sem passar de −1 dB de pico */
export async function normalizeClips(ctx: Ctx, ids: string[]) {
  const { project: p } = ctx;
  const targets = ids.filter((id) => hasSound(p, id));
  if (!targets.length) { ctx.notify('Seleciona clips com som (áudio, ou vídeo com som) para normalizar.', 'error'); return; }
  if (busy.has('norm')) return;
  busy.add('norm');
  ctx.notify(targets.length > 1 ? `A medir o volume de ${targets.length} clips…` : 'A medir o volume…');
  const gains = new Map<string, number>();
  const errors: string[] = [];
  try {
    for (const id of targets) {
      const f = findClip(p, id)!;
      const m = p.media.find((x) => x.id === f.clip.mediaId)!;
      const start = f.clip.trimStart / p.fps;
      const dur = (f.clip.duration * clipSpeed(f.clip)) / p.fps;
      const r = await api().loudness(m.path, start, dur);
      if (r.error) { errors.push(`${m.name}: ${r.error}`); continue; }
      gains.set(id, normalizedGain(r.lufs, r.peakDb));
    }
  } finally { busy.delete('norm'); }
  if (!gains.size) { ctx.notify(errors[0] || 'Não foi possível medir o volume.', 'error'); return; }
  ctx.commit((q) => {
    let out = q;
    for (const [id, g] of gains) {
      const f = findClip(out, id);
      if (!f) continue;
      // com keyframes de volume: escala a curva para o ponto mais alto ficar no volume normalizado
      if (f.clip.volKeys?.length) {
        const top = Math.max(...f.clip.volKeys.map((k) => k.v)) || 1;
        out = applyGain(out, id, g / top);
      } else out = updateClip(out, id, { volume: Math.round(g * 1000) / 1000 });
    }
    return out;
  });
  const one = gains.size === 1 ? [...gains.values()][0] : null;
  ctx.notify(one !== null
    ? `Volume normalizado: ${Math.round(one * 100)}% (${toDb(one)}) para ficar a ${LOUDNESS_TARGET} LUFS.`
    : `${gains.size} clips normalizados para ${LOUDNESS_TARGET} LUFS — ficam todos com volume parecido.${errors.length ? ` (${errors.length} falharam)` : ''}`);
}

/** Deteta as batidas do ficheiro do clip e guarda-as na media */
export async function detectBeats(ctx: Ctx, clipId: string): Promise<boolean> {
  const f = findClip(ctx.project, clipId);
  const m = f && ctx.project.media.find((x) => x.id === f.clip.mediaId);
  if (!f || !m || m.kind === 'image') { ctx.notify('Escolhe um clip de música (ou vídeo com música).', 'error'); return false; }
  if (busy.has('beats:' + m.id)) return false;
  busy.add('beats:' + m.id);
  ctx.notify(`A ouvir "${m.name}" para encontrar o ritmo…`);
  try {
    const r = await api().beats(m.path);
    if (r.error || !r.beats?.length) { ctx.notify(r.error || 'Não encontrei um ritmo claro neste som.', 'error'); return false; }
    ctx.commit((p) => setMediaBeats(p, m.id, r.bpm, r.beats));
    ctx.notify(`${Math.round(r.bpm)} BPM · ${r.beats.length} batidas. Já aparecem no clip e o íman encaixa nelas.`);
    return true;
  } finally { busy.delete('beats:' + m.id); }
}

/** Encaixa os clips de vídeo nas batidas (cada `every` batidas) */
export function syncToBeats(ctx: Ctx, selection: string[], every: number) {
  const src = rhythmSource(ctx.project, selection);
  if (!src) { ctx.notify('Primeiro deteta as batidas de uma música (botão direito no clip → Detetar batidas).', 'error'); return; }
  const targets = rhythmTargets(ctx.project, selection, src.id);
  if (!targets.length) { ctx.notify('Não há clips de vídeo ou imagens para encaixar.', 'error'); return; }
  const r = beatSync(ctx.project, src.id, targets.map((c) => c.id), every);
  if (!r.placed) { ctx.notify('Não foi possível encaixar os clips.', 'error'); return; }
  ctx.commit(() => ({ project: r.project, select: r.select }));
  ctx.notify(`${r.placed} clips encaixados no ritmo (${every === 1 ? 'um por batida' : `um a cada ${every} batidas`}).`);
}

/** Divide os clips visuais selecionados nas batidas (cada `every`) */
export function splitOnBeats(ctx: Ctx, selection: string[], every: number) {
  const src = rhythmSource(ctx.project, selection);
  if (!src) { ctx.notify('Primeiro deteta as batidas de uma música.', 'error'); return; }
  const grid = clipBeatFrames(ctx.project, src).filter((_, i) => i % every === 0);
  const ids = selection.filter((id) => { const f = findClip(ctx.project, id); return f && f.clip.id !== src.id && f.track.kind === 'video'; });
  if (!ids.length) { ctx.notify('Seleciona os clips de vídeo a cortar (com a música também, se quiseres escolher qual).', 'error'); return; }
  const r = splitAtFrames(ctx.project, ids, grid);
  if (!r.created.length) { ctx.notify('Não há batidas por baixo dos clips selecionados.', 'error'); return; }
  ctx.commit(() => ({ project: r.project, select: [...ids, ...r.created] }));
  ctx.notify(`Cortado em ${r.created.length + ids.length} partes, nas batidas.`);
}

/** Divide um clip de vídeo nas mudanças de cena */
export async function splitScenes(ctx: Ctx, clipId: string, sensitivity = 0.5) {
  const f = findClip(ctx.project, clipId);
  const m = f && ctx.project.media.find((x) => x.id === f.clip.mediaId);
  if (!f || !m || m.kind !== 'video') { ctx.notify('Escolhe um clip de vídeo.', 'error'); return; }
  if (busy.has('scenes')) return;
  busy.add('scenes');
  ctx.notify(`A procurar mudanças de cena em "${m.name}"…`);
  try {
    const p = ctx.project;
    const r = await api().scenes({ file: m.path, start: f.clip.trimStart / p.fps, dur: (f.clip.duration * clipSpeed(f.clip)) / p.fps, fps: p.fps, sensitivity });
    if (r.error) { ctx.notify(r.error, 'error'); return; }
    const frames = sourceTimesToFrames(p, f.clip, r.cuts);
    if (!frames.length) { ctx.notify('Não encontrei mudanças de cena neste clip.'); return; }
    let created: string[] = [];
    ctx.commit((q) => { const s = splitAtFrames(q, [clipId], frames); created = s.created; return { project: s.project, select: [clipId, ...s.created] }; });
    ctx.notify(`${frames.length} mudanças de cena: o clip ficou dividido em ${frames.length + 1} partes.`);
    return created;
  } finally { busy.delete('scenes'); }
}
