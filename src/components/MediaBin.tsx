import React, { useEffect, useState } from 'react';
import { useEditor } from '../editor-context';
import { api } from '../api';
import { getThumb, onThumbsChange } from '../media';
import { addAudioAt, addClip, mediaInUse, removeMedia } from '../ops';
import { playhead } from '../playhead';
import { Icon } from './Icon';
import { LottieLibrary } from './LottieLibrary';
import { EffectsLibrary } from './EffectsLibrary';
import { ScreenRecorder } from './ScreenRecorder';
import { useProxies } from '../proxies';
import { TemplateGallery } from './TemplateGallery';
import { StickerLibrary } from './StickerLibrary';
import { SoundLibrary } from './SoundLibrary';
import type { MediaItem } from '../../shared/types';

export const MEDIA_DRAG_TYPE = 'application/x-vidcut-media';
export const TEMPLATE_DRAG_TYPE = 'application/x-vidcut-template';

function fmtDur(sec: number) {
  if (!sec) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const MediaBin: React.FC = () => {
  const { state, commit, importPaths, notify } = useEditor();
  const [, force] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<'media' | 'audio' | 'templates' | 'lottie' | 'effects' | 'stickers'>('media');
  const [recOpen, setRecOpen] = useState(false);
  const px = useProxies();
  useEffect(() => onThumbsChange(() => force((n) => n + 1)), []);

  const pick = async () => {
    const paths = await api().pickMedia();
    if (paths.length) await importPaths(paths);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files).map((f) => api().pathForFile(f)).filter(Boolean);
    if (paths.length) await importPaths(paths);
  };

  const addAtPlayhead = (m: MediaItem) => {
    commit((p) => {
      // som: na agulha, numa pista de áudio livre (não vai parar ao fim da música)
      const r = m.kind === 'audio' ? addAudioAt(p, m.id, playhead.frame) : addClip(p, m.id, { start: playhead.frame });
      return { project: r.project, select: r.clipId ? [r.clipId] : undefined };
    });
  };

  const remove = (m: MediaItem) => {
    if (mediaInUse(state.project, m.id) && !confirm(`"${m.name}" está a ser usado na timeline. Remover também os clips?`)) return;
    commit((p) => removeMedia(p, m.id));
    notify(`Removido: ${m.name}`);
  };

  const media = state.project.media;

  return (
    <aside
      className={`panel media-bin${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <nav className="bin-tabs" role="tablist" aria-label="Biblioteca">
        {([['media', 'Media', 'film'], ['audio', 'Áudio', 'sound'], ['templates', 'Modelos', 'layers'], ['lottie', 'Animações', 'sparkle'], ['effects', 'Efeitos', 'wand'], ['stickers', 'Stickers', 'smile']] as const).map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <Icon name={icon} size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {tab === 'media' && (
        <div className="bin-toolbar">
          <button className="btn small" onClick={pick} title="Importar media (Ctrl+I)"><Icon name="import" size={14} /> Importar</button>
          <button className="btn small rec" onClick={() => setRecOpen(true)} title="Gravar ecrã e câmara"><Icon name="record" size={12} /> Gravar</button>
        </div>
      )}
      {recOpen && <ScreenRecorder onClose={() => setRecOpen(false)} />}
      {tab === 'audio' ? <SoundLibrary /> : tab === 'stickers' ? <StickerLibrary /> : tab === 'effects' ? <EffectsLibrary /> : tab === 'lottie' ? <LottieLibrary /> : tab === 'templates' ? <TemplateGallery /> : media.length === 0 ? (
        <button className="empty-drop" onClick={pick}>
          <Icon name="import" size={28} />
          <strong>Importar media</strong>
          <span>ou arrasta vídeos, áudio e imagens para aqui</span>
        </button>
      ) : (
        <ul className="media-grid">
          {media.map((m) => {
            const thumb = getThumb(m.path);
            const used = mediaInUse(state.project, m.id);
            return (
              <li
                key={m.id}
                className="media-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MEDIA_DRAG_TYPE, m.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => addAtPlayhead(m)}
                title={`${m.path}\nDuplo clique: adicionar na cabeça de leitura`}
              >
                <div className={`media-thumb kind-${m.kind}`}>
                  {thumb ? <img src={thumb} alt="" draggable={false} /> : <Icon name={m.kind === 'video' ? 'film' : m.kind === 'audio' ? 'music' : 'image'} size={26} />}
                  {m.durationSec > 0 && <span className="media-dur">{fmtDur(m.durationSec)}</span>}
                  {used && <span className="media-used" title="Em uso na timeline" />}
                  {m.kind === 'video' && px.enabled && (px.ready[m.path]
                    ? <span className="media-proxy" title="Proxy pronto: a pré-visualização usa a cópia leve">P</span>
                    : px.progress[m.path] !== undefined ? <span className="media-proxy" title="A criar o proxy…">{Math.round((px.progress[m.path] ?? 0) * 100)}%</span> : null)}
                  <button className="media-remove" title="Remover do projeto" onClick={(e) => { e.stopPropagation(); remove(m); }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
                <span className="media-name">{m.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};
