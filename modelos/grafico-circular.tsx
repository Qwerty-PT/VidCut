import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'grafico-circular',
  name: 'Gráfico circular',
  category: 'Dados',
  description: 'Anel com fatias a desenhar-se e legenda com percentagens',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'De onde vêm as visitas' },
    { key: 'dados', label: 'Dados (Rótulo: valor, um por linha)', type: 'textarea', default: 'Pesquisa: 45\nRedes sociais: 30\nDireto: 15\nOutros: 10' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor principal', type: 'color', default: '#f2b33d' },
    { key: 'barra', label: 'Cor secundária', type: 'color', default: '#4f6fa3' },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const o = outro(10), t = prog(0, 16);
    const rows = String(p.dados).split('\n').map((l) => { const m = /^(.*?):\s*([\d.,]+)/.exec(l.trim()); return m ? { label: m[1].trim(), v: parseFloat(m[2].replace(',', '.')) } : null; }).filter(Boolean).slice(0, 6) as { label: string; v: number }[];
    const total = rows.reduce((a, r) => a + r.v, 0) || 1;
    const palette = [p.destaque, p.barra, `${p.cor}aa`, `${p.destaque}88`, `${p.barra}88`, `${p.cor}55`];
    const R = 230 * k, sw = 92 * k, C = 2 * Math.PI * R;
    let acc = 0;
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 120 * k }}>
        <svg width={(R + sw) * 2} height={(R + sw) * 2} style={{ transform: 'rotate(-90deg)' }}>
          {rows.map((r, i) => {
            const frac = r.v / total;
            const draw = prog(10 + i * 9, 22, 'expressive-standard');
            const seg = (
              <circle key={i} cx={R + sw} cy={R + sw} r={R} fill="none" stroke={palette[i]} strokeWidth={sw}
                strokeDasharray={`${Math.max(0, frac * C * draw - 4 * k)} ${C}`} strokeDashoffset={-acc * C} />
            );
            acc += frac;
            return seg;
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 * k, minWidth: 560 * k }}>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 64 * k, color: p.cor, opacity: t, marginBottom: 10 * k }}>{p.titulo}</div>
          {rows.map((r, i) => {
            const b = prog(16 + i * 9, 14);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 * k, opacity: b, transform: `translateX(${(1 - b) * 30 * k}px)` }}>
                <span style={{ width: 28 * k, height: 28 * k, borderRadius: 8 * k, background: palette[i] }} />
                <span style={{ flex: 1, fontFamily: fontOf(p, 'sans'), fontSize: 42 * k, color: p.cor }}>{r.label}</span>
                <span style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 42 * k, color: p.cor }}>{Math.round((r.v / total) * 100 * b)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
