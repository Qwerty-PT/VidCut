import React from 'react';
import { useEditor } from '../editor-context';
import { TRANSITION_PREFIX, setTransition, canDetachAudio, changeFps, clipsAt, cutAtFrame, deleteClips, detachAudio, findClip, reattachAudio, splitClips, updateClip } from '../ops';
import { playhead } from '../playhead';
import { timecode } from '../util';
import { Icon } from './Icon';
import { Range, Row } from './Fields';
import { AnimSection, ColorSection, SpeedSection, TextFields, TransformSection } from './ClipPanels';
import type { Project, TransitionType } from '../../shared/types';
import { TRANSITIONS, maxTransition, prevAdjacent } from '../../shared/transitions';
import { DURATIONS_MS, msToFrames } from '../../shared/motion';

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

/**
 * Dividir e eliminar à esquerda/direita na cabeça de leitura.
 * Alvo: clips selecionados por baixo da cabeça de leitura, ou todos os que lá estão.
 */
export function cutAtPlayhead(project: Project, selection: string[], side: 'left' | 'right'): { project: Project; seekTo: number } | null {
  const f = playhead.frame;
  const underClips = clipsAt(project, f);
  const under = underClips.map((c) => c.id);
  const targets = selection.filter((id) => under.includes(id));
  const ids = targets.length ? targets : under;
  if (!ids.length) return null;
  // ao eliminar à esquerda, o clip encosta ao início antigo: a cabeça de leitura vai para lá
  const seekTo = side === 'left' ? Math.min(...underClips.filter((c) => ids.includes(c.id)).map((c) => c.start)) : f;
  return { project: cutAtFrame(project, ids, f, side), seekTo };
}

type ClipTab = 'basic' | 'frame' | 'color' | 'anim';

export const Inspector: React.FC = () => {
  const { state, commit, dispatch } = useEditor();
  const [tab, setTab] = React.useState<ClipTab>('basic');
  const { project, selection } = state;
  const found = selection.length === 1 ? findClip(project, selection[0]) : null;

  if (selection.length === 1 && selection[0].startsWith(TRANSITION_PREFIX)) {
    return <TransitionPanel clipId={selection[0].slice(TRANSITION_PREFIX.length)} />;
  }

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
  const isText = !!clip.text;
  const hasTabs = isVisual && !!media && media.kind !== 'audio';
  const curTab: ClipTab = hasTabs ? tab : 'basic';

  const actions = (
    <div className="btn-row">
      <button className="btn" title="Dividir na cabeça de leitura (S)" onClick={() => { const r = splitAtPlayhead(project, [clip.id]); if (r) commit(() => r); }}>
        <Icon name="split" size={16} /> Dividir
      </button>
      <button className="btn icon-only" title="Eliminar à esquerda da cabeça de leitura (Q)" onClick={() => { const r = cutAtPlayhead(project, [clip.id], 'left'); if (r) { commit(() => r.project); playhead.seek(r.seekTo); } }}>
        <Icon name="cutLeft" size={16} />
      </button>
      <button className="btn icon-only" title="Eliminar à direita da cabeça de leitura (W)" onClick={() => { const r = cutAtPlayhead(project, [clip.id], 'right'); if (r) commit(() => r.project); }}>
        <Icon name="cutRight" size={16} />
      </button>
      <button className="btn danger icon-only" title="Apagar clip (Delete)" onClick={() => commit((p) => deleteClips(p, [clip.id]), [])}>
        <Icon name="trash" size={16} />
      </button>
    </div>
  );

  if (isText && clip.text) {
    return (
      <aside className="panel inspector">
        <header className="panel-head"><h2>Texto</h2></header>
        <div className="inspector-body">
          <TextFields clip={clip} text={clip.text} />
          <AnimSection clip={clip} isText fps={fps} />
          {actions}
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel inspector">
      <header className="panel-head">
        <h2 className="ellipsis" title={media?.name}>{media?.name ?? 'Clip'}</h2>
      </header>
      {hasTabs && (
        <div className="tabs" role="tablist">
          {([['basic', 'Básico'], ['frame', 'Enquadrar'], ['color', 'Cor'], ['anim', 'Animação']] as [ClipTab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={curTab === id} className={curTab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      )}
      <div className="inspector-body">
        {curTab === 'basic' && (
          <>
            <dl className="meta">
              <dt>Início</dt><dd>{timecode(clip.start, fps)}</dd>
              <dt>Duração</dt><dd>{timecode(clip.duration, fps)}</dd>
              {media?.kind !== 'image' && (<><dt>Corte inicial</dt><dd>{timecode(clip.trimStart, fps)}</dd></>)}
              <dt>Pista</dt><dd>{track.name}</dd>
            </dl>
            {actions}

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

            {media && media.kind !== 'image' && <SpeedSection clip={clip} fps={fps} />}
          </>
        )}
        {curTab === 'frame' && media && <TransformSection clip={clip} media={media} />}
        {curTab === 'color' && <ColorSection clip={clip} />}
        {curTab === 'anim' && <AnimSection clip={clip} isText={false} fps={fps} />}
      </div>
    </aside>
  );
};

/** Painel de uma transição selecionada na timeline */
const TransitionPanel: React.FC<{ clipId: string }> = ({ clipId }) => {
  const { state, commit } = useEditor();
  const { project } = state;
  const f = findClip(project, clipId);
  const prev = f ? prevAdjacent(f.track, f.clip) : undefined;
  if (!f || !f.clip.transition || !prev) return null;
  const tr = f.clip.transition;
  const fps = project.fps;
  const max = maxTransition(prev, f.clip);
  const dur = Math.min(tr.duration, max);
  const set = (patch: Partial<typeof tr>) => commit((p) => setTransition(p, clipId, { ...tr, ...patch }));
  const sec = (dur / fps).toFixed(2).replace('.', ',');
  // durações IBM úteis para transições (as mais curtas são demasiado rápidas para vídeo)
  const presets: { label: string; ms: number }[] = [
    { label: 'Rápida', ms: DURATIONS_MS['moderate-02'] },
    { label: 'Média', ms: DURATIONS_MS['slow-01'] },
    { label: 'Lenta', ms: DURATIONS_MS['slow-02'] },
    { label: '1 s', ms: 1000 },
  ];
  return (
    <aside className="panel inspector">
      <header className="panel-head"><h2>Transição</h2></header>
      <div className="inspector-body">
        <div className="trans-grid" role="radiogroup" aria-label="Tipo de transição">
          {TRANSITIONS.map((t) => (
            <button
              key={t.type}
              role="radio"
              aria-checked={tr.type === t.type}
              className={`trans-opt${tr.type === t.type ? ' on' : ''}`}
              title={t.hint}
              onClick={() => set({ type: t.type as TransitionType })}
            >
              <TransitionThumb type={t.type} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <Row label="Duração" hint={`${sec} s`}>
          <Range min={2} max={max} step={1} value={dur} apply={(v) => (p) => setTransition(p, clipId, { ...tr, duration: v })} />
        </Row>
        <div className="chip-row">
          {presets.map((pr) => {
            const fr = Math.min(max, msToFrames(pr.ms, fps));
            return (
              <button key={pr.label} className={`chip${fr === dur ? ' on' : ''}`} onClick={() => set({ duration: Math.max(2, fr) })} title={`${pr.ms} ms`}>
                {pr.label}
              </button>
            );
          })}
        </div>
        <p className="hint">A transição fica centrada no corte. Se um clip não tiver imagem extra para lá do corte, o primeiro ou último frame fica parado durante a transição. Usa a curva IBM expressiva.</p>

        <button className="btn danger block" onClick={() => commit((p) => setTransition(p, clipId, undefined), [])}>
          <Icon name="trash" size={16} /> Remover transição
        </button>
      </div>
    </aside>
  );
};

/** Miniatura animada (CSS) de cada tipo de transição */
const TransitionThumb: React.FC<{ type: string }> = ({ type }) => (
  <span className={`trans-thumb t-${type}`} aria-hidden>
    <i className="a" />
    <i className="b" />
  </span>
);
