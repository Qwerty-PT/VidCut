// Fontes dos textos — embutidas (funcionam sem internet, na pré-visualização e no export).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/600.css';
import '@fontsource/ibm-plex-serif/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import type { TextFont } from './types';

export const FONT_FAMILY: Record<TextFont, string> = {
  sans: "'IBM Plex Sans', sans-serif",
  serif: "'IBM Plex Serif', serif",
  mono: "'IBM Plex Mono', monospace",
};

export const FONT_LABEL: Record<TextFont, string> = { sans: 'Plex Sans', serif: 'Plex Serif', mono: 'Plex Mono' };

/** Promessa que resolve quando todas as fontes estão carregadas */
export function loadAllFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads: Promise<unknown>[] = [];
  for (const fam of ['IBM Plex Sans', 'IBM Plex Serif', 'IBM Plex Mono']) for (const w of [400, 600, 700]) loads.push(document.fonts.load(`${w} 40px "${fam}"`));
  return Promise.all(loads).catch(() => undefined);
}
