import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { useFrame, playhead } from '../playhead';
import { findClip, setAnimatedProps } from '../ops';
import { animatedTransform } from '../../shared/keyframes';
import { clamp } from '../util';
import { baseSize, getTransform } from '../../shared/transform';
import type { MediaItem } from '../../shared/types';
import { clipLottie, lottieMedia } from '../../shared/lottie';

const SNAPS = [50, 100 / 3, 200 / 3];

/**
 * Caixa de enquadramento na pré-visualização para o clip de vídeo/imagem selecionado:
 * arrastar para mover, cantos para escalar, pega de cima para rodar.
 */
export const TransformOverlay: React.FC = () => {
  const { state, dispatch } = useEditor();
  const frame = useFrame();
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const { project } = state;
  const sel = state.selection.length === 1 ? findClip(project, state.selection[0]) : null;
  const clip = sel?.clip;
  const media: MediaItem | undefined = clip?.template
    ? { id: '', path: '', name: '', kind: 'image', durationSec: 0, width: project.width, height: project.height }
    : clip?.lottie ? lottieMedia(clipLottie(project, clip))
    : clip ? project.media.find((m) => m.id === clip.mediaId) : undefined;
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!clip || !sel || sel.track.kind !== 'video' || !media || media.kind === 'audio') return null;
  if (frame < clip.start || frame >= clip.start + clip.duration) return null;

  const rel = frame - clip.start;
  const t = animatedTransform(clip, rel);
  const base = baseSize(media, project.width, project.height, t.fit);

  return (
    <div className="tf-layer">
      {guides.v !== null && <div className="tf-guide v" style={{ left: `${guides.v}%` }} />}
      {guides.h !== null && <div className="tf-guide h" style={{ top: `${guides.h}%` }} />}
      <Box
        t={t}
        base={base}
        W={project.width}
        onWheel={(e) => {
          // roda do rato por cima da caixa: zoom (um só passo no histórico por "rajada")
          e.preventDefault();
          if (!wheelTimer.current) dispatch({ type: 'beginGesture' });
          else clearTimeout(wheelTimer.current);
          wheelTimer.current = setTimeout(() => { wheelTimer.current = null; dispatch({ type: 'endGesture' }); }, 350);
          const s = clamp(t.scale * Math.pow(1.0012, -e.deltaY), 0.05, 10);
          dispatch({ type: 'gesture', fn: (p) => setAnimatedProps(p, clip.id, rel, { scale: s }) });
        }}
        onGesture={(kind, layer, e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = layer.getBoundingClientRect();
          const cx = rect.left + (t.x / 100) * rect.width;
          const cy = rect.top + (t.y / 100) * rect.height;
          const x0 = e.clientX, y0 = e.clientY;
          const d0 = Math.hypot(x0 - cx, y0 - cy) || 1;
          const a0 = Math.atan2(y0 - cy, x0 - cx);
          playhead.pause();
          dispatch({ type: 'beginGesture' });
          document.body.classList.add('tf-dragging');
          const move = (ev: PointerEvent) => {
            if (kind === 'move') {
              let x = t.x + ((ev.clientX - x0) / rect.width) * 100;
              let y = t.y + ((ev.clientY - y0) / rect.height) * 100;
              let gv: number | null = null, gh: number | null = null;
              for (const g of SNAPS) {
                if (Math.abs(x - g) < 1.2) { x = g; gv = g; }
                if (Math.abs(y - g) < 1.2) { y = g; gh = g; }
              }
              setGuides({ v: gv, h: gh });
              dispatch({ type: 'gesture', fn: (p) => setAnimatedProps(p, clip.id, rel, { x, y }) });
            } else if (kind === 'scale') {
              let s = clamp(t.scale * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0), 0.05, 10);
              if (Math.abs(s - 1) < 0.02) s = 1;
              dispatch({ type: 'gesture', fn: (p) => setAnimatedProps(p, clip.id, rel, { scale: s }) });
            } else {
              let r = t.rotation + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180) / Math.PI;
              r = ((r + 540) % 360) - 180;
              for (const g of [-180, -90, 0, 90, 180]) if (Math.abs(r - g) < 4) r = g;
              if (ev.shiftKey) r = Math.round(r / 15) * 15;
              dispatch({ type: 'gesture', fn: (p) => setAnimatedProps(p, clip.id, rel, { rotation: r === -180 ? 180 : r }) });
            }
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            document.body.classList.remove('tf-dragging');
            setGuides({ v: null, h: null });
            dispatch({ type: 'endGesture' });
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      />
    </div>
  );
};

const Box: React.FC<{
  t: ReturnType<typeof getTransform>;
  base: { w: number; h: number };
  W: number;
  onGesture: (kind: 'move' | 'scale' | 'rotate', layer: HTMLElement, e: React.PointerEvent) => void;
  onWheel: (e: WheelEvent) => void;
}> = ({ t, base, W, onGesture, onWheel }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef(onWheel);
  wheelRef.current = onWheel;
  // wheel com passive:false (o React regista-o passivo e não deixa impedir o scroll)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  });
  const [k, setK] = useState(0); // px de ecrã por px do projeto
  const c = t.crop;
  // retângulo visível (recortado) em coordenadas locais, já com escala e espelho
  const bw = base.w * k * t.scale, bh = base.h * k * t.scale;
  let x0 = (-0.5 + c.left / 100) * bw, x1 = (0.5 - c.right / 100) * bw;
  let y0 = (-0.5 + c.top / 100) * bh, y1 = (0.5 - c.bottom / 100) * bh;
  if (t.flipH) [x0, x1] = [-x1, -x0];
  if (t.flipV) [y0, y1] = [-y1, -y0];
  const layerOf = (el: Element) => el.closest('.tf-layer') as HTMLElement;
  return (
    <div
      className="tf-rot"
      ref={(el) => { if (el) { const w = layerOf(el).getBoundingClientRect().width; const nk = w / W; if (Math.abs(nk - k) > 1e-4) setK(nk); } }}
      style={{ left: `${t.x}%`, top: `${t.y}%`, transform: `rotate(${t.rotation}deg)` }}
    >
      {k > 0 && (
        <div
          ref={boxRef}
          className="tf-box"
          style={{ left: x0, top: y0, width: Math.max(4, x1 - x0), height: Math.max(4, y1 - y0) }}
          onPointerDown={(e) => onGesture('move', layerOf(e.currentTarget), e)}
          title="Arrasta para mover · cantos ou roda do rato para redimensionar · pega de cima para rodar (Shift: de 15 em 15°)"
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
            <div key={h} className={`tf-handle ${h}`} onPointerDown={(e) => onGesture('scale', layerOf(e.currentTarget), e)} />
          ))}
          <div className="tf-rotate" onPointerDown={(e) => onGesture('rotate', layerOf(e.currentTarget), e)} />
        </div>
      )}
    </div>
  );
};
