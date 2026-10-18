import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'linha-tempo',
  name: 'Linha do tempo',
  category: 'Dados',
  description: 'Marcos ao longo de uma linha que se desenha (data: texto, um por linha)',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'A nossa história' },
    { key: 'marcos', label: 'Marcos (Data: texto, um por linha)', type: 'textarea', default: '2019: A ideia\n2021: Primeira versão\n2023: 10 000 utilizadores\n2026: Hoje' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, duration } = useTemplate();
    const o = outro(10), t = prog(0, 16);
    const items = String(p.marcos).split('\n').map((l) => { const i = l.indexOf(':'); return i > 0 ? { d: l.slice(0, i).trim(), txt: l.slice(i + 1).trim() } : null; }).filter(Boolean).slice(0, 6) as { d: string; txt: string }[];
    const n = Math.max(1, items.length);
    const span = Math.max(30, duration - 50);
    const line = prog(12, span, 'productive-standard');
    const L = 1560 * k;
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o }}>
        <div style={{ position: 'absolute', top: 140 * k, width: '100%', textAlign: 'center', fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 72 * k, color: p.cor, opacity: t, transform: `translateY(${(1 - t) * 30 * k}px)` }}>{p.titulo}</div>
        <div style={{ position: 'absolute', left: '50%', top: '58%', width: L, marginLeft: -L / 2, height: 6 * k, borderRadius: 3 * k, background: `${p.cor}22` }}>
          <div style={{ width: `${line * 100}%`, height: '100%', borderRadius: 3 * k, background: p.destaque }} />
          {items.map((it, i) => {
            const x = n === 1 ? 0.5 : i / (n - 1);
            const at = 12 + x * span;
            const b = prog(at - 4, 14);
            const up = i % 2 === 0;
            return (
              <div key={i} style={{ position: 'absolute', left: `${x * 100}%`, top: 3 * k, width: 0 }}>
                <div style={{ position: 'absolute', left: -18 * k, top: -18 * k, width: 36 * k, height: 36 * k, borderRadius: 18 * k, background: p.fundo, boxShadow: `inset 0 0 0 ${8 * k}px ${p.destaque}`, transform: `scale(${b})` }} />
                <div style={{ position: 'absolute', left: -170 * k, width: 340 * k, textAlign: 'center', [up ? 'bottom' : 'top']: 50 * k, opacity: b, transform: `translateY(${(1 - b) * (up ? 24 : -24) * k}px)` } as React.CSSProperties}>
                  <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 52 * k, color: p.destaque }}>{it.d}</div>
                  <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 36 * k, color: p.cor, lineHeight: 1.25, marginTop: 6 * k }}>{it.txt}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
