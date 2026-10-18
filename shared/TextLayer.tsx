import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip, TextContent } from './types';
import { animState, blockStyle, staggerProgress } from './anim';
import { fontFamilyCss } from './userfonts';
import { valuesAt } from './keyframes';
import { activeWord } from './captions';
import { easing } from './motion';

const popEase = easing('expressive-entrance');

function hexToRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const TextLayer: React.FC<{ clip: Clip; text: TextContent }> = ({ clip, text }) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const k = height / 1080; // tamanho relativo a 1080p
  const fontSize = text.size * k;
  const st = animState(clip.animIn, clip.animOut, frame, clip.duration);
  const kv = valuesAt(clip, Math.min(clip.duration - 1, Math.max(0, frame)));
  const preset = st.anim?.preset ?? 'none';
  const dist = fontSize * 0.8;

  // presets de bloco (o texto inteiro)
  const block = st.phase === 'idle' ? { opacity: 1, style: {} } : blockStyle(preset, st.p, dist);

  // presets por parte (máquina de escrever, palavras, linhas)
  let content: React.ReactNode = text.text;
  if (st.phase !== 'idle' && st.anim && preset === 'typewriter') {
    const chars = Array.from(text.text);
    const n = Math.round(chars.length * st.p);
    content = (
      <>
        {chars.slice(0, n).join('')}
        <span style={{ opacity: 0 }}>{chars.slice(n).join('')}</span>
      </>
    );
  } else if (st.phase !== 'idle' && st.anim && (preset === 'words' || preset === 'lines')) {
    const anim = st.anim;
    const phase = st.phase;
    if (preset === 'lines') {
      const lines = text.text.split('\n');
      content = lines.map((ln, i) => {
        const p = staggerProgress(i, lines.length, st.raw, anim, phase);
        return (
          <span key={i} style={{ display: 'block', opacity: p, transform: `translateY(${(1 - p) * dist}px)` }}>
            {ln || ' '}
          </span>
        );
      });
    } else {
      // palavras, mantendo quebras de linha e espaços
      const tokens = text.text.split(/(\s+)/);
      const words = tokens.filter((t) => t.trim()).length;
      let wi = 0;
      content = tokens.map((tok, i) => {
        if (!tok.trim()) return tok;
        const p = staggerProgress(wi++, words, st.raw, anim, phase);
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * dist * 0.6}px)` }}>
            {tok}
          </span>
        );
      });
    }
  }

  // ---------- legendas com tempo por palavra ----------
  const cap = clip.caption;
  if (cap && cap.style !== 'classic' && cap.words.length) {
    const idx = activeWord(cap.words, frame);
    if (cap.style === 'pop') {
      const w = idx >= 0 ? cap.words[idx] : null;
      const p = w ? popEase(Math.min(1, Math.max(0, (frame - w.s) / 4))) : 0;
      content = w ? <span style={{ display: 'inline-block', opacity: p, transform: `scale(${0.72 + 0.28 * p})` }}>{w.t}</span> : null;
    } else {
      content = cap.words.map((w, i) => {
        const sp = i < cap.words.length - 1 ? ' ' : '';
        if (cap.style === 'karaoke') {
          return <span key={i} style={{ color: i <= idx ? cap.highlight : text.color, opacity: i <= idx ? 1 : 0.88 }}>{w.t}{sp}</span>;
        }
        // caixa: a palavra atual ganha uma caixa de cor que aparece depressa (IBM entrada expressiva, ~130 ms)
        const on = i === idx;
        const p = on ? popEase(Math.min(1, Math.max(0, (frame - w.s) / 4))) : 0;
        return (
          <React.Fragment key={i}>
            <span style={{
              display: 'inline-block', position: 'relative', padding: `0 ${0.1 * fontSize}px`, margin: `0 ${-0.04 * fontSize}px`,
              color: on ? '#111214' : text.color, zIndex: on ? 1 : 0,
              textShadow: on ? 'none' : undefined,
            }}>
              {on && <span style={{ position: 'absolute', inset: `${0.02 * fontSize}px 0`, background: cap.highlight, borderRadius: 0.16 * fontSize, transform: `scale(${0.8 + 0.2 * p})`, opacity: p, zIndex: -1 }} />}
              {w.t}
            </span>
            {sp}
          </React.Fragment>
        );
      });
    }
  }

  // sombra e brilho somam-se; o contorno usa paint-order para ficar por fora das letras (não as come)
  const shadows: string[] = [];
  if (text.glow && text.glow.size > 0) {
    const g = text.glow.size * k;
    shadows.push(`0 0 ${g * 0.35}px ${text.glow.color}`, `0 0 ${g}px ${text.glow.color}`, `0 0 ${g * 2}px ${hexToRgba(text.glow.color, 0.6)}`);
  }
  if (text.shadow) shadows.push(`0 ${2 * k}px ${8 * k}px rgba(0,0,0,0.6)`);
  const shadow = shadows.length ? shadows.join(', ') : undefined;
  const sw = text.stroke && text.stroke.width > 0 ? text.stroke.width * k : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${kv.x}%`,
          top: `${kv.y}%`,
          transform: `translate(-50%, -50%) rotate(${kv.rotation}deg) scale(${kv.scale})`,
          opacity: kv.opacity,
          maxWidth: (width * text.maxWidth) / 100,
          width: 'max-content',
        }}
      >
        <div
          style={{
            opacity: block.opacity,
            ...block.style,
            fontFamily: fontFamilyCss(text.font),
            fontWeight: text.weight,
            fontSize,
            lineHeight: 1.2,
            color: text.color,
            textAlign: text.align,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            textShadow: shadow,
            ...(sw ? { WebkitTextStroke: `${sw * 2}px ${text.stroke!.color}`, paintOrder: 'stroke fill' } : {}),
            background: text.background ? hexToRgba(text.background, text.bgOpacity ?? 0.85) : undefined,
            padding: text.background ? `${0.25 * fontSize}px ${0.45 * fontSize}px` : 0,
            borderRadius: text.background ? 0.18 * fontSize : 0,
          }}
        >
          {content}
        </div>
      </div>
    </AbsoluteFill>
  );
};
