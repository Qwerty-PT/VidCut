import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { acceptsEffects, addEffect, FREEZE_SEC, addMedia, freezeFrame, sourceTimeAt, addLottieClip, rippleDelete, moveClips, moveKeyframe, addClip, addTemplateClip, addTextClip, addTrack, canDetachAudio, deleteClips, detachAudio, findClip, moveClip, reattachAudio, removeTrack, setTransition, transitionSelId, trimClip, updateClip, updateTrack } from '../ops';
import { getLottieEntry } from '../lottie-registry';
import { openCaptions } from '../captions-ui';
import { getTemplateTheme } from '../template-theme';
import { LOTTIE_DRAG_TYPE } from './LottieLibrary';
import { EFFECT_DRAG_TYPE } from './EffectsLibrary';
import { getEffect } from '../../shared/effects';
import { maxTransition, prevAdjacent, splitDuration, transitionLabel } from '../../shared/transitions';
import { playhead, useFrame } from '../playhead';
import { getThumb, onThumbsChange, probeMedia } from '../media';
import { api } from '../api';
import { clamp, isTyping, timecode } from '../util';
import { projectDuration, type Clip, type Keyframe, type MediaItem, type Project, type Track } from '../../shared/types';
import { MEDIA_DRAG_TYPE, TEMPLATE_DRAG_TYPE } from './MediaBin';
import { getTemplate } from '../../shared/templates';
import { cutAtPlayhead, splitAtPlayhead } from './Inspector';
import { Icon } from './Icon';
import { NarrationButton, NarrationPanel } from './Narration';
import { usePeaks, wavePath } from '../peaks';
import { canUnreverse, addVolKey, allBeatFrames, clipBeatFrames, hasSound, moveVolKey, removeVolKey, addStickerClip } from '../ops';
import { volumeAt } from '../../shared/volume';
import { reverseClip, detectBeats, normalizeClips, splitOnBeats, splitScenes, syncToBeats, denoiseClip, duckMusic, replaceWithFile, replaceWithMedia, restoreOriginalSound } from '../analysis-ui';
import { openModal } from '../modals';
import { STICKER_DRAG_TYPE, getDraggedSticker } from './StickerLibrary';
import { SOUND_DRAG_TYPE, getDraggedSound, addLibrarySound } from './SoundLibrary';
import type { Action } from '../state';
import { clipSpeed } from '../../shared/types';

const HEADER_W = 156;
/** A linha de volume está a ser arrastada: o clip não se mexe */
let volDrag = false;
const RULER_H = 30;
const TRACK_H: Record<Track['kind'], number> = { video: 66, audio: 50, text: 40 };
const SNAP_PX = 8;
const MIN_PPS = 2; // px por segundo
const MAX_PPS = 4000; // ~0,25 s visíveis num ecrã normal

type ClipMode = 'move' | 'left' | 'right' | 'fadeIn' | 'fadeOut';

type Gesture = {
  mode: ClipMode;
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
  const { state, dispatch, commit, importPaths, mediaBase, notify } = useEditor();

  const [narr, setNarr] = useState(false);
  /** Clip de vídeo a congelar: o selecionado (se estiver na agulha) ou o de cima que está na agulha */
  const freezeTarget = (preferId?: string): Clip | null => {
    const at = playhead.frame;
    const isVid = (c: Clip) => state.project.media.find((m) => m.id === c.mediaId)?.kind === 'video' && at >= c.start && at < c.start + c.duration;
    const ids = preferId ? [preferId] : state.selection;
    for (const id of ids) { const f = findClip(state.project, id); if (f && isVid(f.clip)) return f.clip; }
    if (preferId) return null;
    for (const t of state.project.tracks) { if (t.kind !== 'video' || t.hidden) continue; const c = t.clips.find(isVid); if (c) return c; }
    return null;
  };
  const doFreeze = async (preferId?: string) => {
    const clip = freezeTarget(preferId);
    if (!clip) { notify('Põe a agulha por cima de um clip de vídeo para congelar o fotograma.', 'error'); return; }
    const media = state.project.media.find((m) => m.id === clip.mediaId)!;
    const at = playhead.frame;
    const t = sourceTimeAt(state.project, clip.id, at) ?? 0;
    const r = await api().extractFrame(media.path, t);
    if (!r.path) { notify(r.error || 'Não foi possível congelar o fotograma.', 'error'); return; }
    let item: MediaItem;
    try { item = await probeMedia(r.path, mediaBase); } catch (e) { notify(String((e as Error).message || e), 'error'); return; }
    item = { ...item, name: `Congelado · ${media.name}` };
    const dur = Math.round(FREEZE_SEC * state.project.fps);
    commit((p) => {
      const p1 = addMedia(p, [item]);
      const mid = p1.media.find((m) => m.path === item.path)!.id;
      const res = freezeFrame(p1, clip.id, at, mid, dur);
      return { project: res.project, select: res.clipId ? [res.clipId] : undefined };
    });
    notify(`Fotograma congelado durante ${FREEZE_SEC} s. Estica ou encolhe a imagem na timeline.`);
  };
  const { project, selection } = state;
  const fps = project.fps;
  const [pps, setPps] = useState(60);
  const [snap, setSnap] = useState(true);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [, forceThumbs] = useState(0);
  const [view, setView] = useState({ left: 0, width: 0, height: 0 }); // scrollLeft e largura visível da área dos clips
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
    if (el) setView({ left: el.scrollLeft, width: el.clientWidth - HEADER_W, height: el.clientHeight });
  }, [pps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setView({ left: el.scrollLeft, width: el.clientWidth - HEADER_W, height: el.clientHeight });
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
  /**
   * Régua do tempo: clicar → a agulha salta; arrastar na horizontal → scrub;
   * arrastar na vertical → zoom (para cima aproxima, para baixo afasta), ancorado no ponto clicado.
   * A direção decide-se nos primeiros píxeis e mantém-se até largar.
   */
  const onRulerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    playhead.pause();
    const x0 = e.clientX, y0 = e.clientY;
    const startPps = pps;
    const anchorFrame = frameAtClientX(x0);
    let mode: 'undecided' | 'scrub' | 'zoom' = 'undecided';
    const seekTo = (x: number) => playhead.seek(clamp(Math.round(frameAtClientX(x)), 0, duration - 1));
    const zoomAt = (dy: number) => {
      const el = scrollRef.current;
      const next = clamp(startPps * Math.pow(2, -dy / 70), MIN_PPS, MAX_PPS); // 70 px = 2×
      if (el) {
        const r = el.getBoundingClientRect();
        pendingScroll.current = Math.max(0, anchorFrame * (next / fps) - (x0 - r.left - HEADER_W));
      }
      setPps(next);
    };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (mode === 'undecided') {
        if (Math.hypot(dx, dy) < 5) return;
        mode = Math.abs(dy) > Math.abs(dx) ? 'zoom' : 'scrub';
        document.body.classList.add(mode === 'zoom' ? 'tl-zooming' : 'scrubbing');
      }
      if (mode === 'scrub') seekTo(ev.clientX);
      else zoomAt(dy);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('scrubbing', 'tl-zooming');
      if (mode === 'undecided') seekTo(ev.clientX); // foi um clique
    };
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
    // vários clips selecionados e arrastar um deles: move o grupo todo
    const selClips = selection.filter((id) => !id.startsWith('tr:'));
    if (mode === 'move' && selClips.includes(clip.id) && selClips.length > 1) {
      onGroupDown(e, clip, selClips);
      return;
    }
    if (!selection.includes(clip.id) || selection.length > 1) dispatch({ type: 'select', ids: [clip.id] });

    const points = new Set<number>([0, playhead.frame, ...allBeatFrames(projectRef.current)]);
    for (const t of projectRef.current.tracks) for (const c of t.clips) if (c.id !== clip.id) { points.add(c.start); points.add(c.start + c.duration); }
    gesture.current = { mode, origin: clip, originTrackId: track.id, kind: track.kind, x0: e.clientX, started: false, snapPoints: [...points] };

    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g || volDrag) return;
      if (!g.started) {
        if (Math.abs(ev.clientX - g.x0) < 2 && g.mode !== 'move') return;
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
      } else if (g.mode === 'fadeIn' || g.mode === 'fadeOut') {
        const max = Math.floor(g.origin.duration / 2);
        const key = g.mode;
        const v = clamp(Math.round(key === 'fadeIn' ? g.origin.fadeIn + dx : g.origin.fadeOut - dx), 0, max);
        setSnapLine(null);
        dispatch({ type: 'gesture', fn: (p) => updateClip(p, g.origin.id, { [key]: v }) });
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

  // losangos de keyframe: clicar salta para o keyframe; arrastar move-o
  const onKeyframeDown = (e: React.PointerEvent, clip: Clip, kf: Keyframe) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    playhead.pause();
    playhead.seek(clip.start + kf.frame);
    const x0 = e.clientX;
    let started = false;
    const move = (ev: PointerEvent) => {
      const df = Math.round((ev.clientX - x0) / z);
      if (!started) { if (Math.abs(ev.clientX - x0) < 3) return; started = true; dispatch({ type: 'beginGesture' }); }
      const fr = clamp(kf.frame + df, 0, clip.duration - 1);
      dispatch({ type: 'gesture', fn: (p) => moveKeyframe(p, clip.id, kf.id, fr) });
      playhead.seek(clip.start + fr);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (started) dispatch({ type: 'endGesture' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Arrastar um grupo de clips selecionados (mantém pistas; não salta por cima de outros) */
  const onGroupDown = (e: React.PointerEvent, clip: Clip, ids: string[]) => {
    const set = new Set(ids);
    const points = new Set<number>([0, playhead.frame, ...allBeatFrames(projectRef.current)]);
    for (const t of projectRef.current.tracks) for (const c of t.clips) if (!set.has(c.id)) { points.add(c.start); points.add(c.start + c.duration); }
    const pts = [...points];
    const x0 = e.clientX;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) { if (Math.abs(ev.clientX - x0) < 3) return; started = true; playhead.pause(); dispatch({ type: 'beginGesture' }); }
      let d = Math.round((ev.clientX - x0) / z);
      const a = snapValue(clip.start + d, pts), b = snapValue(clip.start + clip.duration + d, pts);
      let line: number | null = null;
      if (a.snapped !== null) { d = a.value - clip.start; line = a.snapped; } else if (b.snapped !== null) { d = b.value - clip.start - clip.duration; line = b.snapped; }
      setSnapLine(line);
      dispatch({ type: 'gesture', fn: (p) => moveClips(p, ids, d) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSnapLine(null);
      if (started) dispatch({ type: 'endGesture' });
      else dispatch({ type: 'select', ids: [clip.id] }); // clique simples: fica só este
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // clique numa zona vazia: move a cabeça de leitura; arrastar: seleção em retângulo
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const onLaneDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = additive ? selection.filter((id) => !id.startsWith('tr:')) : [];
    if (!additive) dispatch({ type: 'select', ids: [] });
    playhead.pause();
    playhead.seek(clamp(Math.round(frameAtClientX(e.clientX)), 0, duration - 1));
    const x0 = e.clientX, y0 = e.clientY;
    let active = false;
    const move = (ev: PointerEvent) => {
      if (!active) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; active = true; }
      const r = { x0: Math.min(x0, ev.clientX), y0: Math.min(y0, ev.clientY), x1: Math.max(x0, ev.clientX), y1: Math.max(y0, ev.clientY) };
      setMarquee(r);
      const hit: string[] = [];
      scrollRef.current?.querySelectorAll<HTMLElement>('[data-clip-id]').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.right >= r.x0 && b.left <= r.x1 && b.bottom >= r.y0 && b.top <= r.y1) hit.push(el.dataset.clipId!);
      });
      dispatch({ type: 'select', ids: [...new Set([...base, ...hit])] });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- largar media ----------
  const acceptsDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(MEDIA_DRAG_TYPE) || e.dataTransfer.types.includes(TEMPLATE_DRAG_TYPE) || e.dataTransfer.types.includes(LOTTIE_DRAG_TYPE) || e.dataTransfer.types.includes(EFFECT_DRAG_TYPE) || e.dataTransfer.types.includes(STICKER_DRAG_TYPE) || e.dataTransfer.types.includes(SOUND_DRAG_TYPE) || e.dataTransfer.types.includes('Files');

  const onDrop = async (e: React.DragEvent, trackId: string | undefined, newTrack = false) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const start = Math.max(0, Math.round(frameAtClientX(e.clientX)));
    const mediaId = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
    const templateId = e.dataTransfer.getData(TEMPLATE_DRAG_TYPE);
    const lottieId = e.dataTransfer.getData(LOTTIE_DRAG_TYPE);
    const lottieEntry = lottieId ? getLottieEntry(lottieId) : undefined;
    const effectId = e.dataTransfer.getData(EFFECT_DRAG_TYPE);
    const sticker = e.dataTransfer.types.includes(STICKER_DRAG_TYPE) ? getDraggedSticker() : null;
    if (sticker) {
      const tr = project.tracks.find((t) => t.id === trackId);
      commit((p) => {
        const r = addStickerClip(p, sticker, start, { trackId: tr?.kind === 'video' ? trackId : undefined, newTrack, magnet: snap });
        return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
      });
      return;
    }
    const sound = e.dataTransfer.types.includes(SOUND_DRAG_TYPE) ? getDraggedSound() : null;
    if (sound) {
      const tr = project.tracks.find((t) => t.id === trackId);
      await addLibrarySound({ commit, notify, mediaBase }, sound, start, tr?.kind === 'audio' ? trackId : undefined);
      return;
    }
    if (effectId) {
      // efeito largado em cima de um clip: aplica-se a esse clip
      const tr = project.tracks.find((t) => t.id === trackId);
      const target = tr?.clips.find((c) => start >= c.start && start < c.start + c.duration);
      const def = getEffect(effectId);
      if (!def) return;
      if (!target || !acceptsEffects(project, target.id)) { notify('Larga o efeito em cima de um clip de vídeo, imagem, modelo ou animação.', 'error'); return; }
      commit((p) => ({ project: addEffect(p, target.id, effectId, def.intensity), select: [target.id] }));
      notify(`Efeito "${def.name}" aplicado. Ajusta a intensidade no separador Cor · Fx.`);
      return;
    }
    if (lottieEntry) {
      commit((p) => {
        const r = addLottieClip(p, { id: lottieEntry.id, name: lottieEntry.name, data: lottieEntry.data }, start, { trackId, newTrack, magnet: snap });
        return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
      });
    } else if (templateId) {
      commit((p) => {
        const r = addTemplateClip(p, templateId, start, { trackId, newTrack, magnet: snap, theme: getTemplateTheme() });
        return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
      });
    } else if (mediaId) {
      // largado em cima de um espaço de modelo: preenche-o
      const tr = project.tracks.find((t) => t.id === trackId);
      const under = tr?.clips.find((c) => start >= c.start && start < c.start + c.duration);
      if (under?.placeholder) { replaceWithMedia({ project, commit, notify }, under.id, mediaId); return; }
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
      {narr && <NarrationPanel onClose={() => setNarr(false)} />}
      <div className="tl-toolbar">
        <div className="tl-tools">
          <button className="icon-btn" title="Desfazer (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}><Icon name="undo" /></button>
          <button className="icon-btn" title="Refazer (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}><Icon name="redo" /></button>
          <span className="sep" />
          <button className="icon-btn" title="Dividir na cabeça de leitura (S)" onClick={() => { const r = splitAtPlayhead(project, selection); if (r) commit(() => r); }}><Icon name="split" /></button>
          <button className="icon-btn" title="Eliminar à esquerda da cabeça de leitura (Q)" onClick={() => { const r = cutAtPlayhead(project, selection, 'left'); if (r) { commit(() => r.project); playhead.seek(r.seekTo); } }}><Icon name="cutLeft" /></button>
          <button className="icon-btn" title="Eliminar à direita da cabeça de leitura (W)" onClick={() => { const r = cutAtPlayhead(project, selection, 'right'); if (r) commit(() => r.project); }}><Icon name="cutRight" /></button>
          <button className="icon-btn" title={`Congelar fotograma na agulha (${FREEZE_SEC} s)`} onClick={() => doFreeze()}><Icon name="freeze" /></button>
          <button className="icon-btn" title="Apagar seleção (Delete)" disabled={!selection.length} onClick={() => commit((p) => deleteClips(p, selection), [])}><Icon name="trash" /></button>
          <span className="sep" />
          <NarrationButton active={narr} onOpen={() => setNarr((v) => !v)} />
          <span className="sep" />
          <button className={`icon-btn${snap ? ' on' : ''}`} title="Íman: encaixar em clips e na cabeça de leitura" onClick={() => setSnap(!snap)}><Icon name="magnet" /></button>
          <span className="sep" />
          <button className="btn small" title="Adicionar texto na cabeça de leitura (T)" onClick={() => commit((p) => { const r = addTextClip(p, playhead.frame); return { project: r.project, select: [r.clipId] }; })}>
            <Icon name="type" size={15} /> Texto
          </button>
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
            <div className="tl-ruler" onPointerDown={onRulerDown} onDoubleClick={zoomFit} title="Clica para mover a agulha · arrasta ↔ para percorrer · arrasta ↕ para aproximar/afastar · duplo clique ajusta ao projeto">
              {ticks}
              <PlayheadHandle z={z} onDown={onRulerDown} />
            </div>
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
              onKeyframeDown={onKeyframeDown}
              dispatch={dispatch}
              onSelectTransition={(id) => { playhead.pause(); dispatch({ type: 'select', ids: [transitionSelId(id)] }); }}
              onAddTransition={(clip, prev) => commit((p) => setTransition(p, clip.id, { type: 'dissolve', duration: clamp(Math.round(fps * 0.5), 2, maxTransition(prev, clip)) }), [transitionSelId(clip.id)])}
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
          <Playhead z={z} top={RULER_H} height={Math.max(tracksHeight + 44, view.height - RULER_H)} onDown={onRulerDown} />
        </div>
      </div>

      {marquee && <div className="tl-marquee" style={{ left: marquee.x0, top: marquee.y0, width: marquee.x1 - marquee.x0, height: marquee.y1 - marquee.y0 }} />}
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
        const ctx = { project, commit, notify };
        const sel = selection.includes(menu.clipId) ? selection : [menu.clipId];
        const close = (fn: () => void) => (e: React.PointerEvent) => { e.stopPropagation(); fn(); setMenu(null); };
        const menuExtras = (clip: Clip) => {
          const m = project.media.find((x) => x.id === clip.mediaId);
          const sound = hasSound(project, clip.id) || (m?.kind === 'audio');
          const beats = clipBeatFrames(project, clip).length > 0;
          const anyBeats = allBeatFrames(project).length > 0;
          const visual = !!findClip(project, clip.id) && findClip(project, clip.id)!.track.kind === 'video';
          return (
            <>
              {(sound || m?.kind === 'video') && <div className="ctx-sep" />}
              {sound && (
                <button role="menuitem" onPointerDown={close(() => { void normalizeClips(ctx, sel); })}>
                  <Icon name="volume" size={15} /> Normalizar volume{sel.length > 1 ? ` (${sel.length})` : ''}
                </button>
              )}
              {m && m.kind !== 'image' && (
                <button role="menuitem" onPointerDown={close(() => { void detectBeats(ctx, clip.id); })}>
                  <Icon name="beat" size={15} /> {beats ? 'Detetar batidas outra vez' : 'Detetar batidas'}
                </button>
              )}
              {anyBeats && (
                <>
                  <button role="menuitem" onPointerDown={close(() => syncToBeats(ctx, sel, 1))}><Icon name="beat" size={15} /> Encaixar clips no ritmo · 1 batida</button>
                  <button role="menuitem" onPointerDown={close(() => syncToBeats(ctx, sel, 2))}><Icon name="beat" size={15} /> Encaixar clips no ritmo · 2 batidas</button>
                  <button role="menuitem" onPointerDown={close(() => syncToBeats(ctx, sel, 4))}><Icon name="beat" size={15} /> Encaixar clips no ritmo · 1 compasso</button>
                  {visual && <button role="menuitem" onPointerDown={close(() => splitOnBeats(ctx, sel, 1))}><Icon name="split" size={15} /> Cortar nas batidas</button>}
                </>
              )}
              {sound && (
                <>
                  <button role="menuitem" onPointerDown={close(() => openModal({ kind: 'silence', clipId: clip.id }))}><Icon name="silence" size={15} /> Cortar silêncios…</button>
                  {m?.denoisedFrom
                    ? <button role="menuitem" onPointerDown={close(() => restoreOriginalSound(ctx, clip.id))}><Icon name="denoise" size={15} /> Repor som original (com ruído)</button>
                    : <button role="menuitem" onPointerDown={close(() => { void denoiseClip({ ...ctx, mediaBase }, clip.id, 0.5); })}><Icon name="denoise" size={15} /> Reduzir ruído</button>}
                  <button role="menuitem" onPointerDown={close(() => { void duckMusic(ctx, sel, 0.25); })} title="Usa este clip como música e baixa-o quando há voz nos outros"><Icon name="duck" size={15} /> Baixar quando há voz (ducking)</button>
                </>
              )}
              {m && m.kind !== 'image' && !clip.template && (
                <button role="menuitem" onPointerDown={close(() => { void reverseClip({ ...ctx, mediaBase }, clip.id); })}><Icon name="reverse" size={15} /> {canUnreverse(clip) ? 'Pôr a direito' : 'Inverter (andar para trás)'}</button>
              )}
              {m?.kind === 'video' && visual && (
                <button role="menuitem" onPointerDown={close(() => { void splitScenes(ctx, clip.id); })}>
                  <Icon name="scenes" size={15} /> Dividir nas mudanças de cena
                </button>
              )}
            </>
          );
        };
        if (!f) return null;
        const under = playhead.frame > f.clip.start && playhead.frame < f.clip.start + f.clip.duration;
        const run = (fn: () => void) => (e: React.PointerEvent) => { e.stopPropagation(); fn(); setMenu(null); };
        return (
          <div className="ctx-menu" style={{ left: Math.min(menu.x, window.innerWidth - 296), top: Math.max(8, Math.min(menu.y, window.innerHeight - 520)) }} onPointerDown={(e) => e.stopPropagation()} role="menu">
            <button role="menuitem" disabled={!under} onPointerDown={run(() => { const r = splitAtPlayhead(project, [menu.clipId]); if (r) commit(() => r); })}>
              <Icon name="split" size={15} /> Dividir na cabeça de leitura <kbd>S</kbd>
            </button>
            <button role="menuitem" disabled={!under} onPointerDown={run(() => { const r = cutAtPlayhead(project, [menu.clipId], 'left'); if (r) { commit(() => r.project); playhead.seek(r.seekTo); } })}>
              <Icon name="cutLeft" size={15} /> Dividir e eliminar à esquerda <kbd>Q</kbd>
            </button>
            <button role="menuitem" disabled={!under} onPointerDown={run(() => { const r = cutAtPlayhead(project, [menu.clipId], 'right'); if (r) commit(() => r.project); })}>
              <Icon name="cutRight" size={15} /> Dividir e eliminar à direita <kbd>W</kbd>
            </button>
            {project.media.find((x) => x.id === f.clip.mediaId)?.kind === 'video' && (
              <button role="menuitem" disabled={!(playhead.frame >= f.clip.start && playhead.frame < f.clip.start + f.clip.duration)} onPointerDown={run(() => { void doFreeze(menu.clipId); })}>
                <Icon name="freeze" size={15} /> Congelar fotograma ({FREEZE_SEC} s)
              </button>
            )}
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
            {(() => { const m = project.media.find((x) => x.id === f.clip.mediaId); return m && (m.kind === 'video' || m.kind === 'audio'); })() && (
              <button role="menuitem" onPointerDown={run(() => openCaptions(state.selection.length > 1 && state.selection.includes(menu.clipId) ? state.selection : menu.clipId))}>
                <Icon name="captions" size={15} /> Gerar legendas…
              </button>
            )}
            {menuExtras(f.clip)}
            {(f.clip.placeholder || (project.media.some((x) => x.id === f.clip.mediaId))) && (
              <button role="menuitem" onPointerDown={close(() => { void replaceWithFile({ ...ctx, mediaBase }, menu.clipId); })}>
                <Icon name="replace" size={15} /> {f.clip.placeholder ? 'Escolher vídeo ou foto…' : 'Substituir media…'}
              </button>
            )}
            <div className="ctx-sep" />
            <button role="menuitem" onPointerDown={run(() => commit((p) => rippleDelete(p, selection.includes(menu.clipId) ? selection : [menu.clipId]), []))}>
              <Icon name="trash" size={15} /> Apagar e fechar espaço <kbd>⇧Del</kbd>
            </button>
            <button role="menuitem" className="danger" onPointerDown={run(() => commit((p) => deleteClips(p, selection.includes(menu.clipId) ? selection : [menu.clipId]), []))}>
              <Icon name="trash" size={15} /> Apagar <kbd>Del</kbd>
            </button>
          </div>
        );
      })()}
    </section>
  );
};

/** Linha da cabeça de leitura: pode ser agarrada e arrastada (área de toque mais larga que a linha) */
const Playhead: React.FC<{ z: number; top: number; height: number; onDown: (e: React.PointerEvent) => void }> = ({ z, top, height, onDown }) => {
  const frame = useFrame();
  return (
    <div
      className="tl-playhead"
      style={{ transform: `translateX(${HEADER_W + frame * z}px)`, top, height }}
      onPointerDown={onDown}
      title="Arrasta para mover a cabeça de leitura"
    >
      <div className="tl-playhead-line" />
    </div>
  );
};

/** Pega no topo da cabeça de leitura (na régua), como no CapCut */
const PlayheadHandle: React.FC<{ z: number; onDown: (e: React.PointerEvent) => void }> = ({ z, onDown }) => {
  const frame = useFrame();
  return (
    <div className="tl-playhead-handle" style={{ transform: `translateX(${frame * z}px)` }} onPointerDown={onDown}>
      <svg width="16" height="22" viewBox="0 0 16 22" aria-hidden>
        <path d="M3 1h10a2 2 0 012 2v10.2a2 2 0 01-.6 1.4L8 21 1.6 14.6A2 2 0 011 13.2V3a2 2 0 012-2z" />
      </svg>
      <div className="tl-playhead-handle-line" />
    </div>
  );
};

interface TrackRowProps {
  track: Track;
  project: Project;
  mediaById: Map<string, MediaItem>;
  z: number;
  selection: string[];
  dropActive: boolean;
  onClipDown: (e: React.PointerEvent, clip: Clip, track: Track, mode: ClipMode) => void;
  onClipMenu: (e: React.MouseEvent, clip: Clip) => void;
  onKeyframeDown: (e: React.PointerEvent, clip: Clip, kf: Keyframe) => void;
  dispatch: React.Dispatch<Action>;
  onSelectTransition: (clipId: string) => void;
  onAddTransition: (clip: Clip, prev: Clip) => void;
  onLaneDown: (e: React.PointerEvent) => void;
  dragProps: Record<string, unknown>;
  onToggle: (patch: Partial<Track>) => void;
  onRemove: () => void;
}

const TrackRow: React.FC<TrackRowProps> = ({ track, mediaById, z, selection, dropActive, onClipDown, onClipMenu, onKeyframeDown, dispatch, onSelectTransition, onAddTransition, onLaneDown, dragProps, onToggle, onRemove, project }) => {
  const isVideo = track.kind === 'video';
  const isText = track.kind === 'text';
  return (
    <div className={`tl-row kind-${track.kind}`} style={{ height: TRACK_H[track.kind] }} data-track-id={track.id} data-track-kind={track.kind}>
      <div className="tl-head" style={{ width: HEADER_W }}>
        <span className="tl-head-icon"><Icon name={isVideo ? 'film' : isText ? 'type' : 'music'} size={15} /></span>
        <span className="tl-head-name" title={track.name}>{track.name}</span>
        <div className="tl-head-btns">
          {(isVideo || isText) && (
            <button className={`icon-btn mini${track.hidden ? ' off' : ''}`} title={track.hidden ? 'Mostrar pista' : 'Esconder pista'} onClick={() => onToggle({ hidden: !track.hidden })}>
              <Icon name={track.hidden ? 'eyeOff' : 'eye'} size={15} />
            </button>
          )}
          {!isText && (
            <button className={`icon-btn mini${track.muted ? ' off' : ''}`} title={track.muted ? 'Ativar som' : 'Silenciar pista'} onClick={() => onToggle({ muted: !track.muted })}>
              <Icon name={track.muted ? 'mute' : 'volume'} size={15} />
            </button>
          )}
          {track.clips.length === 0 && (isText || project.tracks.filter((t) => t.kind === track.kind).length > 1) && (
            <button className="icon-btn mini tl-head-rm" title="Remover pista vazia" onClick={onRemove}><Icon name="x" size={14} /></button>
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
              lottieName={clip.lottie ? project.lotties?.[clip.lottie.assetId]?.name : undefined}
              trackKind={track.kind}
              z={z}
              fps={project.fps}
              selected={selection.includes(clip.id)}
              onDown={(e, mode) => onClipDown(e, clip, track, mode)}
              onMenu={(e) => onClipMenu(e, clip)}
              onKeyframeDown={(e, kf) => onKeyframeDown(e, clip, kf)}
              sound={hasSound(project, clip.id)}
              beats={clipBeatFrames(project, clip)}
              dispatch={dispatch}
              height={TRACK_H[track.kind]}
            />
          );
        })}
        {isVideo && track.clips.map((clip) => {
          const prev = prevAdjacent(track, clip);
          if (!prev) return null;
          const selId = transitionSelId(clip.id);
          if (clip.transition) {
            const d = Math.min(clip.transition.duration, maxTransition(prev, clip));
            const { pre } = splitDuration(d);
            const w = Math.max(16, d * z);
            return (
              <div
                key={selId}
                className={`tl-trans${selection.includes(selId) ? ' selected' : ''}`}
                style={{ left: clip.start * z - Math.max(pre * z, w / 2), width: w }}
                onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onSelectTransition(clip.id); }}
                title={`Transição: ${transitionLabel(clip.transition.type)}`}
              >
                <Icon name="transition" size={13} />
                {w > 70 && <span>{transitionLabel(clip.transition.type)}</span>}
              </div>
            );
          }
          return (
            <button
              key={selId}
              className="tl-trans-add"
              style={{ left: clip.start * z }}
              onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onAddTransition(clip, prev); }}
              title="Adicionar transição"
              aria-label="Adicionar transição"
            >
              <Icon name="plus" size={11} />
            </button>
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
  fps: number;
  selected: boolean;
  lottieName?: string;
  onDown: (e: React.PointerEvent, mode: ClipMode) => void;
  onMenu: (e: React.MouseEvent) => void;
  onKeyframeDown: (e: React.PointerEvent, kf: Keyframe) => void;
  sound: boolean;
  beats: number[];
  dispatch: React.Dispatch<Action>;
  height: number;
}> = React.memo(({ clip, media, lottieName, trackKind, z, fps, selected, onDown, onMenu, onKeyframeDown, sound, beats, dispatch, height }) => {
  const w = Math.max(2, clip.duration * z);
  const thumb = media ? getThumb(media.path) : undefined;
  // um vídeo numa pista de áudio (som separado) desenha-se como áudio
  const kind = clip.placeholder ? 'placeholder' : clip.text ? 'text' : clip.template ? 'template' : clip.lottie ? 'lottie' : clip.sticker ? 'sticker' : trackKind === 'audio' ? 'audio' : media?.kind ?? 'video';
  const fi = clip.fadeIn * z;
  const fo = clip.fadeOut * z;
  return (
    <div
      className={`clip kind-${kind}${selected ? ' selected' : ''}${media || clip.placeholder || clip.text || clip.template || clip.sticker || (clip.lottie && lottieName) ? '' : ' missing'}`}
      style={{ left: clip.start * z, width: w, backgroundImage: thumb && kind !== 'audio' ? `url(${thumb})` : undefined }}
      data-clip-id={clip.id}
      onPointerDown={(e) => onDown(e, 'move')}
      onContextMenu={onMenu}
      title={clip.text ? clip.text.text : media?.name}
    >
      {(kind === 'audio' || (kind === 'video' && !clip.audioDetached)) && <ClipWave clip={clip} path={media?.path} fps={fps} width={w} full={kind === 'audio'} />}
      {(fi > 0 || fo > 0) && (
        <svg className="clip-fades" width={w} height="100%" viewBox={`0 0 ${w} 100`} preserveAspectRatio="none">
          {fi > 0 && <polygon points={`0,0 ${fi},0 0,100`} />}
          {fo > 0 && <polygon points={`${w},0 ${w - fo},0 ${w},100`} />}
        </svg>
      )}
      {w > 36 && <span className="clip-name">{clip.placeholder ? `▢ ${clip.placeholder.label}` : clip.text ? clip.text.text.split('\n')[0] || 'Texto' : clip.template ? `◆ ${getTemplate(clip.template.id)?.name ?? 'Modelo em falta'}` : clip.lottie ? `✦ ${lottieName ?? 'Animação em falta'}` : clip.sticker ? `☺ ${clip.sticker.name}` : media?.name ?? 'Ficheiro em falta'}</span>}
      {clip.audioDetached && w > 60 && <span className="clip-badge" title="Som separado para uma pista de áudio"><Icon name="mute" size={11} /></span>}
      {sound && (clip.volume !== 1 || clip.volKeys?.length) && w > 80 && <span className="clip-badge">{clip.volKeys?.length ? '◆ vol' : `${Math.round(clip.volume * 100)}%`}</span>}
      {clip.effects?.length && w > 70 ? <span className="clip-badge fx" title={clip.effects.map((x) => getEffect(x.id)?.name ?? x.id).join(', ')}>fx{clip.effects.length > 1 ? ` ${clip.effects.length}` : ''}</span> : null}
      {clip.speed && clip.speed !== 1 && w > 50 && <span className="clip-badge speed">{String(clip.speed).replace('.', ',')}×</span>}
      {clip.speedRamp && w > 50 && <span className="clip-badge speed" title="Curva de velocidade">⤳ curva</span>}
      {clip.reversed && w > 60 && <span className="clip-badge rev" title="Invertido (anda para trás)">↺</span>}
      {clip.mask && w > 60 && <span className="clip-badge msk" title="Com máscara">◐</span>}
      {clip.keyframes?.map((kf) => (
        <div
          key={kf.id}
          className={`clip-kf${selected ? ' sel' : ''}`}
          style={{ left: Math.max(6, kf.frame * z) }}
          onPointerDown={(e) => onKeyframeDown(e, kf)}
          title="Keyframe: clica para ir até ele, arrasta para o mover"
        />
      ))}
      {beats.length > 0 && w > 20 && (
        <svg className="clip-beats" width={w} height="100%" aria-hidden>
          {beats.map((f, i) => { const x = (f - clip.start) * z; return x > 1 && x < w - 1 ? <line key={i} x1={x} x2={x} y1="0" y2="100%" /> : null; })}
        </svg>
      )}
      {sound && (selected || !!clip.volKeys?.length) && w > 24 && <VolumeEnvelope clip={clip} w={w} h={height - 2} z={z} active={selected} dispatch={dispatch} onClipDown={(e) => onDown(e, 'move')} />}
      <div className="clip-handle left" onPointerDown={(e) => onDown(e, 'left')} />
      <div className="clip-handle right" onPointerDown={(e) => onDown(e, 'right')} />
      {w > 40 && !clip.text && (
        <>
          <div
            className={`clip-fade-knob in${clip.fadeIn ? ' on' : ''}`}
            style={{ left: Math.max(9, fi) }}
            onPointerDown={(e) => onDown(e, 'fadeIn')}
            title="Arrasta para a direita: fade in"
          />
          <div
            className={`clip-fade-knob out${clip.fadeOut ? ' on' : ''}`}
            style={{ left: Math.min(w - 9, w - fo) }}
            onPointerDown={(e) => onDown(e, 'fadeOut')}
            title="Arrasta para a esquerda: fade out"
          />
        </>
      )}
    </div>
  );
});
ClipView.displayName = 'ClipView';

/** Forma de onda real do excerto do clip (picos do ficheiro, via ffmpeg) */
const ClipWave: React.FC<{ clip: Clip; path?: string; fps: number; width: number; full: boolean }> = ({ clip, path, fps, width, full }) => {
  const peaks = usePeaks(path);
  const from = clip.trimStart / fps;
  const to = (clip.trimStart + (clip.speedRamp ? clip.speedRamp.src : clip.duration * clipSpeed(clip))) / fps;
  const maxPts = Math.max(8, Math.min(1500, Math.ceil(width / 2)));
  const wave = useMemo(() => (peaks && peaks.length ? wavePath(peaks, from, to, maxPts, full) : null), [peaks, from, to, maxPts, full]);
  if (!wave) return full ? <div className="clip-wave" /> : null;
  return (
    <svg className={`clip-wave-svg${full ? ' full' : ' strip'}`} viewBox={`0 0 ${Math.max(1, wave.n - 1)} 100`} preserveAspectRatio="none" aria-hidden>
      <path d={wave.d} />
    </svg>
  );
};

/** Linha de volume por cima do clip: arrastar a linha muda o volume; duplo clique cria um keyframe; arrastar/duplo clique num ponto move/apaga */
const VOL_TOP = 2; // a linha vai de 0 (em baixo) a 200% (em cima); 100% fica a meio
const VolumeEnvelope: React.FC<{ clip: Clip; w: number; h: number; z: number; active: boolean; dispatch: React.Dispatch<Action>; onClipDown: (e: React.PointerEvent) => void }> = ({ clip, w, h, z, active, dispatch, onClipDown }) => {
  const pad = 7;
  const yOf = (v: number) => pad + (1 - Math.min(VOL_TOP, v) / VOL_TOP) * (h - 2 * pad);
  const vOf = (y: number) => clamp((1 - (y - pad) / (h - 2 * pad)) * VOL_TOP, 0, VOL_TOP);
  const keys = clip.volKeys ?? [];
  const pts = keys.length
    ? [{ x: 0, y: yOf(volumeAt(clip, 0)) }, ...keys.map((k) => ({ x: clamp(k.f * z, 0, w), y: yOf(k.v) })), { x: w, y: yOf(volumeAt(clip, clip.duration)) }]
    : [{ x: 0, y: yOf(clip.volume) }, { x: w, y: yOf(clip.volume) }];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const local = (e: { clientX: number; clientY: number }, el: Element) => { const r = el.closest('svg')!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const drag = (e: React.PointerEvent, onMove: (x: number, y: number) => void) => {
    if (e.button !== 0 || !active) return;
    e.stopPropagation(); e.preventDefault();
    const svg = (e.currentTarget as Element).closest('svg')!;
    let started = false;
    const x0 = e.clientX, y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      if (!started) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return; started = true; dispatch({ type: 'beginGesture' }); document.body.classList.add('vol-dragging'); }
      const p = local(ev, svg); onMove(p.x, p.y);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('vol-dragging'); if (started) dispatch({ type: 'endGesture' }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const label = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <svg className={`clip-vol${active ? ' active' : ''}`} width={w} height={h} aria-label="Volume">
      <path className="clip-vol-hit" d={d}
        onPointerDown={(e) => {
          // o clique continua a ser do clip (selecionar/mover); só um arrasto na vertical mexe no volume
          if (e.button !== 0) return;
          e.stopPropagation();
          onClipDown(e);
          if (keys.length || !active) return;
          const svgEl = (e.currentTarget as Element).closest('svg')!;
          const x0 = e.clientX, y0 = e.clientY;
          let mode: 'wait' | 'vol' | 'no' = 'wait';
          const move = (ev: PointerEvent) => {
            if (mode === 'wait') {
              const dx = Math.abs(ev.clientX - x0), dy = Math.abs(ev.clientY - y0);
              if (dx < 3 && dy < 3) return;
              if (dy > dx) { mode = 'vol'; volDrag = true; dispatch({ type: 'beginGesture' }); document.body.classList.add('vol-dragging'); }
              else { mode = 'no'; return; }
            }
            if (mode !== 'vol') return;
            const y = local(ev, svgEl).y;
            dispatch({ type: 'gesture', fn: (p) => updateClip(p, clip.id, { volume: Math.round(vOf(y) * 100) / 100 }) });
          };
          const up = () => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
            if (mode === 'vol') { dispatch({ type: 'endGesture' }); document.body.classList.remove('vol-dragging'); }
            setTimeout(() => { volDrag = false; }, 0);
          };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        }}
        onDoubleClick={(e) => { e.stopPropagation(); const p = local(e, e.currentTarget); dispatch({ type: 'gesture', fn: (q) => addVolKey(q, clip.id, p.x / z, Math.round(vOf(p.y) * 100) / 100) }); }}
      >
        <title>{keys.length ? 'Duplo clique: novo ponto de volume' : `Volume ${label(clip.volume)} — arrasta para cima/baixo · duplo clique cria um ponto (keyframe)`}</title>
      </path>
      <path className="clip-vol-line" d={d} />
      {keys.map((k, i) => (
        <circle key={i} className="clip-vol-pt" cx={clamp(k.f * z, 0, w)} cy={yOf(k.v)} r={4.5}
          onPointerDown={(e) => drag(e, (x, y) => dispatch({ type: 'gesture', fn: (p) => moveVolKey(p, clip.id, i, x / z, Math.round(vOf(y) * 100) / 100) }))}
          onDoubleClick={(e) => { e.stopPropagation(); dispatch({ type: 'gesture', fn: (q) => removeVolKey(q, clip.id, i) }); }}
        >
          <title>{`${label(k.v)} — arrasta para mudar · duplo clique apaga`}</title>
        </circle>
      ))}
    </svg>
  );
};
