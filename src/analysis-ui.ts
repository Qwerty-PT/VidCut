// Ações que analisam o som/imagem no processo principal: normalizar volume, detetar batidas e cenas.
import { api } from './api';
import type { Project } from '../shared/types';
import { clipSpeed } from '../shared/types';
import { LOUDNESS_TARGET, applyGain, beatSync,  clipBeatFrames, findClip, hasSound, normalizedGain, rhythmSource, rhythmTargets, setMediaBeats, sourceTimesToFrames, splitAtFrames, updateClip } from './ops';
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

// ---------------------------------------------------------------------------
// Silêncios, ruído e ducking
// ---------------------------------------------------------------------------
import { mergeRanges, silenceRanges, voiceRanges, type SpeechOpts } from '../shared/speech';
import { clipSourceSpan, relForSource } from '../shared/speedramp';
import { addMedia, detachAudio, duckClip, removeRanges } from './ops';
import { probeMedia } from './media';
import type { Clip } from '../shared/types';

const envCache = new Map<string, { hop: number; db: number[] }>();
/** Envelope de energia do excerto usado pelo clip (em cache) */
export async function clipEnvelope(p: Project, clip: Clip): Promise<{ hop: number; db: number[] } | { error: string }> {
  const m = p.media.find((x) => x.id === clip.mediaId);
  if (!m) return { error: 'Ficheiro em falta.' };
  const start = clip.trimStart / p.fps, dur = clipSourceSpan(clip) / p.fps;
  const key = `${m.path}|${start.toFixed(3)}|${dur.toFixed(3)}`;
  const hit = envCache.get(key);
  if (hit) return hit;
  const r = await api().envelope(m.path, start, dur);
  if (r.error) return { error: r.error };
  envCache.set(key, r);
  return r;
}

/** Segundos (relativos ao início do excerto) → frames da timeline do clip */
function toTimeline(p: Project, clip: Clip, ranges: [number, number][]): [number, number][] {
  return ranges.map(([a, b]) => {
    const ra = relForSource(clip, clip.trimStart + a * p.fps) ?? 0;
    const rb = relForSource(clip, clip.trimStart + b * p.fps) ?? clip.duration;
    return [Math.round(clip.start + ra), Math.round(clip.start + rb)] as [number, number];
  }).filter(([a, b]) => b > a);
}

export function silenceFrames(p: Project, clip: Clip, env: { hop: number; db: number[] }, o: SpeechOpts): [number, number][] {
  return toTimeline(p, clip, silenceRanges(env.db, env.hop, o));
}

export function applySilenceCut(ctx: Ctx, clipId: string, ranges: [number, number][]) {
  const r = removeRanges(ctx.project, clipId, ranges);
  if (!r.removed) { ctx.notify('Não havia pausas para cortar.'); return; }
  ctx.commit(() => ({ project: r.project, select: r.select }));
  ctx.notify(`${ranges.length} pausas cortadas: o clip ficou ${(r.removed / ctx.project.fps).toFixed(1).replace('.', ',')} s mais curto.`);
}

/** Redução de ruído: gera um WAV limpo e põe-no no lugar do som do clip (separa o som de um vídeo primeiro) */
export async function denoiseClip(ctx: Ctx & { mediaBase: string }, clipId: string, strength: number) {
  let p = ctx.project;
  let f = findClip(p, clipId);
  if (!f || !hasSound(p, clipId)) { ctx.notify('Escolhe um clip com som.', 'error'); return; }
  const m = p.media.find((x) => x.id === f!.clip.mediaId)!;
  const srcPath = m.denoisedFrom ?? m.path;
  if (busy.has('dn')) return;
  busy.add('dn');
  ctx.notify(`A limpar o ruído de "${m.name}"… (pode demorar uns segundos)`);
  try {
    const r = await api().denoise(srcPath, strength);
    if (!r.path) { ctx.notify(r.error || 'Não foi possível reduzir o ruído.', 'error'); return; }
    let item = await probeMedia(r.path, ctx.mediaBase);
    const orig = p.media.find((x) => x.path === srcPath);
    item = { ...item, name: `${(orig?.name ?? m.name).replace(/ \(sem ruído\)$/, '')} (sem ruído)`, denoisedFrom: srcPath };
    const path = r.path;
    let target = clipId;
    ctx.commit((q) => {
      let out = addMedia(q, [item]);
      const nm = out.media.find((x) => x.path === path)!;
      const fc = findClip(out, clipId);
      if (!fc) return out;
      if (fc.track.kind === 'video') {
        // vídeo: o som limpo vai para uma pista de áudio (a imagem fica igual)
        const d = detachAudio(out, clipId);
        out = d.project;
        if (!d.clipId) return out;
        target = d.clipId;
      }
      // todos os pedaços deste som nas pistas de áudio (ex.: depois de cortar silêncios) ficam limpos
      const same = out.tracks.filter((t) => t.kind === 'audio').flatMap((t) => t.clips).filter((x) => x.mediaId === fc.clip.mediaId || x.id === target).map((x) => x.id);
      for (const id of new Set([target, ...same])) out = updateClip(out, id, { mediaId: nm.id });
      return { project: out, select: [target] };
    });
    ctx.notify(f.track.kind === 'video' ? 'Ruído reduzido. O som limpo ficou numa pista de áudio, ligado ao vídeo.' : 'Ruído reduzido. "Repor original" volta ao som de antes.');
  } catch (e) { ctx.notify(String((e as Error).message || e), 'error'); }
  finally { busy.delete('dn'); }
}

/** Volta ao som original de um clip limpo pela redução de ruído */
export function restoreOriginalSound(ctx: Ctx, clipId: string) {
  const f = findClip(ctx.project, clipId);
  const m = f && ctx.project.media.find((x) => x.id === f.clip.mediaId);
  const orig = m?.denoisedFrom && ctx.project.media.find((x) => x.path === m.denoisedFrom);
  if (!f || !orig) return;
  ctx.commit((q) => {
    let out = q;
    const ids = q.tracks.filter((t) => t.kind === 'audio').flatMap((t) => t.clips).filter((x) => x.mediaId === f.clip.mediaId).map((x) => x.id);
    for (const id of new Set([clipId, ...ids])) out = updateClip(out, id, { mediaId: orig.id });
    return out;
  });
  ctx.notify('Som original reposto.');
}

/** Ducking: baixa a música (clips indicados) quando há voz nos outros clips com som */
export async function duckMusic(ctx: Ctx, musicIds: string[], depth: number) {
  const p = ctx.project;
  const music = musicIds.map((id) => findClip(p, id)).filter((f) => f && hasSound(p, f.clip.id)).map((f) => f!.clip);
  if (!music.length) { ctx.notify('Seleciona a música (um clip com som).', 'error'); return; }
  const span = [Math.min(...music.map((c) => c.start)), Math.max(...music.map((c) => c.start + c.duration))];
  const voices = p.tracks.filter((t) => !t.muted).flatMap((t) => t.clips)
    .filter((c) => !musicIds.includes(c.id) && hasSound(p, c.id) && c.start < span[1] && c.start + c.duration > span[0] && (c.volKeys?.length || c.volume > 0));
  if (!voices.length) { ctx.notify('Não há outros clips com som (voz) por cima desta música.', 'error'); return; }
  if (busy.has('duck')) return;
  busy.add('duck');
  ctx.notify(`A ouvir ${voices.length === 1 ? 'a voz' : `${voices.length} clips com voz`}…`);
  try {
    let all: [number, number][] = [];
    for (const v of voices) {
      const env = await clipEnvelope(p, v);
      if ('error' in env) continue;
      all = all.concat(toTimeline(p, v, voiceRanges(env.db, env.hop, 0.5)));
    }
    const voice = mergeRanges(all, Math.round(p.fps * 0.6));
    if (!voice.length) { ctx.notify('Não encontrei voz nos outros clips.', 'error'); return; }
    ctx.commit((q) => {
      let out = q;
      for (const m of music) out = duckClip(out, m.id, voice, depth, Math.round(p.fps * 0.25), Math.round(p.fps * 0.5));
      return out;
    });
    ctx.notify(`Música baixa em ${voice.length} ${voice.length === 1 ? 'parte' : 'partes'} com voz (${Math.round(20 * Math.log10(depth))} dB). Afina os pontos na linha de volume.`);
  } finally { busy.delete('duck'); }
}

// ---------------------------------------------------------------------------
// Substituir media e preencher espaços de modelos
// ---------------------------------------------------------------------------
import { canReplaceWith, replaceMedia } from './ops';

export function replaceWithMedia(ctx: Ctx, clipId: string, mediaId: string): boolean {
  const why = canReplaceWith(ctx.project, clipId, mediaId);
  if (why) { ctx.notify(why, 'error'); return false; }
  const wasPh = !!findClip(ctx.project, clipId)?.clip.placeholder;
  ctx.commit((q) => ({ project: replaceMedia(q, clipId, mediaId), select: [clipId] }));
  if (wasPh) {
    // conta os que faltam no projeto já atualizado
    const left = replaceMedia(ctx.project, clipId, mediaId).tracks.reduce((n, t) => n + t.clips.filter((c) => c.placeholder).length, 0);
    ctx.notify(left ? `Espaço preenchido. Faltam ${left}.` : 'Todos os espaços preenchidos!');
  }
  return true;
}

/** Escolher um ficheiro e pô-lo no lugar do clip */
export async function replaceWithFile(ctx: Ctx & { mediaBase: string }, clipId: string) {
  const paths = await api().pickMedia();
  if (!paths[0]) return;
  let item;
  try { item = await probeMedia(paths[0], ctx.mediaBase); } catch (e) { ctx.notify(String((e as Error).message || e), 'error'); return; }
  const known = ctx.project.media.find((m) => m.path === item.path);
  const p1 = known ? ctx.project : addMedia(ctx.project, [item]);
  const mid = p1.media.find((m) => m.path === item.path)!.id;
  const why = canReplaceWith(p1, clipId, mid);
  if (why) { ctx.notify(why, 'error'); return; }
  ctx.commit(() => ({ project: replaceMedia(p1, clipId, mid), select: [clipId] }));
  ctx.notify(`Substituído por "${item.name}".`);
}

// ---------------------------------------------------------------------------
// Inverter clip
// ---------------------------------------------------------------------------
import { applyReversed, canUnreverse, unreverse } from './ops';

export async function reverseClip(ctx: Ctx & { mediaBase: string }, clipId: string) {
  const p = ctx.project;
  const f = findClip(p, clipId);
  const m = f && p.media.find((x) => x.id === f.clip.mediaId);
  if (!f || !m || m.kind === 'image') { ctx.notify('Só vídeos e sons se podem inverter.', 'error'); return; }
  if (canUnreverse(f.clip)) {
    ctx.commit((q) => {
      let out = unreverse(q, clipId);
      const pair = f.clip.detachedAudioId && findClip(q, f.clip.detachedAudioId)?.clip;
      if (pair && canUnreverse(pair)) out = unreverse(out, pair.id);
      return out;
    });
    ctx.notify('O clip voltou a andar para a frente.');
    return;
  }
  if (busy.has('rev')) return;
  busy.add('rev');
  const kind = f.track.kind === 'audio' || m.kind === 'audio' ? 'audio' : 'video';
  ctx.notify(`A inverter "${m.name}"… (o vídeo tem de ser recodificado: pode demorar um bocadinho)`);
  try {
    const r = await api().reverse({
      file: m.path, start: f.clip.trimStart / p.fps, dur: clipSourceSpan(f.clip) / p.fps, fps: p.fps, kind,
      hasAudio: kind === 'video' && m.hasAudio !== false,
    });
    if (!r.path) { ctx.notify(r.error || 'Não foi possível inverter.', 'error'); return; }
    const item = { ...(await probeMedia(r.path, ctx.mediaBase)), name: `${m.name.replace(/ \(invertido\)$/, '')} (invertido)` };
    const path = r.path;
    ctx.commit((q) => {
      let out = addMedia(q, [item]);
      const nm = out.media.find((x) => x.path === path)!;
      const fc = findClip(out, clipId);
      if (!fc) return out;
      out = applyReversed(out, clipId, nm.id);
      // som separado do mesmo vídeo, alinhado: inverte também (o ficheiro invertido já traz o som ao contrário)
      const pair = fc.clip.detachedAudioId && findClip(out, fc.clip.detachedAudioId)?.clip;
      if (pair && pair.start === fc.clip.start && pair.duration === fc.clip.duration && pair.mediaId === m.id && pair.trimStart === fc.clip.trimStart) out = applyReversed(out, pair.id, nm.id);
      return { project: out, select: [clipId] };
    });
    ctx.notify('Clip invertido. "Pôr a direito" volta ao original.');
  } catch (e) { ctx.notify(String((e as Error).message || e), 'error'); }
  finally { busy.delete('rev'); }
}
