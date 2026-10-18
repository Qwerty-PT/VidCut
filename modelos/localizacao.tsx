import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'localizacao',
  name: 'Localização',
  category: 'Oráculos',
  description: 'Alfinete de mapa que cai, com o nome do sítio e uma linha extra (data, país…)',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'local', label: 'Local', type: 'text', default: 'Lisboa' },
    { key: 'extra', label: 'Linha extra (opcional)', type: 'text', default: 'Portugal · Outubro' },
    { key: 'posicao', label: 'Posição', type: 'select', default: 'cimaEsq', options: [{ value: 'cimaEsq', label: 'Em cima à esquerda' }, { value: 'baixoEsq', label: 'Em baixo à esquerda' }, { value: 'cimaDir', label: 'Em cima à direita' }, { value: 'baixoDir', label: 'Em baixo à direita' }] },
    { key: 'destaque', label: 'Cor do alfinete', type: 'color', default: '#f2b33d' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
  ],
  component: ({ p }) => {
    const { prog, outro, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const drop = prog(0, 16, 'productive-entrance');
    const bounce = prog(14, 10, 'expressive-standard');
    const ring = prog(14, 22, 'productive-standard');
    const t1 = prog(14, 16), t2 = prog(20, 16), o = outro(10);
    const pos = String(p.posicao);
    const top = pos.startsWith('cima'), right = pos.endsWith('Dir');
    const P = 84 * s;
    const squash = 1 - Math.sin(bounce * Math.PI) * 0.12;
    return (
      <div style={{ ...fill, display: 'flex', alignItems: top ? 'flex-start' : 'flex-end', justifyContent: right ? 'flex-end' : 'flex-start', padding: `${90 * s}px ${90 * s}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 * s, flexDirection: right ? 'row-reverse' : 'row', opacity: o, filter: `drop-shadow(0 ${4 * s}px ${12 * s}px rgba(0,0,0,0.55))` }}>
          <div style={{ position: 'relative', width: P, height: P * 1.3 }}>
            <div style={{ position: 'absolute', left: P / 2 - P * 0.4, bottom: -P * 0.08, width: P * 0.8, height: P * 0.22, borderRadius: '50%', boxShadow: `0 0 0 ${3 * s}px ${p.destaque}`, opacity: (1 - ring) * (ring > 0 ? 1 : 0), transform: `scale(${0.3 + ring * 1.4})` }} />
            <svg width={P} height={P * 1.3} viewBox="0 0 24 31" style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - drop) * -160 * s}px) scaleY(${squash})`, transformOrigin: '50% 100%', opacity: drop }}>
              <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 31 12 31s12-10.2 12-19.1C24 5.3 18.6 0 12 0z" fill={p.destaque} />
              <circle cx="12" cy="11.6" r="4.6" fill="#ffffff" />
            </svg>
          </div>
          <div style={{ textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
            <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 64 * s, lineHeight: 1.05, color: p.cor, opacity: t1, transform: `translateX(${(1 - t1) * (right ? 24 : -24) * s}px)` }}>{p.local}</div>
            {p.extra && <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 32 * s, color: p.cor, opacity: 0.85 * t2, marginTop: 6 * s, letterSpacing: 1 * s }}>{p.extra}</div>}
          </div>
        </div>
      </div>
    );
  },
});
