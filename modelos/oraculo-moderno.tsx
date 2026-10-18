import { Img } from 'remotion';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'oraculo-moderno',
  name: 'Oráculo moderno',
  category: 'Oráculos',
  description: 'Cápsula com foto (ou iniciais), nome e função',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', default: 'Nome da pessoa' },
    { key: 'funcao', label: 'Função / legenda', type: 'text', default: 'Função ou cargo' },
    { key: 'foto', label: 'Foto (vazio = iniciais)', type: 'image', default: '' },
    { key: 'posicao', label: 'Posição', type: 'select', default: 'esq', options: [{ value: 'esq', label: 'Em baixo à esquerda' }, { value: 'centro', label: 'Em baixo ao centro' }, { value: 'dir', label: 'Em baixo à direita' }] },
    { key: 'caixa', label: 'Cor da cápsula', type: 'color', default: '#ffffff' },
    { key: 'texto', label: 'Cor do texto', type: 'color', default: '#17191e' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  themeRoles: { caixa: 'bg', texto: 'text' },
  component: ({ p }) => {
    const { prog, outro, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const pill = prog(0, 20), av = prog(4, 18), t1 = prog(10, 16), t2 = prog(15, 16), o = outro(10, 'expressive-exit');
    const D = 110 * s;
    const initials = String(p.nome).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const pos = p.posicao as string;
    const just = pos === 'centro' ? 'center' : pos === 'dir' ? 'flex-end' : 'flex-start';
    return (
      <div style={{ ...fill, display: 'flex', alignItems: 'flex-end', justifyContent: just, padding: `0 ${80 * s}px ${110 * s}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 * s, padding: `${14 * s}px ${48 * s}px ${14 * s}px ${14 * s}px`, borderRadius: D, background: p.caixa, boxShadow: `0 ${14 * s}px ${40 * s}px rgba(0,0,0,0.3)`, opacity: o, transform: `translateY(${(1 - pill) * 60 * s}px) scale(${0.9 + 0.1 * pill})`, transformOrigin: 'left center', clipPath: `inset(0 ${(1 - pill) * 70}% 0 0 round ${D}px)` }}>
          <div style={{ flex: 'none', width: D, height: D, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: p.destaque, display: 'grid', placeItems: 'center', transform: `scale(${av})` }}>
            {p.foto
              ? <Img src={p.foto} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 44 * s, color: p.caixa }}>{initials}</span>}
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 48 * s, color: p.texto, opacity: t1, transform: `translateX(${(1 - t1) * 20 * s}px)` }}>{p.nome}</div>
            <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 30 * s, color: p.texto, opacity: 0.65 * t2, marginTop: 2 * s }}>{p.funcao}</div>
          </div>
        </div>
      </div>
    );
  },
});
