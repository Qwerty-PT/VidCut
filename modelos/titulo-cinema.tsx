import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "cinematic-title-intro" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'titulo-cinema',
  name: 'Título cinema',
  category: 'Títulos',
  description: 'Barras de cinema, título revelado e subtítulo',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'O Grande Dia' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text', default: 'Um filme de família' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
    { key: 'barras', label: 'Barras de cinema', type: 'boolean', default: true },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const bars = prog(0, 18, 'productive-entrance');
    const reveal = prog(8, 22);
    const line = prog(20, 16);
    const sub = prog(26, 16);
    const out = outro(12);
    const barH = 120 * k * bars;
    return (
      <div style={{ ...fill, opacity: out }}>
        {p.barras && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: barH, background: '#000' }} />}
        {p.barras && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barH, background: '#000' }} />}
        <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 * k }}>
          <div style={{ fontFamily: FONT_FAMILY.serif, fontWeight: 700, fontSize: 130 * k, color: p.cor, letterSpacing: `${0.04 * (1 - reveal)}em`, clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`, textShadow: `0 ${4 * k}px ${24 * k}px rgba(0,0,0,0.5)` }}>
            {p.titulo}
          </div>
          <div style={{ width: 360 * k * line, height: 3 * k, background: p.destaque }} />
          <div style={{ fontFamily: FONT_FAMILY.sans, fontSize: 40 * k, color: p.cor, opacity: sub * 0.85, transform: `translateY(${(1 - sub) * 16 * k}px)` }}>
            {p.subtitulo}
          </div>
        </div>
      </div>
    );
  },
});
