import React from 'react';
import { useEditor } from '../editor-context';
import { canDetachAudio, changeFps, clipsAt, deleteClips, detachAudio, findClip, reattachAudio, splitClips, updateClip } from '../ops';
import { playhead } from '../playhead';
import { timecode } from '../util';
import { Icon } from './Icon';
import type { Project } from '../../shared/types';

const RESOLUTIONS: { label: string; w: number; h: number }[] = [
  { label: '1920 × 1080 (16:9)', w: 1920, h: 1080 },
  { label: '3840 × 2160 (4K 16:9)', w: 3840, h: 2160 },
  { label: '1080 × 1920 (vertical 9:16)', w: 1080, h: 1920 },
  { label: '1080 × 1080 (quadrado)', w: 1080, h: 1080 },
  { label: '1080 × 1350 (4:5)', w: 1080, h: 1350 },
  { label: '1280 × 720 (720p)', w: 1280, h: 720 },
];
const FPS = [24, 25, 30, 50, 60]; // nunca abaixo de 24 (IBM)

export function splitAtPlayhead(project: Project, selection: string[]): { project: Project; select: string[] } | null {
  const f = playhead.frame;
  const under = clipsAt(project, f).map((c) => c.id);
  const targets = selection.filter((id) => under.includes(id));
  const ids = targets.length ? targets : under;
  if (!ids.length) return null;
  const r = splitClips(project, ids, f);
  return { project: r.project, select: r.created };
}

/** Slider que agrupa o arrastar num único passo do histórico */
const Range: React.FC<{ value: number; min: number; max: number; step: number; apply: (v: number) => (p: Project) => Project }> = ({ value, min, max, step, apply }) => {
  const { dispatch, commit } = useEditor();
  const dragging = React.useRef(false);
  return (
    <input
      type="range" min={min} max={max} step={step} value={value}
      onPointerDown={() => { dragging.current = true; dispatch({ type: 'beginGesture' }); }}
      onPointerUp={() => { dragging.current = false; dispatch({ type: 'endGesture' }); }}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (dragging.current) dispatch({ type: 'gesture', fn: apply(v) });
        else commit(apply(v));
      }}
    />
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="field">
    <span className="field-label">{label}{hint && <em>{hint}</em>}</span>
    {children}
  </label>
);

export const Inspector: React.FC = () => {
  const { state, commit, dispatch } = useEditor();
  const { project, selection } = state;
  const found = selection.length === 1 ? findClip(project, selection[0]) : null;

  if (selection.length > 1) {
    return (
      <aside className="panel inspector">
        <header className="panel-head"><h2>{selection.length} clips</h2></header>
        <div className="inspector-body">
          <button className="btn danger block" onClick={() => commit((p) => deleteClips(p, selection), [])}>
            <Icon name="trash" size={16} /> Apagar seleção
          </button>
        </div>
      </aside>
    );
  }

  if (!found) {
    const res = RESOLUTIONS.find((r) => r.w === project.width && r.h === project.height);
    return (
      <aside className="panel inspector">
        <header className="panel-head"><h2>Projeto</h2></header>
        <div className="inspector-body">
          <Row label="Nome">
            <input
              type="text" value={project.name}
              onFocus={() => dispatch({ type: 'beginGesture' })}
              onBlur={() => dispatch({ type: 'endGesture' })}
              onChange={(e) => { const name = e.target.value; dispatch({ type: 'gesture', fn: (p) => ({ ...p, name }) }); }}
            />
          </Row>
          <Row label="Resolução">
            <select
              value={res ? `${res.w}x${res.h}` : 'custom'}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                if (w && h) commit((p) => ({ ...p, width: w, height: h }));
              }}
            >
              {!res && <option value="custom">{project.width} × {project.height}</option>}
              {RESOLUTIONS.map((r) => <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>)}
            </select>
          </Row>
          <Row label="Frames por segundo" hint="mínimo 24">
            <select value={project.fps} onChange={(e) => commit((p) => changeFps(p, Number(e.target.value)))}>
              {FPS.map((f) => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </Row>
          <Row label="Cor de fundo">
            <div className="color-row">
              <input type="color" value={project.background} onChange={(e) => commit((p) => ({ ...p, background: e.target.value }))} />
              <code>{project.background}</code>
            </div>
          </Row>
          <p className="hint">Seleciona um clip na timeline para ajustar volume e fades.</p>
        </div>
      </aside>
    );
  }

  const { clip, track } = found;
  const media = project.media.find((m) => m.id === clip.mediaId);
  const fps = project.fps;
  const maxFade = Math.max(0, Math.floor(clip.duration / 2));
  const sec = (frames: number) => (frames / fps).toFixed(2).replace('.', ',');
  const isVisual = track.kind === 'video';

  return (
    <aside className="panel inspector">
      <header className="panel-head">
        <h2 className="ellipsis" title={media?.name}>{media?.name ?? 'Clip'}</h2>
      </header>
      <div className="inspector-body">
        <dl className="meta">
          <dt>Início</dt><dd>{timecode(clip.start, fps)}</dd>
          <dt>Duração</dt><dd>{timecode(clip.duration, fps)}</dd>
          {media?.kind !== 'image' && (<><dt>Corte inicial</dt><dd>{timecode(clip.trimStart, fps)}</dd></>)}
          <dt>Pista</dt><dd>{track.name}</dd>
        </dl>

        {media?.kind === 'video' && isVisual && (
          <div className="audio-box">
            {clip.audioDetached ? (
              <>
                <p className="hint">O som deste vídeo está numa pista de áudio separada.</p>
                <button className="btn block" onClick={() => commit((p) => reattachAudio(p, clip.id))}>
                  <Icon name="link" size={16} /> Voltar a juntar o áudio
                </button>
              </>
            ) : (
              <button
                className="btn block"
                title="Passa o som para uma pista de áudio, para o editar à parte"
                disabled={!canDetachAudio(project, clip.id)}
                onClick={() => commit((p) => { const r = detachAudio(p, clip.id); return { project: r.project, select: r.clipId ? [r.clipId] : undefined }; })}
              >
                <Icon name="unlink" size={16} /> Separar áudio
              </button>
            )}
          </div>
        )}

        {media?.kind !== 'image' && !clip.audioDetached && (
          <Row label="Volume" hint={`${Math.round(clip.volume * 100)}%`}>
            <Range min={0} max={2} step={0.01} value={clip.volume} apply={(v) => (p) => updateClip(p, clip.id, { volume: v })} />
          </Row>
        )}

        <Row label="Fade in" hint={`${sec(clip.fadeIn)} s`}>
          <Range min={0} max={maxFade} step={1} value={Math.min(clip.fadeIn, maxFade)} apply={(v) => (p) => updateClip(p, clip.id, { fadeIn: v })} />
        </Row>
        <Row label="Fade out" hint={`${sec(clip.fadeOut)} s`}>
          <Range min={0} max={maxFade} step={1} value={Math.min(clip.fadeOut, maxFade)} apply={(v) => (p) => updateClip(p, clip.id, { fadeOut: v })} />
        </Row>
        <p className="hint">
          {isVisual
            ? clip.audioDetached
              ? 'No vídeo, o fade aplica-se à imagem. O som tem fades próprios na pista de áudio.'
              : 'No vídeo, o fade aplica-se à imagem (a partir do preto/fundo) e ao som do clip.'
            : 'No áudio, o fade sobe/desce o volume.'}
        </p>

        <div className="btn-row">
          <button className="btn" onClick={() => { const r = splitAtPlayhead(project, [clip.id]); if (r) commit(() => r); }}>
            <Icon name="split" size={16} /> Dividir
          </button>
          <button className="btn danger" onClick={() => commit((p) => deleteClips(p, [clip.id]), [])}>
            <Icon name="trash" size={16} /> Apagar
          </button>
        </div>
      </div>
    </aside>
  );
};
