import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { VidCutComposition } from '../../shared/VidCutComposition';
import { projectDuration, type CompositionProps } from '../../shared/types';
import { useEditor } from '../editor-context';
import { playhead, useFrame, usePlaying } from '../playhead';
import { clamp, timecode } from '../util';
import { addLottieClip, addTemplateClip, findClip, setAnimatedProps } from '../ops';
import { getLottieEntry } from '../lottie-registry';
import { getTemplateTheme } from '../template-theme';
import { LOTTIE_DRAG_TYPE } from './LottieLibrary';
import { TEMPLATE_DRAG_TYPE } from './MediaBin';
import { valuesAt } from '../../shared/keyframes';
import { Icon } from './Icon';
import { TransformOverlay } from './TransformOverlay';
import { AspectMenu } from './AspectMenu';
import { clearPreview, getPreview, usePreviewOverride } from '../preview-override';

export const Preview: React.FC = () => {
  const { state, mediaBase, commit } = useEditor();
  const ov = usePreviewOverride();
  const [dropOver, setDropOver] = useState(false);
  const project = ov ? ov.project : state.project;
  const ref = useRef<PlayerRef>(null);
  const duration = projectDuration(project);
  const inputProps = useMemo<CompositionProps>(() => ({ project, mediaBase }), [project, mediaBase]);

  // ---------- pré-visualização temporária ----------
  const saved = useRef<{ frame: number } | null>(null);
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (ov) {
      if (!saved.current) { saved.current = { frame: playhead.frame }; p.pause(); playhead.setPlaying(false); }
      playhead.locked = true;
      // dá um tick para o Player aceitar o novo intervalo antes de saltar e tocar
      const t = setTimeout(() => { p.seekTo(ov.from); p.play(); }, 30);
      return () => clearTimeout(t);
    }
    if (saved.current) {
      const f = saved.current.frame;
      saved.current = null;
      p.pause();
      playhead.locked = false;
      setTimeout(() => p.seekTo(f), 30);
    }
  }, [ov]);
  // qualquer edição real ao projeto termina a pré-visualização
  const lastProject = useRef(state.project);
  useEffect(() => {
    if (lastProject.current === state.project) return;
    lastProject.current = state.project;
    const cur = getPreview();
    if (cur && cur.base !== state.project) clearPreview();
  }, [state.project]);
  useEffect(() => {
    if (!ov) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); clearPreview(); } };
    // clicar fora de quem pediu a pré-visualização (e fora do ecrã) termina-a
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-preview-source], .preview-frame, .preview-badge')) return;
      clearPreview();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [ov]);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    playhead.player = p;
    const onFrame = (e: { detail: { frame: number } }) => playhead.setFrame(e.detail.frame);
    const onPlay = () => playhead.setPlaying(true);
    const onPause = () => playhead.setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    p.seekTo(playhead.frame);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
      if (playhead.player === p) playhead.player = null;
    };
  }, []);

  // se o projeto encurtar, não deixar a cabeça de leitura fora do fim
  useEffect(() => {
    if (playhead.frame > duration - 1) playhead.seek(duration - 1);
  }, [duration]);

  return (
    <section className="preview">
      <div className="preview-stage">
        <div
          className={`preview-frame${dropOver ? ' drop-over' : ''}`}
          style={{ aspectRatio: `${project.width} / ${project.height}` }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(LOTTIE_DRAG_TYPE) || e.dataTransfer.types.includes(TEMPLATE_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropOver(true); } }}
          onDragLeave={() => setDropOver(false)}
          onDrop={(e) => {
            setDropOver(false);
            const lid = e.dataTransfer.getData(LOTTIE_DRAG_TYPE);
            const tid = e.dataTransfer.getData(TEMPLATE_DRAG_TYPE);
            if (!lid && !tid) return;
            e.preventDefault();
            clearPreview();
            const at = playhead.frame;
            if (lid) {
              const en = getLottieEntry(lid);
              if (en) commit((p) => { const r = addLottieClip(p, { id: en.id, name: en.name, data: en.data }, at); return { project: r.project, select: r.clipId ? [r.clipId] : undefined }; });
            } else {
              commit((p) => { const r = addTemplateClip(p, tid, at, { theme: getTemplateTheme() }); return { project: r.project, select: r.clipId ? [r.clipId] : undefined }; });
            }
          }}
        >
          <Player
            ref={ref}
            component={VidCutComposition}
            inputProps={inputProps}
            durationInFrames={duration}
            fps={project.fps}
            compositionWidth={project.width}
            compositionHeight={project.height}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            clickToPlay={false}
            spaceKeyToPlayOrPause={false}
            doubleClickToFullscreen
            moveToBeginningWhenEnded={false}
            acknowledgeRemotionLicense
            inFrame={ov ? Math.max(0, Math.min(ov.from, duration - 1)) : null}
            outFrame={ov ? Math.max(Math.min(ov.from, duration - 1) + 1, Math.min(ov.to, duration - 1)) : null}
            loop={!!ov}
          />
          {ov ? (
            <div className="preview-badge" role="status">
              <span className="dot" /> Pré-visualização · {ov.label}
              <button onClick={() => clearPreview()} title="Sair da pré-visualização (Esc)">Esc</button>
            </div>
          ) : (
            <>
              <TextDragOverlay />
              <TransformOverlay />
            </>
          )}
        </div>
      </div>
      <Transport duration={duration} fps={project.fps} />
    </section>
  );
};

const Transport: React.FC<{ duration: number; fps: number }> = ({ duration, fps }) => {
  const frame = useFrame();
  const playing = usePlaying();
  return (
    <div className="transport">
      <span className="tc">{timecode(frame, fps)}</span>
      <div className="transport-buttons">
        <button className="icon-btn" title="Início (Home)" onClick={() => playhead.seek(0)}><Icon name="start" /></button>
        <button className="icon-btn" title="Frame anterior (←)" onClick={() => playhead.seek(frame - 1)}><Icon name="prev" /></button>
        <button className="icon-btn play" title="Reproduzir / pausa (Espaço)" onClick={() => playhead.toggle()}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button className="icon-btn" title="Frame seguinte (→)" onClick={() => playhead.seek(Math.min(duration - 1, frame + 1))}><Icon name="next" /></button>
        <button className="icon-btn" title="Fim (End)" onClick={() => playhead.seek(duration - 1)}><Icon name="end" /></button>
      </div>
      <div className="transport-right">
        <AspectMenu />
        <span className="tc dim">{timecode(duration, fps)}</span>
      </div>
    </div>
  );
};

/** Com um texto selecionado (e visível), arrastar na pré-visualização move-o */
const TextDragOverlay: React.FC = () => {
  const { state, dispatch } = useEditor();
  const frame = useFrame();
  const sel = state.selection.length === 1 ? findClip(state.project, state.selection[0]) : null;
  const clip = sel?.clip;
  if (!clip?.text || frame < clip.start || frame >= clip.start + clip.duration) return null;
  const rel = frame - clip.start;
  const kv = valuesAt(clip, rel);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY;
    const ox = kv.x, oy = kv.y;
    playhead.pause();
    dispatch({ type: 'beginGesture' });
    const move = (ev: PointerEvent) => {
      let x = clamp(ox + ((ev.clientX - x0) / box.width) * 100, 0, 100);
      let y = clamp(oy + ((ev.clientY - y0) / box.height) * 100, 0, 100);
      // encaixar no centro e nos terços (grelha), como guia
      for (const g of [50, 100 / 3, 200 / 3]) {
        if (Math.abs(x - g) < 1.2) x = g;
        if (Math.abs(y - g) < 1.2) y = g;
      }
      dispatch({ type: 'gesture', fn: (p) => setAnimatedProps(p, clip.id, rel, { x, y }) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dispatch({ type: 'endGesture' });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="text-drag" onPointerDown={onDown} title="Arrasta para mover o texto">
      <div className="text-drag-mark" style={{ left: `${kv.x}%`, top: `${kv.y}%` }} />
    </div>
  );
};
