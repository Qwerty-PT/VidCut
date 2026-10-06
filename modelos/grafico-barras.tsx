import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "chart-animation" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'grafico-barras',
  name: 'Gráfico de barras',
  category: 'Dados',
  description: 'Barras horizontais a crescer, com valores',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Festas por mês' },
    { key: 'dados', label: 'Dados (Rótulo: valor, um por linha)', type: 'textarea', default: 'Janeiro: 12\nFevereiro: 18\nMarço: 25\nAbril: 21' },
    { key: 'sufixo', label: 'Sufixo dos valores', type: 'text', default: '' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'barra', label: 'Cor das barras', type: 'color', default: '#5578ad' },
    { key: 'destaque', label: 'Cor da maior', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const rows = String(p.dados).split('\n').map((l) => {
      const m = /^(.*?)[:;=]\s*(-?[\d.,]+)\s*$/.exec(l.trim());
      return m ? { label: m[1].trim(), v: parseFloat(m[2].replace(',', '.')) } : null;
    }).filter(Boolean) as { label: string; v: number }[];
    const max = Math.max(1, ...rows.map((r) => r.v));
    const out = outro(10);
    return (
      <div style={{ ...fill, background: p.fundo, padding: `${120 * k}px ${180 * k}px`, opacity: out }}>
        <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: 72 * k, color: p.cor, marginBottom: 60 * k, opacity: prog(0, 14) }}>{p.titulo}</div>
        {rows.map((r, i) => {
          const a = prog(12 + i * 5, 24);
          const top = r.v === max;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: `${300 * k}px 1fr`, alignItems: 'center', gap: 24 * k, marginBottom: 26 * k }}>
              <div style={{ fontFamily: FONT_FAMILY.sans, fontSize: 40 * k, color: p.cor, opacity: 0.85, textAlign: 'right' }}>{r.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 * k }}>
                <div style={{ height: 64 * k, width: `${(r.v / max) * 82 * a}%`, background: top ? p.destaque : p.barra, borderRadius: 4 * k }} />
                <div style={{ fontFamily: FONT_FAMILY.mono, fontSize: 36 * k, color: p.cor, opacity: a }}>{(Math.round(r.v * a * 10) / 10).toLocaleString('pt-PT')}{p.sufixo}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
});
