import React, { useEffect, useState } from 'react';
import { useEditor } from '../editor-context';
import { api, type CaptionsStatus } from '../api';
import { addCaptionTrack, findClip } from '../ops';
import { closeCaptions } from '../captions-ui';
import { CAPTION_STYLES, DEFAULT_HIGHLIGHT, groupIntoPages, pagesToClips } from '../../shared/captions';
import { clipSpeed, type CaptionStyle } from '../../shared/types';
import { Segmented } from './Fields';

const LANGS = [
  { value: 'pt', label: 'Português' }, { value: 'auto', label: 'Detetar automaticamente' }, { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' }, { value: 'fr', label: 'Francês' }, { value: 'de', label: 'Alemão' }, { value: 'it', label: 'Italiano' },
];
const MODELS = [
  { value: 'base', label: 'Rápido', hint: 'base · ~140 MB' },
  { value: 'small', label: 'Equilibrado', hint: 'small · ~470 MB (recomendado)' },
  { value: 'medium', label: 'Preciso', hint: 'medium · ~1,5 GB, mais lento' },
];
const KEY = 'vidcut.captions.v1';
interface Prefs { language: string; model: string; style: CaptionStyle; highlight: string }
const loadPrefs = (): Prefs => {
  try { return { language: 'pt', model: 'small', style: 'box', highlight: DEFAULT_HIGHLIGHT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { language: 'pt', model: 'small', style: 'box', highlight: DEFAULT_HIGHLIGHT }; }
};

type Phase = { k: 'setup' } | { k: 'running'; msg: string; progress: number; stage: string } | { k: 'error'; error: string };

export const CaptionsModal: React.FC<{ clipId: string }> = ({ clipId }) => {
  const { state, commit, notify } = useEditor();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [status, setStatus] = useState<CaptionsStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: 'setup' });
  const set = (p: Partial<Prefs>) => setPrefs((v) => ({ ...v, ...p }));
  useEffect(() => { api().captionsStatus().then(setStatus).catch(() => {}); }, []);

  const project = state.project;
  const f = findClip(project, clipId);
  const media = f ? project.media.find((m) => m.id === f.clip.mediaId) : undefined;
  const running = phase.k === 'running';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running) { e.stopPropagation(); closeCaptions(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running]);

  if (!f || !media || media.kind === 'image') {
    return null;
  }
  const clip = f.clip;
  const fps = project.fps;
  const sp = clipSpeed(clip);
  const durSec = (clip.duration * sp) / fps;

  const start = async () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignora */ }
    setPhase({ k: 'running', msg: 'A iniciar…', progress: 0, stage: 'start' });
    const off = api().onCaptionsProgress((p) => setPhase({ k: 'running', msg: p.message, progress: p.progress, stage: p.stage }));
    try {
      const r = await api().captionsStart({
        file: media.path, startSec: clip.trimStart / fps, durSec, model: prefs.model,
        language: prefs.language === 'auto' ? null : prefs.language,
      });
      if (r.canceled) { setPhase({ k: 'setup' }); return; }
      if (!r.ok || !r.captions) { setPhase({ k: 'error', error: r.error || 'Erro desconhecido' }); return; }
      const pages = groupIntoPages(r.captions);
      if (!pages.length) { setPhase({ k: 'error', error: 'Não foi detetada fala neste clip.' }); return; }
      const clips = pagesToClips(pages, { fps, startFrame: clip.start, speed: sp, style: prefs.style, highlight: prefs.highlight, endFrame: clip.start + clip.duration });
      commit((p) => { const t = addCaptionTrack(p, clips); return { project: t.project, select: [clips[0].id] }; });
      notify(`${clips.length} legendas criadas${r.language ? ` (${r.language})` : ''} — edita o texto clicando em cada uma`);
      closeCaptions();
    } finally { off(); }
  };

  const pct = running ? Math.round(phase.progress * 100) : 0;
  return (
    <div className="modal-backdrop">
      <div className="modal captions-modal" role="dialog" aria-modal="true" aria-labelledby="cap-title">
        <h3 id="cap-title">Gerar legendas</h3>
        <p className="path">{media.name} · {durSec.toFixed(1).replace('.', ',')} s</p>

        {phase.k === 'setup' && (
          <>
            <div className="exp-row">
              <label className="field">
                <span className="field-label">Língua falada</span>
                <select value={prefs.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Precisão</span>
                <select value={prefs.model} onChange={(e) => set({ model: e.target.value })}>
                  {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}{status?.models[m.value] ? ' ✓' : ''}</option>)}
                </select>
              </label>
            </div>
            <span className="fmt-hint">
              {MODELS.find((m) => m.value === prefs.model)?.hint}
              {status && (status.models[prefs.model] ? ' · já descarregado' : ' · descarrega na primeira vez')}
              {status && !status.installed ? ' · a primeira utilização prepara o motor (1–3 min)' : ''}
            </span>
            <div className="field">
              <span className="field-label">Estilo</span>
              <Segmented label="Estilo" value={prefs.style} onChange={(style) => set({ style })}
                options={CAPTION_STYLES.map((c) => ({ value: c.style, label: c.label, title: c.hint }))} />
              <span className="fmt-hint">{CAPTION_STYLES.find((c) => c.style === prefs.style)?.hint}</span>
            </div>
            {prefs.style !== 'classic' && prefs.style !== 'pop' && (
              <label className="field">
                <span className="field-label">Cor de destaque</span>
                <span className="color-row"><input type="color" value={prefs.highlight} onChange={(e) => set({ highlight: e.target.value })} /> <code>{prefs.highlight}</code></span>
              </label>
            )}
            <p className="hint">A transcrição é feita no teu computador — o áudio não sai daqui. As legendas ficam numa pista nova, por cima, e cada uma pode ser editada.</p>
            <div className="modal-actions">
              <button className="btn" onClick={closeCaptions}>Cancelar</button>
              <button className="btn primary" onClick={start}>Gerar</button>
            </div>
          </>
        )}

        {running && (
          <>
            <div className="progress"><div className="progress-bar" style={{ width: `${phase.stage === 'install' ? 100 : pct}%` }} data-indeterminate={phase.stage === 'install' || undefined} /></div>
            <div className="progress-info"><span>{phase.msg}</span><span>{phase.stage === 'install' ? '' : `${pct}%`}</span></div>
            <div className="modal-actions"><button className="btn" onClick={() => api().captionsCancel()}>Cancelar</button></div>
          </>
        )}

        {phase.k === 'error' && (
          <>
            <pre className="error-box">{phase.error}</pre>
            <div className="modal-actions">
              <button className="btn" onClick={closeCaptions}>Fechar</button>
              <button className="btn primary" onClick={() => setPhase({ k: 'setup' })}>Tentar outra vez</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
