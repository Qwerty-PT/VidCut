// Estado do editor com histórico (desfazer/refazer).
// Gestos (arrastar/aparar) abrem um "checkpoint" e aplicam alterações transitórias;
// no fim do gesto, se nada mudou, o checkpoint é descartado.
import type { Project } from '../shared/types';
import { newProject } from '../shared/types';

const HISTORY_LIMIT = 200;

export interface EditorState {
  project: Project;
  past: Project[];
  future: Project[];
  selection: string[];
  filePath: string | null;
  savedProject: Project | null; // para saber se há alterações por guardar
  gestureOrigin: Project | null;
}

export type Action =
  | { type: 'apply'; project: Project; select?: string[] }
  | { type: 'beginGesture' }
  | { type: 'gesture'; fn: (p: Project) => Project }
  | { type: 'endGesture' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; ids: string[] }
  | { type: 'load'; project: Project; filePath: string | null; saved: boolean }
  | { type: 'saved'; filePath: string };

export function initialState(): EditorState {
  const p = newProject();
  return { project: p, past: [], future: [], selection: [], filePath: null, savedProject: p, gestureOrigin: null };
}

const push = (past: Project[], p: Project) => (past.length >= HISTORY_LIMIT ? [...past.slice(1), p] : [...past, p]);

function validSelection(p: Project, ids: string[]): string[] {
  const clips = p.tracks.flatMap((t) => t.clips);
  const all = new Set(clips.map((c) => c.id));
  const withTrans = new Set(clips.filter((c) => c.transition).map((c) => 'tr:' + c.id));
  return ids.filter((id) => all.has(id) || withTrans.has(id));
}

export function reducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case 'apply': {
      const next = a.project;
      if (next === s.project) return a.select ? { ...s, selection: a.select } : s;
      return {
        ...s,
        project: next,
        past: push(s.past, s.project),
        future: [],
        selection: validSelection(next, a.select ?? s.selection),
      };
    }
    case 'beginGesture':
      return { ...s, gestureOrigin: s.project };
    case 'gesture': {
      if (!s.gestureOrigin) {
        // sem gesto aberto (ex.: campo alterado sem foco): aplica como edição normal
        const next = a.fn(s.project);
        return next === s.project ? s : { ...s, project: next, past: push(s.past, s.project), future: [] };
      }
      const next = a.fn(s.gestureOrigin);
      return next === s.project ? s : { ...s, project: next };
    }
    case 'endGesture': {
      if (!s.gestureOrigin) return s;
      if (s.gestureOrigin === s.project) return { ...s, gestureOrigin: null };
      return { ...s, past: push(s.past, s.gestureOrigin), future: [], gestureOrigin: null };
    }
    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { ...s, project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], selection: validSelection(prev, s.selection) };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { ...s, project: next, past: push(s.past, s.project), future: s.future.slice(1), selection: validSelection(next, s.selection) };
    }
    case 'select':
      return { ...s, selection: a.ids };
    case 'load':
      return {
        project: a.project,
        past: [],
        future: [],
        selection: [],
        filePath: a.filePath,
        savedProject: a.saved ? a.project : null,
        gestureOrigin: null,
      };
    case 'saved':
      return { ...s, filePath: a.filePath, savedProject: s.project };
    default:
      return s;
  }
}
