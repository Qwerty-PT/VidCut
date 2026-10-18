import { Img } from 'remotion';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'seguir',
  name: 'Segue-me',
  category: 'Redes sociais',
  description: 'Cartão com perfil e botão "Seguir" que é carregado (sem marcas)',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', default: 'O teu nome' },
    { key: 'utilizador', label: '@utilizador', type: 'text', default: '@o.teu.canal' },
    { key: 'foto', label: 'Foto de perfil (opcional)', type: 'image', default: '' },
    { key: 'botao', label: 'Texto do botão', type: 'text', default: 'Seguir' },
    { key: 'depois', label: 'Texto depois de carregar', type: 'text', default: 'A seguir ✓' },
    { key: 'posicao', label: 'Posição', type: 'select', default: 'baixo', options: [{ value: 'baixo', label: 'Em baixo' }, { value: 'centro', label: 'Ao centro' }, { value: 'cima', label: 'Em cima' }] },
    { key: 'fundo', label: 'Cor do cartão', type: 'color', default: '#ffffff' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#111214' },
    { key: 'destaque', label: 'Cor do botão', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, sec } = useTemplate();
    const a = prog(0, 16), o = outro(10);
    const press = sec(1.6);
    const down = prog(press, 4, 'productive-standard') * (1 - prog(press + 4, 6, 'productive-standard'));
    const done = prog(press + 3, 8);
    const cur = prog(press - sec(0.7), sec(0.6), 'productive-standard');
    const pos = p.posicao === 'cima' ? 'flex-start' : p.posicao === 'centro' ? 'center' : 'flex-end';
    const initials = String(p.nome).split(/\s+/).map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
    return (
      <div style={{ ...fill, display: 'flex', alignItems: pos, justifyContent: 'center', padding: `${110 * k}px 0` }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 26 * k, padding: `${22 * k}px ${26 * k}px ${22 * k}px ${22 * k}px`, borderRadius: 999, background: p.fundo, boxShadow: `0 ${18 * k}px ${50 * k}px rgba(0,0,0,0.35)`, opacity: a * o, transform: `translateY(${(1 - a) * 60 * k}px)` }}>
          <div style={{ width: 96 * k, height: 96 * k, borderRadius: 48 * k, overflow: 'hidden', background: p.destaque, display: 'grid', placeItems: 'center', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 40 * k, color: '#111214' }}>
            {p.foto ? <Img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * k, minWidth: 260 * k }}>
            <span style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 40 * k, color: p.cor }}>{p.nome}</span>
            <span style={{ fontFamily: fontOf(p, 'sans'), fontSize: 30 * k, color: p.cor, opacity: 0.6 }}>{p.utilizador}</span>
          </div>
          <div style={{ position: 'relative', padding: `${20 * k}px ${44 * k}px`, borderRadius: 999, background: done > 0.5 ? 'transparent' : p.destaque, boxShadow: done > 0.5 ? `inset 0 0 0 ${3 * k}px ${p.cor}33` : 'none', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 34 * k, color: done > 0.5 ? p.cor : '#111214', transform: `scale(${1 - 0.08 * down})`, minWidth: 200 * k, textAlign: 'center' }}>
            {done > 0.5 ? p.depois : p.botao}
            {/* cursor genérico a carregar no botão */}
            <svg width={44 * k} height={56 * k} viewBox="0 0 26 34" style={{ position: 'absolute', left: `${60 + (1 - cur) * 60}%`, top: `${55 + (1 - cur) * 120}%`, opacity: cur * (1 - prog(press + 18, 10)), filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}>
              <path d="M3 2 L3 26 L9 20.5 L13 30 L17 28.2 L13.2 19 L21.5 19 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    );
  },
});
