// Janelas abertas a partir de qualquer sítio (menus, painel, timeline)
import { useSyncExternalStore } from 'react';

export type ModalState = { kind: 'silence'; clipId: string } | { kind: 'templates' } | null;
let cur: ModalState = null;
const subs = new Set<() => void>();
export const openModal = (m: ModalState) => { cur = m; subs.forEach((f) => f()); };
export const closeModal = () => openModal(null);
export const useModal = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur);
