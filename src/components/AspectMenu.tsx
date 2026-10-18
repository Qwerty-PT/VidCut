import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { ASPECTS, aspectLabel, aspectOf, sizeFor } from '../../shared/aspect';
import { openProjectSettings } from '../project-settings-ui';

/** Ícone retangular com a proporção */
export const RatioIcon: React.FC<{ rw: number; rh: number; size?: number }> = ({ rw, rh, size = 16 }) => {
  const k = size / Math.max(rw, rh);
  return <span className="ratio-ico" style={{ width: rw * k, height: rh * k }} aria-hidden />;
};

/** Botão "16:9 ▾" por baixo do ecrã: muda a proporção do projeto (como o "Ratio" do CapCut) */
export const AspectMenu: React.FC = () => {
  const { state, commit, notify } = useEditor();
  const { width: W, height: H } = state.project;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = aspectOf(W, H);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  const pick = (id: string) => {
    const a = ASPECTS.find((x) => x.id === id)!;
    const { w, h } = sizeFor(a, Math.min(W, H));
    setOpen(false);
    if (w === W && h === H) return;
    commit((p) => ({ ...p, width: w, height: h }));
    notify(`Formato ${a.label} (${w}×${h}). Para os vídeos encherem o ecrã: seleciona o clip → Enquadrar → Preencher. Cmd+Z desfaz.`);
  };
  return (
    <div className="aspect-menu" ref={box}>
      <button className="aspect-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} title="Proporção do projeto">
        <RatioIcon rw={W} rh={H} size={13} /> {aspectLabel(W, H)} <span className="caret">▾</span>
      </button>
      {open && (
        <div className="aspect-pop" role="menu">
          {ASPECTS.map((a) => (
            <button key={a.id} role="menuitemradio" aria-checked={cur?.id === a.id} className={cur?.id === a.id ? 'on' : ''} onClick={() => pick(a.id)}>
              <span className="ico-box"><RatioIcon rw={a.rw} rh={a.rh} size={18} /></span>
              <b>{a.label}</b><small>{a.hint}</small>
            </button>
          ))}
          <div className="aspect-sep" />
          <button role="menuitem" onClick={() => { setOpen(false); openProjectSettings(); }}>
            <span className="ico-box">⋯</span><b>Personalizado…</b><small>{W}×{H}</small>
          </button>
        </div>
      )}
    </div>
  );
};
