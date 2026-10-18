// Peças partilhadas pelos modelos de dispositivos (ficheiro começado por _ não é um modelo).
import React from 'react';
import { Img } from 'remotion';
import { fontOf, type FieldDef } from '../shared/template-api';

export const DEVICE_FIELDS: FieldDef[] = [
  { key: 'imagem', label: 'Imagem no ecrã (vazio = transparente, mostra o vídeo de baixo)', type: 'image' as const, default: '' as const },
  { key: 'titulo', label: 'Título ao lado (opcional)', type: 'text' as const, default: 'A tua app' },
  { key: 'texto', label: 'Texto ao lado (opcional)', type: 'textarea' as const, default: 'Simples, rápida e bonita.' },
  { key: 'lado', label: 'Dispositivo', type: 'select' as const, default: 'esquerda', options: [{ value: 'esquerda', label: 'À esquerda' }, { value: 'centro', label: 'Ao centro (sem texto)' }, { value: 'direita', label: 'À direita' }] },
  { key: 'comFundo', label: 'Com fundo', type: 'boolean' as const, default: true },
  { key: 'fundo', label: 'Fundo', type: 'color' as const, default: '#17191e' },
  { key: 'cor', label: 'Cor do texto', type: 'color' as const, default: '#ffffff' },
  { key: 'destaque', label: 'Cor de destaque', type: 'color' as const, default: '#f2b33d' },
  { key: 'moldura', label: 'Cor do dispositivo', type: 'color' as const, default: '#2a2d34' },
];

export const Screen: React.FC<{ src: string; radius: number }> = ({ src, radius }) =>
  src ? <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius }} /> : null;

/** Bloco de texto ao lado do dispositivo */
export const SideText: React.FC<{ p: Record<string, any>; k: number; a: number; b: number; align: 'left' | 'right' }> = ({ p, k, a, b, align }) => (
  <div style={{ width: '38%', textAlign: align, display: 'flex', flexDirection: 'column', gap: 28 * k, alignItems: align === 'left' ? 'flex-start' : 'flex-end' }}>
    <div style={{ width: 90 * k * a, height: 8 * k, background: p.destaque, borderRadius: 4 * k }} />
    <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 700, fontSize: 96 * k, lineHeight: 1.05, color: p.cor, opacity: a, transform: `translateY(${(1 - a) * 40 * k}px)` }}>{p.titulo}</div>
    <div style={{ fontFamily: fontOf(p, 'sans'), fontWeight: 400, fontSize: 44 * k, lineHeight: 1.35, color: p.cor, opacity: 0.85 * b, transform: `translateY(${(1 - b) * 30 * k}px)`, whiteSpace: 'pre-line' }}>{p.texto}</div>
  </div>
);
