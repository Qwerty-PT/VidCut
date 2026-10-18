import { defineTemplate, useTemplate, fill , fontOf } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "chapter-title" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'capitulo',
  name: 'Capítulo',
  category: 'Títulos',
  description: 'Número de capítulo e título, alinhados à esquerda',
  durationSec: 4,
  opaque: true,
  fields: [
    { key: 'numero', label: 'Etiqueta', type: 'text', default: 'Parte 1' },
    { key: 'titulo', label: 'Título', type: 'text', default: 'A chegada' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#101216' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const a = prog(0, 14), b = prog(8, 20), c = prog(4, 18, 'productive-entrance');
    const out = outro(12);
    return (
      <div style={{ ...fill, background: p.fundo, display: 'flex', alignItems: 'center', padding: `0 ${220 * k}px`, opacity: out }}>
        <div style={{ width: 10 * k, alignSelf: 'stretch', margin: `${330 * k}px 0`, background: p.destaque, transform: `scaleY(${c})`, transformOrigin: 'top', marginRight: 48 * k }} />
        <div>
          <div style={{ fontFamily: FONT_FAMILY.mono, fontSize: 40 * k, color: p.destaque, opacity: a, transform: `translateY(${(1 - a) * 12 * k}px)` }}>{p.numero}</div>
          <div style={{ fontFamily: fontOf(p, 'serif'), fontWeight: 600, fontSize: 130 * k, color: p.cor, clipPath: `inset(0 ${(1 - b) * 100}% 0 0)` }}>{p.titulo}</div>
        </div>
      </div>
    );
  },
});
