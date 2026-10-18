import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'passo-a-passo',
  name: 'Passo-a-passo',
  category: 'Apresentação',
  description: 'Passos numerados que se acendem um a um (um passo por linha)',
  durationSec: 8,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Como funciona' },
    { key: 'passos', label: 'Passos (um por linha)', type: 'textarea', default: 'Escolhe um modelo\nMuda o texto e as cores\nExporta e partilha' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { prog, outro, duration, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const vertical = height > width;
    const steps = String(p.passos).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);
    const n = Math.max(1, steps.length);
    const o = outro(10), t = prog(0, 16);
    const start = 14, span = Math.max(n * 20, duration - start - 30);
    const each = span / n;
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${vertical ? 80 * s : 220 * s}px`, gap: 48 * s }}>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 80 * s, color: p.cor, opacity: t, transform: `translateY(${(1 - t) * 30 * s}px)` }}>{p.titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 * s }}>
          {steps.map((txt, i) => {
            const at = start + i * each;
            const a = prog(at, 16);
            const active = prog(at, 10, 'productive-standard') * (1 - prog(at + each, 10, 'productive-standard'));
            const done = prog(at + each, 10, 'productive-standard');
            const lastHold = i === n - 1 ? prog(at, 10) : 0;
            const on = Math.max(active, lastHold);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 36 * s, opacity: a * (0.45 + 0.55 * Math.max(on, done)), transform: `translateX(${(1 - a) * -40 * s}px)` }}>
                <div style={{ flex: 'none', width: 96 * s, height: 96 * s, borderRadius: 48 * s, display: 'grid', placeItems: 'center', background: on > 0.5 || done > 0.5 ? p.destaque : 'transparent', boxShadow: `inset 0 0 0 ${5 * s}px ${p.destaque}`, fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 46 * s, color: on > 0.5 || done > 0.5 ? p.fundo : p.destaque, transform: `scale(${1 + on * 0.08})` }}>
                  {done > 0.5 && i < n - 1 ? '✓' : i + 1}
                </div>
                <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: on > 0.5 ? 700 : 500, fontSize: 56 * s, color: p.cor, lineHeight: 1.2 }}>{txt}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
