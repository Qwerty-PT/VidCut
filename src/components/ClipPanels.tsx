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
import { addFont, isUserFont, userFontFamily, userFontId, userFontKey } from '../../shared/userfonts';
import { FontPicker } from './FontPicker';
import { getEffect } from '../../shared/effects';
import { removeEffect, setEffectIntensity } from '../ops';
import { CAPTION_STYLES, toSrt } from '../../shared/captions';
import { api } from '../api';
import { MASK_SHAPES, defaultMask } from '../../shared/mask';
import { setMask, canUnreverse } from '../ops';
import { reverseClip } from '../analysis-ui';
import type { ClipMask, MaskShape } from '../../shared/types';
import { denoiseClip, duckMusic, replaceWithFile, restoreOriginalSound } from '../analysis-ui';
import { openModal } from '../modals';
import { RAMP_MAX, RAMP_MIN, RAMP_PRESETS, presetRamp, speedAtU, uAtRel } from '../../shared/speedramp';
import { setSpeedRamp } from '../ops';
import type { Project, RampPoint } from '../../shared/types';
import { addVolKey, clearVolKeys, setVolumeAt, clipBeatFrames, updateSticker } from '../ops';
import { volumeAt, toDb } from '../../shared/volume';
import { normalizeClips, detectBeats, syncToBeats, splitOnBeats, splitScenes } from '../analysis-ui';
import { STICKER_ANIMS, getSticker } from '../../shared/stickers';
import type { StickerAnim } from '../../shared/types';

/** Campos de edição de um clip de texto */
export const TextFields: React.FC<{ clip: Clip; text: TextContent }> = ({ clip, text }) => {
  const { commit, dispatch, state } = useEditor();
  const [picker, setPicker] = React.useState(false);
  const projectFonts = Object.values(state.project.fonts ?? {}).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
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

        <Row label="Fonte">
          <div className="font-row">
            <select
              value={text.font}
              style={{ fontFamily: isUserFont(text.font) ? `"${userFontFamily(userFontId(text.font))}"` : undefined }}
              onChange={(e) => { if (e.target.value === '__more') setPicker(true); else set({ font: e.target.value as TextContent['font'] }); }}
            >
              <optgroup label="Incluídas">
                {(Object.keys(FONT_LABEL) as (keyof typeof FONT_LABEL)[]).map((f) => <option key={f} value={f}>{FONT_LABEL[f]}</option>)}
              </optgroup>
              {projectFonts.length > 0 && (
                <optgroup label="Neste projeto">
                  {projectFonts.map((f) => <option key={f.id} value={userFontKey(f.id)}>{f.name}</option>)}
                </optgroup>
              )}
              <option value="__more">Mais fontes…</option>
            </select>
            <button className="icon-btn" title="Procurar fontes do computador ou importar" onClick={() => setPicker(true)}><Icon name="search" size={15} /></button>
          </div>
          {picker && (
            <FontPicker
              onClose={() => setPicker(false)}
              onPick={(fonts) => {
                setPicker(false);
                commit((p) => {
                  let proj = p; let last = '';
                  for (const f of fonts) { const r = addFont(proj, f); proj = r.project; last = r.id; }
                  return updateText(proj, clip.id, { font: userFontKey(last) });
                });
              }}
            />
          )}
        </Row>
      <div className="field-grid">
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
      <div className="field-grid">
        <label className="check">
          <input type="checkbox" checked={!!text.stroke && text.stroke.width > 0} onChange={(e) => set({ stroke: e.target.checked ? { color: text.stroke?.color ?? '#000000', width: text.stroke?.width || 6 } : undefined })} />
          Contorno
        </label>
        {text.stroke && text.stroke.width > 0 && (
          <input type="color" value={text.stroke.color} onChange={(e) => set({ stroke: { ...text.stroke!, color: e.target.value } })} aria-label="Cor do contorno" />
        )}
        <label className="check">
          <input type="checkbox" checked={!!text.glow && text.glow.size > 0} onChange={(e) => set({ glow: e.target.checked ? { color: text.glow?.color ?? '#f2b33d', size: text.glow?.size || 24 } : undefined })} />
          Brilho
        </label>
        {text.glow && text.glow.size > 0 && (
          <input type="color" value={text.glow.color} onChange={(e) => set({ glow: { ...text.glow!, color: e.target.value } })} aria-label="Cor do brilho" />
        )}
      </div>
      {text.stroke && text.stroke.width > 0 && (
        <Row label="Espessura do contorno" hint={`${text.stroke.width} px`}>
          <Range min={1} max={30} step={1} value={text.stroke.width} apply={(v) => (p) => updateText(p, clip.id, { stroke: { ...text.stroke!, width: v } })} />
        </Row>
      )}
      {text.glow && text.glow.size > 0 && (
        <Row label="Intensidade do brilho" hint={`${text.glow.size} px`}>
          <Range min={4} max={80} step={1} value={text.glow.size} apply={(v) => (p) => updateText(p, clip.id, { glow: { ...text.glow!, size: v } })} />
        </Row>
      )}
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
      {media && (media.kind === 'video' || media.kind === 'image') && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={!!clip.bgBlur} onChange={(e) => commit((p) => updateClip(p, clip.id, { bgBlur: e.target.checked ? 50 : undefined }))} />
            Fundo desfocado
          </label>
          {clip.bgBlur ? (
            <Row label="Desfoque" hint={`${clip.bgBlur}%`}>
              <Range min={1} max={100} step={1} value={clip.bgBlur} apply={(v) => (p) => updateClip(p, clip.id, { bgBlur: Math.round(v) })} />
            </Row>
          ) : null}
          <p className="hint">Enche as barras com {media.kind === 'image' ? 'a própria imagem ampliada e desfocada' : 'o próprio vídeo ampliado e desfocado'} — ideal ao passar de 16:9 para 9:16. Usa "Caber inteiro".</p>
        </div>
      )}
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
  const [mode, setMode] = React.useState<'normal' | 'curve'>(clip.speedRamp ? 'curve' : 'normal');
  React.useEffect(() => { setMode(clip.speedRamp ? 'curve' : 'normal'); }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sp = clipSpeed(clip);
  const chips = [0.5, 1, 1.5, 2, 3];
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Velocidade</h3>
        {!clip.lottie && <Segmented label="Tipo de velocidade" value={mode} onChange={(m: 'normal' | 'curve') => setMode(m)} options={[{ value: 'normal', label: 'Normal' }, { value: 'curve', label: 'Curva' }]} />}
      </div>
      {mode === 'normal' ? (
        <>
          <Row label="Velocidade" hint={`${clip.speedRamp ? 'com curva' : fmtSpeed(sp)} · ${(clip.duration / fps).toFixed(1).replace('.', ',')} s`}>
            <Range min={Math.log2(SPEED_MIN)} max={Math.log2(SPEED_MAX)} step={0.01} value={Math.log2(clip.speedRamp ? clip.speedRamp.src / clip.duration : sp)} apply={(v) => (p) => setSpeed(p, clip.id, 2 ** v)} />
          </Row>
          <div className="chip-row">
            {chips.map((c) => (
              <button key={c} className={`chip${!clip.speedRamp && Math.abs(c - sp) < 0.005 ? ' on' : ''}`} onClick={() => commit((p) => setSpeed(p, clip.id, c))}>{fmtSpeed(c)}</button>
            ))}
          </div>
          <p className="hint">Mantém o mesmo excerto: o clip fica mais curto ou mais comprido e os clips seguintes da pista acompanham.{clip.audioDetached ? ' O áudio separado não muda: ajusta-o na pista de áudio.' : ''}</p>
        </>
      ) : <RampEditor clip={clip} fps={fps} />}
    </section>
  );
};

/** Miniatura de uma curva (para os botões dos presets) */
const RampThumb: React.FC<{ points: RampPoint[] }> = ({ points }) => {
  const W = 64, H = 26;
  const y = (s: number) => H / 2 - (Math.log10(s) / 1) * (H / 2 - 2);
  const d = Array.from({ length: 33 }, (_, i) => { const u = i / 32; return `${i ? 'L' : 'M'}${(u * W).toFixed(1)},${y(speedAtU(points, u)).toFixed(1)}`; }).join(' ');
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden><line x1="0" x2={W} y1={H / 2} y2={H / 2} className="ramp-mid" /><path d={d} className="ramp-line" /></svg>;
};

const RampEditor: React.FC<{ clip: Clip; fps: number }> = ({ clip, fps }) => {
  const { commit, dispatch } = useEditor();
  const frame = useFrame();
  const ramp = clip.speedRamp;
  const svg = React.useRef<SVGSVGElement>(null);
  const W = 260, H = 130, PAD = 10;
  const yOf = (s: number) => H / 2 - Math.log10(s) * (H / 2 - PAD);
  const sOf = (y: number) => Math.min(RAMP_MAX, Math.max(RAMP_MIN, Math.pow(10, (H / 2 - y) / (H / 2 - PAD))));
  const xOf = (u: number) => PAD + u * (W - 2 * PAD);
  const uOf = (x: number) => Math.min(1, Math.max(0, (x - PAD) / (W - 2 * PAD)));
  const local = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const apply = (points: RampPoint[], gesture: boolean) => {
    const fn = (p: Project) => setSpeedRamp(p, clip.id, { preset: 'personalizado', src: ramp?.src ?? 1, points });
    if (gesture) dispatch({ type: 'gesture', fn }); else commit(fn);
  };
  const dragPoint = (e: React.PointerEvent, i: number) => {
    if (!ramp || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const pts0 = ramp.points;
    dispatch({ type: 'beginGesture' });
    const move = (ev: PointerEvent) => {
      const q = local(ev);
      const lo = i === 0 ? 0 : pts0[i - 1].u + 0.02, hi = i === pts0.length - 1 ? 1 : pts0[i + 1].u - 0.02;
      const u = i === 0 ? 0 : i === pts0.length - 1 ? 1 : Math.min(hi, Math.max(lo, uOf(q.x)));
      apply(pts0.map((p, j) => (j === i ? { u, s: Math.round(sOf(q.y) * 100) / 100 } : p)), true);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); dispatch({ type: 'endGesture' }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const playU = ramp && frame >= clip.start && frame <= clip.start + clip.duration ? uAtRel(ramp, clip.duration, frame - clip.start) : null;
  return (
    <div className="ramp-box">
      <div className="ramp-presets">
        {RAMP_PRESETS.map((pr) => (
          <button key={pr.id} className={`ramp-preset${ramp?.preset === pr.id ? ' on' : ''}`} title={pr.hint}
            onClick={() => commit((p) => setSpeedRamp(p, clip.id, presetRamp(pr.id, 1)))}>
            <RampThumb points={pr.points} /><span>{pr.name}</span>
          </button>
        ))}
      </div>
      {ramp ? (
        <>
          <svg ref={svg} className="ramp-edit" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curva de velocidade"
            onDoubleClick={(e) => {
              const q = local(e);
              const u = uOf(q.x);
              if (ramp.points.some((p) => Math.abs(p.u - u) < 0.03)) return;
              apply([...ramp.points, { u, s: Math.round(sOf(q.y) * 100) / 100 }].sort((a, b) => a.u - b.u), false);
            }}>
            {[10, 4, 2, 1, 0.5, 0.25, 0.1].map((s) => (
              <g key={s}><line x1={PAD} x2={W - PAD} y1={yOf(s)} y2={yOf(s)} className={s === 1 ? 'ramp-mid' : 'ramp-grid'} /><text x={2} y={yOf(s) + 3} className="ramp-lbl">{s >= 1 ? `${s}×` : `${String(s).replace('0.', ',')}`}</text></g>
            ))}
            {playU !== null && <line x1={xOf(playU)} x2={xOf(playU)} y1={PAD / 2} y2={H - PAD / 2} className="ramp-play" />}
            <path className="ramp-line" d={Array.from({ length: 121 }, (_, i) => { const u = i / 120; return `${i ? 'L' : 'M'}${xOf(u).toFixed(1)},${yOf(speedAtU(ramp.points, u)).toFixed(1)}`; }).join(' ')} />
            {ramp.points.map((p, i) => (
              <circle key={i} cx={xOf(p.u)} cy={yOf(Math.min(RAMP_MAX, Math.max(RAMP_MIN, p.s)))} r={5} className="ramp-pt"
                onPointerDown={(e) => dragPoint(e, i)}
                onDoubleClick={(e) => { e.stopPropagation(); if (i > 0 && i < ramp.points.length - 1) apply(ramp.points.filter((_, j) => j !== i), false); }}>
                <title>{`${String(p.s).replace('.', ',')}× — arrasta; duplo clique apaga`}</title>
              </circle>
            ))}
          </svg>
          <p className="hint">Duração: {(clip.duration / fps).toFixed(1).replace('.', ',')} s. Arrasta os pontos (para cima = mais rápido); duplo clique na curva cria um ponto, num ponto apaga-o. {ramp.points.some((p) => p.s < 0.25 || p.s > 4) ? 'Nas partes muito lentas ou muito rápidas o som fica mudo.' : ''}</p>
          <button className="btn small" onClick={() => commit((p) => setSpeedRamp(p, clip.id, null))}>Tirar curva</button>
        </>
      ) : <p className="hint">Escolhe uma curva: a velocidade muda ao longo do clip (abranda no momento importante e acelera o resto).</p>}
    </div>
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

/** Efeitos da biblioteca aplicados ao clip */
export const EffectsSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { commit } = useEditor();
  const list = clip.effects ?? [];
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Efeitos</h3>
        <button className="btn tiny" disabled={!list.length} onClick={() => commit((p) => updateClip(p, clip.id, { effects: undefined }))}>Tirar todos</button>
      </div>
      {list.length === 0 ? (
        <p className="hint">Sem efeitos. Abre o separador <b>Efeitos</b> à esquerda: clique para ver no ecrã, duplo clique ou arrastar para aplicar.</p>
      ) : list.map((e) => {
        const def = getEffect(e.id);
        return (
          <div key={e.id} className="fx-row">
            <div className="fx-row-head">
              <span>{def?.name ?? e.id}</span>
              <button className="icon-btn" title="Tirar este efeito" onClick={() => commit((p) => removeEffect(p, clip.id, e.id))}><Icon name="close" size={13} /></button>
            </div>
            <Row label="Intensidade" hint={`${e.intensity}%`}>
              <Range min={0} max={100} step={1} value={e.intensity} apply={(v) => (p) => setEffectIntensity(p, clip.id, e.id, Math.round(v))} />
            </Row>
          </div>
        );
      })}
    </section>
  );
};

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
        <h3 className="section-title">Cor</h3>
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
        <summary>Desfocar, vinheta e sépia</summary>
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

// ---------------------------------------------------------------------------
// Volume (com keyframes e normalização), ritmo, cenas e stickers
// ---------------------------------------------------------------------------

export const VolumeSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { state, commit, notify } = useEditor();
  const frame = useFrame();
  const rel = Math.min(clip.duration, Math.max(0, frame - clip.start));
  const inside = frame >= clip.start && frame <= clip.start + clip.duration;
  const keys = clip.volKeys ?? [];
  const v = volumeAt(clip, rel);
  const onKey = keys.some((k) => k.f === Math.round(rel));
  return (
    <div className="vol-box">
      <Row label={keys.length ? 'Volume na agulha' : 'Volume'} hint={`${Math.round(v * 100)}% · ${toDb(v)}`}>
        <Range min={0} max={2} step={0.01} value={Math.min(2, v)} apply={(x) => (p) => setVolumeAt(p, clip.id, rel, x)} />
      </Row>
      <div className="btn-row wrap">
        <button className={`btn small${onKey ? ' on' : ''}`} disabled={!inside || onKey} title="Cria um ponto de volume na agulha: depois muda o volume noutro ponto para fazer subir ou descer" onClick={() => commit((p) => addVolKey(p, clip.id, rel))}>
          <Icon name="diamond" size={13} /> {keys.length ? 'Ponto na agulha' : 'Keyframe de volume'}
        </button>
        {keys.length > 0 && <button className="btn small" onClick={() => commit((p) => clearVolKeys(p, clip.id, rel))}>Tirar pontos ({keys.length})</button>}
        <button className="btn small" title="Mede o som e acerta o volume para −14 LUFS (o nível do YouTube, Instagram e TikTok)" onClick={() => { void normalizeClips({ project: state.project, commit, notify }, [clip.id]); }}>
          <Icon name="normalize" size={13} /> Normalizar
        </button>
      </div>
      <p className="hint">{keys.length
        ? 'Com pontos, o volume muda ao longo do clip. Arrasta os pontos na linha amarela da timeline; duplo clique cria ou apaga.'
        : 'Também podes arrastar a linha amarela no clip, na timeline. Duplo clique nela cria um ponto (keyframe).'}</p>
    </div>
  );
};

export const RhythmSection: React.FC<{ clip: Clip; media: MediaItem }> = ({ clip, media }) => {
  const { state, commit, notify } = useEditor();
  const ctx = { project: state.project, commit, notify };
  const beats = clipBeatFrames(state.project, clip).length;
  const [busy, setBusy] = React.useState(false);
  return (
    <section className="section rhythm-box">
      <div className="section-head"><h3 className="section-title">Ritmo</h3>{media.bpm ? <span className="badge">{Math.round(media.bpm)} BPM</span> : null}</div>
      {media.beats?.length ? (
        <>
          <p className="hint">{beats} batidas neste clip (as marcas na timeline). O íman encaixa nelas.</p>
          <span className="field-label">Encaixar os clips de vídeo no ritmo</span>
          <div className="chip-row">
            <button className="chip" onClick={() => syncToBeats(ctx, state.selection, 1)}>Cada batida</button>
            <button className="chip" onClick={() => syncToBeats(ctx, state.selection, 2)}>2 batidas</button>
            <button className="chip" onClick={() => syncToBeats(ctx, state.selection, 4)}>Compasso</button>
          </div>
          <p className="hint">Usa os clips selecionados (com Shift) ou, sem seleção, os da pista de vídeo principal.</p>
          <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); await detectBeats(ctx, clip.id); setBusy(false); }}>Detetar outra vez</button>
        </>
      ) : (
        <>
          <p className="hint">Encontra as batidas da música para cortar ao ritmo.</p>
          <button className="btn block" disabled={busy} onClick={async () => { setBusy(true); await detectBeats(ctx, clip.id); setBusy(false); }}>
            <Icon name="beat" size={16} /> {busy ? 'A ouvir…' : 'Detetar batidas'}
          </button>
        </>
      )}
    </section>
  );
};

export const ScenesButton: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { state, commit, notify } = useEditor();
  const [busy, setBusy] = React.useState(false);
  return (
    <button className="btn block" disabled={busy} title="Procura os cortes dentro do vídeo e divide o clip em cada um" onClick={async () => { setBusy(true); await splitScenes({ project: state.project, commit, notify }, clip.id); setBusy(false); }}>
      <Icon name="scenes" size={16} /> {busy ? 'A procurar cenas…' : 'Dividir nas mudanças de cena'}
    </button>
  );
};

export const MultiAudioActions: React.FC<{ ids: string[] }> = ({ ids }) => {
  const { state, commit, notify } = useEditor();
  const ctx = { project: state.project, commit, notify };
  return (
    <div className="btn-col">
      <button className="btn block" onClick={() => { void normalizeClips(ctx, ids); }} title="Põe todos com volume parecido (−14 LUFS)"><Icon name="normalize" size={16} /> Normalizar volume</button>
      <span className="field-label">Encaixar no ritmo</span>
      <div className="chip-row">
        <button className="chip" onClick={() => syncToBeats(ctx, ids, 1)}>Cada batida</button>
        <button className="chip" onClick={() => syncToBeats(ctx, ids, 2)}>2 batidas</button>
        <button className="chip" onClick={() => syncToBeats(ctx, ids, 4)}>Compasso</button>
      </div>
      <button className="btn block" onClick={() => splitOnBeats(ctx, ids, 1)}><Icon name="split" size={16} /> Cortar nas batidas</button>
    </div>
  );
};

export const StickerSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { commit, dispatch } = useEditor();
  const s = clip.sticker!;
  const def = s.svg ? undefined : getSticker(s.id);
  const set = (patch: Partial<typeof s>) => commit((p) => updateSticker(p, clip.id, patch));
  return (
    <section className="section">
      {def?.text !== undefined && (
        <Row label="Texto">
          <textarea
            rows={2} value={s.text ?? ''}
            onFocus={() => dispatch({ type: 'beginGesture' })}
            onBlur={() => dispatch({ type: 'endGesture' })}
            onChange={(e) => { const text = e.target.value; dispatch({ type: 'gesture', fn: (p) => updateSticker(p, clip.id, { text }) }); }}
          />
        </Row>
      )}
      {def?.color && (
        <Row label="Cor">
          <div className="color-row">
            <input type="color" value={s.color ?? def.color} onChange={(e) => set({ color: e.target.value })} />
            <code>{s.color ?? def.color}</code>
          </div>
        </Row>
      )}
      <span className="field-label">Animação em loop</span>
      <div className="chip-row">
        {STICKER_ANIMS.filter((a) => a.value !== 'draw' || !!def).map((a) => (
          <button key={a.value} className={`chip${s.anim === a.value ? ' on' : ''}`} onClick={() => set({ anim: a.value as StickerAnim })}>{a.label}</button>
        ))}
      </div>
      <p className="hint">Muda o tamanho e a posição com o rato no ecrã. As animações de entrada/saída estão no separador Animação.</p>
    </section>
  );
};

// ---------- ferramentas de som: silêncios, ruído, ducking ----------

export const AudioToolsSection: React.FC<{ clip: Clip; media: MediaItem }> = ({ clip, media }) => {
  const { state, commit, notify, mediaBase } = useEditor();
  const ctx = { project: state.project, commit, notify, mediaBase };
  const [strength, setStrength] = React.useState(0.5);
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } finally { setBusy(null); } };
  return (
    <section className="section audio-tools">
      <h3 className="section-title">Som</h3>
      <button className="btn block" onClick={() => openModal({ kind: 'silence', clipId: clip.id })} title="Encontra as pausas na fala e corta-as">
        <Icon name="silence" size={16} /> Cortar silêncios…
      </button>
      <div className="tool-row">
        <span className="field-label">Reduzir ruído</span>
        {media.denoisedFrom ? (
          <div className="btn-row wrap">
            <span className="badge ok">✓ Sem ruído</span>
            <button className="btn small" onClick={() => restoreOriginalSound(ctx, clip.id)}>Repor original</button>
          </div>
        ) : (
          <>
            <div className="chip-row">
              {([[0.25, 'Suave'], [0.5, 'Normal'], [0.85, 'Forte']] as const).map(([v, l]) => (
                <button key={l} className={`chip${strength === v ? ' on' : ''}`} onClick={() => setStrength(v)}>{l}</button>
              ))}
            </div>
            <button className="btn block" disabled={!!busy} onClick={() => run('dn', () => denoiseClip(ctx, clip.id, strength))} title="Tira zumbido, vento e ruído de fundo da voz">
              <Icon name="denoise" size={16} /> {busy === 'dn' ? 'A limpar…' : 'Reduzir ruído'}
            </button>
          </>
        )}
      </div>
      <div className="tool-row">
        <span className="field-label">Baixar quando há voz (ducking)</span>
        <div className="chip-row">
          {([[0.5, '−6 dB'], [0.25, '−12 dB'], [0.125, '−18 dB']] as const).map(([v, l]) => (
            <button key={l} className="chip" disabled={!!busy} onClick={() => run('duck', () => duckMusic(ctx, [clip.id], v))} title={`Usa este clip como música: baixa ${l} quando há voz nos outros clips`}>{l}</button>
          ))}
        </div>
        <p className="hint">Para a música: baixa sozinha quando alguém fala noutro clip e volta a subir nas pausas (cria pontos de volume).</p>
      </div>
    </section>
  );
};

export const PlaceholderSection: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { state, commit, notify, mediaBase } = useEditor();
  const ph = clip.placeholder!;
  return (
    <section className="section ph-box">
      <p className="ph-title">▢ {ph.label}</p>
      <p className="hint">Espaço do modelo: arrasta para aqui {ph.accept === 'image' || ph.field ? 'uma foto' : ph.accept === 'video' ? 'um vídeo' : 'um vídeo ou uma foto'} da biblioteca (para o clip na timeline ou para o ecrã), ou escolhe um ficheiro. Fica com a mesma duração, enquadramento e efeitos.</p>
      <button className="btn primary block" onClick={() => { void replaceWithFile({ project: state.project, commit, notify, mediaBase }, clip.id); }}>
        <Icon name="import" size={16} /> Escolher {ph.accept === 'image' || ph.field ? 'foto' : ph.accept === 'video' ? 'vídeo' : 'vídeo ou foto'}…
      </button>
    </section>
  );
};

// ---------- máscara ----------

export const MaskSection: React.FC<{ clip: Clip; media: MediaItem }> = ({ clip, media }) => {
  const { commit } = useEditor();
  const m = clip.mask;
  const aspect = (media.width && media.height) ? media.width / media.height : 16 / 9;
  const set = (patch: Partial<ClipMask>) => (p: Project) => setMask(p, clip.id, { ...m!, ...patch });
  const pct = (v: number) => `${Math.round(v)}%`;
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">Máscara</h3>
        {m && <button className="btn tiny" onClick={() => commit((p) => setMask(p, clip.id, undefined))}>Tirar</button>}
      </div>
      <div className="mask-shapes">
        <button className={`mask-shape${!m ? ' on' : ''}`} onClick={() => commit((p) => setMask(p, clip.id, undefined))} title="Sem máscara">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" className="ms-off" /></svg><span>Nenhuma</span>
        </button>
        {MASK_SHAPES.map((sh) => (
          <button key={sh.value} className={`mask-shape${m?.shape === sh.value ? ' on' : ''}`} title={sh.label}
            onClick={() => commit((p) => setMask(p, clip.id, m ? { ...defaultMask(sh.value as MaskShape, aspect), x: m.x, y: m.y, feather: m.feather, invert: m.invert } : defaultMask(sh.value as MaskShape, aspect)))}>
            <MaskIcon shape={sh.value as MaskShape} /><span>{sh.label}</span>
          </button>
        ))}
      </div>
      {m ? (
        <>
          <Row label="Posição horizontal" hint={pct(m.x)}><Range min={-20} max={120} step={0.5} value={m.x} apply={(v) => set({ x: v })} /></Row>
          <Row label="Posição vertical" hint={pct(m.y)}><Range min={-20} max={120} step={0.5} value={m.y} apply={(v) => set({ y: v })} /></Row>
          {m.shape !== 'linear' && m.shape !== 'band' && <Row label="Largura" hint={pct(m.w)}><Range min={2} max={200} step={0.5} value={m.w} apply={(v) => set({ w: v })} /></Row>}
          {m.shape !== 'linear' && <Row label={m.shape === 'band' ? 'Espessura' : 'Altura'} hint={pct(m.h)}><Range min={2} max={200} step={0.5} value={m.h} apply={(v) => set({ h: v })} /></Row>}
          <Row label="Rotação" hint={`${Math.round(m.rotation)}°`}><Range min={-180} max={180} step={1} value={m.rotation} apply={(v) => set({ rotation: v })} /></Row>
          <Row label="Suavidade da borda" hint={pct(m.feather)}><Range min={0} max={100} step={1} value={m.feather} apply={(v) => set({ feather: v })} /></Row>
          {m.shape === 'rect' && <Row label="Cantos redondos" hint={pct(m.round)}><Range min={0} max={100} step={1} value={m.round} apply={(v) => set({ round: v })} /></Row>}
          <label className="check"><input type="checkbox" checked={m.invert} onChange={(e) => commit(set({ invert: e.target.checked }))} /> Inverter (esconde o que está dentro da forma)</label>
          <p className="hint">A máscara acompanha o clip (posição, escala, rotação e keyframes). Por baixo vê-se o que estiver na pista de baixo.</p>
        </>
      ) : <p className="hint">Mostra só uma parte do clip: um círculo para uma câmara redonda, uma faixa, um coração… Escolhe uma forma.</p>}
    </section>
  );
};

const MaskIcon: React.FC<{ shape: MaskShape }> = ({ shape }) => {
  const c = 'ms-on';
  const body = {
    rect: <rect x="5" y="6" width="14" height="12" rx="2.5" className={c} />,
    circle: <circle cx="12" cy="12" r="7" className={c} />,
    linear: <><rect x="3" y="12" width="18" height="7" className={c} /><path d="M3 12h18" className="ms-line" /></>,
    band: <rect x="3" y="9" width="18" height="6" className={c} />,
    heart: <path d="M12 19.5C7 16 4 13 4 9.6 4 7.4 5.7 5.8 7.8 5.8c1.7 0 3 .9 4.2 2.4 1.2-1.5 2.5-2.4 4.2-2.4 2.1 0 3.8 1.6 3.8 3.8 0 3.4-3 6.4-8 9.9z" className={c} />,
    star: <path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" className={c} />,
  }[shape];
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect x="2" y="3" width="20" height="18" rx="2" className="ms-frame" />{body}</svg>;
};

/** Inverter (andar para trás) / pôr a direito */
export const ReverseButton: React.FC<{ clip: Clip }> = ({ clip }) => {
  const { state, commit, notify, mediaBase } = useEditor();
  const [busy, setBusy] = React.useState(false);
  const back = canUnreverse(clip);
  return (
    <button className="btn block" disabled={busy} title={back ? 'Volta a pôr o clip a andar para a frente' : 'O clip passa a andar para trás (cria uma cópia invertida do excerto)'}
      onClick={async () => { setBusy(true); try { await reverseClip({ project: state.project, commit, notify, mediaBase }, clip.id); } finally { setBusy(false); } }}>
      <Icon name="reverse" size={16} /> {busy ? 'A inverter…' : back ? 'Pôr a direito' : 'Inverter (andar para trás)'}
    </button>
  );
};
