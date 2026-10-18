// Separador "Efeitos": miniaturas animadas, clique mostra no ecrã principal, duplo clique/arrastar aplica.
import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { addEffect, effectTarget } from '../ops';
import { playhead } from '../playhead';
import { EFFECTS, EFFECT_CATEGORIES, type EffectDef } from '../../shared/effects';
import { effectPreview, setPreview, clearPreview } from '../preview-override';

export const EFFECT_DRAG_TYPE = 'application/x-vidcut-effect';

const TW = 160, TH = 90;

/** Cena de amostra (formas simples) com o efeito aplicado; anima só com o rato por cima */
const EffectThumb: React.FC<{ def: EffectDef; playing: boolean }> = ({ def, playing }) => {
  const [t, setT] = useState(18);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) { setT(18); return; }
    const t0 = performance.now();
    const tick = (now: number) => { setT(18 + Math.floor(((now - t0) / 1000) * 30)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  const out = def.render({ t, fps: 30, dur: 150, w: TW, h: TH, k: TH / 1080 * 2.2, i: Math.min(1, def.intensity / 100 + 0.25), seed: 7, fid: `fxt-${def.id}` });
  return (
    <div className="fx-thumb-clip">
      <div className="fx-scene" style={{ transform: out.transform, filter: out.filter }}>
        {out.svg && <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>{out.svg}</svg>}
        <div className="fx-sky" />
        <div className="fx-sun" />
        <div className="fx-hill a" />
        <div className="fx-hill b" />
        {out.overlay}
      </div>
    </div>
  );
};

const EffectCard: React.FC<{ def: EffectDef }> = ({ def }) => {
  const { state, commit, notify } = useEditor();
  const [hover, setHover] = useState(false);
  const target = () => effectTarget(state.project, state.selection, playhead.frame);
  const apply = () => {
    const id = target();
    if (!id) { notify('Seleciona um clip de vídeo ou imagem (ou põe a agulha por cima de um) para aplicar o efeito.', 'error'); return; }
    clearPreview();
    commit((p) => ({ project: addEffect(p, id, def.id, def.intensity), select: [id] }));
    notify(`Efeito "${def.name}" aplicado. Ajusta a intensidade no separador Cor · Fx.`);
  };
  return (
    <li
      className="tpl-card fx-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(EFFECT_DRAG_TYPE, def.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onDoubleClick={apply}
      onClick={() => {
        const id = target();
        if (!id) { notify('Seleciona um clip de vídeo ou imagem para ver o efeito no ecrã.', 'error'); return; }
        const o = effectPreview(state.project, id, def.id, playhead.frame);
        if (o) setPreview({ ...o, sticky: true });
      }}
      data-preview-source
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${def.name} — ${def.description}\nClique: ver no clip selecionado · Duplo clique ou arrastar para um clip: aplicar`}
    >
      <div className="tpl-thumb fx-thumb"><EffectThumb def={def} playing={hover} /></div>
      <span className="tpl-name">{def.name}</span>
    </li>
  );
};

export const EffectsLibrary: React.FC = () => (
  <div className="tpl-gallery fx-lib">
    <p className="hint fx-help">Clique para ver no clip selecionado · duplo clique ou arrastar para um clip para aplicar. Podes juntar vários.</p>
    {EFFECT_CATEGORIES.map((cat) => (
      <section key={cat}>
        <h3 className="tpl-cat">{cat}</h3>
        <ul className="tpl-grid">
          {EFFECTS.filter((e) => e.category === cat).map((e) => <EffectCard key={e.id} def={e} />)}
        </ul>
      </section>
    ))}
  </div>
);
