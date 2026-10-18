// Proxies: cópias leves dos vídeos (540p) usadas só na pré-visualização; o export usa sempre os originais.
import { useSyncExternalStore } from 'react';
import { api } from './api';
import type { Project } from '../shared/types';

interface ProxyState { enabled: boolean; ready: Record<string, string>; progress: Record<string, number>; errors: Record<string, string> }
const KEY = 'vidcut.proxies';
let st: ProxyState = { enabled: (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })(), ready: {}, progress: {}, errors: {} };
const subs = new Set<() => void>();
const set = (patch: Partial<ProxyState>) => { st = { ...st, ...patch }; subs.forEach((f) => f()); };
export const useProxies = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => st);
export const proxyState = () => st;

let wired = false;
function wire() {
  if (wired || !window.vidcut) return;
  wired = true;
  api().onProxyProgress((e) => {
    if (e.proxy) {
      const { [e.file]: _p, ...progress } = st.progress;
      set({ ready: { ...st.ready, [e.file]: e.proxy }, progress });
    } else if (e.error) {
      const { [e.file]: _p, ...progress } = st.progress;
      set({ progress, errors: e.error === 'cancelado' ? st.errors : { ...st.errors, [e.file]: e.error } });
    } else set({ progress: { ...st.progress, [e.file]: e.p } });
  });
}

const videos = (p: Project) => p.media.filter((m) => m.kind === 'video');

/** Vê que proxies já existem (em cache) para os vídeos do projeto */
export async function refreshProxies(p: Project) {
  wire();
  const files = videos(p).map((m) => m.path).filter((f) => !(f in st.ready));
  if (!files.length) return;
  const r = await api().proxyStatus(files);
  const ready = { ...st.ready };
  for (const [f, px] of Object.entries(r)) if (px) ready[f] = px;
  set({ ready });
}

/** Cria os proxies que faltam (em fila, em segundo plano) */
export async function makeMissingProxies(p: Project) {
  wire();
  await refreshProxies(p);
  const items = videos(p).filter((m) => !st.ready[m.path] && st.progress[m.path] === undefined).map((m) => ({ file: m.path, dur: m.durationSec }));
  if (!items.length) return 0;
  const progress = { ...st.progress };
  for (const it of items) progress[it.file] = 0;
  set({ progress });
  await api().proxyMake(items);
  return items.length;
}

export function setProxiesEnabled(on: boolean, p: Project) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* */ }
  set({ enabled: on });
  if (on) void makeMissingProxies(p);
}

export async function clearProxies(): Promise<number> {
  const r = await api().proxyClear();
  set({ ready: {}, progress: {}, errors: {} });
  return r.bytes;
}

/** O projeto que a pré-visualização mostra: com proxies no lugar dos vídeos que já os têm */
export function withProxies(p: Project, s: ProxyState): Project {
  if (!s.enabled) return p;
  let changed = false;
  const media = p.media.map((m) => {
    const px = m.kind === 'video' ? s.ready[m.path] : undefined;
    if (!px) return m;
    changed = true;
    return { ...m, path: px };
  });
  return changed ? { ...p, media } : p;
}
