import { Img } from 'remotion';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'antes-depois',
  name: 'Antes e depois',
  category: 'Dados',
  description: 'Duas imagens com uma divisória a deslizar para revelar a diferença',
  durationSec: 5,
  opaque: true,
  fields: [
    { key: 'antes', label: 'Imagem "antes"', type: 'image', default: '' },
    { key: 'depois', label: 'Imagem "depois"', type: 'image', default: '' },
    { key: 'rotuloAntes', label: 'Rótulo antes', type: 'text', default: 'Antes' },
    { key: 'rotuloDepois', label: 'Rótulo depois', type: 'text', default: 'Depois' },
    { key: 'fundo', label: 'Fundo (sem imagens)', type: 'color', default: '#2a2d34' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor da divisória', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, sec } = useTemplate();
    const o = outro(10);
    // a divisória vai da direita até ao meio, espreita o "antes" e volta ao meio
    const x = 100 - 50 * prog(sec(0.4), sec(1.1), 'expressive-standard') - 22 * prog(sec(2.0), sec(0.7), 'expressive-standard') + 22 * prog(sec(2.9), sec(0.7), 'expressive-standard');
    const img = (src: string, label: string, tone: string) => src
      ? <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      : <div style={{ position: 'absolute', inset: 0, background: tone, display: 'grid', placeItems: 'center', fontFamily: fontOf(p, 'sans'), fontSize: 46 * k, color: p.cor, opacity: 0.6 }}>{label} (escolhe uma imagem)</div>;
    const tag = (txt: string, side: 'left' | 'right') => (
      <div style={{ position: 'absolute', top: 50 * k, [side]: 50 * k, padding: `${12 * k}px ${26 * k}px`, borderRadius: 999, background: 'rgba(0,0,0,0.55)', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 34 * k, color: '#fff' } as React.CSSProperties}>{txt}</div>
    );
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, overflow: 'hidden' }}>
        <div style={{ ...fill }}>{img(p.depois, p.rotuloDepois, `${p.fundo}`)}{tag(p.rotuloDepois, 'right')}</div>
        <div style={{ ...fill, clipPath: `inset(0 ${100 - x}% 0 0)` }}>{img(p.antes, p.rotuloAntes, '#3a3e48')}{tag(p.rotuloAntes, 'left')}</div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 6 * k, marginLeft: -3 * k, background: p.destaque }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 74 * k, height: 74 * k, margin: `${-37 * k}px 0 0 ${-37 * k}px`, borderRadius: 37 * k, background: p.destaque, display: 'grid', placeItems: 'center', color: '#111214', fontSize: 34 * k, fontWeight: 700, fontFamily: fontOf(p, 'sans') }}>‹›</div>
        </div>
      </div>
    );
  },
});
