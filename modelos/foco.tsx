import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'foco',
  name: 'Foco (spotlight)',
  category: 'Apresentação',
  description: 'Escurece o vídeo à volta de um círculo e põe uma etiqueta — ótimo para gravações de ecrã',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'x', label: 'Posição horizontal (%)', type: 'number', default: 60, min: 0, max: 100 },
    { key: 'y', label: 'Posição vertical (%)', type: 'number', default: 45, min: 0, max: 100 },
    { key: 'raio', label: 'Tamanho do círculo (%)', type: 'number', default: 14, min: 3, max: 50 },
    { key: 'escurecer', label: 'Escurecer (%)', type: 'number', default: 65, min: 10, max: 95 },
    { key: 'etiqueta', label: 'Etiqueta (opcional)', type: 'text', default: 'Clica aqui' },
    { key: 'destaque', label: 'Cor do anel', type: 'color', default: '#f2b33d' },
    { key: 'caixa', label: 'Cor da etiqueta', type: 'color', default: '#17191e' },
    { key: 'texto', label: 'Texto da etiqueta', type: 'color', default: '#ffffff' },
  ],
  themeRoles: { caixa: 'bg', texto: 'text' },
  component: ({ p }) => {
    const { prog, outro, width, height, frame, fps } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const a = prog(0, 18), o = outro(10);
    const cx = (Number(p.x) / 100) * width, cy = (Number(p.y) / 100) * height;
    const R = (Number(p.raio) / 100) * Math.min(width, height) * (1.6 - 0.6 * a);
    const pulse = 1 + Math.sin((frame / fps) * 4) * 0.03 * a;
    const dark = (Number(p.escurecer) / 100) * a * o;
    const below = cy + R + 140 * s < height;
    return (
      <div style={{ ...fill }}>
        <div style={{ ...fill, background: `radial-gradient(circle at ${cx}px ${cy}px, transparent ${R}px, rgba(0,0,0,${dark}) ${R + 2 * s}px)` }} />
        <div style={{ position: 'absolute', left: cx - R * pulse, top: cy - R * pulse, width: 2 * R * pulse, height: 2 * R * pulse, borderRadius: '50%', boxShadow: `0 0 0 ${6 * s}px ${p.destaque}`, opacity: a * o }} />
        {p.etiqueta && (
          <div style={{ position: 'absolute', left: cx, top: below ? cy + R + 36 * s : cy - R - 36 * s, transform: `translate(-50%, ${below ? 0 : -100}%) translateY(${(1 - prog(8, 16)) * (below ? 20 : -20) * s}px)`, opacity: prog(8, 16) * o, whiteSpace: 'nowrap', background: p.caixa, color: p.texto, padding: `${16 * s}px ${30 * s}px`, borderRadius: 18 * s, fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 40 * s, boxShadow: `0 ${10 * s}px ${30 * s}px rgba(0,0,0,0.35)` }}>
            {p.etiqueta}
          </div>
        )}
      </div>
    );
  },
});
