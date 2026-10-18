// Fontes próprias: importadas de ficheiro ou escolhidas entre as do sistema.
// Ficam embutidas no projeto (base64) — o export e outro computador têm sempre a fonte certa.
import type { Project, TextContent } from './types';
import { FONT_FAMILY } from './fonts';

export type FontFormat = 'truetype' | 'opentype' | 'woff' | 'woff2';

export interface FontAsset {
  id: string;
  /** Nome a mostrar (ex.: "Montserrat Bold") */
  name: string;
  format: FontFormat;
  /** Ficheiro da fonte em base64 */
  data: string;
}

/** Limite por fonte (as de ícones/CJK gigantes deixam o projeto pesado demais) */
export const FONT_MAX_BYTES = 8 * 1024 * 1024;

const PREFIX = 'font:';
export const isUserFont = (f: string): boolean => f.startsWith(PREFIX);
export const userFontId = (f: string): string => f.slice(PREFIX.length);
export const userFontKey = (id: string): `font:${string}` => `font:${id}`;
/** Nome CSS interno da fonte embutida */
export const userFontFamily = (id: string): string => `vc-${id}`;

/** font-family CSS para o valor guardado no texto (Plex embutida ou fonte do projeto) */
export function fontFamilyCss(font: TextContent['font']): string {
  if (isUserFont(font)) return `"${userFontFamily(userFontId(font))}", 'IBM Plex Sans', sans-serif`;
  return FONT_FAMILY[font as keyof typeof FONT_FAMILY] ?? FONT_FAMILY.sans;
}

export function formatFromName(name: string): FontFormat {
  const ext = name.toLowerCase().split('.').pop();
  return ext === 'otf' ? 'opentype' : ext === 'woff' ? 'woff' : ext === 'woff2' ? 'woff2' : 'truetype';
}

const MIME: Record<FontFormat, string> = { truetype: 'font/ttf', opentype: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
export const fontDataUrl = (f: FontAsset): string => `data:${MIME[f.format]};base64,${f.data}`;

/** CSS @font-face de todas as fontes do projeto */
export function fontFaceCss(fonts: Record<string, FontAsset> | undefined): string {
  if (!fonts) return '';
  return Object.values(fonts)
    .map((f) => `@font-face{font-family:"${userFontFamily(f.id)}";src:url(${fontDataUrl(f)}) format("${f.format}");font-display:block;}`)
    .join('\n');
}

/** Fontes usadas por algum texto do projeto */
function usedFontIds(p: Project): Set<string> {
  const ids = new Set<string>();
  for (const t of p.tracks) for (const c of t.clips) if (c.text && isUserFont(c.text.font)) ids.add(userFontId(c.text.font));
  return ids;
}

/** Ao guardar: tira do projeto as fontes que já nenhum texto usa */
export function pruneFonts(p: Project): Project {
  if (!p.fonts) return p;
  const used = usedFontIds(p);
  const keep = Object.fromEntries(Object.entries(p.fonts).filter(([id]) => used.has(id)));
  if (Object.keys(keep).length === Object.keys(p.fonts).length) return p;
  return { ...p, fonts: Object.keys(keep).length ? keep : undefined };
}

/** Acrescenta uma fonte ao projeto (reaproveita se já existir uma igual) */
export function addFont(p: Project, f: Omit<FontAsset, 'id'>): { project: Project; id: string } {
  const same = Object.values(p.fonts ?? {}).find((x) => x.data.length === f.data.length && x.name === f.name);
  if (same) return { project: p, id: same.id };
  let h = 0;
  for (let i = 0; i < f.data.length; i += 97) h = (h * 31 + f.data.charCodeAt(i)) | 0;
  const id = `${(h >>> 0).toString(36)}${f.data.length.toString(36)}`;
  return { project: { ...p, fonts: { ...(p.fonts ?? {}), [id]: { ...f, id } } }, id };
}
