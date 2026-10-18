import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'sondagem',
  name: 'Sondagem',
  category: 'Redes sociais',
  description: 'Pergunta com duas respostas e percentagens a encher, estilo stories',
  durationSec: 5,
  opaque: false,
  fields: [
    { key: 'pergunta', label: 'Pergunta', type: 'text', default: 'Qual preferes?' },
    { key: 'opcao1', label: 'Resposta 1', type: 'text', default: 'Café' },
    { key: 'opcao2', label: 'Resposta 2', type: 'text', default: 'Chá' },
    { key: 'pct', label: '% da resposta 1', type: 'number', default: 68, min: 0, max: 100 },
    { key: 'fundo', label: 'Cor do cartão', type: 'color', default: '#ffffff' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#111214' },
    { key: 'destaque', label: 'Cor da vencedora', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, prog, outro, sec } = useTemplate();
    const a = prog(0, 16), o = outro(10);
    const fillP = prog(sec(1.2), sec(1.1), 'expressive-standard');
    const p1 = Math.max(0, Math.min(100, Number(p.pct))), p2 = 100 - p1;
    const opt = (label: string, pct: number, win: boolean, i: number) => {
      const b = prog(8 + i * 5, 14);
      return (
        <div key={i} style={{ position: 'relative', height: 92 * k, borderRadius: 22 * k, overflow: 'hidden', background: `${p.cor}12`, opacity: b, transform: `translateY(${(1 - b) * 24 * k}px)` }}>
          <div style={{ position: 'absolute', inset: 0, width: `${pct * fillP}%`, background: win ? p.destaque : `${p.cor}26` }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${30 * k}px`, fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 38 * k, color: p.cor }}>
            <span>{label}</span><span style={{ opacity: fillP }}>{Math.round(pct * fillP)}%</span>
          </div>
        </div>
      );
    };
    return (
      <div style={{ ...fill, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 760 * k, padding: 40 * k, borderRadius: 40 * k, background: p.fundo, boxShadow: `0 ${24 * k}px ${70 * k}px rgba(0,0,0,0.35)`, display: 'flex', flexDirection: 'column', gap: 22 * k, opacity: a * o, transform: `scale(${0.94 + 0.06 * a})` }}>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 52 * k, color: p.cor, textAlign: 'center', marginBottom: 8 * k }}>{p.pergunta}</div>
          {opt(p.opcao1, p1, p1 >= p2, 0)}
          {opt(p.opcao2, p2, p2 > p1, 1)}
        </div>
      </div>
    );
  },
});
