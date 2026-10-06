import { defineTemplate, useTemplate, fill } from '../shared/template-api';
import { FONT_FAMILY } from '../shared/fonts';

// Inspirado em "countdown-timer" (reactvideoeditor/remotion-templates, MIT) — sem ressalto (IBM)
export default defineTemplate({
  id: 'contagem',
  name: 'Contagem decrescente',
  category: 'Contagens',
  description: 'Conta de N até 1 e mostra uma palavra final',
  durationSec: 5,
  opaque: true,
  fields: [
    { key: 'de', label: 'Começar em', type: 'number', default: 5, min: 1, max: 10 },
    { key: 'final', label: 'Texto final', type: 'text', default: 'Já!' },
    { key: 'cor', label: 'Cor dos números', type: 'color', default: '#ffffff' },
    { key: 'destaque', label: 'Cor do anel', type: 'color', default: '#f2b33d' },
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#17191e' },
  ],
  component: ({ p }) => {
    const { frame, duration, k, height } = useTemplate();
    const n = Math.max(1, Math.round(p.de));
    const per = Math.max(6, Math.floor(duration / (n + 1)));
    const idx = Math.min(n, Math.floor(frame / per));
    const local = frame - idx * per;
    const t = Math.min(1, local / per);
    const label = idx < n ? String(n - idx) : p.final;
    const appear = Math.min(1, local / 6);
    const size = height * 0.42;
    const R = size / 2, C = 2 * Math.PI * R;
    return (
      <div style={{ ...fill, background: p.fundo, display: 'grid', placeItems: 'center' }}>
        <svg width={size + 20 * k} height={size + 20 * k} style={{ position: 'absolute' }}>
          <circle cx="50%" cy="50%" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6 * k} />
          {idx < n && (
            <circle cx="50%" cy="50%" r={R} fill="none" stroke={p.destaque} strokeWidth={6 * k} strokeDasharray={C} strokeDashoffset={C * t} strokeLinecap="round" transform={`rotate(-90 ${(size + 20 * k) / 2} ${(size + 20 * k) / 2})`} />
          )}
        </svg>
        <div style={{ fontFamily: FONT_FAMILY.sans, fontWeight: 700, fontSize: idx < n ? 260 * k : 160 * k, color: idx < n ? p.cor : p.destaque, opacity: appear, transform: `scale(${0.9 + 0.1 * appear})` }}>
          {label}
        </div>
      </div>
    );
  },
});
