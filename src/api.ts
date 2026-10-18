// Tipos da ponte exposta pelo preload (window.vidcut).
import type { Project } from '../shared/types';
import type { RenderSpec } from '../shared/export';

export interface ExportProgress {
  stage: 'browser' | 'prepare' | 'render' | 'muxing' | 'done';
  progress: number;
  message?: string;
}

export interface CaptionsStatus { installed: boolean; models: Record<string, boolean>; sizes: Record<string, number> }

export interface LottieLibItem { id: string; name: string; data: Record<string, unknown> }

export interface AutosaveData { project: Project; filePath: string | null; dirty: boolean }

export interface UpdateStatus {
  status: 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  current: string;
  kind: string;
  manual?: boolean;
  version?: string;
  notes?: string;
  url?: string;
  canInstall?: boolean;
  size?: number;
  progress?: number;
  got?: number;
  total?: number;
  message?: string;
}

export interface LibSound { id: string; name: string; file: string; preview: string; durationSec: number; bpm?: number; beats?: number[]; tags: string[]; category?: string }

export interface VidCutApi {
  info(): Promise<{ mediaBase: string; platform: string; version: string }>;
  pickMedia(): Promise<string[]>;
  registerMedia(paths: string[]): Promise<boolean>;
  pathForFile(file: File): string;
  openProject(): Promise<{ path: string; project: Project } | null>;
  saveProject(project: Project, filePath: string | null, saveAs: boolean): Promise<string | null>;
  autosaveWrite(data: AutosaveData): Promise<boolean>;
  autosaveRead(): Promise<AutosaveData | null>;
  exportVideo(project: Project, spec: RenderSpec): Promise<{ ok: boolean; path?: string; error?: string; canceled?: boolean }>;
  cancelExport(): Promise<boolean>;
  showItem(p: string): Promise<boolean>;
  setFullScreen(on: boolean): Promise<boolean>;
  onFullScreen(cb: (on: boolean) => void): () => void;
  peaks(file: string): Promise<Uint8Array>;
  nativeEdit(action: 'cut' | 'copy' | 'paste' | 'selectAll' | 'undo' | 'redo'): Promise<boolean>;
  captionsStatus(): Promise<CaptionsStatus>;
  captionsStart(o: { file: string; startSec: number; durSec: number; model: string; language: string | null }): Promise<{ ok: boolean; captions?: { text: string; startMs: number; endMs: number }[]; language?: string; error?: string; canceled?: boolean }>;
  captionsCancel(): Promise<boolean>;
  captionsSaveSrt(text: string, name: string): Promise<string | null>;
  captionsOpenSrt(): Promise<{ name: string; text: string } | null>;
  onCaptionsProgress(cb: (p: { stage: string; progress: number; message: string }) => void): () => void;
  lottieList(): Promise<LottieLibItem[]>;
  lottieImport(paths?: string[]): Promise<{ added: LottieLibItem[]; errors: string[] }>;
  lottieRemove(id: string): Promise<boolean>;
  lottieRename(id: string, name: string): Promise<boolean>;
  onExportProgress(cb: (p: ExportProgress) => void): () => void;
  onMenu(cb: (cmd: string) => void): () => void;
  recStatus(): Promise<{ platform: string; screen: string; camera: string; microphone: string; systemAudio: boolean; shortcut: string }>;
  recAskCamera(): Promise<boolean>;
  recSources(): Promise<{ id: string; name: string; type: 'screen' | 'window'; thumb: string }[]>;
  recChoose(id: string, systemAudio: boolean): Promise<boolean>;
  recStarted(hide: boolean): Promise<boolean>;
  recEnded(): Promise<boolean>;
  recTick(text: string): void;
  recSave(bytes: ArrayBuffer, mime: string, kind: 'ecra' | 'camara'): Promise<{ path: string }>;
  onRecStop(cb: () => void): () => void;
  micAccess(): Promise<boolean>;
  saveRecording(bytes: ArrayBuffer, mime: string): Promise<{ path: string }>;
  extractFrame(file: string, timeSec: number): Promise<{ path?: string; error?: string }>;
  fontsImport(): Promise<{ name: string; file: string; size: number; data: string }[]>;
  loudness(file: string, start: number, dur: number): Promise<{ lufs: number; peakDb: number; error?: string }>;
  beats(file: string): Promise<{ bpm: number; beats: number[]; error?: string }>;
  scenes(o: { file: string; start: number; dur: number; fps: number; sensitivity: number }): Promise<{ cuts: number[]; frames: number; error?: string }>;
  envelope(file: string, start: number, dur: number): Promise<{ hop: number; db: number[]; error?: string }>;
  denoise(file: string, strength: number): Promise<{ path?: string; error?: string }>;
  onAudioProgress(cb: (p: number) => void): () => void;
  soundsList(): Promise<{ musicas: LibSound[]; efeitos: LibSound[] }>;
  soundsUse(file: string): Promise<{ path?: string; error?: string }>;
  updateCheck(): Promise<void>;
  updateDownload(): Promise<void>;
  updateCancel(): Promise<void>;
  updateSkip(version: string): Promise<void>;
  updateInstall(): Promise<boolean | { error: string }>;
  updateOpenPage(): Promise<void>;
  onUpdate(cb: (u: UpdateStatus) => void): () => void;
}

declare global {
  interface Window { vidcut?: VidCutApi }
}

export const api = (): VidCutApi => {
  if (!window.vidcut) throw new Error('O VidCut tem de correr dentro da app (Electron).');
  return window.vidcut;
};
