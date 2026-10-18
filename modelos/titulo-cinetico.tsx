import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'titulo-cinetico',
  name: 'Tipografia cinética',
  category: 'Títulos',
  description: 'Frases curtas que entram ao ritmo, uma de cada vez, grandes e empilhadas',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'linhas', label: 'Linhas (uma por linha; *palavra* = destaque)', type: 'textarea', default: 'Cria\nvídeos\n*incríveis*\nem minutos' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
    { key: 'alinhamento', label: 'Alinhamento', type: 'select', default: 'esquerda', options: [{ value: 'esquerda', label: 'Esquerda' }, { value: 'centro', label: 'Centro' }] },
  ],
  component: ({ p }) => {
    const { k, prog, outro, duration } = useTemplate();
    const o = outro(10);
    const lines = String(p.linhas).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6);
    const step = Math.max(5, Math.min(14, Math.floor((duration - 30) / Math.max(1, lines.length))));
    const sizes = [170, 150, 210, 130, 160, 140];
    return (
      <div style={{ ...fill, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: p.alinhamento === 'centro' ? 'center' : 'flex-start', padding: `0 ${160 * k}px`, opacity: o }}>
        {lines.map((ln, i) => {
          const b = prog(i * step, 10);
          const hi = /^\*.*\*$/.test(ln);
          const txt = hi ? ln.slice(1, -1) : ln;
          return (
            <div key={i} style={{ overflow: 'hidden', lineHeight: 0.98 }}>
              <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: sizes[i % sizes.length] * k, letterSpacing: -2 * k, color: hi ? p.destaque : p.cor, transform: `translateY(${(1 - b) * 105}%)`, textShadow: hi ? 'none' : `0 ${4 * k}px ${18 * k}px rgba(0,0,0,0.35)` }}>{txt}</div>
            </div>
          );
        })}
      </div>
    );
  },
});
