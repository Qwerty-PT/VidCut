import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

/** "2026-12-24 20:00" ou "24/12/2026 20:00" → Date (hora local) */
function parseDate(v: string): Date | null {
  const t = String(v || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  return null;
}

export default defineTemplate({
  id: 'contagem-data',
  name: 'Contagem até uma data',
  category: 'Eventos',
  description: 'Dias, horas, minutos e segundos até ao evento (os segundos andam com o vídeo)',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Faltam' },
    { key: 'evento', label: 'Evento', type: 'text', default: 'para o lançamento' },
    { key: 'data', label: 'Data do evento (AAAA-MM-DD HH:MM ou DD/MM/AAAA)', type: 'text', default: '2026-12-31 23:59' },
    { key: 'hoje', label: 'Contar a partir de (vazio = agora)', type: 'text', default: '' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { prog, outro, frame, fps, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const vertical = height > width;
    const target = parseDate(p.data);
    const from = parseDate(p.hoje);
    // "agora" arredondado à hora: o render usa vários processos e assim todos contam a partir do mesmo instante
    const base = from ? from.getTime() : Math.floor(Date.now() / 3600000) * 3600000;
    const left = target ? Math.max(0, Math.floor((target.getTime() - base) / 1000) - Math.floor(frame / fps)) : 0;
    const units = [
      { v: Math.floor(left / 86400), l: 'dias' },
      { v: Math.floor(left / 3600) % 24, l: 'horas' },
      { v: Math.floor(left / 60) % 60, l: 'min' },
      { v: left % 60, l: 'seg' },
    ];
    const o = outro(10), t = prog(0, 16);
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 50 * s }}>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 64 * s, color: p.cor, letterSpacing: 4 * s, textTransform: 'uppercase', opacity: t }}>{p.titulo}</div>
        <div style={{ display: 'grid', gridTemplateColumns: vertical ? 'repeat(2, auto)' : 'repeat(4, auto)', gap: 30 * s }}>
          {units.map((u, i) => {
            const a = prog(6 + i * 5, 18);
            return (
              <div key={u.l} style={{ width: 230 * s, padding: `${30 * s}px 0 ${24 * s}px`, borderRadius: 26 * s, background: `${p.cor}14`, boxShadow: `inset 0 0 0 ${2 * s}px ${p.cor}1f`, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 50 * s}px)` }}>
                <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 120 * s, lineHeight: 1, color: i === 3 ? p.destaque : p.cor, fontVariantNumeric: 'tabular-nums' }}>{String(u.v).padStart(2, '0')}</div>
                <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 32 * s, color: p.cor, opacity: 0.7, marginTop: 10 * s }}>{u.l}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 48 * s, color: p.destaque, opacity: prog(24, 16) }}>{target ? p.evento : 'Data inválida — usa AAAA-MM-DD HH:MM'}</div>
      </div>
    );
  },
});
