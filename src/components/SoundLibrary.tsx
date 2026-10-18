// Separador "Áudio": músicas e efeitos sonoros incluídos na app (criados para o VidCut, livres de direitos).
import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor-context';
import { api, type LibSound } from '../api';
import { probeMedia } from '../media';
import { addAudioAt, addClip, addMedia, setMediaBeats } from '../ops';
import { playhead } from '../playhead';
import { mediaUrl, type Project } from '../../shared/types';
import { Icon } from './Icon';

export const SOUND_DRAG_TYPE = 'application/x-vidcut-sound';
let dragged: LibSound | null = null;
export const getDraggedSound = () => dragged;

let cache: { musicas: LibSound[]; efeitos: LibSound[] } | null = null;

const fmt = (s: number) => (s < 10 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Põe um som da biblioteca na timeline (copia-o para a pasta de dados e junta-o à media do projeto) */
export async function addLibrarySound(
  ctx: { commit: (fn: (p: Project) => Project | { project: Project; select?: string[] }) => void; notify: (m: string, k?: 'info' | 'error') => void; mediaBase: string },
  sound: LibSound, start: number, trackId?: string,
) {
  const r = await api().soundsUse(sound.file);
  if (!r.path) { ctx.notify(r.error || 'Não foi possível usar este som.', 'error'); return; }
  let item;
  try { item = await probeMedia(r.path, ctx.mediaBase); } catch (e) { ctx.notify(String((e as Error).message || e), 'error'); return; }
  item = { ...item, name: sound.name };
  const path = r.path;
  ctx.commit((p) => {
    let q = addMedia(p, [item]);
    const m = q.media.find((x) => x.path === path)!;
    if (sound.beats?.length && sound.bpm) q = setMediaBeats(q, m.id, sound.bpm, sound.beats);
    const res = trackId ? addClip(q, m.id, { trackId, start }) : addAudioAt(q, m.id, Math.max(0, Math.round(start)));
    return { project: res.project, select: res.clipId ? [res.clipId] : undefined };
  });
  ctx.notify(sound.beats?.length ? `"${sound.name}" adicionada · ${sound.bpm} BPM, com as batidas marcadas.` : `"${sound.name}" adicionado.`);
}

export const SoundLibrary: React.FC = () => {
  const { commit, notify, mediaBase } = useEditor();
  const [data, setData] = useState(cache);
  const [q, setQ] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { if (!data) void api().soundsList().then((d) => { cache = d; setData(d); }); }, [data]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const toggle = (s: LibSound) => {
    if (playing === s.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(mediaUrl(mediaBase, s.preview));
    a.volume = 0.8;
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => notify('Não foi possível tocar o som.', 'error'));
    audio.current = a;
    setProgress(0);
    setPlaying(s.id);
  };
  const add = (s: LibSound) => { void addLibrarySound({ commit, notify, mediaBase }, s, playhead.frame); };

  const nq = norm(q.trim());
  const match = (s: LibSound) => !nq || norm(`${s.name} ${s.tags.join(' ')} ${s.category ?? ''}`).includes(nq);
  const row = (s: LibSound, music: boolean) => (
    <li
      key={s.id} className={`snd-row${playing === s.id ? ' on' : ''}`} draggable
      onDragStart={(e) => { dragged = s; e.dataTransfer.setData(SOUND_DRAG_TYPE, s.id); e.dataTransfer.effectAllowed = 'copy'; }}
      onDoubleClick={() => add(s)}
      title={`${s.name}\nDuplo clique ou arrastar para a timeline: adicionar`}
    >
      <button className="snd-play" onClick={(e) => { e.stopPropagation(); toggle(s); }} aria-label={playing === s.id ? 'Parar' : 'Ouvir'}>
        <Icon name={playing === s.id ? 'pause' : 'play'} size={14} />
      </button>
      <div className="snd-info">
        <span className="snd-name">{s.name}</span>
        <span className="snd-meta">{fmt(s.durationSec)}{music && s.bpm ? ` · ${s.bpm} BPM` : ''} · {s.tags.slice(0, music ? 3 : 2).join(', ')}</span>
        {playing === s.id && <span className="snd-progress" style={{ width: `${progress * 100}%` }} />}
      </div>
      <button className="icon-btn mini snd-add" onClick={(e) => { e.stopPropagation(); add(s); }} title="Adicionar na agulha"><Icon name="plus" size={14} /></button>
    </li>
  );

  if (!data) return <div className="tpl-gallery"><p className="hint">A carregar…</p></div>;
  const musicas = data.musicas.filter(match);
  const efeitos = data.efeitos.filter(match);
  const cats = [...new Set(efeitos.map((e) => e.category ?? 'Outros'))];
  return (
    <div className="tpl-gallery snd-lib">
      <div className="lib-search">
        <Icon name="search" size={14} />
        <input type="search" placeholder="Procurar (ex.: calma, whoosh, aplausos…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar sons" />
      </div>
      {musicas.length > 0 && (
        <section>
          <h3 className="tpl-cat">Música</h3>
          <ul className="snd-list">{musicas.map((s) => row(s, true))}</ul>
          <p className="hint">As músicas já trazem as batidas marcadas: usa “Encaixar clips no ritmo” no menu do clip.</p>
        </section>
      )}
      {cats.map((c) => (
        <section key={c}>
          <h3 className="tpl-cat">Efeitos · {c}</h3>
          <ul className="snd-list">{efeitos.filter((e) => (e.category ?? 'Outros') === c).map((s) => row(s, false))}</ul>
        </section>
      ))}
      {!musicas.length && !efeitos.length && <p className="hint">Nenhum som encontrado.</p>}
      <p className="hint stk-credit">Todas as músicas e efeitos foram criados para o VidCut: podes usá-los à vontade, também em vídeos comerciais.</p>
    </div>
  );
};
