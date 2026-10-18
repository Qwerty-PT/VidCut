// "Novo a partir de modelo": projetos prontos com espaços para os teus vídeos e fotos.
import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { useEditor } from '../editor-context';
import { closeModal } from '../modals';
import { PROJECT_TEMPLATES, placeholdersLeft, type ProjectTemplate } from '../project-templates';
import { VidCutComposition } from '../../shared/VidCutComposition';
import { projectDuration, type Project } from '../../shared/types';
import { api } from '../api';
import { probeMedia } from '../media';
import { addMedia, setMediaBeats, audioTrackFor } from '../ops';
import { playhead } from '../playhead';
import { uid } from '../util';
import { Icon } from './Icon';

const Card: React.FC<{ t: ProjectTemplate; onUse: () => void; busy: boolean }> = ({ t, onUse, busy }) => {
  const project = useMemo(() => t.build(), [t]);
  const { mediaBase } = useEditor();
  const [hover, setHover] = useState(false);
  const ref = React.useRef<import('@remotion/player').PlayerRef>(null);
  const dur = projectDuration(project);
  React.useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (hover) { p.seekTo(0); p.play(); } else { p.pause(); p.seekTo(Math.round(dur * 0.06)); }
  }, [hover, dur]);
  const vertical = project.height > project.width;
  return (
    <li className="ptpl-card" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className={`ptpl-thumb${vertical ? ' v' : ''}`}>
        <Player
          ref={ref} component={VidCutComposition} inputProps={{ project, mediaBase }}
          durationInFrames={dur} fps={project.fps} compositionWidth={project.width} compositionHeight={project.height}
          style={{ width: '100%', height: '100%' }} controls={false} loop initiallyMuted acknowledgeRemotionLicense
          initialFrame={Math.round(dur * 0.06)}
        />
      </div>
      <div className="ptpl-info">
        <strong>{t.name}</strong>
        <span className="ptpl-meta">{t.format} · {(dur / project.fps).toFixed(0)} s · {placeholdersLeft(project)} espaços{t.music ? ` · ♪ ${t.music.name}` : ''}</span>
        <p>{t.description}</p>
        <button className="btn primary small" disabled={busy} onClick={onUse}>Usar este modelo</button>
      </div>
    </li>
  );
};

export const ProjectTemplatesModal: React.FC = () => {
  const { state, dispatch, notify, mediaBase } = useEditor();
  const [busy, setBusy] = useState(false);
  const use = async (t: ProjectTemplate) => {
    if (state.savedProject !== state.project && !confirm('Há alterações por guardar no projeto atual. Continuar sem guardar?')) return;
    setBusy(true);
    try {
      let p: Project = t.build();
      if (t.music) {
        const list = await api().soundsList();
        const snd = list.musicas.find((m) => m.file === t.music!.file);
        const r = await api().soundsUse(t.music.file);
        if (r.path && snd) {
          const item = { ...(await probeMedia(r.path, mediaBase)), name: snd.name };
          p = addMedia(p, [item]);
          const m = p.media.find((x) => x.path === r.path)!;
          if (snd.beats && snd.bpm) p = setMediaBeats(p, m.id, snd.bpm, snd.beats);
          const end = projectDuration(p);
          const dur = Math.min(end, Math.floor(m.durationSec * p.fps));
          const tr = audioTrackFor(p, 0, dur);
          p = { ...tr.project, tracks: tr.project.tracks.map((x) => (x.id === tr.trackId ? { ...x, name: 'Música', clips: [{ id: uid('c'), mediaId: m.id, start: 0, duration: dur, trimStart: 0, volume: t.music!.volume, fadeIn: 0, fadeOut: Math.round(p.fps * 1.2) }] } : x)) };
        }
      }
      playhead.seek(0);
      dispatch({ type: 'load', project: p, filePath: null, saved: false });
      closeModal();
      notify(`Modelo "${t.name}" aberto. Arrasta os teus vídeos e fotos para os espaços às riscas (na timeline ou no ecrã).`);
    } catch (e) { notify(String((e as Error).message || e), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal ptpl-modal" role="dialog" aria-modal="true" aria-labelledby="ptpl-title">
        <div className="ptpl-head">
          <h3 id="ptpl-title">Novo a partir de modelo</h3>
          <button className="icon-btn" onClick={closeModal} aria-label="Fechar"><Icon name="x" size={16} /></button>
        </div>
        <p className="hint">Projetos prontos, com texto, música e transições. Passa o rato para ver; depois só tens de pôr os teus vídeos e fotos nos espaços.</p>
        <ul className="ptpl-grid">
          {PROJECT_TEMPLATES.map((t) => <Card key={t.id} t={t} busy={busy} onUse={() => { void use(t); }} />)}
        </ul>
      </div>
    </div>
  );
};
