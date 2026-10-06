import { random } from 'remotion';
import { defineTemplate, useTemplate, fill } from '../shared/template-api';

// Inspirado em "particle-explosion" e "bokeh-circles" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'confetes',
  name: 'Confetes e brilhos',
  category: 'Fundos',
  description: 'Confetes a cair (transparente: põe por cima do vídeo)',
  durationSec: 8,
  opaque: false,
  fields: [
    { key: 'quantidade', label: 'Quantidade', type: 'number', default: 80, min: 10, max: 300 },
    { key: 'cores', label: 'Cores (separadas por vírgula)', type: 'text', default: '#f2b33d,#ff5c8a,#4fc3f7,#7ed957,#ffffff' },
    { key: 'tipo', label: 'Tipo', type: 'select', default: 'confetes', options: [{ value: 'confetes', label: 'Confetes' }, { value: 'brilhos', label: 'Brilhos (bokeh)' }] },
    { key: 'velocidade', label: 'Velocidade', type: 'number', default: 1, min: 0.2, max: 3, step: 0.1 },
    { key: 'semente', label: 'Variação', type: 'number', default: 1, min: 1, max: 99 },
  ],
  component: ({ p }) => {
    const { frame, fps, k, width, height } = useTemplate();
    const colors = String(p.cores).split(',').map((c) => c.trim()).filter(Boolean);
    const n = Math.round(p.quantidade);
    const t = frame / fps;
    const items = [];
    for (let i = 0; i < n; i++) {
      const r = (s: string) => random(`${p.semente}-${i}-${s}`);
      const color = colors[Math.floor(r('c') * colors.length)] || '#fff';
      if (p.tipo === 'brilhos') {
        const size = (20 + r('s') * 90) * k;
        const x = r('x') * width + Math.sin(t * 0.5 + i) * 30 * k;
        const y = ((r('y') * height - t * 25 * k * p.velocidade * (0.4 + r('v'))) % height + height) % height;
        const o = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 * p.velocidade + i));
        items.push(<div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: color, opacity: o, filter: `blur(${size * 0.15}px)` }} />);
      } else {
        const speed = (120 + r('v') * 180) * k * p.velocidade;
        const y = ((r('y') * (height + 100 * k) + t * speed) % (height + 100 * k)) - 50 * k;
        const x = r('x') * width + Math.sin(t * (1 + r('w') * 2) + i) * 40 * k;
        const w = (10 + r('s') * 10) * k, h = w * (0.4 + r('h') * 0.4);
        const rot = t * 360 * (r('r') - 0.5) * 2 + r('a') * 360;
        const flip = Math.abs(Math.cos(t * (2 + r('f') * 4) + i));
        items.push(<div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: color, transform: `rotate(${rot}deg) scaleY(${0.2 + 0.8 * flip})`, borderRadius: 2 * k }} />);
      }
    }
    return <div style={{ ...fill, overflow: 'hidden' }}>{items}</div>;
  },
});
