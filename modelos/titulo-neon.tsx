import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

// Acende como um letreiro: alguns "piscares" determinísticos no início e depois fica estável.
const FLICKER = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0.6, 1];

export default defineTemplate({
  id: 'titulo-neon',
  name: 'Letreiro néon',
  category: 'Títulos',
  description: 'Título em néon que se acende, com moldura luminosa',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'ABERTO' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text', default: 'todos os dias' },
    { key: 'moldura', label: 'Moldura', type: 'boolean', default: true },
    { key: 'destaque', label: 'Cor do néon', type: 'color', default: '#ff2bd6' },
    { key: 'cor', label: 'Cor do subtítulo', type: 'color', default: '#19e3ff' },
  ],
  themeRoles: { cor: 'secondary' },
  component: ({ p }) => {
    const { k, frame, outro, prog } = useTemplate();
    const o = outro(10);
    const on = frame < FLICKER.length * 2 ? FLICKER[Math.floor(frame / 2)] : 1;
    const sub = prog(FLICKER.length * 2, 14);
    const glow = (c: string, s = 1) => `0 0 ${6 * k * s}px ${c}, 0 0 ${18 * k * s}px ${c}, 0 0 ${42 * k * s}px ${c}aa, 0 0 ${80 * k * s}px ${c}66`;
    return (
      <div style={{ ...fill, display: 'grid', placeItems: 'center', opacity: o }}>
        <div style={{ position: 'relative', padding: `${50 * k}px ${110 * k}px`, borderRadius: 40 * k, border: p.moldura ? `${6 * k}px solid ${p.destaque}` : 'none', boxShadow: p.moldura ? `${glow(p.destaque, on)}, inset ${glow(p.destaque, on * 0.6)}` : 'none', opacity: 0.25 + 0.75 * on, textAlign: 'center' }}>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 190 * k, letterSpacing: 10 * k, color: '#fff', textShadow: glow(p.destaque, on) }}>{p.titulo}</div>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 56 * k, letterSpacing: 6 * k, color: '#fff', textShadow: glow(p.cor, sub), opacity: sub, marginTop: 8 * k }}>{p.subtitulo}</div>
        </div>
      </div>
    );
  },
});
