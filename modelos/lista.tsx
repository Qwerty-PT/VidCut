import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "animated-list" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'lista',
  name: 'Lista de pontos',
  category: 'Listas',
  description: 'Título e itens a entrar um a um',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Agenda' },
    { key: 'itens', label: 'Itens (um por linha)', type: 'textarea', default: 'Introdução\nDemonstração\nPerguntas\nPróximos passos' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
    { key: 'numerar', label: 'Numerar', type: 'boolean', default: true },
  ],
  component: ({ p }) => {
    const { k, prog, outro } = useTemplate();
    const items = String(p.itens).split('\n').map((s) => s.trim()).filter(Boolean);
    const out = outro(10);
    return (
      <div style={{ ...fill, background: p.fundo, padding: `${140 * k}px ${200 * k}px`, opacity: out }}>
        <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: 84 * k, color: p.cor, opacity: prog(0, 14), transform: `translateX(${(1 - prog(0, 14)) * -30 * k}px)` }}>{p.titulo}</div>
        <div style={{ width: 120 * k * prog(6, 14), height: 6 * k, background: p.destaque, margin: `${24 * k}px 0 ${48 * k}px` }} />
        {items.map((it, i) => {
          const a = prog(14 + i * 6, 14);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 * k, marginBottom: 28 * k, opacity: a, transform: `translateX(${(1 - a) * 40 * k}px)` }}>
              <div style={{ width: 56 * k, height: 56 * k, borderRadius: 8 * k, background: p.destaque, color: '#111', display: 'grid', placeItems: 'center', fontFamily: FONT_FAMILY.mono, fontWeight: 700, fontSize: 30 * k }}>
                {p.numerar ? i + 1 : ''}
              </div>
              <div style={{ fontFamily: FONT_FAMILY.sans, fontSize: 52 * k, color: p.cor }}>{it}</div>
            </div>
          );
        })}
      </div>
    );
  },
});
