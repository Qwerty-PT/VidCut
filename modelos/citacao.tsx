import { defineTemplate, useTemplate, fill , fontOf } from '../shared/template-api';

// Inspirado em "quote-card" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'citacao',
  name: 'Citação',
  category: 'Títulos',
  description: 'Frase em destaque com autor, palavra a palavra',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'frase', label: 'Frase', type: 'textarea', default: 'A simplicidade é o último grau de sofisticação.' },
    { key: 'autor', label: 'Autor', type: 'text', default: 'Leonardo da Vinci' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#1f2228' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor das aspas', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, frame, prog, outro } = useTemplate();
    const words = String(p.frase).split(/\s+/).filter(Boolean);
    const stagger = 3; // frames entre palavras (ritmo IBM)
    const out = outro(10);
    const doneAt = 10 + words.length * stagger + 12;
    return (
      <div style={{ ...fill, background: p.fundo, display: 'flex', alignItems: 'center', padding: `0 ${200 * k}px`, opacity: out }}>
        <div style={{ position: 'relative', maxWidth: 1300 * k }}>
          <div style={{ position: 'absolute', left: -110 * k, top: -80 * k, fontFamily: fontOf(p, 'serif'), fontSize: 260 * k, color: p.destaque, opacity: prog(0, 14) * 0.9, lineHeight: 1 }}>“</div>
          <div style={{ fontFamily: fontOf(p, 'serif'), fontSize: 70 * k, lineHeight: 1.3, color: p.cor }}>
            {words.map((w, i) => {
              const a = prog(10 + i * stagger, 12);
              return <span key={i} style={{ display: 'inline-block', marginRight: '0.28em', opacity: a, transform: `translateY(${(1 - a) * 18 * k}px)` }}>{w}</span>;
            })}
          </div>
          <div style={{ marginTop: 36 * k, fontFamily: fontOf(p, 'sans'), fontSize: 36 * k, color: p.cor, opacity: frame >= doneAt ? prog(doneAt, 14) * 0.75 : 0 }}>— {p.autor}</div>
        </div>
      </div>
    );
  },
});
