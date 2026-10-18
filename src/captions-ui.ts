// Estado partilhado: para que clip está aberta a janela "Gerar legendas".
import { useSyncExternalStore } from 'react';

let target: string | null = null;
const subs = new Set<() => void>();
export const openCaptions = (clipId: string) => { target = clipId; subs.forEach((f) => f()); };
export const closeCaptions = () => { target = null; subs.forEach((f) => f()); };
export const useCaptionsTarget = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => target);
