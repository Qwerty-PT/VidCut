import React from 'react';
import { useEditor } from '../editor-context';
import { updateClip, updateText } from '../ops';
import { Range, Row, Segmented } from './Fields';
import { Icon } from './Icon';
import type { AnimPreset, Clip, ClipAnim, TextContent } from '../../shared/types';
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
