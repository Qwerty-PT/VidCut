import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';
import { Img } from 'remotion';

export default defineTemplate({
  id: 'browser',
  name: 'Janela de browser',
  category: 'Dispositivos',
  description: 'Página web numa janela de browser — ótimo para mostrar sites e apps',
  durationSec: 6,
  opaque: true,
  themeRoles: { moldura: 'secondary' },
  fields: [
    { key: 'imagem', label: 'Captura da página (vazio = transparente)', type: 'image', default: '' },
    { key: 'endereco', label: 'Endereço', type: 'text', default: 'www.exemplo.pt' },
    { key: 'deslizar', label: 'Percorrer a página para baixo', type: 'boolean', default: true },
    { key: 'comFundo', label: 'Com fundo', type: 'boolean', default: true },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'moldura', label: 'Cor da janela', type: 'color', default: '#2a2d34' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, duration } = useTemplate();
    const a = prog(0, 22), o = outro(10);
    const scroll = p.deslizar ? prog(30, Math.max(30, duration - 60), 'productive-standard') : 0;
    const W = 1500 * k, H = 860 * k, bar = 64 * k, r = 18 * k;
    return (
      <div style={{ ...fill, background: p.comFundo ? p.fundo : 'transparent', opacity: o, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: W, height: H, borderRadius: r, overflow: 'hidden', background: p.moldura, boxShadow: `0 ${40 * k}px ${100 * k}px rgba(0,0,0,0.45)`, opacity: a, transform: `translateY(${(1 - a) * 100 * k}px)` }}>
          <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 14 * k, padding: `0 ${24 * k}px` }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 18 * k, height: 18 * k, borderRadius: 9 * k, background: c }} />)}
            <div style={{ flex: 1, marginLeft: 30 * k, height: 38 * k, borderRadius: 19 * k, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', padding: `0 ${20 * k}px`, fontFamily: fontOf(p, 'sans'), fontSize: 22 * k, color: p.cor, opacity: 0.8 }}>
              <span style={{ color: p.destaque, marginRight: 10 * k }}>●</span>{p.endereco}
            </div>
          </div>
          <div style={{ position: 'relative', height: H - bar, overflow: 'hidden', background: p.imagem ? '#fff' : 'transparent' }}>
            {p.imagem && (
              // capturas compridas: enche a largura e percorre de cima para baixo
              <Img src={p.imagem} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `50% ${scroll * 100}%` }} />
            )}
          </div>
        </div>
      </div>
    );
  },
});
