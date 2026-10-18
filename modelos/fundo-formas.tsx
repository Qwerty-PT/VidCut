import React from 'react';
import { defineTemplate, useTemplate, fill } from '../shared/template-api';

const rand = (i: number, n: number) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };

export default defineTemplate({
  id: 'fundo-formas',
  name: 'Formas a flutuar',
  category: 'Fundos',
  description: 'Círculos, anéis e quadrados que flutuam devagar — fundo para texto por cima',
  durationSec: 10,
  opaque: true,
  fields: [
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'c1', label: 'Cor 1', type: 'color', default: '#f2b33d' },
    { key: 'c2', label: 'Cor 2', type: 'color', default: '#4f6fa3' },
    { key: 'c3', label: 'Cor 3', type: 'color', default: '#c9822b' },
    { key: 'quantidade', label: 'Quantidade', type: 'number', default: 14, min: 4, max: 40 },
    { key: 'desfoque', label: 'Desfocado', type: 'boolean', default: false },
  ],
  themeRoles: { c1: 'accent', c2: 'secondary', c3: 'g3' },
  component: ({ p }) => {
    const { frame, fps, width, height, prog } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const t = frame / fps;
    const n = Math.round(Number(p.quantidade) || 14);
    const cols = [p.c1, p.c2, p.c3];
    const fade = prog(0, 20, 'productive-entrance');
    return (
      <div style={{ ...fill, background: p.fundo, overflow: 'hidden' }}>
        {Array.from({ length: n }, (_, i) => {
          const kind = Math.floor(rand(i, 1) * 3);
          const size = (40 + rand(i, 2) * 180) * s;
          const sp = 0.15 + rand(i, 3) * 0.35;
          const x = rand(i, 4) * width + Math.sin(t * sp + i) * 60 * s;
          const y = rand(i, 5) * height + Math.cos(t * sp * 0.8 + i * 2) * 50 * s;
          const rot = t * (rand(i, 6) - 0.5) * 30;
          const c = cols[i % 3];
          const op = (0.25 + rand(i, 7) * 0.5) * fade;
          const st: React.CSSProperties = { position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: op, transform: `rotate(${rot}deg)`, filter: p.desfoque ? `blur(${size * 0.12}px)` : undefined };
          if (kind === 0) return <div key={i} style={{ ...st, borderRadius: '50%', background: c }} />;
          if (kind === 1) return <div key={i} style={{ ...st, borderRadius: '50%', boxShadow: `inset 0 0 0 ${Math.max(4, size * 0.09)}px ${c}` }} />;
          return <div key={i} style={{ ...st, borderRadius: size * 0.18, background: c }} />;
        })}
      </div>
    );
  },
});
