// Estado partilhado: para que clip(s) está aberta a janela "Gerar legendas".
import { useSyncExternalStore } from 'react';

/** ids dos clips de onde se abriu a janela (1 = um clip; vários = seleção) */
let target: string[] | null = null;
const subs = new Set<() => void>();
export const openCaptions = (ids: string | string[]) => { target = Array.isArray(ids) ? ids : [ids]; subs.forEach((f) => f()); };
export const closeCaptions = () => { target = null; subs.forEach((f) => f()); };
export const useCaptionsTarget = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => target);
