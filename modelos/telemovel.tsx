import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { DEVICE_FIELDS, Screen, SideText } from './_dispositivo';

export default defineTemplate({
  id: 'telemovel',
  name: 'Telemóvel',
  category: 'Dispositivos',
  description: 'Telemóvel com uma imagem (ou o vídeo de baixo) no ecrã, e texto ao lado',
  durationSec: 6,
  opaque: true,
  themeRoles: { moldura: 'secondary' },
  fields: DEVICE_FIELDS,
  component: ({ p }) => {
    const { k, prog, outro, frame, fps } = useTemplate();
    const a = prog(0, 22), t1 = prog(10, 18), t2 = prog(18, 18), o = outro(10);
    const float = Math.sin((frame / fps) * 1.4) * 8 * k * a; // flutuar suave (um só eixo)
    const H = 860 * k, W = H * 0.49, r = 64 * k, bez = 18 * k;
    const side = p.lado as string;
    const phone = (
      <div style={{ position: 'relative', width: W, height: H, transform: `translateY(${(1 - a) * 140 * k + float}px)`, opacity: a }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: r, background: p.moldura, boxShadow: `0 ${40 * k}px ${90 * k}px rgba(0,0,0,0.45)` }} />
        <div style={{ position: 'absolute', inset: bez, borderRadius: r - bez, overflow: 'hidden', background: p.imagem ? '#000' : 'transparent' }}>
          <Screen src={p.imagem} radius={r - bez} />
        </div>
        {!p.imagem && <div style={{ position: 'absolute', inset: bez, borderRadius: r - bez, boxShadow: `inset 0 0 0 ${3 * k}px rgba(255,255,255,0.08)` }} />}
        <div style={{ position: 'absolute', top: bez + 14 * k, left: '50%', width: 110 * k, height: 30 * k, marginLeft: -55 * k, borderRadius: 20 * k, background: '#000' }} />
      </div>
    );
    return (
      <div style={{ ...fill, background: p.comFundo ? p.fundo : 'transparent', opacity: o, display: 'flex', alignItems: 'center', justifyContent: side === 'centro' ? 'center' : 'space-evenly', flexDirection: side === 'direita' ? 'row-reverse' : 'row' }}>
        {phone}
        {side !== 'centro' && <SideText p={p} k={k} a={t1} b={t2} align={side === 'direita' ? 'right' : 'left'} />}
      </div>
    );
  },
});
