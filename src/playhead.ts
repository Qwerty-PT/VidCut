// Frame atual (cabeça de leitura) como store externa, para não re-renderizar o editor inteiro a cada frame.
import { useSyncExternalStore } from 'react';
import type { PlayerRef } from '@remotion/player';

let frame = 0;
let playing = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export const playhead = {
  player: null as PlayerRef | null,
  get frame() { return frame; },
  get playing() { return playing; },
  setFrame(f: number) { if (f !== frame) { frame = f; emit(); } },
  setPlaying(p: boolean) { if (p !== playing) { playing = p; emit(); } },
  seek(f: number) {
    const v = Math.max(0, Math.round(f));
    frame = v;
    playhead.player?.seekTo(v);
    emit();
  },
  toggle() {
    const p = playhead.player;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play();
  },
  pause() { playhead.player?.pause(); },
  subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb); }; },
};

export const useFrame = () => useSyncExternalStore(playhead.subscribe, () => frame);
export const usePlaying = () => useSyncExternalStore(playhead.subscribe, () => playing);
