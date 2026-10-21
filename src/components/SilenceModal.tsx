// Janela "Cortar silêncios": mostra as pausas encontradas no clip (afináveis) antes de cortar.
import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../editor-context';
import { closeModal } from '../modals';
import { findClip } from '../ops';
import { applySilenceCut, clipEnvelope, silenceFrames } from '../analysis-ui';
import { DEFAULT_SPEECH, speechThreshold, type SpeechOpts } from '../../shared/speech';

const fmt = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;

export const SilenceModal: React.FC<{ clipId: string }> = ({ clipId }) => {
  const { state, commit, notify } = useEditor();
  const f = findClip(state.project, clipId);
  const [env, setEnv] = useState<{ hop: number; db: number[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [o, setO] = useState<SpeechOpts>(DEFAULT_SPEECH);
  const [prog, setProg] = useState(0);
  useEffect(() => window.vidcut?.onMediaProgress((e) => { if (e.task === 'envelope') setProg(e.p); }), []);
  useEffect(() => {
    if (!f) return;
    void clipEnvelope(state.project, f.clip).then((r) => ('error' in r ? setErr(r.error) : setEnv(r)));
  }, [clipId]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranges = useMemo(() => (f && env ? silenceFrames(state.project, f.clip, env, o) : []), [env, o, f, state.project]);
  if (!f) return null;
  const fps = state.project.fps;
  const clip = f.clip;
  const removed = ranges.reduce((s, [a, b]) => s + b - a, 0);
  const W = 600, H = 70;
  const thr = env ? speechThreshold(env.db, o.sensitivity) : -60;
  // (sem Math.min(...arr): com vídeos longos são centenas de milhares de valores e rebenta a pilha)
  let lo = -80, hi = 0;
  if (env && env.db.length) { lo = Infinity; hi = -Infinity; for (const v of env.db) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  const y = (db: number) => H - ((db - lo) / Math.max(1, hi - lo)) * (H - 4) - 2;
  const wave = env ? (() => {
    const step = Math.max(1, Math.floor(env.db.length / W));
    let d = '';
    for (let i = 0, x = 0; i < env.db.length; i += step, x++) {
      let m = -200; for (let j = i; j < Math.min(env.db.length, i + step); j++) m = Math.max(m, env.db[j]);
      d += `${x ? 'L' : 'M'}${((i / env.db.length) * W).toFixed(1)},${y(m).toFixed(1)}`;
    }
    return d;
  })() : '';
  const set = (patch: Partial<SpeechOpts>) => setO((x) => ({ ...x, ...patch }));
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal silence-modal" role="dialog" aria-modal="true" aria-labelledby="sil-title">
        <h3 id="sil-title">Cortar silêncios</h3>
        {err ? <p className="error-box">{err}</p> : !env ? (
          <div className="sil-wait">
            <p className="hint">A ouvir o clip… {prog > 0 ? `${Math.round(prog * 100)}%` : ''} {f.clip.duration / state.project.fps > 300 ? '(vídeos longos demoram um bocadinho)' : ''}</p>
            <div className="progress"><div className="progress-bar" style={{ width: `${Math.max(3, prog * 100)}%` }} /></div>
          </div>
        ) : (
          <>
            <svg className="sil-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Som do clip com as pausas a cortar">
              {ranges.map(([a, b], i) => (
                <rect key={i} x={((a - clip.start) / clip.duration) * W} width={((b - a) / clip.duration) * W} y="0" height={H} className="sil-cut" />
              ))}
              <path d={wave} className="sil-wave" />
              <line x1="0" x2={W} y1={y(thr)} y2={y(thr)} className="sil-thr" />
            </svg>
            <p className="sil-sum"><b>{ranges.length}</b> pausas · <b>{fmt(removed / fps)}</b> a cortar de {fmt(clip.duration / fps)} <span className="hint">(a vermelho)</span></p>
            <label className="field">
              <span className="field-label">Sensibilidade<em>{o.sensitivity < 0.34 ? 'só silêncio' : o.sensitivity < 0.67 ? 'normal' : 'também partes baixas'}</em></span>
              <input type="range" min={0} max={1} step={0.01} value={o.sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="field-label">Pausa mínima<em>{fmt(o.minSilence)}</em></span>
              <input type="range" min={0.2} max={2} step={0.05} value={o.minSilence} onChange={(e) => set({ minSilence: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="field-label">Margem antes e depois da fala<em>{fmt(o.pad)}</em></span>
              <input type="range" min={0} max={0.5} step={0.01} value={o.pad} onChange={(e) => set({ pad: Number(e.target.value) })} />
            </label>
            <p className="hint">Os pedaços que ficam encostam-se uns aos outros na mesma pista{clip.audioDetached ? ' (o som separado é cortado igual)' : ''}. As outras pistas (música, textos) não se mexem. Dá para desfazer.</p>
          </>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={closeModal}>Cancelar</button>
          <button className="btn primary" disabled={!ranges.length} onClick={() => { applySilenceCut({ project: state.project, commit, notify }, clipId, ranges); closeModal(); }}>
            Cortar {ranges.length ? `${ranges.length} pausas` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
