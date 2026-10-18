import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'pergunta-resposta',
  name: 'Pergunta e resposta',
  category: 'Apresentação',
  description: 'Uma pergunta grande e, a meio, a resposta revelada',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'pergunta', label: 'Pergunta', type: 'textarea', default: 'Quanto tempo leva a editar um vídeo?' },
    { key: 'resposta', label: 'Resposta', type: 'textarea', default: 'Menos de 10 minutos.' },
    { key: 'revelar', label: 'Revelar a resposta aos (s)', type: 'number', default: 3, min: 0.5, max: 20, step: 0.5 },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor da resposta', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { prog, outro, sec, width, height, frame, fps } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const at = sec(Number(p.revelar) || 3);
    const q = prog(0, 18), r = prog(at, 22), o = outro(10);
    const dots = frame < at ? '.'.repeat(1 + Math.floor((frame / fps) * 3) % 3) : '';
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: `0 ${110 * s}px`, gap: 60 * s }}>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 132 * s, lineHeight: 1, color: p.destaque, opacity: q * (1 - r * 0.6), transform: `scale(${0.6 + 0.4 * q})` }}>?</div>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: (84 - 22 * r) * s, lineHeight: 1.15, color: p.cor, opacity: q * (1 - 0.35 * r), transform: `translateY(${(1 - q) * 40 * s}px)`, whiteSpace: 'pre-line' }}>{p.pergunta}</div>
        <div style={{ minHeight: 120 * s, display: 'grid', placeItems: 'center' }}>
          {r > 0
            ? <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 96 * s, lineHeight: 1.1, color: p.destaque, opacity: r, transform: `translateY(${(1 - r) * 50 * s}px) scale(${0.9 + 0.1 * r})`, whiteSpace: 'pre-line' }}>{p.resposta}</div>
            : <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 80 * s, color: p.cor, opacity: 0.5 * q, letterSpacing: 10 * s, width: 160 * s, textAlign: 'left' }}>{dots}</div>}
        </div>
      </div>
    );
  },
});
