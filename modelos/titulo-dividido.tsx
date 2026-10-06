import React from 'react';
import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "title-split" (reactvideoeditor/remotion-templates, MIT) — um eixo de cada vez (IBM)
export default defineTemplate({
  id: 'titulo-dividido',
  name: 'Título em duas linhas',
  category: 'Títulos',
  description: 'Duas linhas entram de lados opostos',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'linha1', label: 'Linha 1', type: 'text', default: 'FELIZ' },
    { key: 'linha2', label: 'Linha 2', type: 'text', default: 'ANIVERSÁRIO' },
    { key: 'cor1', label: 'Cor da linha 1', type: 'color', default: '#ffffff' },
    { key: 'cor2', label: 'Cor da linha 2', type: 'color', default: '#f2b33d' },
    { key: 'tamanho', label: 'Tamanho', type: 'number', default: 150, min: 40, max: 300 },
  ],
  component: ({ p }) => {
    const { k, width, prog, outro } = useTemplate();
    const a = prog(0, 20), b = prog(6, 20);
    const out = outro(10);
    const style = (c: string): React.CSSProperties => ({ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: p.tamanho * k, color: c, lineHeight: 1, whiteSpace: 'nowrap', textShadow: `0 ${4 * k}px ${20 * k}px rgba(0,0,0,0.45)` });
    return (
      <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 * k, opacity: out, overflow: 'hidden' }}>
        <div style={{ ...style(p.cor1), transform: `translateX(${(1 - a) * -width * 0.6}px)`, opacity: a }}>{p.linha1}</div>
        <div style={{ ...style(p.cor2), transform: `translateX(${(1 - b) * width * 0.6}px)`, opacity: b }}>{p.linha2}</div>
      </div>
    );
  },
});
