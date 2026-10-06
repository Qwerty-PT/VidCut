// Modelo de dados do VidCut — o projeto é um único JSON.
// Todos os tempos estão em FRAMES (inteiros), à taxa `project.fps`.

export type MediaKind = 'video' | 'audio' | 'image';
export type TrackKind = 'video' | 'audio';

export interface MediaItem {
  id: string;
  /** Caminho absoluto no disco */
  path: string;
  name: string;
  kind: MediaKind;
  /** Duração da fonte em segundos (imagens: 0 = sem limite) */
  durationSec: number;
  hasAudio?: boolean;
  width?: number;
  height?: number;
}

export interface Clip {
  id: string;
  mediaId: string;
  /** Posição na timeline (frame) */
  start: number;
  /** Duração na timeline (frames) */
  duration: number;
  /** Frames cortados ao início da fonte */
  trimStart: number;
  /** 0..2 (1 = 100%) */
  volume: number;
  /** Fade in / fade out em frames (vídeo: opacidade; áudio: volume) */
  fadeIn: number;
  fadeOut: number;
  /** Clips de vídeo: o som foi separado para uma pista de áudio (o clip de vídeo fica sem som) */
  audioDetached?: boolean;
  /** Id do clip de áudio criado ao separar (para voltar a juntar) */
  detachedAudioId?: string;
  /** Transição de entrada: do clip anterior (encostado, na mesma pista de vídeo) para este */
  transition?: Transition;
}

export type TransitionType = 'dissolve' | 'dip' | 'slide' | 'push' | 'wipe' | 'zoom';

export interface Transition {
  type: TransitionType;
  /** Duração total em frames, centrada no corte */
  duration: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  hidden: boolean;
  clips: Clip[];
}

export interface Project {
  version: 1;
  name: string;
  fps: number;
  width: number;
  height: number;
  background: string;
  media: MediaItem[];
  /** Ordem: índice 0 = pista de cima (fica por cima no vídeo) */
  tracks: Track[];
}

export interface CompositionProps {
  project: Project;
  /** URL base do servidor de media local, ex.: http://127.0.0.1:51234 */
  mediaBase: string;
  [key: string]: unknown;
}

export const MIN_FPS = 24; // IBM: nunca abaixo de 24 fps

export function mediaUrl(mediaBase: string, path: string): string {
  return `${mediaBase}/m/${encodeURIComponent(path)}`;
}

/** Duração da fonte em frames à taxa do projeto (Infinity para imagens) */
export function sourceFrames(media: MediaItem, fps: number): number {
  if (media.kind === 'image' || !media.durationSec) return Infinity;
  return Math.floor(media.durationSec * fps);
}

export function projectDuration(project: Project): number {
  let end = 0;
  for (const t of project.tracks) for (const c of t.clips) end = Math.max(end, c.start + c.duration);
  return Math.max(1, end);
}

export function newProject(): Project {
  return {
    version: 1,
    name: 'Projeto sem título',
    fps: 30,
    width: 1920,
    height: 1080,
    background: '#000000',
    media: [],
    tracks: [
      { id: 'v1', kind: 'video', name: 'Vídeo 1', muted: false, hidden: false, clips: [] },
      { id: 'a1', kind: 'audio', name: 'Áudio 1', muted: false, hidden: false, clips: [] },
    ],
  };
}
