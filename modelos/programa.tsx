import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'programa',
  name: 'Programa',
  category: 'Eventos',
  description: 'Horário do evento: hora e atividade, uma por linha (HH:MM Atividade)',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Programa' },
    { key: 'subtitulo', label: 'Subtítulo (opcional)', type: 'text', default: 'Sábado, 12 de dezembro' },
    { key: 'itens', label: 'Itens (HH:MM Atividade, um por linha)', type: 'textarea', default: '15:00 Receção\n16:00 Cerimónia\n17:30 Lanche\n19:00 Jantar\n22:00 Música e dança' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor das horas', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { prog, outro, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const vertical = height > width;
    const items = String(p.itens).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => {
      const m = l.match(/^(\d{1,2}[:h.]\d{2}|\d{1,2}h)\s*[-–·]?\s*(.*)$/);
      return m ? { h: m[1], t: m[2] } : { h: '', t: l };
    });
    const o = outro(10), a = prog(0, 16);
    const fs = items.length > 6 ? 40 : 48;
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: `0 ${vertical ? 90 * s : 300 * s}px`, gap: 50 * s }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 30 * s}px)` }}>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 88 * s, color: p.cor }}>{p.titulo}</div>
          {p.subtitulo && <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 40 * s, color: p.destaque, marginTop: 8 * s }}>{p.subtitulo}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((it, i) => {
            const b = prog(12 + i * 6, 16);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 44 * s, padding: `${20 * s}px 0`, borderTop: `${2 * s}px solid ${p.cor}22`, opacity: b, transform: `translateX(${(1 - b) * 40 * s}px)` }}>
                <div style={{ flex: 'none', width: 170 * s, fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: fs * s, color: p.destaque, fontVariantNumeric: 'tabular-nums' }}>{it.h}</div>
                <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: fs * s, color: p.cor }}>{it.t}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
