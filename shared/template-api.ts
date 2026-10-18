// API dos modelos programáticos do VidCut.
// Cada ficheiro em modelos/*.tsx exporta por defeito `defineTemplate({...})`.
// O painel do VidCut gera os campos automaticamente a partir de `fields`.
import React, { createContext, useContext } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, type CurveName } from './motion';
import { DEFAULT_ROLES, THEME_KEY, getTheme, type ThemeRole } from './themes';
import { FONT_FAMILY } from './fonts';
import type { TextFont } from './types';

export type FieldDef =
  | { key: string; label: string; type: 'text'; default: string }
  | { key: string; label: string; type: 'textarea'; default: string; hint?: string }
  | { key: string; label: string; type: 'color'; default: string }
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; step?: number }
  | { key: string; label: string; type: 'select'; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'boolean'; default: boolean }
  /** Imagem do projeto (o valor guardado é o id da media; o modelo recebe o URL ou '') */
  | { key: string; label: string; type: 'image'; default: '' };

export type TemplateCategory = 'Títulos' | 'Oráculos' | 'Logótipo' | 'Contagens' | 'Dados' | 'Listas' | 'Redes sociais' | 'Dispositivos' | 'Apresentação' | 'Fundos' | 'Final';

export interface TemplateDef {
  id: string;
  name: string;
  category: TemplateCategory;
  description?: string;
  /** Duração por defeito em segundos */
  durationSec: number;
  /** true = tem fundo próprio (ocupa o quadro); false = sobreposição transparente */
  opaque: boolean;
  fields: FieldDef[];
  /** Papéis de tema para chaves de cor fora do habitual (fundo/cor/destaque/…) */
  themeRoles?: Record<string, ThemeRole>;
  component: React.FC<{ p: Record<string, any> }>;
}

export const defineTemplate = (d: TemplateDef): TemplateDef => d;

export function templateDefaults(def: TemplateDef): Record<string, unknown> {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.default]));
}

/** Aplica um tema: preenche as cores do modelo pelos papéis e guarda o tema (para a letra e o brilho) */
export function applyTheme(def: TemplateDef, props: Record<string, unknown>, themeId: string): Record<string, unknown> {
  const th = getTheme(themeId);
  if (!th) return props;
  const roles = { ...DEFAULT_ROLES, ...def.themeRoles };
  const out: Record<string, unknown> = { ...props, [THEME_KEY]: th.id };
  // modelo transparente sem caixa/fundo próprio: o texto fica por cima do vídeo e tem de ser claro
  const overlay = !def.opaque && !def.fields.some((f) => f.type === 'color' && roles[f.key] === 'bg');
  for (const f of def.fields) {
    if (f.type !== 'color') continue;
    const role = roles[f.key];
    if (!role) continue;
    out[f.key] = overlay && role === 'text' ? th.overlayText : th.colors[role];
  }
  return out;
}

/** Os modelos têm temas se tiverem pelo menos uma cor com papel conhecido */
export function supportsThemes(def: TemplateDef): boolean {
  const roles = { ...DEFAULT_ROLES, ...def.themeRoles };
  return def.fields.some((f) => f.type === 'color' && roles[f.key]);
}

/** Letra a usar no modelo: a do tema (se o tema impuser uma) ou a do próprio modelo */
export function fontOf(p: Record<string, unknown>, fallback: TextFont): string {
  const th = getTheme(p[THEME_KEY]);
  return FONT_FAMILY[th && th.font !== 'auto' ? th.font : fallback];
}

/** Duração do clip do modelo (frames), disponível dentro do componente */
export const TemplateDurationContext = createContext<number>(90);

/**
 * Utilitário para modelos: frame atual, duração, tamanho e `k` (escala relativa a 1080p),
 * mais funções de animação com as curvas IBM.
 */
export function useTemplate() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const duration = useContext(TemplateDurationContext);
  const k = height / 1080;
  /** progresso 0..1 entre dois frames, com curva IBM */
  const prog = (from: number, len: number, curve: CurveName = 'expressive-entrance') => {
    const t = Math.min(1, Math.max(0, (frame - from) / Math.max(1, len)));
    return easing(curve)(t);
  };
  /** saída: 1 → 0 nos últimos `len` frames do clip */
  const outro = (len: number, curve: CurveName = 'productive-exit') => 1 - prog(duration - len, len, curve);
  const sec = (s: number) => Math.round(s * fps);
  return { frame, fps, width, height, duration, k, prog, outro, sec };
}

export const fill: React.CSSProperties = { position: 'absolute', inset: 0 };
