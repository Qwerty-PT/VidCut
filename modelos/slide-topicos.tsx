import { Img } from 'remotion';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

export default defineTemplate({
  id: 'slide-topicos',
  name: 'Slide com tópicos',
  category: 'Apresentação',
  description: 'Título, tópicos e uma imagem ao lado — como um diapositivo',
  durationSec: 7,
  opaque: true,
  fields: [
    { key: 'etiqueta', label: 'Etiqueta (opcional)', type: 'text', default: 'Capítulo 2' },
    { key: 'titulo', label: 'Título', type: 'text', default: 'O que vais aprender' },
    { key: 'topicos', label: 'Tópicos (um por linha)', type: 'textarea', default: 'Cortar e juntar clips\nAdicionar legendas automáticas\nExportar para redes sociais' },
    { key: 'imagem', label: 'Imagem', type: 'image', default: '' },
    { key: 'lado', label: 'Imagem', type: 'select', default: 'direita', options: [{ value: 'direita', label: 'À direita' }, { value: 'esquerda', label: 'À esquerda' }] },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#f7f5f0' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#17191e' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#0f62fe' },
    { key: 'secundaria', label: 'Cor da imagem vazia', type: 'color', default: '#8ea4c8' },
  ],
  component: ({ p }) => {
    const { prog, outro, width, height } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const vertical = height > width;
    const items = String(p.topicos).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6);
    const o = outro(10), a = prog(0, 16), img = prog(6, 24);
    const pic = (
      <div style={{ flex: vertical ? 'none' : '0 0 42%', height: vertical ? '38%' : '72%', width: vertical ? '100%' : undefined, borderRadius: 28 * s, overflow: 'hidden', position: 'relative', background: p.secundaria, opacity: img, transform: `scale(${0.94 + 0.06 * img})`, clipPath: `inset(${(1 - img) * 12}% round ${28 * s}px)` }}>
        {p.imagem
          ? <Img src={p.imagem} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.08 - 0.08 * img})` }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${p.secundaria}, ${p.destaque})`, opacity: 0.6 }} />}
      </div>
    );
    const text = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 26 * s, minWidth: 0 }}>
        {p.etiqueta && <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 30 * s, letterSpacing: 3 * s, textTransform: 'uppercase', color: p.destaque, opacity: a }}>{p.etiqueta}</div>}
        <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 76 * s, lineHeight: 1.08, color: p.cor, opacity: a, transform: `translateY(${(1 - a) * 30 * s}px)` }}>{p.titulo}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 * s, marginTop: 10 * s }}>
          {items.map((t, i) => {
            const b = prog(14 + i * 8, 16);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 22 * s, opacity: b, transform: `translateX(${(1 - b) * 30 * s}px)` }}>
                <div style={{ flex: 'none', width: 16 * s, height: 16 * s, borderRadius: 4 * s, background: p.destaque, transform: `translateY(${-6 * s}px) rotate(45deg) scale(${b})` }} />
                <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 44 * s, lineHeight: 1.3, color: p.cor }}>{t}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
    const imgFirst = vertical || p.lado === 'esquerda';
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: 80 * s, padding: vertical ? `${120 * s}px ${70 * s}px` : `0 ${140 * s}px` }}>
        {imgFirst ? <>{pic}{text}</> : <>{text}{pic}</>}
      </div>
    );
  },
});
