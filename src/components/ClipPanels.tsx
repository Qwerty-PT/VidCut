import React from 'react';
import { useEditor } from '../editor-context';
import { applyCaptionLook, updateTemplateProps, DEFAULT_COLOR, SPEED_MAX, SPEED_MIN, addKeyframe, clearKeyframes, removeKeyframe, setAnimatedProps, setKeyframeEasing, setSpeed, updateClip, updateColor, updateText, updateTransform } from '../ops';
import { useFrame, playhead } from '../playhead';
import { KF_EASINGS, keyframeAt, valuesAt } from '../../shared/keyframes';
import { applyTheme, supportsThemes, type FieldDef, type TemplateDef } from '../../shared/template-api';
import { THEMES, THEME_KEY } from '../../shared/themes';
import { Range, Row, Segmented } from './Fields';
import { Icon } from './Icon';
import type { AnimPreset, Clip, ClipAnim, ClipColor, MediaItem, TextContent } from '../../shared/types';
import { clipSpeed } from '../../shared/types';
import { LAYOUT_PRESETS, applyLayoutPreset, getTransform, isDefaultTransform } from '../../shared/transform';
import { ANIM_PRESETS } from '../../shared/anim';
import { DURATIONS_MS, msToFrames } from '../../shared/motion';
import { FONT_LABEL } from '../../shared/fonts';
import { CAPTION_STYLES, toSrt } from '../../shared/captions';
import { api } from '../api';

/** Campos de edição de um clip de texto */
export const TextFields: React.FC<{ clip: Clip; text: TextContent }> = ({ clip, text }) => {
  const { commit, dispatch } = useEditor();
  const frame = useFrame();
  const rel = Math.min(clip.duration - 1, Math.max(0, frame - clip.start));
  const kv = valuesAt(clip, rel);
  const anim = (patch: Parameters<typeof setAnimatedProps>[3]) => (p: Parameters<typeof setAnimatedProps>[0]) => setAnimatedProps(p, clip.id, rel, patch);
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
        <span className="field-label">Posição <em>{Math.round(kv.x)}% · {Math.round(kv.y)}%</em></span>
        <KeyframeBar clip={clip} />
        <div className="pos-wrap">
          <div className="pos-grid" role="group" aria-label="Posição rápida">
            {gridPos.map((y) => gridPos.map((x) => (
              <button
                key={`${x}-${y}`}
                className={Math.round(kv.x) === x && Math.round(kv.y) === y ? 'on' : ''}
                onClick={() => commit(anim({ x, y }))}
                title={`${y === 15 ? 'Cima' : y === 50 ? 'Meio' : 'Baixo'} · ${x === 15 ? 'esquerda' : x === 50 ? 'centro' : 'direita'}`}
              />
            )))}
          </div>
          <div className="pos-sliders">
            <Range min={0} max={100} step={0.5} value={kv.x} apply={(v) => anim({ x: v })} />
            <Range min={0} max={100} step={0.5} value={kv.y} apply={(v) => anim({ y: v })} />
          </div>
        </div>
        <p className="hint">Também podes arrastar o texto diretamente na pré-visualização.</p>
      </div>

      <div className="field-grid">
        <Row label="Escala" hint={`${Math.round(kv.scale * 100)}%`}>
          <Range min={0.1} max={4} step={0.01} value={kv.scale} apply={(v) => anim({ scale: v })} />
        </Row>
        <Row label="Rotação" hint={`${Math.round(kv.rotation)}°`}>
          <Range min={-180} max={180} step={1} value={kv.rotation} apply={(v) => anim({ rotation: v })} />
        </Row>
      </div>
      <Row label="Opacidade" hint={`${Math.round(kv.opacity * 100)}%`}>
        <Range min={0} max={1} step={0.01} value={kv.opacity} apply={(v) => anim({ opacity: v })} />
      </Row>

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
  const frame = useFrame();
  const rel = Math.min(clip.duration - 1, Math.max(0, frame - clip.start));
  const t0 = getTransform(clip);
  const t = { ...t0, ...valuesAt(clip, rel) }; // valores no frame atual (com keyframes)
  const set = (patch: Parameters<typeof updateTransform>[2]) => commit((p) => updateTransform(p, clip.id, patch));
  const anim = (patch: Parameters<typeof setAnimatedProps>[3]) => (p: Parameters<typeof setAnimatedProps>[0]) => setAnimatedProps(p, clip.id, rel, patch);
  const cropRange = (side: 'top' | 'right' | 'bottom' | 'left', label: string) => (
    <Row label={label} hint={`${Math.round(t.crop[side])}%`}>
      <Range min={0} max={90} step={0.5} value={t.crop[side]} apply={(v) => (p) => updateTransform(p, clip.id, { crop: { ...t.crop, [side]: v } })} />
    </Row>
  );
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Enquadramento</h3>
        <button className="btn tiny" disabled={isDefaultTransform(t0) && !clip.keyframes} onClick={() => commit((p) => updateClip(p, clip.id, { transform: undefined, keyframes: undefined }))}>Repor</button>
      </div>
      <KeyframeBar clip={clip} />

      <div className="layout-grid" role="group" aria-label="Disposições rápidas">
        {LAYOUT_PRESETS.map((l) => (
          <button key={l.preset} className={`layout-opt l-${l.preset}`} title={l.label} onClick={() => commit((p) => {
            const nt = applyLayoutPreset(l.preset, media, W, H, t0);
            const q = updateClip(p, clip.id, { transform: nt });
            return clip.keyframes?.length ? setAnimatedProps(q, clip.id, rel, { x: nt.x, y: nt.y, scale: nt.scale, rotation: nt.rotation }) : q;
          })}>
            <span className="layout-ico" aria-hidden><i /></span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
      <p className="hint">Para ecrã dividido: põe cada vídeo numa pista e escolhe "Metade esq." num e "Metade dir." no outro. Também podes arrastar, redimensionar e rodar na pré-visualização.</p>

      <Row label="Escala" hint={`${Math.round(t.scale * 100)}%`}>
        <Range min={0.05} max={4} step={0.01} value={t.scale} apply={(v) => anim({ scale: v })} />
      </Row>
      <div className="field">
        <span className="field-label">Posição <em>{Math.round(t.x)}% · {Math.round(t.y)}%</em></span>
        <div className="pos-sliders">
          <Range min={-50} max={150} step={0.5} value={t.x} apply={(v) => anim({ x: v })} />
          <Range min={-50} max={150} step={0.5} value={t.y} apply={(v) => anim({ y: v })} />
        </div>
      </div>
      <Row label="Rotação" hint={`${Math.round(t.rotation)}°`}>
        <Range min={-180} max={180} step={1} value={t.rotation} apply={(v) => anim({ rotation: v })} />
      </Row>
      <div className="btn-row">
        <button className="btn" title="Rodar 90° para a esquerda" onClick={() => commit(anim({ rotation: ((t.rotation - 90 + 540) % 360) - 180 }))}><Icon name="rotateL" size={16} /></button>
        <button className="btn" title="Rodar 90° para a direita" onClick={() => commit(anim({ rotation: ((t.rotation + 90 + 540) % 360) - 180 }))}><Icon name="rotateR" size={16} /></button>
        <button className={`btn${t.flipH ? ' active' : ''}`} title="Espelhar na horizontal" onClick={() => set({ flipH: !t.flipH })}><Icon name="flipH" size={16} /></button>
        <button className={`btn${t.flipV ? ' active' : ''}`} title="Espelhar na vertical" onClick={() => set({ flipV: !t.flipV })}><Icon name="flipV" size={16} /></button>
      </div>
      <Row label="Ajuste ao quadro">
        <Segmented label="Ajuste" value={t.fit} onChange={(v) => set({ fit: v })}
          options={[{ value: 'contain', label: 'Caber inteiro', title: 'Mostra a imagem toda (pode ficar com barras)' }, { value: 'cover', label: 'Preencher', title: 'Enche o quadro (corta o que sobra)' }]} />
      </Row>
      <Row label="Opacidade" hint={`${Math.round(t.opacity * 100)}%`}>
        <Range min={0} max={1} step={0.01} value={t.opacity} apply={(v) => anim({ opacity: v })} />
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

const fmtSpeed = (v: number) => `${v.toFixed(v < 1 ? 2 : 1).replace('.', ',')}×`;

/** Velocidade do clip (vídeo e áudio) */
export const SpeedSection: React.FC<{ clip: Clip; fps: number }> = ({ clip, fps }) => {
  const { commit } = useEditor();
  const sp = clipSpeed(clip);
  const chips = [0.5, 1, 1.5, 2, 3];
  return (
    <section className="section">
      <h3 className="section-title">Velocidade</h3>
      <Row label="Velocidade" hint={`${fmtSpeed(sp)} · ${(clip.duration / fps).toFixed(1).replace('.', ',')} s`}>
        <Range min={Math.log2(SPEED_MIN)} max={Math.log2(SPEED_MAX)} step={0.01} value={Math.log2(sp)} apply={(v) => (p) => setSpeed(p, clip.id, 2 ** v)} />
      </Row>
      <div className="chip-row">
        {chips.map((c) => (
          <button key={c} className={`chip${Math.abs(c - sp) < 0.005 ? ' on' : ''}`} onClick={() => commit((p) => setSpeed(p, clip.id, c))}>{fmtSpeed(c)}</button>
        ))}
      </div>
      <p className="hint">Mantém o mesmo excerto: o clip fica mais curto ou mais comprido e os clips seguintes da pista acompanham.{clip.audioDetached ? ' O áudio separado não muda: ajusta-o na pista de áudio.' : ''}</p>
    </section>
  );
};

const COLOR_PRESETS: { label: string; c: Partial<ClipColor> }[] = [
  { label: 'Original', c: {} },
  { label: 'Vívido', c: { saturation: 30, contrast: 12 } },
  { label: 'Quente', c: { temperature: 35, saturation: 8 } },
  { label: 'Frio', c: { temperature: -35 } },
  { label: 'P&B', c: { saturation: -100, contrast: 12 } },
  { label: 'Sépia', c: { sepia: 80, contrast: -5 } },
  { label: 'Desbotado', c: { contrast: -18, saturation: -30, brightness: 6 } },
  { label: 'Cinema', c: { contrast: 18, saturation: -12, temperature: -12, vignette: 35 } },
  { label: 'Vintage', c: { sepia: 35, contrast: -10, saturation: -15, vignette: 45 } },
];

/** Ajustes de cor e efeitos (vídeo e imagem) */
export const ColorSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { commit } = useEditor();
  const c = { ...DEFAULT_COLOR, ...clip.color };
  const same = (pc: Partial<ClipColor>) => (Object.keys(DEFAULT_COLOR) as (keyof ClipColor)[]).every((k) => (pc[k] ?? 0) === c[k]);
  const slider = (key: keyof ClipColor, label: string, min: number, max: number, unit = '') => (
    <Row label={label} hint={`${c[key] > 0 && min < 0 ? '+' : ''}${c[key]}${unit}`}>
      <Range min={min} max={max} step={1} value={c[key]} apply={(v) => (p) => updateColor(p, clip.id, { [key]: v })} />
    </Row>
  );
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Cor e efeitos</h3>
        <button className="btn tiny" disabled={!clip.color} onClick={() => commit((p) => updateClip(p, clip.id, { color: undefined }))}>Repor</button>
      </div>
      <div className="chip-row filters">
        {COLOR_PRESETS.map((pr) => (
          <button key={pr.label} className={`chip${same(pr.c) ? ' on' : ''}`} onClick={() => commit((p) => updateColor(p, clip.id, { ...DEFAULT_COLOR, ...pr.c }))}>{pr.label}</button>
        ))}
      </div>
      {slider('brightness', 'Brilho', -100, 100)}
      {slider('contrast', 'Contraste', -100, 100)}
      {slider('saturation', 'Saturação', -100, 100)}
      {slider('temperature', 'Temperatura', -100, 100)}
      <details className="crop-box">
        <summary>Efeitos</summary>
        {slider('blur', 'Desfocar', 0, 40)}
        {slider('vignette', 'Vinheta', 0, 100)}
        {slider('sepia', 'Sépia', 0, 100)}
      </details>
    </section>
  );
};

/**
 * Barra de keyframes: adicionar/remover no frame atual, saltar entre keyframes e escolher a curva.
 * Com keyframes, qualquer alteração de posição/escala/rotação/opacidade cria ou atualiza o keyframe no frame atual.
 */
export const KeyframeBar: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { commit } = useEditor();
  const frame = useFrame();
  const inside = frame >= clip.start && frame < clip.start + clip.duration;
  const rel = frame - clip.start;
  const kfs = clip.keyframes ?? [];
  const here = inside ? keyframeAt(clip, rel) : undefined;
  const prev = [...kfs].reverse().find((k) => k.frame < rel);
  const next = kfs.find((k) => k.frame > rel);
  return (
    <div className={`kf-bar${kfs.length ? ' has' : ''}`}>
      <div className="kf-row">
        <button className="icon-btn mini" title="Keyframe anterior" disabled={!prev} onClick={() => prev && playhead.seek(clip.start + prev.frame)}><Icon name="prev" size={15} /></button>
        <button
          className={`btn small kf-toggle${here ? ' on' : ''}`}
          disabled={!inside}
          title={inside ? (here ? 'Remover o keyframe neste frame' : 'Guardar os valores atuais num keyframe neste frame') : 'Põe a cabeça de leitura dentro do clip'}
          onClick={() => commit((p) => (here ? removeKeyframe(p, clip.id, here.id) : addKeyframe(p, clip.id, rel)))}
        >
          <span className="kf-diamond" aria-hidden /> {here ? 'Remover keyframe' : 'Adicionar keyframe'}
        </button>
        <button className="icon-btn mini" title="Keyframe seguinte" disabled={!next} onClick={() => next && playhead.seek(clip.start + next.frame)}><Icon name="next" size={15} /></button>
      </div>
      {kfs.length > 0 && (
        <div className="kf-row">
          <span className="kf-count">{`${kfs.length} keyframe${kfs.length > 1 ? 's' : ''}`}</span>
          <button className="btn tiny" title="Apagar todos os keyframes (fica o valor deste frame)" onClick={() => commit((p) => clearKeyframes(p, clip.id, Math.max(0, Math.min(clip.duration - 1, rel))))}>Limpar</button>
        </div>
      )}
      {here && (
        <Segmented
          label="Curva até ao keyframe seguinte"
          value={here.easing}
          onChange={(v) => commit((p) => setKeyframeEasing(p, clip.id, here.id, v))}
          options={KF_EASINGS.map((e) => ({ value: e.value, label: e.label, title: e.title }))}
        />
      )}
      {!kfs.length && <p className="hint">Para animar: põe a cabeça de leitura no início, carrega em "Adicionar keyframe", avança e muda a posição/escala/rotação — o keyframe seguinte é criado sozinho.</p>}
    </div>
  );
};

/** Campos de um modelo, gerados automaticamente a partir de `fields` */
export const TemplateFields: React.FC<{ clip: Clip; def: TemplateDef }> = ({ clip, def }) => {
  const { state, commit, dispatch } = useEditor();
  const props = clip.template?.props ?? {};
  const val = (f: FieldDef) => (props[f.key] === undefined ? f.default : props[f.key]);
  const set = (key: string, v: unknown) => commit((p) => updateTemplateProps(p, clip.id, { [key]: v }));
  const typing = (key: string) => ({
    onFocus: () => dispatch({ type: 'beginGesture' }),
    onBlur: () => dispatch({ type: 'endGesture' }),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      dispatch({ type: 'gesture', fn: (p) => updateTemplateProps(p, clip.id, { [key]: v }) });
    },
  });
  const images = state.project.media.filter((m) => m.kind === 'image');
  return (
    <section className="section tpl-fields">
      <h3 className="section-title">{def.name}</h3>
      {def.description && <p className="hint">{def.description}</p>}
      {supportsThemes(def) && (
        <div className="field">
          <span className="field-label">Tema</span>
          <div className="theme-chips">
            {THEMES.map((t) => (
              <button key={t.id} className={`theme-chip${props[THEME_KEY] === t.id ? ' on' : ''}`} onClick={() => commit((p) => updateTemplateProps(p, clip.id, applyTheme(def, props, t.id)))} title={`Aplicar o tema ${t.label} (as cores continuam editáveis)`}>
                <span className="sw" style={{ background: t.colors.bg }}><i style={{ background: t.colors.accent }} /></span>{t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {def.fields.map((f) => {
        const v = val(f);
        switch (f.type) {
          case 'text':
            return <Row key={f.key} label={f.label}><input type="text" value={String(v)} {...typing(f.key)} /></Row>;
          case 'textarea':
            return (
              <label key={f.key} className="field">
                <span className="field-label">{f.label}</span>
                <textarea className="text-input" rows={4} value={String(v)} {...typing(f.key)} />
              </label>
            );
          case 'color':
            return (
              <Row key={f.key} label={f.label}>
                <div className="color-row"><input type="color" value={String(v)} onChange={(e) => set(f.key, e.target.value)} /><code>{String(v)}</code></div>
              </Row>
            );
          case 'number':
            return (
              <Row key={f.key} label={f.label} hint={String(Math.round(Number(v) * 100) / 100)}>
                <div className="num-row">
                  <Range min={f.min} max={f.max} step={f.step ?? (f.max - f.min > 100 ? 1 : 0.1)} value={Number(v)} apply={(n) => (p) => updateTemplateProps(p, clip.id, { [f.key]: n })} />
                  <input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={Number(v)} onChange={(e) => set(f.key, Number(e.target.value))} />
                </div>
              </Row>
            );
          case 'select':
            return (
              <Row key={f.key} label={f.label}>
                <select value={String(v)} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Row>
            );
          case 'boolean':
            return (
              <label key={f.key} className="check">
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            );
          case 'image':
            return (
              <Row key={f.key} label={f.label}>
                <select value={String(v)} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">— nenhuma —</option>
                  {images.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {!images.length && <span className="hint">Importa primeiro uma imagem (PNG com transparência fica melhor).</span>}
              </Row>
            );
          default:
            return null;
        }
      })}
    </section>
  );
};

/** Secção "Legenda" para clips de texto criados pela transcrição (ou importados de .srt) */
export const CaptionSection: React.FC<{ clip: Clip; projectName: string }> = ({ clip, projectName }) => {
  const { commit, state, notify } = useEditor();
  const cap = clip.caption;
  if (!cap) return null;
  const track = state.project.tracks.find((t) => t.clips.some((c) => c.id === clip.id));
  const others = track ? track.clips.filter((c) => c.caption).length : 0;
  const exportSrt = async () => {
    if (!track) return;
    const out = await api().captionsSaveSrt(toSrt(track.clips, state.project.fps), `${projectName} - ${track.name}`);
    if (out) notify('Legendas exportadas para .srt');
  };
  return (
    <section className="section">
      <h3 className="section-title">Legenda</h3>
      <Row label="Estilo (todas as legendas da pista)">
        <Segmented label="Estilo da legenda" value={cap.style} onChange={(style) => commit((p) => applyCaptionLook(p, clip.id, { style }))}
          options={CAPTION_STYLES.map((c) => ({ value: c.style, label: c.label, title: c.hint }))} />
      </Row>
      {cap.style !== 'classic' && cap.style !== 'pop' && (
        <Row label="Cor de destaque">
          <span className="color-row">
            <input type="color" value={cap.highlight} onChange={(e) => commit((p) => applyCaptionLook(p, clip.id, { highlight: e.target.value }))} />
            <code>{cap.highlight}</code>
          </span>
        </Row>
      )}
      <div className="btn-col">
        <button className="btn block" title="Copia a letra, tamanho, cor, fundo e posição desta legenda para as outras" onClick={() => commit((p) => applyCaptionLook(p, clip.id, { copyText: true }))}>
          Aplicar este aspeto às {others} legendas
        </button>
        <button className="btn block" onClick={exportSrt}>Exportar legendas (.srt)</button>
      </div>
      <p className="hint">Ao corrigir o texto, os tempos das palavras mantêm-se se o número de palavras for igual; se não, são redistribuídos pela duração do clip.</p>
    </section>
  );
};
