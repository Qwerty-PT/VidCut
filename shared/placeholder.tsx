// Espaço de um modelo de projeto: quadro com a indicação do que pôr lá (vai também para o export se ficar por preencher).
import React from 'react';

export const PlaceholderBox: React.FC<{ label: string; accept: 'video' | 'image' | 'any'; w: number; h: number }> = ({ label, accept, w, h }) => {
  const k = Math.min(w, h) / 1080;
  const icon = accept === 'image' ? '🖼' : accept === 'video' ? '🎬' : '＋';
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 * k,
      background: 'repeating-linear-gradient(135deg, #2a2d35 0 28px, #24272e 28px 56px)',
      boxShadow: `inset 0 0 0 ${6 * k}px rgba(242,179,61,0.65)`, color: '#f2f3f5', textAlign: 'center',
      fontFamily: 'IBM Plex Sans, Helvetica, Arial, sans-serif',
    }}>
      <div style={{ fontSize: 110 * k, lineHeight: 1, opacity: 0.9 }}>{icon}</div>
      <div style={{ fontSize: 54 * k, fontWeight: 700, maxWidth: '82%' }}>{label}</div>
      <div style={{ fontSize: 32 * k, opacity: 0.7 }}>Arrasta para aqui {accept === 'image' ? 'uma foto' : accept === 'video' ? 'um vídeo' : 'um vídeo ou foto'}</div>
    </div>
  );
};
