import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip, TextContent } from './types';
import { animState, blockStyle, staggerProgress } from './anim';
import { FONT_FAMILY } from './fonts';

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

  const shadow = text.shadow ? `0 ${2 * k}px ${8 * k}px rgba(0,0,0,0.6)` : undefined;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${text.x}%`,
          top: `${text.y}%`,
          transform: 'translate(-50%, -50%)',
          maxWidth: (width * text.maxWidth) / 100,
          width: 'max-content',
        }}
      >
        <div
          style={{
            opacity: block.opacity,
            ...block.style,
            fontFamily: FONT_FAMILY[text.font],
            fontWeight: text.weight,
            fontSize,
            lineHeight: 1.2,
            color: text.color,
            textAlign: text.align,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            textShadow: shadow,
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
