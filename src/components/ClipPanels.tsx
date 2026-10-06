import React from 'react';
import { useEditor } from '../editor-context';
import { updateClip, updateText, updateTransform } from '../ops';
import { Range, Row, Segmented } from './Fields';
import { Icon } from './Icon';
import type { AnimPreset, Clip, ClipAnim, MediaItem, TextContent } from '../../shared/types';
import { LAYOUT_PRESETS, applyLayoutPreset, getTransform, isDefaultTransform } from '../../shared/transform';
import { ANIM_PRESETS } from '../../shared/anim';
import { DURATIONS_MS, msToFrames } from '../../shared/motion';
import { FONT_LABEL } from '../../shared/fonts';

/** Campos de edição de um clip de texto */
export const TextFields: React.FC<{ clip: Clip; text: TextContent }> = ({ clip, text }) => {
  const { commit, dispatch } = useEditor();
  const set = (patch: Partial<TextContent>) => commit((p) => updateText(p, clip.id, patch));
  const gridPos = [15, 50, 85];
  return (
    <>
      <label className="field">
        <span className="field-label">Texto</span>
        <textarea
          className="text-input"
          rows={3}
          value={text.text}
          onFocus={() => dispatch({ type: 'beginGesture' })}
          onBlur={() => dispatch({ type: 'endGesture' })}
          onChange={(e) => { const v = e.target.value; dispatch({ type: 'gesture', fn: (p) => updateText(p, clip.id, { text: v }) }); }}
        />
      </label>

      <div className="field-grid">
        <Row label="Fonte">
          <select value={text.font} onChange={(e) => set({ font: e.target.value as TextContent['font'] })}>
            {(Object.keys(FONT_LABEL) as TextContent['font'][]).map((f) => <option key={f} value={f}>{FONT_LABEL[f]}</option>)}
          </select>
        </Row>
        <Row label="Cor">
          <div className="color-row">
            <input type="color" value={text.color} onChange={(e) => set({ color: e.target.value })} />
            <code>{text.color}</code>
          </div>
        </Row>
      </div>

      <Row label="Peso">
        <Segmented
          label="Peso da letra"
          value={text.weight}
          onChange={(v) => set({ weight: v })}
          options={[{ value: 400, label: 'Normal' }, { value: 600, label: 'Semi' }, { value: 700, label: 'Negrito' }]}
        />
      </Row>

      <Row label="Tamanho" hint={`${text.size} px`}>
        <Range min={20} max={240} step={1} value={text.size} apply={(v) => (p) => updateText(p, clip.id, { size: v })} />
      </Row>

      <Row label="Alinhamento">
        <Segmented
          label="Alinhamento"
          value={text.align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: 'left', label: <Icon name="alignLeft" size={16} />, title: 'À esquerda (recomendado para parágrafos)' },
            { value: 'center', label: <Icon name="alignCenter" size={16} />, title: 'Ao centro (bom para títulos curtos)' },
            { value: 'right', label: <Icon name="alignRight" size={16} />, title: 'À direita' },
          ]}
        />
      </Row>

      <div className="field">
        <span className="field-label">Posição <em>{Math.round(text.x)}% · {Math.round(text.y)}%</em></span>
        <div className="pos-wrap">
          <div className="pos-grid" role="group" aria-label="Posição rápida">
            {gridPos.map((y) => gridPos.map((x) => (
              <button
                key={`${x}-${y}`}
                className={Math.round(text.x) === x && Math.round(text.y) === y ? 'on' : ''}
                onClick={() => set({ x, y })}
                title={`${y === 15 ? 'Cima' : y === 50 ? 'Meio' : 'Baixo'} · ${x === 15 ? 'esquerda' : x === 50 ? 'centro' : 'direita'}`}
              />
            )))}
          </div>
          <div className="pos-sliders">
            <Range min={0} max={100} step={0.5} value={text.x} apply={(v) => (p) => updateText(p, clip.id, { x: v })} />
            <Range min={0} max={100} step={0.5} value={text.y} apply={(v) => (p) => updateText(p, clip.id, { y: v })} />
          </div>
        </div>
        <p className="hint">Também podes arrastar o texto diretamente na pré-visualização.</p>
      </div>

      <Row label="Largura máxima" hint={`${text.maxWidth}%`}>
        <Range min={20} max={100} step={1} value={text.maxWidth} apply={(v) => (p) => updateText(p, clip.id, { maxWidth: v })} />
      </Row>

      <div className="field-grid">
        <label className="check">
          <input type="checkbox" checked={text.background !== null} onChange={(e) => set({ background: e.target.checked ? '#000000' : null })} />
          Caixa de fundo
        </label>
        {text.background !== null && (
          <input type="color" value={text.background} onChange={(e) => set({ background: e.target.value })} aria-label="Cor da caixa" />
        )}
        <label className="check">
          <input type="checkbox" checked={text.shadow} onChange={(e) => set({ shadow: e.target.checked })} />
          Sombra
        </label>
      </div>
      {text.background !== null && (
        <Row label="Opacidade da caixa" hint={`${Math.round((text.bgOpacity ?? 0.85) * 100)}%`}>
          <Range min={0} max={1} step={0.01} value={text.bgOpacity ?? 0.85} apply={(v) => (p) => updateText(p, clip.id, { bgOpacity: v })} />
        </Row>
      )}
    </>
  );
};

const DUR_PRESETS: { label: string; ms: number }[] = [
  { label: 'Rápida', ms: DURATIONS_MS['moderate-02'] },
  { label: 'Média', ms: DURATIONS_MS['slow-01'] },
  { label: 'Lenta', ms: DURATIONS_MS['slow-02'] },
  { label: '1 s', ms: 1000 },
];

const AnimEditor: React.FC<{ clip: Clip; which: 'animIn' | 'animOut'; isText: boolean; fps: number }> = ({ clip, which, isText, fps }) => {
  const { commit } = useEditor();
  const anim: ClipAnim = clip[which] ?? { preset: 'none', duration: msToFrames(DURATIONS_MS['slow-01'], fps), style: which === 'animIn' ? 'expressive' : 'productive' };
  const other = which === 'animIn' ? clip.animOut : clip.animIn;
  const maxDur = Math.max(2, clip.duration - (other && other.preset !== 'none' ? Math.min(other.duration, clip.duration) : 0));
  const set = (patch: Partial<ClipAnim>) => commit((p) => updateClip(p, clip.id, { [which]: { ...anim, ...patch } }));
  const presets = ANIM_PRESETS.filter((a) => isText || !a.textOnly);
  const on = anim.preset !== 'none';
  return (
    <div className="anim-box">
      <div className="anim-head">
        <strong>{which === 'animIn' ? 'Entrada' : 'Saída'}</strong>
        <select value={anim.preset} onChange={(e) => set({ preset: e.target.value as AnimPreset })} aria-label={which === 'animIn' ? 'Animação de entrada' : 'Animação de saída'}>
          {presets.map((a) => <option key={a.preset} value={a.preset}>{a.label}</option>)}
        </select>
      </div>
      {on && (
        <>
          <Segmented
            label="Curva"
            value={anim.style}
            onChange={(v) => set({ style: v })}
            options={[
              { value: 'productive', label: 'Produtiva', title: 'IBM productive: discreta e rápida, para informação' },
              { value: 'expressive', label: 'Expressiva', title: 'IBM expressive: mais presença, para momentos de destaque' },
            ]}
          />
          <Row label="Duração" hint={`${(Math.min(anim.duration, maxDur) / fps).toFixed(2).replace('.', ',')} s`}>
            <Range min={2} max={maxDur} step={1} value={Math.min(anim.duration, maxDur)} apply={(v) => (p) => updateClip(p, clip.id, { [which]: { ...anim, duration: v } })} />
          </Row>
          <div className="chip-row">
            {DUR_PRESETS.map((d) => {
              const fr = Math.min(maxDur, msToFrames(d.ms, fps));
              return <button key={d.label} className={`chip${fr === Math.min(anim.duration, maxDur) ? ' on' : ''}`} onClick={() => set({ duration: fr })} title={`${d.ms} ms`}>{d.label}</button>;
            })}
          </div>
        </>
      )}
    </div>
  );
};

/** Animações de entrada e saída (texto e clips visuais) */
export const AnimSection: React.FC<{ clip: Clip; isText: boolean; fps: number }> = ({ clip, isText, fps }) => (
  <section className="section">
    <h3 className="section-title">Animação</h3>
    <AnimEditor clip={clip} which="animIn" isText={isText} fps={fps} />
    <AnimEditor clip={clip} which="animOut" isText={isText} fps={fps} />
    <p className="hint">Regras IBM: um eixo de cada vez, sem ressaltos; o texto aparece no sentido da leitura.</p>
  </section>
);

/** Posição, escala, rotação, espelho, recorte e opacidade de um clip de vídeo/imagem */
export const TransformSection: React.FC<{ clip: Clip; media: MediaItem }> = ({ clip, media }) => {
  const { state, commit } = useEditor();
  const { width: W, height: H } = state.project;
  const t = getTransform(clip);
  const set = (patch: Parameters<typeof updateTransform>[2]) => commit((p) => updateTransform(p, clip.id, patch));
  const cropRange = (side: 'top' | 'right' | 'bottom' | 'left', label: string) => (
    <Row label={label} hint={`${Math.round(t.crop[side])}%`}>
      <Range min={0} max={90} step={0.5} value={t.crop[side]} apply={(v) => (p) => updateTransform(p, clip.id, { crop: { ...t.crop, [side]: v } })} />
    </Row>
  );
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Enquadramento</h3>
        <button className="btn tiny" disabled={isDefaultTransform(t)} onClick={() => commit((p) => updateClip(p, clip.id, { transform: undefined }))}>Repor</button>
      </div>

      <div className="layout-grid" role="group" aria-label="Disposições rápidas">
        {LAYOUT_PRESETS.map((l) => (
          <button key={l.preset} className={`layout-opt l-${l.preset}`} title={l.label} onClick={() => commit((p) => updateClip(p, clip.id, { transform: applyLayoutPreset(l.preset, media, W, H, t) }))}>
            <span className="layout-ico" aria-hidden><i /></span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
      <p className="hint">Para ecrã dividido: põe cada vídeo numa pista e escolhe "Metade esq." num e "Metade dir." no outro. Também podes arrastar, redimensionar e rodar na pré-visualização.</p>

      <Row label="Escala" hint={`${Math.round(t.scale * 100)}%`}>
        <Range min={0.05} max={4} step={0.01} value={t.scale} apply={(v) => (p) => updateTransform(p, clip.id, { scale: v })} />
      </Row>
      <div className="field">
        <span className="field-label">Posição <em>{Math.round(t.x)}% · {Math.round(t.y)}%</em></span>
        <div className="pos-sliders">
          <Range min={-50} max={150} step={0.5} value={t.x} apply={(v) => (p) => updateTransform(p, clip.id, { x: v })} />
          <Range min={-50} max={150} step={0.5} value={t.y} apply={(v) => (p) => updateTransform(p, clip.id, { y: v })} />
        </div>
      </div>
      <Row label="Rotação" hint={`${Math.round(t.rotation)}°`}>
        <Range min={-180} max={180} step={1} value={t.rotation} apply={(v) => (p) => updateTransform(p, clip.id, { rotation: v })} />
      </Row>
      <div className="btn-row">
        <button className="btn" title="Rodar 90° para a esquerda" onClick={() => set({ rotation: ((t.rotation - 90 + 540) % 360) - 180 })}><Icon name="rotateL" size={16} /></button>
        <button className="btn" title="Rodar 90° para a direita" onClick={() => set({ rotation: ((t.rotation + 90 + 540) % 360) - 180 })}><Icon name="rotateR" size={16} /></button>
        <button className={`btn${t.flipH ? ' active' : ''}`} title="Espelhar na horizontal" onClick={() => set({ flipH: !t.flipH })}><Icon name="flipH" size={16} /></button>
        <button className={`btn${t.flipV ? ' active' : ''}`} title="Espelhar na vertical" onClick={() => set({ flipV: !t.flipV })}><Icon name="flipV" size={16} /></button>
      </div>
      <Row label="Ajuste ao quadro">
        <Segmented label="Ajuste" value={t.fit} onChange={(v) => set({ fit: v })}
          options={[{ value: 'contain', label: 'Caber inteiro', title: 'Mostra a imagem toda (pode ficar com barras)' }, { value: 'cover', label: 'Preencher', title: 'Enche o quadro (corta o que sobra)' }]} />
      </Row>
      <Row label="Opacidade" hint={`${Math.round(t.opacity * 100)}%`}>
        <Range min={0} max={1} step={0.01} value={t.opacity} apply={(v) => (p) => updateTransform(p, clip.id, { opacity: v })} />
      </Row>
      <details className="crop-box">
        <summary>Recorte</summary>
        {cropRange('top', 'Cima')}
        {cropRange('bottom', 'Baixo')}
        {cropRange('left', 'Esquerda')}
        {cropRange('right', 'Direita')}
      </details>
    </section>
  );
};
