import React from 'react';
import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "lower-third" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'oraculo',
  name: 'Oráculo (nome)',
  category: 'Oráculos',
  description: 'Nome e função no terço inferior',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', default: 'Nuno Silva' },
    { key: 'funcao', label: 'Função / legenda', type: 'text', default: 'Realização' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
    { key: 'fundo', label: 'Cor da caixa', type: 'color', default: '#000000' },
    { key: 'lado', label: 'Lado', type: 'select', default: 'esq', options: [{ value: 'esq', label: 'Esquerda' }, { value: 'dir', label: 'Direita' }] },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const bar = prog(0, 14, 'productive-entrance');
    const box = prog(4, 18);
    const txt = prog(12, 14);
    const out = outro(10);
    const right = p.lado === 'dir';
    const dir = right ? 1 : -1;
    return (
      <div style={{ ...fill, opacity: out }}>
        <div style={{ position: 'absolute', bottom: '14%', [right ? 'right' : 'left']: '6%', display: 'flex', flexDirection: right ? 'row-reverse' : 'row' } as React.CSSProperties}>
          <div style={{ width: 8 * k, background: p.destaque, transform: `scaleY(${bar})`, transformOrigin: 'bottom' }} />
          <div style={{ background: `${p.fundo}cc`, padding: `${20 * k}px ${40 * k}px`, clipPath: right ? `inset(0 0 0 ${(1 - box) * 100}%)` : `inset(0 ${(1 - box) * 100}% 0 0)`, textAlign: right ? 'right' : 'left' }}>
            <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: 52 * k, color: '#fff', opacity: txt, transform: `translateX(${(1 - txt) * 20 * k * dir}px)` }}>{p.nome}</div>
            <div style={{ fontFamily: FONT_FAMILY.sans, fontSize: 30 * k, color: 'rgba(255,255,255,0.75)', marginTop: 4 * k, opacity: prog(18, 14) }}>{p.funcao}</div>
          </div>
        </div>
      </div>
    );
  },
});
