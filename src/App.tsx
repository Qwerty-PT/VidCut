import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api } from './api';
import { EditorProvider, type EditorCtx } from './editor-context';
import { initialState, reducer } from './state';
import { addClip, addMedia, deleteClips } from './ops';
import { probeMedia, refreshThumbs } from './media';
import { playhead } from './playhead';
import { isTyping } from './util';
import { newProject, projectDuration, type MediaItem, type Project } from '../shared/types';
import { MediaBin } from './components/MediaBin';
import { Preview } from './components/Preview';
import { Inspector, splitAtPlayhead } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ExportModal, type ExportState } from './components/ExportModal';
import { Icon } from './components/Icon';

type Toast = { id: number; msg: string; kind: 'info' | 'error' };

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [mediaBase, setMediaBase] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const dirty = state.savedProject !== state.project;
  const inElectron = !!window.vidcut;

  const notify = useCallback((msg: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const commit = useCallback<EditorCtx['commit']>((fn, select) => {
    const r = fn(stateRef.current.project);
    const project = 'tracks' in r ? r : r.project;
    const sel = 'tracks' in r ? select : r.select ?? select;
    stateRef.current = { ...stateRef.current, project };
    dispatch({ type: 'apply', project, select: sel });
  }, []);

  // ---------- arranque ----------
  useEffect(() => {
    if (!inElectron) return;
    (async () => {
      const info = await api().info();
      setMediaBase(info.mediaBase);
      const saved = await api().autosaveRead();
      if (saved?.project?.version === 1) {
        dispatch({ type: 'load', project: saved.project, filePath: saved.filePath, saved: !saved.dirty });
        refreshThumbs(saved.project.media, info.mediaBase);
      }
    })().catch((e) => notify(String(e), 'error'));
  }, [inElectron, notify]);

  // gravação automática
  useEffect(() => {
    if (!inElectron || !mediaBase) return;
    const t = setTimeout(() => {
      api().autosaveWrite({ project: state.project, filePath: state.filePath, dirty }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [state.project, state.filePath, dirty, inElectron, mediaBase]);

  useEffect(() => {
    const name = state.filePath ? state.filePath.split(/[\\/]/).pop() : state.project.name;
    document.title = `${dirty ? '• ' : ''}${name} — VidCut`;
  }, [state.project.name, state.filePath, dirty]);

  // ---------- importar ----------
  const importPaths = useCallback<EditorCtx['importPaths']>(async (paths, place) => {
    if (!mediaBase || !paths.length) return;
    await api().registerMedia(paths);
    setBusy(`A ler ${paths.length} ficheiro${paths.length > 1 ? 's' : ''}…`);
    const items: MediaItem[] = [];
    try {
      const existing = new Map(stateRef.current.project.media.map((m) => [m.path, m]));
      for (const p of paths) {
        const known = existing.get(p);
        if (known) { items.push(known); continue; }
        try { items.push(await probeMedia(p, mediaBase)); }
        catch (e) { notify(String((e as Error).message || e), 'error'); }
      }
    } finally { setBusy(null); }
    if (!items.length) return;
    commit((proj) => {
      let p = addMedia(proj, items);
      const select: string[] = [];
      if (place) {
        let start = place.start;
        for (const m of items) {
          const id = p.media.find((x) => x.path === m.path)!.id;
          const r = addClip(p, id, { trackId: place.trackId, start, newTrack: place.newTrack && select.length === 0 });
          p = r.project;
          if (r.clipId) {
            select.push(r.clipId);
            const c = p.tracks.flatMap((t) => t.clips).find((x) => x.id === r.clipId)!;
            start = c.start + c.duration;
            place = { ...place, trackId: p.tracks.find((t) => t.clips.some((x) => x.id === r.clipId))!.id, newTrack: false };
          }
        }
      }
      return { project: p, select: select.length ? select : undefined };
    });
    notify(`${items.length} ficheiro${items.length > 1 ? 's' : ''} importado${items.length > 1 ? 's' : ''}`);
  }, [mediaBase, commit, notify]);

  // ---------- ficheiro ----------
  const confirmDiscard = () => !dirty || confirm('Há alterações por guardar. Continuar sem guardar?');

  const doNew = () => {
    if (!confirmDiscard()) return;
    playhead.seek(0);
    dispatch({ type: 'load', project: newProject(), filePath: null, saved: true });
  };

  const doOpen = async () => {
    if (!confirmDiscard()) return;
    const r = await api().openProject();
    if (!r) return;
    if (r.project?.version !== 1) return notify('Ficheiro de projeto inválido', 'error');
    playhead.seek(0);
    dispatch({ type: 'load', project: r.project, filePath: r.path, saved: true });
    if (mediaBase) refreshThumbs(r.project.media, mediaBase);
  };

  const doSave = async (saveAs = false) => {
    const s = stateRef.current;
    const path = await api().saveProject(s.project, s.filePath, saveAs);
    if (path) { dispatch({ type: 'saved', filePath: path }); notify('Projeto guardado'); }
  };

  const doExport = async () => {
    const p = stateRef.current.project;
    if (p.tracks.every((t) => t.clips.length === 0)) return notify('A timeline está vazia.', 'error');
    playhead.pause();
    const off = api().onExportProgress((progress) => setExporting((e) => (e?.phase === 'running' ? { phase: 'running', progress } : e)));
    setExporting({ phase: 'running', progress: null });
    try {
      const r = await api().exportVideo(p);
      if (r.ok && r.path) setExporting({ phase: 'done', path: r.path });
      else if (r.canceled) setExporting(null);
      else setExporting({ phase: 'error', error: r.error || 'Erro desconhecido' });
    } finally { off(); }
  };

  const doImport = async () => {
    const paths = await api().pickMedia();
    if (paths.length) await importPaths(paths);
  };

  // ---------- atalhos ----------
  const actions = useRef({ doNew, doOpen, doSave, doExport, doImport });
  actions.current = { doNew, doOpen, doSave, doExport, doImport };

  useEffect(() => {
    if (!inElectron) return;
    return api().onMenu((cmd) => {
      const a = actions.current;
      const typing = isTyping({ target: document.activeElement } as unknown as Event);
      switch (cmd) {
        case 'new': a.doNew(); break;
        case 'open': a.doOpen(); break;
        case 'save': a.doSave(false); break;
        case 'saveAs': a.doSave(true); break;
        case 'import': a.doImport(); break;
        case 'export': a.doExport(); break;
        case 'undo': if (typing) document.execCommand('undo'); else dispatch({ type: 'undo' }); break;
        case 'redo': if (typing) document.execCommand('redo'); else dispatch({ type: 'redo' }); break;
      }
    });
  }, [inElectron]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || exporting) return;
      const s = stateRef.current;
      const dur = projectDuration(s.project);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); dispatch({ type: 'redo' }); return; }
      if (mod) return; // resto dos atalhos com Ctrl vem do menu
      switch (e.key) {
        case ' ': e.preventDefault(); playhead.toggle(); break;
        case 's': case 'S': {
          e.preventDefault();
          const r = splitAtPlayhead(s.project, s.selection);
          if (r) commit(() => r);
          break;
        }
        case 'Delete': case 'Backspace':
          if (s.selection.length) { e.preventDefault(); commit((p) => deleteClips(p, s.selection), []); }
          break;
        case 'ArrowLeft': e.preventDefault(); playhead.pause(); playhead.seek(Math.max(0, playhead.frame - (e.shiftKey ? s.project.fps : 1))); break;
        case 'ArrowRight': e.preventDefault(); playhead.pause(); playhead.seek(Math.min(dur - 1, playhead.frame + (e.shiftKey ? s.project.fps : 1))); break;
        case 'Home': e.preventDefault(); playhead.seek(0); break;
        case 'End': e.preventDefault(); playhead.seek(dur - 1); break;
        case 'Escape': dispatch({ type: 'select', ids: [] }); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, exporting]);

  const ctx = useMemo<EditorCtx | null>(
    () => (mediaBase === null ? null : { state, dispatch, commit, mediaBase, importPaths, notify }),
    [state, commit, mediaBase, importPaths, notify],
  );

  if (!inElectron) {
    return (
      <div className="boot">
        <h1>VidCut</h1>
        <p>Esta interface tem de correr dentro da app. Usa <code>npm run dev</code>.</p>
      </div>
    );
  }
  if (!ctx) return <div className="boot"><p>A iniciar…</p></div>;

  return (
    <EditorProvider value={ctx}>
      <div className="app">
        <header className="topbar">
          <div className="brand"><span className="logo" aria-hidden>▶</span> VidCut</div>
          <div className="project-name" title={state.filePath ?? 'Ainda não guardado'}>
            {state.project.name}{dirty && <span className="dirty" title="Alterações por guardar">•</span>}
          </div>
          <div className="top-actions">
            <button className="btn ghost" onClick={doOpen} title="Abrir projeto (Ctrl+O)"><Icon name="open" size={16} /> Abrir</button>
            <button className="btn ghost" onClick={() => doSave(false)} title="Guardar (Ctrl+S)"><Icon name="save" size={16} /> Guardar</button>
            <button className="btn primary" onClick={doExport} title="Exportar MP4 (Ctrl+E)"><Icon name="export" size={16} /> Exportar</button>
          </div>
        </header>

        <main className="workspace">
          <MediaBin />
          <Preview />
          <Inspector />
        </main>

        <Timeline />

        {busy && <div className="busy">{busy}</div>}
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}
        </div>
        {exporting && <ExportModal state={exporting} onClose={() => setExporting(null)} />}
      </div>
    </EditorProvider>
  );
};

export type { Project };
