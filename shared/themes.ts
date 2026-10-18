// Temas visuais para os modelos: cada tema preenche as cores (por papel) e pode trocar a letra.
// Os campos de cor de cada modelo continuam editáveis depois de escolher o tema.
import type { TextFont } from './types';

export type ThemeRole = 'bg' | 'text' | 'accent' | 'secondary' | 'g1' | 'g2' | 'g3';

export interface Theme {
  id: string;
  label: string;
  colors: Record<ThemeRole, string>;
  /** 'auto' = a letra que o modelo já usa */
  font: 'auto' | TextFont;
  /** brilho néon nas letras */
  glow?: boolean;
  /** cor do texto em modelos transparentes sem caixa própria (por cima do vídeo tem de se ler) */
  overlayText: string;
}

export const THEMES: Theme[] = [
  { id: 'escuro', overlayText: '#ffffff', label: 'Escuro', font: 'auto', colors: { bg: '#17191e', text: '#ffffff', accent: '#f2b33d', secondary: '#4f6fa3', g1: '#1b2a4a', g2: '#4a2a5e', g3: '#c9822b' } },
  { id: 'claro', overlayText: '#ffffff', label: 'Claro', font: 'auto', colors: { bg: '#f7f5f0', text: '#17191e', accent: '#0f62fe', secondary: '#8ea4c8', g1: '#dfe8f8', g2: '#f6e1ec', g3: '#fff1c9' } },
  { id: 'vivo', overlayText: '#ffffff', label: 'Vivo', font: 'auto', colors: { bg: '#5b2bd6', text: '#ffffff', accent: '#ffd23f', secondary: '#ff5c8a', g1: '#ff5c8a', g2: '#5b2bd6', g3: '#ffd23f' } },
  { id: 'elegante', overlayText: '#f3ead7', label: 'Elegante', font: 'serif', colors: { bg: '#0f0e0c', text: '#f3ead7', accent: '#c9a45c', secondary: '#6b5a3a', g1: '#1a1712', g2: '#2a2216', g3: '#8a6d3b' } },
  { id: 'neon', overlayText: '#eafcff', label: 'Néon', font: 'mono', glow: true, colors: { bg: '#07060f', text: '#eafcff', accent: '#ff2bd6', secondary: '#19e3ff', g1: '#07060f', g2: '#2a0a4a', g3: '#0f6c8a' } },
  { id: 'suave', overlayText: '#ffffff', label: 'Suave', font: 'auto', colors: { bg: '#e9efe6', text: '#1f3a2f', accent: '#e07a5f', secondary: '#81b29a', g1: '#e9efe6', g2: '#f2e3d5', g3: '#a9cbb7' } },
];

/** Papel de cada chave de cor habitual nos modelos (cada modelo pode acrescentar/alterar com themeRoles) */
export const DEFAULT_ROLES: Record<string, ThemeRole> = {
  fundo: 'bg', cor: 'text', destaque: 'accent', barra: 'secondary', secundaria: 'secondary',
  cor1: 'text', cor2: 'accent', c1: 'g1', c2: 'g2', c3: 'g3', caixa: 'bg', texto: 'text',
};

export const getTheme = (id: unknown): Theme | undefined => THEMES.find((t) => t.id === id);
export const THEME_KEY = '__tema';
