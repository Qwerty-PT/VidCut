import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../editor-context';
import { api, type CaptionsStatus } from '../api';
import { addCaptionTrack, findClip } from '../ops';
import { closeCaptions } from '../captions-ui';
import { CAPTION_STYLES, DEFAULT_HIGHLIGHT, groupIntoPages, normalizeWordTimes, pagesToClips, planTranscription, speechClips, wordsToTimeline, type TimedWord } from '../../shared/captions';
import type { CaptionStyle, Clip } from '../../shared/types';
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

type Scope = 'one' | 'sel' | 'all';
const fmtSec = (s: number) => (s >= 90 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${s.toFixed(1).replace('.', ',')} s`);

export const CaptionsModal: React.FC<{ ids: string[] }> = ({ ids }) => {
  const { state, commit, notify } = useEditor();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [status, setStatus] = useState<CaptionsStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ k: 'setup' });
  const set = (p: Partial<Prefs>) => setPrefs((v) => ({ ...v, ...p }));
  useEffect(() => { api().captionsStatus().then(setStatus).catch(() => {}); }, []);

  const project = state.project;
  const fps = project.fps;
  const isSound = (c: Clip) => { const m = project.media.find((x) => x.id === c.mediaId); return !!m && (m.kind === 'video' || m.kind === 'audio') && !c.text && !c.template && !c.lottie; };
  const picked = useMemo(() => ids.map((id) => findClip(project, id)?.clip).filter((c): c is Clip => !!c && isSound(c)), [ids, project]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => speechClips(project), [project]);
  const scopes: { value: Scope; label: string; n: number }[] = [];
  if (picked.length === 1) scopes.push({ value: 'one', label: 'Só este clip', n: 1 });
  if (picked.length > 1) scopes.push({ value: 'sel', label: `Clips selecionados (${picked.length})`, n: picked.length });
  if (all.length > 1 || !picked.length) scopes.push({ value: 'all', label: `Vídeo todo (${all.length} ${all.length === 1 ? 'clip' : 'clips'})`, n: all.length });
  const [scope, setScope] = useState<Scope>(() => (picked.length > 1 ? 'sel' : all.length > 1 ? 'all' : 'one'));
  const clips = scope === 'one' ? picked.slice(0, 1) : scope === 'sel' ? picked : all;
  const running = phase.k === 'running';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running) { e.stopPropagation(); closeCaptions(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [running]);

  // pedaços a transcrever, por ficheiro (cada ficheiro uma só vez, mesmo com muitos cortes)
  const jobs = useMemo(() => {
    const by = new Map<string, Clip[]>();
    for (const c of clips) by.set(c.mediaId, [...(by.get(c.mediaId) ?? []), c]);
    return [...by].flatMap(([mediaId, cs]) => {
      const media = project.media.find((m) => m.id === mediaId)!;
      return planTranscription(cs, fps, { mediaDurSec: media.durationSec }).map((r) => ({ media, clips: cs, ...r }));
    });
  }, [clips, project.media, fps]);

  if (!clips.length) return null;
  const totalSec = jobs.reduce((s, j) => s + j.durSec, 0);
  const onTimeline = clips.reduce((s, c) => s + c.duration, 0) / fps;
  const firstMedia = jobs[0]?.media;

  const start = async () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignora */ }
    setPhase({ k: 'running', msg: 'A iniciar…', progress: 0, stage: 'start' });
    let done = 0, cur = jobs[0];
    const off = api().onCaptionsProgress((p) => {
      const part = jobs.length > 1 ? ` (parte ${jobs.indexOf(cur) + 1} de ${jobs.length})` : '';
      setPhase({ k: 'running', msg: p.message + (p.stage === 'transcribe' ? part : ''), stage: p.stage, progress: p.stage === 'transcribe' ? (done + p.progress * cur.durSec) / totalSec : p.stage === 'download' ? p.progress : done / totalSec });
    });
    try {
      const words: TimedWord[] = [];
      let lang: string | undefined;
      for (const j of jobs) {
        cur = j;
        const r = await api().captionsStart({
          file: j.media.path, startSec: j.startSec, durSec: j.durSec, model: prefs.model,
          language: prefs.language, // 'auto' tem de ir explícito: sem língua o Whisper assume inglês
        });
        if (r.canceled) { setPhase({ k: 'setup' }); return; }
        if (!r.ok || !r.captions) { setPhase({ k: 'error', error: r.error || 'Erro desconhecido' }); return; }
        lang ??= r.language;
        words.push(...wordsToTimeline(r.captions, j.startSec, j.clips, fps));
        done += j.durSec;
      }
      words.sort((a, b) => a.startMs - b.startMs);
      const pages = groupIntoPages(normalizeWordTimes(words));
      if (!pages.length) { setPhase({ k: 'error', error: clips.length > 1 ? 'Não foi detetada fala nestes clips.' : 'Não foi detetada fala neste clip.' }); return; }
      const endFrame = Math.max(...clips.map((c) => c.start + c.duration));
      const caps = pagesToClips(pages, { fps, startFrame: 0, style: prefs.style, highlight: prefs.highlight, endFrame });
      commit((p) => { const t = addCaptionTrack(p, caps); return { project: t.project, select: [caps[0].id] }; });
      notify(`${caps.length} legendas criadas${lang ? ` (${lang})` : ''} — edita o texto clicando em cada uma`);
      closeCaptions();
    } finally { off(); }
  };

  const pct = running ? Math.round(phase.progress * 100) : 0;
  return (
    <div className="modal-backdrop">
      <div className="modal captions-modal" role="dialog" aria-modal="true" aria-labelledby="cap-title">
        <h3 id="cap-title">Gerar legendas</h3>
        <p className="path">{clips.length === 1 || new Set(clips.map((c) => c.mediaId)).size === 1 ? firstMedia?.name : `${new Set(clips.map((c) => c.mediaId)).size} ficheiros`} · {fmtSec(onTimeline)}{clips.length > 1 ? ` em ${clips.length} clips` : ''}</p>

        {phase.k === 'setup' && (
          <>
            {scopes.length > 1 && (
              <div className="field">
                <span className="field-label">Legendar</span>
                <Segmented label="Legendar" value={scope} onChange={setScope} options={scopes.map((x) => ({ value: x.value, label: x.label }))} />
                {scope === 'all' && <span className="fmt-hint">Todos os clips de vídeo com som, numa só pista de legendas. Música e áudios soltos ficam de fora (para os incluir, seleciona-os).</span>}
              </div>
            )}
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
