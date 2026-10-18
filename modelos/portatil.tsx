import { defineTemplate, useTemplate, fill, type FieldDef } from '../shared/template-api';
import { DEVICE_FIELDS, Screen, SideText } from './_dispositivo';

export default defineTemplate({
  id: 'portatil',
  name: 'Portátil',
  category: 'Dispositivos',
  description: 'Portátil com uma imagem (ou o vídeo de baixo) no ecrã',
  durationSec: 6,
  opaque: true,
  themeRoles: { moldura: 'secondary' },
  fields: DEVICE_FIELDS.map((f) => (f.key === 'lado' ? { ...f, default: 'centro' } as FieldDef : f)),
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const a = prog(0, 22), t1 = prog(12, 18), t2 = prog(20, 18), o = outro(10);
    const side = p.lado as string;
    const W = (side === 'centro' ? 1250 : 980) * k, Hs = W * 0.625, bez = 22 * k, r = 26 * k;
    const laptop = (
      <div style={{ position: 'relative', width: W * 1.12, opacity: a, transform: `translateY(${(1 - a) * 120 * k}px)` }}>
        <div style={{ position: 'relative', width: W, height: Hs, margin: '0 auto', borderRadius: `${r}px ${r}px ${6 * k}px ${6 * k}px`, background: p.moldura, boxShadow: `0 ${30 * k}px ${80 * k}px rgba(0,0,0,0.4)` }}>
          <div style={{ position: 'absolute', inset: bez, top: bez * 1.2, borderRadius: 6 * k, overflow: 'hidden', background: p.imagem ? '#000' : 'transparent' }}>
            <Screen src={p.imagem} radius={6 * k} />
          </div>
          <div style={{ position: 'absolute', top: bez * 0.45, left: '50%', width: 10 * k, height: 10 * k, marginLeft: -5 * k, borderRadius: 5 * k, background: '#0b0c0e' }} />
        </div>
        <div style={{ height: 30 * k, borderRadius: `0 0 ${30 * k}px ${30 * k}px`, background: `linear-gradient(${p.moldura}, #0e0f12)`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', width: 220 * k, height: 12 * k, marginLeft: -110 * k, borderRadius: `0 0 ${12 * k}px ${12 * k}px`, background: 'rgba(0,0,0,0.35)' }} />
        </div>
      </div>
    );
    return (
      <div style={{ ...fill, background: p.comFundo ? p.fundo : 'transparent', opacity: o, display: 'flex', alignItems: 'center', justifyContent: side === 'centro' ? 'center' : 'space-evenly', flexDirection: side === 'direita' ? 'row-reverse' : 'row' }}>
        {laptop}
        {side !== 'centro' && <SideText p={p} k={k} a={t1} b={t2} align={side === 'direita' ? 'right' : 'left'} />}
      </div>
    );
  },
});
