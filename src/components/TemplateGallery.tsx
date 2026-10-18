import React, { useMemo, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { useEditor } from '../editor-context';
import { addTemplateClip } from '../ops';
import { playhead } from '../playhead';
import { TEMPLATES } from '../../shared/templates';
import { TemplateDurationContext, templateDefaults, type TemplateDef } from '../../shared/template-api';
import { TEMPLATE_DRAG_TYPE } from './MediaBin';
import { setPreview, templatePreview } from '../preview-override';

/** Pré-visualização de um modelo com os valores por defeito (fundo xadrez escuro se for transparente) */
const PreviewComp: React.FC<{ def: TemplateDef; dur: number }> = ({ def, dur }) => {
  const props = useMemo(() => templateDefaults(def), [def]);
  const Comp = def.component;
  return (
    <AbsoluteFill style={{ background: def.opaque ? '#000' : 'repeating-conic-gradient(#2a2e36 0 25%, #22252c 0 50%) 0 0 / 60px 60px' }}>
      <TemplateDurationContext.Provider value={dur}>
        <Comp p={props} />
      </TemplateDurationContext.Provider>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ def: TemplateDef; onAdd: () => void }> = ({ def, onAdd }) => {
  const { state } = useEditor();
  const [hover, setHover] = useState(false);
  const fps = state.project.fps;
  const dur = Math.max(1, Math.round(def.durationSec * fps));
  const common = {
    component: PreviewComp,
    inputProps: { def, dur },
    durationInFrames: dur,
    compositionWidth: 1920,
    compositionHeight: 1080,
    fps,
    style: { width: '100%', aspectRatio: '16 / 9', display: 'block' } as React.CSSProperties,
  };
  return (
    <li
      className="tpl-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(TEMPLATE_DRAG_TYPE, def.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onDoubleClick={onAdd}
      onClick={() => { const o = templatePreview(state.project, def.id, playhead.frame); if (o) setPreview({ ...o, sticky: true }); }}
      data-preview-source
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${def.description ?? def.name}\nClique: ver no ecrã principal · Duplo clique ou arrastar: adicionar`}
    >
      <div className="tpl-thumb">
        {hover
          ? <Player {...common} autoPlay loop controls={false} clickToPlay={false} acknowledgeRemotionLicense />
          : <Thumbnail {...common} frameToDisplay={Math.round(dur * 0.55)} />}
      </div>
      <span className="tpl-name">{def.name}</span>
    </li>
  );
};

export const TemplateGallery: React.FC = () => {
  const { commit } = useEditor();
  const groups = useMemo(() => {
    const m = new Map<string, TemplateDef[]>();
    for (const t of TEMPLATES) m.set(t.category, [...(m.get(t.category) ?? []), t]);
    const order = ['Títulos', 'Oráculos', 'Logótipo', 'Contagens', 'Dados', 'Listas', 'Fundos', 'Final'];
    return [...m.entries()].sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99);
  }, []);
  const add = (id: string) =>
    commit((p) => { const r = addTemplateClip(p, id, playhead.frame); return { project: r.project, select: r.clipId ? [r.clipId] : undefined }; });

  if (!TEMPLATES.length) return <p className="hint tpl-empty">Não há modelos na pasta modelos/.</p>;
  return (
    <div className="tpl-gallery">
      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="tpl-cat">{cat}</h3>
          <ul className="tpl-grid">
            {list.map((d) => <Card key={d.id} def={d} onAdd={() => add(d.id)} />)}
          </ul>
        </section>
      ))}
      <p className="hint tpl-foot">Para criar os teus: junta um ficheiro .tsx à pasta <code>modelos/</code> (ver <code>modelos/_LEIA-ME.md</code>).</p>
    </div>
  );
};
