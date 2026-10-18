// Operações de edição — funções puras (Project → Project).
// Regra base: clips na mesma pista nunca se sobrepõem.
import type { CaptionStyle, Clip, ClipColor, ClipTransform, KfEasing, KfProp, LottieAsset, MediaItem, Project, TextContent, Track, TrackKind } from '../shared/types';
import { lottieInfo } from '../shared/lottie';
import { captionText, retimeWords, sliceCaption } from '../shared/captions';
import { clipSpeed } from '../shared/types';
import { DEFAULT_TRANSFORM, getTransform, isDefaultTransform } from '../shared/transform';
import { scaleKeyframes, shiftKeyframes, sortKeyframes, valuesAt } from '../shared/keyframes';
import { getTemplate } from '../shared/templates';
import { applyTheme, supportsThemes, templateDefaults } from '../shared/template-api';
import { defaultTextAnims } from '../shared/anim';
import { sourceFrames } from '../shared/types';
import { uid } from './util';

export const IMAGE_DEFAULT_SEC = 5;

export function trackKindFor(media: MediaItem): TrackKind {
  return media.kind === 'audio' ? 'audio' : 'video';
}

export function findClip(p: Project, clipId: string): { track: Track; clip: Clip; ti: number } | null {
  for (let ti = 0; ti < p.tracks.length; ti++) {
    const clip = p.tracks[ti].clips.find((c) => c.id === clipId);
    if (clip) return { track: p.tracks[ti], clip, ti };
  }
  return null;
}

const mapTrack = (p: Project, trackId: string, fn: (t: Track) => Track): Project => ({
  ...p,
  tracks: p.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
});

const sortClips = (clips: Clip[]) => [...clips].sort((a, b) => a.start - b.start);

/** Intervalos livres numa pista (ignorando um clip) */
function overlaps(track: Track, start: number, duration: number, ignoreId?: string): Clip[] {
  return track.clips.filter((c) => c.id !== ignoreId && start < c.start + c.duration && c.start < start + duration);
}

/**
 * Devolve a posição mais próxima de `desired` onde um clip de `duration` cabe sem sobrepor.
 */
export function freeStart(track: Track, desired: number, duration: number, ignoreId?: string): number {
  desired = Math.max(0, Math.round(desired));
  if (overlaps(track, desired, duration, ignoreId).length === 0) return desired;
  const others = sortClips(track.clips.filter((c) => c.id !== ignoreId));
  const candidates: number[] = [];
  for (const c of others) {
    candidates.push(c.start + c.duration); // logo depois
    candidates.push(c.start - duration); // logo antes
  }
  const valid = candidates.filter((s) => s >= 0 && overlaps(track, s, duration, ignoreId).length === 0);
  if (valid.length === 0) {
    const end = others.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    return end;
  }
  return valid.reduce((best, s) => (Math.abs(s - desired) < Math.abs(best - desired) ? s : best));
}

/**
 * Magnet ao largar: cola o clip ao fim do clip anterior ao ponto de largada nessa pista;
 * se não houver nenhum antes, cola ao início (frame 0).
 */
export function magnetStart(track: Track, frame: number): number {
  return track.clips.filter((c) => c.start < frame).reduce((end, c) => Math.max(end, c.start + c.duration), 0);
}

export function addTrack(p: Project, kind: TrackKind, atTop = false): { project: Project; trackId: string } {
  const n = p.tracks.filter((t) => t.kind === kind).length + 1;
  const track: Track = {
    id: uid('t'),
    kind,
    name: `${kind === 'video' ? 'Vídeo' : kind === 'text' ? 'Texto' : 'Áudio'} ${n}`,
    muted: false,
    hidden: false,
    clips: [],
  };
  let tracks: Track[];
  if (kind === 'text') {
    // pistas de texto ficam sempre por cima de tudo
    tracks = [track, ...p.tracks];
  } else if (kind === 'video') {
    // pistas de vídeo ficam todas acima das de áudio
    const lastVideo = p.tracks.map((t) => t.kind).lastIndexOf('video');
    const firstNonText = p.tracks.findIndex((t) => t.kind !== 'text');
    tracks = [...p.tracks];
    // "no topo" = logo abaixo das pistas de texto
    tracks.splice(atTop ? (firstNonText < 0 ? p.tracks.length : firstNonText) : lastVideo + 1, 0, track);
  } else {
    tracks = [...p.tracks, track];
  }
  return { project: { ...p, tracks }, trackId: track.id };
}

export function removeTrack(p: Project, trackId: string): Project {
  return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
}

export function updateTrack(p: Project, trackId: string, patch: Partial<Track>): Project {
  return mapTrack(p, trackId, (t) => ({ ...t, ...patch }));
}

export function addMedia(p: Project, items: MediaItem[]): Project {
  const known = new Set(p.media.map((m) => m.path));
  return { ...p, media: [...p.media, ...items.filter((m) => !known.has(m.path))] };
}

export function removeMedia(p: Project, mediaId: string): Project {
  return {
    ...p,
    media: p.media.filter((m) => m.id !== mediaId),
    tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.mediaId !== mediaId) })),
  };
}

export function mediaInUse(p: Project, mediaId: string): boolean {
  return p.tracks.some((t) => t.clips.some((c) => c.mediaId === mediaId));
}

/**
 * Adiciona um clip. Se a pista não for compatível (ou não existir), usa/cria uma compatível.
 */
export function addClip(
  p: Project,
  mediaId: string,
  opts: { trackId?: string; start: number; newTrack?: boolean; magnet?: boolean },
): { project: Project; clipId: string | null } {
  const media = p.media.find((m) => m.id === mediaId);
  if (!media) return { project: p, clipId: null };
  const kind = trackKindFor(media);

  let project = p;
  let track = opts.trackId ? p.tracks.find((t) => t.id === opts.trackId) : undefined;
  if (!track || track.kind !== kind) track = opts.newTrack ? undefined : p.tracks.find((t) => t.kind === kind);
  if (!track) {
    const r = addTrack(project, kind);
    project = r.project;
    track = project.tracks.find((t) => t.id === r.trackId)!;
  }

  const src = sourceFrames(media, p.fps);
  const duration = Number.isFinite(src) ? Math.max(1, src) : IMAGE_DEFAULT_SEC * p.fps;
  const clip: Clip = {
    id: uid('c'),
    mediaId,
    start: freeStart(track, opts.magnet ? magnetStart(track, opts.start) : opts.start, duration),
    duration,
    trimStart: 0,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
  const trackId = track.id;
  project = mapTrack(project, trackId, (t) => ({ ...t, clips: sortClips([...t.clips, clip]) }));
  return { project, clipId: clip.id };
}

/** Move um clip para (pista, início) sem sobreposição. Pista tem de ser do mesmo tipo. */
export function moveClip(p: Project, clipId: string, toTrackId: string, desiredStart: number): Project {
  const found = findClip(p, clipId);
  if (!found) return p;
  const target = p.tracks.find((t) => t.id === toTrackId);
  if (!target || target.kind !== found.track.kind) return p;
  const start = freeStart(target, desiredStart, found.clip.duration, clipId);
  const moved = { ...found.clip, start };
  return {
    ...p,
    tracks: p.tracks.map((t) => {
      let clips = t.clips;
      if (t.id === found.track.id) clips = clips.filter((c) => c.id !== clipId);
      if (t.id === toTrackId) clips = sortClips([...clips, moved]);
      return clips === t.clips ? t : { ...t, clips };
    }),
  };
}

/**
 * Apara um clip a partir do seu estado original (no início do gesto).
 * edge 'left' mexe no início (e no trimStart); 'right' mexe no fim.
 */
export function trimClip(p: Project, origin: Clip, edge: 'left' | 'right', deltaFrames: number): Project {
  const found = findClip(p, origin.id);
  if (!found) return p;
  const media = p.media.find((m) => m.id === origin.mediaId);
  if (!media && !origin.text && !origin.template) return p;
  const src = media ? sourceFrames(media, p.fps) : Infinity; // texto/modelo: sem limite, como imagens
  const others = found.track.clips.filter((c) => c.id !== origin.id);
  const isImage = !Number.isFinite(src);
  let { start, duration, trimStart } = origin;
  const sp = clipSpeed(origin);

  if (edge === 'left') {
    const prevEnd = others.filter((c) => c.start + c.duration <= origin.start).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    let d = Math.round(deltaFrames);
    d = Math.max(d, prevEnd - origin.start); // não invade o clip anterior
    d = Math.max(d, -origin.start); // não passa do zero
    if (!isImage) d = Math.max(d, -Math.floor(origin.trimStart / sp)); // não antes do início da fonte
    d = Math.min(d, origin.duration - 1); // mínimo 1 frame
    start = origin.start + d;
    duration = origin.duration - d;
    trimStart = isImage ? 0 : Math.max(0, Math.round(origin.trimStart + d * sp));
  } else {
    const nextStart = others.filter((c) => c.start >= origin.start + origin.duration).reduce((m, c) => Math.min(m, c.start), Infinity);
    let newDur = origin.duration + Math.round(deltaFrames);
    newDur = Math.min(newDur, nextStart - origin.start);
    if (!isImage) newDur = Math.min(newDur, Math.floor((src - origin.trimStart) / sp));
    duration = Math.max(1, newDur);
  }
  const fadeIn = Math.min(origin.fadeIn, duration);
  const fadeOut = Math.min(origin.fadeOut, duration);
  const keyframes = edge === 'left' ? shiftKeyframes(origin.keyframes, origin.start - start) : origin.keyframes;
  const cap = origin.caption ? sliceCaption(origin, start - origin.start, start - origin.start + duration) : {};
  return updateClip(p, origin.id, { start, duration, trimStart, fadeIn, fadeOut, keyframes, ...cap });
}

export function updateClip(p: Project, clipId: string, patch: Partial<Clip>): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) =>
      t.clips.some((c) => c.id === clipId) ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) } : t,
    ),
  };
}

export const TRANSITION_PREFIX = 'tr:';
export const transitionSelId = (clipId: string) => TRANSITION_PREFIX + clipId;

/** Apaga clips; ids "tr:<clipId>" apagam só a transição de entrada desse clip */
export function deleteClips(p: Project, ids: string[]): Project {
  const set = new Set(ids);
  const trans = new Set(ids.filter((id) => id.startsWith(TRANSITION_PREFIX)).map((id) => id.slice(TRANSITION_PREFIX.length)));
  return {
    ...p,
    tracks: p.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => !set.has(c.id)).map((c) => (trans.has(c.id) ? { ...c, transition: undefined } : c)),
    })),
  };
}

/** Clips sob o frame indicado */
export function clipsAt(p: Project, frame: number): Clip[] {
  const out: Clip[] = [];
  for (const t of p.tracks) for (const c of t.clips) if (frame > c.start && frame < c.start + c.duration) out.push(c);
  return out;
}

/** Divide os clips indicados no frame. Devolve também os ids das metades da direita. */
export function splitClips(p: Project, ids: string[], frame: number): { project: Project; created: string[] } {
  const set = new Set(ids);
  const created: string[] = [];
  const tracks = p.tracks.map((t) => {
    let changed = false;
    const clips: Clip[] = [];
    for (const c of t.clips) {
      if (set.has(c.id) && frame > c.start && frame < c.start + c.duration) {
        const leftDur = frame - c.start;
        const left: Clip = { ...c, duration: leftDur, fadeOut: 0, fadeIn: Math.min(c.fadeIn, leftDur), ...sliceCaption(c, 0, leftDur) };
        const right: Clip = {
          ...c,
          id: uid('c'),
          detachedAudioId: undefined,
          transition: undefined,
          keyframes: shiftKeyframes(c.keyframes, -leftDur),
          start: frame,
          duration: c.duration - leftDur,
          trimStart: Math.round(c.trimStart + leftDur * clipSpeed(c)),
          fadeIn: 0,
          fadeOut: Math.min(c.fadeOut, c.duration - leftDur),
          ...sliceCaption(c, leftDur, c.duration),
        };
        clips.push(left, right);
        created.push(right.id);
        changed = true;
      } else clips.push(c);
    }
    return changed ? { ...t, clips } : t;
  });
  return { project: { ...p, tracks }, created };
}

/** Muda o fps do projeto convertendo todas as posições (mantém os tempos em segundos). */
export function changeFps(p: Project, fps: number): Project {
  if (fps === p.fps) return p;
  const k = fps / p.fps;
  const r = (n: number) => Math.round(n * k);
  return {
    ...p,
    fps,
    tracks: p.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({
        ...c,
        start: r(c.start),
        duration: Math.max(1, r(c.duration)),
        trimStart: r(c.trimStart),
        fadeIn: r(c.fadeIn),
        fadeOut: r(c.fadeOut),
        transition: c.transition ? { ...c.transition, duration: Math.max(2, r(c.transition.duration)) } : undefined,
        ...(c.animIn ? { animIn: { ...c.animIn, duration: Math.max(1, r(c.animIn.duration)) } } : {}),
        ...(c.animOut ? { animOut: { ...c.animOut, duration: Math.max(1, r(c.animOut.duration)) } } : {}),
        ...(c.keyframes ? { keyframes: c.keyframes.map((kf) => ({ ...kf, frame: r(kf.frame) })) } : {}),
      })),
    })),
  };
}

/** Pode separar o som deste clip? (clip de vídeo, numa pista de vídeo, ainda com som) */
export function canDetachAudio(p: Project, clipId: string): boolean {
  const f = findClip(p, clipId);
  if (!f || f.track.kind !== 'video' || f.clip.audioDetached) return false;
  return p.media.find((m) => m.id === f.clip.mediaId)?.kind === 'video';
}

/**
 * Separa o som de um clip de vídeo para uma pista de áudio, alinhado ao frame.
 * O clip de vídeo fica sem som; o novo clip de áudio herda volume e fades.
 */
export function detachAudio(p: Project, clipId: string): { project: Project; clipId: string | null } {
  if (!canDetachAudio(p, clipId)) return { project: p, clipId: null };
  const { clip } = findClip(p, clipId)!;
  let project = p;
  let track = p.tracks.find((t) => t.kind === 'audio' && overlaps(t, clip.start, clip.duration).length === 0);
  if (!track) {
    const r = addTrack(project, 'audio');
    project = r.project;
    track = project.tracks.find((t) => t.id === r.trackId)!;
  }
  const audio: Clip = {
    id: uid('c'),
    mediaId: clip.mediaId,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    speed: clip.speed,
    volume: clip.volume,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
  };
  const trackId = track.id;
  project = mapTrack(project, trackId, (t) => ({ ...t, clips: sortClips([...t.clips, audio]) }));
  project = updateClip(project, clipId, { audioDetached: true, detachedAudioId: audio.id });
  return { project, clipId: audio.id };
}

/** Volta a pôr o som no clip de vídeo e apaga o clip de áudio separado (se ainda existir). */
export function reattachAudio(p: Project, clipId: string): Project {
  const f = findClip(p, clipId);
  if (!f || !f.clip.audioDetached) return p;
  let project = f.clip.detachedAudioId ? deleteClips(p, [f.clip.detachedAudioId]) : p;
  project = updateClip(project, clipId, { audioDetached: false, detachedAudioId: undefined });
  return project;
}

/**
 * Divide e elimina um dos lados (como o Q / W do CapCut).
 * 'left' remove do início do clip até ao frame; 'right' remove do frame até ao fim.
 * O espaço que fica é fechado na mesma pista: os clips seguintes andam para a esquerda.
 */
export function cutAtFrame(p: Project, ids: string[], frame: number, side: 'left' | 'right'): Project {
  const set = new Set(ids);
  return {
    ...p,
    tracks: p.tracks.map((t) => {
      const target = t.clips.find((c) => set.has(c.id) && frame > c.start && frame < c.start + c.duration);
      if (!target) return t;
      const media = p.media.find((m) => m.id === target.mediaId);
      const isImage = media?.kind === 'image';
      const end0 = target.start + target.duration;
      const removed = side === 'left' ? frame - target.start : end0 - frame;
      const clips = t.clips.map((c) => {
        if (c.id === target.id) {
          const duration = c.duration - removed;
          return {
            ...c,
            duration,
            trimStart: side === 'left' && !isImage ? Math.round(c.trimStart + removed * clipSpeed(c)) : c.trimStart,
            keyframes: side === 'left' ? shiftKeyframes(c.keyframes, -removed) : c.keyframes,
            fadeIn: Math.min(side === 'left' ? 0 : c.fadeIn, duration),
            fadeOut: Math.min(side === 'right' ? 0 : c.fadeOut, duration),
          };
        }
        return c.start >= end0 ? { ...c, start: c.start - removed } : c;
      });
      return { ...t, clips };
    }),
  };
}

/** Define (ou remove, com undefined) a transição de entrada de um clip */
export function setTransition(p: Project, clipId: string, transition: Clip['transition']): Project {
  return updateClip(p, clipId, { transition });
}

export function defaultText(): TextContent {
  return {
    text: 'Escreve aqui o teu texto',
    font: 'sans',
    size: 72,
    weight: 600,
    color: '#ffffff',
    align: 'center',
    x: 50,
    y: 80, // terço inferior
    maxWidth: 80,
    background: null,
    bgOpacity: 0.85,
    shadow: true,
  };
}

/** Adiciona um clip de texto (3 s) na cabeça de leitura, numa pista de texto livre (ou nova) */
export function addTextClip(p: Project, start: number): { project: Project; clipId: string } {
  const duration = 3 * p.fps;
  let project = p;
  let track = p.tracks.find((t) => t.kind === 'text' && overlaps(t, start, duration).length === 0);
  if (!track) {
    const r = addTrack(project, 'text');
    project = r.project;
    track = project.tracks.find((t) => t.id === r.trackId)!;
  }
  const clip: Clip = {
    id: uid('c'),
    mediaId: '',
    start: Math.max(0, Math.round(start)),
    duration,
    trimStart: 0,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    text: defaultText(),
    ...defaultTextAnims(p.fps),
  };
  const trackId = track.id;
  project = mapTrack(project, trackId, (t) => ({ ...t, clips: sortClips([...t.clips, clip]) }));
  return { project, clipId: clip.id };
}

export function updateText(p: Project, clipId: string, patch: Partial<TextContent>): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.text) return p;
  const caption = f.clip.caption && patch.text !== undefined && patch.text !== f.clip.text.text
    ? retimeWords(f.clip.caption, patch.text, f.clip.duration) : f.clip.caption;
  return updateClip(p, clipId, { text: { ...f.clip.text, ...patch }, ...(caption ? { caption } : {}) });
}

// ---------------------------------------------------------------------------
// Legendas
// ---------------------------------------------------------------------------

/** Cria uma pista de texto "Legendas" no topo com os clips dados */
export function addCaptionTrack(p: Project, clips: Clip[]): { project: Project; trackId: string } {
  const r = addTrack(p, 'text', true);
  const n = p.tracks.filter((t) => t.kind === 'text' && /^Legendas/.test(t.name)).length;
  const name = n ? `Legendas ${n + 1}` : 'Legendas';
  const project = mapTrack(r.project, r.trackId, (t) => ({ ...t, name, clips: sortClips(clips) }));
  return { project, trackId: r.trackId };
}

/** Aplica estilo (e aspeto do texto) de uma legenda a todas as legendas da mesma pista */
export function applyCaptionLook(p: Project, clipId: string, opts: { style?: CaptionStyle; highlight?: string; copyText?: boolean }): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.caption || !f.clip.text) return p;
  const src = f.clip;
  return mapTrack(p, f.track.id, (t) => ({
    ...t,
    clips: t.clips.map((c) => {
      if (!c.caption || !c.text) return c;
      const style = opts.style ?? c.caption.style;
      const prevStyle = c.caption.style;
      let text = opts.copyText ? { ...src.text!, text: c.text.text } : c.text;
      if (opts.style && opts.style !== prevStyle && !opts.copyText) {
        const base = captionText(style);
        text = { ...text, background: base.background, size: base.size, y: base.y };
      }
      const animIn = style === 'classic' ? { preset: 'fade' as const, duration: Math.min(5, c.duration), style: 'productive' as const } : undefined;
      return { ...c, text, animIn, caption: { ...c.caption, style, highlight: opts.highlight ?? (opts.copyText ? src.caption!.highlight : c.caption.highlight) } };
    }),
  }));
}

/** Atualiza a transformação de um clip (parcial; o recorte é fundido) */
export function updateTransform(p: Project, clipId: string, patch: Partial<ClipTransform>): Project {
  const f = findClip(p, clipId);
  if (!f) return p;
  const cur = getTransform(f.clip);
  const next: ClipTransform = { ...cur, ...patch, crop: { ...cur.crop, ...patch.crop } };
  return updateClip(p, clipId, { transform: isDefaultTransform(next) ? undefined : next });
}

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

/**
 * Muda a velocidade mantendo o mesmo excerto da fonte: a duração na timeline encolhe/estica.
 * Os clips seguintes na mesma pista são empurrados (ou puxados) para não haver sobreposição nem buracos novos.
 */
export function setSpeed(p: Project, clipId: string, speed: number): Project {
  const f = findClip(p, clipId);
  if (!f) return p;
  const old = clipSpeed(f.clip);
  const sp = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(speed * 100) / 100));
  if (sp === old) return p;
  const duration = Math.max(1, Math.round((f.clip.duration * old) / sp));
  const delta = duration - f.clip.duration;
  const end0 = f.clip.start + f.clip.duration;
  return {
    ...p,
    tracks: p.tracks.map((t) => {
      if (t.id !== f.track.id) return t;
      return {
        ...t,
        clips: t.clips.map((c) => {
          if (c.id === clipId) {
            return { ...c, speed: sp === 1 ? undefined : sp, duration, fadeIn: Math.min(c.fadeIn, duration), fadeOut: Math.min(c.fadeOut, duration), keyframes: scaleKeyframes(c.keyframes, old / sp) };
          }
          return c.start >= end0 ? { ...c, start: Math.max(0, c.start + delta) } : c;
        }),
      };
    }),
  };
}

export const DEFAULT_COLOR: ClipColor = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, sepia: 0, blur: 0, vignette: 0 };

export function updateColor(p: Project, clipId: string, patch: Partial<ClipColor>): Project {
  const f = findClip(p, clipId);
  if (!f) return p;
  const next = { ...DEFAULT_COLOR, ...f.clip.color, ...patch };
  const isDefault = (Object.keys(DEFAULT_COLOR) as (keyof ClipColor)[]).every((k) => next[k] === 0);
  return updateClip(p, clipId, { color: isDefault ? undefined : next });
}

/**
 * Altera propriedades animáveis num frame (relativo ao clip).
 * Se o clip tiver keyframes, cria/atualiza o keyframe nesse frame (como no CapCut);
 * senão, altera o valor base.
 */
export function setAnimatedProps(p: Project, clipId: string, rel: number, patch: Partial<Record<KfProp, number>>): Project {
  const f = findClip(p, clipId);
  if (!f) return p;
  const c = f.clip;
  if (c.keyframes?.length) {
    const frame = Math.min(c.duration - 1, Math.max(0, Math.round(rel)));
    const existing = c.keyframes.find((k) => k.frame === frame);
    const keyframes = existing
      ? c.keyframes.map((k) => (k.id === existing.id ? { ...k, values: { ...k.values, ...patch } } : k))
      : sortKeyframes([...c.keyframes, { id: uid('k'), frame, values: { ...valuesAt(c, frame), ...patch }, easing: 'productive' as KfEasing }]);
    return updateClip(p, clipId, { keyframes });
  }
  if (c.text) {
    let q = p;
    if (patch.x !== undefined || patch.y !== undefined) q = updateText(q, clipId, { ...(patch.x !== undefined ? { x: patch.x } : {}), ...(patch.y !== undefined ? { y: patch.y } : {}) });
    const rest: Partial<ClipTransform> = {};
    if (patch.scale !== undefined) rest.scale = patch.scale;
    if (patch.rotation !== undefined) rest.rotation = patch.rotation;
    if (patch.opacity !== undefined) rest.opacity = patch.opacity;
    return Object.keys(rest).length ? updateTransform(q, clipId, rest) : q;
  }
  return updateTransform(p, clipId, patch);
}

/** Cria um keyframe com os valores atuais no frame indicado (relativo ao clip) */
export function addKeyframe(p: Project, clipId: string, rel: number): Project {
  const f = findClip(p, clipId);
  if (!f) return p;
  const c = f.clip;
  const frame = Math.min(c.duration - 1, Math.max(0, Math.round(rel)));
  if (c.keyframes?.some((k) => k.frame === frame)) return p;
  const kf = { id: uid('k'), frame, values: valuesAt(c, frame), easing: 'productive' as KfEasing };
  return updateClip(p, clipId, { keyframes: sortKeyframes([...(c.keyframes ?? []), kf]) });
}

export function removeKeyframe(p: Project, clipId: string, kfId: string): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.keyframes) return p;
  const c = f.clip;
  const kfs = c.keyframes!.filter((k) => k.id !== kfId);
  if (kfs.length) return updateClip(p, clipId, { keyframes: kfs });
  // último keyframe: os seus valores passam a ser a base
  const last = c.keyframes!.find((k) => k.id === kfId)!;
  const q = updateClip(p, clipId, { keyframes: undefined });
  return setAnimatedProps(q, clipId, 0, last.values);
}

export function setKeyframeEasing(p: Project, clipId: string, kfId: string, easing: KfEasing): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.keyframes) return p;
  return updateClip(p, clipId, { keyframes: f.clip.keyframes.map((k) => (k.id === kfId ? { ...k, easing } : k)) });
}

/** Move um keyframe para outro frame (relativo ao clip), sem colidir com outro */
export function moveKeyframe(p: Project, clipId: string, kfId: string, frame: number): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.keyframes) return p;
  const fr = Math.min(f.clip.duration - 1, Math.max(0, Math.round(frame)));
  if (f.clip.keyframes.some((k) => k.id !== kfId && k.frame === fr)) return p;
  return updateClip(p, clipId, { keyframes: sortKeyframes(f.clip.keyframes.map((k) => (k.id === kfId ? { ...k, frame: fr } : k))) });
}

/** Remove todos os keyframes, ficando com os valores do frame indicado como base */
export function clearKeyframes(p: Project, clipId: string, rel: number): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.keyframes?.length) return p;
  const vals = valuesAt(f.clip, rel);
  return setAnimatedProps(updateClip(p, clipId, { keyframes: undefined }), clipId, 0, vals);
}

/**
 * Adiciona um clip de modelo. Pista: a indicada (se for de vídeo) ou a primeira pista de vídeo
 * livre a contar de cima; se nenhuma tiver espaço, cria uma nova no topo.
 */
export function addTemplateClip(
  p: Project, templateId: string, start: number, opts: { trackId?: string; magnet?: boolean; newTrack?: boolean; theme?: string } = {},
): { project: Project; clipId: string | null } {
  const def = getTemplate(templateId);
  if (!def) return { project: p, clipId: null };
  const duration = Math.max(1, Math.round(def.durationSec * p.fps));
  let project = p;
  let track = opts.trackId ? p.tracks.find((t) => t.id === opts.trackId && t.kind === 'video') : undefined;
  if (!track && !opts.newTrack) track = p.tracks.find((t) => t.kind === 'video' && overlaps(t, start, duration).length === 0);
  if (!track) {
    const r = addTrack(project, 'video', true);
    project = r.project;
    track = project.tracks.find((t) => t.id === r.trackId)!;
  }
  const desired = opts.magnet ? magnetStart(track, start) : start;
  const clip: Clip = {
    id: uid('c'),
    mediaId: '',
    start: freeStart(track, desired, duration),
    duration,
    trimStart: 0,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    template: { id: templateId, props: opts.theme && supportsThemes(def) ? applyTheme(def, templateDefaults(def), opts.theme) : templateDefaults(def) },
  };
  const trackId = track.id;
  project = mapTrack(project, trackId, (t) => ({ ...t, clips: sortClips([...t.clips, clip]) }));
  return { project, clipId: clip.id };
}

/**
 * Pista de vídeo livre em [start, start+duration) que fique POR CIMA de tudo o que já se vê nesse intervalo
 * (para uma sobreposição nunca ficar escondida atrás de um vídeo). Sem nenhuma → undefined (cria-se uma nova).
 */
export function overlayTrack(p: Project, start: number, duration: number): Track | undefined {
  const video = p.tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === 'video');
  const occupied = video.filter(({ t }) => overlaps(t, start, duration).length > 0).map(({ i }) => i);
  const limit = occupied.length ? Math.min(...occupied) : Infinity; // índice 0 = pista de cima
  const free = video.filter(({ t, i }) => i < limit && overlaps(t, start, duration).length === 0);
  return free.length ? free[free.length - 1].t : undefined;
}

/** Adiciona uma animação Lottie (embute os dados no projeto) */
export function addLottieClip(
  p: Project, asset: LottieAsset, start: number, opts: { trackId?: string; magnet?: boolean; newTrack?: boolean } = {},
): { project: Project; clipId: string | null } {
  const info = lottieInfo(asset.data);
  const duration = Math.max(Math.round(p.fps), Math.round(info.durationSec * p.fps));
  let project: Project = { ...p, lotties: { ...p.lotties, [asset.id]: p.lotties?.[asset.id] ?? asset } };
  let track = opts.trackId ? project.tracks.find((t) => t.id === opts.trackId && t.kind === 'video') : undefined;
  if (!track && !opts.newTrack) track = overlayTrack(project, start, duration);
  if (!track) {
    const r = addTrack(project, 'video', true);
    project = r.project;
    track = project.tracks.find((t) => t.id === r.trackId)!;
  }
  const desired = opts.magnet ? magnetStart(track, start) : start;
  const clip: Clip = {
    id: uid('c'), mediaId: '', start: freeStart(track, desired, duration), duration,
    trimStart: 0, volume: 1, fadeIn: 0, fadeOut: 0,
    lottie: { assetId: asset.id, loop: false },
    // entra como elemento por cima do vídeo (não em ecrã inteiro), para se ver e mexer com o rato
    transform: { ...DEFAULT_TRANSFORM, scale: 0.45 },
  };
  project = mapTrack(project, track.id, (t) => ({ ...t, clips: sortClips([...t.clips, clip]) }));
  return { project, clipId: clip.id };
}

export function setLottieLoop(p: Project, clipId: string, loop: boolean): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.lottie) return p;
  return updateClip(p, clipId, { lottie: { ...f.clip.lottie, loop } });
}

export function updateTemplateProps(p: Project, clipId: string, patch: Record<string, unknown>): Project {
  const f = findClip(p, clipId);
  if (!f?.clip.template) return p;
  return updateClip(p, clipId, { template: { ...f.clip.template, props: { ...f.clip.template.props, ...patch } } });
}

// ---------------------------------------------------------------------------
// Edição rápida: mover vários, apagar fechando espaço, copiar/colar/duplicar
// ---------------------------------------------------------------------------

const clipIdsOnly = (ids: string[]) => ids.filter((id) => !id.startsWith(TRANSITION_PREFIX));

/** Intervalo de deslocamento permitido para mover um grupo de clips sem saltar por cima de outros */
export function groupMoveRange(p: Project, ids: string[]): { min: number; max: number } {
  const set = new Set(clipIdsOnly(ids));
  let min = -Infinity, max = Infinity;
  for (const t of p.tracks) {
    const moving = t.clips.filter((c) => set.has(c.id));
    if (!moving.length) continue;
    const fixed = t.clips.filter((c) => !set.has(c.id));
    for (const c of moving) {
      min = Math.max(min, -c.start);
      for (const f of fixed) {
        if (f.start + f.duration <= c.start) min = Math.max(min, f.start + f.duration - c.start);
        if (f.start >= c.start + c.duration) max = Math.min(max, f.start - (c.start + c.duration));
      }
    }
  }
  return { min: min === -Infinity ? 0 : min, max };
}

/** Move vários clips o mesmo número de frames (cada um na sua pista) */
export function moveClips(p: Project, ids: string[], delta: number): Project {
  const { min, max } = groupMoveRange(p, ids);
  const d = Math.round(Math.min(max, Math.max(min, delta)));
  if (!d) return p;
  const set = new Set(clipIdsOnly(ids));
  return {
    ...p,
    tracks: p.tracks.map((t) => (t.clips.some((c) => set.has(c.id))
      ? { ...t, clips: sortClips(t.clips.map((c) => (set.has(c.id) ? { ...c, start: c.start + d } : c))) }
      : t)),
  };
}

/** Apaga clips e puxa os seguintes da mesma pista para fechar o espaço (ripple) */
export function rippleDelete(p: Project, ids: string[]): Project {
  const set = new Set(clipIdsOnly(ids));
  if (!set.size) return deleteClips(p, ids);
  const base = deleteClips(p, ids.filter((id) => id.startsWith(TRANSITION_PREFIX)));
  return {
    ...base,
    tracks: base.tracks.map((t) => {
      const removed = t.clips.filter((c) => set.has(c.id));
      if (!removed.length) return t;
      const kept = t.clips.filter((c) => !set.has(c.id)).map((c) => {
        const shift = removed.filter((r) => r.start + r.duration <= c.start).reduce((s, r) => s + r.duration, 0);
        return shift ? { ...c, start: c.start - shift } : c;
      });
      return { ...t, clips: sortClips(kept) };
    }),
  };
}

export function selectAllIds(p: Project): string[] {
  return p.tracks.flatMap((t) => t.clips.map((c) => c.id));
}

export interface ClipboardData {
  items: { trackId: string; trackKind: TrackKind; clip: Clip }[];
  minStart: number;
  maxEnd: number;
}

export function copyClips(p: Project, ids: string[]): ClipboardData | null {
  const set = new Set(clipIdsOnly(ids));
  const items: ClipboardData['items'] = [];
  for (const t of p.tracks) for (const c of t.clips) if (set.has(c.id)) items.push({ trackId: t.id, trackKind: t.kind, clip: c });
  if (!items.length) return null;
  return {
    items,
    minStart: Math.min(...items.map((i) => i.clip.start)),
    maxEnd: Math.max(...items.map((i) => i.clip.start + i.clip.duration)),
  };
}

/**
 * Cola o conteúdo copiado com o primeiro clip em `at`, mantendo as posições relativas.
 * Usa as mesmas pistas se houver espaço para todos; senão cria pistas novas.
 */
export function pasteClips(p: Project, cb: ClipboardData, at: number): { project: Project; created: string[] } {
  const offset = Math.max(0, Math.round(at)) - cb.minStart;
  const idMap = new Map<string, string>();
  for (const it of cb.items) idMap.set(it.clip.id, uid('c'));
  const fresh = cb.items.map((it) => {
    const c = it.clip;
    const pairedAudio = c.detachedAudioId && idMap.get(c.detachedAudioId);
    return {
      ...it,
      clip: {
        ...c,
        id: idMap.get(c.id)!,
        start: c.start + offset,
        detachedAudioId: pairedAudio || undefined,
        keyframes: c.keyframes?.map((k) => ({ ...k, id: uid('k') })),
      } as Clip,
    };
  });
  let project = p;
  const fitsOriginal = fresh.every((it) => {
    const t = project.tracks.find((x) => x.id === it.trackId);
    return t && overlaps(t, it.clip.start, it.clip.duration).length === 0;
  });
  const targetOf = new Map<string, string>();
  for (const it of fresh) {
    if (targetOf.has(it.trackId)) continue;
    const orig = project.tracks.find((x) => x.id === it.trackId);
    if (fitsOriginal && orig) targetOf.set(it.trackId, orig.id);
    else {
      const r = addTrack(project, it.trackKind, it.trackKind === 'video');
      project = r.project;
      targetOf.set(it.trackId, r.trackId);
    }
  }
  for (const it of fresh) {
    const tid = targetOf.get(it.trackId)!;
    project = mapTrack(project, tid, (t) => ({ ...t, clips: sortClips([...t.clips, it.clip]) }));
  }
  return { project, created: fresh.map((f) => f.clip.id) };
}
