import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'notificacao',
  name: 'Notificação',
  category: 'Redes sociais',
  description: 'Notificação a descer do topo, como no telemóvel (sem marcas)',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'app', label: 'Nome da app', type: 'text', default: 'Mensagens' },
    { key: 'titulo', label: 'Título', type: 'text', default: 'Nova mensagem' },
    { key: 'texto', label: 'Texto', type: 'text', default: 'O teu vídeo já tem 1000 visualizações! 🎉' },
    { key: 'hora', label: 'Hora', type: 'text', default: 'agora' },
    { key: 'fundo', label: 'Cor do cartão', type: 'color', default: '#f4f4f6' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#111214' },
    { key: 'destaque', label: 'Cor do ícone', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const a = prog(0, 18), o = outro(12, 'expressive-exit');
    const y = (1 - a) * -260 * k + (1 - o) * -260 * k;
    return (
      <div style={{ ...fill, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60 * k }}>
        <div style={{ width: 900 * k, display: 'flex', gap: 24 * k, padding: 28 * k, borderRadius: 40 * k, background: `${p.fundo}f2`, boxShadow: `0 ${20 * k}px ${60 * k}px rgba(0,0,0,0.35)`, transform: `translateY(${y}px)` }}>
          <div style={{ width: 86 * k, height: 86 * k, flex: 'none', borderRadius: 22 * k, background: p.destaque, display: 'grid', placeItems: 'center', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 44 * k, color: '#111214' }}>{String(p.app)[0] ?? '•'}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 * k, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontOf(p, 'sans'), fontSize: 26 * k, color: p.cor, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 * k }}>
              <span>{p.app}</span><span style={{ textTransform: 'none' }}>{p.hora}</span>
            </div>
            <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 36 * k, color: p.cor }}>{p.titulo}</div>
            <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 33 * k, color: p.cor, opacity: 0.85, lineHeight: 1.3 }}>{p.texto}</div>
          </div>
        </div>
      </div>
    );
  },
});
