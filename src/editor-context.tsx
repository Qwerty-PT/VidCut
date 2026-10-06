import React, { createContext, useContext } from 'react';
import type { Action, EditorState } from './state';
import type { Project } from '../shared/types';

export interface EditorCtx {
  state: EditorState;
  dispatch: React.Dispatch<Action>;
  /** Aplica uma edição ao projeto atual (com histórico). Calculada fora do reducer. */
  commit: (fn: (p: Project) => Project | { project: Project; select?: string[] }, select?: string[]) => void;
  mediaBase: string;
  importPaths: (paths: string[], place?: { trackId?: string; start: number; newTrack?: boolean }) => Promise<void>;
  notify: (msg: string, kind?: 'info' | 'error') => void;
}

const Ctx = createContext<EditorCtx | null>(null);
export const EditorProvider = Ctx.Provider;
export function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('EditorProvider em falta');
  return c;
}
