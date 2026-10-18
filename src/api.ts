// Tipos da ponte exposta pelo preload (window.vidcut).
import type { Project } from '../shared/types';
import type { RenderSpec } from '../shared/export';

export interface ExportProgress {
  stage: 'browser' | 'prepare' | 'render' | 'muxing' | 'done';
  progress: number;
  message?: string;
}

export interface LottieLibItem { id: string; name: string; data: Record<string, unknown> }

export interface AutosaveData { project: Project; filePath: string | null; dirty: boolean }

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
  peaks(file: string): Promise<Uint8Array>;
  nativeEdit(action: 'cut' | 'copy' | 'paste' | 'selectAll' | 'undo' | 'redo'): Promise<boolean>;
  lottieList(): Promise<LottieLibItem[]>;
  lottieImport(paths?: string[]): Promise<{ added: LottieLibItem[]; errors: string[] }>;
  lottieRemove(id: string): Promise<boolean>;
  lottieRename(id: string, name: string): Promise<boolean>;
  onExportProgress(cb: (p: ExportProgress) => void): () => void;
  onMenu(cb: (cmd: string) => void): () => void;
}

declare global {
  interface Window { vidcut?: VidCutApi }
}

export const api = (): VidCutApi => {
  if (!window.vidcut) throw new Error('O VidCut tem de correr dentro da app (Electron).');
  return window.vidcut;
};
