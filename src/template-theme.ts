// Tema escolhido na galeria de modelos (aplicado às miniaturas e ao adicionar).
import { useSyncExternalStore } from 'react';
const KEY = 'vidcut.tplTheme';
let theme = (() => { try { return localStorage.getItem(KEY) || 'escuro'; } catch { return 'escuro'; } })();
const subs = new Set<() => void>();
export const getTemplateTheme = () => theme;
export const setTemplateTheme = (t: string) => { theme = t; try { localStorage.setItem(KEY, t); } catch { /* ignora */ } subs.forEach((f) => f()); };
export const useTemplateTheme = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => theme);
