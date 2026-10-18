import { defineTemplate, useTemplate, fill , fontOf } from '../shared/template-api';

// Inspirado em "end-card" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'cartao-final',
  name: 'Cartão final',
  category: 'Final',
  description: 'Mensagem final com contacto ou site',
  durationSec: 5,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Mensagem', type: 'text', default: 'Obrigado por veres!' },
    { key: 'contacto', label: 'Contacto / site', type: 'text', default: 'www.exemplo.pt' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor do botão', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog } = useTemplate();
    const a = prog(0, 18), b = prog(12, 16);
    return (
      <div style={{ ...fill, background: p.fundo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56 * k }}>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 110 * k, color: p.cor, opacity: a, transform: `translateY(${(1 - a) * 30 * k}px)`, textAlign: 'center' }}>{p.titulo}</div>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 600, fontSize: 48 * k, color: '#1b1300', background: p.destaque, padding: `${18 * k}px ${48 * k}px`, borderRadius: 999, opacity: b, transform: `scale(${0.92 + 0.08 * b})` }}>{p.contacto}</div>
      </div>
    );
  },
});
