import React, { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { VidCutComposition } from '../../shared/VidCutComposition';
import { projectDuration, type CompositionProps } from '../../shared/types';
import { useEditor } from '../editor-context';
import { playhead, useFrame, usePlaying } from '../playhead';
import { timecode } from '../util';
import { Icon } from './Icon';

export const Preview: React.FC = () => {
  const { state, mediaBase } = useEditor();
  const { project } = state;
  const ref = useRef<PlayerRef>(null);
  const duration = projectDuration(project);
  const inputProps = useMemo<CompositionProps>(() => ({ project, mediaBase }), [project, mediaBase]);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    playhead.player = p;
    const onFrame = (e: { detail: { frame: number } }) => playhead.setFrame(e.detail.frame);
    const onPlay = () => playhead.setPlaying(true);
    const onPause = () => playhead.setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    p.seekTo(playhead.frame);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
      if (playhead.player === p) playhead.player = null;
    };
  }, []);

  // se o projeto encurtar, não deixar a cabeça de leitura fora do fim
  useEffect(() => {
    if (playhead.frame > duration - 1) playhead.seek(duration - 1);
  }, [duration]);

  return (
    <section className="preview">
      <div className="preview-stage">
        <div className="preview-frame" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
          <Player
            ref={ref}
            component={VidCutComposition}
            inputProps={inputProps}
            durationInFrames={duration}
            fps={project.fps}
            compositionWidth={project.width}
            compositionHeight={project.height}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            clickToPlay={false}
            spaceKeyToPlayOrPause={false}
            doubleClickToFullscreen
            moveToBeginningWhenEnded={false}
            acknowledgeRemotionLicense
          />
        </div>
      </div>
      <Transport duration={duration} fps={project.fps} />
    </section>
  );
};

const Transport: React.FC<{ duration: number; fps: number }> = ({ duration, fps }) => {
  const frame = useFrame();
  const playing = usePlaying();
  return (
    <div className="transport">
      <span className="tc">{timecode(frame, fps)}</span>
      <div className="transport-buttons">
        <button className="icon-btn" title="Início (Home)" onClick={() => playhead.seek(0)}><Icon name="start" /></button>
        <button className="icon-btn" title="Frame anterior (←)" onClick={() => playhead.seek(frame - 1)}><Icon name="prev" /></button>
        <button className="icon-btn play" title="Reproduzir / pausa (Espaço)" onClick={() => playhead.toggle()}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button className="icon-btn" title="Frame seguinte (→)" onClick={() => playhead.seek(Math.min(duration - 1, frame + 1))}><Icon name="next" /></button>
        <button className="icon-btn" title="Fim (End)" onClick={() => playhead.seek(duration - 1)}><Icon name="end" /></button>
      </div>
      <span className="tc dim">{timecode(duration, fps)}</span>
    </div>
  );
};
