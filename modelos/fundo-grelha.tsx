import { defineTemplate, useTemplate, fill } from '../shared/template-api';

export default defineTemplate({
  id: 'fundo-grelha',
  name: 'Grelha em movimento',
  category: 'Fundos',
  description: 'Chão de grelha em perspetiva a avançar, com brilho no horizonte (estilo retro)',
  durationSec: 10,
  opaque: true,
  fields: [
    { key: 'fundo', label: 'Fundo', type: 'color', default: '#07060f' },
    { key: 'destaque', label: 'Cor das linhas', type: 'color', default: '#ff2bd6' },
    { key: 'secundaria', label: 'Cor do horizonte', type: 'color', default: '#19e3ff' },
    { key: 'velocidade', label: 'Velocidade', type: 'number', default: 1, min: 0.2, max: 4, step: 0.1 },
    { key: 'sol', label: 'Sol no horizonte', type: 'boolean', default: true },
  ],
  component: ({ p }) => {
    const { frame, fps, width, height, prog } = useTemplate();
    const s = Math.min(width, height) / 1080;
    const a = prog(0, 24, 'productive-entrance');
    const hz = height * 0.55;
    const cell = 120 * s;
    const off = ((frame / fps) * Number(p.velocidade) * cell) % cell;
    const sun = 360 * s;
    return (
      <div style={{ ...fill, background: `linear-gradient(${p.fundo} 0%, ${p.fundo} 40%, ${p.secundaria}33 ${(hz / height) * 100}%, ${p.fundo} ${(hz / height) * 100 + 0.1}%)`, overflow: 'hidden', opacity: a }}>
        {p.sol && (
          <div style={{ position: 'absolute', left: width / 2 - sun / 2, top: hz - sun * 0.72, width: sun, height: sun, borderRadius: '50%', background: `linear-gradient(${p.destaque}, ${p.secundaria})`, opacity: 0.9, WebkitMaskImage: `repeating-linear-gradient(to bottom, #000 0, #000 ${sun * 0.06}px, transparent ${sun * 0.06}px, transparent ${sun * 0.08}px)`, clipPath: `inset(0 0 ${sun * 0.28}px 0)` }} />
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: hz, height: 2 * s, background: p.secundaria, boxShadow: `0 0 ${30 * s}px ${8 * s}px ${p.secundaria}88` }} />
        <div style={{ position: 'absolute', left: '50%', top: hz, width: width * 4, height: height * 1.2, marginLeft: -width * 2, perspective: 400 * s, perspectiveOrigin: '50% 0%', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, transformOrigin: '50% 0%', transform: 'rotateX(72deg)',
            backgroundImage: `linear-gradient(${p.destaque} ${2.5 * s}px, transparent ${2.5 * s}px), linear-gradient(90deg, ${p.destaque} ${2.5 * s}px, transparent ${2.5 * s}px)`,
            backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `0 ${off}px`,
            WebkitMaskImage: 'linear-gradient(transparent 0%, #000 25%)',
            filter: `drop-shadow(0 0 ${6 * s}px ${p.destaque})`,
          }} />
        </div>
      </div>
    );
  },
});
