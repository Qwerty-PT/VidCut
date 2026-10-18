import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'conversa',
  name: 'Conversa',
  category: 'Redes sociais',
  description: 'Mensagens a aparecer como numa app de conversa. Linhas começadas por ">" são tuas (à direita)',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'mensagens', label: 'Mensagens (uma por linha; ">" no início = tua)', type: 'textarea', default: 'Já viste o vídeo novo?\n> Ainda não! Está bom?\nEstá incrível 🔥\n> Vou ver já!' },
    { key: 'titulo', label: 'Nome no topo', type: 'text', default: 'Ana' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor das tuas mensagens', type: 'color', default: '#f2b33d' },
    { key: 'secundaria', label: 'Cor das mensagens recebidas', type: 'color', default: '#2c3039' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, sec, duration } = useTemplate();
    const o = outro(10);
    const lines = String(p.mensagens).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8);
    const step = Math.max(sec(0.5), Math.min(sec(1.1), Math.floor((duration - sec(1.5)) / Math.max(1, lines.length))));
    const head = prog(0, 14);
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 980 * k, height: 120 * k, display: 'flex', alignItems: 'center', gap: 22 * k, opacity: head, borderBottom: `${2 * k}px solid ${p.cor}1a`, marginTop: 40 * k }}>
          <div style={{ width: 64 * k, height: 64 * k, borderRadius: 32 * k, background: p.secundaria, display: 'grid', placeItems: 'center', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 30 * k, color: p.cor }}>{String(p.titulo)[0] ?? '?'}</div>
          <span style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 40 * k, color: p.cor }}>{p.titulo}</span>
        </div>
        <div style={{ width: 980 * k, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 22 * k, padding: `${30 * k}px 0 ${70 * k}px` }}>
          {lines.map((ln, i) => {
            const mine = ln.startsWith('>');
            const text = mine ? ln.slice(1).trim() : ln;
            const t0 = sec(0.4) + i * step;
            const typing = prog(t0 - sec(0.45), sec(0.2)) * (1 - prog(t0, 3));
            const b = prog(t0, 12);
            return (
              <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', maxHeight: b > 0 || typing > 0 ? 400 * k : 0 }}>
                {typing > 0.05 && b === 0 && !mine ? (
                  <div style={{ padding: `${26 * k}px ${32 * k}px`, borderRadius: 34 * k, background: p.secundaria, opacity: typing, display: 'flex', gap: 10 * k }}>
                    {[0, 1, 2].map((d) => <span key={d} style={{ width: 14 * k, height: 14 * k, borderRadius: 7 * k, background: p.cor, opacity: 0.6 }} />)}
                  </div>
                ) : (
                  <div style={{ maxWidth: '72%', padding: `${22 * k}px ${32 * k}px`, borderRadius: 34 * k, borderBottomRightRadius: mine ? 8 * k : 34 * k, borderBottomLeftRadius: mine ? 34 * k : 8 * k, background: mine ? p.destaque : p.secundaria, color: mine ? '#111214' : p.cor, fontFamily: fontOf(p, 'sans'), fontSize: 40 * k, lineHeight: 1.3, opacity: b, transform: `translateY(${(1 - b) * 30 * k}px) scale(${0.96 + 0.04 * b})`, transformOrigin: mine ? 'right bottom' : 'left bottom' }}>{text}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
