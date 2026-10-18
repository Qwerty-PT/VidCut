/// <reference types="vite/client" />
// Animações Lottie disponíveis: pack incluído (pasta lotties/) + biblioteca do utilizador.
import { useSyncExternalStore } from 'react';
import type { LottieAsset } from '../shared/types';
import type { LottieLibItem } from './api';

export interface LottieEntry extends LottieAsset { category: string; user?: boolean; thumb?: number }

const files = import.meta.glob('../lotties/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const index = (files['../lotties/index.json'] ?? []) as { id: string; name: string; category: string; file: string; thumb?: number }[];

export const PACK: LottieEntry[] = index
  .map((it) => ({ id: `pack-${it.id}`, name: it.name, category: it.category, thumb: it.thumb, data: files[`../lotties/${it.file}`] as Record<string, unknown> }))
  .filter((e) => !!e.data);

export const PACK_CATEGORIES = [...new Set(PACK.map((e) => e.category))];

// ---------- biblioteca do utilizador (store externo simples) ----------
let user: LottieEntry[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const toEntry = (x: LottieLibItem): LottieEntry => ({ id: x.id, name: x.name, data: x.data, category: 'As minhas', user: true });

export async function loadUserLotties(force = false): Promise<void> {
  if ((loaded && !force) || !window.vidcut) return;
  loaded = true;
  user = (await window.vidcut.lottieList()).map(toEntry);
  emit();
}
export function addUserLotties(items: LottieLibItem[]) {
  const ids = new Set(items.map((i) => i.id));
  user = [...user.filter((u) => !ids.has(u.id)), ...items.map(toEntry)];
  emit();
}
export function removeUserLottie(id: string) { user = user.filter((u) => u.id !== id); emit(); }

export function useUserLotties(): LottieEntry[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => user);
}

/** Procura uma animação pelo id (pack ou biblioteca do utilizador) */
export function getLottieEntry(id: string): LottieEntry | undefined {
  return PACK.find((e) => e.id === id) ?? user.find((e) => e.id === id);
}

/** Atalhos para encontrar mais animações */
export const LOTTIE_SOURCES = [
  { name: 'LottieFiles', url: 'https://lottiefiles.com/free-animations', hint: 'o maior catálogo, muitas grátis' },
  { name: 'Lordicon', url: 'https://lordicon.com/icons', hint: 'ícones animados (grátis com atribuição)' },
  { name: 'IconScout', url: 'https://iconscout.com/lottie-animations', hint: 'grátis e pagas' },
  { name: 'useAnimations', url: 'https://useanimations.com', hint: 'pequenos ícones de interface' },
];
