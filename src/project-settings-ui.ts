import { useSyncExternalStore } from 'react';
let open = false;
const subs = new Set<() => void>();
export const openProjectSettings = () => { open = true; subs.forEach((f) => f()); };
export const closeProjectSettings = () => { open = false; subs.forEach((f) => f()); };
export const useProjectSettingsOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => open);
