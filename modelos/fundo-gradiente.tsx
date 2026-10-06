import { defineTemplate, useTemplate, fill } from '../shared/template-api';

// Inspirado em "gradient-shift" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'fundo-gradiente',
  name: 'Fundo gradiente',
  category: 'Fundos',
  description: 'Gradiente suave em movimento lento (põe numa pista por baixo do texto)',
  durationSec: 10,
  opaque: true,
  fields: [
    { key: 'c1', label: 'Cor 1', type: 'color', default: '#3d5a86' },
    { key: 'c2', label: 'Cor 2', type: 'color', default: '#7a3d86' },
    { key: 'c3', label: 'Cor 3', type: 'color', default: '#f2b33d' },
    { key: 'velocidade', label: 'Velocidade', type: 'number', default: 1, min: 0.1, max: 4, step: 0.1 },
  ],
  component: ({ p }) => {
    const { frame, fps } = useTemplate();
    const t = (frame / fps) * p.velocidade;
    const a = 135 + Math.sin(t * 0.6) * 40;
    const x = 50 + Math.sin(t * 0.8) * 30, y = 50 + Math.cos(t * 0.5) * 30;
    return (
      <div style={{ ...fill, background: `radial-gradient(circle at ${x}% ${y}%, ${p.c3}aa 0%, transparent 45%), linear-gradient(${a}deg, ${p.c1}, ${p.c2})` }} />
    );
  },
});
