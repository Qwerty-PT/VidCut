import React from 'react';
import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "subscribe-reminder" (reactvideoeditor/remotion-templates, MIT) — botão genérico, sem marcas
export default defineTemplate({
  id: 'subscrever',
  name: 'Lembrete subscrever',
  category: 'Oráculos',
  description: 'Botão "Subscrever" com sino, no canto (transparente)',
  durationSec: 4,
  opaque: false,
  fields: [
    { key: 'texto', label: 'Texto do botão', type: 'text', default: 'Subscrever' },
    { key: 'cor', label: 'Cor do botão', type: 'color', default: '#e5484d' },
    { key: 'canto', label: 'Canto', type: 'select', default: 'bd', options: [{ value: 'bd', label: 'Baixo direita' }, { value: 'be', label: 'Baixo esquerda' }, { value: 'cd', label: 'Cima direita' }] },
  ],
  component: ({ p, }) => {
    const { k, frame, sec, prog, outro } = useTemplate();
    const a = prog(0, 14);
    const pressed = frame >= sec(1.4);
    const press = prog(sec(1.3), 6, 'productive-standard') - prog(sec(1.45), 8, 'productive-standard');
    const bell = pressed ? Math.sin((frame - sec(1.5)) * 0.9) * 18 * Math.max(0, 1 - (frame - sec(1.5)) / 24) : 0;
    const out = outro(10);
    const pos: React.CSSProperties = p.canto === 'be' ? { left: '5%', bottom: '8%' } : p.canto === 'cd' ? { right: '5%', top: '8%' } : { right: '5%', bottom: '8%' };
    return (
      <div style={{ ...fill, opacity: out }}>
        <div style={{ position: 'absolute', ...pos, display: 'flex', alignItems: 'center', gap: 18 * k, opacity: a, transform: `translateY(${(1 - a) * 30 * k}px)` }}>
          <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: 40 * k, color: '#fff', background: pressed ? '#55595f' : p.cor, padding: `${16 * k}px ${36 * k}px`, borderRadius: 10 * k, transform: `scale(${1 - press * 0.08})`, letterSpacing: '0.01em' }}>
            {pressed ? `${p.texto} ✓` : p.texto}
          </div>
          <svg width={58 * k} height={58 * k} viewBox="0 0 24 24" style={{ transform: `rotate(${bell}deg)`, transformOrigin: '50% 10%' }}>
            <path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6z M10 19a2 2 0 0 0 4 0" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  },
});
