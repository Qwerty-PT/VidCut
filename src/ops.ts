// Operações de edição — funções puras (Project → Project).
// Regra base: clips na mesma pista nunca se sobrepõem.
import type { Clip, MediaItem, Project, Track, TrackKind } from '../shared/types';
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
    name: `${kind === 'video' ? 'Vídeo' : 'Áudio'} ${n}`,
    muted: false,
    hidden: false,
    clips: [],
  };
  let tracks: Track[];
  if (kind === 'video') {
    // pistas de vídeo ficam todas acima das de áudio
    const lastVideo = p.tracks.map((t) => t.kind).lastIndexOf('video');
    tracks = [...p.tracks];
    tracks.splice(atTop ? 0 : lastVideo + 1, 0, track);
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
  if (!media) return p;
  const src = sourceFrames(media, p.fps);
  const others = found.track.clips.filter((c) => c.id !== origin.id);
  const isImage = !Number.isFinite(src);
  let { start, duration, trimStart } = origin;

  if (edge === 'left') {
    const prevEnd = others.filter((c) => c.start + c.duration <= origin.start).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    let d = Math.round(deltaFrames);
    d = Math.max(d, prevEnd - origin.start); // não invade o clip anterior
    d = Math.max(d, -origin.start); // não passa do zero
    if (!isImage) d = Math.max(d, -origin.trimStart); // não antes do início da fonte
    d = Math.min(d, origin.duration - 1); // mínimo 1 frame
    start = origin.start + d;
    duration = origin.duration - d;
    trimStart = isImage ? 0 : origin.trimStart + d;
  } else {
    const nextStart = others.filter((c) => c.start >= origin.start + origin.duration).reduce((m, c) => Math.min(m, c.start), Infinity);
    let newDur = origin.duration + Math.round(deltaFrames);
    newDur = Math.min(newDur, nextStart - origin.start);
    if (!isImage) newDur = Math.min(newDur, src - origin.trimStart);
    duration = Math.max(1, newDur);
  }
  const fadeIn = Math.min(origin.fadeIn, duration);
  const fadeOut = Math.min(origin.fadeOut, duration);
  return updateClip(p, origin.id, { start, duration, trimStart, fadeIn, fadeOut });
}

export function updateClip(p: Project, clipId: string, patch: Partial<Clip>): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) =>
      t.clips.some((c) => c.id === clipId) ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) } : t,
    ),
  };
}

export function deleteClips(p: Project, ids: string[]): Project {
  const set = new Set(ids);
  return { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !set.has(c.id)) })) };
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
        const left: Clip = { ...c, duration: leftDur, fadeOut: 0, fadeIn: Math.min(c.fadeIn, leftDur) };
        const right: Clip = {
          ...c,
          id: uid('c'),
          detachedAudioId: undefined,
          start: frame,
          duration: c.duration - leftDur,
          trimStart: c.trimStart + leftDur,
          fadeIn: 0,
          fadeOut: Math.min(c.fadeOut, c.duration - leftDur),
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
