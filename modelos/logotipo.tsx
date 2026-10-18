import React from 'react';
import { Img } from 'remotion';
import { defineTemplate, useTemplate, fill , fontOf } from '../shared/template-api';

// Inspirado em "logo-blur-reveal", "logo-scale-rotate" e "logo-fade-reveal" (reactvideoeditor/remotion-templates, MIT)
export default defineTemplate({
  id: 'logotipo',
  name: 'Revelação de logótipo',
  category: 'Logótipo',
  description: 'Logótipo (imagem do projeto) com nome por baixo',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'imagem', label: 'Logótipo (imagem do projeto)', type: 'image', default: '' },
    { key: 'nome', label: 'Nome por baixo', type: 'text', default: 'O teu nome' },
    { key: 'estilo', label: 'Entrada', type: 'select', default: 'desfoque', options: [{ value: 'desfoque', label: 'Desfoque' }, { value: 'escala', label: 'Escala' }, { value: 'subir', label: 'Subir' }] },
    { key: 'tamanho', label: 'Tamanho (% da altura)', type: 'number', default: 35, min: 10, max: 80 },
    { key: 'cor', label: 'Cor do nome', type: 'color', default: '#ffffff' },
    { key: 'fundo', label: 'Fundo sólido', type: 'boolean', default: false },
    { key: 'corFundo', label: 'Cor do fundo', type: 'color', default: '#17191e' },
  ],
  component: ({ p }) => {
    const { k, height, prog, outro } = useTemplate();
    const a = prog(0, 24);
    const name = prog(16, 16);
    const out = outro(12);
    const size = (height * p.tamanho) / 100;
    const style: React.CSSProperties =
      p.estilo === 'desfoque' ? { filter: `blur(${(1 - a) * 24 * k}px)`, opacity: a, transform: `scale(${1.08 - 0.08 * a})` }
      : p.estilo === 'escala' ? { opacity: a, transform: `scale(${0.7 + 0.3 * a})` }
      : { opacity: a, transform: `translateY(${(1 - a) * 60 * k}px)` };
    return (
      <div style={{ ...fill, background: p.fundo ? p.corFundo : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 * k, opacity: out }}>
        <div style={{ width: size, height: size, display: 'grid', placeItems: 'center', ...style }}>
          {p.imagem
            ? <Img src={p.imagem} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: `${4 * k}px dashed rgba(255,255,255,0.5)`, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)', fontFamily: fontOf(p, 'sans'), fontSize: 28 * k, textAlign: 'center', padding: 20 * k }}>Escolhe uma imagem no painel</div>}
        </div>
        {p.nome && <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 600, fontSize: 56 * k, color: p.cor, opacity: name, transform: `translateY(${(1 - name) * 14 * k}px)`, letterSpacing: '0.02em' }}>{p.nome}</div>}
      </div>
    );
  },
});
