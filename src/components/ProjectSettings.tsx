import React, { useEffect, useState } from 'react';
import { useEditor } from '../editor-context';
import { changeFps } from '../ops';
import { ASPECTS, QUALITIES, aspectOf, sizeFor } from '../../shared/aspect';
import { closeProjectSettings } from '../project-settings-ui';
import { RatioIcon } from './AspectMenu';

const FPS = [24, 25, 30, 50, 60];
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Janela "Definições do projeto" (nome, formato, resolução, fps, fundo) — aplica tudo num só passo (Cmd+Z desfaz) */
export const ProjectSettingsModal: React.FC = () => {
  const { state, commit, notify } = useEditor();
  const p0 = state.project;
  const [name, setName] = useState(p0.name);
  const [aspect, setAspect] = useState<string>(aspectOf(p0.width, p0.height)?.id ?? 'custom');
  const [short, setShort] = useState(Math.min(p0.width, p0.height));
  const [cw, setCw] = useState(p0.width);
  const [ch, setCh] = useState(p0.height);
  const [fps, setFps] = useState(p0.fps);
  const [bg, setBg] = useState(p0.background);

  const a = ASPECTS.find((x) => x.id === aspect);
  const size = a ? sizeFor(a, short) : { w: even(cw), h: even(ch) };
  const valid = size.w >= 64 && size.h >= 64 && size.w <= 7680 && size.h <= 7680;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeProjectSettings(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const apply = () => {
    if (!valid) return;
    const formatChanged = size.w !== p0.width || size.h !== p0.height;
    commit((p) => {
      let q = { ...p, name: name.trim() || p.name, width: size.w, height: size.h, background: bg };
      if (fps !== p.fps) q = changeFps(q, fps);
      return q;
    });
    closeProjectSettings();
    if (formatChanged) notify(`Projeto em ${size.w}×${size.h}. Para os vídeos encherem o ecrã: clip → Enquadrar → Preencher.`);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeProjectSettings(); }}>
      <div className="modal proj-modal" role="dialog" aria-modal="true" aria-labelledby="proj-title">
        <h3 id="proj-title">Definições do projeto</h3>

        <label className="field">
          <span className="field-label">Nome</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} autoFocus />
        </label>

        <div className="field">
          <span className="field-label">Formato</span>
          <div className="aspect-grid" role="radiogroup" aria-label="Formato">
            {ASPECTS.map((x) => (
              <button key={x.id} role="radio" aria-checked={aspect === x.id} className={`aspect-card${aspect === x.id ? ' on' : ''}`} onClick={() => setAspect(x.id)}>
                <span className="ico-box"><RatioIcon rw={x.rw} rh={x.rh} size={26} /></span>
                <b>{x.label}</b><small>{x.hint}</small>
              </button>
            ))}
            <button role="radio" aria-checked={aspect === 'custom'} className={`aspect-card${aspect === 'custom' ? ' on' : ''}`} onClick={() => { setAspect('custom'); setCw(size.w); setCh(size.h); }}>
              <span className="ico-box">⋯</span><b>Personalizado</b><small>largura × altura</small>
            </button>
          </div>
        </div>

        <div className="exp-row">
          {aspect === 'custom' ? (
            <div className="field">
              <span className="field-label">Tamanho (px)</span>
              <div className="wh-row">
                <input type="number" min={64} max={7680} step={2} value={cw} onChange={(e) => setCw(Number(e.target.value))} aria-label="Largura" />
                <span>×</span>
                <input type="number" min={64} max={7680} step={2} value={ch} onChange={(e) => setCh(Number(e.target.value))} aria-label="Altura" />
              </div>
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Qualidade</span>
              <select value={short} onChange={(e) => setShort(Number(e.target.value))}>
                {!QUALITIES.some((q) => q.short === short) && <option value={short}>{short}p</option>}
                {QUALITIES.map((q) => <option key={q.short} value={q.short}>{q.label}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field-label">Fotogramas por segundo</span>
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              {FPS.map((f) => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Cor de fundo</span>
          <span className="color-row"><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /> <code>{bg}</code></span>
        </label>

        <div className="exp-summary">
          <span>{size.w}×{size.h}</span><span>{fps} fps</span>
          <span>{size.w !== p0.width || size.h !== p0.height ? `antes ${p0.width}×${p0.height}` : 'formato atual'}</span>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={closeProjectSettings}>Cancelar</button>
          <button className="btn primary" onClick={apply} disabled={!valid}>Aplicar</button>
        </div>
      </div>
    </div>
  );
};
