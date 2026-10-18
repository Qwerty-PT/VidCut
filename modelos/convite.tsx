import React from 'react';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'convite',
  name: 'Convite',
  category: 'Eventos',
  description: 'Convite elegante: evento, data e local com moldura que se desenha',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'topo', label: 'Frase de abertura', type: 'text', default: 'Estás convidado para' },
    { key: 'evento', label: 'Evento', type: 'text', default: 'A nossa festa' },
    { key: 'data', label: 'Data', type: 'text', default: 'Sábado, 12 de dezembro · 20h00' },
    { key: 'local', label: 'Local', type: 'text', default: 'Rua das Flores, 21' },
    { key: 'nota', label: 'Nota (opcional)', type: 'text', default: 'Confirma até dia 5' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#0f0e0c' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#f3ead7' },
    { key: 'destaque', label: 'Cor da moldura', type: 'color', default: '#c9a45c' },
  ],
  component: ({ p }) => {
    const { prog, outro, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const o = outro(12);
    const frame = prog(0, 40, 'expressive-standard');
    const W = width - 2 * 70 * s, H = height - 2 * 70 * s;
    const per = 2 * (W + H);
    const line = (from: number) => prog(from, 18);
    const T: React.FC<{ at: number; size: number; serif?: boolean; color?: string; weight?: number; spacing?: number; children: React.ReactNode }> = ({ at, size, serif, color, weight = 400, spacing = 0, children }) => {
      const a = line(at);
      return <div style={{ fontFamily: fontOf(p, serif ? 'serif' : 'sans'), fontWeight: weight, fontSize: size * s, letterSpacing: spacing * s, color: color || p.cor, opacity: a, transform: `translateY(${(1 - a) * 24 * s}px)`, lineHeight: 1.15 }}>{children}</div>;
    };
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          <rect x={70 * s} y={70 * s} width={W} height={H} fill="none" stroke={p.destaque} strokeWidth={3 * s} strokeDasharray={per} strokeDashoffset={per * (1 - frame)} />
          <rect x={90 * s} y={90 * s} width={W - 40 * s} height={H - 40 * s} fill="none" stroke={p.destaque} strokeOpacity={0.4} strokeWidth={1.5 * s} strokeDasharray={per} strokeDashoffset={per * (1 - prog(8, 40, 'expressive-standard'))} />
        </svg>
        <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 34 * s, padding: `0 ${160 * s}px` }}>
          <T at={14} size={34} spacing={6}>{String(p.topo).toUpperCase()}</T>
          <T at={22} size={130} serif weight={600} color={p.destaque}>{p.evento}</T>
          <div style={{ width: 220 * s * line(30), height: 2 * s, background: p.destaque, opacity: 0.8 }} />
          <T at={34} size={46}>{p.data}</T>
          <T at={40} size={40}>{p.local}</T>
          {p.nota && <div style={{ marginTop: 24 * s }}><T at={50} size={30} spacing={2} color={p.destaque}>{p.nota}</T></div>}
        </div>
      </div>
    );
  },
});
