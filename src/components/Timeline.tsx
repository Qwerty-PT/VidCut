import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { addClip, addTrack, canDetachAudio, deleteClips, detachAudio, findClip, moveClip, reattachAudio, removeTrack, trimClip, updateTrack } from '../ops';
import { playhead, useFrame } from '../playhead';
import { getThumb, onThumbsChange } from '../media';
import { clamp, isTyping, timecode } from '../util';
import { projectDuration, type Clip, type MediaItem, type Project, type Track } from '../../shared/types';
import { MEDIA_DRAG_TYPE } from './MediaBin';
import { splitAtPlayhead } from './Inspector';
import { Icon } from './Icon';

const HEADER_W = 156;
const RULER_H = 30;
const TRACK_H: Record<Track['kind'], number> = { video: 66, audio: 50 };
const SNAP_PX = 8;
const MIN_PPS = 2; // px por segundo
const MAX_PPS = 4000; // ~0,25 s visíveis num ecrã normal

type Gesture = {
  mode: 'move' | 'left' | 'right';
  origin: Clip;
  originTrackId: string;
  kind: Track['kind'];
  x0: number;
  started: boolean;
  snapPoints: number[];
};

function rulerLabel(sec: number, step: number, fps: number): string {
  const tc = timecode(Math.round(sec * fps), fps); // mm:ss.ff
  return step < 1 ? tc : tc.replace(/\.\d+$/, '');
}

function visibleLabel(sec: number): string {
  if (sec < 10) return `${sec.toFixed(sec < 1 ? 2 : 1).replace('.', ',')} s`;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Intervalo entre marcas grandes da régua (em segundos), com passos ao frame quando muito aproximado */
function niceStep(pps: number, fps: number): number {
  const frameSteps = [1, 2, 5, 10].map((n) => n / fps).filter((s) => s < 0.5);
  const steps = [...frameSteps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200];
  return steps.find((s) => s * pps >= 84) ?? 1200;
}

export const Timeline: React.FC = () => {
  const { state, dispatch, commit, importPaths } = useEditor();
  const { project, selection } = state;
  const fps = project.fps;
  const [pps, setPps] = useState(60);
  const [snap, setSnap] = useState(true);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [, forceThumbs] = useState(0);
  const [view, setView] = useState({ left: 0, width: 0 }); // scrollLeft e largura visível da área dos clips
  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => onThumbsChange(() => forceThumbs((n) => n + 1)), []);

  const z = pps / fps; // px por frame
  const duration = projectDuration(project);
  const visW = Math.max(1, (view.width || 1200 - HEADER_W));
  const contentFrames = Math.max(duration + fps * 10, Math.ceil(visW / z));
  const contentW = HEADER_W + contentFrames * z;
  const mediaById = useMemo(() => new Map(project.media.map((m) => [m.id, m])), [project.media]);

  // ---------- coordenadas ----------
  const frameAtClientX = useCallback((clientX: number) => {
    const el = scrollRef.current!;
    const r = el.getBoundingClientRect();
    return (clientX - r.left - HEADER_W + el.scrollLeft) / z;
  }, [z]);

  const trackAtClientY = (clientY: number, kind: Track['kind']): string | null => {
    const rows = scrollRef.current?.querySelectorAll<HTMLElement>('[data-track-id]') ?? [];
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return row.dataset.trackKind === kind ? row.dataset.trackId! : null;
    }
    return null;
  };

  // ---------- zoom ----------
  const zoomTo = useCallback((next: number, anchorClientX?: number) => {
    const el = scrollRef.current;
    const nextPps = clamp(next, MIN_PPS, MAX_PPS);
    if (!el) return setPps(nextPps);
    const r = el.getBoundingClientRect();
    const ax = anchorClientX ?? r.left + HEADER_W + (playhead.frame * (pps / fps)) - el.scrollLeft;
    const frameAtAnchor = (ax - r.left - HEADER_W + el.scrollLeft) / (pps / fps);
    pendingScroll.current = Math.max(0, frameAtAnchor * (nextPps / fps) - (ax - r.left - HEADER_W));
    setPps(nextPps);
  }, [pps, fps]);

  // aplica o scroll depois de a largura do conteúdo mudar com o zoom
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingScroll.current !== null) { el.scrollLeft = pendingScroll.current; pendingScroll.current = null; }
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth - HEADER_W });
  }, [pps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setView({ left: el.scrollLeft, width: el.clientWidth - HEADER_W });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  const zoomFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const avail = el.clientWidth - HEADER_W - 40;
    pendingScroll.current = 0;
    setPps(clamp(avail / (duration / fps), MIN_PPS, MAX_PPS));
  }, [duration, fps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(pps * 1.4); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(pps / 1.4); }
      else if (e.key === '0') { e.preventDefault(); zoomFit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pps, zoomTo, zoomFit]);

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // trackpad (pinça) manda deltas pequenos; roda do rato manda deltas grandes
      zoomTo(pps * Math.exp(-clamp(e.deltaY, -40, 40) * 0.012), e.clientX);
    }
  };

  // acompanhar a cabeça de leitura durante a reprodução
  useEffect(() => playhead.subscribe(() => {
    const el = scrollRef.current;
    if (!el || !playhead.playing || gesture.current) return;
    const x = playhead.frame * z;
    const visW = el.clientWidth - HEADER_W;
    if (x < el.scrollLeft || x > el.scrollLeft + visW - 40) el.scrollLeft = Math.max(0, x - 60);
  }), [z]);

  // ---------- régua / scrub ----------
  const onRulerDown = (e: React.PointerEvent) => {
    playhead.pause();
    const seekTo = (x: number) => playhead.seek(clamp(Math.round(frameAtClientX(x)), 0, duration - 1));
    seekTo(e.clientX);
    const move = (ev: PointerEvent) => seekTo(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- gestos nos clips ----------
  const snapValue = (frame: number, points: number[]): { value: number; snapped: number | null } => {
    if (!snap) return { value: frame, snapped: null };
    let best: number | null = null;
    for (const p of points) if (Math.abs(p - frame) * z <= SNAP_PX && (best === null || Math.abs(p - frame) < Math.abs(best - frame))) best = p;
    return best === null ? { value: frame, snapped: null } : { value: best, snapped: best };
  };

  const onClipDown = (e: React.PointerEvent, clip: Clip, track: Track, mode: Gesture['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (multi) {
      dispatch({ type: 'select', ids: selection.includes(clip.id) ? selection.filter((id) => id !== clip.id) : [...selection, clip.id] });
      return;
    }
    if (!selection.includes(clip.id) || selection.length > 1) dispatch({ type: 'select', ids: [clip.id] });

    const points = new Set<number>([0, playhead.frame]);
    for (const t of projectRef.current.tracks) for (const c of t.clips) if (c.id !== clip.id) { points.add(c.start); points.add(c.start + c.duration); }
    gesture.current = { mode, origin: clip, originTrackId: track.id, kind: track.kind, x0: e.clientX, started: false, snapPoints: [...points] };

    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      if (!g.started) {
        if (Math.abs(ev.clientX - g.x0) < 3 && g.mode !== 'move') return;
        if (Math.abs(ev.clientX - g.x0) < 3 && trackAtClientY(ev.clientY, g.kind) === g.originTrackId) return;
        g.started = true;
        playhead.pause();
        dispatch({ type: 'beginGesture' });
      }
      const dx = (ev.clientX - g.x0) / z;
      if (g.mode === 'move') {
        const desired = Math.max(0, Math.round(g.origin.start + dx));
        const a = snapValue(desired, g.snapPoints);
        const b = snapValue(desired + g.origin.duration, g.snapPoints);
        let start = desired;
        let line: number | null = null;
        if (a.snapped !== null && (b.snapped === null || Math.abs(a.value - desired) <= Math.abs(b.value - (desired + g.origin.duration)))) { start = a.value; line = a.snapped; }
        else if (b.snapped !== null) { start = b.value - g.origin.duration; line = b.snapped; }
        const toTrack = trackAtClientY(ev.clientY, g.kind) ?? findClip(projectRef.current, g.origin.id)?.track.id ?? g.originTrackId;
        setSnapLine(line);
        dispatch({ type: 'gesture', fn: (p) => moveClip(p, g.origin.id, toTrack, start) });
      } else {
        const edge0 = g.mode === 'left' ? g.origin.start : g.origin.start + g.origin.duration;
        const s = snapValue(Math.round(edge0 + dx), g.snapPoints);
        setSnapLine(s.snapped);
        dispatch({ type: 'gesture', fn: (p) => trimClip(p, g.origin, g.mode as 'left' | 'right', s.value - edge0) });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (gesture.current?.started) dispatch({ type: 'endGesture' });
      gesture.current = null;
      setSnapLine(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onClipMenu = (e: React.MouseEvent, clip: Clip) => {
    e.preventDefault();
    if (!selection.includes(clip.id)) dispatch({ type: 'select', ids: [clip.id] });
    setMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onKey); window.removeEventListener('blur', close); };
  }, [menu]);

  // ---------- barra de navegação (scroll + zoom pelas pegas) ----------
  const navRef = useRef<HTMLDivElement>(null);
  const laneW = contentFrames * z;
  const thumbL = laneW > 0 ? view.left / laneW : 0;
  const thumbW = laneW > 0 ? Math.min(1, visW / laneW) : 1;

  const onNavDown = (e: React.PointerEvent, part: 'thumb' | 'left' | 'right' | 'track') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    const bar = navRef.current;
    if (!el || !bar) return;
    const barW = bar.getBoundingClientRect().width;
    const T = contentFrames; // escala fixa durante o gesto
    const fpp = T / barW; // frames por pixel da barra
    const vis = el.clientWidth - HEADER_W;
    const start0 = el.scrollLeft / z;
    const end0 = (el.scrollLeft + vis) / z;
    const x0 = e.clientX;
    const minSpan = (vis / MAX_PPS) * fps;
    const maxSpan = (vis / MIN_PPS) * fps;

    if (part === 'track') {
      // clique fora do polegar: centra a vista nesse ponto
      const r = bar.getBoundingClientRect();
      const f = (e.clientX - r.left) * fpp;
      el.scrollLeft = Math.max(0, (f - (end0 - start0) / 2) * z);
      return;
    }
    const move = (ev: PointerEvent) => {
      const df = (ev.clientX - x0) * fpp;
      if (part === 'thumb') {
        el.scrollLeft = Math.max(0, (start0 + df) * z);
        return;
      }
      let a = start0, b = end0;
      if (part === 'right') b = clamp(end0 + df, a + minSpan, a + maxSpan);
      else a = Math.max(0, clamp(start0 + df, b - maxSpan, b - minSpan));
      const nextPps = clamp(vis / ((b - a) / fps), MIN_PPS, MAX_PPS);
      pendingScroll.current = a * (nextPps / fps);
      setPps(nextPps);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('dragging-nav'); };
    document.body.classList.add('dragging-nav');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onLaneDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dispatch({ type: 'select', ids: [] });
    playhead.pause();
    playhead.seek(clamp(Math.round(frameAtClientX(e.clientX)), 0, duration - 1));
  };

  // ---------- largar media ----------
  const acceptsDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(MEDIA_DRAG_TYPE) || e.dataTransfer.types.includes('Files');

  const onDrop = async (e: React.DragEvent, trackId: string | undefined, newTrack = false) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const start = Math.max(0, Math.round(frameAtClientX(e.clientX)));
    const mediaId = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
    if (mediaId) {
      commit((p) => {
        const r = addClip(p, mediaId, { trackId, start, newTrack, magnet: snap });
        return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
      });
    } else if (e.dataTransfer.files.length) {
      const paths = Array.from(e.dataTransfer.files).map((f) => window.vidcut?.pathForFile(f) ?? '').filter(Boolean);
      await importPaths(paths, { trackId, start, newTrack, magnet: snap });
    }
  };

  const dragProps = (id: string, trackId: string | undefined, newTrack = false) => ({
    onDragOver: (e: React.DragEvent) => { if (acceptsDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropTarget(id); } },
    onDragLeave: () => setDropTarget((d) => (d === id ? null : d)),
    onDrop: (e: React.DragEvent) => onDrop(e, trackId, newTrack),
  });

  // ---------- render ----------
  const step = niceStep(pps, fps);
  const ticks: React.ReactNode[] = [];
  const totalSec = contentFrames / fps;
  // só as marcas visíveis (com margem), para aguentar zoom ao frame em projetos longos
  // subdivisões: 5 por marca, ou uma por frame quando a marca vale menos de 5 frames
  const div = step * fps < 5 ? Math.max(1, Math.round(step * fps)) : 5;
  const minor = step / div;
  const firstTick = Math.max(0, Math.floor((view.left / pps - step) / minor));
  const lastTick = Math.ceil(Math.min(totalSec, (view.left + visW) / pps + step) / minor);
  for (let i = firstTick - (firstTick % div); i <= lastTick; i++) {
    const s = i * minor;
    const major = i % div === 0;
    const x = s * pps;
    ticks.push(
      <div key={i} className={`tick${major ? ' major' : ''}`} style={{ left: x }}>
        {major && <span>{rulerLabel(s, step, fps)}</span>}
      </div>,
    );
  }

  const tracksHeight = project.tracks.reduce((h, t) => h + TRACK_H[t.kind], 0);

  return (
    <section className="timeline">
      <div className="tl-toolbar">
        <div className="tl-tools">
          <button className="icon-btn" title="Desfazer (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}><Icon name="undo" /></button>
          <button className="icon-btn" title="Refazer (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}><Icon name="redo" /></button>
          <span className="sep" />
          <button className="icon-btn" title="Dividir na cabeça de leitura (S)" onClick={() => { const r = splitAtPlayhead(project, selection); if (r) commit(() => r); }}><Icon name="split" /></button>
          <button className="icon-btn" title="Apagar seleção (Delete)" disabled={!selection.length} onClick={() => commit((p) => deleteClips(p, selection), [])}><Icon name="trash" /></button>
          <span className="sep" />
          <button className={`icon-btn${snap ? ' on' : ''}`} title="Íman: encaixar em clips e na cabeça de leitura" onClick={() => setSnap(!snap)}><Icon name="magnet" /></button>
        </div>
        <div className="tl-zoom">
          <button className="icon-btn" title="Afastar (-)" onClick={() => zoomTo(pps / 1.4)}><Icon name="minus" /></button>
          <input
            type="range" min={Math.log(MIN_PPS)} max={Math.log(MAX_PPS)} step={0.01} value={Math.log(pps)}
            onChange={(e) => zoomTo(Math.exp(Number(e.target.value)))} title="Zoom da timeline"
          />
          <button className="icon-btn" title="Aproximar (+)" onClick={() => zoomTo(pps * 1.4)}><Icon name="plus" /></button>
          <button className="icon-btn" title="Ajustar ao projeto (0)" onClick={zoomFit}><Icon name="zoomFit" /></button>
        </div>
      </div>

      <div className="tl-scroll" ref={scrollRef} onWheel={onWheel}>
        <div className="tl-content" style={{ width: contentW }}>
          <div className="tl-ruler-row" style={{ height: RULER_H }}>
            <div className="tl-corner" style={{ width: HEADER_W }} />
            <div className="tl-ruler" onPointerDown={onRulerDown}>{ticks}</div>
          </div>

          {project.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              project={project}
              mediaById={mediaById}
              z={z}
              selection={selection}
              dropActive={dropTarget === track.id}
              onClipDown={onClipDown}
              onClipMenu={onClipMenu}
              onLaneDown={onLaneDown}
              dragProps={dragProps(track.id, track.id)}
              onToggle={(patch) => commit((p) => updateTrack(p, track.id, patch))}
              onRemove={() => commit((p) => removeTrack(p, track.id))}
            />
          ))}

          <div className="tl-new-track" {...dragProps('__new', undefined, true)}>
            <div className="tl-new-head" style={{ width: HEADER_W }}>
              <button className="btn tiny" onClick={() => commit((p) => addTrack(p, 'video').project)}><Icon name="plus" size={14} /> Vídeo</button>
              <button className="btn tiny" onClick={() => commit((p) => addTrack(p, 'audio').project)}><Icon name="plus" size={14} /> Áudio</button>
            </div>
            <div className={`tl-new-lane${dropTarget === '__new' ? ' drop' : ''}`} onPointerDown={onLaneDown}>
              {project.tracks.every((t) => t.clips.length === 0) ? 'Arrasta media para a timeline' : 'Larga aqui para criar uma pista nova'}
            </div>
          </div>

          {snapLine !== null && <div className="tl-snapline" style={{ left: HEADER_W + snapLine * z, top: RULER_H, height: tracksHeight }} />}
          <Playhead z={z} height={RULER_H + tracksHeight} />
        </div>
      </div>

      <div className="tl-nav">
        <div className="tl-nav-label" style={{ width: HEADER_W }}>{visibleLabel(visW / pps)} visíveis</div>
        <div className="tl-nav-track" ref={navRef} onPointerDown={(e) => onNavDown(e, 'track')} title="Arrasta para navegar; arrasta as pontas para aproximar/afastar">
          <div className="tl-nav-thumb" style={{ left: `${thumbL * 100}%`, width: `${thumbW * 100}%` }} onPointerDown={(e) => onNavDown(e, 'thumb')}>
            <div className="tl-nav-grip left" onPointerDown={(e) => onNavDown(e, 'left')} title="Arrasta para aproximar/afastar" />
            <div className="tl-nav-grip right" onPointerDown={(e) => onNavDown(e, 'right')} title="Arrasta para aproximar/afastar" />
          </div>
        </div>
      </div>

      {menu && (() => {
        const f = findClip(project, menu.clipId);
        if (!f) return null;
        const under = playhead.frame > f.clip.start && playhead.frame < f.clip.start + f.clip.duration;
        const run = (fn: () => void) => (e: React.PointerEvent) => { e.stopPropagation(); fn(); setMenu(null); };
        return (
          <div className="ctx-menu" style={{ left: Math.min(menu.x, window.innerWidth - 256), top: Math.min(menu.y, window.innerHeight - 150) }} onPointerDown={(e) => e.stopPropagation()} role="menu">
            <button role="menuitem" disabled={!under} onPointerDown={run(() => { const r = splitAtPlayhead(project, [menu.clipId]); if (r) commit(() => r); })}>
              <Icon name="split" size={15} /> Dividir na cabeça de leitura <kbd>S</kbd>
            </button>
            {canDetachAudio(project, menu.clipId) && (
              <button role="menuitem" onPointerDown={run(() => commit((p) => { const r = detachAudio(p, menu.clipId); return { project: r.project, select: r.clipId ? [r.clipId] : undefined }; }))}>
                <Icon name="unlink" size={15} /> Separar áudio
              </button>
            )}
            {f.clip.audioDetached && (
              <button role="menuitem" onPointerDown={run(() => commit((p) => reattachAudio(p, menu.clipId)))}>
                <Icon name="link" size={15} /> Voltar a juntar o áudio
              </button>
            )}
            <div className="ctx-sep" />
            <button role="menuitem" className="danger" onPointerDown={run(() => commit((p) => deleteClips(p, selection.includes(menu.clipId) ? selection : [menu.clipId]), []))}>
              <Icon name="trash" size={15} /> Apagar <kbd>Del</kbd>
            </button>
          </div>
        );
      })()}
    </section>
  );
};

const Playhead: React.FC<{ z: number; height: number }> = ({ z, height }) => {
  const frame = useFrame();
  return <div className="tl-playhead" style={{ transform: `translateX(${HEADER_W + frame * z}px)`, height }} />;
};

interface TrackRowProps {
  track: Track;
  project: Project;
  mediaById: Map<string, MediaItem>;
  z: number;
  selection: string[];
  dropActive: boolean;
  onClipDown: (e: React.PointerEvent, clip: Clip, track: Track, mode: 'move' | 'left' | 'right') => void;
  onClipMenu: (e: React.MouseEvent, clip: Clip) => void;
  onLaneDown: (e: React.PointerEvent) => void;
  dragProps: Record<string, unknown>;
  onToggle: (patch: Partial<Track>) => void;
  onRemove: () => void;
}

const TrackRow: React.FC<TrackRowProps> = ({ track, mediaById, z, selection, dropActive, onClipDown, onClipMenu, onLaneDown, dragProps, onToggle, onRemove, project }) => {
  const isVideo = track.kind === 'video';
  return (
    <div className={`tl-row kind-${track.kind}`} style={{ height: TRACK_H[track.kind] }} data-track-id={track.id} data-track-kind={track.kind}>
      <div className="tl-head" style={{ width: HEADER_W }}>
        <span className="tl-head-icon"><Icon name={isVideo ? 'film' : 'music'} size={15} /></span>
        <span className="tl-head-name">{track.name}</span>
        <div className="tl-head-btns">
          {isVideo && (
            <button className={`icon-btn mini${track.hidden ? ' off' : ''}`} title={track.hidden ? 'Mostrar pista' : 'Esconder pista'} onClick={() => onToggle({ hidden: !track.hidden })}>
              <Icon name={track.hidden ? 'eyeOff' : 'eye'} size={15} />
            </button>
          )}
          <button className={`icon-btn mini${track.muted ? ' off' : ''}`} title={track.muted ? 'Ativar som' : 'Silenciar pista'} onClick={() => onToggle({ muted: !track.muted })}>
            <Icon name={track.muted ? 'mute' : 'volume'} size={15} />
          </button>
          {track.clips.length === 0 && project.tracks.filter((t) => t.kind === track.kind).length > 1 && (
            <button className="icon-btn mini" title="Remover pista vazia" onClick={onRemove}><Icon name="x" size={14} /></button>
          )}
        </div>
      </div>
      <div className={`tl-lane${dropActive ? ' drop' : ''}${track.hidden || track.muted ? ' dimmed' : ''}`} onPointerDown={onLaneDown} {...dragProps}>
        {track.clips.map((clip) => {
          const media = mediaById.get(clip.mediaId);
          return (
            <ClipView
              key={clip.id}
              clip={clip}
              media={media}
              trackKind={track.kind}
              z={z}
              selected={selection.includes(clip.id)}
              onDown={(e, mode) => onClipDown(e, clip, track, mode)}
              onMenu={(e) => onClipMenu(e, clip)}
            />
          );
        })}
      </div>
    </div>
  );
};

const ClipView: React.FC<{
  clip: Clip;
  media?: MediaItem;
  trackKind: Track['kind'];
  z: number;
  selected: boolean;
  onDown: (e: React.PointerEvent, mode: 'move' | 'left' | 'right') => void;
  onMenu: (e: React.MouseEvent) => void;
}> = React.memo(({ clip, media, trackKind, z, selected, onDown, onMenu }) => {
  const w = Math.max(2, clip.duration * z);
  const thumb = media ? getThumb(media.path) : undefined;
  // um vídeo numa pista de áudio (som separado) desenha-se como áudio
  const kind = trackKind === 'audio' ? 'audio' : media?.kind ?? 'video';
  const fi = clip.fadeIn * z;
  const fo = clip.fadeOut * z;
  return (
    <div
      className={`clip kind-${kind}${selected ? ' selected' : ''}${media ? '' : ' missing'}`}
      style={{ left: clip.start * z, width: w, backgroundImage: thumb && kind !== 'audio' ? `url(${thumb})` : undefined }}
      onPointerDown={(e) => onDown(e, 'move')}
      onContextMenu={onMenu}
      title={media?.name}
    >
      {kind === 'audio' && <div className="clip-wave" />}
      {(fi > 0 || fo > 0) && (
        <svg className="clip-fades" width={w} height="100%" viewBox={`0 0 ${w} 100`} preserveAspectRatio="none">
          {fi > 0 && <polygon points={`0,0 ${fi},0 0,100`} />}
          {fo > 0 && <polygon points={`${w},0 ${w - fo},0 ${w},100`} />}
        </svg>
      )}
      {w > 36 && <span className="clip-name">{media?.name ?? 'Ficheiro em falta'}</span>}
      {clip.audioDetached && w > 60 && <span className="clip-badge" title="Som separado para uma pista de áudio"><Icon name="mute" size={11} /></span>}
      {!clip.audioDetached && clip.volume !== 1 && w > 80 && kind !== 'image' && <span className="clip-badge">{Math.round(clip.volume * 100)}%</span>}
      <div className="clip-handle left" onPointerDown={(e) => onDown(e, 'left')} />
      <div className="clip-handle right" onPointerDown={(e) => onDown(e, 'right')} />
    </div>
  );
});
ClipView.displayName = 'ClipView';
