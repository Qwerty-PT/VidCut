// Modelo de dados do VidCut — o projeto é um único JSON.
// Todos os tempos estão em FRAMES (inteiros), à taxa `project.fps`.

export type MediaKind = 'video' | 'audio' | 'image';
export type TrackKind = 'video' | 'audio' | 'text';

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
  /** Animação de entrada / saída (clips visuais e texto) */
  animIn?: ClipAnim;
  animOut?: ClipAnim;
  /** Clips de texto (mediaId vazio) */
  text?: TextContent;
  /** Posição, escala, rotação, recorte… (clips de vídeo e imagem) */
  transform?: ClipTransform;
  /** Velocidade (1 = normal). A duração na timeline = frames da fonte / velocidade */
  speed?: number;
  /** Ajustes de cor e efeitos (vídeo e imagem) */
  color?: ClipColor;
  /** Keyframes de posição/escala/rotação/opacidade (frames relativos ao início do clip) */
  keyframes?: Keyframe[];
  /** Clips de modelo programático (mediaId vazio) */
  template?: { id: string; props: Record<string, unknown> };
}

export type KfProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
export type KfEasing = 'linear' | 'productive' | 'expressive' | 'hold';

export interface Keyframe {
  id: string;
  /** Frame relativo ao início do clip */
  frame: number;
  values: Partial<Record<KfProp, number>>;
  /** Curva do segmento que começa neste keyframe */
  easing: KfEasing;
}

export interface ClipColor {
  /** -100..100 */
  brightness: number;
  contrast: number;
  saturation: number;
  /** -100 (frio) .. 100 (quente) */
  temperature: number;
  /** 0..100 */
  sepia: number;
  /** Desfocar, em px numa referência de 1080p (0..40) */
  blur: number;
  /** Vinheta 0..100 */
  vignette: number;
}

export interface ClipTransform {
  /** Centro do clip em % do quadro */
  x: number;
  y: number;
  /** 1 = tamanho base (ajustado ao quadro) */
  scale: number;
  /** Graus */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** Recorte em % do próprio clip (0–100) */
  crop: { top: number; right: number; bottom: number; left: number };
  /** 0–1 */
  opacity: number;
  /** Tamanho base: caber inteiro (contain) ou preencher o quadro (cover) */
  fit: 'contain' | 'cover';
}

export type AnimPreset =
  | 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale' | 'reveal'
  | 'typewriter' | 'words' | 'lines';

export interface ClipAnim {
  preset: AnimPreset;
  /** Duração em frames */
  duration: number;
  /** Curva IBM: productive (discreta) ou expressive (destaque) */
  style: 'productive' | 'expressive';
}

export type TextFont = 'sans' | 'serif' | 'mono';

export interface TextContent {
  text: string;
  font: TextFont;
  /** Tamanho em px numa referência de 1080 px de altura */
  size: number;
  weight: 400 | 600 | 700;
  color: string;
  align: 'left' | 'center' | 'right';
  /** Posição do centro do texto, em % do quadro */
  x: number;
  y: number;
  /** Largura máxima em % do quadro */
  maxWidth: number;
  /** Caixa de fundo (null = sem caixa) */
  background: string | null;
  /** Opacidade da caixa de fundo, 0..1 (por defeito 0,85) */
  bgOpacity?: number;
  shadow: boolean;
}

export type TransitionType = 'dissolve' | 'dip' | 'slide' | 'push' | 'wipe' | 'zoom'
  | 'blur' | 'flash' | 'glitch' | 'circle' | 'diamond' | 'blinds' | 'whip';

/** Sentido do movimento do clip que entra */
export type TransitionDir = 'left' | 'right' | 'up' | 'down';

export interface Transition {
  type: TransitionType;
  /** Duração total em frames, centrada no corte */
  duration: number;
  /** Só para transições com direção (deslizar, empurrar, cortina, chicote, persianas) */
  direction?: TransitionDir;
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
export const clipSpeed = (c: Clip) => c.speed ?? 1;

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
