import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "credits-roll" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'creditos',
  name: 'Créditos finais',
  category: 'Final',
  description: 'Texto a subir de baixo para cima. "Função: Nome" em cada linha; linha vazia separa blocos',
  durationSec: 10,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Obrigado!' },
    { key: 'texto', label: 'Créditos (Função: Nome)', type: 'textarea', default: 'Realização: Nuno\nMúsica: Nome da banda\n\nUm agradecimento especial: a todos os convidados' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#000000' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor das funções', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { k, frame, duration, height } = useTemplate();
    const lines = String(p.texto).split('\n');
    const lineH = 70 * k;
    const total = 220 * k + lines.length * lineH;
    // rola a velocidade constante: começa abaixo do quadro e termina acima
    const y = height - (frame / Math.max(1, duration - 1)) * (height + total);
    return (
      <div style={{ ...fill, background: p.fundo, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: FONT_FAMILY.sans }}>
          <div style={{ fontWeight: 700, fontSize: 110 * k, color: p.cor, marginBottom: 90 * k }}>{p.titulo}</div>
          {lines.map((l, i) => {
            const [role, ...rest] = l.split(':');
            const name = rest.join(':').trim();
            return (
              <div key={i} style={{ height: lineH, fontSize: 42 * k, color: p.cor }}>
                {name ? (<><span style={{ color: p.destaque, marginRight: 18 * k }}>{role.trim()}</span>{name}</>) : l}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
});
