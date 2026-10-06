import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "stat-counter" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'contador',
  name: 'Contador de número',
  category: 'Dados',
  description: 'Número a subir até ao valor final, com legenda',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'valor', label: 'Valor final', type: 'number', default: 1250, min: 0, max: 10000000 },
    { key: 'prefixo', label: 'Prefixo', type: 'text', default: '' },
    { key: 'sufixo', label: 'Sufixo', type: 'text', default: '+' },
    { key: 'legenda', label: 'Legenda', type: 'text', default: 'crianças felizes' },
    { key: 'cor', label: 'Cor', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor do número', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, sec } = useTemplate();
    const t = prog(0, sec(1.8), 'expressive-standard');
    const n = Math.round(p.valor * t);
    const out = outro(10);
    const fmt = n.toLocaleString('pt-PT');
    return (
      <div style={{ ...fill, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: out }}>
        <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: 220 * k, color: p.destaque, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {p.prefixo}{fmt}{p.sufixo}
        </div>
        <div style={{ fontFamily: FONT_FAMILY.sans, fontSize: 52 * k, color: p.cor, marginTop: 20 * k, opacity: prog(sec(0.6), 14), transform: `translateY(${(1 - prog(sec(0.6), 14)) * 16 * k}px)` }}>{p.legenda}</div>
      </div>
    );
  },
});
