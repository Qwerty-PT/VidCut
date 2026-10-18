import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { defineTemplate, useTemplate, fill, fontOf } from '../shared/template-api';

function qrMatrix(text: string): boolean[][] | null {
  try {
    qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s)); // UTF-8 (acentos)
    const q = qrcode(0, 'M');
    q.addData(text || ' ', 'Byte');
    q.make();
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
  } catch { return null; }
}

export default defineTemplate({
  id: 'final-qr',
  name: 'Cartão final com QR',
  category: 'Final',
  description: 'Chamada para ação com código QR gerado a partir do endereço',
  durationSec: 6,
  opaque: true,
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', default: 'Experimenta já' },
    { key: 'texto', label: 'Texto', type: 'textarea', default: 'Aponta a câmara do telemóvel\npara o código.' },
    { key: 'link', label: 'Endereço do QR', type: 'text', default: 'https://exemplo.pt' },
    { key: 'mostrarLink', label: 'Mostrar o endereço por baixo', type: 'boolean', default: true },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
    { key: 'cor', label: 'Cor do texto', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor de destaque', type: 'color', default: '#f2b33d' },
  ],
  component: ({ p }) => {
    const { prog, outro, width, height, frame, fps } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const vertical = height > width;
    const m = useMemo(() => qrMatrix(String(p.link)), [p.link]);
    const o = outro(10), a = prog(0, 18), q = prog(8, 26);
    const n = m ? m.length : 21;
    const Q = (vertical ? 560 : 520) * s, quiet = 2;
    const glow = 0.5 + 0.5 * Math.sin((frame / fps) * 2.5);
    return (
      <div style={{ ...fill, background: p.fundo, opacity: o, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: (vertical ? 80 : 140) * s, padding: 80 * s }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 * s, maxWidth: vertical ? '100%' : '42%', textAlign: vertical ? 'center' : 'left', alignItems: vertical ? 'center' : 'flex-start' }}>
          <div style={{ width: 90 * s * a, height: 8 * s, background: p.destaque, borderRadius: 4 * s }} />
          <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 104 * s, lineHeight: 1.05, color: p.cor, opacity: a, transform: `translateY(${(1 - a) * 30 * s}px)` }}>{p.titulo}</div>
          <div style={{ fontFamily: fontOf(p, 'sans'), fontSize: 44 * s, lineHeight: 1.35, color: p.cor, opacity: 0.85 * prog(10, 18), whiteSpace: 'pre-line' }}>{p.texto}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 * s, opacity: q, transform: `scale(${0.85 + 0.15 * q})` }}>
          <div style={{ padding: 18 * s, borderRadius: 34 * s, background: p.destaque, boxShadow: `0 0 ${(30 + 30 * glow) * s}px ${p.destaque}66` }}>
            <svg width={Q} height={Q} viewBox={`0 0 ${n + quiet * 2} ${n + quiet * 2}`} shapeRendering="crispEdges" style={{ display: 'block', borderRadius: 18 * s, background: '#ffffff' }}>
              {m && m.map((row, r) => row.map((d, c) => {
                if (!d) return null;
                // revelação em diagonal
                const show = (r + c) / (2 * n) < q * 1.15;
                return show ? <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1.02} height={1.02} fill="#111111" /> : null;
              }))}
            </svg>
          </div>
          {p.mostrarLink && <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 600, fontSize: 36 * s, color: p.cor, opacity: 0.9 }}>{String(p.link).replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>}
        </div>
      </div>
    );
  },
});
